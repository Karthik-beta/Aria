<#
.SYNOPSIS
    Run Aria ERP locally in Docker Desktop (Windows) with preloaded settings and demo data.

.DESCRIPTION
    Builds production images of the frontend and backend, starts PostgreSQL,
    Redis, a scheduled backup service and a Caddy reverse proxy, applies
    migrations, loads the demo dataset into a fresh database and opens the app
    in your browser. Containers restart on their own whenever Docker Desktop runs.

    Settings come from deployment\local\aria-local.env. Put personal overrides
    in deployment\local\aria-local.override.env (git-ignored), same KEY=VALUE format.

.PARAMETER Command
    start        Build (if needed) and start everything, load demo data once (default)
    stop         Stop and remove containers, keep data
    restart      stop + start without rebuilding
    status       Show container state, app health and recent backups
    logs         Follow logs (all services, or -Service <name>)
    update       Pull the latest code, back up, rebuild, migrate and restart (rolls back on failure)
    backup       Back up the database now (deployment\local\backups)
    restore      Replace the database with a backup (-File <name>)
    reload-demo  Wipe and reload the demo dataset in the existing database
    reset        Delete ALL local data (database, redis) and start fresh
    open         Open the app in the browser
    uninstall    Remove everything Aria created: containers, volumes, images, build cache, backups
    help         Show this help

.EXAMPLE
    .\aria-local.cmd
    .\aria-local.cmd start -Port 8080
    .\aria-local.cmd update
    .\aria-local.cmd restore -File aria-nightly-20261020-020000.dump
    .\aria-local.cmd logs -Service backend
    .\aria-local.cmd uninstall -KeepBackups
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'logs', 'update', 'backup', 'restore', 'reload-demo', 'reset', 'open', 'uninstall', 'help')]
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

    # Skip confirmation prompts (restore, reset, uninstall); update: rebuild even when up to date
    [switch]$Force,

    # Service name for the logs command (backend, frontend, backup, demo-data, migrate, postgres, redis, caddy)
    [string]$Service = '',

    # Backup file name in deployment\local\backups for the restore command
    [string]$File = '',

    # Branch the update command follows
    [string]$Branch = 'master',

    # uninstall: keep deployment\local\backups
    [switch]$KeepBackups,

    # Internal: set when update runs this script as a child process that already holds the lock
    [switch]$SkipLock,

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
$BackupDir = Join-Path $PSScriptRoot 'backups'
$LockFile = Join-Path $PSScriptRoot '.aria-local.lock'
$DockerDesktopExe = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
$BuilderName = 'aria-local'
$BuiltImages = @('aria-local-backend', 'aria-local-frontend')

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

# Runs `docker ...` and returns stdout lines, or @() on failure (stderr discarded).
function Get-DockerOutput {
    $ErrorActionPreference = 'Continue'
    $output = & docker @args 2>$null
    if ($LASTEXITCODE -ne 0) { return @() }
    return @($output | Where-Object { $_ -ne '' })
}

function Test-DockerCommand {
    $ErrorActionPreference = 'Continue'
    & docker @args *> $null
    return ($LASTEXITCODE -eq 0)
}

function Assert-Compose([int]$ExitCode, [string]$What) {
    if ($ExitCode -ne 0) {
        Write-Host ''
        Write-Warn 'Container status:'
        Invoke-Compose ps -a | Out-Null
        Stop-WithError "$What failed (exit code $ExitCode). See the output above; for running services: .\aria-local.cmd logs -Service <name>"
    }
}

function Test-DockerEngine {
    $ErrorActionPreference = 'Continue'
    & docker info --format '{{.OSType}}' 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Get-ProjectName { return (Get-Setting 'COMPOSE_PROJECT_NAME' 'aria-local') }

# ---------------------------------------------------------------------------
# Lock: one aria-local run at a time
# ---------------------------------------------------------------------------
function Enter-Lock {
    if ($SkipLock) { return }
    if (Test-Path $LockFile) {
        $owner = 0
        [void][int]::TryParse(((Get-Content -Path $LockFile -ErrorAction SilentlyContinue) | Select-Object -First 1), [ref]$owner)
        $process = $null
        if ($owner -gt 0) { $process = Get-Process -Id $owner -ErrorAction SilentlyContinue }
        if ($null -ne $process -and $process.ProcessName -match '^(powershell|pwsh)$') {
            Stop-WithError "Another aria-local command is running (PID $owner). Wait for it to finish, or close that window."
        }
        Remove-Item -Path $LockFile -Force
    }
    Set-Content -Path $LockFile -Value $PID -Encoding ascii
    $script:OwnsLock = $true
}

function Exit-Lock {
    if ($script:OwnsLock -and (Test-Path $LockFile)) { Remove-Item -Path $LockFile -Force -ErrorAction SilentlyContinue }
    $script:OwnsLock = $false
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

function Test-DiskSpace {
    # Docker Desktop keeps its disk image on the system drive by default.
    $drive = Get-PSDrive -Name ($env:SystemDrive.TrimEnd(':')) -ErrorAction SilentlyContinue
    if ($null -ne $drive -and $null -ne $drive.Free) {
        $freeGb = [math]::Round($drive.Free / 1GB, 1)
        if ($freeGb -lt 15) {
            Write-Warn "Only $freeGb GB free on $env:SystemDrive. The build and demo data need about 15 GB."
        }
    }
}

# Builds use a dedicated BuildKit builder so uninstall can remove exactly
# Aria's build cache without pruning cache that belongs to other projects.
function Initialize-Builder {
    if (Test-DockerCommand buildx inspect $BuilderName) {
        $env:BUILDX_BUILDER = $BuilderName
        return
    }
    Write-Info "Creating build cache '$BuilderName'"
    if (Test-DockerCommand buildx create --name $BuilderName --driver docker-container --bootstrap) {
        $env:BUILDX_BUILDER = $BuilderName
        return
    }
    Write-Warn "Could not create the '$BuilderName' builder; using Docker's default builder. Uninstall cannot remove that cache without 'docker builder prune'."
    Remove-Item Env:\BUILDX_BUILDER -ErrorAction SilentlyContinue
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

function Set-AppUrl([int]$PortNumber) {
    if ($PortNumber -eq 80) { $script:AppUrl = 'http://localhost' } else { $script:AppUrl = "http://localhost:$PortNumber" }
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
    Set-AppUrl $selected
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

function Get-ServiceHealth([string]$Name) {
    $health = Get-ComposeOutput ps $Name --format '{{.Health}}' | Select-Object -First 1
    if ($null -eq $health) { return '' }
    return "$health".Trim()
}

# The backend registers its depreciation cron and reconciliation interval at
# startup and runs one discovery pass before it reports ready.
function Test-Schedulers {
    Write-Step 'Checking scheduled jobs'
    $logs = Get-ComposeOutput logs --no-color backend
    if ($logs | Select-String -SimpleMatch 'asset_depreciation_discovery_completed' -Quiet) {
        Write-Ok "Depreciation scheduler running (daily at 00:00 $(Get-Setting 'APP_TIME_ZONE' 'Asia/Kolkata'), plus reconciliation)"
    }
    elseif ($logs | Select-String -SimpleMatch 'asset_depreciation_discovery_failed' -Quiet) {
        Write-Warn 'Depreciation scheduler started but its first run failed. Check: .\aria-local.cmd logs -Service backend'
    }
    else {
        Write-Warn 'Could not confirm the depreciation scheduler yet. Check: .\aria-local.cmd logs -Service backend'
    }

    $deadline = (Get-Date).AddMinutes(1)
    while ((Get-ServiceHealth 'backup') -eq 'starting' -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 3 }
    if ((Get-ServiceHealth 'backup') -eq 'healthy') {
        Write-Ok "Backup job scheduled ($(Get-Setting 'BACKUP_SCHEDULE' '0 2 * * *'), $(Get-Setting 'APP_TIME_ZONE' 'Asia/Kolkata'), keeps $(Get-Setting 'BACKUP_RETENTION' '7') nightly backups)"
    }
    else {
        Write-Warn 'Backup service is not healthy. Check: .\aria-local.cmd logs -Service backup'
    }
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
    Write-Host "  Backups    : deployment\local\backups"
    Write-Host ''
    Write-Host '  Aria restarts on its own whenever Docker Desktop runs. To start it at sign-in, enable'
    Write-Host '  Docker Desktop > Settings > General > "Start Docker Desktop when you sign in".'
    Write-Host ''
    Write-Host '  Stop: .\aria-local.cmd stop    Update: .\aria-local.cmd update    Logs: .\aria-local.cmd logs'
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
# Backups
# ---------------------------------------------------------------------------
function Test-DatabaseVolume {
    return (Test-DockerCommand volume inspect "$(Get-ProjectName)_postgres-data")
}

function Get-Backups {
    if (-not (Test-Path $BackupDir)) { return @() }
    return @(Get-ChildItem -Path $BackupDir -Filter 'aria-*.dump' -File | Sort-Object LastWriteTime -Descending)
}

# Takes a backup through the backup service and returns the file name.
function New-Backup([string]$Label) {
    Assert-Compose (Invoke-Compose up -d --wait postgres backup) 'Starting the backup service'
    Assert-Compose (Invoke-Compose exec -T backup sh /usr/local/bin/aria-backup $Label) 'Backup'
    $latest = Get-Backups | Where-Object { $_.Name -like "aria-$Label-*" } | Select-Object -First 1
    if ($null -eq $latest) { Stop-WithError "Backup finished but no file was found in $BackupDir" }
    return $latest.Name
}

# Resolves -File to a file name inside deployment\local\backups, copying it
# there when it was given as a path elsewhere.
function Resolve-BackupFile([string]$Value) {
    if ($Value -eq '') {
        $available = @(Get-Backups | Select-Object -First 10)
        if ($available.Count -gt 0) {
            Write-Info 'Available backups (newest first):'
            foreach ($item in $available) { Write-Info "  $($item.Name)" }
        }
        Stop-WithError 'Pass the backup to restore, e.g. -File aria-nightly-20261020-020000.dump'
    }
    $inBackups = Join-Path $BackupDir (Split-Path $Value -Leaf)
    if (Test-Path $inBackups -PathType Leaf) { return (Split-Path $Value -Leaf) }
    if (Test-Path $Value -PathType Leaf) {
        New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
        Copy-Item -Path $Value -Destination $inBackups
        return (Split-Path $Value -Leaf)
    }
    Stop-WithError "Backup not found: $Value"
}

function Restore-Database([string]$Name) {
    Write-Step 'Stopping app services'
    Assert-Compose (Invoke-Compose stop caddy frontend backend) 'Stopping services'
    Assert-Compose (Invoke-Compose up -d --wait postgres redis backup) 'Starting PostgreSQL, Redis and the backup service'
    Write-Step "Restoring $Name"
    Assert-Compose (Invoke-Compose exec -T backup sh /usr/local/bin/aria-restore $Name) 'Restore'
    Write-Ok "Database restored from $Name"
}

# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------
function Test-Image([string]$Reference) { return (Test-DockerCommand image inspect $Reference) }

function Save-RollbackImages {
    foreach ($image in $BuiltImages) {
        if (Test-Image "${image}:latest") { [void](Test-DockerCommand image tag "${image}:latest" "${image}:rollback") }
    }
}

function Restore-RollbackImages {
    foreach ($image in $BuiltImages) {
        if (Test-Image "${image}:rollback") { [void](Test-DockerCommand image tag "${image}:rollback" "${image}:latest") }
    }
}

function Remove-RollbackImages {
    foreach ($image in $BuiltImages) {
        if (Test-Image "${image}:rollback") { [void](Test-DockerCommand image rm "${image}:rollback") }
    }
}

# Removes an image reference unless a container (from any project) uses it.
function Remove-ImageIfUnused([string]$Reference) {
    if (-not (Test-Image $Reference)) { return }
    $id = Get-DockerOutput image inspect --format '{{.Id}}' $Reference | Select-Object -First 1
    $users = @(Get-DockerOutput ps -a -q --filter "ancestor=$id")
    if ($users.Count -gt 0) {
        Write-Warn "Keeping image $Reference (used by another container)"
        return
    }
    if (Test-DockerCommand image rm $Reference) { Write-Info "Removed image $Reference" }
    else { Write-Warn "Could not remove image $Reference" }
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
function Invoke-Start {
    Assert-Docker
    Test-DiskSpace
    Resolve-Port
    Set-RunOverrides

    if (-not $NoBuild) {
        Write-Step 'Building images (the first build takes 10-20 minutes)'
        Initialize-Builder
        Assert-Compose (Invoke-Compose build) 'Image build'
    }

    Write-Step 'Starting PostgreSQL and Redis'
    Assert-Compose (Invoke-Compose up -d --wait postgres redis) 'Starting PostgreSQL and Redis'

    Write-Step 'Applying database migrations'
    Assert-Compose (Invoke-Compose run --rm --no-deps migrate) 'Database migration'

    Write-Step "Loading demo data (first run only, scale=$(if ($Scale -ne '') { $Scale } else { Get-Setting 'DEMO_DATA_SCALE' 'medium' }), can take several minutes)"
    Assert-Compose (Invoke-Compose run --rm --no-deps demo-data) 'Demo data load'

    Write-Step 'Starting backend, frontend, backups and proxy'
    Assert-Compose (Invoke-Compose up -d --remove-orphans) 'Starting services'

    Wait-ForApp
    Test-Schedulers
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
    $backups = @(Get-Backups | Select-Object -First 5)
    if ($backups.Count -gt 0) {
        Write-Info 'Latest backups (deployment\local\backups):'
        foreach ($item in $backups) { Write-Info ("  {0}  {1:N1} MB" -f $item.Name, ($item.Length / 1MB)) }
    }
    $running = Get-RunningProxyPort
    if ($running -eq 0) {
        Write-Warn 'Aria proxy is not running. Start it with: .\aria-local.cmd'
        return
    }
    Set-AppUrl $running
    if (Test-Url "$script:AppUrl/health/ready") { Write-Ok "Backend healthy ($script:AppUrl/health/ready)" } else { Write-Warn 'Backend is not healthy yet' }
    if (Test-Url "$script:AppUrl/ready/") { Write-Ok "Frontend healthy ($script:AppUrl)" } else { Write-Warn 'Frontend is not healthy yet' }
    if ((Get-ServiceHealth 'backup') -eq 'healthy') { Write-Ok "Backup job scheduled ($(Get-Setting 'BACKUP_SCHEDULE' '0 2 * * *'))" } else { Write-Warn 'Backup service is not healthy' }
}

function Invoke-Logs {
    if ($Service -ne '') {
        Invoke-Compose logs -f --tail 200 $Service | Out-Null
    }
    else {
        Invoke-Compose logs -f --tail 100 | Out-Null
    }
}

function Invoke-Backup {
    Assert-Docker
    if (-not (Test-DatabaseVolume)) { Stop-WithError 'There is no Aria database to back up yet. Start it with: .\aria-local.cmd' }
    Write-Step 'Backing up the database'
    $name = New-Backup 'manual'
    Write-Ok "Backup saved: deployment\local\backups\$name"
}

function Invoke-Restore {
    $name = Resolve-BackupFile $File
    Confirm-Action "This replaces the current Aria database with $name."
    Assert-Docker
    Resolve-Port
    # Never load demo data on top of a restored database.
    $env:DEMO_DATA_ENABLED = 'false'
    if (Test-DatabaseVolume) {
        Write-Step 'Saving the current database first'
        $safety = New-Backup 'pre-restore'
        Write-Info "Current database saved as $safety"
    }
    Restore-Database $name

    Write-Step 'Starting Aria'
    Assert-Compose (Invoke-Compose run --rm --no-deps migrate) 'Database migration'
    Assert-Compose (Invoke-Compose up -d --remove-orphans) 'Starting services'
    Wait-ForApp
    Test-Schedulers
    Show-Summary
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
    Write-Step 'Starting backend, frontend, backups and proxy'
    Assert-Compose (Invoke-Compose up -d --remove-orphans) 'Starting services'
    Wait-ForApp
    Test-Schedulers
    Show-Summary
}

function Invoke-Reset {
    Confirm-Action 'This deletes the local Aria database and Redis data (backups are kept).'
    Write-Step 'Removing containers and data volumes'
    Assert-Compose (Invoke-Compose down --volumes --remove-orphans) 'Reset'
    Invoke-Start
}

# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------
# Runs git and returns stdout lines; stops on failure unless -AllowFailure.
function Invoke-Git {
    param([string[]]$GitArgs, [switch]$AllowFailure)
    $ErrorActionPreference = 'Continue'
    $output = & git -C $RepoRoot @GitArgs 2>&1
    $code = $LASTEXITCODE
    if ($code -ne 0 -and -not $AllowFailure) {
        $output | ForEach-Object { Write-Info "$_" }
        Stop-WithError "git $($GitArgs -join ' ') failed (exit code $code)."
    }
    $script:GitExitCode = $code
    return @($output | ForEach-Object { "$_" })
}

# Runs this script (as it is on disk now) in a child process; returns its exit code.
function Invoke-Self([string[]]$ScriptArgs) {
    $hostExe = (Get-Process -Id $PID).Path
    $childArgs = @('-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath) + $ScriptArgs + @('-SkipLock', '-NoBrowser')
    if ($Port -gt 0) { $childArgs += @('-Port', "$Port") }
    $ErrorActionPreference = 'Continue'
    & $hostExe @childArgs | Out-Host
    return $LASTEXITCODE
}

function Invoke-Update {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Stop-WithError 'git is not installed. Install Git for Windows: https://git-scm.com/download/win'
    }

    Write-Step 'Checking the local copy'
    $current = (Invoke-Git @('rev-parse', '--abbrev-ref', 'HEAD') | Select-Object -First 1).Trim()
    if ($current -ne $Branch) {
        Stop-WithError "This copy is on branch '$current', but update follows '$Branch'. Run: git switch $Branch (or pass -Branch $current)"
    }
    $changes = @(Invoke-Git @('status', '--porcelain', '--untracked-files=no'))
    if ($changes.Count -gt 0) {
        $changes | ForEach-Object { Write-Info $_ }
        Stop-WithError 'There are uncommitted changes to tracked files. Commit or discard them, then run update again. Settings belong in deployment\local\aria-local.override.env.'
    }

    Assert-Docker

    Write-Step "Fetching origin/$Branch"
    [void](Invoke-Git @('fetch', '--quiet', 'origin', $Branch))
    $old = (Invoke-Git @('rev-parse', 'HEAD') | Select-Object -First 1).Trim()
    $new = (Invoke-Git @('rev-parse', "origin/$Branch") | Select-Object -First 1).Trim()
    $oldShort = $old.Substring(0, 8)
    $newShort = $new.Substring(0, 8)

    if ($old -eq $new -and -not $Force) {
        Write-Ok "Already up to date ($oldShort). Use -Force to rebuild anyway."
        return
    }
    if ($old -ne $new) {
        [void](Invoke-Git @('merge-base', '--is-ancestor', $old, $new) -AllowFailure)
        if ($script:GitExitCode -ne 0) {
            Stop-WithError "Local branch '$Branch' has commits that are not on origin/$Branch. Update only fast-forwards; sort out the branch with git first."
        }
        Write-Info "Updating $oldShort -> $newShort"
        Invoke-Git @('log', '--oneline', '--no-decorate', "$old..$new") | ForEach-Object { Write-Info "  $_" }
    }

    Write-Step 'Saving a restore point'
    $backupName = ''
    if (Test-DatabaseVolume) {
        $backupName = New-Backup "pre-update-$oldShort"
        Write-Info "Database saved as $backupName"
    }
    else {
        Write-Info 'No database yet, nothing to back up.'
    }
    Save-RollbackImages

    if ($old -ne $new) {
        Write-Step "Pulling $newShort"
        [void](Invoke-Git @('merge', '--ff-only', '--quiet', $new))
    }

    # The child runs the updated script, compose file and migrations.
    Write-Step 'Rebuilding and restarting with the new version'
    $exitCode = Invoke-Self @('start')
    if ($exitCode -eq 0) {
        Remove-RollbackImages
        $ErrorActionPreference = 'Continue'
        & docker image prune -f --filter "label=com.docker.compose.project=$(Get-ProjectName)" *> $null
        if (Test-DockerCommand buildx inspect $BuilderName) {
            & docker buildx prune --builder $BuilderName --force --max-used-space 5gb *> $null
        }
        $ErrorActionPreference = 'Stop'
        Write-Ok "Updated to $newShort"
        if ($backupName -ne '') { Write-Info "Pre-update backup: deployment\local\backups\$backupName" }
        $running = Get-RunningProxyPort
        if ($running -gt 0) { Set-AppUrl $running }
        Open-Browser
        return
    }

    Write-Host ''
    Write-Warn "The new version did not start (exit code $exitCode). Rolling back to $oldShort."
    if ($old -ne $new) { [void](Invoke-Git @('reset', '--hard', '--quiet', $old)) }
    Restore-RollbackImages
    if ($backupName -ne '') {
        $rollbackCode = Invoke-Self @('restore', '-File', $backupName, '-Force')
    }
    else {
        $rollbackCode = Invoke-Self @('start', '-NoBuild')
    }
    if ($rollbackCode -ne 0) {
        Stop-WithError "Update failed and the rollback did not finish. Code is back at $oldShort; restore the data with: .\aria-local.cmd restore -File $backupName"
    }
    Remove-RollbackImages
    Stop-WithError "Update to $newShort failed; Aria was rolled back to $oldShort and is running. See the output above for the cause."
}

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------
function Invoke-Uninstall {
    $what = 'This removes Aria containers, data volumes, images, build cache and local settings'
    if ($KeepBackups) { $what += ' (backups are kept).' } else { $what += ', including all backups.' }
    Confirm-Action $what
    Assert-Docker
    $project = Get-ProjectName
    $label = "label=com.docker.compose.project=$project"

    # Read the image list before the compose project is gone.
    $pulledImages = @(Get-ComposeOutput config --images | Where-Object { $_ -ne '' -and $BuiltImages -notcontains ($_ -replace ':.*$', '') })

    Write-Step 'Removing containers, network and data volumes'
    Assert-Compose (Invoke-Compose down --volumes --remove-orphans) 'Uninstall'

    Write-Step 'Removing images'
    # `down --rmi local` skips images with an `image:` tag, so remove the
    # locally built ones by name.
    foreach ($image in $BuiltImages) {
        foreach ($tag in @('latest', 'rollback')) { Remove-ImageIfUnused "${image}:$tag" }
    }
    foreach ($image in (Get-DockerOutput image ls -q --filter $label | Sort-Object -Unique)) { Remove-ImageIfUnused $image }
    foreach ($image in $pulledImages) { Remove-ImageIfUnused $image }

    Write-Step 'Removing build cache'
    if (Test-DockerCommand buildx inspect $BuilderName) {
        $builderImage = Get-DockerOutput ps -a --filter "name=buildx_buildkit_${BuilderName}" --format '{{.Image}}' | Select-Object -First 1
        if (Test-DockerCommand buildx rm --force $BuilderName) { Write-Info "Removed builder '$BuilderName' and its cache" }
        else { Write-Warn "Could not remove builder '$BuilderName'" }
        if ($builderImage) { Remove-ImageIfUnused $builderImage }
    }
    else {
        Write-Info 'No Aria build cache found.'
    }

    Write-Step 'Removing local files'
    $localFiles = @($OverrideEnvFile)
    if (-not $KeepBackups) { $localFiles += $BackupDir }
    foreach ($path in $localFiles) {
        if (Test-Path $path) {
            Remove-Item -Path $path -Recurse -Force
            Write-Info "Removed $path"
        }
    }

    Write-Step 'Checking for leftovers'
    $leftovers = @()
    $leftovers += @(Get-DockerOutput ps -a --filter $label --format 'container {{.Names}}')
    $leftovers += @(Get-DockerOutput volume ls --filter $label --format 'volume {{.Name}}')
    $leftovers += @(Get-DockerOutput network ls --filter $label --format 'network {{.Name}}')
    foreach ($image in $BuiltImages) {
        $leftovers += @(Get-DockerOutput image ls $image --format 'image {{.Repository}}:{{.Tag}}')
    }
    if (Test-DockerCommand buildx inspect $BuilderName) { $leftovers += "builder $BuilderName" }

    if ($leftovers.Count -gt 0) {
        Write-Warn 'Some Aria resources are still present:'
        foreach ($item in $leftovers) { Write-Info "  $item" }
        exit 1
    }
    Write-Ok 'Aria was removed from Docker cleanly'
    if ($KeepBackups -and (Test-Path $BackupDir)) { Write-Info "Backups kept in $BackupDir" }
    Write-Info "You can now delete the folder $RepoRoot"
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
$script:OwnsLock = $false
$script:GitExitCode = 0

$readOnlyCommands = @('status', 'logs', 'open', 'help')

Push-Location $RepoRoot
try {
    if ($readOnlyCommands -notcontains $Command) { Enter-Lock }
    switch ($Command) {
        'start' { Invoke-Start }
        'stop' { Invoke-Stop }
        'restart' { Invoke-Stop; $NoBuild = $true; Invoke-Start }
        'status' { Invoke-Status }
        'logs' { Invoke-Logs }
        'update' { Invoke-Update }
        'backup' { Invoke-Backup }
        'restore' { Invoke-Restore }
        'reload-demo' { Invoke-ReloadDemo }
        'reset' { Invoke-Reset }
        'open' {
            $running = Get-RunningProxyPort
            if ($running -eq 0) { Stop-WithError 'Aria is not running. Start it with: .\aria-local.cmd' }
            Set-AppUrl $running
            $NoBrowser = $false
            Open-Browser
        }
        'uninstall' { Invoke-Uninstall }
        'help' { Get-Help $PSCommandPath -Detailed | Out-String -Width 120 | Write-Host }
    }
}
finally {
    Exit-Lock
    Pop-Location
}
