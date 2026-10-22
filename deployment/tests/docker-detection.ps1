# Docker Desktop detection test for aria-local.ps1
# Runs its detection functions against simulated machines: fake registry
# values, install folders and PATHs, all local to this process. Every case
# starts from a stale PATH, as when setup is opened from a program that was
# running before Docker Desktop was installed.
#
#   powershell -File deployment/tests/docker-detection.ps1   (Windows PowerShell 5.1, what setup uses)
#   pwsh -File deployment/tests/docker-detection.ps1

param(
    [string]$Script = (Join-Path $PSScriptRoot '..\local\aria-local.ps1')
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Load the functions under test from aria-local.ps1
# ---------------------------------------------------------------------------
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $Script), [ref]$null, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) { throw "aria-local.ps1 does not parse: $($parseErrors[0].Message)" }

function Get-FunctionText([string]$Name) {
    $fn = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $Name }, $true)
    if ($null -eq $fn) { throw "Function $Name not found in aria-local.ps1" }
    return $fn.Extent.Text
}

foreach ($name in 'Test-DockerDir', 'Find-DockerDesktopDir') { . ([scriptblock]::Create((Get-FunctionText $name))) }

# The saved machine/user PATH comes from the simulated machine, not this one.
$addText = (Get-FunctionText 'Add-DockerToPath').
    Replace("[Environment]::GetEnvironmentVariable('Path', 'Machine')", '$script:SavedMachinePath').
    Replace("[Environment]::GetEnvironmentVariable('Path', 'User')", '$script:SavedUserPath')
if ($addText -notmatch 'SavedMachinePath' -or $addText -notmatch 'SavedUserPath') { throw 'Add-DockerToPath no longer reads the saved PATH this way; update this test' }
. ([scriptblock]::Create($addText))

# Assert-Docker picks the app to start inline; mirror it and fail if it changes.
if ((Get-FunctionText 'Assert-Docker') -notmatch "@\('Docker Desktop.exe', 'Docker for Windows.exe'\)") {
    throw 'Assert-Docker no longer starts Docker Desktop this way; update this test'
}
function Get-StartExe {
    $desktopExe = $null
    $desktopDir = Find-DockerDesktopDir
    if ($null -ne $desktopDir) {
        $desktopExe = @('Docker Desktop.exe', 'Docker for Windows.exe') |
            ForEach-Object { Join-Path $desktopDir $_ } |
            Where-Object { Test-Path -LiteralPath $_ } |
            Select-Object -First 1
    }
    return $desktopExe
}

# Simulated registry in place of the real Get-RegistryString.
$script:FakeReg = @{}
function Get-RegistryString([string]$Path, [string]$Name) {
    $key = "$Path|$Name"
    if ($script:FakeReg.ContainsKey($key)) { return ([string]$script:FakeReg[$key]).Trim() }
    return ''
}

# ---------------------------------------------------------------------------
# Simulated machines
# ---------------------------------------------------------------------------
$Uninstall = 'Microsoft\Windows\CurrentVersion\Uninstall\Docker Desktop'
$HKLM64 = "HKLM:\SOFTWARE\$Uninstall"
$HKLM32 = "HKLM:\SOFTWARE\WOW6432Node\$Uninstall"
$HKCUKey = "HKCU:\SOFTWARE\$Uninstall"
$Service = 'HKLM:\SYSTEM\CurrentControlSet\Services\com.docker.service'

$Root = Join-Path ([IO.Path]::GetTempPath()) ('aria-docker-detection-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$SavedEnv = @{}
foreach ($var in 'Path', 'ProgramW6432', 'ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA') {
    $SavedEnv[$var] = [Environment]::GetEnvironmentVariable($var, 'Process')
}

function New-DockerInstall([string]$Dir, [string]$Exe = 'Docker Desktop.exe', [switch]$NoCli) {
    New-Item -ItemType Directory -Force -Path (Join-Path $Dir 'resources\bin') | Out-Null
    if ($Exe) { New-Item -ItemType File -Force -Path (Join-Path $Dir $Exe) | Out-Null }
    if (-not $NoCli) { New-Item -ItemType File -Force -Path (Join-Path $Dir 'resources\bin\docker.exe') | Out-Null }
    return $Dir
}

$script:Results = @()

# $Setup gets the case folder and returns the install folder detection should
# find ($null: none). $ExpectDocker: whether `docker` resolves afterwards.
function Invoke-Case([string]$Name, [scriptblock]$Setup, [bool]$ExpectDocker, [string]$ExpectExeName = 'Docker Desktop.exe') {
    $case = Join-Path $Root ($script:Results.Count + 1)
    New-Item -ItemType Directory -Force -Path $case | Out-Null
    $env:ProgramW6432 = Join-Path $case 'Program Files'
    $env:ProgramFiles = Join-Path $case 'Program Files'
    ${env:ProgramFiles(x86)} = Join-Path $case 'Program Files (x86)'
    $env:LOCALAPPDATA = Join-Path $case 'AppData\Local'
    # A simulated system folder: the real one can hold a docker.exe (GitHub's
    # Windows runners have one in System32).
    $StalePath = (Join-Path $case 'Windows\System32') + ';' + (Join-Path $case 'Windows')
    $script:FakeReg = @{}
    $script:SavedMachinePath = $StalePath
    $script:SavedUserPath = ''
    $env:Path = $StalePath

    $expectDir = & $Setup $case
    $expectExe = $null
    if ($expectDir -and $ExpectExeName) { $expectExe = Join-Path $expectDir $ExpectExeName }

    # Same order as Assert-Docker: repair PATH, then find the app to start.
    Add-DockerToPath
    $dir = Find-DockerDesktopDir
    $docker = Get-Command docker -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $exe = Get-StartExe

    $problems = @()
    if ($dir -ne $expectDir) { $problems += "found '$dir', expected '$expectDir'" }
    if ([bool]$docker -ne $ExpectDocker) { $problems += "docker resolves: $([bool]$docker), expected $ExpectDocker" }
    if ($exe -ne $expectExe) { $problems += "starts '$exe', expected '$expectExe'" }

    $script:Results += [pscustomobject]@{ Name = $Name; Problems = $problems }
    if ($problems.Count -eq 0) {
        Write-Host "PASS  $Name" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL  $Name" -ForegroundColor Red
        foreach ($problem in $problems) { Write-Host "      $($problem.Replace($case, '<case>'))" -ForegroundColor Red }
    }
}

Write-Host "Docker detection in $Script (PowerShell $($PSVersionTable.PSVersion))"

try {
    Invoke-Case 'Default folder, no registry entry' {
        param($c) New-DockerInstall "$c\Program Files\Docker\Docker"
    } $true

    Invoke-Case 'Custom folder (--installation-dir) in the HKLM uninstall entry' {
        param($c) $d = New-DockerInstall "$c\D\Apps\Docker"; $script:FakeReg["$HKLM64|InstallLocation"] = $d; $d
    } $true

    Invoke-Case 'Custom folder with spaces and brackets, quoted InstallLocation' {
        param($c) $d = New-DockerInstall "$c\E\My Tools (x)\Docker"; $script:FakeReg["$HKLM64|InstallLocation"] = "`"$d`"  "; $d
    } $true

    Invoke-Case 'Custom folder in the 32-bit (WOW6432Node) uninstall entry' {
        param($c) $d = New-DockerInstall "$c\Docker32"; $script:FakeReg["$HKLM32|InstallLocation"] = $d; $d
    } $true

    Invoke-Case 'Per-user install in the HKCU uninstall entry' {
        param($c) $d = New-DockerInstall "$c\Users\me\Docker"; $script:FakeReg["$HKCUKey|InstallLocation"] = $d; $d
    } $true

    Invoke-Case 'Only the service records it (quoted ImagePath with arguments)' {
        param($c) $d = New-DockerInstall "$c\Svc Only\Docker"; $script:FakeReg["$Service|ImagePath"] = "`"$d\com.docker.service`" --flag"; $d
    } $true

    Invoke-Case 'Only the service records it (unquoted ImagePath)' {
        param($c) $d = New-DockerInstall "$c\SvcPlain\Docker"; $script:FakeReg["$Service|ImagePath"] = "$d\com.docker.service"; $d
    } $true

    Invoke-Case 'Per-user default folder (%LOCALAPPDATA%\Programs)' {
        param($c) New-DockerInstall "$c\AppData\Local\Programs\Docker\Docker"
    } $true

    Invoke-Case 'Program Files (x86)' {
        param($c) New-DockerInstall "$c\Program Files (x86)\Docker\Docker"
    } $true

    Invoke-Case 'Older version (Docker for Windows.exe)' {
        param($c) New-DockerInstall "$c\Program Files\Docker\Docker" -Exe 'Docker for Windows.exe'
    } $true 'Docker for Windows.exe'

    Invoke-Case 'Custom folder known only from the saved machine PATH' {
        param($c) $d = New-DockerInstall "$c\Z\Containers\Docker"; $script:SavedMachinePath += ";$d\resources\bin"; $d
    } $true

    Invoke-Case 'Custom folder known only from the saved user PATH' {
        param($c) $d = New-DockerInstall "$c\Y\Docker"; $script:SavedUserPath = "$d\resources\bin"; $d
    } $true

    Invoke-Case 'Stale uninstall entry, real install in the default folder' {
        param($c) $script:FakeReg["$HKLM64|InstallLocation"] = "$c\Gone\Docker"; New-DockerInstall "$c\Program Files\Docker\Docker"
    } $true

    Invoke-Case 'Leftover uninstall entry with an empty folder' {
        param($c) New-Item -ItemType Directory -Force "$c\Leftover\Docker" | Out-Null; $script:FakeReg["$HKLM64|InstallLocation"] = "$c\Leftover\Docker"; $null
    } $false

    Invoke-Case 'Docker Desktop app without its CLI (broken install)' {
        param($c) New-DockerInstall "$c\Program Files\Docker\Docker" -NoCli
    } $false

    Invoke-Case 'Docker CLI on PATH without Docker Desktop' {
        param($c) New-Item -ItemType Directory -Force "$c\cli" | Out-Null; New-Item -ItemType File "$c\cli\docker.exe" | Out-Null; $script:SavedMachinePath += ";$c\cli"; $null
    } $true

    Invoke-Case 'Not installed' {
        param($c) $null
    } $false
}
finally {
    foreach ($var in $SavedEnv.Keys) { [Environment]::SetEnvironmentVariable($var, $SavedEnv[$var], 'Process') }
    Remove-Item -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue
}

$failed = @($script:Results | Where-Object { $_.Problems.Count -gt 0 }).Count
Write-Host ''
Write-Host ('{0} of {1} cases passed' -f ($script:Results.Count - $failed), $script:Results.Count)
if ($failed -gt 0) { exit 1 }
