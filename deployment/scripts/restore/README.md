# Aria ERP Recovery System

Comprehensive disaster recovery solution for the Aria ERP system, providing database restoration, configuration recovery, and full system recovery with rollback capabilities.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Recovery Scripts](#recovery-scripts)
- [Recovery Procedures](#recovery-procedures)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)
- [Integration](#integration)

## Overview

The Aria ERP Recovery System provides three levels of disaster recovery:

1. **Database Recovery** - Restore database from backups
2. **Configuration Recovery** - Restore system configuration files
3. **Full System Recovery** - Complete system restoration with automatic orchestration

### Key Features

✅ **Multi-level Recovery** - Database, configuration, or full system
✅ **Interactive Selection** - Choose from available backups with metadata
✅ **Integrity Verification** - Validates backup integrity before restoration
✅ **Safety First** - Creates pre-recovery snapshots automatically
✅ **Rollback Capability** - Automatic rollback on failure
✅ **Cross-platform** - Both Linux and Windows support
✅ **Health Verification** - Validates system health after recovery
✅ **Comprehensive Logging** - Color-coded output with timestamps

## Architecture

```
deployment/scripts/restore/
├── restore-database.sh       # Linux database restoration
├── restore-database.ps1      # Windows database restoration
├── restore-config.sh         # Linux configuration restoration
├── restore-config.ps1        # Windows configuration restoration
├── full-restore.sh           # Linux full system recovery
├── full-restore.ps1          # Windows full system recovery
└── README.md                 # This file
```

### Recovery Flow

```
┌─────────────────────────────────────────────────────┐
│          Full System Recovery Process               │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Check Prerequisites   │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Select Backup        │
              │  (Interactive UI)     │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Verify Integrity      │
              │ (gzip/zip test)       │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ User Confirmation     │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Create Pre-Recovery   │
              │ Snapshot              │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Stop Services         │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Restore Database      │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Restore Configuration │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Start Services        │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Verify Health         │
              └───────────┬───────────┘
                          │
                ┌─────────┴─────────┐
                │                   │
                ▼                   ▼
          ┌─────────┐         ┌─────────┐
          │ Success │         │ Failure │
          └─────────┘         └────┬────┘
                                   │
                                   ▼
                          ┌────────────────┐
                          │ Rollback?      │
                          └────────┬───────┘
                                   │
                                   ▼
                          ┌────────────────┐
                          │ Restore        │
                          │ Pre-Recovery   │
                          │ Snapshot       │
                          └────────────────┘
```

## Prerequisites

### Common Requirements

- Docker Engine (20.10+)
- Docker Compose (v2.0+)
- Root/Administrator privileges
- Valid Aria ERP backup

### Linux-Specific

- Bash 4.0+
- Standard utilities: `gzip`, `find`, `sed`
- PostgreSQL client tools (installed in Docker container)

### Windows-Specific

- PowerShell 5.1 or later
- .NET Framework 4.5+ (for ZIP handling)
- Docker Desktop for Windows

## Quick Start

### Full System Recovery

**Linux:**
```bash
sudo bash deployment/scripts/restore/full-restore.sh
```

**Windows (Administrator PowerShell):**
```powershell
.\deployment\scripts\restore\full-restore.ps1
```

The script will:
1. Display available backups
2. Let you select one interactively
3. Verify backup integrity
4. Ask for confirmation
5. Perform full system recovery
6. Verify system health

### Database Only Recovery

**Linux:**
```bash
sudo bash deployment/scripts/restore/restore-database.sh
```

**Windows:**
```powershell
.\deployment\scripts\restore\restore-database.ps1
```

### Configuration Only Recovery

**Linux:**
```bash
sudo bash deployment/scripts/restore/restore-config.sh
```

**Windows:**
```powershell
.\deployment\scripts\restore\restore-config.ps1
```

## Recovery Scripts

### 1. Database Restoration (`restore-database.sh/ps1`)

Restores PostgreSQL database from backup files.

**Features:**
- Lists available backups with metadata
- Interactive backup selection
- Integrity verification (gzip/zip test)
- Creates pre-restore safety backup
- Drops and recreates database
- Restores from SQL dump
- Verifies table count post-restoration
- Automatic rollback on failure

**Usage:**
```bash
# Linux
sudo bash restore-database.sh

# Windows
.\restore-database.ps1
```

**Key Functions:**

Linux:
- `list_backups()` - Find and display backups
- `select_backup()` - Interactive selection UI
- `verify_backup()` - Test gzip integrity
- `create_pre_restore_backup()` - Safety backup
- `restore_database()` - Perform restoration
- `rollback_restoration()` - Revert on failure

Windows:
- `Get-AvailableBackups` - Find backups
- `Select-Backup` - Interactive selection
- `Test-BackupIntegrity` - ZIP validation
- `New-PreRestoreBackup` - Safety backup
- `Restore-Database` - Perform restoration
- `Invoke-Rollback` - Revert on failure

**Exit Codes:**
- `0` - Success
- `1` - Error (check logs)
- `2` - Verification failed

### 2. Configuration Restoration (`restore-config.sh/ps1`)

Restores system configuration files including `.env`, `docker-compose.yml`, and Traefik configuration.

**Features:**
- Backs up current configuration before restoration
- Validates configuration files
- Restores with proper file permissions
- Restarts services automatically
- Rollback capability

**Usage:**
```bash
# Linux
sudo bash restore-config.sh

# Windows
.\restore-config.ps1
```

**Restored Files:**
- `.env` - Environment variables
- `docker-compose.yml` - Service definitions
- `config/traefik/*` - Traefik configuration

**Key Functions:**

Linux:
- `backup_current_config()` - Backup existing config
- `validate_config()` - Check required vars
- `restore_env_file()` - Restore with chmod 600
- `restore_compose_file()` - Restore compose
- `restore_traefik_config()` - Restore Traefik
- `restart_services()` - docker-compose orchestration
- `rollback_config()` - Revert on failure

Windows:
- `Backup-CurrentConfig` - Backup existing
- `Test-ConfigValidity` - Validate structure
- `Restore-EnvFile` - Restore with ACLs
- `Restore-ComposeFile` - Restore compose
- `Restore-TraefikConfig` - Restore Traefik
- `Restart-Services` - Service orchestration
- `Invoke-ConfigRollback` - Revert on failure

**Exit Codes:**
- `0` - Success
- `1` - Validation/restoration failed

### 3. Full System Recovery (`full-restore.sh/ps1`)

Orchestrates complete system restoration combining database and configuration recovery.

**Features:**
- Single-command full recovery
- Comprehensive prerequisite checks
- Interactive backup selection with metadata
- Backup integrity verification
- Pre-recovery system snapshot
- Orchestrated service management
- Combined DB + config restoration
- Post-recovery health verification
- Automatic rollback on any failure

**Usage:**
```bash
# Linux
sudo bash full-restore.sh

# Windows
.\full-restore.ps1
```

**Recovery Steps:**
1. Check prerequisites (Docker, scripts, health check)
2. Display available backups with metadata
3. Interactive backup selection
4. Verify backup integrity (gzip/zip tests)
5. Confirm destructive operation
6. Create pre-recovery snapshot (DB + config)
7. Stop all Aria ERP services
8. Restore database from backup
9. Restore configuration files
10. Start all services
11. Verify system health
12. Rollback if any step fails

**Key Functions:**

Linux:
- `check_prerequisites()` - Verify requirements
- `select_backup()` - Interactive UI
- `verify_backup()` - Integrity checks
- `create_pre_recovery_snapshot()` - Safety backup
- `stop_services()` - Service shutdown
- `restore_database()` - DB restoration
- `restore_configuration()` - Config restoration
- `start_services()` - Service startup
- `verify_system_health()` - Health checks
- `rollback_recovery()` - Complete rollback

Windows:
- `Test-Prerequisites` - Verify requirements
- `Select-Backup` - Interactive UI
- `Test-BackupIntegrity` - Integrity checks
- `New-PreRecoverySnapshot` - Safety backup
- `Stop-AriaServices` - Service shutdown
- `Restore-Database` - DB restoration
- `Restore-Configuration` - Config restoration
- `Start-AriaServices` - Service startup
- `Test-SystemHealth` - Health checks
- `Invoke-RecoveryRollback` - Complete rollback

**Exit Codes:**
- `0` - Full recovery successful
- `1` - Recovery failed (rollback offered)

## Recovery Procedures

### Scenario 1: Database Corruption

**Symptoms:**
- Database connection errors
- Data integrity issues
- Application crashes on database queries

**Solution:**
```bash
# 1. Stop the application (optional, script does this)
cd /opt/aria-erp
docker-compose down

# 2. Run database restoration
sudo bash deployment/scripts/restore/restore-database.sh

# 3. Verify restoration
docker exec aria-database psql -U aria -d aria -c "\dt"
```

**Recovery Time:** 5-15 minutes (depending on database size)

### Scenario 2: Configuration Issues

**Symptoms:**
- Services not starting
- Environment variable errors
- Traefik routing issues

**Solution:**
```bash
# Run configuration restoration
sudo bash deployment/scripts/restore/restore-config.sh
```

The script will:
- Backup current configuration
- Validate backup files
- Restore all configuration files
- Restart services automatically

**Recovery Time:** 2-5 minutes

### Scenario 3: Complete System Failure

**Symptoms:**
- Multiple services down
- Database and config issues
- Application completely unavailable

**Solution:**
```bash
# Run full system recovery
sudo bash deployment/scripts/restore/full-restore.sh
```

This performs:
- Complete database restoration
- Full configuration recovery
- Service orchestration
- Health verification

**Recovery Time:** 10-20 minutes

### Scenario 4: Testing Backup Validity

**Before Production Issues:**
```bash
# 1. Create test restoration environment
mkdir /tmp/aria-test-restore
cd /tmp/aria-test-restore

# 2. Run full restore in test mode
# (Use script but select test backup)
sudo bash deployment/scripts/restore/full-restore.sh

# 3. Verify functionality
curl http://localhost/health

# 4. Rollback to production
# (Script offers this automatically)
```

**Best Practice:** Test backups monthly

### Scenario 5: Point-in-Time Recovery

**Recovering to Specific Time:**
```bash
# 1. List backups with timestamps
ls -lh /opt/aria-erp/backups/

# 2. Choose backup closest to desired time
# Example: aria-erp-backup-20241215_143000

# 3. Run restoration and select that backup
sudo bash deployment/scripts/restore/full-restore.sh
```

**Tip:** Use backup manifest to verify backup contents

## Testing

### Testing Recovery Scripts

**1. Create Test Backup:**
```bash
# Generate test backup
cd deployment/scripts/backup
sudo bash backup-manager.sh

# Note the backup timestamp
```

**2. Test Database Restoration:**
```bash
# Linux
cd deployment/scripts/restore
sudo bash restore-database.sh

# Windows
cd deployment\scripts\restore
.\restore-database.ps1

# Verify
docker exec aria-database psql -U aria -d aria -c "SELECT count(*) FROM users;"
```

**3. Test Configuration Restoration:**
```bash
# Modify a config file to test restoration
echo "TEST_VAR=test" >> /opt/aria-erp/.env

# Restore configuration
sudo bash restore-config.sh

# Verify TEST_VAR is gone
grep TEST_VAR /opt/aria-erp/.env
```

**4. Test Full System Recovery:**
```bash
# Run full recovery
sudo bash full-restore.sh

# Select most recent backup
# Confirm when prompted

# Verify all services
docker-compose ps
curl http://localhost/health
```

**5. Test Rollback Mechanism:**
```bash
# Simulate failure by providing invalid backup
# Script should offer rollback

# Confirm rollback
# Verify system returns to pre-recovery state
```

### Automated Testing

Create test script (`test-recovery.sh`):
```bash
#!/bin/bash

# Test recovery scripts
echo "Testing Aria ERP Recovery System..."

# 1. Create fresh backup
echo "Creating test backup..."
cd ../backup
sudo bash backup-manager.sh

# 2. Test database restoration
echo "Testing database restoration..."
cd ../restore
if sudo bash restore-database.sh <<< "1\ny\n"; then
    echo "✓ Database restoration test passed"
else
    echo "✗ Database restoration test failed"
    exit 1
fi

# 3. Test configuration restoration
echo "Testing configuration restoration..."
if sudo bash restore-config.sh <<< "1\ny\n"; then
    echo "✓ Configuration restoration test passed"
else
    echo "✗ Configuration restoration test failed"
    exit 1
fi

# 4. Test full system recovery
echo "Testing full system recovery..."
if sudo bash full-restore.sh <<< "1\ny\n"; then
    echo "✓ Full system recovery test passed"
else
    echo "✗ Full system recovery test failed"
    exit 1
fi

echo "All recovery tests passed!"
```

### Test Checklist

Before production use:

- [ ] Backup creation successful
- [ ] Database restoration works
- [ ] Configuration restoration works
- [ ] Full system recovery works
- [ ] Pre-recovery snapshots created
- [ ] Rollback mechanism works
- [ ] Health verification passes
- [ ] Services restart properly
- [ ] Data integrity maintained
- [ ] Permissions correct after restoration

## Troubleshooting

### Common Issues

#### 1. "Docker is not running"

**Error:**
```
[ERROR] Docker daemon is not running
```

**Solution:**
```bash
# Linux
sudo systemctl start docker

# Windows
# Start Docker Desktop from Start Menu
```

#### 2. "No backups found"

**Error:**
```
[ERROR] No backups found
```

**Solution:**
```bash
# Check backup locations
ls -lh /opt/aria-erp/backups/
ls -lh /media/
ls -lh /mnt/

# Create backup if none exist
cd deployment/scripts/backup
sudo bash backup-manager.sh
```

#### 3. "Database backup is corrupted"

**Error:**
```
[ERROR] Database backup is corrupted
```

**Solution:**
```bash
# Test backup integrity manually
gzip -t /path/to/database.sql.gz

# If corrupted, use previous backup
# or restore from off-site backup
```

#### 4. "Permission denied"

**Error:**
```
[ERROR] Permission denied when accessing backup
```

**Solution:**
```bash
# Ensure running as root
sudo -i

# Check file permissions
ls -l /path/to/backup/

# Fix permissions if needed
chmod 600 /path/to/backup/.env
```

#### 5. "Services won't start after restoration"

**Error:**
```
[ERROR] Failed to start services
```

**Solution:**
```bash
# Check Docker logs
docker-compose logs

# Verify configuration
docker-compose config

# Check environment variables
cat /opt/aria-erp/.env

# Manually start services
cd /opt/aria-erp
docker-compose up -d
```

#### 6. "Database connection failed"

**Error:**
```
[ERROR] Could not connect to database
```

**Solution:**
```bash
# Check database container
docker ps | grep aria-database

# Check database logs
docker logs aria-database

# Verify credentials
echo $POSTGRES_USER
echo $POSTGRES_DB

# Test connection
docker exec aria-database psql -U aria -d aria -c "SELECT 1;"
```

#### 7. "Health check failed after recovery"

**Error:**
```
[WARN] System health check failed
```

**Solution:**
```bash
# Check individual services
curl http://localhost/health

# Check container status
docker-compose ps

# Review logs
docker-compose logs --tail=50

# Wait for initialization (some services need time)
sleep 30 && bash deployment/scripts/monitoring/health-check.sh
```

### Debug Mode

**Enable verbose logging:**

Linux:
```bash
# Add to script
set -x  # Enable debug mode

# Run script
bash -x restore-database.sh
```

Windows:
```powershell
# Add to script
$VerbosePreference = "Continue"
$DebugPreference = "Continue"

# Run script
.\restore-database.ps1 -Verbose -Debug
```

### Log Files

Recovery operations log to:

**Linux:**
- Console output (stdout/stderr)
- System logs: `/var/log/syslog`

**Windows:**
- Console output
- Event Viewer: Application logs

**Capture logs:**
```bash
# Linux
sudo bash full-restore.sh 2>&1 | tee recovery-$(date +%Y%m%d_%H%M%S).log

# Windows
.\full-restore.ps1 *>&1 | Tee-Object -FilePath "recovery-$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
```

## Security Considerations

### File Permissions

**Linux:**
```bash
# Environment file (sensitive credentials)
chmod 600 /opt/aria-erp/.env

# Backup directory
chmod 700 /opt/aria-erp/backups

# Scripts (executable by root only)
chmod 700 deployment/scripts/restore/*.sh
```

**Windows:**
```powershell
# Environment file ACLs
icacls "C:\ProgramData\Aria-ERP\.env" /inheritance:r /grant:r "SYSTEM:(F)" "Administrators:(F)"

# Backup directory
icacls "C:\ProgramData\Aria-ERP\backups" /inheritance:r /grant:r "SYSTEM:(F)" "Administrators:(F)"
```

### Backup Encryption

**Encrypt backups at rest:**
```bash
# Linux (using GPG)
gpg --symmetric --cipher-algo AES256 database.sql

# Windows (using 7-Zip with AES-256)
7z a -p -mhe=on -t7z database.7z database.sql
```

**Decrypt before restoration:**
```bash
# Linux
gpg --decrypt database.sql.gpg > database.sql

# Windows
7z x -p database.7z
```

### Network Security

- **Backup Transfer:** Use SFTP/SCP for remote backups
- **Access Control:** Limit script execution to authorized users
- **Audit Logging:** Enable system audit logs for recovery operations

### Pre-Recovery Snapshots

Scripts automatically create pre-recovery snapshots:

**Linux:** `/tmp/aria-pre-recovery-YYYYMMDD_HHMMSS/`
**Windows:** `%TEMP%\aria-pre-recovery-YYYYMMDD_HHMMSS\`

**Retention:**
- Kept for 7 days by default
- Contains full database and configuration snapshot
- Used for emergency rollback

**Manual cleanup:**
```bash
# Linux
find /tmp -name "aria-pre-recovery-*" -mtime +7 -exec rm -rf {} \;

# Windows
Get-ChildItem $env:TEMP -Directory -Filter "aria-pre-recovery-*" | 
    Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-7) } | 
    Remove-Item -Recurse -Force
```

## Integration

### Integration with Backup System

The recovery system integrates with the Aria ERP Backup System:

```
deployment/scripts/
├── backup/              # Phase 1: Automated backups
│   ├── backup-manager.sh
│   ├── backup-manager.ps1
│   └── ...
├── monitoring/          # Phase 2: Health monitoring
│   ├── health-check.sh
│   ├── health-check.ps1
│   └── ...
└── restore/            # Phase 3: Recovery (this)
    ├── restore-database.sh
    ├── restore-database.ps1
    ├── restore-config.sh
    ├── restore-config.ps1
    ├── full-restore.sh
    └── full-restore.ps1
```

**Workflow:**
1. Backup system creates backups (Phase 1)
2. Health monitoring detects issues (Phase 2)
3. Recovery system restores from backups (Phase 3)

### Integration with Health Monitoring

Full system recovery uses health checks:

```bash
# After restoration, verify system health
bash deployment/scripts/monitoring/health-check.sh

# Exit codes:
# 0 = Healthy
# 1 = Degraded
# 2 = Unhealthy
```

**Automated Health Verification:**
- Full restore script calls health check automatically
- Rollback triggered if health check fails
- Integration ensures recovered system is functional

### CI/CD Integration

**GitLab CI Example:**
```yaml
disaster_recovery_test:
  stage: test
  script:
    - cd deployment/scripts/backup
    - bash backup-manager.sh
    - cd ../restore
    - bash full-restore.sh <<< "1\ny\n"
  only:
    - main
  tags:
    - docker
```

**GitHub Actions Example:**
```yaml
name: Disaster Recovery Test
on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly
jobs:
  recovery-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Test Recovery
        run: |
          cd deployment/scripts/backup
          sudo bash backup-manager.sh
          cd ../restore
          sudo bash full-restore.sh <<< "1\ny\n"
```

### Monitoring Integration

**Prometheus Metrics:**
```yaml
# Add to monitoring
- job_name: 'aria_recovery'
  static_configs:
    - targets: ['localhost:9090']
  metrics_path: '/metrics'
```

**Metrics to track:**
- `aria_recovery_duration_seconds` - Recovery time
- `aria_recovery_success_total` - Successful recoveries
- `aria_recovery_failure_total` - Failed recoveries
- `aria_backup_age_seconds` - Time since last backup

### Alerting Integration

**Alert on old backups:**
```yaml
groups:
  - name: aria_recovery
    rules:
      - alert: BackupTooOld
        expr: aria_backup_age_seconds > 86400
        annotations:
          summary: "Aria ERP backup is over 24 hours old"
```

## Best Practices

### Recovery Planning

1. **Test regularly** - Monthly recovery tests
2. **Document procedures** - Keep runbooks updated
3. **Verify backups** - Test integrity weekly
4. **Monitor backup age** - Alert on stale backups
5. **Practice scenarios** - Simulate different failure modes

### Backup Strategy

1. **3-2-1 Rule:**
   - 3 copies of data
   - 2 different media types
   - 1 off-site copy

2. **Retention Policy:**
   - Daily: Keep 7 days
   - Weekly: Keep 4 weeks
   - Monthly: Keep 12 months

3. **Verification:**
   - Integrity checks daily
   - Test restoration monthly
   - Full DR drill quarterly

### Security Best Practices

1. **Access Control:**
   - Limit root/admin access
   - Use audit logging
   - Implement MFA for production

2. **Encryption:**
   - Encrypt backups at rest
   - Encrypt during transfer
   - Protect encryption keys

3. **Monitoring:**
   - Log all recovery operations
   - Alert on unauthorized access
   - Track recovery metrics

### Operational Best Practices

1. **Pre-Recovery:**
   - Verify backup integrity
   - Create pre-recovery snapshot
   - Document current state
   - Notify stakeholders

2. **During Recovery:**
   - Follow runbook procedures
   - Monitor progress closely
   - Document any deviations
   - Keep stakeholders informed

3. **Post-Recovery:**
   - Verify system health
   - Test critical functions
   - Review logs
   - Update documentation
   - Conduct post-mortem

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review logs for error details
3. Consult main project documentation
4. Contact system administrator

## Version History

- **v1.0.0** (2024-12-15)
  - Initial release
  - Database restoration
  - Configuration restoration
  - Full system recovery
  - Cross-platform support (Linux/Windows)
  - Rollback capability
  - Health verification integration

## License

Part of the Aria ERP project. See main project LICENSE file.
