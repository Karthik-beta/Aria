# Aria ERP Installation Script for Windows
# This script installs and configures Aria ERP on a Windows system
# Requires: PowerShell 5.1+ and Administrator privileges

#Requires -Version 5.1
#Requires -RunAsAdministrator

param(
    [string]$InstallPath = "C:\aria",
    [switch]$SkipBuild = $false,
    [switch]$FromSource = $false,
    [switch]$Help = $false
)

# Display help
if ($Help) {
    Write-Host @"
Aria ERP Installation Script for Windows

Usage:
    .\install-windows.ps1 [-InstallPath <path>] [-SkipBuild] [-FromSource] [-Help]

Parameters:
    -InstallPath <path>  Installation directory (default: C:\aria)
    -SkipBuild           Skip preparing Docker images (use images already present)
    -FromSource          Build the images from source instead of downloading
                         the prebuilt ones from GitHub Container Registry
    -Help                Display this help message

Example:
    .\install-windows.ps1 -InstallPath "D:\Applications\Aria"

"@
    exit 0
}

# Set error action preference
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Configuration
$ServiceName = "AriaERP"
$WinSWUrl = "https://github.com/winsw/winsw/releases/latest/download/WinSW-x64.exe"
$MinDockerVersion = [version]"24.0"
$MinComposeVersion = [version]"2.20"

# Logging functions
function Write-InfoLog {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-WarnLog {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-ErrorLog {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-StepLog {
    param([string]$Message)
    Write-Host "==> $Message" -ForegroundColor Cyan
}

# Check system requirements
function Test-SystemRequirements {
    Write-StepLog "Checking system requirements..."
    
    # Check Docker
    try {
        $dockerVersion = (docker --version | Select-String -Pattern '(\d+\.\d+)').Matches[0].Value
        Write-InfoLog "Docker version: $dockerVersion"
        
        if ([version]$dockerVersion -lt $MinDockerVersion) {
            throw "Docker version $dockerVersion is below minimum required version $MinDockerVersion"
        }
    }
    catch {
        Write-ErrorLog "Docker is not installed or not accessible"
        Write-InfoLog "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/"
        exit 1
    }
    
    # Check Docker Compose
    try {
        $composeVersion = (docker compose version | Select-String -Pattern '(\d+\.\d+)').Matches[0].Value
        Write-InfoLog "Docker Compose version: $composeVersion"
        
        if ([version]$composeVersion -lt $MinComposeVersion) {
            throw "Docker Compose version $composeVersion is below minimum required version $MinComposeVersion"
        }
    }
    catch {
        Write-ErrorLog "Docker Compose is not installed or not accessible"
        Write-InfoLog "Please ensure Docker Desktop is running"
        exit 1
    }
    
    # Check disk space (minimum 20GB)
    $drive = Split-Path -Qualifier $InstallPath
    $disk = Get-PSDrive -Name $drive.TrimEnd(':')
    $freeSpaceGB = [math]::Round($disk.Free / 1GB, 2)
    
    if ($freeSpaceGB -lt 20) {
        Write-WarnLog "Less than 20GB disk space available ($freeSpaceGB GB free)"
    }
    else {
        Write-InfoLog "Available disk space: $freeSpaceGB GB"
    }
    
    # Check memory (minimum 4GB)
    $totalMemGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
    if ($totalMemGB -lt 4) {
        Write-WarnLog "Less than 4GB RAM available (recommended: 8GB)"
    }
    else {
        Write-InfoLog "Total RAM: $totalMemGB GB"
    }
    
    Write-InfoLog "✓ System requirements check passed"
}

# Image tag matching the source being installed: X.Y.Z on a release tag,
# sha-<commit> on any other commit, empty when unknown or locally changed
function Get-ImageVersion {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { return '' }
    $ErrorActionPreference = 'Continue'
    & git rev-parse --git-dir 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { return '' }
    $changes = @(& git status --porcelain -- apps packages package.json bun.lock turbo.json tsconfig.base.json 2>$null)
    if ($changes.Count -gt 0) {
        Write-WarnLog "Application sources have local changes; prebuilt images will not match them"
        return ''
    }
    $tag = (& git describe --tags --exact-match --match 'v[0-9]*' 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -eq 0 -and $tag -ne '') { return $tag.Substring(1) }
    return "sha-$((& git rev-parse HEAD 2>$null | Out-String).Trim())"
}

# Create installation directory
function New-InstallDirectory {
    Write-StepLog "Creating installation directory..."
    
    if (Test-Path $InstallPath) {
        Write-WarnLog "Installation directory already exists: $InstallPath"
        $response = Read-Host "Do you want to continue? This will overwrite existing files. (y/N)"
        
        if ($response -ne 'y' -and $response -ne 'Y') {
            Write-ErrorLog "Installation cancelled"
            exit 1
        }
        
        $backupPath = "$InstallPath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Write-InfoLog "Backing up existing installation to: $backupPath"
        Move-Item -Path $InstallPath -Destination $backupPath -Force
    }
    
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    Write-InfoLog "✓ Installation directory created: $InstallPath"
}

# Copy application files
function Copy-ApplicationFiles {
    Write-StepLog "Copying application files..."
    
    $currentDir = Get-Location
    Copy-Item -Path "$currentDir\*" -Destination $InstallPath -Recurse -Force -Exclude @(".git", "node_modules", ".next", "dist", "*.backup.*")
    
    Write-InfoLog "✓ Application files copied"
}

# Configure environment
function Set-Environment {
    Write-StepLog "Configuring environment..."
    
    $envPath = Join-Path $InstallPath ".env"
    $envTemplatePath = Join-Path $InstallPath ".env.production.template"
    
    if (-not (Test-Path $envPath)) {
        if (Test-Path $envTemplatePath) {
            Copy-Item -Path $envTemplatePath -Destination $envPath
            if ($script:ImageVersion -ne '') {
                $envContent = (Get-Content $envPath) -replace '^VERSION=.*', "VERSION=$script:ImageVersion"
                Set-Content -Path $envPath -Value $envContent
            }
            Write-WarnLog "Environment file created from template"
            Write-WarnLog "IMPORTANT: Edit $envPath and set all required values"
            Write-WarnLog "Especially: POSTGRES_PASSWORD, REDIS_PASSWORD, BETTER_AUTH_SECRET, DOMAIN"
        }
        else {
            Write-ErrorLog "Environment template not found"
            exit 1
        }
    }
    else {
        Write-InfoLog "Existing environment file found, keeping it"
    }
    
    Write-InfoLog "✓ Environment configured"
}

# Generate SSL certificates
function New-SSLCertificates {
    Write-StepLog "Generating SSL certificates..."
    
    $certPath = Join-Path $InstallPath "deployment\caddy\certs\server.crt"
    
    if (Test-Path $certPath) {
        Write-InfoLog "SSL certificates already exist, skipping generation"
        return
    }
    
    $scriptPath = Join-Path $InstallPath "deployment\ssl\generate-certs.ps1"
    
    if (Test-Path $scriptPath) {
        $certDir = Join-Path $InstallPath "deployment\caddy\certs"
        $domain = $env:DOMAIN
        if (-not $domain) { $domain = "localhost" }
        
        & $scriptPath -CertDir $certDir -Domain $domain
        
        Write-InfoLog "✓ SSL certificates generated"
    }
    else {
        Write-WarnLog "Certificate generation script not found, skipping"
    }
}

# Download the prebuilt images (VERSION in .env); build from source when they
# are unavailable or -FromSource is given
function Build-DockerImages {
    if ($SkipBuild) {
        Write-InfoLog "Skipping Docker image preparation (using images already present)"
        return
    }
    
    Write-StepLog "Preparing Docker images..."
    
    Push-Location $InstallPath
    
    try {
        # Pull base images
        Write-InfoLog "Pulling base images..."
        & docker compose -f docker-compose.production.yml pull --quiet --ignore-buildable 2>&1 | Out-Null
        
        if (-not $FromSource) {
            Write-InfoLog "Downloading prebuilt application images..."
            & docker compose -f docker-compose.production.yml pull --quiet frontend backend migrate
            if ($LASTEXITCODE -eq 0) {
                Write-InfoLog "✓ Prebuilt images downloaded"
                return
            }
            Write-WarnLog "Prebuilt images for VERSION in $InstallPath\.env are not available, building from source"
        }
        
        # Build custom images
        Write-InfoLog "Building application images (this may take a while)..."
        & docker compose -f docker-compose.production.yml build --no-cache
        
        if ($LASTEXITCODE -ne 0) {
            throw "Docker build failed"
        }
        
        Write-InfoLog "✓ Docker images built successfully"
    }
    finally {
        Pop-Location
    }
}

# Install Windows service
function Install-WindowsService {
    Write-StepLog "Installing Windows service..."
    
    # Download WinSW if not present
    $winswPath = Join-Path $InstallPath "$ServiceName.exe"
    
    if (-not (Test-Path $winswPath)) {
        Write-InfoLog "Downloading WinSW..."
        try {
            Invoke-WebRequest -Uri $WinSWUrl -OutFile $winswPath -UseBasicParsing
        }
        catch {
            Write-ErrorLog "Failed to download WinSW"
            Write-InfoLog "Please download manually from: $WinSWUrl"
            Write-InfoLog "And place it at: $winswPath"
            exit 1
        }
    }
    
    # Copy service configuration
    $serviceXml = Join-Path $InstallPath "deployment\windows\aria-erp.xml"
    $serviceConfig = Join-Path $InstallPath "$ServiceName.xml"
    
    if (Test-Path $serviceXml) {
        # Update paths in XML
        $xmlContent = Get-Content $serviceXml -Raw
        $xmlContent = $xmlContent -replace 'C:\\aria', $InstallPath
        Set-Content -Path $serviceConfig -Value $xmlContent
    }
    else {
        Write-ErrorLog "Service configuration template not found"
        exit 1
    }
    
    # Stop existing service if running
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-InfoLog "Stopping existing service..."
        & $winswPath stop
        Start-Sleep -Seconds 5
        & $winswPath uninstall
        Start-Sleep -Seconds 2
    }
    
    # Install service
    Write-InfoLog "Installing service..."
    & $winswPath install
    
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorLog "Failed to install service"
        exit 1
    }
    
    Write-InfoLog "✓ Windows service installed"
}

# Start application
function Start-Application {
    Write-StepLog "Starting Aria ERP application..."
    
    $winswPath = Join-Path $InstallPath "$ServiceName.exe"
    
    & $winswPath start
    
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorLog "Failed to start service"
        Write-InfoLog "Check logs at: $InstallPath\logs"
        exit 1
    }
    
    Write-InfoLog "Waiting for services to start (this may take up to 2 minutes)..."
    Start-Sleep -Seconds 30
    
    Write-InfoLog "✓ Service started successfully"
}

# Health check
function Test-ApplicationHealth {
    Write-StepLog "Performing health check..."
    
    $maxAttempts = 12
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost/health" -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-InfoLog "✓ Health check passed"
                return
            }
        }
        catch {
            # Continue waiting
        }
        
        $attempt++
        Write-InfoLog "Waiting for application to be ready... ($attempt/$maxAttempts)"
        Start-Sleep -Seconds 10
    }
    
    Write-WarnLog "Health check timed out, but service is running"
    Write-InfoLog "Check application logs at: $InstallPath\logs"
}

# Display installation summary
function Show-InstallationSummary {
    $ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Aria ERP Installation Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-InfoLog "Installation directory: $InstallPath"
    Write-InfoLog "Service name: $ServiceName"
    Write-Host ""
    Write-InfoLog "Useful commands:"
    Write-Host "  Start:   sc start $ServiceName"
    Write-Host "  Stop:    sc stop $ServiceName"
    Write-Host "  Status:  sc query $ServiceName"
    Write-Host "  Logs:    Get-Content $InstallPath\logs\*.log -Tail 50 -Wait"
    Write-Host ""
    Write-InfoLog "Docker Compose commands:"
    Write-Host "  Logs:    docker compose -f $InstallPath\docker-compose.production.yml logs -f"
    Write-Host "  Down:    docker compose -f $InstallPath\docker-compose.production.yml down"
    Write-Host "  Restart: docker compose -f $InstallPath\docker-compose.production.yml restart"
    Write-Host ""
    Write-WarnLog "IMPORTANT: Before accessing the application:"
    Write-Host "  1. Edit $InstallPath\.env and set all required values"
    Write-Host "  2. Restart the service: sc stop $ServiceName && sc start $ServiceName"
    Write-Host ""
    Write-InfoLog "Access the application at:"
    Write-Host "  HTTP:  http://$ipAddress"
    Write-Host "  HTTPS: https://$ipAddress"
    Write-Host "  Local: http://localhost"
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
}

# Main installation flow
function Install-AriaERP {
    try {
        Write-InfoLog "Starting Aria ERP installation..."
        Write-Host ""
        
        Test-SystemRequirements
        $script:ImageVersion = Get-ImageVersion
        if ($script:ImageVersion -ne '') { Write-InfoLog "Image version for this source: $script:ImageVersion" }
        New-InstallDirectory
        Copy-ApplicationFiles
        Set-Environment
        New-SSLCertificates
        Build-DockerImages
        Install-WindowsService
        Start-Application
        Test-ApplicationHealth
        Show-InstallationSummary
        
        Write-InfoLog "Installation completed successfully!"
    }
    catch {
        Write-ErrorLog "Installation failed: $_"
        Write-ErrorLog $_.ScriptStackTrace
        exit 1
    }
}

# Run main installation
Install-AriaERP
