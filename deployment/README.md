# Aria ERP Deployment Guide# Aria ERP On-Premise Deployment



Professional on-premise deployment infrastructure for Aria ERP with path-based routing optimized for enterprise environments.Production-ready deployment infrastructure for Aria ERP with **path-based routing** for static IP deployments.



## Overview## Overview



The Aria ERP deployment package provides a complete, production-ready solution for installing and running Aria ERP in client environments:This deployment package provides everything needed to install and run Aria ERP in client environments:

- **Path-based routing**: All modules accessible via `https://<ip>/<module>/`

- **Path-Based Routing**: Access all modules via `https://<ip>/<module>/`- **Static IP support**: Works with or without domain assignment

- **Static IP Support**: No domain name required- **200 user capacity**: Optimized for ~200 concurrent users

- **Scalable**: Optimized for ~200 concurrent users- **Cross-platform**: Windows and Linux support

- **Cross-Platform**: Native Windows and Linux support- **Modular licensing**: Enable only the modules you need

- **Modular**: Enable only the modules you need

## Quick Start

## Quick Start

### Prerequisites

### System Requirements

- Docker 20.10+ and Docker Compose 2.0+

**Minimum:**- 4GB RAM minimum, 8GB recommended

- 2 CPU cores- 20GB free disk space

- 4 GB RAM- Ports 80 and 443 available

- 20 GB disk space

- Docker 20.10+ and Docker Compose 2.0+### Installation

- Ports 80 and 443 available

**Linux:**

**Recommended:**```bash

- 4 CPU cores# Extract package

- 8 GB RAMtar -xzf aria-erp-v0.1.0-linux.tar.gz

- 50 GB SSDcd aria-erp-v0.1.0

- 1 Gbps network

# Generate SSL certificate with all server IPs

### Supported Platformssudo ./scripts/generate-ssl-cert-linux.sh ./volumes/traefik



- **Linux**: Ubuntu 20.04+, Debian 11+, RHEL/CentOS 8+# Load Docker images

- **Windows**: Windows 10/11, Server 2019+sudo ./scripts/load-images.sh



### Installation# Install (modules: full, asset,crm, hrms, or inventory)

sudo ./scripts/install-linux.sh --modules full

**Linux:**```

```bash

# Extract package**Windows (PowerShell as Administrator):**

tar -xzf aria-erp-v{version}-linux.tar.gz```powershell

cd aria-erp-v{version}# Extract ZIP file

cd aria-erp-v0.1.0

# Load Docker images

sudo ./bin/load-images.sh# Generate SSL certificate with all server IPs

.\scripts\generate-ssl-cert-windows.ps1

# Install with all modules

sudo ./bin/install-linux.sh --modules full# Load Docker images

```.\scripts\load-images.ps1



**Windows (Run as Administrator):**# Install (modules: full, asset,crm, hrms, or inventory)

```powershell.\scripts\install-windows.ps1 -Modules "full"

# Extract ZIP and navigate to folder```

cd aria-erp-v{version}

**Access after installation:**

# Load Docker images```

.\bin\load-images.ps1https://<server-ip>/asset/

https://<server-ip>/crm/

# Install with all moduleshttps://<server-ip>/hrms/

.\bin\install-windows.ps1 -Modules "full"https://<server-ip>/inventory/

``````



### Access URLs## Access URLs



After installation, access the application at:After installation, access modules via:

- `https://<server-ip>/asset/` - Asset Management

```- `https://<server-ip>/crm/` - Customer Relationship Management

https://<server-ip>/asset/       # Asset Management- `https://<server-ip>/hrms/` - Human Resources

https://<server-ip>/crm/         # Customer Relationship Management- `https://<server-ip>/inventory/` - Inventory Management

https://<server-ip>/hrms/        # Human Resources- `https://<server-ip>/api/` - Backend API

https://<server-ip>/inventory/   # Inventory Management

https://<server-ip>/api/         # Backend API## Documentation

```

- **[Path-Based Routing](docs/PATH_BASED_ROUTING.md)** - URL structure and SSL configuration ✨

## Available Modules- [Installation Guide](docs/INSTALLATION.md) - Detailed installation instructions

- [Configuration Reference](docs/CONFIGURATION.md) - Configuration options and settings

| Module | Description | License Key |- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions

|--------|-------------|-------------|

| Asset | Asset management and tracking | `asset` |## Package Structure

| CRM | Customer relationship management | `crm` |

| HRMS | Human resources and payroll | `hrms` |```

| Inventory | Inventory control and warehousing | `inventory` |aria-erp-v{version}/

├── bin/

**Module Selection:**│   ├── install-linux.sh           # Linux installation script

│   ├── install-windows.ps1        # Windows installation script

```bash│   ├── uninstall-linux.sh         # Linux removal script

# Install all modules│   ├── uninstall-windows.ps1      # Windows removal script

--modules full│   ├── load-images.sh             # Load Docker images (Linux)

│   └── load-images.ps1            # Load Docker images (Windows)

# Install specific modules├── images/

--modules asset,crm,hrms│   └── *.tar                      # Pre-built Docker images

```├── config/

│   └── traefik/                   # Traefik proxy configuration

## Package Contents├── docs/

│   ├── INSTALLATION.md

```│   ├── CONFIGURATION.md

aria-erp-v{version}/│   └── TROUBLESHOOTING.md

├── bin/                       # Installation scripts├── docker-compose.production.yml  # Production Docker Compose

│   ├── install-linux.sh├── .env.template                  # Environment configuration template

│   ├── install-windows.ps1└── VERSION                        # Package version

│   ├── uninstall-linux.sh```

│   ├── uninstall-windows.ps1

│   ├── load-images.sh## Features

│   └── load-images.ps1

├── images/                    # Docker images (*.tar)- ✅ **Path-Based Routing**: Single IP/domain, multi-module access via paths

├── config/                    # Configuration templates- ✅ **Static IP Support**: Works without domain (certificate includes all server IPs)

│   └── traefik/              # Reverse proxy configuration- ✅ **200 User Capacity**: Optimized PostgreSQL tuning and rate limiting

├── docs/                      # Documentation- ✅ **Cross-Platform**: Windows 10/11 and Linux (Ubuntu, Debian, RHEL)

│   ├── INSTALLATION.md- ✅ **Modular Licensing**: Enable only needed modules to save resources

│   ├── CONFIGURATION.md- ✅ **Auto-SSL Generation**: Scripts generate certificates with all server IPs

│   ├── SPECIFICATION.md- ✅ **Secure**: SSL/TLS support with security headers and rate limiting

│   └── TROUBLESHOOTING.md- ✅ **System Service**: systemd (Linux) or Scheduled Tasks (Windows) integration

├── docker-compose.production.yml- ✅ **Auto-Restart**: Automatic service recovery on failure or reboot

├── .env.template- ✅ **Production-Ready**: Optimized Docker images with health checks

└── VERSION- ✅ **Simple**: Easy installation with minimal configuration

```

## Module Selection

## Service Management

Available modules:

### Linux (systemd)- **asset** - Asset Management

- **crm** - Customer Relationship Management

```bash- **hrms** - Human Resource Management System

# Start service- **inventory** - Inventory Management

sudo systemctl start aria-erp

Install all modules:

# Stop service```bash

sudo systemctl stop aria-erp--modules full

```

# Restart service

sudo systemctl restart aria-erpInstall specific modules:

```bash

# Check status--modules asset,crm,hrms

sudo systemctl status aria-erp```



# View logs## Service Management

sudo journalctl -u aria-erp -f

```### Linux



### Windows (Scheduled Tasks)```bash

# Start

```powershellsudo systemctl start aria-erp

# Start service

Start-ScheduledTask -TaskName "AriaERP"# Stop

sudo systemctl stop aria-erp

# Stop service

cd "C:\Program Files\AriaERP"# Restart

docker compose downsudo systemctl restart aria-erp



# View status# Status

docker compose pssudo systemctl status aria-erp



# View logs# Logs

docker compose logs -fsudo journalctl -u aria-erp -f

``````



## Configuration### Windows



Configuration is managed through environment variables in the `.env` file:```powershell

# Start

```envStart-ScheduledTask -TaskName "AriaERP"

# Server Configuration

DOMAIN=localhost# Stop

cd "C:\Program Files\AriaERP"

# Databasedocker compose down

POSTGRES_DB=aria

POSTGRES_USER=aria# Status

POSTGRES_PASSWORD=<auto-generated>docker compose ps



# Modules# Logs

LICENSED_MODULES=fulldocker compose logs -f

```

# Application

VERSION=0.1.0## Configuration

NODE_ENV=production

```Configuration is managed through the `.env` file:



## Security```env

# Domain Configuration

- **SSL/TLS**: Self-signed certificates generated during installationDOMAIN=localhost

- **Password Generation**: Database passwords auto-generated

- **Network**: Designed for private network deployment# Database Configuration

- **Rate Limiting**: 100 requests/second per IPPOSTGRES_DB=aria

- **Security Headers**: HSTS, XSS protection, frame denyPOSTGRES_USER=aria

POSTGRES_PASSWORD=secure_password_here

## Backup & Restore

# Licensed Modules

### Database BackupLICENSED_MODULES=full



```bash# Version

# Create backupVERSION=latest

docker exec aria-database pg_dump -U aria aria > backup-$(date +%Y%m%d).sql```



# Restore from backup## Accessing the Application

cat backup.sql | docker exec -i aria-database psql -U aria -d aria

```After installation:



### Configuration Backup- **Backend API**: `https://{DOMAIN}/api`

- **Asset Module**: `https://asset.{DOMAIN}`

```bash- **CRM Module**: `https://crm.{DOMAIN}`

# Backup configuration- **HRMS Module**: `https://hrms.{DOMAIN}`

cp .env .env.backup- **Inventory Module**: `https://inventory.{DOMAIN}`



# Restore configuration## System Requirements

cp .env.backup .env

```### Minimum

- **CPU**: 2 cores

## Updating- **RAM**: 4 GB

- **Storage**: 20 GB

1. Stop the current installation- **OS**: Ubuntu 20.04+, Debian 11+, CentOS 8+, Windows 10/11, Windows Server 2019+

2. Extract the new version package

3. Load new Docker images: `./bin/load-images.sh`### Recommended

4. Run installation script (preserves data)- **CPU**: 4 cores

- **RAM**: 8 GB

## Uninstallation- **Storage**: 50 GB SSD

- **Network**: 1 Gbps

**Linux:**

```bash## Security

sudo ./bin/uninstall-linux.sh

```- Database passwords are auto-generated during installation

- SSL/TLS encryption supported

**Windows:**- Code is obfuscated (no source code exposed)

```powershell- Regular security updates via Docker images

.\bin\uninstall-windows.ps1- Designed for private network deployment

```

## Backup and Restore

**Note**: Database data is preserved. To remove all data, use the `--remove-data` flag.

**Backup:**

## Documentation```bash

# Database

- **[Installation Guide](docs/INSTALLATION.md)** - Detailed installation proceduresdocker exec aria-database pg_dump -U aria aria > backup-$(date +%Y%m%d).sql

- **[Configuration Reference](docs/CONFIGURATION.md)** - Complete configuration options

- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions# Configuration

- **[Specification](docs/SPECIFICATION.md)** - Technical specificationscp .env .env.backup

```

## Features

**Restore:**

- ✅ Single IP/domain deployment```bash

- ✅ Path-based module routing# Database

- ✅ Auto-start on system bootcat backup.sql | docker exec -i aria-database psql -U aria -d aria

- ✅ Automatic service recovery```

- ✅ Health monitoring

- ✅ Comprehensive logging## Updating

- ✅ Zero-downtime updates

- ✅ SSL/TLS encryption1. Stop the current installation

- ✅ Resource optimization2. Extract new version package

- ✅ Professional support3. Load new Docker images

4. Run installation script (preserves data and configuration)

## Support

## Uninstallation

For assistance:

**Linux:**

1. Review the [Troubleshooting Guide](docs/TROUBLESHOOTING.md)```bash

2. Check application logssudo ./bin/uninstall-linux.sh

3. Contact your system administrator```

4. Refer to technical documentation

**Windows:**

## License```powershell

.\bin\uninstall-windows.ps1

Proprietary software. See LICENSE file for terms and conditions.```



---This removes all services, containers, and installation files. Database data is preserved unless explicitly removed.



**Package Version**: 0.1.0  ## Support

**Release Date**: October 2025  

**Minimum Docker Version**: 20.10  For issues or questions:

**Minimum Compose Version**: 2.0

1. Check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
2. Review logs for error messages
3. Contact your system administrator

## License

This deployment package is part of Aria ERP. See included LICENSE file for details.

---

**Version**: 0.1.0  
**Build Date**: October 3, 2025  
**Supported Platforms**: Linux (Ubuntu, Debian, CentOS, RHEL), Windows (10/11, Server 2019/2022)
