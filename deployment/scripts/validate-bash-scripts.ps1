#Requires -Version 5.1
<#
.SYNOPSIS
    Validates bash scripts on Windows (using Git Bash if available)
    
.DESCRIPTION
    Runs comprehensive validation tests on all bash deployment scripts.
    Requires Git Bash to be installed.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "         Aria ERP - Bash Script Validation (Windows)" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""

# Determine project root
$ScriptDir = Split-Path -Parent $PSCommandPath
$RootDir = (Get-Item $ScriptDir).Parent.Parent.FullName

Write-Host "Project root: $RootDir" -ForegroundColor Cyan
Write-Host ""

$TestsPassed = 0
$TestsFailed = 0

function Test-Item {
    param(
        [string]$TestName,
        [scriptblock]$TestCommand
    )
    
    Write-Host "[TEST] " -ForegroundColor Yellow -NoNewline
    Write-Host "$TestName..."
    
    try {
        $result = & $TestCommand
        if ($result -or $LASTEXITCODE -eq 0) {
            Write-Host "[PASS] " -ForegroundColor Green -NoNewline
            Write-Host "$TestName"
            $script:TestsPassed++
            return $true
        }
        else {
            Write-Host "[FAIL] " -ForegroundColor Red -NoNewline
            Write-Host "$TestName"
            $script:TestsFailed++
            return $false
        }
    }
    catch {
        Write-Host "[FAIL] " -ForegroundColor Red -NoNewline
        Write-Host "$TestName - $_"
        $script:TestsFailed++
        return $false
    }
}

# Test 1: Check if scripts exist
Test-Item "Build script exists" {
    Test-Path "$RootDir\deployment\scripts\build-package.sh"
}

Test-Item "Test script exists" {
    Test-Path "$RootDir\deployment\scripts\test-package.sh"
}

Test-Item "Install script exists" {
    Test-Path "$RootDir\deployment\scripts\install-linux.sh"
}

Test-Item "Uninstall script exists" {
    Test-Path "$RootDir\deployment\scripts\uninstall-linux.sh"
}

Test-Item "SSL cert generator exists" {
    Test-Path "$RootDir\deployment\scripts\generate-ssl-cert-linux.sh"
}

# Test 2: Check shebang
Test-Item "Build script has correct shebang" {
    $firstLine = Get-Content "$RootDir\deployment\scripts\build-package.sh" -First 1
    $firstLine -eq "#!/bin/bash"
}

Test-Item "Test script has correct shebang" {
    $firstLine = Get-Content "$RootDir\deployment\scripts\test-package.sh" -First 1
    $firstLine -eq "#!/bin/bash"
}

# Test 3: Check for Windows line endings (should not exist)
Test-Item "Build script has Unix line endings" {
    $content = Get-Content "$RootDir\deployment\scripts\build-package.sh" -Raw
    -not ($content -match "`r`n")
}

Test-Item "Test script has Unix line endings" {
    $content = Get-Content "$RootDir\deployment\scripts\test-package.sh" -Raw
    -not ($content -match "`r`n")
}

# Test 4: Check Git Bash availability for syntax checks
$gitBash = $null
$possiblePaths = @(
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files (x86)\Git\bin\bash.exe",
    "$env:ProgramFiles\Git\bin\bash.exe",
    "${env:ProgramFiles(x86)}\Git\bin\bash.exe"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $gitBash = $path
        break
    }
}

if ($gitBash) {
    Write-Host "[INFO] Found Git Bash at: $gitBash" -ForegroundColor Cyan
    
    Test-Item "Build script syntax" {
        & $gitBash -c "bash -n '$($RootDir -replace '\\', '/')/deployment/scripts/build-package.sh'" 2>&1 | Out-Null
        $LASTEXITCODE -eq 0
    }
    
    Test-Item "Test script syntax" {
        & $gitBash -c "bash -n '$($RootDir -replace '\\', '/')/deployment/scripts/test-package.sh'" 2>&1 | Out-Null
        $LASTEXITCODE -eq 0
    }
    
    Test-Item "Install script syntax" {
        & $gitBash -c "bash -n '$($RootDir -replace '\\', '/')/deployment/scripts/install-linux.sh'" 2>&1 | Out-Null
        $LASTEXITCODE -eq 0
    }
    
    Test-Item "Uninstall script syntax" {
        & $gitBash -c "bash -n '$($RootDir -replace '\\', '/')/deployment/scripts/uninstall-linux.sh'" 2>&1 | Out-Null
        $LASTEXITCODE -eq 0
    }
    
    Test-Item "SSL generator syntax" {
        & $gitBash -c "bash -n '$($RootDir -replace '\\', '/')/deployment/scripts/generate-ssl-cert-linux.sh'" 2>&1 | Out-Null
        $LASTEXITCODE -eq 0
    }
}
else {
    Write-Host "[SKIP] Git Bash not found - cannot validate syntax" -ForegroundColor Yellow
}

# Test 5: Check for required functions in build script
Test-Item "Build script has clean_build_dir function" {
    Get-Content "$RootDir\deployment\scripts\build-package.sh" | Select-String "clean_build_dir\(\)"
}

Test-Item "Build script has build_docker_images function" {
    Get-Content "$RootDir\deployment\scripts\build-package.sh" | Select-String "build_docker_images\(\)"
}

Test-Item "Build script has ROOT_DIR variable" {
    Get-Content "$RootDir\deployment\scripts\build-package.sh" | Select-String "ROOT_DIR="
}

# Test 6: Check for proper error handling
Test-Item "Build script has set -e" {
    Get-Content "$RootDir\deployment\scripts\build-package.sh" | Select-String "set -e"
}

Test-Item "Test script has set -e" {
    Get-Content "$RootDir\deployment\scripts\test-package.sh" | Select-String "set -e"
}

# Test 7: Check Docker Compose template
Test-Item "Docker Compose template exists" {
    Test-Path "$RootDir\deployment\templates\docker-compose.production.yml"
}

# Test 8: Check Traefik config templates
Test-Item "Traefik routes.yml exists" {
    Test-Path "$RootDir\deployment\templates\config\traefik\routes.yml"
}

Test-Item "Traefik tls.yml exists" {
    Test-Path "$RootDir\deployment\templates\config\traefik\tls.yml"
}

# Test 9: Check documentation
Test-Item "Installation docs exist" {
    Test-Path "$RootDir\deployment\docs\INSTALLATION.md"
}

Test-Item "Configuration docs exist" {
    Test-Path "$RootDir\deployment\docs\CONFIGURATION.md"
}

# Test 10: Verify no redundant files
Test-Item "No redundant ON_PREMISE_DEPLOYMENT_STATUS.md" {
    -not (Test-Path "$RootDir\ON_PREMISE_DEPLOYMENT_STATUS.md")
}

Test-Item "No redundant PATH_BASED_ROUTING_SUMMARY.md" {
    -not (Test-Path "$RootDir\PATH_BASED_ROUTING_SUMMARY.md")
}

# Summary
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "                    Test Summary" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "Total Tests: $($TestsPassed + $TestsFailed)"
Write-Host "Passed: " -NoNewline
Write-Host "$TestsPassed" -ForegroundColor Green

if ($TestsFailed -gt 0) {
    Write-Host "Failed: " -NoNewline
    Write-Host "$TestsFailed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Some tests failed. Please review the errors above." -ForegroundColor Red
    exit 1
}
else {
    Write-Host "Failed: " -NoNewline
    Write-Host "0" -ForegroundColor Green
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "           All Tests Passed! ✓" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "The bash scripts are ready for deployment." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To test on a Linux system:" -ForegroundColor Yellow
    Write-Host "  1. Transfer the project to Linux"
    Write-Host "  2. Run: chmod +x deployment/scripts/*.sh"
    Write-Host "  3. Run: ./deployment/scripts/test-package.sh"
    Write-Host "  4. Run: ./deployment/scripts/build-package.sh"
    Write-Host ""
}
