<#
.SYNOPSIS
    Aria ERP Full System Recovery Script (Windows)
    
.DESCRIPTION
    Orchestrates complete system restoration including database and configuration.
    Creates pre-recovery snapshots and provides rollback capability.
    
.EXAMPLE
    .\full-restore.ps1
    
.NOTES
    Requires Administrator privileges
    Requires Docker Desktop for Windows
#>

#Requires -Version 5.1
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Recovery state
$script:RecoveryState = "initial"
$script:PreRecoveryBackup = ""

#region Helper Functions

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet('INFO', 'SUCCESS', 'WARN', 'ERROR', 'STEP')]
        [string]$Level = 'INFO'
    )
    
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $color = switch ($Level) {
        'INFO'    { 'Cyan' }
        'SUCCESS' { 'Green' }
        'WARN'    { 'Yellow' }
        'ERROR'   { 'Red' }
        'STEP'    { 'Magenta' }
    }
    
    Write-Host "[$Level]" -ForegroundColor $color -NoNewline
    Write-Host " $timestamp - $Message"
}

function Show-Banner {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   Aria ERP Full System Recovery" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This script will:"
    Write-Host "  1. Verify backup integrity"
    Write-Host "  2. Create pre-recovery backup"
    Write-Host "  3. Stop all services"
    Write-Host "  4. Restore database"
    Write-Host "  5. Restore configuration"
    Write-Host "  6. Restart services"
    Write-Host "  7. Verify system health"
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Confirm-Action {
    param([string]$Prompt)
    
    $response = Read-Host "$Prompt [y/N]"
    
    if ($response -notmatch '^[Yy]$') {
        Write-Log "Operation cancelled by user" -Level WARN
        exit 0
    }
}

#endregion

#region Prerequisite Checks

function Test-Prerequisites {
    Write-Log "Checking prerequisites..." -Level STEP
    
    $allPassed = $true
    
    # Check Docker
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Log "Docker is not installed" -Level ERROR
        $allPassed = $false
    } else {
        try {
            docker info 2>&1 | Out-Null
            Write-Log "Docker is available" -Level SUCCESS
        } catch {
            Write-Log "Docker daemon is not running" -Level ERROR
            $allPassed = $false
        }
    }
    
    # Check docker-compose
    if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        Write-Log "docker-compose not found, some operations may fail" -Level WARN
    } else {
        Write-Log "docker-compose is available" -Level SUCCESS
    }
    
    # Check restoration scripts
    if (-not (Test-Path "$ScriptDir\restore-database.ps1")) {
        Write-Log "Database restoration script not found" -Level ERROR
        $allPassed = $false
    }
    
    if (-not (Test-Path "$ScriptDir\restore-config.ps1")) {
        Write-Log "Configuration restoration script not found" -Level ERROR
        $allPassed = $false
    }
    
    if ($allPassed) {
        Write-Log "Restoration scripts found" -Level SUCCESS
    }
    
    # Check health monitoring
    if (Test-Path "$ScriptDir\..\monitoring\health-check.ps1") {
        Write-Log "Health check script available" -Level SUCCESS
    } else {
        Write-Log "Health check script not found" -Level WARN
    }
    
    return $allPassed
}

#endregion

#region Backup Selection

function Get-AvailableBackups {
    $backupLocations = @(
        "C:\ProgramData\Aria-ERP\backups",
        "D:\",
        "E:\"
    )
    
    $backupDirs = @()
    
    foreach ($location in $backupLocations) {
        if (Test-Path $location) {
            $dirs = Get-ChildItem -Path $location -Directory -Filter "aria-erp-backup-*" -Recurse -Depth 1 -ErrorAction SilentlyContinue
            $backupDirs += $dirs
        }
    }
    
    # Sort by creation time (newest first)
    $backupDirs = $backupDirs | Sort-Object CreationTime -Descending | Select-Object -First 20
    
    return $backupDirs
}

function Select-Backup {
    Write-Log "Selecting backup for restoration..." -Level STEP
    
    $backupDirs = Get-AvailableBackups
    
    if ($backupDirs.Count -eq 0) {
        Write-Log "No backups found" -Level ERROR
        return $null
    }
    
    Write-Host "Available backups:" -ForegroundColor Cyan
    Write-Host "==================" -ForegroundColor Cyan
    Write-Host ""
    
    $index = 1
    foreach ($backup in $backupDirs) {
        $name = $backup.Name
        $timestamp = $name -replace 'aria-erp-backup-', ''
        $size = "{0:N2} MB" -f ((Get-ChildItem -Path $backup.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB)
        
        Write-Host "[$index] $timestamp - Size: $size" -ForegroundColor Yellow
        Write-Host "    Path: $($backup.FullName)" -ForegroundColor Gray
        
        # Check contents
        if ((Test-Path "$($backup.FullName)\database.sql") -or (Test-Path "$($backup.FullName)\database.zip")) {
            Write-Host "    ✓ Database backup" -ForegroundColor Green
        }
        if (Test-Path "$($backup.FullName)\config") {
            Write-Host "    ✓ Configuration backup" -ForegroundColor Green
        }
        if (Test-Path "$($backup.FullName)\backup-manifest.txt") {
            Write-Host "    ✓ Manifest" -ForegroundColor Green
        }
        
        Write-Host ""
        $index++
    }
    
    $selection = Read-Host "Select backup number (1-$($backupDirs.Count)) or 'q' to quit"
    
    if ($selection -eq 'q' -or $selection -eq 'Q') {
        Write-Log "Operation cancelled by user" -Level WARN
        exit 0
    }
    
    $selectionNum = 0
    if (-not [int]::TryParse($selection, [ref]$selectionNum) -or $selectionNum -lt 1 -or $selectionNum -gt $backupDirs.Count) {
        Write-Log "Invalid selection" -Level ERROR
        return $null
    }
    
    return $backupDirs[$selectionNum - 1]
}

#endregion

#region Backup Verification

function Test-BackupIntegrity {
    param([System.IO.DirectoryInfo]$BackupDir)
    
    Write-Log "Verifying backup integrity..." -Level STEP
    
    $verificationFailed = $false
    
    # Check database backup
    $dbZip = Join-Path $BackupDir.FullName "database.zip"
    $dbSql = Join-Path $BackupDir.FullName "database.sql"
    
    if (Test-Path $dbZip) {
        try {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $zip = [System.IO.Compression.ZipFile]::OpenRead($dbZip)
            $zip.Dispose()
            Write-Log "Database backup integrity verified" -Level SUCCESS
        } catch {
            Write-Log "Database backup is corrupted" -Level ERROR
            $verificationFailed = $true
        }
    } elseif (Test-Path $dbSql) {
        Write-Log "Database backup found" -Level SUCCESS
    } else {
        Write-Log "Database backup missing" -Level ERROR
        $verificationFailed = $true
    }
    
    # Check configuration backup
    $configDir = Join-Path $BackupDir.FullName "config"
    if (Test-Path $configDir) {
        if (Test-Path (Join-Path $configDir ".env")) {
            Write-Log "Environment file found" -Level SUCCESS
        }
        if (Test-Path (Join-Path $configDir "docker-compose.yml")) {
            Write-Log "Compose file found" -Level SUCCESS
        }
        if (Test-Path (Join-Path $configDir "traefik")) {
            Write-Log "Traefik config found" -Level SUCCESS
        }
    } else {
        Write-Log "Configuration backup missing" -Level WARN
    }
    
    # Check manifest
    if (Test-Path (Join-Path $BackupDir.FullName "backup-manifest.txt")) {
        Write-Log "Backup manifest found" -Level SUCCESS
    } else {
        Write-Log "Backup manifest missing" -Level WARN
    }
    
    return -not $verificationFailed
}

#endregion

#region Pre-Recovery Snapshot

function New-PreRecoverySnapshot {
    Write-Log "Creating pre-recovery snapshot..." -Level STEP
    
    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $snapshotDir = Join-Path $env:TEMP "aria-pre-recovery-$timestamp"
    New-Item -ItemType Directory -Path $snapshotDir -Force | Out-Null
    
    # Snapshot current database if possible
    $dbContainer = docker ps --format "{{.Names}}" | Where-Object { $_ -eq "aria-database" }
    if ($dbContainer) {
        Write-Log "Snapshotting current database..." -Level INFO
        
        $dbName = $env:POSTGRES_DB
        if (-not $dbName) { $dbName = "aria" }
        
        $dbUser = $env:POSTGRES_USER
        if (-not $dbUser) { $dbUser = "aria" }
        
        try {
            $sqlFile = Join-Path $snapshotDir "database-snapshot.sql"
            docker exec aria-database pg_dump -U $dbUser $dbName | Out-File -FilePath $sqlFile -Encoding UTF8
            
            # Compress
            Compress-Archive -Path $sqlFile -DestinationPath "$sqlFile.zip" -CompressionLevel Optimal
            Remove-Item $sqlFile
            
            Write-Log "Database snapshot created" -Level SUCCESS
        } catch {
            Write-Log "Could not create database snapshot: $_" -Level WARN
        }
    }
    
    # Snapshot current configuration
    $ariaHome = "C:\ProgramData\Aria-ERP"
    
    if (Test-Path "$ariaHome\.env") {
        Copy-Item "$ariaHome\.env" -Destination $snapshotDir
    }
    if (Test-Path "$ariaHome\docker-compose.yml") {
        Copy-Item "$ariaHome\docker-compose.yml" -Destination $snapshotDir
    }
    if (Test-Path "$ariaHome\config\traefik") {
        Copy-Item "$ariaHome\config\traefik" -Destination $snapshotDir -Recurse
    }
    
    $script:PreRecoveryBackup = $snapshotDir
    Write-Log "Pre-recovery snapshot saved to: $snapshotDir" -Level SUCCESS
}

#endregion

#region Service Management

function Stop-AriaServices {
    Write-Log "Stopping Aria ERP services..." -Level STEP
    
    $ariaHome = "C:\ProgramData\Aria-ERP"
    Push-Location $ariaHome
    
    try {
        $runningContainers = docker-compose ps -q 2>$null
        if ($runningContainers) {
            docker-compose down 2>&1 | Out-Null
            Write-Log "Services stopped" -Level SUCCESS
            $script:RecoveryState = "services_stopped"
            return $true
        } else {
            Write-Log "Services are already stopped" -Level INFO
            $script:RecoveryState = "services_stopped"
            return $true
        }
    } catch {
        Write-Log "Failed to stop services: $_" -Level ERROR
        return $false
    } finally {
        Pop-Location
    }
}

function Start-AriaServices {
    Write-Log "Starting Aria ERP services..." -Level STEP
    
    $ariaHome = "C:\ProgramData\Aria-ERP"
    Push-Location $ariaHome
    
    try {
        docker-compose up -d 2>&1 | Out-Null
        Write-Log "Services started" -Level SUCCESS
        $script:RecoveryState = "services_started"
        
        # Wait for services to initialize
        Write-Log "Waiting for services to initialize..." -Level INFO
        Start-Sleep -Seconds 10
        
        return $true
    } catch {
        Write-Log "Failed to start services: $_" -Level ERROR
        return $false
    } finally {
        Pop-Location
    }
}

#endregion

#region Database Restoration

function Restore-Database {
    param([string]$BackupDir)
    
    Write-Log "Restoring database..." -Level STEP
    
    # Start database container only
    $dbContainer = docker ps --format "{{.Names}}" | Where-Object { $_ -eq "aria-database" }
    if (-not $dbContainer) {
        Write-Log "Starting database container..." -Level INFO
        
        try {
            docker start aria-database 2>&1 | Out-Null
        } catch {
            $ariaHome = "C:\ProgramData\Aria-ERP"
            Push-Location $ariaHome
            docker-compose up -d aria-database 2>&1 | Out-Null
            Pop-Location
        }
        
        Start-Sleep -Seconds 5
    }
    
    # Locate database backup
    $dbZip = Join-Path $BackupDir "database.zip"
    $dbSql = Join-Path $BackupDir "database.sql"
    $dbBackup = $null
    
    if (Test-Path $dbZip) {
        # Extract
        $extractPath = Join-Path $env:TEMP "aria-recovery-db.sql"
        
        try {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $zip = [System.IO.Compression.ZipFile]::OpenRead($dbZip)
            $entry = $zip.Entries | Where-Object { $_.Name -eq "database.sql" } | Select-Object -First 1
            
            if ($entry) {
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $extractPath, $true)
                $zip.Dispose()
                $dbBackup = $extractPath
            }
        } catch {
            Write-Log "Failed to extract database backup: $_" -Level ERROR
            return $false
        }
    } elseif (Test-Path $dbSql) {
        $dbBackup = $dbSql
    } else {
        Write-Log "Database backup not found" -Level ERROR
        return $false
    }
    
    # Get database credentials
    $dbName = $env:POSTGRES_DB
    if (-not $dbName) { $dbName = "aria" }
    
    $dbUser = $env:POSTGRES_USER
    if (-not $dbUser) { $dbUser = "aria" }
    
    try {
        # Drop and recreate database
        docker exec aria-database psql -U $dbUser -d postgres -c "DROP DATABASE IF EXISTS $dbName;" 2>&1 | Out-Null
        docker exec aria-database psql -U $dbUser -d postgres -c "CREATE DATABASE $dbName;" 2>&1 | Out-Null
        
        # Restore database
        Get-Content $dbBackup | docker exec -i aria-database psql -U $dbUser -d $dbName 2>&1 | Out-Null
        
        Write-Log "Database restored" -Level SUCCESS
        $script:RecoveryState = "database_restored"
        
        # Cleanup
        if ($dbBackup -eq $extractPath -and (Test-Path $extractPath)) {
            Remove-Item $extractPath -Force
        }
        
        return $true
    } catch {
        Write-Log "Database restoration failed: $_" -Level ERROR
        
        # Cleanup
        if ($dbBackup -eq $extractPath -and (Test-Path $extractPath)) {
            Remove-Item $extractPath -Force -ErrorAction SilentlyContinue
        }
        
        return $false
    }
}

#endregion

#region Configuration Restoration

function Restore-Configuration {
    param([string]$BackupDir)
    
    Write-Log "Restoring configuration..." -Level STEP
    
    $configDir = Join-Path $BackupDir "config"
    
    if (-not (Test-Path $configDir)) {
        Write-Log "Configuration backup not found, skipping" -Level WARN
        return $true
    }
    
    $ariaHome = "C:\ProgramData\Aria-ERP"
    
    try {
        if (Test-Path (Join-Path $configDir ".env")) {
            Copy-Item (Join-Path $configDir ".env") -Destination (Join-Path $ariaHome ".env") -Force
        }
        
        if (Test-Path (Join-Path $configDir "docker-compose.yml")) {
            Copy-Item (Join-Path $configDir "docker-compose.yml") -Destination (Join-Path $ariaHome "docker-compose.yml") -Force
        }
        
        if (Test-Path (Join-Path $configDir "traefik")) {
            $traefikDest = Join-Path $ariaHome "config\traefik"
            if (-not (Test-Path $traefikDest)) {
                New-Item -ItemType Directory -Path $traefikDest -Force | Out-Null
            }
            Copy-Item (Join-Path $configDir "traefik\*") -Destination $traefikDest -Recurse -Force
        }
        
        Write-Log "Configuration restored" -Level SUCCESS
        $script:RecoveryState = "config_restored"
        return $true
    } catch {
        Write-Log "Configuration restoration failed: $_" -Level ERROR
        return $false
    }
}

#endregion

#region Health Verification

function Test-SystemHealth {
    Write-Log "Verifying system health..." -Level STEP
    
    $healthScript = Join-Path $ScriptDir "..\monitoring\health-check.ps1"
    
    if (Test-Path $healthScript) {
        try {
            & $healthScript *>&1 | Out-Null
            $exitCode = $LASTEXITCODE
            
            if ($exitCode -eq 0) {
                Write-Log "System health check passed" -Level SUCCESS
                return $true
            } else {
                Write-Log "System health check shows issues (exit code: $exitCode)" -Level WARN
                return $false
            }
        } catch {
            Write-Log "System health check failed: $_" -Level ERROR
            return $false
        }
    } else {
        Write-Log "Health check script not available, skipping verification" -Level WARN
        return $true
    }
}

#endregion

#region Rollback

function Invoke-RecoveryRollback {
    Write-Log "Initiating recovery rollback..." -Level WARN
    
    $ariaHome = "C:\ProgramData\Aria-ERP"
    
    switch ($script:RecoveryState) {
        { $_ -in @("services_started", "config_restored", "database_restored") } {
            Write-Log "Stopping services..." -Level INFO
            Push-Location $ariaHome
            docker-compose down 2>&1 | Out-Null
            Pop-Location
            
            if ($script:PreRecoveryBackup -and (Test-Path $script:PreRecoveryBackup)) {
                Write-Log "Restoring pre-recovery snapshot..." -Level INFO
                
                # Restore configuration
                if (Test-Path (Join-Path $script:PreRecoveryBackup ".env")) {
                    Copy-Item (Join-Path $script:PreRecoveryBackup ".env") -Destination (Join-Path $ariaHome ".env") -Force
                }
                if (Test-Path (Join-Path $script:PreRecoveryBackup "docker-compose.yml")) {
                    Copy-Item (Join-Path $script:PreRecoveryBackup "docker-compose.yml") -Destination (Join-Path $ariaHome "docker-compose.yml") -Force
                }
                if (Test-Path (Join-Path $script:PreRecoveryBackup "traefik")) {
                    Copy-Item (Join-Path $script:PreRecoveryBackup "traefik\*") -Destination (Join-Path $ariaHome "config\traefik") -Recurse -Force
                }
                
                # Restore database if snapshot exists
                $dbSnapshot = Join-Path $script:PreRecoveryBackup "database-snapshot.sql.zip"
                if (Test-Path $dbSnapshot) {
                    # Start database
                    docker start aria-database 2>&1 | Out-Null
                    Start-Sleep -Seconds 5
                    
                    # Extract and restore
                    $sqlFile = Join-Path $env:TEMP "aria-rollback.sql"
                    Expand-Archive -Path $dbSnapshot -DestinationPath $env:TEMP -Force
                    
                    $dbName = $env:POSTGRES_DB
                    if (-not $dbName) { $dbName = "aria" }
                    
                    $dbUser = $env:POSTGRES_USER
                    if (-not $dbUser) { $dbUser = "aria" }
                    
                    docker exec aria-database psql -U $dbUser -d postgres -c "DROP DATABASE IF EXISTS $dbName;" 2>&1 | Out-Null
                    docker exec aria-database psql -U $dbUser -d postgres -c "CREATE DATABASE $dbName;" 2>&1 | Out-Null
                    Get-Content $sqlFile | docker exec -i aria-database psql -U $dbUser -d $dbName 2>&1 | Out-Null
                    
                    Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue
                    
                    Write-Log "Database rolled back" -Level INFO
                }
                
                # Restart services
                Push-Location $ariaHome
                docker-compose up -d 2>&1 | Out-Null
                Pop-Location
                
                Write-Log "Rollback completed" -Level SUCCESS
            } else {
                Write-Log "Pre-recovery snapshot not found, cannot rollback completely" -Level ERROR
            }
        }
        
        "services_stopped" {
            Write-Log "Services were stopped, attempting to restart..." -Level INFO
            Push-Location $ariaHome
            docker-compose up -d 2>&1 | Out-Null
            Pop-Location
            Write-Log "Services restarted" -Level SUCCESS
        }
    }
}

#endregion

#region Main Process

function Start-FullRecovery {
    Show-Banner
    
    # Prerequisites
    if (-not (Test-Prerequisites)) {
        Write-Log "Prerequisites check failed" -Level ERROR
        exit 1
    }
    
    # Select backup
    $backupDir = Select-Backup
    if (-not $backupDir) {
        exit 1
    }
    
    Write-Log "Selected backup: $($backupDir.FullName)" -Level INFO
    
    # Verify backup
    if (-not (Test-BackupIntegrity -BackupDir $backupDir)) {
        Write-Log "Backup verification failed" -Level ERROR
        exit 1
    }
    
    # Final confirmation
    Write-Host ""
    Write-Log "WARNING: This will restore your entire Aria ERP system!" -Level WARN
    Write-Log "Current data will be replaced with backup from:" -Level WARN
    Write-Log "  $($backupDir.FullName)" -Level WARN
    Write-Host ""
    Confirm-Action "Are you absolutely sure you want to proceed?"
    
    # Create pre-recovery snapshot
    New-PreRecoverySnapshot
    
    # Execute recovery steps
    $recoveryFailed = $false
    
    if (-not (Stop-AriaServices)) {
        Write-Log "Failed to stop services" -Level ERROR
        $recoveryFailed = $true
    }
    
    if (-not $recoveryFailed -and -not (Restore-Database -BackupDir $backupDir.FullName)) {
        Write-Log "Database restoration failed" -Level ERROR
        $recoveryFailed = $true
    }
    
    if (-not $recoveryFailed -and -not (Restore-Configuration -BackupDir $backupDir.FullName)) {
        Write-Log "Configuration restoration failed" -Level ERROR
        $recoveryFailed = $true
    }
    
    if (-not $recoveryFailed -and -not (Start-AriaServices)) {
        Write-Log "Failed to start services" -Level ERROR
        $recoveryFailed = $true
    }
    
    if (-not $recoveryFailed -and -not (Test-SystemHealth)) {
        Write-Log "System health verification failed" -Level WARN
        $recoveryFailed = $true
    }
    
    # Handle recovery result
    if ($recoveryFailed) {
        Write-Host ""
        Write-Log "Recovery process encountered errors" -Level ERROR
        Confirm-Action "Do you want to rollback to pre-recovery state?"
        Invoke-RecoveryRollback
        exit 1
    } else {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Log "Full system recovery completed successfully!" -Level SUCCESS
        Write-Log "Pre-recovery snapshot: $script:PreRecoveryBackup" -Level INFO
        Write-Log "This snapshot will be kept for 7 days" -Level INFO
        Write-Host "========================================" -ForegroundColor Green
    }
}

#endregion

# Execute main function
Start-FullRecovery
