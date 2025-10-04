# Aria ERP - Backup Manager (Windows)
# Automated backup system with smart storage detection and rotation

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Configuration
$BackupRetentionDays = [int]($env:BACKUP_RETENTION_DAYS ?? 7)
$BackupCompression = $env:BACKUP_COMPRESSION ?? "zip"
$ComposeFile = $env:COMPOSE_FILE ?? "C:\Program Files\AriaERP\docker-compose.yml"
$EnvFile = $env:ENV_FILE ?? "C:\Program Files\AriaERP\.env"

# Logging functions
function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR", "SUCCESS")]
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "INFO"    { "Green" }
        "WARN"    { "Yellow" }
        "ERROR"   { "Red" }
        "SUCCESS" { "Cyan" }
    }
    
    Write-Host "[$Level] " -ForegroundColor $color -NoNewline
    Write-Host "$timestamp - $Message"
}

# Check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Detect backup storage location
function Get-BackupStorage {
    Write-Log "Detecting backup storage location..." -Level "INFO"
    
    $storageScript = Join-Path $ScriptDir "detect-storage.ps1"
    
    try {
        $result = & $storageScript
        if ($LASTEXITCODE -ne 0) {
            throw "Storage detection failed"
        }
        return $result
    }
    catch {
        Write-Log "Failed to detect suitable backup storage: $($_.Exception.Message)" -Level "ERROR"
        return $null
    }
}

# Create backup directory structure
function New-BackupDirectory {
    param([string]$BackupBase)
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = Join-Path $BackupBase "aria-erp-backup-$timestamp"
    
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    return $backupDir
}

# Backup database
function Backup-Database {
    param([string]$BackupDir)
    
    Write-Log "Backing up PostgreSQL database..." -Level "INFO"
    
    $dbContainer = "aria-database"
    
    # Check if database container is running
    $runningContainers = docker ps --format "{{.Names}}" 2>$null
    if ($runningContainers -notcontains $dbContainer) {
        Write-Log "Database container '$dbContainer' is not running" -Level "ERROR"
        return $false
    }
    
    # Get database credentials from environment
    $dbName = $env:POSTGRES_DB ?? "aria"
    $dbUser = $env:POSTGRES_USER ?? "aria"
    
    # Perform database backup
    $dbBackupFile = Join-Path $BackupDir "database.sql"
    
    try {
        docker exec $dbContainer pg_dump -U $dbUser $dbName | Out-File -FilePath $dbBackupFile -Encoding UTF8
        Write-Log "Database backed up to: $dbBackupFile" -Level "SUCCESS"
        
        # Compress if requested
        if ($BackupCompression -eq "zip") {
            $zipFile = "$dbBackupFile.zip"
            Compress-Archive -Path $dbBackupFile -DestinationPath $zipFile -CompressionLevel Optimal
            Remove-Item $dbBackupFile
            Write-Log "Database backup compressed: $zipFile" -Level "INFO"
        }
        
        return $true
    }
    catch {
        Write-Log "Database backup failed: $($_.Exception.Message)" -Level "ERROR"
        return $false
    }
}

# Backup configuration files
function Backup-Config {
    param([string]$BackupDir)
    
    Write-Log "Backing up configuration files..." -Level "INFO"
    
    $configBackupDir = Join-Path $BackupDir "config"
    New-Item -ItemType Directory -Path $configBackupDir -Force | Out-Null
    
    try {
        # Backup environment file
        if (Test-Path $EnvFile) {
            Copy-Item $EnvFile -Destination (Join-Path $configBackupDir ".env")
            Write-Log "Backed up .env file" -Level "INFO"
        }
        
        # Backup docker-compose file
        if (Test-Path $ComposeFile) {
            Copy-Item $ComposeFile -Destination (Join-Path $configBackupDir "docker-compose.yml")
            Write-Log "Backed up docker-compose.yml" -Level "INFO"
        }
        
        # Backup Traefik configuration
        $traefikConfig = "C:\Program Files\AriaERP\config\traefik"
        if (Test-Path $traefikConfig) {
            Copy-Item $traefikConfig -Destination $configBackupDir -Recurse
            Write-Log "Backed up Traefik configuration" -Level "INFO"
        }
        
        Write-Log "Configuration files backed up" -Level "SUCCESS"
        return $true
    }
    catch {
        Write-Log "Configuration backup failed: $($_.Exception.Message)" -Level "ERROR"
        return $false
    }
}

# Create backup manifest
function New-BackupManifest {
    param([string]$BackupDir)
    
    $manifestFile = Join-Path $BackupDir "backup-manifest.txt"
    
    $manifest = @"
Aria ERP Backup Manifest
========================
Backup Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Hostname: $env:COMPUTERNAME
Backup Directory: $BackupDir

Contents:
"@
    
    Get-ChildItem -Path $BackupDir -Recurse -File | ForEach-Object {
        $relativePath = $_.FullName.Replace($BackupDir, "").TrimStart("\")
        $size = "{0:N2} MB" -f ($_.Length / 1MB)
        $manifest += "`n  - $relativePath ($size)"
    }
    
    $manifest | Out-File -FilePath $manifestFile -Encoding UTF8
    Write-Log "Backup manifest created" -Level "INFO"
}

# Cleanup old backups
function Remove-OldBackups {
    param([string]$BackupBase)
    
    Write-Log "Cleaning up backups older than $BackupRetentionDays days..." -Level "INFO"
    
    $cutoffDate = (Get-Date).AddDays(-$BackupRetentionDays)
    $deletedCount = 0
    
    Get-ChildItem -Path $BackupBase -Directory -Filter "aria-erp-backup-*" |
        Where-Object { $_.LastWriteTime -lt $cutoffDate } |
        ForEach-Object {
            Write-Log "Deleting old backup: $($_.FullName)" -Level "INFO"
            Remove-Item $_.FullName -Recurse -Force
            $deletedCount++
        }
    
    if ($deletedCount -gt 0) {
        Write-Log "Deleted $deletedCount old backup(s)" -Level "SUCCESS"
    }
    else {
        Write-Log "No old backups to delete" -Level "INFO"
    }
}

# Verify backup integrity
function Test-BackupIntegrity {
    param([string]$BackupDir)
    
    Write-Log "Verifying backup integrity..." -Level "INFO"
    
    # Check if database backup exists
    $dbBackup = Get-ChildItem -Path $BackupDir -Filter "database.sql*" -File | Select-Object -First 1
    if (-not $dbBackup) {
        Write-Log "Database backup file not found" -Level "ERROR"
        return $false
    }
    
    # Check if config directory exists
    $configDir = Join-Path $BackupDir "config"
    if (-not (Test-Path $configDir)) {
        Write-Log "Configuration backup directory not found" -Level "ERROR"
        return $false
    }
    
    # Check if manifest exists
    $manifestFile = Join-Path $BackupDir "backup-manifest.txt"
    if (-not (Test-Path $manifestFile)) {
        Write-Log "Backup manifest not found" -Level "ERROR"
        return $false
    }
    
    Write-Log "Backup verification passed" -Level "SUCCESS"
    return $true
}

# Main backup process
function Main {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   Aria ERP Automated Backup System" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check administrator privileges
    if (-not (Test-Administrator)) {
        Write-Log "This script must be run as Administrator" -Level "ERROR"
        exit 1
    }
    
    # Detect storage location
    $storageInfo = Get-BackupStorage
    if (-not $storageInfo) {
        Write-Log "Cannot proceed without valid backup storage" -Level "ERROR"
        exit 1
    }
    
    $storageType = $storageInfo.Split(':')[0]
    $storagePath = $storageInfo.Substring($storageType.Length + 1)
    
    Write-Log "Using backup storage: $storageType at $storagePath" -Level "INFO"
    
    # Create backup directory
    try {
        $backupDir = New-BackupDirectory -BackupBase $storagePath
        Write-Log "Backup directory: $backupDir" -Level "INFO"
    }
    catch {
        Write-Log "Failed to create backup directory: $($_.Exception.Message)" -Level "ERROR"
        exit 1
    }
    
    # Perform backups
    $backupFailed = $false
    
    if (-not (Backup-Database -BackupDir $backupDir)) {
        Write-Log "Database backup failed" -Level "ERROR"
        $backupFailed = $true
    }
    
    if (-not (Backup-Config -BackupDir $backupDir)) {
        Write-Log "Configuration backup failed" -Level "ERROR"
        $backupFailed = $true
    }
    
    # Create manifest
    New-BackupManifest -BackupDir $backupDir
    
    # Verify backup
    if (-not (Test-BackupIntegrity -BackupDir $backupDir)) {
        Write-Log "Backup verification failed" -Level "ERROR"
        $backupFailed = $true
    }
    
    # Cleanup old backups
    Remove-OldBackups -BackupBase $storagePath
    
    # Final status
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    if (-not $backupFailed) {
        Write-Log "Backup completed successfully!" -Level "SUCCESS"
        Write-Log "Backup location: $backupDir" -Level "INFO"
        
        $totalSize = (Get-ChildItem -Path $backupDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
        Write-Log "Total size: $("{0:N2} MB" -f ($totalSize / 1MB))" -Level "INFO"
        exit 0
    }
    else {
        Write-Log "Backup completed with errors" -Level "ERROR"
        exit 1
    }
}

# Run main function
Main
