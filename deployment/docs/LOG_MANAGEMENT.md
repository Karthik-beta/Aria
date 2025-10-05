# Log Management Guide

## Overview

Aria ERP implements a comprehensive log management system to prevent disk space issues and maintain system performance in production environments. This guide explains how log rotation and retention works.

## Log Types

### 1. Docker Container Logs

- **Location**: Managed internally by Docker
- **Content**: Container stdout and stderr output
- **Rotation**: Automatic (configured in docker-compose)
- **Retention**: Controlled by `LOG_MAX_SIZE` and `LOG_MAX_FILES`

### 2. Application File Logs

- **Location**: `./logs/` directory
- **Content**: Application-specific log files
- **Rotation**: Manual scripts (cron/Task Scheduler)
- **Retention**: Controlled by `LOG_RETENTION_DAYS`

### 3. Service-Specific Logs

#### Traefik Access Logs

- **Path**: `./logs/traefik/access.log`
- **Rotation**: When file exceeds 100MB
- **Format**: JSON (structured logging)

#### PostgreSQL Logs

- **Path**: `./logs/postgres/postgresql-*.log`
- **Rotation**: Daily or when file exceeds 100MB
- **Format**: PostgreSQL standard log format

#### Backend Application Logs

- **Path**: `./logs/backend/*.log`
- **Rotation**: When file exceeds 50MB
- **Format**: Application-dependent

## Configuration

### Environment Variables

Configure these in your `.env` file:

```bash
# Docker container log rotation
LOG_MAX_SIZE=10m          # Max size per log file (10m, 100m, 1g)
LOG_MAX_FILES=3           # Number of rotated files to keep

# Application log retention
LOG_RETENTION_DAYS=30     # Days to keep logs
LOG_COMPRESS_ENABLED=true # Compress rotated logs
```

### Default Values

If not specified, the system uses these defaults:

- `LOG_MAX_SIZE`: 10m (10 megabytes)
- `LOG_MAX_FILES`: 3 files
- `LOG_RETENTION_DAYS`: 30 days
- `LOG_COMPRESS_ENABLED`: true

## Automated Log Rotation

### Linux Setup

#### Using Cron

1. Make the script executable:

```bash
chmod +x /opt/aria-erp/scripts/rotate-logs-linux.sh
```

2. Open crontab editor:

```bash
crontab -e
```

3. Add this line to run daily at 2 AM:

```bash
0 2 * * * /opt/aria-erp/scripts/rotate-logs-linux.sh
```

4. Optional: Run with custom retention:

```bash
0 2 * * * LOG_RETENTION_DAYS=60 /opt/aria-erp/scripts/rotate-logs-linux.sh
```

#### Using systemd Timer (Alternative)

1. Create service file `/etc/systemd/system/aria-log-rotation.service`:

```ini
[Unit]
Description=Aria ERP Log Rotation
After=docker.service

[Service]
Type=oneshot
ExecStart=/opt/aria-erp/scripts/rotate-logs-linux.sh
User=aria
Group=aria
Environment="LOG_RETENTION_DAYS=30"
Environment="LOG_COMPRESS_ENABLED=true"
```

2. Create timer file `/etc/systemd/system/aria-log-rotation.timer`:

```ini
[Unit]
Description=Daily Aria ERP Log Rotation
Requires=aria-log-rotation.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

3. Enable and start the timer:

```bash
sudo systemctl daemon-reload
sudo systemctl enable aria-log-rotation.timer
sudo systemctl start aria-log-rotation.timer
```

### Windows Setup

#### Using Task Scheduler

1. Open Task Scheduler (`taskschd.msc`)

2. Click **Create Basic Task**

3. Configure the task:
   - **Name**: Aria ERP Log Rotation
   - **Trigger**: Daily at 2:00 AM
   - **Action**: Start a program
   - **Program**: `powershell.exe`
   - **Arguments**:

   ```
   -ExecutionPolicy Bypass -File "C:\aria-erp\scripts\rotate-logs-windows.ps1"
   ```

4. Advanced settings:
   - Run whether user is logged on or not
   - Run with highest privileges
   - Configure for: Windows Server 2019 or later

#### Using PowerShell (Alternative)

Create a scheduled task via PowerShell:

```powershell
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\aria-erp\scripts\rotate-logs-windows.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "Aria ERP Log Rotation" -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings
```

## Manual Log Rotation

### Linux

Run the rotation script manually:

```bash
# Use default settings
./scripts/rotate-logs-linux.sh

# Custom retention period
LOG_RETENTION_DAYS=60 ./scripts/rotate-logs-linux.sh

# Disable compression
LOG_COMPRESS_ENABLED=false ./scripts/rotate-logs-linux.sh
```

### Windows

Run the rotation script manually:

```powershell
# Use default settings
.\scripts\rotate-logs-windows.ps1

# Custom retention period
.\scripts\rotate-logs-windows.ps1 -RetentionDays 60

# Disable compression
.\scripts\rotate-logs-windows.ps1 -CompressLogs $false
```

## How Log Rotation Works

### Docker Container Logs

Docker automatically manages container logs based on the `logging` configuration:

1. Each container writes stdout/stderr to Docker's logging driver
2. When a log file reaches `LOG_MAX_SIZE`, Docker rotates it
3. Docker keeps up to `LOG_MAX_FILES` rotated files
4. Old files are automatically deleted
5. Rotated logs are automatically compressed

**No manual intervention required for Docker logs.**

### Application File Logs

The rotation scripts handle application-specific log files:

1. **Traefik Access Logs**:
   - Check if `access.log` exceeds 100MB
   - If yes, rename to `access-YYYYMMDD-HHMMSS.log`
   - Signal Traefik to reopen the log file
   - Compress the rotated file (if enabled)

2. **Backend Application Logs**:
   - Scan for `.log` files exceeding 50MB
   - Rename to `filename-YYYYMMDD-HHMMSS.log`
   - Compress the rotated file (if enabled)

3. **PostgreSQL Logs**:
   - PostgreSQL handles its own rotation automatically
   - Logs rotate daily or when exceeding 100MB
   - Old logs are cleaned up by retention script

4. **Cleanup Old Logs**:
   - Find all `.log`, `.log.gz`, `.log.zip` files
   - Delete files older than `LOG_RETENTION_DAYS`
   - Report deleted file count

## Monitoring Log Usage

### Check Current Disk Usage

**Linux:**

```bash
# Total logs directory size
du -sh /opt/aria-erp/logs

# Size by service
du -sh /opt/aria-erp/logs/*

# Detailed breakdown
du -h --max-depth=2 /opt/aria-erp/logs
```

**Windows:**

```powershell
# Total logs directory size
Get-ChildItem -Path "C:\aria-erp\logs" -Recurse | Measure-Object -Property Length -Sum | Select-Object @{Name="Size(MB)";Expression={[math]::Round($_.Sum / 1MB, 2)}}

# Size by service
Get-ChildItem -Path "C:\aria-erp\logs" -Directory | ForEach-Object {
    $size = (Get-ChildItem -Path $_.FullName -Recurse | Measure-Object -Property Length -Sum).Sum
    [PSCustomObject]@{
        Service = $_.Name
        "Size(MB)" = [math]::Round($size / 1MB, 2)
    }
}
```

### Check Docker Container Logs

```bash
# View container log sizes
docker ps --format "table {{.Names}}\t{{.Size}}"

# Check specific container logs
docker logs aria-backend --tail 100
docker logs aria-proxy --tail 100
docker logs aria-database --tail 100
```

## Troubleshooting

### Issue: Logs Not Rotating

**Symptoms:**

- Log files growing indefinitely
- No rotated log files with timestamps

**Solutions:**

1. Check if rotation script is scheduled:

   ```bash
   # Linux
   crontab -l | grep rotate-logs

   # Windows
   Get-ScheduledTask | Where-Object {$_.TaskName -like "*Log Rotation*"}
   ```

2. Run rotation script manually to test:

   ```bash
   # Linux
   bash -x /opt/aria-erp/scripts/rotate-logs-linux.sh

   # Windows
   powershell -ExecutionPolicy Bypass -File "C:\aria-erp\scripts\rotate-logs-windows.ps1"
   ```

3. Check script permissions (Linux):
   ```bash
   ls -l /opt/aria-erp/scripts/rotate-logs-linux.sh
   chmod +x /opt/aria-erp/scripts/rotate-logs-linux.sh
   ```

### Issue: Docker Logs Growing Too Large

**Symptoms:**

- High disk usage despite rotation scripts
- Container logs consuming excessive space

**Solutions:**

1. Check current Docker logging configuration:

   ```bash
   docker inspect aria-backend | grep -A 10 LogConfig
   ```

2. Update `LOG_MAX_SIZE` and `LOG_MAX_FILES` in `.env`:

   ```bash
   LOG_MAX_SIZE=5m    # Reduce to 5MB
   LOG_MAX_FILES=2    # Keep only 2 rotated files
   ```

3. Restart containers to apply new settings:
   ```bash
   docker compose restart
   ```

### Issue: Old Logs Not Being Deleted

**Symptoms:**

- Logs older than retention period still present
- Disk usage not decreasing after rotation

**Solutions:**

1. Verify `LOG_RETENTION_DAYS` setting in `.env`

2. Check for permission issues:

   ```bash
   # Linux
   ls -la /opt/aria-erp/logs/

   # Windows
   Get-Acl "C:\aria-erp\logs"
   ```

3. Run cleanup manually with verbose output:

   ```bash
   # Linux
   bash -x /opt/aria-erp/scripts/rotate-logs-linux.sh

   # Windows
   .\scripts\rotate-logs-windows.ps1 -Verbose
   ```

### Issue: Compression Not Working

**Symptoms:**

- Rotated logs remain uncompressed
- `.log.gz` or `.log.zip` files not created

**Solutions:**

1. Check if compression is enabled in `.env`:

   ```bash
   LOG_COMPRESS_ENABLED=true
   ```

2. Verify compression tools are installed:

   ```bash
   # Linux
   which gzip

   # Windows (built-in, but check PowerShell version)
   $PSVersionTable.PSVersion
   ```

3. Check for sufficient disk space (compression requires temporary space)

## Disk Space Planning

### Expected Log Sizes (200 concurrent users)

| Component      | Daily Growth   | With 30-Day Retention | With Compression      |
| -------------- | -------------- | --------------------- | --------------------- |
| Traefik Access | 100-500 MB     | 3-15 GB               | 1-5 GB                |
| Backend App    | 50-200 MB      | 1.5-6 GB              | 500 MB-2 GB           |
| PostgreSQL     | 20-100 MB      | 600 MB-3 GB           | 200 MB-1 GB           |
| Docker Logs    | 50-150 MB      | 1.5-4.5 GB            | N/A (auto-compressed) |
| **Total**      | **220-950 MB** | **~7-29 GB**          | **~2-8 GB**           |

### Recommendations

| Deployment Size         | Retention Period | Recommended Storage |
| ----------------------- | ---------------- | ------------------- |
| Small (<50 users)       | 30 days          | 10 GB               |
| Medium (50-100 users)   | 30 days          | 20 GB               |
| Large (100-200 users)   | 30 days          | 50 GB               |
| Enterprise (200+ users) | 60 days          | 100 GB              |

### Adjusting for Your Environment

**Low disk space?** Reduce retention:

```bash
LOG_RETENTION_DAYS=14  # Keep only 2 weeks
```

**High compliance requirements?** Increase retention:

```bash
LOG_RETENTION_DAYS=90  # Keep 3 months
```

**Very high traffic?** Reduce max log sizes:

```bash
LOG_MAX_SIZE=5m        # Rotate more frequently
LOG_MAX_FILES=2        # Keep fewer rotated files
```

## Best Practices

1. **Enable Compression**: Always keep `LOG_COMPRESS_ENABLED=true` to save 60-80% disk space

2. **Monitor Disk Usage**: Set up alerts for disk usage above 80%

   ```bash
   # Example: Alert if logs exceed 40GB
   LOGS_SIZE=$(du -sb /opt/aria-erp/logs | cut -f1)
   if [ $LOGS_SIZE -gt 42949672960 ]; then
       echo "WARNING: Logs directory exceeds 40GB!"
   fi
   ```

3. **Regular Testing**: Test rotation scripts monthly to ensure they work:

   ```bash
   # Schedule test run
   0 2 1 * * /opt/aria-erp/scripts/rotate-logs-linux.sh
   ```

4. **Backup Important Logs**: Before deletion, consider backing up critical logs:

   ```bash
   # Example: Backup error logs before rotation
   find /opt/aria-erp/logs -name "*error*.log" -exec cp {} /backup/logs/ \;
   ```

5. **Document Custom Settings**: If you adjust retention policies, document why:

   ```bash
   # Compliance requires 60-day retention for audit logs
   LOG_RETENTION_DAYS=60
   ```

6. **Use Centralized Logging**: For production environments, consider forwarding logs to a central system (Elasticsearch, Splunk, etc.)

## Integration with Monitoring

### Prometheus Metrics (Future)

Monitor log metrics:

- Log rotation events per day
- Total log disk usage
- Average log file size
- Failed rotation attempts

### Alerting Rules

Set up alerts for:

- Disk usage > 80%
- Log rotation failures
- Unusually large log files
- Missing log rotation for > 24 hours

## Additional Resources

- [Docker Logging Documentation](https://docs.docker.com/config/containers/logging/)
- [Traefik Access Logs](https://doc.traefik.io/traefik/observability/access-logs/)
- [PostgreSQL Logging](https://www.postgresql.org/docs/current/runtime-config-logging.html)
- [Cron Syntax Guide](https://crontab.guru/)
- [Windows Task Scheduler Guide](https://docs.microsoft.com/en-us/windows/win32/taskschd/task-scheduler-start-page)
