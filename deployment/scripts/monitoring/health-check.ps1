# Aria ERP - Health Check Script (Windows)
# Monitors Docker container health, service availability, and system resources

param(
    [switch]$Verbose,
    [switch]$Json
)

$ErrorActionPreference = "Stop"

# Configuration
$HealthCheckTimeout = 10
$ApiHealthEndpoint = $env:API_HEALTH_ENDPOINT ?? "http://localhost/api/health"

# Health status
$script:OverallStatus = 0
$script:HealthResults = @()

# Logging functions
function Write-HealthLog {
    param(
        [string]$Message,
        [ValidateSet("INFO", "SUCCESS", "WARN", "ERROR")]
        [string]$Level = "INFO",
        [string]$Component = "General"
    )
    
    $color = switch ($Level) {
        "INFO"    { "White" }
        "SUCCESS" { "Green" }
        "WARN"    { "Yellow" }
        "ERROR"   { "Red" }
    }
    
    $symbol = switch ($Level) {
        "INFO"    { "[i]" }
        "SUCCESS" { "[✓]" }
        "WARN"    { "[!]" }
        "ERROR"   { "[✗]" }
    }
    
    if (-not $Json) {
        Write-Host "$symbol " -ForegroundColor $color -NoNewline
        Write-Host $Message
    }
    
    # Track for JSON output
    $script:HealthResults += @{
        Component = $Component
        Level = $Level
        Message = $Message
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    
    # Update overall status
    if ($Level -eq "WARN" -and $script:OverallStatus -eq 0) {
        $script:OverallStatus = 1
    }
    elseif ($Level -eq "ERROR") {
        $script:OverallStatus = 2
    }
}

# Check if Docker is running
function Test-Docker {
    if (-not $Json) {
        Write-Host ""
        Write-Host "=== Docker Status ===" -ForegroundColor Cyan
    }
    
    try {
        $null = docker version 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Docker command failed"
        }
        
        Write-HealthLog "Docker daemon is running" -Level "SUCCESS" -Component "Docker"
        
        $version = docker version --format "{{.Server.Version}}" 2>$null
        Write-HealthLog "Docker version: $version" -Level "INFO" -Component "Docker"
        
        return $true
    }
    catch {
        Write-HealthLog "Docker is not running or not installed" -Level "ERROR" -Component "Docker"
        return $false
    }
}

# Check container health
function Test-ContainerHealth {
    param(
        [string]$ContainerName,
        [string]$DisplayName
    )
    
    if (-not $DisplayName) {
        $DisplayName = $ContainerName
    }
    
    try {
        # Check if container exists
        $containers = docker ps -a --format "{{.Names}}" 2>$null
        if ($containers -notcontains $ContainerName) {
            $msg = "$DisplayName - Container not found"
            Write-HealthLog $msg -Level "WARN" -Component "Containers"
            return $false
        }
        
        # Check if running
        $runningContainers = docker ps --format "{{.Names}}" 2>$null
        if ($runningContainers -notcontains $ContainerName) {
            $msg = "$DisplayName - Container is not running"
            Write-HealthLog $msg -Level "ERROR" -Component "Containers"
            return $false
        }
        
        # Get health status
        $healthStatus = docker inspect --format='{{.State.Health.Status}}' $ContainerName 2>$null
        
        if ($healthStatus -eq "healthy") {
            $msg = "$DisplayName - Healthy"
            Write-HealthLog $msg -Level "SUCCESS" -Component "Containers"
            return $true
        }
        elseif ($healthStatus -eq "unhealthy") {
            $msg = "$DisplayName - Unhealthy"
            Write-HealthLog $msg -Level "ERROR" -Component "Containers"
            return $false
        }
        elseif ($healthStatus -eq "starting") {
            $msg = "$DisplayName - Starting"
            Write-HealthLog $msg -Level "WARN" -Component "Containers"
            return $false
        }
        else {
            # No health check configured
            $state = docker inspect --format='{{.State.Status}}' $ContainerName 2>$null
            if ($state -eq "running") {
                $msg = "$DisplayName - Running (no health check configured)"
                Write-HealthLog $msg -Level "SUCCESS" -Component "Containers"
                return $true
            }
            else {
                $msg = "$DisplayName - Not running (status - $state)"
                Write-HealthLog $msg -Level "ERROR" -Component "Containers"
                return $false
            }
        }
    }
    catch {
        $msg = "$DisplayName - Check failed - $($_.Exception.Message)"
        Write-HealthLog $msg -Level "ERROR" -Component "Containers"
        return $false
    }
}

# Check all Aria containers
function Test-AriaContainers {
    if (-not $Json) {
        Write-Host ""
        Write-Host "=== Aria ERP Containers ===" -ForegroundColor Cyan
    }
    
    $containers = @{
        "aria-proxy" = "Traefik Proxy"
        "aria-database" = "PostgreSQL Database"
        "aria-backend" = "Backend API"
        "aria-asset" = "Asset Management"
        "aria-crm" = "CRM Frontend"
        "aria-hrms" = "HRMS Frontend"
        "aria-inventory" = "Inventory Frontend"
    }
    
    $allHealthy = $true
    
    foreach ($container in $containers.GetEnumerator()) {
        if (-not (Test-ContainerHealth -ContainerName $container.Key -DisplayName $container.Value)) {
            $allHealthy = $false
        }
    }
    
    return $allHealthy
}

# Check database connectivity
function Test-Database {
    if (-not $Json) {
        Write-Host ""
        Write-Host "=== Database Connectivity ===" -ForegroundColor Cyan
    }
    
    $dbContainer = "aria-database"
    $dbUser = $env:POSTGRES_USER ?? "aria"
    $dbName = $env:POSTGRES_DB ?? "aria"
    
    try {
        $runningContainers = docker ps --format "{{.Names}}" 2>$null
        if ($runningContainers -notcontains $dbContainer) {
            Write-HealthLog "Database container is not running" -Level "ERROR" -Component "Database"
            return $false
        }
        
        # Test database connection
        $result = docker exec $dbContainer psql -U $dbUser -d $dbName -c "SELECT 1" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-HealthLog "Database connection successful" -Level "SUCCESS" -Component "Database"
            
            # Get database size
            $dbSize = docker exec $dbContainer psql -U $dbUser -d $dbName -t -c "SELECT pg_size_pretty(pg_database_size('$dbName'));" 2>$null
            if ($dbSize) {
                Write-HealthLog "Database size: $($dbSize.Trim())" -Level "INFO" -Component "Database"
            }
            
            # Get connection count
            $connections = docker exec $dbContainer psql -U $dbUser -d $dbName -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>$null
            if ($connections) {
                Write-HealthLog "Active connections: $($connections.Trim())" -Level "INFO" -Component "Database"
            }
            
            return $true
        }
        else {
            Write-HealthLog "Database connection failed" -Level "ERROR" -Component "Database"
            return $false
        }
    }
    catch {
        Write-HealthLog "Database check failed: $($_.Exception.Message)" -Level "ERROR" -Component "Database"
        return $false
    }
}

# Check API health endpoint
function Test-ApiHealth {
    if (-not $Json) {
        Write-Host ""
        Write-Host "=== API Health Endpoint ===" -ForegroundColor Cyan
    }
    
    try {
        $response = Invoke-WebRequest -Uri $ApiHealthEndpoint -TimeoutSec $HealthCheckTimeout -UseBasicParsing -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-HealthLog "API health endpoint responding (HTTP 200)" -Level "SUCCESS" -Component "API"
            return $true
        }
        else {
            Write-HealthLog "API health endpoint returned HTTP $($response.StatusCode)" -Level "WARN" -Component "API"
            return $false
        }
    }
    catch {
        Write-HealthLog "API health endpoint unreachable: $($_.Exception.Message)" -Level "ERROR" -Component "API"
        return $false
    }
}

# Check disk space
function Test-DiskSpace {
    if (-not $Json) {
        Write-Host ""
        Write-Host "=== Disk Space ===" -ForegroundColor Cyan
    }
    
    $threshold = 90
    
    try {
        # Check system drive
        $systemDrive = $env:SystemDrive
        $drive = Get-PSDrive -Name $systemDrive.TrimEnd(':')
        
        $totalGB = [math]::Round($drive.Used / 1GB + $drive.Free / 1GB, 2)
        $usedGB = [math]::Round($drive.Used / 1GB, 2)
        $freeGB = [math]::Round($drive.Free / 1GB, 2)
        $usedPercent = [math]::Round(($drive.Used / ($drive.Used + $drive.Free)) * 100, 0)
        
        if ($usedPercent -ge $threshold) {
            Write-HealthLog "System disk usage critical: ${usedPercent}% (${usedGB}GB / ${totalGB}GB)" -Level "ERROR" -Component "Disk"
        }
        elseif ($usedPercent -ge 80) {
            Write-HealthLog "System disk usage high: ${usedPercent}% (${usedGB}GB / ${totalGB}GB)" -Level "WARN" -Component "Disk"
        }
        else {
            Write-HealthLog "System disk usage: ${usedPercent}% (${freeGB}GB free)" -Level "SUCCESS" -Component "Disk"
        }
        
        # Check backup directories
        $backupPaths = @(
            "C:\Program Files\AriaERP\backups",
            "$env:USERPROFILE\Documents\AriaERP\backups"
        )
        
        foreach ($path in $backupPaths) {
            if (Test-Path $path) {
                $backupDrive = Split-Path $path -Qualifier
                $drive = Get-PSDrive -Name $backupDrive.TrimEnd(':')
                $usedPercent = [math]::Round(($drive.Used / ($drive.Used + $drive.Free)) * 100, 0)
                
                if ($usedPercent -ge $threshold) {
                    Write-HealthLog "Backup disk usage high: ${usedPercent}% at $path" -Level "WARN" -Component "Disk"
                }
                else {
                    Write-HealthLog "Backup disk usage: ${usedPercent}% at $path" -Level "INFO" -Component "Disk"
                }
            }
        }
    }
    catch {
        Write-HealthLog "Disk space check failed: $($_.Exception.Message)" -Level "WARN" -Component "Disk"
    }
}

# Check memory usage
function Test-Memory {
    if (-not $Json) {
        Write-Host ""
        Write-Host "=== Memory Usage ===" -ForegroundColor Cyan
    }
    
    try {
        # System memory
        $os = Get-CimInstance Win32_OperatingSystem
        $totalMem = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
        $freeMem = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
        $usedMem = $totalMem - $freeMem
        $usedPercent = [math]::Round(($usedMem / $totalMem) * 100, 0)
        
        Write-HealthLog "System memory: ${usedMem}GB used / ${totalMem}GB total (${freeMem}GB available)" -Level "INFO" -Component "Memory"
        
        # Docker container memory
        if (-not $Json) {
            Write-Host ""
            docker stats --no-stream --format "table {{.Name}}`t{{.MemUsage}}`t{{.MemPerc}}" | Select-String "aria-" | Out-Host
        }
    }
    catch {
        Write-HealthLog "Memory check failed: $($_.Exception.Message)" -Level "WARN" -Component "Memory"
    }
}

# Check container logs for errors
function Test-ContainerLogs {
    if (-not $Json) {
        Write-Host ""
        Write-Host "=== Recent Container Errors ===" -ForegroundColor Cyan
    }
    
    $containers = @("aria-proxy", "aria-database", "aria-backend", "aria-asset", "aria-crm", "aria-hrms", "aria-inventory")
    $foundErrors = $false
    
    foreach ($container in $containers) {
        $runningContainers = docker ps --format "{{.Names}}" 2>$null
        if ($runningContainers -contains $container) {
            try {
                $logs = docker logs --since 1h $container 2>&1 | Select-String -Pattern "error|exception|fatal" -CaseSensitive:$false
                $errorCount = ($logs | Measure-Object).Count
                
                if ($errorCount -gt 0) {
                    $msg = "$container - $errorCount error(s) in last hour"
                    Write-HealthLog $msg -Level "WARN" -Component "Logs"
                    $foundErrors = $true
                }
            }
            catch {
                # Ignore log check errors
            }
        }
    }
    
    if (-not $foundErrors) {
        Write-HealthLog "No recent errors in container logs" -Level "SUCCESS" -Component "Logs"
    }
}

# Generate health summary
function Show-HealthSummary {
    if ($Json) {
        $summary = @{
            Status = switch ($script:OverallStatus) {
                0 { "HEALTHY" }
                1 { "DEGRADED" }
                2 { "UNHEALTHY" }
            }
            StatusCode = $script:OverallStatus
            Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            Results = $script:HealthResults
        }
        
        $summary | ConvertTo-Json -Depth 10 | Write-Output
    }
    else {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "         Health Check Summary" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        
        switch ($script:OverallStatus) {
            0 {
                Write-Host "✓ All systems operational" -ForegroundColor Green
                Write-Host "Status: HEALTHY"
            }
            1 {
                Write-Host "! Some systems need attention" -ForegroundColor Yellow
                Write-Host "Status: DEGRADED"
            }
            2 {
                Write-Host "✗ Critical issues detected" -ForegroundColor Red
                Write-Host "Status: UNHEALTHY"
            }
        }
        
        Write-Host ""
        Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        Write-Host ""
    }
}

# Main function
function Main {
    if (-not $Json) {
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "    Aria ERP Health Check" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
    }
    
    Test-Docker | Out-Null
    Test-AriaContainers | Out-Null
    Test-Database | Out-Null
    Test-ApiHealth | Out-Null
    Test-DiskSpace | Out-Null
    Test-Memory | Out-Null
    Test-ContainerLogs | Out-Null
    Show-HealthSummary
    
    exit $script:OverallStatus
}

# Run main function
Main
