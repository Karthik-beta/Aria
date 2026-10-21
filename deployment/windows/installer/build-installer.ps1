<#
.SYNOPSIS
    Builds AriaSetup-<version>.exe, the Windows installer for the local demo.

.DESCRIPTION
    Stages the files an installed release runs from (the compose file and
    deployment\local, without the application sources), stamps them with the
    release version and the commit whose prebuilt images it runs, and compiles
    aria-setup.iss with Inno Setup 6.

    The images for -Revision (ghcr.io/karthik-beta/aria-*:sha-<revision>) must
    be published by the Release Images workflow before the installer is used.

.EXAMPLE
    .\deployment\windows\installer\build-installer.ps1 -Version 0.2.0 -Revision (git rev-parse HEAD)
#>
[CmdletBinding()]
param(
    # Release version, e.g. 0.2.0 or 0.2.0-rc.1 (no leading v)
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$')]
    [string]$Version,

    # Full commit SHA the release images were built from
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$Revision,

    # Where AriaSetup-<version>.exe is written
    [string]$OutDir = 'dist'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$stage = Join-Path $repoRoot 'dist\installer-payload'
if (-not [System.IO.Path]::IsPathRooted($OutDir)) { $OutDir = Join-Path $repoRoot $OutDir }

# Everything docker-compose.local.yml and aria-local.ps1 read at run time.
$payload = @(
    'aria-local.cmd',
    'docker-compose.local.yml',
    'deployment\local\aria-local.ps1',
    'deployment\local\aria-local.env',
    'deployment\local\Caddyfile.local',
    'deployment\local\backup.sh',
    'deployment\local\restore.sh',
    'deployment\local\load-demo-data.ts',
    'deployment\local\README.md'
)

if (Test-Path $stage) { Remove-Item -Path $stage -Recurse -Force }
foreach ($file in $payload) {
    $target = Join-Path $stage $file
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Copy-Item -Path (Join-Path $repoRoot $file) -Destination $target
}
# Marks the copy as an installed release (see $ReleaseFile in aria-local.ps1).
Set-Content -Path (Join-Path $stage 'deployment\local\release.env') -Encoding ascii -Value @(
    '# Written by deployment\windows\installer\build-installer.ps1',
    "ARIA_RELEASE_VERSION=$Version",
    "ARIA_RELEASE_REVISION=$Revision"
)
Copy-Item -Path (Join-Path $repoRoot 'apps\frontend\src\app\favicon.ico') -Destination (Join-Path $stage 'aria.ico')

$iscc = @(
    (Get-Command 'ISCC.exe' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1),
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $iscc) { throw 'Inno Setup 6 is not installed (https://jrsoftware.org/isdl.php, or: choco install innosetup).' }

# Windows file versions are numeric only, so 0.2.0-rc.1 becomes 0.2.0.0.
$numericVersion = "$(($Version -split '[-+]')[0]).0"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
& $iscc "/DAppVersion=$Version" "/DNumericVersion=$numericVersion" "/DPayloadDir=$stage" "/O$OutDir" (Join-Path $PSScriptRoot 'aria-setup.iss')
if ($LASTEXITCODE -ne 0) { throw "ISCC failed (exit code $LASTEXITCODE)" }
Write-Host "Built $(Join-Path $OutDir "AriaSetup-$Version.exe")"
