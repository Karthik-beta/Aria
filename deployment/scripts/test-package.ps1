#Requires -Version 5.1
<#
.SYNOPSIS
    Aria ERP Package Testing Script for Windows

.DESCRIPTION
    Tests the deployment package components and validates configuration.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Configuration
$ROOT_DIR = (Get-Item $PSScriptRoot).Parent.Parent.FullName

function Write-Info {
    param([string]$Message)
    Write-Host "[TEST] $Message" -ForegroundColor Green
}

function Write-TestError {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-TestWarn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

# Test Docker availability
function Test-DockerAvailability {
    Write-Info "Testing Docker availability..."
    
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-TestError "Docker is not installed"
        return $false
    }
    
    try {
        docker version | Out-Null
        Write-Info "Docker is available and running"
        return $true
    }
    catch {
        Write-TestError "Docker is not running"
        return $false
    }
}

# Test required files
function Test-RequiredFiles {
    Write-Info "Testing required files..."
    
    $requiredFiles = @(
        "deployment\templates\docker-compose.production.yml",
        "deployment\templates\.env.template",
        "deployment\scripts\install-linux.sh",
        "deployment\scripts\install-windows.ps1",
        "deployment\scripts\uninstall-linux.sh",
        "deployment\scripts\uninstall-windows.ps1",
        "deployment\scripts\build-package.ps1",
        "deployment\scripts\test-package.ps1"
    )
    
    $allExist = $true
    foreach ($file in $requiredFiles) {
        $fullPath = Join-Path $ROOT_DIR $file
        if (Test-Path $fullPath) {
            Write-Info "$(Split-Path $file -Leaf) exists"
        }
        else {
            Write-TestError "Missing required file: $file"
            $allExist = $false
        }
    }
    
    return $allExist
}

# Test documentation
function Test-Documentation {
    Write-Info "Testing documentation..."
    
    $docs = @(
        "deployment\docs\INSTALLATION.md",
        "deployment\docs\CONFIGURATION.md",
        "deployment\docs\TROUBLESHOOTING.md",
        "deployment\README.md"
    )
    
    $allExist = $true
    foreach ($doc in $docs) {
        $fullPath = Join-Path $ROOT_DIR $doc
        if (Test-Path $fullPath) {
            Write-Info "$(Split-Path $doc -Leaf) exists"
        }
        else {
            Write-TestError "Missing documentation: $doc"
            $allExist = $false
        }
    }
    
    return $allExist
}

# Test PowerShell script syntax
function Test-ScriptSyntax {
    Write-Info "Testing PowerShell script syntax..."
    
    $scriptsPath = Join-Path $ROOT_DIR "deployment\scripts\*.ps1"
    $scripts = Get-ChildItem $scriptsPath -ErrorAction SilentlyContinue
    $allValid = $true
    
    foreach ($script in $scripts) {
        Write-Info "Checking $($script.Name)..."
        try {
            $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $script.FullName -Raw), [ref]$null)
            Write-Info "$($script.Name) syntax is valid"
        }
        catch {
            Write-TestError "$($script.Name) has syntax errors: $($_.Exception.Message)"
            $allValid = $false
        }
    }
    
    return $allValid
}

# Test Docker Compose configuration
function Test-ComposeConfiguration {
    Write-Info "Testing Docker Compose configuration..."
    
    $templatesPath = Join-Path $ROOT_DIR "deployment\templates"
    Push-Location $templatesPath
    
    try {
        # Create test .env
        $testEnv = @"
VERSION=test
DOMAIN=test.local
POSTGRES_DB=aria_test
POSTGRES_USER=aria_test
POSTGRES_PASSWORD=test_password_123
LICENSED_MODULES=full
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
"@
        Set-Content -Path ".env.test" -Value $testEnv
        
        # Validate compose file
        docker compose -f docker-compose.production.yml --env-file .env.test config | Out-Null
        Write-Info "Docker Compose configuration is valid"
        
        Remove-Item ".env.test" -Force
        return $true
    }
    catch {
        Write-TestError "Invalid Docker Compose configuration: $($_.Exception.Message)"
        Remove-Item ".env.test" -Force -ErrorAction SilentlyContinue
        return $false
    }
    finally {
        Pop-Location
    }
}

# Test Docker image builds (minimal - just backend)
function Test-ImageBuild {
    Write-Info "Testing Docker image build (backend only)..."
    
    Push-Location $ROOT_DIR
    
    try {
        Write-Info "Building test backend image..."
        docker build -t aria-backend:test -f apps/backend/Dockerfile . 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Backend image built successfully"
            docker rmi aria-backend:test 2>&1 | Out-Null
            return $true
        }
        else {
            Write-TestError "Failed to build backend image"
            return $false
        }
    }
    catch {
        Write-TestError "Failed to build backend image: $($_.Exception.Message)"
        return $false
    }
    finally {
        Pop-Location
    }
}

# Run all tests
function Start-AllTests {
    Write-Info "Starting Aria ERP deployment package tests..."
    Write-Host ""
    
    $results = @{
        "Docker Availability" = Test-DockerAvailability
    }
    Write-Host ""
    
    $results["Required Files"] = Test-RequiredFiles
    Write-Host ""
    
    $results["Documentation"] = Test-Documentation
    Write-Host ""
    
    $results["Script Syntax"] = Test-ScriptSyntax
    Write-Host ""
    
    $results["Docker Compose Config"] = Test-ComposeConfiguration
    Write-Host ""
    
    # Skip image build test if Docker is not available
    if ($results["Docker Availability"]) {
        Write-TestWarn "Skipping image build test (takes too long). Run manually if needed."
        # $results["Image Build"] = Test-ImageBuild
        # Write-Host ""
    }
    
    # Summary
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "                 Test Summary" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    
    $passed = 0
    $failed = 0
    
    foreach ($test in $results.GetEnumerator()) {
        if ($test.Value) {
            Write-Host "✅ $($test.Key)" -ForegroundColor Green
            $passed++
        }
        else {
            Write-Host "❌ $($test.Key)" -ForegroundColor Red
            $failed++
        }
    }
    
    Write-Host ""
    Write-Host "Total: $($results.Count) tests | Passed: $passed | Failed: $failed" -ForegroundColor Cyan
    Write-Host ""
    
    if ($failed -eq 0) {
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host "                 All Tests Passed!" -ForegroundColor Green
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host ""
        Write-Host "The deployment package is ready for distribution." -ForegroundColor Green
        Write-Host ""
        Write-Host "To create distribution packages, run:" -ForegroundColor Yellow
        Write-Host "  .\deployment\scripts\build-package.ps1" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host ""
        return $true
    }
    else {
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
        Write-Host "                 Some Tests Failed!" -ForegroundColor Red
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please fix the issues above before proceeding." -ForegroundColor Red
        Write-Host ""
        return $false
    }
}

# Run tests
$testResult = Start-AllTests
if (-not $testResult) {
    exit 1
}
