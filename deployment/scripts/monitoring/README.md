# Aria ERP Health Monitoring System

This directory contains health monitoring and diagnostic scripts for the Aria ERP deployment system.

## 🎯 Features

- **Container Health Checks**: Monitor Docker container status and health
- **Service Availability**: Verify all Aria ERP services are running
- **Database Connectivity**: Test PostgreSQL connection and performance
- **API Health Endpoints**: Check backend API health status
- **Resource Monitoring**: Track disk space, memory, and CPU usage
- **Error Detection**: Scan container logs for recent errors
- **Cross-Platform**: Works on both Linux and Windows

## 📁 Scripts

### Health Check

**Linux**: `health-check.sh`
**Windows**: `health-check.ps1`

Performs comprehensive health checks on the entire Aria ERP system.

#### Usage

```bash
# Linux
sudo ./health-check.sh

# Windows (PowerShell as Administrator)
.\health-check.ps1

# JSON output (for automation)
.\health-check.ps1 -Json
```

#### Checks Performed

| Check | Description | Status Codes |
|-------|-------------|--------------|
| Docker Status | Verifies Docker daemon is running | ✓ SUCCESS / ✗ ERROR |
| Container Health | Checks all 7 Aria containers | ✓ HEALTHY / ! STARTING / ✗ UNHEALTHY |
| Database Connectivity | Tests PostgreSQL connection | ✓ SUCCESS / ✗ ERROR |
| API Health | Queries backend health endpoint | ✓ SUCCESS / ! WARN / ✗ ERROR |
| Disk Space | Monitors disk usage | ✓ <80% / ! 80-90% / ✗ >90% |
| Memory Usage | Tracks system and container memory | INFO |
| Container Logs | Scans for recent errors | ✓ NO ERRORS / ! ERRORS FOUND |

#### Output Format

**Standard Output** (default):
```
========================================
    Aria ERP Health Check
========================================

=== Docker Status ===
[✓] Docker daemon is running
[i] Docker version: 28.3.2

=== Aria ERP Containers ===
[✓] Traefik Proxy: Healthy
[✓] PostgreSQL Database: Healthy
[✓] Backend API: Running (no health check configured)
...

========================================
         Health Check Summary
========================================

✓ All systems operational
Status: HEALTHY

Timestamp: 2025-01-04 10:30:00
```

**JSON Output** (`-Json` flag):
```json
{
  "Status": "HEALTHY",
  "StatusCode": 0,
  "Timestamp": "2025-01-04 10:30:00",
  "Results": [
    {
      "Component": "Docker",
      "Level": "SUCCESS",
      "Message": "Docker daemon is running",
      "Timestamp": "2025-01-04 10:30:00"
    },
    ...
  ]
}
```

#### Exit Codes

- `0` - HEALTHY: All systems operational
- `1` - DEGRADED: Some systems need attention
- `2` - UNHEALTHY: Critical issues detected

### Backend Health Endpoints

The backend API now includes two health endpoints:

#### Basic Health Endpoint

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-04T10:30:00.000Z",
  "service": "aria-backend",
  "version": "1.0.0",
  "uptime": 3600
}
```

#### Detailed Health Endpoint

**Endpoint**: `GET /api/health/detailed`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-04T10:30:00.000Z",
  "service": "aria-backend",
  "version": "1.0.0",
  "uptime": 3600,
  "system": {
    "platform": "linux",
    "nodeVersion": "v18.17.0",
    "memory": {
      "total": 134217728,
      "used": 89478485,
      "external": 2097152
    },
    "cpu": {
      "user": 1000000,
      "system": 500000
    }
  },
  "environment": "production"
}
```

## 🔄 Automated Monitoring

### Linux (systemd timer)

Create monitoring timer:

```bash
sudo tee /etc/systemd/system/aria-health-check.timer > /dev/null << 'EOF'
[Unit]
Description=Aria ERP Health Check Timer
Requires=aria-health-check.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
Persistent=true

[Install]
WantedBy=timers.target
EOF
```

Create monitoring service:

```bash
sudo tee /etc/systemd/system/aria-health-check.service > /dev/null << 'EOF'
[Unit]
Description=Aria ERP Health Check Service
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/opt/aria-erp/scripts/monitoring/health-check.sh
StandardOutput=journal
StandardError=journal

# Alert on failures
OnFailure=aria-health-alert@%n.service

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable aria-health-check.timer
sudo systemctl start aria-health-check.timer
```

Check status:

```bash
sudo systemctl status aria-health-check.timer
sudo systemctl list-timers aria-health-check.timer
```

View health check logs:

```bash
sudo journalctl -u aria-health-check.service -f
```

### Windows (Task Scheduler)

Create health check task:

```powershell
# Run as Administrator
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"C:\Program Files\AriaERP\scripts\monitoring\health-check.ps1`""

# Run every 15 minutes
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([TimeSpan]::MaxValue)

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3

Register-ScheduledTask -TaskName "AriaERP-HealthCheck" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Periodic health check for Aria ERP system (every 15 minutes)"
```

View task history:

```powershell
Get-ScheduledTask -TaskName "AriaERP-HealthCheck" | Get-ScheduledTaskInfo
```

## 📊 Health Dashboard Integration

The JSON output format is designed for integration with monitoring dashboards:

### Prometheus/Grafana Integration

Create a simple exporter script:

```bash
#!/bin/bash
# health-metrics-exporter.sh

while true; do
    # Run health check and export metrics
    /opt/aria-erp/scripts/monitoring/health-check.sh > /dev/null 2>&1
    status=$?
    
    # Export to Prometheus format
    echo "aria_health_status $status" > /var/lib/node_exporter/textfile_collector/aria_health.prom
    echo "aria_health_last_check $(date +%s)" >> /var/lib/node_exporter/textfile_collector/aria_health.prom
    
    sleep 60
done
```

### Email Alerts

Configure email alerts on failures (Linux):

```bash
sudo tee /etc/systemd/system/aria-health-alert@.service > /dev/null << 'EOF'
[Unit]
Description=Aria ERP Health Alert Service

[Service]
Type=oneshot
ExecStart=/usr/bin/mail -s "Aria ERP Health Check Failed" admin@example.com < /var/log/aria-health-error.log
EOF
```

## 🐛 Troubleshooting

### Health check returns UNHEALTHY

1. **Check Docker**:
   ```bash
   docker ps -a
   docker logs aria-database
   docker logs aria-backend
   ```

2. **Check container health**:
   ```bash
   docker inspect aria-database --format='{{.State.Health.Status}}'
   ```

3. **Verify network connectivity**:
   ```bash
   docker exec aria-backend curl -f http://aria-database:5432 || echo "Database unreachable"
   ```

### Container health check fails

Add health checks to docker-compose.yml:

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
  
  database:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aria"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### API health endpoint unreachable

1. **Check Traefik routing**:
   ```bash
   curl -v http://localhost/api/health
   ```

2. **Check backend container**:
   ```bash
   docker exec aria-backend curl http://localhost:3000/health
   ```

3. **Check Traefik logs**:
   ```bash
   docker logs aria-proxy | grep health
   ```

### Disk space warnings

Clean up old Docker resources:

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Clean up build cache
docker builder prune -a
```

### Memory usage high

Check container resource limits:

```bash
docker stats

# Adjust limits in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

## 🔍 Monitoring Best Practices

1. **Regular Health Checks**: Run every 15 minutes minimum
2. **Alert on Failures**: Set up notifications for UNHEALTHY status
3. **Log Rotation**: Configure log rotation to prevent disk space issues
4. **Baseline Metrics**: Establish normal resource usage patterns
5. **Gradual Degradation**: Monitor for slow increases in resource usage
6. **Test Alerts**: Periodically test alert mechanisms

## 📚 Related Documentation

- [Backup System](../backup/README.md)
- [Installation Guide](../../docs/INSTALLATION.md)
- [Configuration Reference](../../docs/CONFIGURATION.md)
- [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md)

## 🔄 Integration with Backup System

The health check system works seamlessly with the backup system:

```bash
# Run health check before backup
if ! /opt/aria-erp/scripts/monitoring/health-check.sh; then
    echo "WARNING: System unhealthy, backup may be incomplete"
fi

# Run backup
/opt/aria-erp/scripts/backup/backup-manager.sh

# Verify health after backup
/opt/aria-erp/scripts/monitoring/health-check.sh
```

## ✅ Testing

Test health check manually:

```bash
# Linux
sudo ./health-check.sh

# Windows (PowerShell as Administrator)
.\health-check.ps1

# Test JSON output
.\health-check.ps1 -Json | ConvertFrom-Json
```

Verify health endpoints:

```bash
# Basic health
curl http://localhost/api/health

# Detailed health
curl http://localhost/api/health/detailed | jq
```

Test failure scenarios:

```bash
# Stop a container and check health
docker stop aria-backend
./health-check.sh
# Expected: UNHEALTHY status

# Restart and verify
docker start aria-backend
./health-check.sh
# Expected: HEALTHY status after startup
```

## 📝 Changelog

### Version 1.0.0 (2025-01-04)
- Initial implementation
- Cross-platform support (Linux/Windows)
- Container health monitoring
- Database connectivity checks
- API health endpoints
- Resource monitoring
- Error detection in logs
- JSON output support
- Backend health endpoints added
