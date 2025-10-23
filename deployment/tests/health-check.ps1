# Aria ERP Deployment Health Check Script for Windows
# Tests all critical services and endpoints

param(
    [int]$MaxRetries = 30,
    [int]$RetryDelay = 10,
    [int]$Timeout = 10
)

$ErrorActionPreference = "Continue"

# Test counters
$script:TestsPassed = 0
$script:TestsFailed = 0

# Logging functions
function Write-Pass {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
    $script:TestsPassed++
}

function Write-Fail {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
    $script:TestsFailed++
}

function Write-TestInfo {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Yellow
}

# Test Docker containers are running
function Test-Containers {
    Write-Host "`nTesting Docker containers..."
    
    $containers = @("aria-caddy", "aria-frontend", "aria-backend", "aria-postgres", "aria-redis")
    
    foreach ($container in $containers) {
        $running = docker ps --format '{{.Names}}' | Select-String -Pattern "^$container$"
        
        if ($running) {
            Write-Pass "Container $container is running"
        }
        else {
            Write-Fail "Container $container is not running"
        }
    }
}

# Test container health
function Test-ContainerHealth {
    Write-Host "`nTesting container health..."
    
    $containers = @("aria-frontend", "aria-backend", "aria-postgres", "aria-redis")
    
    foreach ($container in $containers) {
        try {
            $healthStatus = docker inspect --format='{{.State.Health.Status}}' $container 2>$null
            
            if ($healthStatus -eq "healthy") {
                Write-Pass "Container $container is healthy"
            }
            elseif ($LASTEXITCODE -ne 0) {
                Write-TestInfo "Container $container has no health check configured"
            }
            else {
                Write-Fail "Container $container health status: $healthStatus"
            }
        }
        catch {
            Write-TestInfo "Could not get health status for $container"
        }
    }
}

# Test HTTP endpoint
function Test-HttpEndpoint {
    param(
        [string]$Url,
        [string]$Name,
        [int]$ExpectedStatus = 200
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $Timeout -ErrorAction SilentlyContinue
        $statusCode = $response.StatusCode
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Pass "$Name endpoint returned $statusCode"
        }
        else {
            Write-Fail "$Name endpoint returned $statusCode (expected $ExpectedStatus)"
        }
    }
    catch {
        Write-Fail "$Name endpoint failed: $($_.Exception.Message)"
    }
}

# Test all HTTP endpoints
function Test-Endpoints {
    Write-Host "`nTesting HTTP endpoints..."
    
    Write-TestInfo "Waiting for services to be ready..."
    Start-Sleep -Seconds 5
    
    # Test health endpoint
    Test-HttpEndpoint -Url "http://localhost/health" -Name "Health check"
    
    # Test API endpoint
    Test-HttpEndpoint -Url "http://localhost/api/health" -Name "Backend API health"
    
    # Test frontend
    Test-HttpEndpoint -Url "http://localhost" -Name "Frontend root"
    
    # Test HTTPS if available
    try {
        $response = Invoke-WebRequest -Uri "https://localhost" -UseBasicParsing -TimeoutSec 5 -SkipCertificateCheck -ErrorAction SilentlyContinue
        if ($response.StatusCode -in @(200, 301, 302)) {
            Write-Pass "HTTPS endpoint is accessible"
        }
    }
    catch {
        Write-TestInfo "HTTPS endpoint not configured or not accessible"
    }
}

# Test database connectivity
function Test-Database {
    Write-Host "`nTesting database connectivity..."
    
    # Test PostgreSQL
    try {
        $pgResult = docker exec aria-postgres pg_isready -U aria 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Pass "PostgreSQL is accepting connections"
        }
        else {
            Write-Fail "PostgreSQL is not accepting connections"
        }
    }
    catch {
        Write-Fail "Could not test PostgreSQL connectivity"
    }
    
    # Test Redis
    try {
        $redisResult = docker exec aria-redis redis-cli ping 2>&1
        if ($redisResult -match "PONG") {
            Write-Pass "Redis is responding"
        }
        else {
            Write-Fail "Redis is not responding"
        }
    }
    catch {
        Write-Fail "Could not test Redis connectivity"
    }
}

# Test network connectivity
function Test-Network {
    Write-Host "`nTesting network connectivity..."
    
    $network = "aria-network"
    
    try {
        $networkInfo = docker network inspect $network 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Pass "Docker network $network exists"
            
            $networkData = $networkInfo | ConvertFrom-Json
            $containerCount = ($networkData.Containers | Get-Member -MemberType NoteProperty).Count
            Write-TestInfo "Connected containers: $containerCount"
        }
        else {
            Write-Fail "Docker network $network does not exist"
        }
    }
    catch {
        Write-Fail "Could not inspect Docker network"
    }
}

# Test volumes
function Test-Volumes {
    Write-Host "`nTesting Docker volumes..."
    
    $volumes = @("postgres-data", "redis-data", "caddy-data", "caddy-config")
    
    foreach ($volume in $volumes) {
        $found = $false
        
        # Try with prefix
        $result = docker volume inspect "aria_$volume" 2>&1
        if ($LASTEXITCODE -eq 0) {
            $found = $true
        }
        else {
            # Try without prefix
            $result = docker volume inspect $volume 2>&1
            if ($LASTEXITCODE -eq 0) {
                $found = $true
            }
        }
        
        if ($found) {
            Write-Pass "Volume $volume exists"
        }
        else {
            Write-Fail "Volume $volume does not exist"
        }
    }
}

# Test resource usage
function Test-Resources {
    Write-Host "`nTesting resource usage..."
    
    try {
        $stats = docker stats --no-stream --format "table {{.Container}}`t{{.CPUPerc}}`t{{.MemUsage}}" 2>&1 | Select-String "aria-"
        
        if ($stats) {
            Write-TestInfo "Resource usage:"
            $stats | ForEach-Object { Write-Host "  $_" -ForegroundColor Cyan }
        }
    }
    catch {
        Write-TestInfo "Could not retrieve resource statistics"
    }
}

# Test logs
function Test-Logs {
    Write-Host "`nChecking for errors in logs..."
    
    $containers = @("aria-frontend", "aria-backend")
    $errorCount = 0
    
    foreach ($container in $containers) {
        try {
            $logs = docker logs --tail 100 $container 2>&1
            $errors = ($logs | Select-String -Pattern "error|fatal|exception" -CaseSensitive:$false).Count
            
            if ($errors -gt 0) {
                Write-TestInfo "Container $container has $errors error messages in recent logs"
                $errorCount += $errors
            }
        }
        catch {
            Write-TestInfo "Could not retrieve logs for $container"
        }
    }
    
    if ($errorCount -eq 0) {
        Write-Pass "No errors found in recent logs"
    }
    else {
        Write-TestInfo "Found $errorCount error messages (review logs manually)"
    }
}

# Display summary
function Show-Summary {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "  Deployment Health Check Summary"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Tests Passed: " -NoNewline
    Write-Host $script:TestsPassed -ForegroundColor Green
    Write-Host "Tests Failed: " -NoNewline
    Write-Host $script:TestsFailed -ForegroundColor Red
    Write-Host ""
    
    if ($script:TestsFailed -eq 0) {
        Write-Host "✓ All tests passed successfully!" -ForegroundColor Green
        return $true
    }
    else {
        Write-Host "✗ Some tests failed. Please review the output above." -ForegroundColor Red
        return $false
    }
}

# Main execution
function Start-HealthCheck {
    Write-Host "========================================"
    Write-Host "  Aria ERP Deployment Health Check"
    Write-Host "========================================"
    
    Test-Containers
    Test-ContainerHealth
    Test-Endpoints
    Test-Database
    Test-Network
    Test-Volumes
    Test-Resources
    Test-Logs
    
    $success = Show-Summary
    
    if (-not $success) {
        exit 1
    }
}

# Run tests
Start-HealthCheck
