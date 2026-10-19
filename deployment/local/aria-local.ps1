<#
.SYNOPSIS
    Run Aria ERP locally in Docker Desktop (Windows) with preloaded settings and demo data.

.DESCRIPTION
    Builds production images of the frontend and backend, starts PostgreSQL,
    Redis and a Caddy reverse proxy, applies migrations, loads the demo dataset
    into a fresh database and opens the app in your browser.

    Settings come from deployment\local\aria-local.env. Put personal overrides
    in deployment\local\aria-local.override.env (git-ignored), same KEY=VALUE format.

.PARAMETER Command
    start        Build (if needed) and start everything, load demo data once (default)
    stop         Stop and remove containers, keep data
    restart      stop + start without rebuilding
    status       Show container state and app health
    logs         Follow logs (all services, or -Service <name>)
    reload-demo  Wipe and reload the demo dataset in the existing database
    reset        Delete ALL local data (database, redis) and start fresh
    open         Open the app in the browser
    uninstall    Remove containers, volumes and the locally built images
    help         Show this help

.EXAMPLE
    .\aria-local.cmd
    .\aria-local.cmd start -Port 8080
    .\aria-local.cmd logs -Service backend
    .\aria-local.cmd reset -Force
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'logs', 'reload-demo', 'reset', 'open', 'uninstall', 'help')]
    [string]$Command = 'start',

    # Host port for http://localhost:<Port>. Default: ARIA_HTTP_PORT from the env file (80).
    [int]$Port = 0,

    # Demo data scale for this run: small | medium | large
    [ValidateSet('', 'small', 'medium', 'large')]
    [string]$Scale = '',

    # Start without demo data (only applies to a fresh database)
    [switch]$NoDemoData,

    # Reuse existing images instead of rebuilding
    [switch]$NoBuild,

    # Do not open the browser when ready
    [switch]$NoBrowser,

    # Skip confirmation prompts (reset, uninstall)
    [switch]$Force,

    # Service name for the logs command (backend, frontend, demo-data, migrate, postgres, redis, caddy)
    [string]$Service = '',

    # Minutes to wait for the app to become healthy
    [int]$TimeoutMinutes = 15
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ComposeFile = Join-Path $RepoRoot 'docker-compose.local.yml'
$EnvFile = Join-Path $PSScriptRoot 'aria-local.env'
$OverrideEnvFile = Join-Path $PSScriptRoot 'aria-local.override.env'
$DockerDesktopExe = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Info([string]$Message) { Write-Host "    $Message" -ForegroundColor Gray }
function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }

function Stop-WithError([string]$Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
# Env file + docker helpers
# ---------------------------------------------------------------------------
function Read-EnvFile([string]$Path) {
    $values = @{}
    if (-not (Test-Path $Path)) { return $values }
    foreach ($line in Get-Content -Path $Path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
        $index = $trimmed.IndexOf('=')
        if ($index -lt 1) { continue }
        $key = $trimmed.Substring(0, $index).Trim()
        $value = $trimmed.Substring($index + 1).Trim().Trim('"').Trim("'")
        $values[$key] = $value
    }
    return $values
}

function Get-Setting([string]$Key, [string]$Default) {
    if ($script:Settings.ContainsKey($Key) -and $script:Settings[$Key] -ne '') {
        return $script:Settings[$Key]
    }
    return $Default
}

function Get-ComposeArgs {
    $composeArgs = @('compose', '--project-directory', $RepoRoot, '-f', $ComposeFile, '--env-file', $EnvFile)
    if (Test-Path $OverrideEnvFile) { $composeArgs += @('--env-file', $OverrideEnvFile) }
    return $composeArgs
}

# Runs `docker compose ...` with output streamed to the console; returns the exit code.
# Uses $args (no param block) so flags like -a / -d reach docker untouched.
function Invoke-Compose {
    $ErrorActionPreference = 'Continue'
    $allArgs = (Get-ComposeArgs) + $args
    # Out-Host keeps docker's stdout out of this function's return value.
    & docker @allArgs | Out-Host
    return $LASTEXITCODE
}

# Runs `docker compose ...` and returns stdout lines (stderr discarded).
function Get-ComposeOutput {
    $ErrorActionPreference = 'Continue'
    $allArgs = (Get-ComposeArgs) + $args
    $output = & docker @allArgs 2>$null
    if ($LASTEXITCODE -ne 0) { return @() }
    return @($output)
}

function Assert-Compose([int]$ExitCode, [string]$What) {
    if ($ExitCode -ne 0) {
        Write-Host ''
        Write-Warn 'Container status:'
        Invoke-Compose ps -a | Out-Null
        Stop-WithError "$What failed (exit code $ExitCode). See the output above, or run: .\aria-local.cmd logs"
    }
}

function Test-DockerEngine {
    $ErrorActionPreference = 'Continue'
    & docker info --format '{{.OSType}}' 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
function Assert-Docker {
    Write-Step 'Checking Docker Desktop'

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Stop-WithError 'Docker is not installed. Install Docker Desktop: https://www.docker.com/products/docker-desktop/'
    }

    if (-not (Test-DockerEngine)) {
        if (Test-Path $DockerDesktopExe) {
            Write-Info 'Docker engine is not running, starting Docker Desktop...'
            Start-Process -FilePath $DockerDesktopExe | Out-Null
        }
        else {
            Write-Info 'Docker engine is not running. Please start Docker Desktop.'
        }

        $deadline = (Get-Date).AddMinutes(3)
        while (-not (Test-DockerEngine)) {
            if ((Get-Date) -gt $deadline) {
                Stop-WithError 'Docker engine did not become ready within 3 minutes. Start Docker Desktop and try again.'
            }
            Start-Sleep -Seconds 3
        }
    }

    $ErrorActionPreference = 'Continue'
    $osType = (& docker info --format '{{.OSType}}' 2>$null | Out-String).Trim()
    if ($osType -ne 'linux') {
        Stop-WithError "Docker is running Windows containers ($osType). Right-click the Docker tray icon and choose 'Switch to Linux containers...'."
    }

    & docker compose version 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Stop-WithError "'docker compose' is not available. Update Docker Desktop to a recent version."
    }

    $memTotal = (& docker info --format '{{.MemTotal}}' 2>$null | Out-String).Trim()
    $ErrorActionPreference = 'Stop'
    $memBytes = 0L
    if ([long]::TryParse($memTotal, [ref]$memBytes) -and $memBytes -gt 0) {
        $memGb = [math]::Round($memBytes / 1GB, 1)
        if ($memGb -lt 4) {
            Write-Warn "Docker has only $memGb GB memory. The frontend build needs about 4 GB (Docker Desktop > Settings > Resources, or .wslconfig)."
        }
        else {
            Write-Info "Docker memory: $memGb GB"
        }
    }

    Write-Ok 'Docker Desktop is ready'
}

function Test-PortInUse([int]$PortNumber) {
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $listener = Get-NetTCPConnection -State Listen -LocalPort $PortNumber -ErrorAction SilentlyContinue
        return ($null -ne $listener)
    }
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect('127.0.0.1', $PortNumber)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

function Get-RunningProxyPort {
    $mapping = Get-ComposeOutput port caddy 80 | Select-Object -First 1
    if ($mapping -and ($mapping -match ':(\d+)\s*$')) { return [int]$Matches[1] }
    return 0
}

# Picks the host port, then exports ARIA_HTTP_PORT / ARIA_PUBLIC_URL so they
# override the env file (shell variables win in Compose interpolation).
function Resolve-Port {
    $configured = [int](Get-Setting 'ARIA_HTTP_PORT' '80')
    $running = Get-RunningProxyPort

    if ($Port -gt 0) {
        $selected = $Port
        if ($selected -ne $running -and (Test-PortInUse $selected)) {
            Stop-WithError "Port $selected is already in use. Pick another one, e.g. -Port 8080."
        }
    }
    elseif ($running -gt 0) {
        $selected = $running
    }
    elseif (-not (Test-PortInUse $configured)) {
        $selected = $configured
    }
    else {
        $selected = 0
        foreach ($candidate in @(8080, 8081, 8088, 8888, 9080)) {
            if (-not (Test-PortInUse $candidate)) { $selected = $candidate; break }
        }
        if ($selected -eq 0) { Stop-WithError "Port $configured is in use. Choose a free port with -Port <number>." }
        Write-Warn "Port $configured is in use (IIS, Skype, another web server?). Using port $selected instead."
    }

    $script:HttpPort = $selected
    if ($selected -eq 80) { $script:AppUrl = 'http://localhost' } else { $script:AppUrl = "http://localhost:$selected" }
    $env:ARIA_HTTP_PORT = "$selected"
    $env:ARIA_PUBLIC_URL = $script:AppUrl
}

function Set-RunOverrides {
    if ($Scale -ne '') { $env:DEMO_DATA_SCALE = $Scale }
    if ($NoDemoData) { $env:DEMO_DATA_ENABLED = 'false' }
}

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
function Test-Url([string]$Url) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -MaximumRedirection 0 -ErrorAction Stop
        return ($response.StatusCode -eq 200)
    }
    catch {
        return $false
    }
}

function Wait-ForApp {
    Write-Step "Waiting for Aria at $script:AppUrl"
    $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
    while ($true) {
        if ((Test-Url "$script:AppUrl/health/ready") -and (Test-Url "$script:AppUrl/ready/")) { break }
        if ((Get-Date) -gt $deadline) {
            Invoke-Compose ps -a | Out-Null
            Stop-WithError "Aria did not become healthy within $TimeoutMinutes minutes. Check: .\aria-local.cmd logs -Service backend"
        }
        Write-Host '.' -NoNewline
        Start-Sleep -Seconds 5
    }
    Write-Host ''
    Write-Ok 'Aria is up'
}

function Show-Summary {
    $user = Get-Setting 'DEFAULT_ADMIN_USERNAME' 'admin'
    $password = Get-Setting 'DEFAULT_ADMIN_PASSWORD' ''
    $email = Get-Setting 'DEFAULT_ADMIN_EMAIL' ''
    $pgPort = Get-Setting 'ARIA_POSTGRES_PORT' '5433'
    $pgUser = Get-Setting 'POSTGRES_USER' 'aria'
    $pgDb = Get-Setting 'POSTGRES_DB' 'aria'

    Write-Host ''
    Write-Host '  Aria ERP (local demo)' -ForegroundColor Green
    Write-Host "  URL        : $script:AppUrl"
    Write-Host "  Login      : $user / $password  (email: $email)"
    Write-Host "  PostgreSQL : localhost:$pgPort  db=$pgDb user=$pgUser (password in deployment\local\aria-local.env)"
    Write-Host ''
    Write-Host '  Stop: .\aria-local.cmd stop    Logs: .\aria-local.cmd logs    Fresh start: .\aria-local.cmd reset'
    Write-Host ''
}

function Open-Browser {
    if (-not $NoBrowser) { Start-Process $script:AppUrl | Out-Null }
}

function Confirm-Action([string]$Message) {
    if ($Force) { return }
    $answer = Read-Host "$Message Type 'yes' to continue"
    if ($answer -ne 'yes') { Stop-WithError 'Cancelled.' }
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
function Invoke-Start {
    Assert-Docker
    Resolve-Port
    Set-RunOverrides

    if (-not $NoBuild) {
        Write-Step 'Building images (the first build takes 10-20 minutes)'
        Assert-Compose (Invoke-Compose build) 'Image build'
    }

    Write-Step 'Starting PostgreSQL and Redis'
    Assert-Compose (Invoke-Compose up -d --wait postgres redis) 'Starting PostgreSQL and Redis'

    Write-Step 'Applying database migrations'
    Assert-Compose (Invoke-Compose run --rm --no-deps migrate) 'Database migration'

    Write-Step 'Loading demo data (first run only, can take several minutes)'
    Assert-Compose (Invoke-Compose run --rm --no-deps demo-data) 'Demo data load'

    Write-Step 'Starting backend, frontend and proxy'
    Assert-Compose (Invoke-Compose up -d --remove-orphans) 'Starting services'

    Wait-ForApp
    Show-Summary
    Open-Browser
}

function Invoke-Stop {
    Write-Step 'Stopping Aria (data is kept)'
    Assert-Compose (Invoke-Compose down --remove-orphans) 'Stopping services'
    Write-Ok 'Stopped'
}

function Invoke-Status {
    Invoke-Compose ps -a | Out-Null
    $running = Get-RunningProxyPort
    if ($running -eq 0) {
        Write-Warn 'Aria proxy is not running. Start it with: .\aria-local.cmd'
        return
    }
    if ($running -eq 80) { $script:AppUrl = 'http://localhost' } else { $script:AppUrl = "http://localhost:$running" }
    if (Test-Url "$script:AppUrl/health/ready") { Write-Ok "Backend healthy ($script:AppUrl/health/ready)" } else { Write-Warn 'Backend is not healthy yet' }
    if (Test-Url "$script:AppUrl/ready/") { Write-Ok "Frontend healthy ($script:AppUrl)" } else { Write-Warn 'Frontend is not healthy yet' }
}

function Invoke-Logs {
    if ($Service -ne '') {
        Invoke-Compose logs -f --tail 200 $Service | Out-Null
    }
    else {
        Invoke-Compose logs -f --tail 100 | Out-Null
    }
}

function Invoke-ReloadDemo {
    Assert-Docker
    Resolve-Port
    Set-RunOverrides
    $env:DEMO_DATA_FORCE = 'true'
    $env:DEMO_DATA_ENABLED = 'true'

    Write-Step 'Stopping app services so the scheduler does not race the loader'
    Assert-Compose (Invoke-Compose stop caddy frontend backend) 'Stopping services'

    Assert-Compose (Invoke-Compose up -d --wait postgres redis) 'Starting PostgreSQL and Redis'
    Assert-Compose (Invoke-Compose run --rm --no-deps migrate) 'Database migration'

    Write-Step 'Reloading demo data'
    Assert-Compose (Invoke-Compose run --rm --no-deps demo-data) 'Demo data load'

    $env:DEMO_DATA_FORCE = 'false'
    Write-Step 'Starting backend, frontend and proxy'
    Assert-Compose (Invoke-Compose up -d --remove-orphans) 'Starting services'
    Wait-ForApp
    Show-Summary
}

function Invoke-Reset {
    Confirm-Action 'This deletes the local Aria database and Redis data.'
    Write-Step 'Removing containers and data volumes'
    Assert-Compose (Invoke-Compose down --volumes --remove-orphans) 'Reset'
    Invoke-Start
}

function Invoke-Uninstall {
    Confirm-Action 'This removes Aria containers, data volumes and locally built images.'
    Write-Step 'Removing containers, volumes and images'
    Assert-Compose (Invoke-Compose down --volumes --remove-orphans --rmi local) 'Uninstall'
    Write-Ok 'Removed'
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if (-not (Test-Path $ComposeFile)) { Stop-WithError "Missing $ComposeFile" }
if (-not (Test-Path $EnvFile)) { Stop-WithError "Missing $EnvFile" }

$script:Settings = Read-EnvFile $EnvFile
foreach ($entry in (Read-EnvFile $OverrideEnvFile).GetEnumerator()) { $script:Settings[$entry.Key] = $entry.Value }
$script:HttpPort = 80
$script:AppUrl = 'http://localhost'

Push-Location $RepoRoot
try {
    switch ($Command) {
        'start' { Invoke-Start }
        'stop' { Invoke-Stop }
        'restart' { Invoke-Stop; $NoBuild = $true; Invoke-Start }
        'status' { Invoke-Status }
        'logs' { Invoke-Logs }
        'reload-demo' { Invoke-ReloadDemo }
        'reset' { Invoke-Reset }
        'open' {
            $running = Get-RunningProxyPort
            if ($running -eq 0) { Stop-WithError 'Aria is not running. Start it with: .\aria-local.cmd' }
            if ($running -eq 80) { $script:AppUrl = 'http://localhost' } else { $script:AppUrl = "http://localhost:$running" }
            $NoBrowser = $false
            Open-Browser
        }
        'uninstall' { Invoke-Uninstall }
        'help' { Get-Help $PSCommandPath -Detailed | Out-String -Width 120 | Write-Host }
    }
}
finally {
    Pop-Location
}
