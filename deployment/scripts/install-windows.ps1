#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Aria ERP Installation Script for Windows

.DESCRIPTION
    Installs Aria ERP as a Windows service with Docker support.

.PARAMETER InstallPath
    Installation directory (default: C:\Program Files\AriaERP)

.PARAMETER Modules
    Comma-separated modules: asset,crm,hrms,inventory or 'full' (default: full)

.PARAMETER Domain
    Domain name (default: localhost)

.PARAMETER Version
    Version to install (default: latest)

.EXAMPLE
    .\install-windows.ps1 -Modules "asset,crm" -Domain "erp.company.com"
#>

[CmdletBinding()]
param(
    [string]$InstallPath = "C:\Program Files\AriaERP",
    [string]$Modules = "full",
    [string]$Domain = "localhost",
    [string]$Version = "latest"
)

# Color output functions
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

# Check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check dependencies
function Test-Dependencies {
    Write-Info "Checking dependencies..."
    
    $dockerInstalled = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerInstalled) {
        Write-Error "Docker is not installed. Please install Docker Desktop for Windows."
        Write-Info "Download from: https://www.docker.com/products/docker-desktop"
        exit 1
    }
    
    # Check if Docker is running
    try {
        docker version | Out-Null
    } catch {
        Write-Error "Docker is not running. Please start Docker Desktop."
        exit 1
    }
    
    Write-Info "All dependencies are installed."
}

# Create installation directories
function New-InstallationDirectories {
    Write-Info "Creating installation directories..."
    
    $directories = @(
        $InstallPath,
        "$InstallPath\config\traefik",
        "$InstallPath\volumes\postgres",
        "$InstallPath\volumes\traefik",
        "$InstallPath\volumes\uploads",
        "$InstallPath\logs\backend"
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    Write-Info "Directories created successfully."
}

# Copy installation files
function Copy-InstallationFiles {
    Write-Info "Copying configuration files..."
    
    # Copy docker-compose file
    Copy-Item "docker-compose.production.yml" "$InstallPath\docker-compose.yml" -Force
    
    # Copy environment template
    if (-not (Test-Path "$InstallPath\.env")) {
        Copy-Item ".env.template" "$InstallPath\.env" -Force
        Write-Info "Created .env file. Please update the configuration."
    } else {
        Write-Warn ".env file already exists. Skipping..."
    }
    
    # Copy Traefik configuration if exists
    if (Test-Path "config\traefik") {
        Copy-Item "config\traefik\*" "$InstallPath\config\traefik\" -Force -Recurse
    }
}

# Configure environment
function Set-Configuration {
    Write-Info "Configuring environment..."
    
    $envFile = "$InstallPath\.env"
    $envContent = Get-Content $envFile -Raw
    
    # Update configuration
    $envContent = $envContent -replace "DOMAIN=.*", "DOMAIN=$Domain"
    $envContent = $envContent -replace "LICENSED_MODULES=.*", "LICENSED_MODULES=$Modules"
    $envContent = $envContent -replace "VERSION=.*", "VERSION=$Version"
    
    # Generate secure password if default is present
    if ($envContent -match "changeme_secure_password") {
        $password = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
        $envContent = $envContent -replace "POSTGRES_PASSWORD=.*", "POSTGRES_PASSWORD=$password"
        Write-Info "Generated secure database password."
    }
    
    Set-Content -Path $envFile -Value $envContent
}

# Install Windows service using NSSM (simplified approach)
function Install-AriaService {
    Write-Info "Installing Aria ERP service..."
    
    # Create a wrapper script
    $wrapperScript = @"
@echo off
cd /d "$InstallPath"
docker compose --env-file .env up -d
"@
    
    Set-Content -Path "$InstallPath\start-aria.bat" -Value $wrapperScript
    
    # Create scheduled task for auto-start
    $action = New-ScheduledTaskAction -Execute "$InstallPath\start-aria.bat"
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    
    Register-ScheduledTask -TaskName "AriaERP" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    
    Write-Info "Service installed successfully."
}

# Start the service
function Start-AriaService {
    Write-Info "Starting Aria ERP..."
    
    Push-Location $InstallPath
    try {
        docker compose --env-file .env up -d
        
        Write-Info "Waiting for services to start..."
        Start-Sleep -Seconds 10
        
        # Check if containers are running
        $containers = docker compose ps --format json | ConvertFrom-Json
        if ($containers) {
            Write-Info "Aria ERP started successfully!"
        } else {
            Write-Error "Failed to start Aria ERP. Check Docker Desktop for details."
        }
    } finally {
        Pop-Location
    }
}

# Show completion message
function Show-CompletionMessage {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "                 Aria ERP Installation Complete!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installation Directory: $InstallPath"
    Write-Host "Domain: $Domain"
    Write-Host "Modules: $Modules"
    Write-Host ""
    Write-Host "Service Management:"
    Write-Host "  Start:   Start-ScheduledTask -TaskName 'AriaERP'"
    Write-Host "  Stop:    docker compose -f '$InstallPath\docker-compose.yml' down"
    Write-Host "  Status:  docker compose -f '$InstallPath\docker-compose.yml' ps"
    Write-Host ""
    Write-Host "Configuration File: $InstallPath\.env"
    Write-Host ""
    Write-Host "Important:" -ForegroundColor Yellow
    Write-Host "- Update the .env file with your configuration"
    Write-Host "- Configure SSL certificates in: $InstallPath\volumes\traefik\"
    Write-Host "- Backend API: https://$Domain/api"
    Write-Host "- Frontends: https://[module].$Domain (e.g., https://asset.$Domain)"
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
}

# Main installation flow
function Install-AriaERP {
    Write-Info "Starting Aria ERP installation..."
    
    if (-not (Test-Administrator)) {
        Write-Error "This script must be run as Administrator."
        exit 1
    }
    
    Test-Dependencies
    New-InstallationDirectories
    Copy-InstallationFiles
    Set-Configuration
    Install-AriaService
    Start-AriaService
    Show-CompletionMessage
}

# Run installation
Install-AriaERP
