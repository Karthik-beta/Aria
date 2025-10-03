# Aria ERP On-Premise Deployment

Production-ready deployment infrastructure for Aria ERP with **path-based routing** for static IP deployments.

## Overview

This deployment package provides everything needed to install and run Aria ERP in client environments:
- **Path-based routing**: All modules accessible via `https://<ip>/<module>/`
- **Static IP support**: Works with or without domain assignment
- **200 user capacity**: Optimized for ~200 concurrent users
- **Cross-platform**: Windows and Linux support
- **Modular licensing**: Enable only the modules you need

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

# Generate SSL certificate with all server IPs
sudo ./scripts/generate-ssl-cert-linux.sh ./volumes/traefik

# Load Docker images
sudo ./scripts/load-images.sh

# Install (modules: full, asset,crm, hrms, or inventory)
sudo ./scripts/install-linux.sh --modules full
```

**Windows (PowerShell as Administrator):**
```powershell
# Extract ZIP file
cd aria-erp-v0.1.0

# Generate SSL certificate with all server IPs
.\scripts\generate-ssl-cert-windows.ps1

# Load Docker images
.\scripts\load-images.ps1

# Install (modules: full, asset,crm, hrms, or inventory)
.\scripts\install-windows.ps1 -Modules "full"
```

**Access after installation:**
```
https://<server-ip>/asset/
https://<server-ip>/crm/
https://<server-ip>/hrms/
https://<server-ip>/inventory/
```

## Access URLs

After installation, access modules via:
- `https://<server-ip>/asset/` - Asset Management
- `https://<server-ip>/crm/` - Customer Relationship Management
- `https://<server-ip>/hrms/` - Human Resources
- `https://<server-ip>/inventory/` - Inventory Management
- `https://<server-ip>/api/` - Backend API

## Documentation

- **[Path-Based Routing](docs/PATH_BASED_ROUTING.md)** - URL structure and SSL configuration ✨
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

- ✅ **Path-Based Routing**: Single IP/domain, multi-module access via paths
- ✅ **Static IP Support**: Works without domain (certificate includes all server IPs)
- ✅ **200 User Capacity**: Optimized PostgreSQL tuning and rate limiting
- ✅ **Cross-Platform**: Windows 10/11 and Linux (Ubuntu, Debian, RHEL)
- ✅ **Modular Licensing**: Enable only needed modules to save resources
- ✅ **Auto-SSL Generation**: Scripts generate certificates with all server IPs
- ✅ **Secure**: SSL/TLS support with security headers and rate limiting
- ✅ **System Service**: systemd (Linux) or Scheduled Tasks (Windows) integration
- ✅ **Auto-Restart**: Automatic service recovery on failure or reboot
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
