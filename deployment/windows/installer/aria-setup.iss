; Aria ERP - Windows installer for the local Docker demo (Inno Setup 6).
;
; Build with build-installer.ps1, which stages the payload and passes:
;   AppVersion      release version, e.g. 0.2.0
;   NumericVersion  file version, e.g. 0.2.0.0
;   PayloadDir      staged files (compose file + deployment\local, release.env, aria.ico)
;
; Install:   copies the payload to {app}\versions\<version> and runs its
;            `aria-local.ps1 install`: a fresh install starts Aria; over an
;            installed version it switches to the new one with a restore
;            point, health and data checks and an automatic rollback.
; Uninstall: runs the installed version's `aria-local.ps1 uninstall`, then
;            removes the files (backups only when the user says so).
; Per-user install (no administrator rights); Docker Desktop must be installed.

#ifndef AppVersion
  #error AppVersion is not defined; build with build-installer.ps1
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
VersionInfoDescription=Aria ERP demo installer
VersionInfoVersion={#NumericVersion}
; SignPath checks ProductName and ProductVersion (.signpath/artifact-configuration.xml).
VersionInfoProductVersion={#NumericVersion}
VersionInfoProductTextVersion={#AppVersion}
DefaultDirName={autopf}\Aria ERP
UsePreviousAppDir=yes
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputBaseFilename=AriaSetup-{#AppVersion}
SetupIconFile={#PayloadDir}\aria.ico
UninstallDisplayIcon={app}\aria.ico
UninstallDisplayName=Aria ERP
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
CloseApplications=no

[Files]
Source: "{#PayloadDir}\*"; Excludes: "\aria.ico"; DestDir: "{app}\versions\{#AppVersion}"; Flags: recursesubdirs ignoreversion
Source: "{#PayloadDir}\aria.ico"; DestDir: "{app}"; Flags: ignoreversion

[INI]
; aria-local.ps1 rewrites the URL when Aria runs on another port.
Filename: "{app}\Aria ERP.url"; Section: "InternetShortcut"; Key: "URL"; String: "http://localhost:8080/"; Flags: createkeyifdoesntexist

[Icons]
Name: "{autoprograms}\Aria ERP"; Filename: "{app}\Aria ERP.url"; IconFilename: "{app}\aria.ico"
Name: "{autodesktop}\Aria ERP"; Filename: "{app}\Aria ERP.url"; IconFilename: "{app}\aria.ico"
Name: "{autoprograms}\Uninstall Aria ERP"; Filename: "{uninstallexe}"

[UninstallDelete]
; Created by aria-local.ps1 at run time. backups\ is removed by its uninstall
; unless the user chose to keep it.
Type: filesandordirs; Name: "{app}\versions"
Type: filesandordirs; Name: "{app}\logs"
Type: files; Name: "{app}\current-version.txt"
Type: files; Name: "{app}\Aria ERP.url"
Type: files; Name: "{app}\.aria-local.lock"
Type: files; Name: "{app}\aria-local.override.env"

[Code]
const
  DockerDownloadUrl = 'https://www.docker.com/products/docker-desktop/';

var
  KeepBackups: Boolean;

// Runs aria-local.ps1 in a visible console, so its progress is on screen; returns its exit code.
function RunAria(const ScriptPath, Arguments: String): Integer;
var
  Code: Integer;
begin
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '" ' + Arguments,
    '', SW_SHOWNORMAL, ewWaitUntilTerminated, Code) then
    Code := -1;
  Result := Code;
end;

function InitializeSetup: Boolean;
var
  ErrorCode: Integer;
begin
  Result := True;
  if not FileExists(ExpandConstant('{commonpf64}\Docker\Docker\Docker Desktop.exe')) then
  begin
    if MsgBox('Aria ERP runs in Docker Desktop, which is not installed on this computer.' + #13#10#13#10 +
      'Install Docker Desktop (this needs administrator rights), start it once, then run this setup again.' + #13#10#13#10 +
      'Open the Docker Desktop download page now?', mbError, MB_YESNO) = IDYES then
      ShellExec('open', DockerDownloadUrl, '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
    Result := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Code: Integer;
begin
  if CurStep <> ssPostInstall then
    Exit;
  WizardForm.StatusLabel.Caption := 'Starting Aria ERP. Follow the progress in the console window; the first install downloads the app and loads demo data.';
  Code := RunAria(ExpandConstant('{app}\versions\{#AppVersion}\deployment\local\aria-local.ps1'), 'install');
  if Code <> 0 then
    MsgBox('Aria ERP {#AppVersion} could not be installed (exit code ' + IntToStr(Code) + ').' + #13#10#13#10 +
      'If an earlier version was installed, it was restored and is still running.' + #13#10 +
      'The log is in ' + ExpandConstant('{app}\logs') + #13#10#13#10 +
      'Fix the cause (for example, start Docker Desktop or check the internet connection) and run this setup again.',
      mbError, MB_OK);
end;

// The script of the installed version: the one in current-version.txt, else any that is there.
function InstalledScript: String;
var
  Version: AnsiString;
  FindRec: TFindRec;
  Candidate: String;
begin
  Result := '';
  if LoadStringFromFile(ExpandConstant('{app}\current-version.txt'), Version) then
  begin
    Candidate := ExpandConstant('{app}\versions\') + Trim(String(Version)) + '\deployment\local\aria-local.ps1';
    if FileExists(Candidate) then
    begin
      Result := Candidate;
      Exit;
    end;
  end;
  if FindFirst(ExpandConstant('{app}\versions\*'), FindRec) then
    try
      repeat
        Candidate := ExpandConstant('{app}\versions\') + FindRec.Name + '\deployment\local\aria-local.ps1';
        if (FindRec.Name <> '.') and (FindRec.Name <> '..') and FileExists(Candidate) then
          Result := Candidate;
      until (Result <> '') or not FindNext(FindRec);
    finally
      FindClose(FindRec);
    end;
end;

function InitializeUninstall: Boolean;
begin
  Result := True;
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
  Code: Integer;
begin
  if CurUninstallStep <> usUninstall then
    Exit;
  Script := InstalledScript;
  if Script = '' then
    Exit;
  Arguments := 'uninstall -Force';
  if KeepBackups then
    Arguments := Arguments + ' -KeepBackups';
  Code := RunAria(Script, Arguments);
  if Code <> 0 then
    MsgBox('Some Aria ERP containers, volumes or images could not be removed from Docker (exit code ' + IntToStr(Code) + ').' + #13#10 +
      'Make sure Docker Desktop is running, then remove what is left in Docker Desktop.', mbError, MB_OK);
end;
