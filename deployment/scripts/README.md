# Deployment Scripts

This directory contains scripts for managing Aria ERP deployment, organized by purpose and platform for improved maintainability.

## Directory Structure

```
deployment/scripts/
├── build/              # Package building and distribution
│   ├── linux/          # Linux build scripts
│   └── windows/        # Windows build scripts
├── install/            # Installation and uninstallation
│   ├── linux/          # Linux install/uninstall scripts
│   └── windows/        # Windows install/uninstall scripts
├── security/           # Security-related operations
│   ├── linux/          # Linux security scripts
│   └── windows/        # Windows security scripts
├── maintenance/        # Ongoing maintenance tasks
│   ├── linux/          # Linux maintenance scripts
│   └── windows/        # Windows maintenance scripts
├── testing/            # Testing and validation
│   ├── linux/          # Linux test scripts
│   └── windows/        # Windows test scripts
├── backup/             # Automated backup management
├── monitoring/         # Health checks and monitoring
└── restore/            # Disaster recovery operations
```

## Build Scripts (`build/`)

Scripts for creating deployment packages.

- **Linux**: `build/linux/build-package.sh`
- **Windows**: `build/windows/build-package.ps1`

## Installation Scripts (`install/`)

Scripts for installing and uninstalling Aria ERP.

### Linux Installation
- **Install**: `install/linux/install.sh`
- **Uninstall**: `install/linux/uninstall.sh`

### Windows Installation
- **Install**: `install/windows/install.ps1`
- **Uninstall**: `install/windows/uninstall.ps1`

## Security Scripts (`security/`)

Scripts for security-related operations like SSL certificate generation.

### Linux
```bash
sudo bash security/linux/generate-ssl-cert.sh
```

### Windows
```powershell
.\security\windows\generate-ssl-cert.ps1
```

## Maintenance Scripts (`maintenance/`)

Scripts for ongoing system maintenance tasks.

### Log Rotation

**Linux**: `maintenance/linux/rotate-logs.sh`

**Purpose**: Rotates and cleans up application log files on Linux systems.

**Usage**:
```bash
# Use default settings (30-day retention, compression enabled)
bash maintenance/linux/rotate-logs.sh

# Custom retention period
LOG_RETENTION_DAYS=60 bash maintenance/linux/rotate-logs.sh

# Disable compression
LOG_COMPRESS_ENABLED=false bash maintenance/linux/rotate-logs.sh
```

**Environment Variables**:
- `LOG_RETENTION_DAYS`: Number of days to keep logs (default: 30)
- `LOG_COMPRESS_ENABLED`: Enable gzip compression (default: true)

**Scheduling**:
Add to crontab to run daily at 2 AM:
```bash
0 2 * * * /opt/aria-erp/scripts/maintenance/linux/rotate-logs.sh
```

**Windows**: `maintenance/windows/rotate-logs.ps1`

**Purpose**: Rotates and cleans up application log files on Windows systems.

**Usage**:
```powershell
# Use default settings (30-day retention, compression enabled)
.\maintenance\windows\rotate-logs.ps1

# Custom retention period
.\maintenance\windows\rotate-logs.ps1 -RetentionDays 60

# Disable compression
.\maintenance\windows\rotate-logs.ps1 -CompressLogs $false
```

**Scheduling**:
Create a scheduled task to run daily at 2 AM:
```powershell
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\aria-erp\scripts\maintenance\windows\rotate-logs.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -TaskName "Aria ERP Log Rotation" -Action $Action -Trigger $Trigger
```

## Testing Scripts (`testing/`)

Scripts for testing and validating the deployment package.

- **Linux**: `testing/linux/test-package.sh`, `testing/linux/validate-scripts.sh`
- **Windows**: `testing/windows/test-package.ps1`, `testing/windows/validate-scripts.ps1`

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
chmod +x /opt/aria-erp/scripts/*/linux/*.sh
chmod +x /opt/aria-erp/scripts/{backup,monitoring,restore}/*.sh
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
   bash -x scripts/maintenance/linux/rotate-logs.sh
   
   # Windows
   .\scripts\maintenance\windows\rotate-logs.ps1 -Verbose
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
