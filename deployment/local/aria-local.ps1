<#
.SYNOPSIS
    Run Aria ERP locally in Docker Desktop (Windows) with preloaded settings and demo data.

.DESCRIPTION
    Downloads the production images of the frontend and backend that GitHub
    Actions built for the checked-out commit (or builds them from source when
    they are unavailable or -FromSource is given), starts PostgreSQL,
    Redis, a scheduled backup service and a Caddy reverse proxy, applies
    migrations, loads the demo dataset into a fresh database and opens the app
    in your browser. Containers restart on their own whenever Docker Desktop runs.

    Settings come from deployment\local\aria-local.env. Put personal overrides
    in deployment\local\aria-local.override.env (git-ignored), same KEY=VALUE format.

.PARAMETER Command
    start        Fetch or build the images (if needed) and start everything, load demo data once (default)
    stop         Stop and remove containers, keep data
    restart      stop + start without fetching or rebuilding
    status       Show container state, app health and recent backups
    logs         Follow logs (all services, or -Service <name>)
    update       Check for a new version; if there is one, save a restore point, pull the code and images,
                 migrate and restart, then check health and data (depreciation records included).
                 Rolls back to the restore point on any failure; removes it on success.
                 Installed releases update by running the newer AriaSetup.exe instead.
    install      Installed releases only, run by AriaSetup.exe: start this version, or switch to it
                 from the installed one with the same restore point, checks and rollback as update
    backup       Back up the database now (deployment\local\backups)
    restore      Replace the database with a backup (-File <name>)
    reload-demo  Wipe and reload the demo dataset in the existing database
    reset        Delete ALL local data (database, redis) and start fresh
    open         Open the app in the browser
    uninstall    Remove everything Aria created: containers, volumes, images, backups (build cache on request)
    help         Show this help

.EXAMPLE
    .\aria-local.cmd
    .\aria-local.cmd start -Port 8080
    .\aria-local.cmd update
    .\aria-local.cmd update -KeepRestorePoint
    .\aria-local.cmd start -FromSource
    .\aria-local.cmd restore -File aria-nightly-20261020-020000.dump
    .\aria-local.cmd logs -Service backend
    .\aria-local.cmd uninstall -KeepBackups
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'logs', 'update', 'install', 'backup', 'restore', 'reload-demo', 'reset', 'open', 'uninstall', 'help')]
    [string]$Command = 'start',

    # Host port for http://localhost:<Port>. Default: ARIA_HTTP_PORT from the env file (8080).
    [int]$Port = 0,

    # Demo data scale for this run: small | medium | large
    [ValidateSet('', 'small', 'medium', 'large')]
    [string]$Scale = '',

    # Start without demo data (only applies to a fresh database)
    [switch]$NoDemoData,

    # Reuse existing images instead of fetching or rebuilding
    [switch]$NoBuild,

    # Build the images from source instead of downloading the prebuilt ones
    [switch]$FromSource,

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

    # update: keep the restore point (pre-update backup) after a successful update
    [switch]$KeepRestorePoint,

    # uninstall: also clear Docker's build cache (shared with other projects) without asking
    [switch]$PruneBuildCache,

    # Internal: set when update runs this script as a child process that already holds the lock
    [switch]$SkipLock,

    # Minutes to wait for the app to become healthy
    [int]$TimeoutMinutes = 15
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Docker output is piped through Out-Host, so Compose's interactive progress
# display cannot take over the console and `build` fails with "failed to get
# console: The handle is invalid". Plain progress works piped or not.
$env:COMPOSE_PROGRESS = 'plain'
$env:BUILDKIT_PROGRESS = 'plain'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ComposeFile = Join-Path $RepoRoot 'docker-compose.local.yml'
$EnvFile = Join-Path $PSScriptRoot 'aria-local.env'
# Written by the installer build (deployment\windows\installer): this copy is
# release ARIA_RELEASE_VERSION, installed in <install dir>\versions\<version>,
# and runs the images CI built from ARIA_RELEASE_REVISION. No git, no sources.
$ReleaseFile = Join-Path $PSScriptRoot 'release.env'
$IsRelease = Test-Path $ReleaseFile
if ($IsRelease) {
    # Shared by every installed version, so updates and rollbacks keep them.
    $InstallRoot = Split-Path (Split-Path $RepoRoot -Parent) -Parent
    $OverrideEnvFile = Join-Path $InstallRoot 'aria-local.override.env'
    $BackupDir = Join-Path $InstallRoot 'backups'
    $LockFile = Join-Path $InstallRoot '.aria-local.lock'
    # The version the installer last switched to successfully.
    $CurrentVersionFile = Join-Path $InstallRoot 'current-version.txt'
    # The shortcuts open this file, so it follows the port Aria ends up on.
    $UrlFile = Join-Path $InstallRoot 'Aria ERP.url'
    $LogDir = Join-Path $InstallRoot 'logs'
    # The backup service mounts this instead of deployment/local/backups.
    $env:ARIA_BACKUP_DIR = $BackupDir
}
else {
    $OverrideEnvFile = Join-Path $PSScriptRoot 'aria-local.override.env'
    $BackupDir = Join-Path $PSScriptRoot 'backups'
    $LockFile = Join-Path $PSScriptRoot '.aria-local.lock'
}
$DockerDesktopExe = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
$BuiltImages = @('aria-local-backend', 'aria-local-frontend')
# Files that go into the images; a local change to them rules out the prebuilt ones.
$ImageSources = @('apps', 'packages', 'package.json', 'bun.lock', 'turbo.json', 'tsconfig.base.json', '.dockerignore')
# How many commits back to look for published images that match the sources.
$MaxImageLookback = 50
# Tables whose rows the app removes on its own (expired logins, migration
# bookkeeping); the update's data check skips them.
$VolatileTables = @('_prisma_migrations', 'sessions', 'verifications')
# Set by docker/metadata-action on the prebuilt images.
$ImageSourceLabel = 'label=org.opencontainers.image.source=https://github.com/Karthik-beta/Aria'

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
    $configured = [int](Get-Setting 'ARIA_HTTP_PORT' '8080')
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
        foreach ($candidate in @(8081, 8082, 8088, 8888, 9080)) {
            if (-not (Test-PortInUse $candidate)) { $selected = $candidate; break }
        }
        if ($selected -eq 0) { Stop-WithError "Port $configured is in use. Choose a free port with -Port <number>." }
        Write-Warn "Port $configured is in use (another web server or dev tool?). Using port $selected instead."
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
# Data integrity (update)
# ---------------------------------------------------------------------------
# Runs SQL in the database through psql on stdin (so quotes survive Windows
# PowerShell) and returns the '|'-separated output rows.
function Invoke-Sql([string]$Sql) {
    $user = Get-Setting 'POSTGRES_USER' 'aria'
    $database = Get-Setting 'POSTGRES_DB' 'aria'
    $allArgs = (Get-ComposeArgs) + @('exec', '-T', 'postgres', 'psql', '-X', '-q', '-At', '-F', '|', '-U', $user, '-d', $database, '-f', '-')
    $ErrorActionPreference = 'Continue'
    $output = $Sql | & docker @allArgs 2>$null
    return @($output | ForEach-Object { "$_" } | Where-Object { $_ -ne '' })
}

# Fingerprints of the depreciation records that existed at $Time (UTC): the
# fields that never change once a record is written or posted. Each check is
# its own statement, so a table an older schema lacks only skips that check.
function Get-FingerprintSql([string]$Time) {
    $checks = [ordered]@{
        'depreciation schedules'         = @('asset_depreciation_schedules', '"createdAt"', 'id, "assetId", "assetFinanceBookId", "revisionNumber", "startDate", trim_scale("baseAssetValue"), trim_scale("openingAccumulatedDepreciation")')
        'posted depreciation entries'    = @('asset_depreciation_schedule_entries', '"postedAt"', 'id, "scheduleId", sequence, "scheduleDate", trim_scale("depreciationAmount"), trim_scale("accumulatedDepreciationAmount"), trim_scale("bookValueAfterDepreciation"), "postingId"')
        'depreciation journal entries'   = @('asset_depreciation_journal_entries', '"createdAt"', 'id, series, "assetFinanceBookId", "postingDate", trim_scale("depreciationAmount")')
        'depreciation journal lines'     = @('asset_depreciation_journal_entry_lines', '"createdAt"', 'id, "journalEntryId", account, trim_scale("debitAmount"), trim_scale("creditAmount")')
    }
    $statements = foreach ($name in $checks.Keys) {
        $table, $since, $columns = $checks[$name]
        "SELECT 'fingerprint', '$name', count(*) || ':' || md5(coalesce(string_agg(concat_ws('|', $columns), ',' ORDER BY id), '')) FROM $table WHERE $since <= '$Time';"
    }
    return ($statements -join "`n")
}

# Row counts of every table plus the depreciation fingerprints. Pass the
# pre-update snapshot's time to fingerprint the same records again afterwards.
function Get-DataSnapshot([string]$Time = '') {
    if ($Time -eq '') {
        # Prisma stores DateTime columns as UTC timestamps without a zone.
        $Time = Invoke-Sql "SELECT (now() AT TIME ZONE 'UTC')::text;" | Select-Object -First 1
        if ($null -eq $Time) { return $null }
    }
    $countSql = "SELECT 'count', table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('$($VolatileTables -join "', '")') ORDER BY table_name;"
    $snapshot = @{ Time = $Time; Counts = @{}; Fingerprints = @{} }
    foreach ($row in (Invoke-Sql "$countSql`n$(Get-FingerprintSql $Time)")) {
        $kind, $name, $value = $row -split '\|', 3
        if ($kind -eq 'count') { $snapshot.Counts[$name] = [long]$value }
        elseif ($kind -eq 'fingerprint') { $snapshot.Fingerprints[$name] = $value }
    }
    if ($snapshot.Counts.Count -eq 0) { return $null }
    return $snapshot
}

function Get-RowTotal($Snapshot) {
    $total = 0L
    foreach ($count in $Snapshot.Counts.Values) { $total += $count }
    return $total
}

# Compares the database with a snapshot taken before the update. Tables may
# gain rows (new records, the scheduler catching up) but never lose any, and
# the depreciation records that existed before must be unchanged. Returns the problems found.
function Test-DataIntegrity($Before) {
    $after = Get-DataSnapshot $Before.Time
    if ($null -eq $after) { return @('Could not read the database to check the data.') }
    $problems = @()
    foreach ($table in ($Before.Counts.Keys | Sort-Object)) {
        if (-not $after.Counts.ContainsKey($table)) { $problems += "Table $table no longer exists ($($Before.Counts[$table]) rows before)."; continue }
        if ($after.Counts[$table] -lt $Before.Counts[$table]) { $problems += "Table $table lost rows: $($Before.Counts[$table]) before, $($after.Counts[$table]) after." }
    }
    foreach ($name in ($Before.Fingerprints.Keys | Sort-Object)) {
        if (-not $after.Fingerprints.ContainsKey($name)) { $problems += "Could not check the $name any more." }
        elseif ($after.Fingerprints[$name] -ne $Before.Fingerprints[$name]) { $problems += "The $name changed (before $($Before.Fingerprints[$name]), after $($after.Fingerprints[$name]))." }
    }
    return $problems
}

# Health of the version that is running now: the app answers, the depreciation
# scheduler's startup pass did not fail, and the data matches $Before. Returns the problems found.
function Test-Deployment($Before) {
    $running = Get-RunningProxyPort
    if ($running -eq 0) { return @('The Aria proxy is not running.') }
    Set-AppUrl $running
    $problems = @()
    if (-not (Test-Url "$script:AppUrl/health/ready")) { $problems += 'The backend is not healthy.' }
    if (-not (Test-Url "$script:AppUrl/ready/")) { $problems += 'The frontend is not healthy.' }

    $deadline = (Get-Date).AddMinutes(2)
    while ($true) {
        $logs = Get-ComposeOutput logs --no-color backend
        if ($logs | Select-String -SimpleMatch 'asset_depreciation_discovery_failed' -Quiet) { $problems += 'The depreciation scheduler failed on startup.'; break }
        if ($logs | Select-String -SimpleMatch 'asset_depreciation_discovery_completed' -Quiet) { break }
        if ((Get-Date) -gt $deadline) { Write-Warn 'Could not confirm the depreciation scheduler yet; not treating it as a failure.'; break }
        Start-Sleep -Seconds 5
    }

    if ($null -ne $Before) { $problems += @(Test-DataIntegrity $Before) }
    return $problems
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

# Removes the project's untagged images: the previous build after an update,
# or the failed build or download after a rollback.
function Remove-DanglingImages {
    [void](Test-DockerCommand image prune -f --filter "label=com.docker.compose.project=$(Get-ProjectName)")
    [void](Test-DockerCommand image prune -f --filter $ImageSourceLabel)
}

# Registry repository of a local image, e.g. aria-local-backend -> ghcr.io/karthik-beta/aria-backend
function Get-RegistryRepository([string]$Image) {
    $registry = (Get-Setting 'ARIA_IMAGE_REGISTRY' 'ghcr.io/karthik-beta').TrimEnd('/')
    return "$registry/$($Image -replace '^aria-local-', 'aria-')"
}

# Returns the commits whose images match the checked-out sources, newest first:
# HEAD and the ancestors before it that left the image sources unchanged
# (CI publishes images only for the commits pushed to master). Returns @() when
# only a local build matches the sources (no git, or local changes to them).
function Get-SourceRevisions {
    if ($IsRelease) { return @(Get-Setting 'ARIA_RELEASE_REVISION' '') | Where-Object { $_ -ne '' } }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Info 'git is not installed, so the matching prebuilt images cannot be identified.'
        return @()
    }
    $ErrorActionPreference = 'Continue'
    $revision = (& git -C $RepoRoot rev-parse HEAD 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $revision -eq '') {
        Write-Info 'This folder is not a git checkout, so the matching prebuilt images cannot be identified.'
        return @()
    }
    $changes = @(& git -C $RepoRoot status --porcelain -- @ImageSources 2>$null)
    if ($changes.Count -gt 0) {
        Write-Info 'The application sources have local changes, so the prebuilt images do not match them.'
        return @()
    }
    return (Get-RevisionCandidates $revision)
}

# $Revision and the ancestors before it that left the image sources unchanged, newest first.
function Get-RevisionCandidates([string]$Revision) {
    $ErrorActionPreference = 'Continue'
    # --first-parent follows master's merge commits, which are the ones CI built.
    $lastChange = (& git -C $RepoRoot rev-list --first-parent -n 1 $Revision -- @ImageSources 2>$null | Out-String).Trim()
    $revisions = @()
    foreach ($commit in @(& git -C $RepoRoot rev-list --first-parent -n $MaxImageLookback $Revision 2>$null)) {
        $revisions += $commit
        if ($commit -eq $lastChange) { break }
    }
    if ($revisions.Count -eq 0) { $revisions = @($Revision) }
    return $revisions
}

function Get-ImageRevision([string]$Reference) {
    $label = Get-DockerOutput image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' $Reference | Select-Object -First 1
    if ($null -eq $label -or "$label" -eq '<no value>') { return '' }
    return "$label".Trim()
}

# Returns the newest of $Revisions that CI published both images for, or ''.
function Find-PublishedRevision([string[]]$Revisions) {
    foreach ($revision in $Revisions) {
        $published = $true
        foreach ($image in $BuiltImages) {
            if (-not (Test-DockerCommand manifest inspect "$(Get-RegistryRepository $image):sha-$revision")) { $published = $false; break }
        }
        if ($published) { return $revision }
    }
    return ''
}

# Downloads the images CI built from the newest of $Revisions that has them and
# tags them as the local images. Returns $false when none are available,
# leaving the local images as they were.
function Get-PrebuiltImages([string[]]$Revisions) {
    $current = $true
    foreach ($image in $BuiltImages) {
        if ($Revisions -notcontains (Get-ImageRevision "${image}:latest")) { $current = $false; break }
    }
    if ($current) {
        Write-Ok "Prebuilt images for $($Revisions[0].Substring(0, 8)) are already here"
        return $true
    }

    Write-Step 'Looking for prebuilt images'
    $Revision = Find-PublishedRevision $Revisions
    if ($Revision -eq '') {
        Write-Warn "No prebuilt images match $($Revisions[0].Substring(0, 8)) (it is not on master yet, the Release Images workflow may still be running, or the registry is unreachable)."
        return $false
    }
    $short = $Revision.Substring(0, 8)
    if ($Revision -ne $Revisions[0]) { Write-Info "Using the images built for $short; the application sources have not changed since." }

    Write-Step "Downloading prebuilt images for $short"
    $pulled = @()
    foreach ($image in $BuiltImages) {
        $remote = "$(Get-RegistryRepository $image):sha-$Revision"
        $ErrorActionPreference = 'Continue'
        & docker pull $remote | Out-Host
        $code = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        if ($code -ne 0) {
            foreach ($reference in $pulled) { [void](Test-DockerCommand image rm $reference) }
            Write-Warn "Prebuilt images for $short are not available (the Release Images workflow may still be running, or the registry is unreachable)."
            return $false
        }
        $pulled += $remote
    }

    # Tag both only once both are here, so frontend and backend stay a matching pair.
    foreach ($image in $BuiltImages) {
        $remote = "$(Get-RegistryRepository $image):sha-$Revision"
        if (-not (Test-DockerCommand image tag $remote "${image}:latest")) { Stop-WithError "Could not tag $remote as ${image}:latest" }
        # Drop the registry tag; the local tag keeps the image (and its layers for the next download).
        [void](Test-DockerCommand image rm $remote)
    }
    Write-Ok "Downloaded prebuilt images for $short"
    return $true
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

    $build = -not $NoBuild
    if (-not $build) {
        foreach ($image in $BuiltImages) {
            if (-not (Test-Image "${image}:latest")) {
                Write-Warn "Image ${image}:latest is missing, fetching it even though -NoBuild was given"
                $build = $true
                break
            }
        }
    }

    if ($build -and -not $FromSource) {
        $revisions = @(Get-SourceRevisions)
        if ($revisions.Count -gt 0 -and (Get-PrebuiltImages $revisions)) { $build = $false }
        elseif ($IsRelease) { Stop-WithError 'This installed release has no sources to build from, and its images could not be downloaded. Check the internet connection and run the installer again.' }
        else { Write-Info 'Building the images from source instead.' }
    }

    if ($build) {
        Write-Step 'Building images (the first build takes 10-20 minutes)'
        $buildCode = Invoke-Compose build
        if ($buildCode -ne 0) {
            # The frontend build downloads Google Fonts; cached layers make a retry quick.
            Write-Warn 'Image build failed, retrying once in case it was a network hiccup'
            $buildCode = Invoke-Compose build
        }
        Assert-Compose $buildCode 'Image build'
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

# Runs a copy of this script in a child process; returns its exit code.
function Invoke-Script([string]$Path, [string[]]$ScriptArgs) {
    $hostExe = (Get-Process -Id $PID).Path
    $childArgs = @('-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $Path) + $ScriptArgs + @('-SkipLock', '-NoBrowser')
    if ($Port -gt 0) { $childArgs += @('-Port', "$Port") }
    if ($FromSource) { $childArgs += '-FromSource' }
    $ErrorActionPreference = 'Continue'
    & $hostExe @childArgs | Out-Host
    return $LASTEXITCODE
}

# Runs this script (as it is on disk now) in a child process; returns its exit code.
function Invoke-Self([string[]]$ScriptArgs) { return (Invoke-Script $PSCommandPath $ScriptArgs) }

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
        Write-Ok "Already up to date ($oldShort). Use -Force to reinstall anyway."
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

    # Check before touching anything, so an update never falls back to a long
    # local build just because CI has not published the new images yet.
    if ($old -ne $new -and -not $FromSource) {
        Write-Step "Checking for prebuilt images of $newShort"
        $published = Find-PublishedRevision @(Get-RevisionCandidates $new)
        if ($published -eq '') {
            Stop-WithError "The prebuilt images for $newShort are not published yet (the Release Images workflow takes about 10-15 minutes after a push), or the registry is unreachable. Nothing was changed; run update again later, or pass -FromSource to build them here (10-20 minutes)."
        }
        Write-Ok "Prebuilt images found ($($published.Substring(0, 8)))"
    }

    # The scriptblocks run inside Invoke-GuardedSwitch and see $old and $new from here.
    $switch = { if ($old -ne $new) { Write-Step "Pulling $newShort"; [void](Invoke-Git @('merge', '--ff-only', '--quiet', $new)) } }
    $revert = { if ($old -ne $new) { [void](Invoke-Git @('reset', '--hard', '--quiet', $old)) } }
    Invoke-GuardedSwitch -OldName $oldShort -NewName $newShort -OldScript $PSCommandPath -Switch $switch -Revert $revert -Commit {}
}

# Switches the running deployment from version $OldName to $NewName safely:
# stops the app, saves a restore point (database backup, data snapshot,
# images), runs $Switch to put the new files in place and starts them with the
# new script, then checks health, the scheduler and the data. On success it
# runs $Commit and removes the restore point; on any failure it runs $Revert,
# restores the old images and database with $OldScript, checks again and exits with an error.
function Invoke-GuardedSwitch {
    param([string]$OldName, [string]$NewName, [string]$OldScript, [scriptblock]$Switch, [scriptblock]$Revert, [scriptblock]$Commit)

    Write-Step 'Creating a restore point'
    $backupName = ''
    $before = $null
    $script:RestartScript = $OldScript
    if (Test-DatabaseVolume) {
        # Nothing may be written after the backup, or a rollback would lose it.
        Write-Info 'Stopping the app so the restore point holds every record'
        $script:RestartOnExit = $true
        Assert-Compose (Invoke-Compose stop caddy frontend backend) 'Stopping services'
        $backupName = New-Backup "pre-update-$OldName"
        Write-Info "Database saved as $backupName"
        $before = Get-DataSnapshot
        if ($null -eq $before) { Stop-WithError 'Could not read the database to record its contents. Nothing was changed.' }
        Write-Info "Recorded $(Get-RowTotal $before) rows in $($before.Counts.Count) tables and $($before.Fingerprints.Count) depreciation checks"
    }
    else {
        Write-Info 'No database yet, nothing to back up.'
    }
    Save-RollbackImages
    $backupPath = Join-Path $BackupDir $backupName

    & $Switch

    # The child runs the new script, compose file and migrations.
    Write-Step 'Installing and restarting the new version'
    $script:RestartOnExit = $false
    $exitCode = Invoke-Self @('start')
    if ($exitCode -ne 0) {
        $problems = @("The new version did not start (exit code $exitCode).")
    }
    else {
        Write-Step 'Checking the new version (health, scheduler, data)'
        $problems = @(Test-Deployment $before)
    }

    if ($problems.Count -eq 0) {
        if ($null -ne $before) { Write-Ok "Data intact: all $($before.Counts.Count) tables kept their rows and the depreciation records are unchanged" }
        & $Commit
        Remove-RollbackImages
        Remove-DanglingImages
        if ($backupName -ne '') {
            if ($KeepRestorePoint) {
                Write-Info "Restore point kept: $backupPath"
            }
            else {
                Remove-Item -Path $backupPath -Force -ErrorAction SilentlyContinue
                Write-Info 'Restore point removed (pass -KeepRestorePoint to keep it)'
            }
        }
        Write-Ok "Updated to $NewName"
        Open-Browser
        return
    }

    Write-Host ''
    foreach ($problem in $problems) { Write-Warn $problem }
    Write-Warn "The update to $NewName failed its checks. Rolling back to $OldName."
    & $Revert
    Restore-RollbackImages
    if ($backupName -ne '') {
        $rollbackCode = Invoke-Script $OldScript @('restore', '-File', $backupName, '-Force')
    }
    else {
        $rollbackCode = Invoke-Script $OldScript @('start', '-NoBuild')
    }
    if ($rollbackCode -ne 0) {
        Stop-WithError "Update failed and the rollback did not finish. The files are back at $OldName; restore the data with: $OldScript restore -File $backupName"
    }

    Write-Step 'Checking the restored version'
    $rollbackProblems = @(Test-Deployment $before)
    Remove-RollbackImages
    Remove-DanglingImages
    if ($rollbackProblems.Count -gt 0) {
        foreach ($problem in $rollbackProblems) { Write-Warn $problem }
        Stop-WithError "Update to $NewName failed and Aria was rolled back to $OldName, but the checks above still fail. The restore point is kept: $backupPath"
    }
    $kept = if ($backupName -ne '') { " The restore point is kept: $backupPath" } else { '' }
    Stop-WithError "Update to $NewName failed; Aria was rolled back to $OldName, is running and its data matches the restore point.$kept See the output above for the cause."
}

# ---------------------------------------------------------------------------
# Install (installed releases, run by AriaSetup.exe)
# ---------------------------------------------------------------------------
# The installer copies each version to <install dir>\versions\<version> and
# runs that copy's `install`. With no installed version it starts this one;
# otherwise it switches from the installed version with the same restore
# point, checks and rollback as update, and removes the old folder on success.
function Invoke-Install {
    $version = Get-Setting 'ARIA_RELEASE_VERSION' ''
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    $log = Join-Path $LogDir "install-$version-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
    try { Start-Transcript -Path $log | Out-Null } catch { Write-Warn "Could not write the log $log" }

    $previous = ''
    if (Test-Path $CurrentVersionFile) { $previous = "$(Get-Content -Path $CurrentVersionFile -TotalCount 1)".Trim() }
    $previousScript = Join-Path $InstallRoot "versions\$previous\deployment\local\aria-local.ps1"

    if ($previous -eq '' -or $previous -eq $version -or -not (Test-Path $previousScript)) {
        Write-Step "Installing Aria ERP $version"
        Invoke-Start
        Complete-Install $version ''
        return
    }

    Write-Step "Updating Aria ERP $previous -> $version"
    Assert-Docker
    # Check before touching anything; there are no sources to build from.
    if ((Find-PublishedRevision @(Get-SourceRevisions)) -eq '') {
        Stop-WithError "The images for $version could not be found (is the internet connection working?). Nothing was changed; Aria $previous is still installed."
    }
    $commit = { Complete-Install $version $previous }
    Invoke-GuardedSwitch -OldName $previous -NewName $version -OldScript $previousScript -Switch {} -Revert {} -Commit $commit
}

# Records $Version as installed, points the shortcuts at the URL Aria runs on
# and removes the $Previous version's folder.
function Complete-Install([string]$Version, [string]$Previous) {
    Set-Content -Path $CurrentVersionFile -Value $Version -Encoding ascii
    Set-Content -Path $UrlFile -Value @('[InternetShortcut]', "URL=$script:AppUrl/") -Encoding ascii
    if ($Previous -ne '' -and $Previous -ne $Version) {
        $folder = Join-Path $InstallRoot "versions\$Previous"
        Remove-Item -Path $folder -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $folder) { Write-Warn "Could not remove the previous version's folder $folder" }
    }
    Write-Ok "Aria ERP $Version is installed. Open it from the 'Aria ERP' shortcut or $script:AppUrl"
}

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------
function Invoke-Uninstall {
    $what = 'This removes Aria containers, data volumes, images and local settings'
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
    # -a: Docker 29 hides untagged images (e.g. a rolled-back build) without it.
    foreach ($image in (Get-DockerOutput image ls -a -q --filter $label | Sort-Object -Unique)) { Remove-ImageIfUnused $image }
    # Prebuilt images left by an interrupted download or a rolled-back update
    foreach ($image in $BuiltImages) {
        foreach ($reference in (Get-DockerOutput image ls (Get-RegistryRepository $image) --format '{{.Repository}}:{{.Tag}}')) { Remove-ImageIfUnused $reference }
    }
    foreach ($image in (Get-DockerOutput image ls -a -q --filter $ImageSourceLabel --filter dangling=true | Sort-Object -Unique)) { Remove-ImageIfUnused $image }
    foreach ($image in $pulledImages) { Remove-ImageIfUnused $image }

    # Docker keeps one build cache for every project, so it cannot be cleared
    # for Aria alone. Clear it only when asked to.
    Write-Step 'Build cache'
    $cacheSize = Get-DockerOutput system df --format '{{.Type}}={{.Size}}' | Where-Object { $_ -like 'Build Cache=*' } | Select-Object -First 1
    $cacheSize = if ($cacheSize) { $cacheSize.Split('=')[1] } else { 'unknown' }
    $clearCache = $PruneBuildCache
    if (-not $clearCache -and -not $Force) {
        $answer = Read-Host "Docker's build cache uses $cacheSize and is shared with your other Docker projects. Clear it too? Type 'yes' to clear"
        $clearCache = ($answer -eq 'yes')
    }
    if ($clearCache) {
        if (Test-DockerCommand builder prune --all --force) { Write-Info "Cleared Docker's build cache ($cacheSize)" }
        else { Write-Warn "Could not clear Docker's build cache" }
    }
    else {
        Write-Info "Kept Docker's build cache ($cacheSize). Clear it later with: docker builder prune --all"
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
        $leftovers += @(Get-DockerOutput image ls (Get-RegistryRepository $image) --format 'image {{.Repository}}:{{.Tag}}')
    }
    $leftovers += @(Get-DockerOutput image ls -a --filter $label --filter dangling=true --format 'image {{.ID}} (untagged)')
    $leftovers += @(Get-DockerOutput image ls -a --filter $ImageSourceLabel --filter dangling=true --format 'image {{.ID}} (untagged)')

    if ($leftovers.Count -gt 0) {
        Write-Warn 'Some Aria resources are still present:'
        foreach ($item in $leftovers) { Write-Info "  $item" }
        exit 1
    }
    Write-Ok 'Aria was removed from Docker cleanly'
    if ($KeepBackups -and (Test-Path $BackupDir)) { Write-Info "Backups kept in $BackupDir" }
    # The uninstaller removes an installed release's files.
    if (-not $IsRelease) { Write-Info "You can now delete the folder $RepoRoot" }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if (-not (Test-Path $ComposeFile)) { Stop-WithError "Missing $ComposeFile" }
if (-not (Test-Path $EnvFile)) { Stop-WithError "Missing $EnvFile" }

$script:Settings = Read-EnvFile $EnvFile
if ($IsRelease) { foreach ($entry in (Read-EnvFile $ReleaseFile).GetEnumerator()) { $script:Settings[$entry.Key] = $entry.Value } }
foreach ($entry in (Read-EnvFile $OverrideEnvFile).GetEnumerator()) { $script:Settings[$entry.Key] = $entry.Value }
$script:HttpPort = 80
$script:AppUrl = 'http://localhost'
$script:OwnsLock = $false
$script:GitExitCode = 0
# Set while update has the app stopped for its restore point; an early exit starts it again.
$script:RestartOnExit = $false
# The script that starts the version being replaced (an installed release's own copy).
$script:RestartScript = ''

if ($IsRelease -and $Command -eq 'update') { Stop-WithError 'This is an installed release: run the newer AriaSetup.exe to update it.' }
if ($IsRelease -and $FromSource) { Stop-WithError 'This is an installed release without sources, so -FromSource is not available.' }
if (-not $IsRelease -and $Command -eq 'install') { Stop-WithError 'install is run by AriaSetup.exe for installed releases. In a git clone, use start or update.' }

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
        'install' { Invoke-Install }
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
    if ($script:RestartOnExit) {
        Write-Warn 'Update stopped before installing anything; starting the current version again'
        if ($script:RestartScript -ne '' -and $script:RestartScript -ne $PSCommandPath) { [void](Invoke-Script $script:RestartScript @('start', '-NoBuild')) }
        else { [void](Invoke-Compose up -d --remove-orphans) }
    }
    Exit-Lock
    Pop-Location
}
