# Aria ERP On-Premise Deployment

Production-ready deployment infrastructure for Aria ERP on-premise installations.

## Overview

This deployment package provides everything needed to install and run Aria ERP in client environments, supporting both Windows and Linux platforms with modular frontend selection based on licensing.

## Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- 4GB RAM minimum, 8GB recommended
- 20GB free disk space
- Ports 80 and 443 available

### Installation

**Linux:**
```bash
# Extract package
tar -xzf aria-erp-v0.1.0-linux.tar.gz
cd aria-erp-v0.1.0

# Load Docker images
sudo ./bin/load-images.sh

# Install
sudo ./bin/install-linux.sh --domain erp.company.com --modules full
```

**Windows:**
```powershell
# Extract ZIP file and open PowerShell as Administrator
cd aria-erp-v0.1.0

# Load Docker images
.\bin\load-images.ps1

# Install
.\bin\install-windows.ps1 -Domain "erp.company.com" -Modules "full"
```

## Documentation

- [Installation Guide](docs/INSTALLATION.md) - Detailed installation instructions
- [Configuration Reference](docs/CONFIGURATION.md) - Configuration options and settings
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions

## Package Structure

```
aria-erp-v{version}/
├── bin/
│   ├── install-linux.sh           # Linux installation script
│   ├── install-windows.ps1        # Windows installation script
│   ├── uninstall-linux.sh         # Linux removal script
│   ├── uninstall-windows.ps1      # Windows removal script
│   ├── load-images.sh             # Load Docker images (Linux)
│   └── load-images.ps1            # Load Docker images (Windows)
├── images/
│   └── *.tar                      # Pre-built Docker images
├── config/
│   └── traefik/                   # Traefik proxy configuration
├── docs/
│   ├── INSTALLATION.md
│   ├── CONFIGURATION.md
│   └── TROUBLESHOOTING.md
├── docker-compose.production.yml  # Production Docker Compose
├── .env.template                  # Environment configuration template
└── VERSION                        # Package version
```

## Features

- ✅ **Cross-Platform**: Supports Windows and Linux
- ✅ **Modular**: Selective frontend deployment based on licensing
- ✅ **Secure**: Code obfuscation, SSL/TLS support
- ✅ **Automated**: System service integration with auto-restart
- ✅ **Production-Ready**: Optimized Docker images with health checks
- ✅ **Simple**: Easy installation with minimal configuration

## Module Selection

Available modules:
- **asset** - Asset Management
- **crm** - Customer Relationship Management
- **hrms** - Human Resource Management System
- **inventory** - Inventory Management

Install all modules:
```bash
--modules full
```

Install specific modules:
```bash
--modules asset,crm,hrms
```

## Service Management

### Linux

```bash
# Start
sudo systemctl start aria-erp

# Stop
sudo systemctl stop aria-erp

# Restart
sudo systemctl restart aria-erp

# Status
sudo systemctl status aria-erp

# Logs
sudo journalctl -u aria-erp -f
```

### Windows

```powershell
# Start
Start-ScheduledTask -TaskName "AriaERP"

# Stop
cd "C:\Program Files\AriaERP"
docker compose down

# Status
docker compose ps

# Logs
docker compose logs -f
```

## Configuration

Configuration is managed through the `.env` file:

```env
# Domain Configuration
DOMAIN=localhost

# Database Configuration
POSTGRES_DB=aria
POSTGRES_USER=aria
POSTGRES_PASSWORD=secure_password_here

# Licensed Modules
LICENSED_MODULES=full

# Version
VERSION=latest
```

## Accessing the Application

After installation:

- **Backend API**: `https://{DOMAIN}/api`
- **Asset Module**: `https://asset.{DOMAIN}`
- **CRM Module**: `https://crm.{DOMAIN}`
- **HRMS Module**: `https://hrms.{DOMAIN}`
- **Inventory Module**: `https://inventory.{DOMAIN}`

## System Requirements

### Minimum
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 20 GB
- **OS**: Ubuntu 20.04+, Debian 11+, CentOS 8+, Windows 10/11, Windows Server 2019+

### Recommended
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 50 GB SSD
- **Network**: 1 Gbps

## Security

- Database passwords are auto-generated during installation
- SSL/TLS encryption supported
- Code is obfuscated (no source code exposed)
- Regular security updates via Docker images
- Designed for private network deployment

## Backup and Restore

**Backup:**
```bash
# Database
docker exec aria-database pg_dump -U aria aria > backup-$(date +%Y%m%d).sql

# Configuration
cp .env .env.backup
```

**Restore:**
```bash
# Database
cat backup.sql | docker exec -i aria-database psql -U aria -d aria
```

## Updating

1. Stop the current installation
2. Extract new version package
3. Load new Docker images
4. Run installation script (preserves data and configuration)

## Uninstallation

**Linux:**
```bash
sudo ./bin/uninstall-linux.sh
```

**Windows:**
```powershell
.\bin\uninstall-windows.ps1
```

This removes all services, containers, and installation files. Database data is preserved unless explicitly removed.

## Support

For issues or questions:

1. Check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
2. Review logs for error messages
3. Contact your system administrator

## License

This deployment package is part of Aria ERP. See included LICENSE file for details.

---

**Version**: 0.1.0  
**Build Date**: October 3, 2025  
**Supported Platforms**: Linux (Ubuntu, Debian, CentOS, RHEL), Windows (10/11, Server 2019/2022)
