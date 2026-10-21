; Aria ERP Setup - installs, updates and uninstalls the local Docker demo (Inno Setup 6.3+).
;
; Build with build-installer.ps1, which stages the payload and passes:
;   AppVersion      release version, e.g. 0.2.0
;   NumericVersion  file version, e.g. 0.2.0.0
;   PayloadDir      staged files (compose file + deployment\local, release.env, aria.ico)
;
; Everything runs inside the wizard window: aria-local.ps1 runs without a
; console and prints '##aria <kind> <value>' lines (-ReportProgress), which the
; wizard shows as a short list of steps with a progress bar. Its full output
; is behind "Show details".
;
; Install:   copies the payload to {app}\versions\<version> and runs its
;            `aria-local.ps1 install`: a fresh install starts Aria, with demo
;            data when "Load demo data" is ticked; over an installed version it
;            switches to the new one with a restore point, health and data
;            checks and an automatic rollback.
; Manage:    run over an installed version (Start menu > Aria ERP Setup opens
;            a copy kept in {app}), it shows the Manage page: check GitHub for
;            a newer release and update to it, or uninstall.
; Uninstall: runs the installed version's `aria-local.ps1 uninstall`, then
;            removes the files (backups only when the user says so).
; Per-user install (no administrator rights); Docker Desktop must be installed.

#ifndef AppVersion
  #error AppVersion is not defined; build with build-installer.ps1
#endif
#if VER < EncodeVer(6, 3, 0)
  #error Inno Setup 6.3 or newer is required (ExecAndLogOutput)
#endif

[Setup]
AppId={{575C1FDD-5263-4037-AD2A-AF73F30D0077}
AppName=Aria ERP
AppVersion={#AppVersion}
AppVerName=Aria ERP {#AppVersion}
AppPublisher=Karthik P
AppPublisherURL=https://github.com/Karthik-beta/Aria
AppSupportURL=https://github.com/Karthik-beta/Aria/issues
AppCopyright=Copyright (C) 2024-present Karthik P. Licensed under AGPL-3.0-or-later.
VersionInfoProductName=Aria ERP
VersionInfoDescription=Aria ERP Setup
VersionInfoVersion={#NumericVersion}
; SignPath checks ProductName and ProductVersion (.signpath/artifact-configuration.xml).
VersionInfoProductVersion={#NumericVersion}
VersionInfoProductTextVersion={#AppVersion}
DefaultDirName={autopf}\Aria ERP
UsePreviousAppDir=yes
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=no
DisableReadyPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputBaseFilename=Aria-ERP-Setup
SetupIconFile={#PayloadDir}\aria.ico
UninstallDisplayIcon={app}\aria.ico
UninstallDisplayName=Aria ERP
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
CloseApplications=no

[Messages]
SetupAppTitle=Aria ERP Setup
SetupWindowTitle=Aria ERP Setup
WelcomeLabel1=Welcome to Aria ERP
WelcomeLabel2=This sets up [name/ver] on your computer.%n%nAria ERP runs inside Docker Desktop. Setup downloads it, prepares its database and starts it for you; keep this computer connected to the internet until it is done.

[Files]
Source: "{#PayloadDir}\*"; Excludes: "\aria.ico"; DestDir: "{app}\versions\{#AppVersion}"; Flags: recursesubdirs ignoreversion
Source: "{#PayloadDir}\aria.ico"; DestDir: "{app}"; Flags: ignoreversion
; A copy of this setup, which the Start menu opens to update or uninstall.
Source: "{srcexe}"; DestDir: "{app}"; DestName: "Aria-ERP-Setup.exe"; Flags: external ignoreversion
; Runs aria-local.ps1 for setup and the uninstaller (see RunAria below).
Source: "aria-run.ps1"; DestDir: "{app}"; Flags: ignoreversion

[InstallDelete]
; Replaced by the Aria ERP Setup shortcut.
Type: files; Name: "{autoprograms}\Uninstall Aria ERP.lnk"

[INI]
; aria-local.ps1 rewrites the URL when Aria runs on another port.
Filename: "{app}\Aria ERP.url"; Section: "InternetShortcut"; Key: "URL"; String: "http://localhost:8080/"; Flags: createkeyifdoesntexist

[Icons]
Name: "{autoprograms}\Aria ERP"; Filename: "{app}\Aria ERP.url"; IconFilename: "{app}\aria.ico"
Name: "{autodesktop}\Aria ERP"; Filename: "{app}\Aria ERP.url"; IconFilename: "{app}\aria.ico"
Name: "{autoprograms}\Aria ERP Setup"; Filename: "{app}\Aria-ERP-Setup.exe"; Comment: "Update or uninstall Aria ERP"

[Run]
Filename: "{app}\Aria ERP.url"; Description: "Open Aria ERP"; Flags: postinstall shellexec nowait skipifsilent; Check: ScriptSucceeded

[UninstallDelete]
; Created by aria-local.ps1 at run time. backups\ is removed by its uninstall
; unless the user chose to keep it.
Type: filesandordirs; Name: "{app}\versions"
Type: filesandordirs; Name: "{app}\logs"
Type: files; Name: "{app}\current-version.txt"
Type: files; Name: "{app}\Aria ERP.url"
Type: files; Name: "{app}\.aria-local.lock"
Type: files; Name: "{app}\aria-local.override.env"
Type: files; Name: "{app}\.aria-docker-removed"

[Code]
const
  DockerDownloadUrl = 'https://www.docker.com/products/docker-desktop/';
  ReleaseApiUrl = 'https://api.github.com/repos/Karthik-beta/Aria/releases/latest';
  SetupExeName = 'Aria-ERP-Setup.exe';
  UninstallKey = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{575C1FDD-5263-4037-AD2A-AF73F30D0077}_is1';
  // Written to {app} once setup has removed Aria from Docker, so the uninstaller only removes the files.
  DockerRemovedMarker = '.aria-docker-removed';

  // What this run of setup does.
  ModeInstall = 0; // nothing installed: install this version
  ModeManage = 1;  // installed: the Manage page (update check, uninstall)
  ModeUpdate = 2;  // installed: install this version over it

  StepPending = 0;
  StepActive = 1;
  StepDone = 2;
  StepFailed = 3;

type
  // Room for a Windows MSG in 32- and 64-bit processes; only Windows reads it.
  TWinMsg = record
    Data: array[0..11] of Int64;
  end;

var
  Mode: Integer;
  // The installed copy, from the uninstall registry key.
  InstalledDir, InstalledVersion, UninstallExe: String;
  // No current-version.txt: the last install did not finish.
  InstallIncomplete: Boolean;

  OptionsPage: TInputOptionWizardPage;
  ManagePage: TWizardPage;
  UninstallPage: TOutputProgressWizardPage;
  DownloadPage: TDownloadWizardPage;
  ManageControls: array of TControl;
  UpdateStatusLabel, ManageResultLabel: TNewStaticText;
  CheckUpdatesButton: TNewButton;
  KeepBackupsCheck: TNewCheckBox;
  // A newer release on GitHub than both the installed version and this setup.
  OnlineVersion, OnlineUrl: String;
  ClosingForUpdate: Boolean;

  // Steps of the running aria-local.ps1, shown on the installing or uninstall page.
  StepKeys: TArrayOfString;
  StepMarks, StepLabels: array of TNewStaticText;
  CurrentStep: Integer;
  PhaseLabel: TNewStaticText;
  PhaseBar: TNewProgressBar;
  DetailsButton: TNewButton;
  DetailsMemo: TNewMemo;
  LastError: String;
  ScriptOk: Boolean;
  // aria-local.ps1 is running: the window stays usable, but must not close.
  ScriptRunning: Boolean;
  RunCount: Integer;

  // Uninstaller
  KeepBackups: Boolean;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function HasParam(const Name: String): Boolean;
var
  I: Integer;
begin
  Result := False;
  for I := 1 to ParamCount do
    if CompareText(ParamStr(I), Name) = 0 then
      Result := True;
end;

// Removes and returns the part of S before the first '.'.
function TakeVersionPart(var S: String): String;
var
  I: Integer;
begin
  I := Pos('.', S);
  if I = 0 then
  begin
    Result := S;
    S := '';
  end
  else
  begin
    Result := Copy(S, 1, I - 1);
    S := Copy(S, I + 1, MaxInt);
  end;
end;

// > 0 when A is newer than B. A release is newer than its pre-releases (0.2.0 > 0.2.0-rc.1).
function CompareVersions(A, B: String): Integer;
var
  PreA, PreB: String;
  I, NA, NB: Integer;
begin
  PreA := '';
  PreB := '';
  I := Pos('-', A);
  if I > 0 then
  begin
    PreA := Copy(A, I + 1, MaxInt);
    A := Copy(A, 1, I - 1);
  end;
  I := Pos('-', B);
  if I > 0 then
  begin
    PreB := Copy(B, I + 1, MaxInt);
    B := Copy(B, 1, I - 1);
  end;
  Result := 0;
  while (Result = 0) and ((A <> '') or (B <> '')) do
  begin
    NA := StrToIntDef(TakeVersionPart(A), 0);
    NB := StrToIntDef(TakeVersionPart(B), 0);
    if NA > NB then
      Result := 1
    else if NA < NB then
      Result := -1;
  end;
  if Result = 0 then
  begin
    if (PreA = '') and (PreB <> '') then
      Result := 1
    else if (PreA <> '') and (PreB = '') then
      Result := -1
    else
      Result := CompareText(PreA, PreB);
  end;
end;

// The first "..." string after the ':' that follows the start of S.
function JsonStringAfterColon(S: String): String;
begin
  S := Copy(S, Pos(':', S) + 1, MaxInt);
  S := Copy(S, Pos('"', S) + 1, MaxInt);
  Result := Copy(S, 1, Pos('"', S) - 1);
end;

function ReadEnvValue(const FileName, Key: String; var Value: String): Boolean;
var
  Lines: TArrayOfString;
  I: Integer;
  Line: String;
begin
  Result := False;
  if not LoadStringsFromFile(FileName, Lines) then
    Exit;
  for I := 0 to GetArrayLength(Lines) - 1 do
  begin
    Line := Trim(Lines[I]);
    if CompareText(Copy(Line, 1, Length(Key) + 1), Key + '=') = 0 then
    begin
      Value := RemoveQuotes(Trim(Copy(Line, Length(Key) + 2, MaxInt)));
      Result := True;
    end;
  end;
end;

// Sets Key=Value in a KEY=VALUE file, creating it when needed.
procedure WriteEnvValue(const FileName, Key, Value: String);
var
  Lines: TArrayOfString;
  I, Count: Integer;
  Found: Boolean;
begin
  if not LoadStringsFromFile(FileName, Lines) then
    SetArrayLength(Lines, 0);
  Found := False;
  Count := GetArrayLength(Lines);
  for I := 0 to Count - 1 do
    if CompareText(Copy(Trim(Lines[I]), 1, Length(Key) + 1), Key + '=') = 0 then
    begin
      Lines[I] := Key + '=' + Value;
      Found := True;
    end;
  if not Found then
  begin
    SetArrayLength(Lines, Count + 1);
    Lines[Count] := Key + '=' + Value;
  end;
  SaveStringsToFile(FileName, Lines, False);
end;

// A setting of the installed Aria: the release's env file, then the user's overrides.
function GetAriaSetting(const Root, Key, Default: String): String;
begin
  Result := Default;
  ReadEnvValue(AddBackslash(Root) + 'versions\{#AppVersion}\deployment\local\aria-local.env', Key, Result);
  ReadEnvValue(AddBackslash(Root) + 'aria-local.override.env', Key, Result);
end;

function ReadInstallValue(const Name: String; var Value: String): Boolean;
begin
  Result := RegQueryStringValue(HKCU, UninstallKey, Name, Value) or
    RegQueryStringValue(HKLM, UninstallKey, Name, Value);
end;

procedure DetectInstall;
var
  Version: AnsiString;
begin
  InstalledDir := '';
  InstalledVersion := '';
  UninstallExe := '';
  if not ReadInstallValue('Inno Setup: App Path', InstalledDir) or not DirExists(InstalledDir) then
  begin
    InstalledDir := '';
    Exit;
  end;
  ReadInstallValue('DisplayVersion', InstalledVersion);
  if ReadInstallValue('UninstallString', UninstallExe) then
    UninstallExe := RemoveQuotes(UninstallExe);
  InstallIncomplete := not LoadStringFromFile(AddBackslash(InstalledDir) + 'current-version.txt', Version);
  if not InstallIncomplete then
    InstalledVersion := Trim(String(Version));
end;

// The script of the installed version: the one in current-version.txt, else any that is there.
function InstalledScript(const Root: String): String;
var
  Version: AnsiString;
  FindRec: TFindRec;
  Candidate: String;
begin
  Result := '';
  if LoadStringFromFile(AddBackslash(Root) + 'current-version.txt', Version) then
  begin
    Candidate := AddBackslash(Root) + 'versions\' + Trim(String(Version)) + '\deployment\local\aria-local.ps1';
    if FileExists(Candidate) then
    begin
      Result := Candidate;
      Exit;
    end;
  end;
  if FindFirst(AddBackslash(Root) + 'versions\*', FindRec) then
    try
      repeat
        Candidate := AddBackslash(Root) + 'versions\' + FindRec.Name + '\deployment\local\aria-local.ps1';
        if (FindRec.Name <> '.') and (FindRec.Name <> '..') and FileExists(Candidate) then
          Result := Candidate;
      until (Result <> '') or not FindNext(FindRec);
    finally
      FindClose(FindRec);
    end;
end;

// ---------------------------------------------------------------------------
// Steps: what aria-local.ps1 is doing, in plain words
// ---------------------------------------------------------------------------
function IsUpdate: Boolean;
begin
  Result := (Mode = ModeUpdate) and not InstallIncomplete;
end;

function StepTitle(const Key: String): String;
begin
  if Key = 'check' then
    Result := 'Checking your computer'
  else if Key = 'backup' then
    Result := 'Saving a restore point'
  else if (Key = 'download') and IsUpdate then
    Result := 'Downloading the update'
  else if Key = 'download' then
    Result := 'Downloading Aria ERP'
  else if (Key = 'database') and IsUpdate then
    Result := 'Updating the database'
  else if Key = 'database' then
    Result := 'Preparing the database'
  else if Key = 'demo' then
    Result := 'Loading demo data'
  else if Key = 'start' then
    Result := 'Starting Aria ERP'
  else if Key = 'verify' then
    Result := 'Making sure everything works'
  else if Key = 'remove' then
    Result := 'Removing Aria ERP and its data'
  else if Key = 'cleanup' then
    Result := 'Cleaning up'
  else if Key = 'files' then
    Result := 'Removing program files'
  else
    Result := Key;
end;

procedure AddStep(var Keys: TArrayOfString; const Key: String);
begin
  SetArrayLength(Keys, GetArrayLength(Keys) + 1);
  Keys[GetArrayLength(Keys) - 1] := Key;
end;

procedure MarkStep(Index, State: Integer);
begin
  case State of
    StepPending:
      begin
        StepMarks[Index].Caption := #$25CB;
        StepMarks[Index].Font.Color := clGray;
        StepLabels[Index].Font.Color := clGray;
        StepLabels[Index].Font.Style := [];
      end;
    StepActive:
      begin
        StepMarks[Index].Caption := #$25B6;
        StepMarks[Index].Font.Color := clHighlight;
        StepLabels[Index].Font.Color := clWindowText;
        StepLabels[Index].Font.Style := [fsBold];
      end;
    StepDone:
      begin
        StepMarks[Index].Caption := #$2714;
        StepMarks[Index].Font.Color := clGreen;
        StepLabels[Index].Font.Color := clWindowText;
        StepLabels[Index].Font.Style := [];
      end;
    StepFailed:
      begin
        StepMarks[Index].Caption := #$2716;
        StepMarks[Index].Font.Color := clRed;
        StepLabels[Index].Font.Color := clRed;
        StepLabels[Index].Font.Style := [fsBold];
      end;
  end;
end;

procedure DetailsButtonClick(Sender: TObject);
var
  I: Integer;
begin
  DetailsMemo.Visible := not DetailsMemo.Visible;
  for I := 0 to GetArrayLength(StepLabels) - 1 do
  begin
    StepMarks[I].Visible := not DetailsMemo.Visible;
    StepLabels[I].Visible := not DetailsMemo.Visible;
  end;
  if DetailsMemo.Visible then
    DetailsButton.Caption := 'Hide details'
  else
    DetailsButton.Caption := 'Show details';
end;

// The step list, progress bar and (hidden) details log, at Left/Top of Parent.
procedure CreateStepPanel(Parent: TWinControl; Left, Top, Width: Integer; Keys: TArrayOfString);
var
  I, Y: Integer;
begin
  StepKeys := Keys;
  CurrentStep := -1;
  SetArrayLength(StepMarks, GetArrayLength(Keys));
  SetArrayLength(StepLabels, GetArrayLength(Keys));
  for I := 0 to GetArrayLength(Keys) - 1 do
  begin
    StepMarks[I] := TNewStaticText.Create(WizardForm);
    StepMarks[I].Parent := Parent;
    StepMarks[I].Left := Left;
    StepMarks[I].Top := Top + I * ScaleY(22);
    StepMarks[I].Font.Name := 'Segoe UI Symbol';
    StepLabels[I] := TNewStaticText.Create(WizardForm);
    StepLabels[I].Parent := Parent;
    StepLabels[I].Left := Left + ScaleX(22);
    StepLabels[I].Top := StepMarks[I].Top;
    StepLabels[I].Caption := StepTitle(Keys[I]);
    MarkStep(I, StepPending);
  end;
  Y := Top + GetArrayLength(Keys) * ScaleY(22) + ScaleY(8);

  DetailsMemo := TNewMemo.Create(WizardForm);
  DetailsMemo.Parent := Parent;
  DetailsMemo.SetBounds(Left, Top, Width, Y - Top - ScaleY(4));
  DetailsMemo.ReadOnly := True;
  DetailsMemo.ScrollBars := ssBoth;
  DetailsMemo.WordWrap := False;
  DetailsMemo.Visible := False;

  PhaseLabel := TNewStaticText.Create(WizardForm);
  PhaseLabel.Parent := Parent;
  PhaseLabel.Left := Left;
  PhaseLabel.Top := Y;
  PhaseLabel.Caption := 'Please wait...';

  PhaseBar := TNewProgressBar.Create(WizardForm);
  PhaseBar.Parent := Parent;
  PhaseBar.SetBounds(Left, Y + ScaleY(20), Width, ScaleY(16));
  PhaseBar.Style := npbstMarquee;

  DetailsButton := TNewButton.Create(WizardForm);
  DetailsButton.Parent := Parent;
  DetailsButton.SetBounds(Left, Y + ScaleY(44), ScaleX(110), ScaleY(23));
  DetailsButton.Caption := 'Show details';
  DetailsButton.OnClick := @DetailsButtonClick;
end;

procedure SetPhase(const Key: String);
var
  I, Index: Integer;
begin
  if IsUninstaller then
  begin
    UninstallProgressForm.StatusLabel.Caption := StepTitle(Key) + '...';
    Exit;
  end;
  if PhaseLabel = nil then
    Exit;
  if Key = 'rollback' then
  begin
    PhaseLabel.Caption := 'Something went wrong. Restoring the previous version...';
    PhaseBar.Style := npbstMarquee;
    Exit;
  end;
  Index := -1;
  for I := 0 to GetArrayLength(StepKeys) - 1 do
    if StepKeys[I] = Key then
      Index := I;
  // Steps not on the list (demo data when it is off) and repeats (an update
  // runs the start-up steps again) leave the list as it is.
  if Index <= CurrentStep then
    Exit;
  for I := 0 to Index - 1 do
    MarkStep(I, StepDone);
  MarkStep(Index, StepActive);
  CurrentStep := Index;
  PhaseLabel.Caption := StepTitle(Key) + '...';
  PhaseBar.Style := npbstMarquee;
end;

procedure SetPercent(Percent: Integer);
begin
  if IsUninstaller or (PhaseLabel = nil) or (CurrentStep < 0) then
    Exit;
  PhaseBar.Style := npbstNormal;
  PhaseBar.Max := 100;
  PhaseBar.Position := Percent;
  PhaseLabel.Caption := StepTitle(StepKeys[CurrentStep]) + '... ' + IntToStr(Percent) + '%';
end;

procedure FinishSteps(Success: Boolean);
var
  I: Integer;
begin
  if PhaseLabel = nil then
    Exit;
  PhaseBar.Style := npbstNormal;
  PhaseBar.Max := 100;
  if Success then
  begin
    for I := 0 to GetArrayLength(StepKeys) - 1 do
      MarkStep(I, StepDone);
    PhaseBar.Position := 100;
    PhaseLabel.Caption := 'Done.';
  end
  else
  begin
    if CurrentStep >= 0 then
      MarkStep(CurrentStep, StepFailed);
    PhaseBar.Position := 0;
    PhaseLabel.Caption := 'Something went wrong.';
  end;
end;

// Output of aria-local.ps1: '##aria' lines move the steps, the rest goes to the details log.
procedure ScriptOutput(const S: String);
var
  Rest, Kind, Value: String;
  I: Integer;
begin
  if Copy(S, 1, 7) = '##aria ' then
  begin
    Rest := Copy(S, 8, MaxInt);
    I := Pos(' ', Rest);
    if I = 0 then
    begin
      Kind := Rest;
      Value := '';
    end
    else
    begin
      Kind := Copy(Rest, 1, I - 1);
      Value := Trim(Copy(Rest, I + 1, MaxInt));
    end;
    if Kind = 'phase' then
      SetPhase(Value)
    else if Kind = 'percent' then
      SetPercent(StrToIntDef(Value, 0))
    else if Kind = 'error' then
      LastError := Value;
  end
  else if DetailsMemo <> nil then
    DetailsMemo.Lines.Add(S);
end;

function PeekMessage(var Msg: TWinMsg; Wnd: HWND; MsgFilterMin, MsgFilterMax, RemoveMsg: Cardinal): BOOL;
  external 'PeekMessageW@user32.dll stdcall';
function TranslateMessage(var Msg: TWinMsg): BOOL;
  external 'TranslateMessage@user32.dll stdcall';
function DispatchMessage(var Msg: TWinMsg): Longint;
  external 'DispatchMessageW@user32.dll stdcall';

// Handles clicks, scrolling and repaints while setup waits for aria-local.ps1.
procedure PumpMessages;
var
  Msg: TWinMsg;
begin
  // 1 = PM_REMOVE
  while PeekMessage(Msg, 0, 0, 0, 1) do
  begin
    TranslateMessage(Msg);
    DispatchMessage(Msg);
  end;
end;

function RunnerScript: String;
begin
  if IsUninstaller then
    Result := ExpandConstant('{app}\aria-run.ps1')
  else
  begin
    ExtractTemporaryFile('aria-run.ps1');
    Result := ExpandConstant('{tmp}\aria-run.ps1');
  end;
end;

// Runs aria-local.ps1 without a console window and returns True when it succeeded.
// Exec and ExecAndLogOutput disable the window while they wait, which would
// leave "Show details" dead, so aria-run.ps1 starts it without waiting and
// writes its output to a log file that this loop reads as it grows.
function RunAria(const ScriptPath, Arguments: String): Boolean;
var
  Params, LogFile, DoneFile, Pending: String;
  Contents: AnsiString;
  Offset, I, Code: Integer;
  Finished: Boolean;
begin
  LastError := '';
  Params := Arguments;
  // Older installed versions have no -ReportProgress; they still run, without the step list.
  if LoadStringFromFile(ScriptPath, Contents) and (Pos('ReportProgress', String(Contents)) > 0) then
    Params := Params + ' -ReportProgress';
  RunCount := RunCount + 1;
  LogFile := ExpandConstant('{tmp}\aria-run-') + IntToStr(RunCount) + '.log';
  DoneFile := ExpandConstant('{tmp}\aria-run-') + IntToStr(RunCount) + '.done';
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + RunnerScript + '" -Script "' + ScriptPath +
    '" -Log "' + LogFile + '" -Done "' + DoneFile + '" -Arguments "' + Params + '"',
    '', SW_HIDE, ewNoWait, Code) then
  begin
    LastError := 'Could not start PowerShell: ' + SysErrorMessage(Code);
    Result := False;
    Exit;
  end;

  ScriptRunning := True;
  Offset := 0;
  Pending := '';
  try
    repeat
      // Checked before reading, so the last read has everything the script wrote.
      Finished := FileExists(DoneFile);
      if LoadStringFromFile(LogFile, Contents) and (Length(Contents) > Offset) then
      begin
        Pending := Pending + String(Copy(Contents, Offset + 1, MaxInt));
        Offset := Length(Contents);
        I := Pos(#10, Pending);
        while I > 0 do
        begin
          ScriptOutput(TrimRight(Copy(Pending, 1, I - 1)));
          Pending := Copy(Pending, I + 1, MaxInt);
          I := Pos(#10, Pending);
        end;
      end;
      if not Finished then
        for I := 1 to 10 do
        begin
          PumpMessages;
          Sleep(20);
        end;
    until Finished;
  finally
    ScriptRunning := False;
  end;
  if Trim(Pending) <> '' then
    ScriptOutput(TrimRight(Pending));

  Code := -1;
  if LoadStringFromFile(DoneFile, Contents) then
    Code := StrToIntDef(Trim(String(Contents)), -1);
  Result := Code = 0;
  if not Result and (LastError = '') then
    LastError := 'The setup script stopped with exit code ' + IntToStr(Code) + '.';
end;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
function InitializeSetup: Boolean;
var
  ErrorCode: Integer;
  TempCopy: String;
begin
  Result := True;
  DetectInstall;

  // Opened from the copy in the install folder: run a temporary copy instead,
  // so an update or uninstall can replace or remove that file.
  if (InstalledDir <> '') and (CompareText(ExpandConstant('{srcexe}'), AddBackslash(InstalledDir) + SetupExeName) = 0) then
  begin
    TempCopy := AddBackslash(GetTempDir) + 'Aria-ERP-Setup-' + GetDateTimeString('yyyymmddhhnnss', #0, #0) + '.exe';
    if FileCopy(ExpandConstant('{srcexe}'), TempCopy, False) and
      Exec(TempCopy, '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode) then
    begin
      Result := False;
      Exit;
    end;
  end;

  if InstalledDir = '' then
    Mode := ModeInstall
  else if HasParam('/UPDATE') then
    // Started by the Manage page of an older version after downloading this one.
    Mode := ModeUpdate
  else
    Mode := ModeManage;

  if (Mode = ModeInstall) and not FileExists(ExpandConstant('{commonpf64}\Docker\Docker\Docker Desktop.exe')) then
  begin
    if MsgBox('Aria ERP runs in Docker Desktop, which is not installed on this computer.' + #13#10#13#10 +
      'Install Docker Desktop (this needs administrator rights), start it once, then run Aria ERP Setup again.' + #13#10#13#10 +
      'Open the Docker Desktop download page now?', mbError, MB_YESNO) = IDYES then
      ShellExec('open', DockerDownloadUrl, '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
    Result := False;
  end;
end;

function BundledUpdateAvailable: Boolean;
begin
  Result := InstallIncomplete or (CompareVersions('{#AppVersion}', InstalledVersion) > 0);
end;

// The Next button is the Update button on the Manage page, shown when there is something to update to.
procedure UpdateManageButtons;
begin
  WizardForm.NextButton.Visible := (OnlineVersion <> '') or BundledUpdateAvailable;
  if InstallIncomplete and (OnlineVersion = '') then
    WizardForm.NextButton.Caption := 'Repair'
  else
    WizardForm.NextButton.Caption := 'Update';
  WizardForm.CancelButton.Caption := 'Close';
end;

function DefaultUpdateStatus: String;
begin
  if InstallIncomplete then
    Result := 'The last setup of Aria ERP did not finish. Click Repair to set up version {#AppVersion} again.'
  else if BundledUpdateAvailable then
    Result := 'This setup updates Aria ERP to version {#AppVersion}. Click Update to install it, or check for an even newer version.'
  else
    Result := 'Check online for a newer version of Aria ERP.';
end;

procedure CheckUpdatesButtonClick(Sender: TObject);
var
  Request: Variant;
  Json, Rest, Url, Version, Newest: String;
begin
  UpdateStatusLabel.Caption := 'Checking for updates...';
  CheckUpdatesButton.Enabled := False;
  OnlineVersion := '';
  OnlineUrl := '';
  try
    try
      Request := CreateOleObject('WinHttp.WinHttpRequest.5.1');
      Request.SetTimeouts(10000, 10000, 15000, 15000);
      Request.Open('GET', ReleaseApiUrl, False);
      // GitHub's API rejects requests without a User-Agent.
      Request.SetRequestHeader('User-Agent', 'Aria-ERP-Setup/{#AppVersion}');
      Request.SetRequestHeader('Accept', 'application/vnd.github+json');
      Request.Send('');
      if Request.Status <> 200 then
        RaiseException('GitHub answered ' + IntToStr(Request.Status));
      Json := Request.ResponseText;

      Version := JsonStringAfterColon(Copy(Json, Pos('"tag_name"', Json), MaxInt));
      if Copy(Version, 1, 1) = 'v' then
        Version := Copy(Version, 2, MaxInt);
      Url := '';
      Rest := Json;
      while (Url = '') and (Pos('"browser_download_url"', Rest) > 0) do
      begin
        Rest := Copy(Rest, Pos('"browser_download_url"', Rest) + 22, MaxInt);
        Url := JsonStringAfterColon(Rest);
        if CompareText(Copy(Url, Length(Url) - Length(SetupExeName), MaxInt), '/' + SetupExeName) <> 0 then
          Url := '';
      end;

      Newest := InstalledVersion;
      if BundledUpdateAvailable and (CompareVersions('{#AppVersion}', Newest) > 0) then
        Newest := '{#AppVersion}';
      if (Version <> '') and (Url <> '') and (CompareVersions(Version, Newest) > 0) then
      begin
        OnlineVersion := Version;
        OnlineUrl := Url;
        UpdateStatusLabel.Caption := 'Aria ERP ' + Version + ' is available (you have ' + InstalledVersion + '). Click Update to download and install it.';
      end
      else if BundledUpdateAvailable then
        UpdateStatusLabel.Caption := 'Version {#AppVersion} in this setup is the newest. Click ' + WizardForm.NextButton.Caption + ' to install it.'
      else
        UpdateStatusLabel.Caption := 'Aria ERP is up to date (version ' + InstalledVersion + ').';
    except
      UpdateStatusLabel.Caption := 'Could not check for updates. Check the internet connection and try again.';
      Log('Update check failed: ' + GetExceptionMessage);
    end;
  finally
    CheckUpdatesButton.Enabled := True;
  end;
  UpdateManageButtons;
end;

function OnDownloadProgress(const Url, FileName: String; const Progress, ProgressMax: Int64): Boolean;
begin
  Result := True;
end;

// Downloads the newer setup and hands over to it: it starts installing right away (/UPDATE).
procedure DownloadAndRunUpdate;
var
  Target: String;
  Code: Integer;
begin
  DownloadPage.Clear;
  DownloadPage.Add(OnlineUrl, SetupExeName, '');
  DownloadPage.Show;
  try
    try
      DownloadPage.Download;
      // {tmp} is removed when this setup closes, so the new one runs from a copy.
      Target := AddBackslash(GetTempDir) + 'Aria-ERP-Setup-' + OnlineVersion + '.exe';
      if not FileCopy(ExpandConstant('{tmp}\' + SetupExeName), Target, False) or
        not Exec(Target, '/UPDATE', '', SW_SHOWNORMAL, ewNoWait, Code) then
        RaiseException('Could not start the downloaded Aria ERP Setup.');
      ClosingForUpdate := True;
    except
      if not DownloadPage.AbortedByUser then
        MsgBox('The update could not be downloaded.' + #13#10#13#10 + GetExceptionMessage, mbError, MB_OK);
    end;
  finally
    DownloadPage.Hide;
  end;
  if ClosingForUpdate then
    WizardForm.Close;
end;

procedure ShowManageResult(const Heading, Text: String);
var
  I: Integer;
begin
  for I := 0 to GetArrayLength(ManageControls) - 1 do
    ManageControls[I].Visible := False;
  WizardForm.PageNameLabel.Caption := Heading;
  WizardForm.PageDescriptionLabel.Caption := '';
  ManageResultLabel.Caption := Text;
  ManageResultLabel.Visible := True;
  WizardForm.NextButton.Visible := False;
  WizardForm.CancelButton.Caption := 'Close';
end;

// Removes Aria from Docker with the installed script, then the files with the uninstaller.
procedure UninstallButtonClick(Sender: TObject);
var
  Text, Script, Arguments: String;
  Keys: TArrayOfString;
  Removed: Boolean;
  Code: Integer;
begin
  Text := 'Uninstall Aria ERP?' + #13#10#13#10 + 'This removes Aria ERP and all its data from this computer';
  if KeepBackupsCheck.Checked then
    Text := Text + ', but keeps the database backups in ' + AddBackslash(InstalledDir) + 'backups.'
  else
    Text := Text + ', including the database backups.';
  if MsgBox(Text, mbConfirmation, MB_YESNO or MB_DEFBUTTON2) <> IDYES then
    Exit;

  SetArrayLength(Keys, 0);
  AddStep(Keys, 'check');
  AddStep(Keys, 'remove');
  AddStep(Keys, 'cleanup');
  AddStep(Keys, 'files');
  UninstallPage.Msg1Label.Visible := False;
  UninstallPage.Msg2Label.Visible := False;
  UninstallPage.ProgressBar.Visible := False;
  if PhaseLabel = nil then
    CreateStepPanel(UninstallPage.Surface, 0, 0, UninstallPage.SurfaceWidth, Keys);
  UninstallPage.Show;
  Removed := False;
  try
    Script := InstalledScript(InstalledDir);
    Arguments := 'uninstall -Force';
    if KeepBackupsCheck.Checked then
      Arguments := Arguments + ' -KeepBackups';
    if (Script = '') or RunAria(Script, Arguments) or
      (MsgBox('Aria ERP could not be removed from Docker completely:' + #13#10 + LastError + #13#10#13#10 +
        'Make sure Docker Desktop is running and try again, or remove the program files now and clean up Docker Desktop yourself.' + #13#10#13#10 +
        'Remove the program files now?', mbError, MB_YESNO or MB_DEFBUTTON2) = IDYES) then
    begin
      SetPhase('files');
      SaveStringToFile(AddBackslash(InstalledDir) + DockerRemovedMarker, '', False);
      // Aria is already out of Docker. Uninstallers of versions before the
      // marker run the installed script again, in a console window; without
      // the scripts there they skip that step.
      DelTree(AddBackslash(InstalledDir) + 'versions', True, True, True);
      DeleteFile(AddBackslash(InstalledDir) + 'current-version.txt');
      if (UninstallExe <> '') and Exec(UninstallExe, '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART', '', SW_HIDE, ewWaitUntilTerminated, Code) then
        Removed := not FileExists(UninstallExe);
      if not Removed then
      begin
        DeleteFile(AddBackslash(InstalledDir) + DockerRemovedMarker);
        LastError := 'The program files could not be removed. Uninstall Aria ERP from Windows Settings > Apps.';
      end;
    end;
    FinishSteps(Removed);
  finally
    UninstallPage.Hide;
  end;

  if Removed then
  begin
    Text := 'Aria ERP was removed from this computer.';
    if KeepBackupsCheck.Checked and DirExists(AddBackslash(InstalledDir) + 'backups') then
      Text := Text + #13#10#13#10 + 'Your database backups are in ' + AddBackslash(InstalledDir) + 'backups.';
    ShowManageResult('Aria ERP is uninstalled', Text);
  end
  else
    ShowManageResult('Aria ERP was not uninstalled', LastError + #13#10#13#10 + 'Close this window and run Aria ERP Setup again to retry.');
end;

procedure AddManageControl(Control: TControl);
begin
  SetArrayLength(ManageControls, GetArrayLength(ManageControls) + 1);
  ManageControls[GetArrayLength(ManageControls) - 1] := Control;
end;

function AddManageText(Top: Integer; const Caption: String; Bold: Boolean): TNewStaticText;
begin
  Result := TNewStaticText.Create(ManagePage);
  Result.Parent := ManagePage.Surface;
  Result.AutoSize := False;
  Result.WordWrap := True;
  Result.SetBounds(0, Top, ManagePage.SurfaceWidth, ScaleY(16));
  Result.Caption := Caption;
  if Bold then
    Result.Font.Style := [fsBold];
  AddManageControl(Result);
end;

procedure CreateManagePage;
var
  UninstallButton: TNewButton;
  Version: String;
begin
  Version := InstalledVersion;
  if Version = '' then
    Version := 'unknown';
  ManagePage := CreateCustomPage(wpWelcome, 'Aria ERP is installed',
    'Version ' + Version + ' is installed on this computer.');

  AddManageText(0, 'Updates', True);
  UpdateStatusLabel := AddManageText(ScaleY(20), DefaultUpdateStatus, False);
  UpdateStatusLabel.Height := ScaleY(30);
  CheckUpdatesButton := TNewButton.Create(ManagePage);
  CheckUpdatesButton.Parent := ManagePage.Surface;
  CheckUpdatesButton.SetBounds(0, ScaleY(54), ScaleX(130), ScaleY(23));
  CheckUpdatesButton.Caption := 'Check for updates';
  CheckUpdatesButton.OnClick := @CheckUpdatesButtonClick;
  AddManageControl(CheckUpdatesButton);

  AddManageText(ScaleY(100), 'Uninstall', True);
  AddManageText(ScaleY(120), 'Removes Aria ERP, its data and its downloads from this computer.', False);
  KeepBackupsCheck := TNewCheckBox.Create(ManagePage);
  KeepBackupsCheck.Parent := ManagePage.Surface;
  KeepBackupsCheck.SetBounds(0, ScaleY(142), ManagePage.SurfaceWidth, ScaleY(17));
  KeepBackupsCheck.Caption := 'Keep my database backups';
  KeepBackupsCheck.Checked := True;
  AddManageControl(KeepBackupsCheck);
  UninstallButton := TNewButton.Create(ManagePage);
  UninstallButton.Parent := ManagePage.Surface;
  UninstallButton.SetBounds(0, ScaleY(166), ScaleX(130), ScaleY(23));
  UninstallButton.Caption := 'Uninstall';
  UninstallButton.OnClick := @UninstallButtonClick;
  AddManageControl(UninstallButton);

  ManageResultLabel := TNewStaticText.Create(ManagePage);
  ManageResultLabel.Parent := ManagePage.Surface;
  ManageResultLabel.AutoSize := False;
  ManageResultLabel.WordWrap := True;
  ManageResultLabel.SetBounds(0, 0, ManagePage.SurfaceWidth, ScaleY(120));
  ManageResultLabel.Visible := False;
end;

procedure InitializeWizard;
begin
  OptionsPage := CreateInputOptionPage(wpWelcome, 'Options', 'Choose how Aria ERP starts.',
    'Demo data fills Aria ERP with sample companies, items, stock, assets and transactions, so you can try every module straight away. Leave it unticked to start with an empty system.',
    False, False);
  OptionsPage.Add('Load demo data');
  OptionsPage.Values[0] := True;

  CreateManagePage;
  UninstallPage := CreateOutputProgressPage('Uninstalling Aria ERP', 'Please wait while Aria ERP is removed from this computer.');
  DownloadPage := CreateDownloadPage('Downloading the update', 'Aria ERP Setup is downloading the newer version.', @OnDownloadProgress);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  if PageID = wpWelcome then
    Result := Mode <> ModeInstall
  else if PageID = ManagePage.ID then
    Result := Mode <> ModeManage
  else if PageID = OptionsPage.ID then
    Result := Mode <> ModeInstall
  else
    Result := False;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = ManagePage.ID then
  begin
    if OnlineVersion <> '' then
    begin
      DownloadAndRunUpdate;
      Result := False;
    end
    else
      Mode := ModeUpdate;
  end;
end;

procedure CancelButtonClick(CurPageID: Integer; var Cancel, Confirm: Boolean);
begin
  // Stopping aria-local.ps1 halfway could leave Aria stopped or half-updated.
  if ScriptRunning then
  begin
    Cancel := False;
    Confirm := False;
    MsgBox('Please wait until Aria ERP Setup has finished.', mbInformation, MB_OK);
  end
  // Nothing is half-done on the Manage page, and an update has been handed over.
  else if (CurPageID = ManagePage.ID) or ClosingForUpdate then
    Confirm := False;
end;

procedure CurPageChanged(CurPageID: Integer);
var
  Url, User, Password, Heading, Text: String;
begin
  if CurPageID = ManagePage.ID then
    UpdateManageButtons
  // The last page before installing; DisableReadyPage leaves its button at "Next".
  else if CurPageID = OptionsPage.ID then
    WizardForm.NextButton.Caption := SetupMessage(msgButtonInstall)
  // Shown only when an older version's Manage page started this setup (/UPDATE):
  // Inno shows the Ready page when no page comes before it.
  else if CurPageID = wpReady then
  begin
    WizardForm.PageNameLabel.Caption := 'Ready to update';
    WizardForm.PageDescriptionLabel.Caption := 'Aria ERP ' + InstalledVersion + ' will be updated to {#AppVersion}.';
    WizardForm.ReadyLabel.Caption := 'Setup saves a restore point first. If anything goes wrong, Aria ERP goes back to version ' +
      InstalledVersion + ' with your data as it is now.' + #13#10#13#10 + 'Click Update to continue.';
    WizardForm.ReadyMemo.Visible := False;
    WizardForm.NextButton.Caption := 'Update';
  end
  else if CurPageID = wpFinished then
  begin
    if ScriptOk then
    begin
      Url := GetIniString('InternetShortcut', 'URL', 'http://localhost:8080/', ExpandConstant('{app}\Aria ERP.url'));
      User := GetAriaSetting(ExpandConstant('{app}'), 'DEFAULT_ADMIN_USERNAME', 'admin');
      Password := GetAriaSetting(ExpandConstant('{app}'), 'DEFAULT_ADMIN_PASSWORD', 'admin123');
      if IsUpdate then
        Heading := 'Aria ERP is updated'
      else
        Heading := 'Aria ERP is ready';
      Text := 'Aria ERP {#AppVersion} is running at ' + Url + #13#10#13#10 +
        'Sign in with the user name "' + User + '" and the password "' + Password + '".' + #13#10#13#10 +
        'Aria ERP keeps running in Docker Desktop. To update or uninstall it, open Aria ERP Setup from the Start menu.';
    end
    else
    begin
      if IsUpdate then
      begin
        Heading := 'Aria ERP was not updated';
        Text := LastError + #13#10#13#10 + 'Your previous version was restored and is still running.';
      end
      else
      begin
        Heading := 'Aria ERP could not be set up';
        Text := LastError;
      end;
      Text := Text + #13#10#13#10 + 'Fix the cause (for example, start Docker Desktop or check the internet connection) and run Aria ERP Setup again.';
      Text := Text + #13#10#13#10 + 'Details are in ' + ExpandConstant('{app}\logs');
    end;
    WizardForm.FinishedHeadingLabel.Caption := Heading;
    WizardForm.FinishedLabel.Caption := Text;
    WizardForm.AdjustLabelHeight(WizardForm.FinishedLabel);
    WizardForm.RunList.Top := WizardForm.FinishedLabel.Top + WizardForm.FinishedLabel.Height + ScaleY(12);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Keys: TArrayOfString;
  Demo: String;
begin
  if CurStep <> ssPostInstall then
    Exit;

  // Kept for every later version: an update must never load demo data into real records.
  if Mode = ModeInstall then
  begin
    if OptionsPage.Values[0] then
      Demo := 'true'
    else
      Demo := 'false';
    WriteEnvValue(ExpandConstant('{app}\aria-local.override.env'), 'DEMO_DATA_ENABLED', Demo);
  end
  else
    Demo := GetAriaSetting(ExpandConstant('{app}'), 'DEMO_DATA_ENABLED', 'true');

  SetArrayLength(Keys, 0);
  AddStep(Keys, 'check');
  if IsUpdate then
    AddStep(Keys, 'backup');
  AddStep(Keys, 'download');
  AddStep(Keys, 'database');
  if not IsUpdate and (CompareText(Demo, 'false') <> 0) then
    AddStep(Keys, 'demo');
  AddStep(Keys, 'start');
  AddStep(Keys, 'verify');

  WizardForm.StatusLabel.Visible := False;
  WizardForm.FilenameLabel.Visible := False;
  WizardForm.ProgressGauge.Visible := False;
  CreateStepPanel(WizardForm.InstallingPage, WizardForm.StatusLabel.Left, WizardForm.StatusLabel.Top,
    WizardForm.StatusLabel.Width, Keys);
  WizardForm.CancelButton.Enabled := False;
  ScriptOk := RunAria(ExpandConstant('{app}\versions\{#AppVersion}\deployment\local\aria-local.ps1'), 'install -NoBrowser');
  FinishSteps(ScriptOk);
end;

function ScriptSucceeded: Boolean;
begin
  Result := ScriptOk;
end;

// ---------------------------------------------------------------------------
// Uninstaller (Windows Settings > Apps, or run by the Manage page)
// ---------------------------------------------------------------------------
function DockerAlreadyRemoved: Boolean;
begin
  Result := FileExists(ExpandConstant('{app}\') + DockerRemovedMarker);
end;

function InitializeUninstall: Boolean;
begin
  Result := True;
  if DockerAlreadyRemoved then
    Exit;
  case MsgBox('Keep the Aria ERP database backups?' + #13#10#13#10 +
    'Yes: keep them in ' + ExpandConstant('{app}\backups') + #13#10 +
    'No: delete them together with Aria and its data', mbConfirmation, MB_YESNOCANCEL) of
    IDYES: KeepBackups := True;
    IDNO: KeepBackups := False;
  else
    Result := False;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Script, Arguments: String;
begin
  if (CurUninstallStep <> usUninstall) or DockerAlreadyRemoved then
    Exit;
  Script := InstalledScript(ExpandConstant('{app}'));
  if Script = '' then
    Exit;
  UninstallProgressForm.StatusLabel.Caption := 'Removing Aria ERP and its data...';
  Arguments := 'uninstall -Force';
  if KeepBackups then
    Arguments := Arguments + ' -KeepBackups';
  if not RunAria(Script, Arguments) then
    MsgBox('Aria ERP could not be removed from Docker completely:' + #13#10 + LastError + #13#10#13#10 +
      'Make sure Docker Desktop is running, then remove what is left in Docker Desktop.', mbError, MB_OK);
end;
