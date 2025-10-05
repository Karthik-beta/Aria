# Deployment Folder Organization

**Last Updated**: October 4, 2025  
**Status**: Reorganized and Consolidated

---

## Overview

This document describes the organized structure of the deployment folder, explaining the purpose of each directory and file. The structure has been optimized for clarity, maintainability, and ease of use.

---

## Folder Structure

```
deployment/
├── 📘 DEPLOYMENT_GUIDE.md           Primary deployment documentation (2,200+ lines)
├── 📄 README.md                     Quick reference guide
├── 🔧 DEVELOPMENT.md                Development environment setup
├── 📋 FOLDER_ORGANIZATION.md        This file (structure reference)
│
├── docs/                            📁 Detailed Technical Documentation
│   ├── INSTALLATION.md              Step-by-step installation guide
│   ├── CONFIGURATION.md             Complete configuration reference
│   ├── TROUBLESHOOTING.md           Problem resolution procedures
│   └── SPECIFICATION.md             Technical specifications & architecture
│
├── scripts/                         📁 Operational Scripts
│   ├── backup/                      Phase 1: Automated Backup System
│   │   ├── backup-manager.sh         Linux backup orchestrator (517 lines)
│   │   ├── backup-manager.ps1        Windows backup orchestrator (571 lines)
│   │   ├── detect-storage.sh         Linux storage detection (283 lines)
│   │   ├── detect-storage.ps1        Windows storage detection (311 lines)
│   │   └── README.md                 Backup system documentation
│   │
│   ├── monitoring/                  Phase 2: Health Monitoring System
│   │   ├── health-check.sh           Linux health monitoring (415 lines)
│   │   ├── health-check.ps1          Windows health monitoring (459 lines)
│   │   └── README.md                 Monitoring system documentation
│   │
│   ├── restore/                     Phase 3: Disaster Recovery System
│   │   ├── restore-database.sh       Linux database restoration (504 lines)
│   │   ├── restore-database.ps1      Windows database restoration (553 lines)
│   │   ├── restore-config.sh         Linux config restoration (353 lines)
│   │   ├── restore-config.ps1        Windows config restoration (405 lines)
│   │   ├── full-restore.sh           Linux full recovery (586 lines)
│   │   ├── full-restore.ps1          Windows full recovery (687 lines)
│   │   └── README.md                 Recovery system documentation (936 lines)
│   │
│   ├── install-linux.sh             Main Linux installation script
│   ├── install-windows.ps1          Main Windows installation script
│   ├── uninstall-linux.sh           Linux uninstallation script
│   ├── uninstall-windows.ps1        Windows uninstallation script
│   ├── build-package.sh             Linux package builder
│   ├── build-package.ps1            Windows package builder
│   ├── test-package.sh              Linux package tester
│   ├── test-package.ps1             Windows package tester
│   ├── generate-ssl-cert-linux.sh   Linux SSL certificate generator
│   ├── generate-ssl-cert-windows.ps1 Windows SSL certificate generator
│   ├── validate-bash-scripts.sh     Bash script validator
│   └── validate-bash-scripts.ps1    Bash validation wrapper (Windows)
│
└── templates/                       📁 Configuration Templates
    ├── docker-compose.production.yml Production Docker Compose configuration
    ├── aria-erp.service.template     systemd service template (Linux)
    └── config/                       Configuration file templates
        └── traefik/                  Traefik reverse proxy configuration
            ├── static-ip-routes.yml   Path-based routing configuration
            ├── tls.yml                TLS/SSL configuration
            └── certs/                 SSL certificate directory
                ├── README.md           Certificate documentation
                ├── openssl.conf        OpenSSL configuration
                └── server.crt          Self-signed certificate (generated)
```

---

## Documentation Hierarchy

### Entry Point

**DEPLOYMENT_GUIDE.md** - The primary, comprehensive guide containing:

- Complete installation procedures
- Configuration reference
- Operations manual
- Troubleshooting guide
- Security best practices
- Maintenance schedules

### Quick Reference

**README.md** - Concise reference containing:

- Quick start instructions
- Common operations
- Links to detailed documentation
- Testing status summary

### Technical Documentation (`docs/`)

Detailed references for specific topics:

1. **INSTALLATION.md** - Deep dive into installation process
2. **CONFIGURATION.md** - All configuration options explained
3. **TROUBLESHOOTING.md** - Comprehensive problem resolution
4. **SPECIFICATION.md** - Technical architecture and design

---

## Script Organization

### Backup Scripts (`scripts/backup/`)

**Purpose**: Phase 1 - Automated backup system

| File                 | Platform | Purpose                  | Lines |
| -------------------- | -------- | ------------------------ | ----- |
| `backup-manager.sh`  | Linux    | Main backup orchestrator | 517   |
| `backup-manager.ps1` | Windows  | Main backup orchestrator | 571   |
| `detect-storage.sh`  | Linux    | Storage detection logic  | 283   |
| `detect-storage.ps1` | Windows  | Storage detection logic  | 311   |

**Features**:

- Automated backup scheduling
- Storage detection (USB, network, local)
- Compression and integrity checking
- Retention policy enforcement
- Cross-platform parity

### Monitoring Scripts (`scripts/monitoring/`)

**Purpose**: Phase 2 - Real-time health monitoring

| File               | Platform | Purpose                  | Lines |
| ------------------ | -------- | ------------------------ | ----- |
| `health-check.sh`  | Linux    | System health monitoring | 415   |
| `health-check.ps1` | Windows  | System health monitoring | 459   |

**Features**:

- Container status monitoring
- Resource usage tracking (CPU, memory, disk)
- Service availability checks
- Alerting capabilities
- Exit codes for automation (0=HEALTHY, 1=WARNING, 2=UNHEALTHY)

### Restore Scripts (`scripts/restore/`)

**Purpose**: Phase 3 - Comprehensive disaster recovery

| File                   | Platform | Purpose                   | Lines |
| ---------------------- | -------- | ------------------------- | ----- |
| `restore-database.sh`  | Linux    | Database restoration      | 504   |
| `restore-database.ps1` | Windows  | Database restoration      | 553   |
| `restore-config.sh`    | Linux    | Configuration restoration | 353   |
| `restore-config.ps1`   | Windows  | Configuration restoration | 405   |
| `full-restore.sh`      | Linux    | Full system recovery      | 586   |
| `full-restore.ps1`     | Windows  | Full system recovery      | 687   |

**Features**:

- Database backup restoration
- Configuration recovery
- Full system orchestration
- Pre-restore backup creation
- Integrity verification
- Rollback capability

### Installation Scripts (`scripts/`)

**Purpose**: System installation and management

| File                    | Platform | Purpose                  |
| ----------------------- | -------- | ------------------------ |
| `install-linux.sh`      | Linux    | Main installation script |
| `install-windows.ps1`   | Windows  | Main installation script |
| `uninstall-linux.sh`    | Linux    | Clean uninstallation     |
| `uninstall-windows.ps1` | Windows  | Clean uninstallation     |
| `build-package.sh`      | Linux    | Package builder          |
| `build-package.ps1`     | Windows  | Package builder          |
| `test-package.sh`       | Linux    | Package tester           |
| `test-package.ps1`      | Windows  | Package tester           |

---

## Template Organization

### Docker Compose (`templates/`)

**docker-compose.production.yml** - Production container orchestration:

- 7 service definitions (Traefik, 4 frontends, backend, database)
- Network configuration (aria-network bridge)
- Volume management (postgres-data, traefik-certs, uploads)
- Resource limits and reservations
- Health check definitions
- Restart policies

### Traefik Configuration (`templates/config/traefik/`)

**Path-based routing configuration**:

1. **static-ip-routes.yml** - HTTP routing rules:
   - Asset Management: `PathPrefix("/")`
   - CRM: `PathPrefix("/crm")`
   - HRMS: `PathPrefix("/hrms")`
   - Inventory: `PathPrefix("/inventory")`
   - Backend API: `PathPrefix("/api")`

2. **tls.yml** - SSL/TLS configuration:
   - Certificate file paths
   - TLS version requirements
   - Cipher suite configuration

3. **certs/** - SSL certificate storage:
   - Self-signed certificates (default)
   - OpenSSL configuration
   - Certificate documentation

### Service Templates

**aria-erp.service.template** - systemd service template for Linux:

- Service definition
- Dependency management
- Restart policies
- Environment configuration

---

## File Naming Conventions

### Scripts

- **Linux**: `.sh` extension, lowercase with hyphens (`backup-manager.sh`)
- **Windows**: `.ps1` extension, lowercase with hyphens (`backup-manager.ps1`)
- **Paired implementations**: Same base name across platforms

### Documentation

- **Uppercase names**: `README.md`, `INSTALLATION.md`, `CONFIGURATION.md`
- **Descriptive titles**: Clear indication of content
- **Markdown format**: All documentation in `.md` format

### Configuration

- **Lowercase names**: `docker-compose.production.yml`, `static-ip-routes.yml`
- **Descriptive suffixes**: `.template` for templates, `.yml` for YAML

---

## Cross-Platform Parity

### Script Pairs

Every operational script has Linux and Windows versions with identical functionality:

| Linux                 | Windows                 | Functionality        |
| --------------------- | ----------------------- | -------------------- |
| `backup-manager.sh`   | `backup-manager.ps1`    | Backup orchestration |
| `detect-storage.sh`   | `detect-storage.ps1`    | Storage detection    |
| `health-check.sh`     | `health-check.ps1`      | Health monitoring    |
| `restore-database.sh` | `restore-database.ps1`  | Database restoration |
| `restore-config.sh`   | `restore-config.ps1`    | Config restoration   |
| `full-restore.sh`     | `full-restore.ps1`      | Full recovery        |
| `install-linux.sh`    | `install-windows.ps1`   | Installation         |
| `uninstall-linux.sh`  | `uninstall-windows.ps1` | Uninstallation       |

### Feature Parity Validation

All scripts have been tested for:

- ✅ Identical functionality
- ✅ Consistent exit codes
- ✅ Matching log formats
- ✅ Same configuration options
- ✅ Equivalent error handling

---

## Documentation Cross-References

### Navigation Map

```
DEPLOYMENT_GUIDE.md (Start Here)
    ├── README.md (Quick Reference)
    ├── docs/INSTALLATION.md (Detailed Installation)
    ├── docs/CONFIGURATION.md (Configuration Details)
    ├── docs/TROUBLESHOOTING.md (Problem Resolution)
    ├── docs/SPECIFICATION.md (Technical Details)
    │
    ├── scripts/backup/README.md (Phase 1 Details)
    ├── scripts/monitoring/README.md (Phase 2 Details)
    └── scripts/restore/README.md (Phase 3 Details)
```

### Document Relationships

1. **DEPLOYMENT_GUIDE.md** → Primary entry point, references all others
2. **README.md** → Quick reference, points to DEPLOYMENT_GUIDE.md
3. **docs/\*.md** → Deep dives into specific topics from main guide
4. **scripts/\*/README.md** → Technical documentation for each phase

---

## Size Statistics

### Documentation

| File                    | Lines | Size   | Purpose            |
| ----------------------- | ----- | ------ | ------------------ |
| DEPLOYMENT_GUIDE.md     | 2,235 | ~100KB | Primary guide      |
| README.md               | 330   | ~15KB  | Quick reference    |
| docs/INSTALLATION.md    | ~800  | ~40KB  | Installation guide |
| docs/CONFIGURATION.md   | ~600  | ~30KB  | Config reference   |
| docs/TROUBLESHOOTING.md | ~500  | ~25KB  | Problem resolution |
| docs/SPECIFICATION.md   | ~700  | ~35KB  | Technical specs    |

### Scripts (Total Lines)

| Category     | Linux      | Windows    | Total      |
| ------------ | ---------- | ---------- | ---------- |
| Backup       | 800        | 882        | 1,682      |
| Monitoring   | 415        | 459        | 874        |
| Restore      | 1,443      | 1,645      | 3,088      |
| Installation | ~600       | ~700       | ~1,300     |
| **Total**    | **~3,258** | **~3,686** | **~6,944** |

---

## Maintenance Guidelines

### When Adding New Files

1. **Scripts**:
   - Place in appropriate phase folder (`backup/`, `monitoring/`, `restore/`)
   - Create both Linux (`.sh`) and Windows (`.ps1`) versions
   - Update respective README.md
   - Maintain naming conventions
   - Test cross-platform parity

2. **Documentation**:
   - Place detailed guides in `docs/`
   - Update DEPLOYMENT_GUIDE.md references
   - Update this FOLDER_ORGANIZATION.md
   - Add to navigation map
   - Cross-reference related documents

3. **Templates**:
   - Place configuration templates in `templates/`
   - Use `.template` suffix for templated files
   - Document all variables in comments
   - Update CONFIGURATION.md

### When Updating Files

1. Update "Last Updated" date in file header
2. Update size statistics in this document
3. Update cross-references if structure changes
4. Maintain backward compatibility when possible
5. Document breaking changes prominently

---

## Quick Access Paths

### Most Accessed Files

```bash
# Primary documentation
./DEPLOYMENT_GUIDE.md

# Quick reference
./README.md

# Operations
./scripts/backup/backup-manager.{sh,ps1}
./scripts/monitoring/health-check.{sh,ps1}
./scripts/restore/full-restore.{sh,ps1}

# Configuration
./templates/docker-compose.production.yml
./templates/config/traefik/static-ip-routes.yml
```

### Default Installation Paths

**Linux**:

```bash
/opt/aria-erp/                      # Installation directory
/opt/aria-erp/deployment/           # This deployment folder
/opt/aria-erp/backups/              # Backup storage
/var/log/aria-erp/                  # Log files
```

**Windows**:

```powershell
C:\ProgramData\Aria-ERP\            # Installation directory
C:\ProgramData\Aria-ERP\deployment\ # This deployment folder
C:\ProgramData\Aria-ERP\backups\    # Backup storage
# Logs in Windows Event Viewer
```

---

## Testing and Validation

### Testing Status

- **Total Tests**: 30
- **Passed**: 30 (100%)
- **Test Date**: October 4, 2025
- **Full Report**: `../TESTING_REPORT.md`

### Validated Components

✅ All scripts (Linux & Windows)  
✅ Documentation accuracy  
✅ Cross-platform parity  
✅ Installation procedures  
✅ Backup and restore functionality  
✅ Health monitoring  
✅ Security measures

---

## Related Documentation

- **Testing**: `../TESTING_REPORT.md` (6,500+ lines)
- **Security**: `../SECURITY_ASSESSMENT.md`
- **Progress**: `../IMPLEMENTATION_PROGRESS.md`
- **Architecture**: `../AGENTS.md`
- **Contributing**: `../CONTRIBUTING.md`

---

## Summary

The deployment folder is organized into clear, logical sections:

1. **Root Level**: Primary documentation and quick access guides
2. **docs/**: Detailed technical documentation
3. **scripts/**: All operational scripts organized by phase
4. **templates/**: Configuration templates and examples

This structure provides:

- ✅ Clear navigation path
- ✅ Logical grouping of related files
- ✅ Easy maintenance and updates
- ✅ Cross-platform consistency
- ✅ Comprehensive documentation coverage

---

**Deployment Folder Organization**  
**Version**: 1.0.0  
**Status**: Optimized and Documented
