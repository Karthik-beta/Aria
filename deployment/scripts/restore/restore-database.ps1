# Aria ERP - Database Restoration Script (Windows)
# Restores PostgreSQL database from backup with safety checks and rollback

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Configuration
$ComposeFile = $env:COMPOSE_FILE ?? "C:\Program Files\AriaERP\docker-compose.yml"
$EnvFile = $env:ENV_FILE ?? "C:\Program Files\AriaERP\.env"
$DbContainer = "aria-database"

# Global variables
$script:BackupList = @()
$script:PreRestoreBackup = $null

# Logging functions
function Write-RestoreLog {
    param(
        [string]$Message,
        [ValidateSet("INFO", "SUCCESS", "WARN", "ERROR")]
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "INFO"    { "Cyan" }
        "SUCCESS" { "Green" }
        "WARN"    { "Yellow" }
        "ERROR"   { "Red" }
    }
    
    Write-Host "[$Level] " -ForegroundColor $color -NoNewline
    Write-Host "$timestamp - $Message"
}

# Check administrator privileges
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Confirm action
function Confirm-Action {
    param([string]$Prompt)
    
    $response = Read-Host "$Prompt [y/N]"
    if ($response -notmatch '^[Yy]$') {
        Write-RestoreLog "Operation cancelled by user" -Level "WARN"
        exit 0
    }
}

# List available backups
function Get-AvailableBackups {
    param([string]$BackupBase)
    
    Write-RestoreLog "Searching for backups in - $BackupBase" -Level "INFO"
    Write-Host ""
    
    $backups = Get-ChildItem -Path $BackupBase -Directory -Filter "aria-erp-backup-*" -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending
    
    if ($backups.Count -eq 0) {
        Write-RestoreLog "No backups found in $BackupBase" -Level "ERROR"
        return $null
    }
    
    Write-Host "Available backups:"
    Write-Host "=================="
    Write-Host ""
    
    $index = 1
    foreach ($backup in $backups) {
        $timestamp = $backup.Name -replace 'aria-erp-backup-', ''
        $size = "{0:N2} MB" -f ((Get-ChildItem $backup.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB)
        
        try {
            $date = [DateTime]::ParseExact($timestamp.Substring(0, 8), "yyyyMMdd", $null)
            $time = "$($timestamp.Substring(9, 2)):$($timestamp.Substring(11, 2)):$($timestamp.Substring(13, 2))"
            $dateFormatted = $date.ToString("yyyy-MM-dd")
        }
        catch {
            $dateFormatted = $timestamp.Substring(0, 8)
            $time = $timestamp.Substring(9)
        }
        
        Write-Host "[$index] $dateFormatted $time - Size: $size"
        Write-Host "    Path: $($backup.FullName)"
        
        # Check for database backup
        $hasDb = (Test-Path "$($backup.FullName)\database.sql") -or (Test-Path "$($backup.FullName)\database.sql.zip")
        if ($hasDb) {
            Write-Host "    Database: ✓ Found" -ForegroundColor Green
        }
        else {
            Write-Host "    Database: ✗ Missing" -ForegroundColor Red
        }
        
        # Check for manifest
        if (Test-Path "$($backup.FullName)\backup-manifest.txt") {
            Write-Host "    Manifest: ✓ Found" -ForegroundColor Green
        }
        
        Write-Host ""
        $index++
    }
    
    $script:BackupList = $backups
    return $backups
}

# Select backup
function Select-Backup {
    param([string]$BackupBase)
    
    $backups = Get-AvailableBackups -BackupBase $BackupBase
    if (-not $backups) {
        return $null
    }
    
    Write-Host ""
    $selection = Read-Host "Select backup number (1-$($backups.Count)) or 'q' to quit"
    
    if ($selection -eq 'q' -or $selection -eq 'Q') {
        Write-RestoreLog "Operation cancelled by user" -Level "WARN"
        exit 0
    }
    
    try {
        $index = [int]$selection
        if ($index -lt 1 -or $index -gt $backups.Count) {
            throw "Out of range"
        }
        
        return $backups[$index - 1].FullName
    }
    catch {
        Write-RestoreLog "Invalid selection" -Level "ERROR"
        return $null
    }
}

# Verify backup integrity
function Test-BackupIntegrity {
    param([string]$BackupDir)
    
    Write-RestoreLog "Verifying backup integrity..." -Level "INFO"
    
    if (-not (Test-Path $BackupDir)) {
        Write-RestoreLog "Backup directory not found - $BackupDir" -Level "ERROR"
        return $false
    }
    
    # Check for database backup
    $dbBackup = $null
    if (Test-Path "$BackupDir\database.sql.zip") {
        $dbBackup = "$BackupDir\database.sql.zip"
        
        # Test zip integrity
        try {
            $null = [IO.Compression.ZipFile]::OpenRead($dbBackup)
            Write-RestoreLog "Database backup found (compressed) - $dbBackup" -Level "SUCCESS"
        }
        catch {
            Write-RestoreLog "Database backup is corrupted - $($_.Exception.Message)" -Level "ERROR"
            return $false
        }
    }
    elseif (Test-Path "$BackupDir\database.sql") {
        $dbBackup = "$BackupDir\database.sql"
        Write-RestoreLog "Database backup found - $dbBackup" -Level "SUCCESS"
    }
    else {
        Write-RestoreLog "Database backup file not found" -Level "ERROR"
        return $false
    }
    
    # Check file size
    $size = (Get-Item $dbBackup).Length
    if ($size -lt 100) {
        Write-RestoreLog "Database backup appears to be empty or corrupted (size - $size bytes)" -Level "ERROR"
        return $false
    }
    
    Write-RestoreLog "Backup size - $("{0:N2} MB" -f ($size / 1MB))" -Level "INFO"
    
    # Check manifest
    if (Test-Path "$BackupDir\backup-manifest.txt") {
        Write-RestoreLog "Backup manifest found" -Level "SUCCESS"
    }
    else {
        Write-RestoreLog "Backup manifest missing (backup may be incomplete)" -Level "WARN"
    }
    
    Write-RestoreLog "Backup integrity verified" -Level "SUCCESS"
    return $true
}

# Create pre-restore backup
function New-PreRestoreBackup {
    $backupDir = "$env:TEMP\aria-pre-restore-$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    
    Write-RestoreLog "Creating pre-restore backup to - $backupDir" -Level "INFO"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    $dbName = $env:POSTGRES_DB ?? "aria"
    $dbUser = $env:POSTGRES_USER ?? "aria"
    
    # Check if container is running
    $running = docker ps --format "{{.Names}}" 2>$null
    if ($running -notcontains $DbContainer) {
        Write-RestoreLog "Database container not running, skipping pre-restore backup" -Level "WARN"
        return $backupDir
    }
    
    # Backup current database
    try {
        docker exec $DbContainer pg_dump -U $dbUser $dbName | Out-File -FilePath "$backupDir\database-pre-restore.sql" -Encoding UTF8
        Compress-Archive -Path "$backupDir\database-pre-restore.sql" -DestinationPath "$backupDir\database-pre-restore.sql.zip"
        Remove-Item "$backupDir\database-pre-restore.sql"
        Write-RestoreLog "Pre-restore backup created" -Level "SUCCESS"
    }
    catch {
        Write-RestoreLog "Failed to create pre-restore backup - $($_.Exception.Message)" -Level "WARN"
    }
    
    $script:PreRestoreBackup = $backupDir
    return $backupDir
}

# Stop database connections
function Stop-DatabaseConnections {
    $dbName = $env:POSTGRES_DB ?? "aria"
    $dbUser = $env:POSTGRES_USER ?? "aria"
    
    Write-RestoreLog "Terminating active database connections..." -Level "INFO"
    
    try {
        $query = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$dbName' AND pid <> pg_backend_pid();"
        docker exec $DbContainer psql -U $dbUser -d postgres -c $query 2>&1 | Out-Null
        Write-RestoreLog "Database connections terminated" -Level "SUCCESS"
    }
    catch {
        Write-RestoreLog "Warning - $($_.Exception.Message)" -Level "WARN"
    }
}

# Restore database
function Restore-Database {
    param([string]$BackupDir)
    
    Write-RestoreLog "Starting database restoration..." -Level "INFO"
    
    $dbName = $env:POSTGRES_DB ?? "aria"
    $dbUser = $env:POSTGRES_USER ?? "aria"
    
    # Find database backup file
    $dbBackup = $null
    $tempFile = "$env:TEMP\aria-restore-temp.sql"
    
    if (Test-Path "$BackupDir\database.sql.zip") {
        Write-RestoreLog "Decompressing backup..." -Level "INFO"
        Expand-Archive -Path "$BackupDir\database.sql.zip" -DestinationPath $env:TEMP -Force
        $dbBackup = $tempFile
    }
    elseif (Test-Path "$BackupDir\database.sql") {
        $dbBackup = "$BackupDir\database.sql"
    }
    else {
        Write-RestoreLog "Database backup file not found" -Level "ERROR"
        return $false
    }
    
    try {
        # Stop connections
        Stop-DatabaseConnections
        
        # Drop database
        Write-RestoreLog "Dropping existing database..." -Level "INFO"
        docker exec $DbContainer psql -U $dbUser -d postgres -c "DROP DATABASE IF EXISTS $dbName;" 2>&1 | Out-Null
        
        # Create database
        Write-RestoreLog "Creating fresh database..." -Level "INFO"
        docker exec $DbContainer psql -U $dbUser -d postgres -c "CREATE DATABASE $dbName;" 2>&1 | Out-Null
        
        # Restore
        Write-RestoreLog "Restoring database from backup..." -Level "INFO"
        Get-Content $dbBackup | docker exec -i $DbContainer psql -U $dbUser -d $dbName 2>&1 | Out-Null
        
        Write-RestoreLog "Database restored successfully" -Level "SUCCESS"
        
        # Cleanup
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
        
        return $true
    }
    catch {
        Write-RestoreLog "Database restoration failed - $($_.Exception.Message)" -Level "ERROR"
        
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
        
        return $false
    }
}

# Verify restoration
function Test-Restoration {
    $dbName = $env:POSTGRES_DB ?? "aria"
    $dbUser = $env:POSTGRES_USER ?? "aria"
    
    Write-RestoreLog "Verifying database restoration..." -Level "INFO"
    
    try {
        # Check database access
        docker exec $DbContainer psql -U $dbUser -d $dbName -c "SELECT 1;" 2>&1 | Out-Null
        Write-RestoreLog "Database is accessible" -Level "SUCCESS"
        
        # Get table count
        $tableCount = docker exec $DbContainer psql -U $dbUser -d $dbName -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>$null
        $tableCount = $tableCount.Trim()
        
        Write-RestoreLog "Tables in database - $tableCount" -Level "INFO"
        
        if ([int]$tableCount -gt 0) {
            Write-RestoreLog "Database restoration verified" -Level "SUCCESS"
            return $true
        }
        else {
            Write-RestoreLog "Database appears to be empty" -Level "WARN"
            return $false
        }
    }
    catch {
        Write-RestoreLog "Database verification failed - $($_.Exception.Message)" -Level "ERROR"
        return $false
    }
}

# Rollback restoration
function Invoke-Rollback {
    param([string]$PreRestoreBackup)
    
    Write-RestoreLog "Rolling back to pre-restore state..." -Level "WARN"
    
    $backupFile = "$PreRestoreBackup\database-pre-restore.sql.zip"
    
    if (Test-Path $backupFile) {
        Write-RestoreLog "Restoring from pre-restore backup..." -Level "INFO"
        
        $dbName = $env:POSTGRES_DB ?? "aria"
        $dbUser = $env:POSTGRES_USER ?? "aria"
        
        try {
            # Decompress
            Expand-Archive -Path $backupFile -DestinationPath $env:TEMP -Force
            $tempSql = "$env:TEMP\database-pre-restore.sql"
            
            # Restore
            Stop-DatabaseConnections
            docker exec $DbContainer psql -U $dbUser -d postgres -c "DROP DATABASE IF EXISTS $dbName;" 2>&1 | Out-Null
            docker exec $DbContainer psql -U $dbUser -d postgres -c "CREATE DATABASE $dbName;" 2>&1 | Out-Null
            Get-Content $tempSql | docker exec -i $DbContainer psql -U $dbUser -d $dbName 2>&1 | Out-Null
            
            Remove-Item $tempSql -Force
            
            Write-RestoreLog "Rollback completed" -Level "SUCCESS"
        }
        catch {
            Write-RestoreLog "Rollback failed - $($_.Exception.Message)" -Level "ERROR"
        }
    }
    else {
        Write-RestoreLog "Pre-restore backup not found, cannot rollback" -Level "ERROR"
    }
}

# Main function
function Main {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   Aria ERP Database Restoration" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check admin privileges
    if (-not (Test-Administrator)) {
        Write-RestoreLog "This script must be run as Administrator" -Level "ERROR"
        exit 1
    }
    
    # Check Docker
    try {
        $null = docker ps 2>&1
    }
    catch {
        Write-RestoreLog "Docker is not running" -Level "ERROR"
        exit 1
    }
    
    # Check if database container is running
    $running = docker ps --format "{{.Names}}" 2>$null
    if ($running -notcontains $DbContainer) {
        Write-RestoreLog "Database container is not running" -Level "ERROR"
        Write-RestoreLog "Start the container with: docker start $DbContainer" -Level "INFO"
        exit 1
    }
    
    # Detect backup location
    $backupBase = $null
    $possiblePaths = @(
        "C:\Program Files\AriaERP\backups",
        "$env:USERPROFILE\Documents\AriaERP\backups"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $backups = Get-ChildItem $path -Directory -Filter "aria-erp-backup-*" -ErrorAction SilentlyContinue
            if ($backups.Count -gt 0) {
                $backupBase = $path
                break
            }
        }
    }
    
    if (-not $backupBase) {
        Write-RestoreLog "Cannot find backup directory" -Level "ERROR"
        exit 1
    }
    
    # Select backup
    $selectedBackup = Select-Backup -BackupBase $backupBase
    if (-not $selectedBackup) {
        exit 1
    }
    
    Write-RestoreLog "Selected backup - $selectedBackup" -Level "INFO"
    
    # Verify backup
    if (-not (Test-BackupIntegrity -BackupDir $selectedBackup)) {
        Write-RestoreLog "Backup verification failed" -Level "ERROR"
        exit 1
    }
    
    # Confirm restoration
    if (-not $Force) {
        Write-Host ""
        Write-RestoreLog "WARNING: This will replace your current database!" -Level "WARN"
        Write-RestoreLog "All current data will be lost unless you have a backup." -Level "WARN"
        Write-Host ""
        Confirm-Action "Are you sure you want to proceed with database restoration?"
    }
    
    # Create pre-restore backup
    $preRestoreBackup = New-PreRestoreBackup
    
    # Perform restoration
    if (Restore-Database -BackupDir $selectedBackup) {
        if (Test-Restoration) {
            Write-RestoreLog "Database restoration completed successfully!" -Level "SUCCESS"
            Write-RestoreLog "Pre-restore backup saved at - $preRestoreBackup" -Level "INFO"
        }
        else {
            Write-RestoreLog "Database restoration verification failed" -Level "ERROR"
            
            if (-not $Force) {
                Confirm-Action "Do you want to rollback to previous state?"
                Invoke-Rollback -PreRestoreBackup $preRestoreBackup
            }
            
            exit 1
        }
    }
    else {
        Write-RestoreLog "Database restoration failed" -Level "ERROR"
        
        if (-not $Force) {
            Confirm-Action "Do you want to rollback to previous state?"
            Invoke-Rollback -PreRestoreBackup $preRestoreBackup
        }
        
        exit 1
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-RestoreLog "Restoration process completed" -Level "SUCCESS"
    Write-Host "========================================" -ForegroundColor Cyan
}

# Add required assembly for ZIP handling
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Run main function
Main
