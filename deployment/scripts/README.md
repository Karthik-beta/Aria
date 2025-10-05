# Deployment Scripts

This directory contains scripts for managing Aria ERP deployment, including installation, backup, monitoring, and log management.

## Log Rotation Scripts

### rotate-logs-linux.sh

**Purpose**: Rotates and cleans up application log files on Linux systems.

**Usage**:
```bash
# Use default settings (30-day retention, compression enabled)
bash rotate-logs-linux.sh

# Custom retention period
LOG_RETENTION_DAYS=60 bash rotate-logs-linux.sh

# Disable compression
LOG_COMPRESS_ENABLED=false bash rotate-logs-linux.sh
```

**Environment Variables**:
- `LOG_RETENTION_DAYS`: Number of days to keep logs (default: 30)
- `LOG_COMPRESS_ENABLED`: Enable gzip compression (default: true)

**What it does**:
1. Rotates Traefik access logs when they exceed 100MB
2. Rotates backend application logs when they exceed 50MB
3. Checks PostgreSQL logs (PostgreSQL handles its own rotation)
4. Deletes log files older than the retention period
5. Compresses rotated logs to save disk space

**Scheduling**:
Add to crontab to run daily at 2 AM:
```bash
0 2 * * * /opt/aria-erp/scripts/rotate-logs-linux.sh
```

### rotate-logs-windows.ps1

**Purpose**: Rotates and cleans up application log files on Windows systems.

**Usage**:
```powershell
# Use default settings (30-day retention, compression enabled)
.\rotate-logs-windows.ps1

# Custom retention period
.\rotate-logs-windows.ps1 -RetentionDays 60

# Disable compression
.\rotate-logs-windows.ps1 -CompressLogs $false
```

**Parameters**:
- `-RetentionDays`: Number of days to keep logs (default: 30)
- `-CompressLogs`: Enable ZIP compression (default: true)

**What it does**:
1. Rotates Traefik access logs when they exceed 100MB
2. Rotates backend application logs when they exceed 50MB
3. Checks PostgreSQL logs (PostgreSQL handles its own rotation)
4. Deletes log files older than the retention period
5. Compresses rotated logs to save disk space

**Scheduling**:
Create a scheduled task to run daily at 2 AM:
```powershell
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\aria-erp\scripts\rotate-logs-windows.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -TaskName "Aria ERP Log Rotation" -Action $Action -Trigger $Trigger
```

## Installation Scripts

### install-linux.sh

Automated installation script for Linux systems (Ubuntu, CentOS, RHEL).

### install-windows.ps1

Automated installation script for Windows Server 2019+.

## Backup Scripts

Scripts in the `backup/` directory handle automated database and file backups.

See [Backup Manager Documentation](backup/README.md) for details.

## Monitoring Scripts

Scripts in the `monitoring/` directory provide health checks and system monitoring.

See [Monitoring Documentation](monitoring/README.md) for details.

## Restore Scripts

Scripts in the `restore/` directory handle disaster recovery and system restoration.

See [Restore Documentation](restore/README.md) for details.

## Troubleshooting

### Script Execution Issues

**Linux - Permission Denied**:
```bash
chmod +x /opt/aria-erp/scripts/*.sh
```

**Windows - Execution Policy**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Script Not Found

Ensure you're in the correct directory:
```bash
# Linux
cd /opt/aria-erp

# Windows
cd C:\aria-erp
```

### Logs Not Rotating

1. Check if the script runs without errors:
   ```bash
   # Linux
   bash -x scripts/rotate-logs-linux.sh
   
   # Windows
   .\scripts\rotate-logs-windows.ps1 -Verbose
   ```

2. Verify log directory exists:
   ```bash
   # Linux
   ls -la /opt/aria-erp/logs
   
   # Windows
   Get-ChildItem "C:\aria-erp\logs"
   ```

3. Check disk space:
   ```bash
   # Linux
   df -h /opt/aria-erp
   
   # Windows
   Get-PSDrive C
   ```

## Best Practices

1. **Test scripts manually** before scheduling them
2. **Monitor script output** for the first few runs
3. **Adjust retention periods** based on your disk space and compliance requirements
4. **Keep scripts updated** when upgrading Aria ERP
5. **Document any customizations** you make to the scripts

## Support

For issues with deployment scripts:
1. Check the [Troubleshooting Guide](../docs/TROUBLESHOOTING.md)
2. Review script output for error messages
3. Ensure all prerequisites are met
4. Contact support with script output and error logs
