# Aria ERP Backup System

This directory contains automated backup scripts for the Aria ERP deployment system.

## 🎯 Features

- **Smart Storage Detection**: Automatically detects and uses the best available storage (external, network, or local)
- **Cross-Platform**: Works on both Linux and Windows
- **Automated Backups**: Database and configuration files
- **Backup Rotation**: Automatically removes old backups based on retention policy
- **Compression**: Reduces backup size (gzip on Linux, zip on Windows)
- **Verification**: Validates backup integrity after completion
- **Manifest Generation**: Creates detailed backup manifests

## 📁 Scripts

### Storage Detection

**Linux**: `detect-storage.sh`
**Windows**: `detect-storage.ps1`

Detects available backup storage in priority order:

1. External USB/storage devices
2. Network storage (NFS, CIFS, mapped drives)
3. Local storage (fallback)

#### Usage

```bash
# Linux
sudo ./detect-storage.sh

# Windows (PowerShell as Administrator)
.\detect-storage.ps1
```

#### Output Format

```
<type>:<path>
```

Examples:

- `external:/media/usb/backups`
- `network:/mnt/nas/backups`
- `local:/opt/aria-erp/backups`

### Backup Manager

**Linux**: `backup-manager.sh`
**Windows**: `backup-manager.ps1`

Performs complete system backups including:

- PostgreSQL database dump
- Docker Compose configuration
- Environment variables
- Traefik configuration

#### Usage

```bash
# Linux
sudo ./backup-manager.sh

# Windows (PowerShell as Administrator)
.\backup-manager.ps1
```

#### Environment Variables

| Variable                | Default                          | Description                    |
| ----------------------- | -------------------------------- | ------------------------------ |
| `BACKUP_RETENTION_DAYS` | 7                                | Number of days to keep backups |
| `BACKUP_COMPRESSION`    | gzip/zip                         | Compression format             |
| `COMPOSE_FILE`          | /opt/aria-erp/docker-compose.yml | Docker Compose file location   |
| `ENV_FILE`              | /opt/aria-erp/.env               | Environment file location      |

## 🔄 Automated Scheduling

### Linux (systemd timer)

Create timer unit:

```bash
sudo tee /etc/systemd/system/aria-backup.timer > /dev/null << 'EOF'
[Unit]
Description=Aria ERP Backup Timer
Requires=aria-backup.service

[Timer]
OnCalendar=daily
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF
```

Create service unit:

```bash
sudo tee /etc/systemd/system/aria-backup.service > /dev/null << 'EOF'
[Unit]
Description=Aria ERP Backup Service
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/opt/aria-erp/scripts/backup/backup-manager.sh
StandardOutput=journal
StandardError=journal
EOF
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable aria-backup.timer
sudo systemctl start aria-backup.timer
```

Check status:

```bash
sudo systemctl status aria-backup.timer
sudo systemctl list-timers aria-backup.timer
```

### Windows (Task Scheduler)

Create scheduled task:

```powershell
# Run as Administrator
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"C:\Program Files\AriaERP\scripts\backup\backup-manager.ps1`""

$trigger = New-ScheduledTaskTrigger -Daily -At 2am

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "AriaERP-DailyBackup" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Daily backup of Aria ERP system"
```

## 📋 Backup Structure

Each backup creates a timestamped directory:

```
aria-erp-backup-20250104_020000/
├── database.sql.gz (or .zip on Windows)
├── config/
│   ├── .env
│   ├── docker-compose.yml
│   └── traefik/
│       ├── routes.yml
│       └── tls.yml
└── backup-manifest.txt
```

## 🔍 Verification

The backup system automatically verifies:

- Database dump file exists
- Configuration files are present
- Manifest is generated
- All files are readable

## 🛡️ Security Considerations

- **Permissions**: Backup scripts must run with elevated privileges (root/Administrator)
- **Sensitive Data**: Backups contain database credentials and environment variables
- **Storage**: Ensure backup storage has appropriate access controls
- **Encryption**: Consider encrypting backups for additional security

## 🐛 Troubleshooting

### Storage detection fails

**Linux**:

```bash
# Check available storage
df -h
lsblk

# Check for external devices
ls -la /media /mnt

# Check mount points
mount | grep -E 'nfs|cifs'
```

**Windows**:

```powershell
# Check available drives
Get-PSDrive -PSProvider FileSystem

# Check for removable drives
Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 }

# Check network drives
Get-PSDrive | Where-Object { $_.DisplayRoot -like "\\*" }
```

### Database backup fails

Check if container is running:

```bash
docker ps | grep aria-database
```

Check database credentials:

```bash
# Linux
cat /opt/aria-erp/.env | grep POSTGRES

# Windows
Get-Content "C:\Program Files\AriaERP\.env" | Select-String "POSTGRES"
```

Test database connection:

```bash
docker exec aria-database pg_dump -U aria aria --version
```

### Insufficient disk space

Check required space:

- Database size: Run `docker exec aria-database psql -U aria -c "SELECT pg_size_pretty(pg_database_size('aria'));"`
- Minimum 5GB free space required

Clean up old backups manually:

```bash
# Linux
find /backup/location -name "aria-erp-backup-*" -mtime +7 -exec rm -rf {} \;

# Windows
Get-ChildItem "C:\Backups" -Directory -Filter "aria-erp-backup-*" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -Recurse -Force
```

## 📚 Related Documentation

- [Installation Guide](../../docs/INSTALLATION.md)
- [Configuration Reference](../../docs/CONFIGURATION.md)
- [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md)

## 🔄 Recovery

To restore from backup, see the recovery scripts in the `restore/` directory (coming in next phase).

## ✅ Testing

Test backup manually:

```bash
# Linux
sudo ./backup-manager.sh

# Windows (PowerShell as Administrator)
.\backup-manager.ps1
```

Verify backup files:

```bash
# Linux
ls -lh /path/to/backup/aria-erp-backup-*/

# Windows
Get-ChildItem "C:\Backups\aria-erp-backup-*" -Recurse
```

## 📝 Changelog

### Version 1.0.0 (2025-01-04)

- Initial implementation
- Cross-platform support (Linux/Windows)
- Smart storage detection
- Automated backup rotation
- Backup verification
- Manifest generation
