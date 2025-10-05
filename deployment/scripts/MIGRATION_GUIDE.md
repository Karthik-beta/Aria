# Deployment Scripts Migration Guide

## Overview

The deployment scripts directory has been reorganized from a flat structure to a hierarchical organization based on purpose and platform. This change improves maintainability and makes it easier to locate and manage scripts.

## What Changed

### Old Structure (Flat)

```
deployment/scripts/
├── build-package.sh
├── build-package.ps1
├── install-linux.sh
├── install-windows.ps1
├── uninstall-linux.sh
├── uninstall-windows.ps1
├── generate-ssl-cert-linux.sh
├── generate-ssl-cert-windows.ps1
├── rotate-logs-linux.sh
├── rotate-logs-windows.ps1
├── test-package.sh
├── test-package.ps1
├── validate-bash-scripts.sh
├── validate-bash-scripts.ps1
├── backup/
├── monitoring/
└── restore/
```

### New Structure (Organized)

```
deployment/scripts/
├── build/
│   ├── linux/
│   │   └── build-package.sh
│   └── windows/
│       └── build-package.ps1
├── install/
│   ├── linux/
│   │   ├── install.sh
│   │   └── uninstall.sh
│   └── windows/
│       ├── install.ps1
│       └── uninstall.ps1
├── security/
│   ├── linux/
│   │   └── generate-ssl-cert.sh
│   └── windows/
│       └── generate-ssl-cert.ps1
├── maintenance/
│   ├── linux/
│   │   └── rotate-logs.sh
│   └── windows/
│       └── rotate-logs.ps1
├── testing/
│   ├── linux/
│   │   ├── test-package.sh
│   │   └── validate-scripts.sh
│   └── windows/
│       ├── test-package.ps1
│       └── validate-scripts.ps1
├── backup/
├── monitoring/
└── restore/
```

## Script Path Mapping

| Old Path                        | New Path                                 | Notes                    |
| ------------------------------- | ---------------------------------------- | ------------------------ |
| `build-package.sh`              | `build/linux/build-package.sh`           | Build script for Linux   |
| `build-package.ps1`             | `build/windows/build-package.ps1`        | Build script for Windows |
| `install-linux.sh`              | `install/linux/install.sh`               | Platform suffix removed  |
| `install-windows.ps1`           | `install/windows/install.ps1`            | Platform suffix removed  |
| `uninstall-linux.sh`            | `install/linux/uninstall.sh`             | Platform suffix removed  |
| `uninstall-windows.ps1`         | `install/windows/uninstall.ps1`          | Platform suffix removed  |
| `generate-ssl-cert-linux.sh`    | `security/linux/generate-ssl-cert.sh`    | Platform suffix removed  |
| `generate-ssl-cert-windows.ps1` | `security/windows/generate-ssl-cert.ps1` | Platform suffix removed  |
| `rotate-logs-linux.sh`          | `maintenance/linux/rotate-logs.sh`       | Platform suffix removed  |
| `rotate-logs-windows.ps1`       | `maintenance/windows/rotate-logs.ps1`    | Platform suffix removed  |
| `test-package.sh`               | `testing/linux/test-package.sh`          | Testing category added   |
| `test-package.ps1`              | `testing/windows/test-package.ps1`       | Testing category added   |
| `validate-bash-scripts.sh`      | `testing/linux/validate-scripts.sh`      | Renamed for consistency  |
| `validate-bash-scripts.ps1`     | `testing/windows/validate-scripts.ps1`   | Renamed for consistency  |

## Migration Steps for Existing Deployments

### 1. Update Package.json Scripts

**Before:**

```json
{
  "scripts": {
    "package": "pwsh -File deployment/scripts/build-package.ps1",
    "package:test": "pwsh -File deployment/scripts/test-package.ps1"
  }
}
```

**After:**

```json
{
  "scripts": {
    "package": "pwsh -File deployment/scripts/build/windows/build-package.ps1",
    "package:test": "pwsh -File deployment/scripts/testing/windows/test-package.ps1"
  }
}
```

### 2. Update Scheduled Tasks

#### Linux Cron Jobs

**Before:**

```bash
0 2 * * * /opt/aria-erp/scripts/rotate-logs-linux.sh
```

**After:**

```bash
0 2 * * * /opt/aria-erp/scripts/maintenance/linux/rotate-logs.sh
```

#### Windows Scheduled Tasks

**Before:**

```powershell
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\aria-erp\scripts\rotate-logs-windows.ps1"
```

**After:**

```powershell
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\aria-erp\scripts\maintenance\windows\rotate-logs.ps1"
```

### 3. Update CI/CD Pipeline References

If you have custom CI/CD pipelines referencing these scripts, update the paths accordingly:

**Before:**

```yaml
- bash deployment/scripts/build-package.sh
- bash deployment/scripts/test-package.sh
```

**After:**

```yaml
- bash deployment/scripts/build/linux/build-package.sh
- bash deployment/scripts/testing/linux/test-package.sh
```

### 4. Update Custom Scripts and Documentation

Search your codebase for any references to the old script paths and update them:

```bash
# Find references (Linux/Mac)
grep -r "deployment/scripts/install-linux.sh" .
grep -r "deployment/scripts/rotate-logs" .

# Find references (Windows PowerShell)
Get-ChildItem -Recurse -File | Select-String "deployment/scripts/install-linux.sh"
Get-ChildItem -Recurse -File | Select-String "deployment/scripts/rotate-logs"
```

## Backward Compatibility

**Important:** This is a **breaking change** for paths. All references to the old script paths must be updated.

### For Package Distributors

If you've already distributed packages with the old script paths:

1. Update your build scripts to use the new paths
2. Notify users of the path changes in release notes
3. Provide this migration guide to users

### For End Users

If you have an existing installation with scheduled tasks or custom automation:

1. Update scheduled tasks/cron jobs to use new paths
2. Update any custom scripts that call Aria deployment scripts
3. Verify changes by running scripts manually before relying on automation

## Benefits of the New Structure

1. **Improved Organization**: Scripts are grouped logically by purpose (build, install, security, etc.)
2. **Platform Clarity**: Linux and Windows scripts are clearly separated within each category
3. **Simplified Naming**: Platform suffixes removed from filenames (handled by directory structure)
4. **Scalability**: Easy to add new script categories or platforms in the future
5. **Better Navigation**: Developers can quickly find scripts by purpose and platform

## Testing the Migration

After updating your references, verify everything works:

### Test Build Scripts

```bash
# Linux
bash deployment/scripts/build/linux/build-package.sh

# Windows
pwsh -File deployment/scripts/build/windows/build-package.ps1
```

### Test Package.json Scripts

```bash
pnpm package:test
```

### Test Script Validation

```bash
# Linux
bash deployment/scripts/testing/linux/validate-scripts.sh

# Windows
pwsh -File deployment/scripts/testing/windows/validate-scripts.ps1
```

### Verify Script Permissions (Linux)

```bash
find deployment/scripts -name "*.sh" -exec chmod +x {} \;
```

## Rollback Plan

If you need to rollback (not recommended after migration):

```bash
# This will restore the old structure from git history
git checkout HEAD~1 -- deployment/scripts/
```

**Note:** Rolling back will break any code that has been updated to use the new structure.

## Getting Help

If you encounter issues during migration:

1. Review this guide thoroughly
2. Check the updated [deployment/scripts/README.md](README.md)
3. Review script output for specific error messages
4. Check file permissions on Linux (`chmod +x` for shell scripts)
5. Verify paths are correct for your operating system

## Changelog

### Version 0.1.0 (October 2025)

- **Breaking Change**: Reorganized deployment scripts directory structure
- Scripts grouped by purpose (build, install, security, maintenance, testing)
- Scripts separated by platform (linux, windows) within each category
- Platform suffixes removed from filenames
- All documentation updated to reflect new structure
- package.json scripts updated
- All internal script references updated

---

**Migration Completion Checklist:**

- [ ] Updated package.json scripts
- [ ] Updated scheduled tasks/cron jobs
- [ ] Updated CI/CD pipeline configurations
- [ ] Updated custom scripts and automation
- [ ] Tested build scripts
- [ ] Tested installation scripts
- [ ] Verified scheduled maintenance tasks
- [ ] Updated team documentation
- [ ] Notified stakeholders of changes
