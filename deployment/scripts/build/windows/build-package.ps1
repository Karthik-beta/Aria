#Requires -Version 5.1
<#
.SYNOPSIS
    Aria ERP Package Builder for Windows
    
.DESCRIPTION
    Creates distributable packages for on-premise deployment.
    This is the Windows equivalent of build-package.sh
    
.PARAMETER Version
    Version to build (default: reads from package.json)
    
.EXAMPLE
    .\build-package.ps1
    .\build-package.ps1 -Version "0.2.0"
#>

[CmdletBinding()]
param(
    [string]$Version = ""
)

# Configuration
$ROOT_DIR = (Get-Item $PSScriptRoot).Parent.Parent.FullName
if ([string]::IsNullOrEmpty($Version)) {
    $packageJson = Get-Content "$ROOT_DIR\package.json" | ConvertFrom-Json
    $Version = $packageJson.version
}

$BUILD_DIR = "$ROOT_DIR\dist"
$PACKAGE_NAME = "aria-erp-v$Version"

# Colors
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

# Clean build directory
function Clear-BuildDirectory {
    Write-Info "Cleaning build directory..."
    if (Test-Path $BUILD_DIR) {
        try {
            # Try to remove with retry for locked files
            Remove-Item -Path $BUILD_DIR -Recurse -Force -ErrorAction Stop
        }
        catch {
            Write-Warn "Build directory in use. Cleaning contents only..."
            Get-ChildItem -Path $BUILD_DIR -Recurse | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    
    if (-not (Test-Path $BUILD_DIR)) {
        New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null
    }
}

# Build Docker images
function Build-DockerImages {
    Write-Info "Building Docker images..."
    
    Push-Location $ROOT_DIR
    
    # Build backend
    Write-Info "Building backend image..."
    docker build -t "aria-backend:$Version" -f apps/backend/Dockerfile .
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build backend image"
        exit 1
    }
    
    # Build frontends
    $frontends = @("asset", "crm", "hrms", "inventory")
    foreach ($frontend in $frontends) {
        Write-Info "Building $frontend image..."
        if ($frontend -eq "crm") {
            docker build -t "aria-${frontend}:$Version" -f "apps/frontend/CRM/Dockerfile" .
        } else {
            docker build -t "aria-${frontend}:$Version" -f "apps/frontend/$frontend/Dockerfile" .
        }
        if ($LASTEXITCODE -ne 0) {
            Pop-Location
            Write-Error "Failed to build $frontend image"
            exit 1
        }
    }
    
    Pop-Location
    Write-Info "Docker images built successfully."
}

# Save Docker images
function Save-DockerImages {
    Write-Info "Saving Docker images..."
    
    $imagesDir = "$BUILD_DIR\images"
    New-Item -ItemType Directory -Path $imagesDir -Force | Out-Null
    
    # Save all images
    Write-Info "Saving aria-backend..."
    docker save -o "$imagesDir\aria-backend.tar" "aria-backend:$Version"
    
    Write-Info "Saving aria-asset..."
    docker save -o "$imagesDir\aria-asset.tar" "aria-asset:$Version"
    
    Write-Info "Saving aria-crm..."
    docker save -o "$imagesDir\aria-crm.tar" "aria-crm:$Version"
    
    Write-Info "Saving aria-hrms..."
    docker save -o "$imagesDir\aria-hrms.tar" "aria-hrms:$Version"
    
    Write-Info "Saving aria-inventory..."
    docker save -o "$imagesDir\aria-inventory.tar" "aria-inventory:$Version"
    
    # Also save PostgreSQL and Traefik
    Write-Info "Pulling and saving PostgreSQL..."
    docker pull postgres:18-alpine
    docker save -o "$imagesDir\postgres.tar" postgres:18-alpine
    
    Write-Info "Pulling and saving Traefik..."
    docker pull traefik:v3.5
    docker save -o "$imagesDir\traefik.tar" traefik:v3.5
    
    Write-Info "Docker images saved successfully."
}

# Create package structure
function New-PackageStructure {
    Write-Info "Creating package structure..."
    
    $pkgDir = "$BUILD_DIR\$PACKAGE_NAME"
    
    # Create directories
    New-Item -ItemType Directory -Path "$pkgDir\bin" -Force | Out-Null
    New-Item -ItemType Directory -Path "$pkgDir\config\traefik" -Force | Out-Null
    New-Item -ItemType Directory -Path "$pkgDir\images" -Force | Out-Null
    New-Item -ItemType Directory -Path "$pkgDir\docs" -Force | Out-Null
    
    # Copy installation scripts
    Copy-Item "$ROOT_DIR\deployment\scripts\install\linux\install.sh" "$pkgDir\bin\" -Force
    Copy-Item "$ROOT_DIR\deployment\scripts\install\windows\install.ps1" "$pkgDir\bin\" -Force
    Copy-Item "$ROOT_DIR\deployment\scripts\install\linux\uninstall.sh" "$pkgDir\bin\" -Force
    Copy-Item "$ROOT_DIR\deployment\scripts\install\windows\uninstall.ps1" "$pkgDir\bin\" -Force
    
    # Copy Docker Compose template
    Copy-Item "$ROOT_DIR\deployment\templates\docker-compose.production.yml" "$pkgDir\docker-compose.production.yml" -Force
    
    # Copy environment template
    Copy-Item "$ROOT_DIR\deployment\templates\.env.template" "$pkgDir\.env.template" -Force
    
    # Copy Traefik configuration
    if (Test-Path "$ROOT_DIR\deployment\templates\config\traefik") {
        Copy-Item "$ROOT_DIR\deployment\templates\config\traefik\*" "$pkgDir\config\traefik\" -Force
    }
    
    # Copy Docker images
    Copy-Item "$BUILD_DIR\images\*.tar" "$pkgDir\images\" -Force
    
    # Copy documentation
    if (Test-Path "$ROOT_DIR\deployment\docs") {
        Copy-Item "$ROOT_DIR\deployment\docs\*.md" "$pkgDir\docs\" -Force
    }
    if (Test-Path "$ROOT_DIR\README.md") {
        Copy-Item "$ROOT_DIR\README.md" "$pkgDir\docs\PROJECT_README.md" -Force
    }
    
    # Create VERSION file
    Set-Content -Path "$pkgDir\VERSION" -Value $Version
    
    # Create load-images script for Linux
    $loadImagesLinux = @'
#!/bin/bash
echo "Loading Docker images..."
for img in images/*.tar; do
    echo "Loading $(basename $img)..."
    docker load -i "$img"
done
echo "All images loaded successfully."
'@
    Set-Content -Path "$pkgDir\bin\load-images.sh" -Value $loadImagesLinux
    
    # Create load-images script for Windows
    $loadImagesWindows = @'
Write-Host "Loading Docker images..." -ForegroundColor Green
Get-ChildItem images\*.tar | ForEach-Object {
    Write-Host "Loading $($_.Name)..." -ForegroundColor Yellow
    docker load -i $_.FullName
}
Write-Host "All images loaded successfully." -ForegroundColor Green
'@
    Set-Content -Path "$pkgDir\bin\load-images.ps1" -Value $loadImagesWindows
    
    Write-Info "Package structure created successfully."
}

# Create archives
function New-Archives {
    Write-Info "Creating distribution archives..."
    
    Push-Location $BUILD_DIR
    
    try {
        # Create zip for Windows
        Write-Info "Creating Windows ZIP archive..."
        Compress-Archive -Path $PACKAGE_NAME -DestinationPath "${PACKAGE_NAME}-windows.zip" -Force
        Write-Info "Created ${PACKAGE_NAME}-windows.zip"
        
        # Create tar.gz for Linux (if tar is available)
        if (Get-Command tar -ErrorAction SilentlyContinue) {
            Write-Info "Creating Linux tar.gz archive..."
            tar -czf "${PACKAGE_NAME}-linux.tar.gz" $PACKAGE_NAME
            Write-Info "Created ${PACKAGE_NAME}-linux.tar.gz"
        } else {
            Write-Warn "tar command not found. Skipping Linux archive."
            Write-Info "You can create it on Linux with: tar -czf ${PACKAGE_NAME}-linux.tar.gz $PACKAGE_NAME"
        }
    }
    finally {
        Pop-Location
    }
    
    Write-Info "Distribution archives created successfully."
}

# Generate checksums
function New-Checksums {
    Write-Info "Generating checksums..."
    
    $archives = Get-ChildItem "$BUILD_DIR\*.zip", "$BUILD_DIR\*.tar.gz" -ErrorAction SilentlyContinue
    $checksums = @()
    
    foreach ($archive in $archives) {
        $hash = Get-FileHash -Path $archive.FullName -Algorithm SHA256
        $checksums += "$($hash.Hash)  $($archive.Name)"
    }
    
    if ($checksums.Count -gt 0) {
        Set-Content -Path "$BUILD_DIR\checksums.txt" -Value ($checksums -join "`n")
        Write-Info "Checksums generated in checksums.txt"
    }
}

# Cleanup temporary files
function Remove-TemporaryFiles {
    Write-Info "Cleaning up temporary files..."
    Remove-Item -Path "$BUILD_DIR\images" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$BUILD_DIR\$PACKAGE_NAME" -Recurse -Force -ErrorAction SilentlyContinue
}

# Show summary
function Show-Summary {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "                 Package Build Complete!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "Version: $Version"
    Write-Host "Build Directory: $BUILD_DIR"
    Write-Host ""
    Write-Host "Distribution Packages:"
    Get-ChildItem "$BUILD_DIR\*.zip", "$BUILD_DIR\*.tar.gz" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  - $($_.Name)" -ForegroundColor Cyan
    }
    Write-Host ""
    Write-Host "Installation:"
    Write-Host "  Windows: Extract ZIP and run: .\bin\install-windows.ps1 (as Administrator)" -ForegroundColor Yellow
    Write-Host "  Linux:   Extract tar.gz and run: sudo ./bin/install-linux.sh" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
}

# Main build flow
function Start-Build {
    Write-Info "Starting Aria ERP package build (version: $Version)..."
    
    Clear-BuildDirectory
    Build-DockerImages
    Save-DockerImages
    New-PackageStructure
    New-Archives
    New-Checksums
    Remove-TemporaryFiles
    Show-Summary
}

# Run main function
Start-Build
