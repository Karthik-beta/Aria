#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Aria ERP Uninstallation Script for Windows

.DESCRIPTION
    Removes Aria ERP installation and associated data.

.PARAMETER InstallPath
    Installation directory (default: C:\Program Files\AriaERP)

.EXAMPLE
    .\uninstall-windows.ps1
#>

[CmdletBinding()]
param(
    [string]$InstallPath = "C:\Program Files\AriaERP"
)

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Confirm-Uninstall {
    Write-Warn "This will remove Aria ERP and all associated data."
    $response = Read-Host "Are you sure you want to continue? (yes/no)"
    
    if ($response -ne "yes") {
        Write-Info "Uninstallation cancelled."
        exit 0
    }
}

function Stop-AriaService {
    Write-Info "Stopping Aria ERP..."
    
    # Stop scheduled task
    $task = Get-ScheduledTask -TaskName "AriaERP" -ErrorAction SilentlyContinue
    if ($task) {
        Stop-ScheduledTask -TaskName "AriaERP" -ErrorAction SilentlyContinue
    }
    
    # Stop Docker containers
    if (Test-Path "$InstallPath\docker-compose.yml") {
        Push-Location $InstallPath
        try {
            docker compose down -v 2>$null
        } finally {
            Pop-Location
        }
    }
    
    Write-Info "Service stopped."
}

function Remove-AriaService {
    Write-Info "Removing scheduled task..."
    
    $task = Get-ScheduledTask -TaskName "AriaERP" -ErrorAction SilentlyContinue
    if ($task) {
        Unregister-ScheduledTask -TaskName "AriaERP" -Confirm:$false
    }
    
    Write-Info "Scheduled task removed."
}

function Remove-Installation {
    Write-Info "Removing installation directory..."
    
    if (Test-Path $InstallPath) {
        Remove-Item -Path $InstallPath -Recurse -Force
    }
    
    Write-Info "Installation directory removed."
}

# Docker engine and Docker Desktop are intentionally NOT removed by this script.

function Uninstall-AriaERP {
    Write-Info "Starting Aria ERP uninstallation..."
    
    if (-not (Test-Administrator)) {
        Write-Error "This script must be run as Administrator."
        exit 1
    }
    
    Confirm-Uninstall
    Stop-AriaService
    Remove-AriaService
    Remove-Installation
    
    # Docker Desktop and host Docker data are preserved by design.

    Write-Info "Aria ERP has been completely removed."
}

# Run uninstallation
Uninstall-AriaERP
