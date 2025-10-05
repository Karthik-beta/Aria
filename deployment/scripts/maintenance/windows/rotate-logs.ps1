# Aria ERP Log Rotation Script for Windows
# This script rotates application logs and cleans up old log files
# Run this script via Task Scheduler for automatic log management

param(
    [int]$RetentionDays = 30,
    [bool]$CompressLogs = $true
)

# Set error action preference
$ErrorActionPreference = "Continue"

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DeploymentDir = Split-Path -Parent $ScriptDir
$LogsDir = Join-Path $DeploymentDir "logs"

# Colors for output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to rotate Traefik access logs
function Rotate-TraefikLogs {
    $TraefikLogDir = Join-Path $LogsDir "traefik"
    
    if (-not (Test-Path $TraefikLogDir)) {
        Write-Warn "Traefik log directory not found: $TraefikLogDir"
        return
    }
    
    Write-Info "Rotating Traefik logs..."
    
    # Find and rotate access.log if it exists and is larger than 100MB
    $AccessLog = Join-Path $TraefikLogDir "access.log"
    if (Test-Path $AccessLog) {
        $FileSize = (Get-Item $AccessLog).Length
        $MaxSize = 100 * 1024 * 1024  # 100MB
        
        if ($FileSize -gt $MaxSize) {
            $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $RotatedLog = Join-Path $TraefikLogDir "access-$Timestamp.log"
            
            Write-Info "Traefik access.log is larger than 100MB, rotating..."
            
            Move-Item -Path $AccessLog -Destination $RotatedLog -Force
            
            # Signal Traefik to reopen log file
            try {
                docker kill -s USR1 aria-proxy 2>$null
            } catch {
                Write-Warn "Could not signal Traefik container"
            }
            
            # Compress rotated log if enabled
            if ($CompressLogs) {
                Start-Job -ScriptBlock {
                    param($LogFile)
                    Compress-Archive -Path $LogFile -DestinationPath "$LogFile.zip" -Force
                    Remove-Item -Path $LogFile -Force
                } -ArgumentList $RotatedLog | Out-Null
            }
        }
    }
}

# Function to rotate PostgreSQL logs
function Rotate-PostgresLogs {
    $PostgresLogDir = Join-Path $LogsDir "postgres"
    
    if (-not (Test-Path $PostgresLogDir)) {
        Write-Warn "PostgreSQL log directory not found: $PostgresLogDir"
        return
    }
    
    Write-Info "Checking PostgreSQL logs..."
    # PostgreSQL handles its own rotation via log_rotation_age and log_rotation_size
    # We just need to clean up old files
}

# Function to rotate backend application logs
function Rotate-BackendLogs {
    $BackendLogDir = Join-Path $LogsDir "backend"
    
    if (-not (Test-Path $BackendLogDir)) {
        Write-Warn "Backend log directory not found: $BackendLogDir"
        return
    }
    
    Write-Info "Rotating backend logs..."
    
    # Rotate any .log files larger than 50MB
    Get-ChildItem -Path $BackendLogDir -Filter "*.log" -File | ForEach-Object {
        $FileSize = $_.Length
        $MaxSize = 50 * 1024 * 1024  # 50MB
        
        if ($FileSize -gt $MaxSize) {
            $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $FileName = $_.BaseName
            $DirName = $_.DirectoryName
            $RotatedLog = Join-Path $DirName "$FileName-$Timestamp.log"
            
            Write-Info "Rotating $($_.Name)..."
            Move-Item -Path $_.FullName -Destination $RotatedLog -Force
            
            # Compress rotated log if enabled
            if ($CompressLogs) {
                Start-Job -ScriptBlock {
                    param($LogFile)
                    Compress-Archive -Path $LogFile -DestinationPath "$LogFile.zip" -Force
                    Remove-Item -Path $LogFile -Force
                } -ArgumentList $RotatedLog | Out-Null
            }
        }
    }
}

# Function to clean up old logs based on retention policy
function Cleanup-OldLogs {
    Write-Info "Cleaning up logs older than $RetentionDays days..."
    
    if (-not (Test-Path $LogsDir)) {
        Write-Warn "Logs directory not found: $LogsDir"
        return
    }
    
    $CutoffDate = (Get-Date).AddDays(-$RetentionDays)
    $DeletedCount = 0
    
    # Delete old .log files
    Get-ChildItem -Path $LogsDir -Filter "*.log" -File -Recurse | Where-Object {
        $_.LastWriteTime -lt $CutoffDate
    } | ForEach-Object {
        Write-Info "Deleting old log: $($_.Name)"
        Remove-Item -Path $_.FullName -Force
        $DeletedCount++
    }
    
    # Delete old .log.gz and .log.zip files
    Get-ChildItem -Path $LogsDir -Include "*.log.gz", "*.log.zip" -File -Recurse | Where-Object {
        $_.LastWriteTime -lt $CutoffDate
    } | ForEach-Object {
        Write-Info "Deleting old compressed log: $($_.Name)"
        Remove-Item -Path $_.FullName -Force
        $DeletedCount++
    }
    
    if ($DeletedCount -eq 0) {
        Write-Info "No old logs to delete"
    } else {
        Write-Info "Deleted $DeletedCount old log file(s)"
    }
}

# Function to display disk usage
function Show-DiskUsage {
    Write-Info "Current disk usage for logs directory:"
    
    if (Test-Path $LogsDir) {
        $Size = (Get-ChildItem -Path $LogsDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
        $SizeMB = [math]::Round($Size / 1MB, 2)
        $SizeGB = [math]::Round($Size / 1GB, 2)
        
        if ($SizeGB -ge 1) {
            Write-Host "  $SizeGB GB" -ForegroundColor Cyan
        } else {
            Write-Host "  $SizeMB MB" -ForegroundColor Cyan
        }
    } else {
        Write-Warn "Could not calculate disk usage"
    }
}

# Main execution
function Main {
    Write-Info "=== Aria ERP Log Rotation ==="
    Write-Info "Retention policy: $RetentionDays days"
    Write-Info "Compression enabled: $CompressLogs"
    Write-Host ""
    
    # Check if logs directory exists
    if (-not (Test-Path $LogsDir)) {
        Write-Error-Custom "Logs directory not found: $LogsDir"
        exit 1
    }
    
    # Show disk usage before rotation
    Show-DiskUsage
    Write-Host ""
    
    # Rotate logs for each service
    Rotate-TraefikLogs
    Rotate-PostgresLogs
    Rotate-BackendLogs
    
    # Clean up old logs
    Cleanup-OldLogs
    
    # Wait for background compression jobs to complete
    if ($CompressLogs) {
        Write-Info "Waiting for compression jobs to complete..."
        Get-Job | Wait-Job | Out-Null
        Get-Job | Remove-Job | Out-Null
    }
    
    # Show disk usage after rotation
    Write-Host ""
    Show-DiskUsage
    
    Write-Info "Log rotation completed successfully"
}

# Run main function
Main
