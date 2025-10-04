# Aria ERP - Configuration Restoration Script (Windows)
# Restores configuration files from backup with validation

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupDirectory,
    
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Configuration
$AriaHome = $env:ARIA_HOME ?? "C:\Program Files\AriaERP"
$BackupSuffix = "pre-restore-$(Get-Date -Format 'yyyyMMdd_HHmmss')"

# Logging functions
function Write-ConfigLog {
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

# Check administrator
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
        Write-ConfigLog "Operation cancelled by user" -Level "WARN"
        exit 0
    }
}

# Backup current configuration
function Backup-CurrentConfig {
    $backupDir = "$AriaHome\config-backups\config-$BackupSuffix"
    
    Write-ConfigLog "Backing up current configuration..." -Level "INFO"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    # Backup .env
    if (Test-Path "$AriaHome\.env") {
        Copy-Item "$AriaHome\.env" "$backupDir\.env"
        Write-ConfigLog "Backed up .env file" -Level "INFO"
    }
    
    # Backup docker-compose.yml
    if (Test-Path "$AriaHome\docker-compose.yml") {
        Copy-Item "$AriaHome\docker-compose.yml" "$backupDir\docker-compose.yml"
        Write-ConfigLog "Backed up docker-compose.yml" -Level "INFO"
    }
    
    # Backup Traefik config
    if (Test-Path "$AriaHome\config\traefik") {
        Copy-Item "$AriaHome\config\traefik" "$backupDir\traefik" -Recurse
        Write-ConfigLog "Backed up Traefik configuration" -Level "INFO"
    }
    
    Write-ConfigLog "Current configuration backed up to - $backupDir" -Level "SUCCESS"
    return $backupDir
}

# Validate configuration
function Test-ConfigValidity {
    param([string]$ConfigDir)
    
    Write-ConfigLog "Validating configuration files..." -Level "INFO"
    
    $validationFailed = $false
    
    # Check .env file
    if (Test-Path "$ConfigDir\.env") {
        $envContent = Get-Content "$ConfigDir\.env" -Raw
        $requiredVars = @("POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD")
        
        foreach ($var in $requiredVars) {
            if ($envContent -notmatch "^$var=") {
                Write-ConfigLog "Missing required variable - $var in .env" -Level "WARN"
                $validationFailed = $true
            }
        }
        
        Write-ConfigLog ".env file structure valid" -Level "SUCCESS"
    }
    else {
        Write-ConfigLog ".env file not found in backup" -Level "ERROR"
        return $false
    }
    
    # Check docker-compose.yml
    if (Test-Path "$ConfigDir\docker-compose.yml") {
        try {
            # Basic YAML syntax check
            $composeContent = Get-Content "$ConfigDir\docker-compose.yml" -Raw
            if ($composeContent -match "^\s*version:" -and $composeContent -match "^\s*services:") {
                Write-ConfigLog "docker-compose.yml structure valid" -Level "SUCCESS"
            }
            else {
                Write-ConfigLog "docker-compose.yml structure invalid" -Level "ERROR"
                return $false
            }
        }
        catch {
            Write-ConfigLog "docker-compose.yml validation failed - $($_.Exception.Message)" -Level "ERROR"
            return $false
        }
    }
    else {
        Write-ConfigLog "docker-compose.yml not found in backup" -Level "ERROR"
        return $false
    }
    
    if ($validationFailed) {
        Write-ConfigLog "Configuration validation completed with warnings" -Level "WARN"
    }
    else {
        Write-ConfigLog "Configuration validation passed" -Level "SUCCESS"
    }
    
    return $true
}

# Restore .env file
function Restore-EnvFile {
    param(
        [string]$SourceFile,
        [string]$TargetFile = "$AriaHome\.env"
    )
    
    Write-ConfigLog "Restoring .env file..." -Level "INFO"
    
    Copy-Item $SourceFile $TargetFile -Force
    
    # Set file permissions (read-only for non-admins)
    $acl = Get-Acl $TargetFile
    $acl.SetAccessRuleProtection($true, $false)
    $adminRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        "Administrators", "FullControl", "Allow"
    )
    $acl.SetAccessRule($adminRule)
    Set-Acl $TargetFile $acl
    
    Write-ConfigLog ".env file restored" -Level "SUCCESS"
}

# Restore docker-compose.yml
function Restore-ComposeFile {
    param(
        [string]$SourceFile,
        [string]$TargetFile = "$AriaHome\docker-compose.yml"
    )
    
    Write-ConfigLog "Restoring docker-compose.yml..." -Level "INFO"
    
    Copy-Item $SourceFile $TargetFile -Force
    
    Write-ConfigLog "docker-compose.yml restored" -Level "SUCCESS"
}

# Restore Traefik configuration
function Restore-TraefikConfig {
    param(
        [string]$SourceDir,
        [string]$TargetDir = "$AriaHome\config\traefik"
    )
    
    Write-ConfigLog "Restoring Traefik configuration..." -Level "INFO"
    
    # Create directory if it doesn't exist
    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }
    
    # Copy files
    Copy-Item "$SourceDir\*" $TargetDir -Recurse -Force
    
    Write-ConfigLog "Traefik configuration restored" -Level "SUCCESS"
}

# Restart services
function Restart-Services {
    Write-ConfigLog "Restarting Aria ERP services..." -Level "INFO"
    
    Push-Location $AriaHome
    
    try {
        # Check if services are running
        $runningServices = docker-compose ps -q 2>$null
        if ($runningServices) {
            Write-ConfigLog "Stopping services..." -Level "INFO"
            docker-compose down 2>&1 | Out-Null
        }
        
        Write-ConfigLog "Starting services with new configuration..." -Level "INFO"
        docker-compose up -d 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-ConfigLog "Services restarted successfully" -Level "SUCCESS"
            Pop-Location
            return $true
        }
        else {
            Write-ConfigLog "Failed to start services" -Level "ERROR"
            Pop-Location
            return $false
        }
    }
    catch {
        Write-ConfigLog "Error restarting services - $($_.Exception.Message)" -Level "ERROR"
        Pop-Location
        return $false
    }
}

# Rollback configuration
function Invoke-ConfigRollback {
    param([string]$BackupDir)
    
    Write-ConfigLog "Rolling back configuration..." -Level "WARN"
    
    if (Test-Path $BackupDir) {
        try {
            # Restore from backup
            if (Test-Path "$BackupDir\.env") {
                Copy-Item "$BackupDir\.env" "$AriaHome\.env" -Force
            }
            
            if (Test-Path "$BackupDir\docker-compose.yml") {
                Copy-Item "$BackupDir\docker-compose.yml" "$AriaHome\docker-compose.yml" -Force
            }
            
            if (Test-Path "$BackupDir\traefik") {
                Copy-Item "$BackupDir\traefik\*" "$AriaHome\config\traefik\" -Recurse -Force
            }
            
            Write-ConfigLog "Configuration rolled back" -Level "SUCCESS"
            Restart-Services | Out-Null
        }
        catch {
            Write-ConfigLog "Rollback failed - $($_.Exception.Message)" -Level "ERROR"
        }
    }
    else {
        Write-ConfigLog "Backup directory not found, cannot rollback" -Level "ERROR"
    }
}

# Main function
function Main {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   Aria ERP Configuration Restoration" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check admin privileges
    if (-not (Test-Administrator)) {
        Write-ConfigLog "This script must be run as Administrator" -Level "ERROR"
        exit 1
    }
    
    # Check if backup directory exists
    if (-not (Test-Path $BackupDirectory)) {
        Write-ConfigLog "Backup directory not found - $BackupDirectory" -Level "ERROR"
        exit 1
    }
    
    # Check if config directory exists in backup
    $configBackupDir = Join-Path $BackupDirectory "config"
    if (-not (Test-Path $configBackupDir)) {
        Write-ConfigLog "Configuration backup not found in - $BackupDirectory" -Level "ERROR"
        exit 1
    }
    
    Write-ConfigLog "Using configuration from - $configBackupDir" -Level "INFO"
    
    # Validate configuration
    if (-not (Test-ConfigValidity -ConfigDir $configBackupDir)) {
        Write-ConfigLog "Configuration validation failed" -Level "ERROR"
        exit 1
    }
    
    # Confirm restoration
    if (-not $Force) {
        Write-Host ""
        Write-ConfigLog "WARNING: This will replace your current configuration!" -Level "WARN"
        Write-Host ""
        Confirm-Action "Are you sure you want to proceed with configuration restoration?"
    }
    
    # Backup current configuration
    $currentBackup = Backup-CurrentConfig
    
    # Restore configuration files
    try {
        if (Test-Path "$configBackupDir\.env") {
            Restore-EnvFile -SourceFile "$configBackupDir\.env"
        }
        
        if (Test-Path "$configBackupDir\docker-compose.yml") {
            Restore-ComposeFile -SourceFile "$configBackupDir\docker-compose.yml"
        }
        
        if (Test-Path "$configBackupDir\traefik") {
            Restore-TraefikConfig -SourceDir "$configBackupDir\traefik"
        }
        
        # Restart services
        if (-not (Restart-Services)) {
            Write-ConfigLog "Failed to restart services with new configuration" -Level "ERROR"
            
            if (-not $Force) {
                Confirm-Action "Do you want to rollback to previous configuration?"
                Invoke-ConfigRollback -BackupDir $currentBackup
            }
            
            exit 1
        }
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-ConfigLog "Configuration restoration completed!" -Level "SUCCESS"
        Write-ConfigLog "Previous configuration backed up to - $currentBackup" -Level "INFO"
        Write-Host "========================================" -ForegroundColor Cyan
    }
    catch {
        Write-ConfigLog "Configuration restoration failed - $($_.Exception.Message)" -Level "ERROR"
        
        if (-not $Force) {
            Confirm-Action "Do you want to rollback to previous configuration?"
            Invoke-ConfigRollback -BackupDir $currentBackup
        }
        
        exit 1
    }
}

# Run main function
Main
