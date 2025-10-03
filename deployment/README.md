# Aria ERP On-Premise Deployment# Aria ERP On-Premise Deployment# Aria ERP On-Premise Deployment



Production-ready deployment infrastructure for Aria ERP with **path-based routing** for static IP deployments.



## OverviewProduction-ready deployment infrastructure for Aria ERP with **path-based routing** for static IP deployments.Production-ready deployment infrastructure for Aria ERP with **path-based routing** for static IP deployments.



This deployment package provides everything needed to install and run Aria ERP in client environments:



- **Path-Based Routing**: Access all modules via `https://<ip>/<module>/`## Overview## Overview

- **Static IP Support**: No domain name required  

- **200 User Capacity**: Optimized for ~200 concurrent users

- **Cross-Platform**: Native Windows and Linux support

- **Modular**: Enable only the modules you needThis deployment package provides everything needed to install and run Aria ERP in client environments:This deployment package provides everything needed to install and run Aria ERP in client environments:



## Quick Start



### Prerequisites- **Path-Based Routing**: Access all modules via `https://<ip>/<module>/`- **Path-Based Routing**: Access all modules via `https://<ip>/<module>/`



**Minimum Requirements:**- **Static IP Support**: No domain name required- **Static IP Support**: No domain name required

- 2 CPU cores

- 4 GB RAM- **200 User Capacity**: Optimized for ~200 concurrent users- **200 User Capacity**: Optimized for ~200 concurrent users

- 20 GB disk space

- Docker 20.10+ and Docker Compose 2.0+- **Cross-Platform**: Native Windows and Linux support- **Cross-Platform**: Native Windows and Linux support

- Ports 80 and 443 available

- **Modular**: Enable only the modules you need- **Modular**: Enable only the modules you need

**Recommended:**

- 4 CPU cores

- 8 GB RAM

- 50 GB SSD## Quick Start## Quick Start

- 1 Gbps network



**Supported Platforms:**

- **Linux**: Ubuntu 20.04+, Debian 11+, RHEL/CentOS 8+### Prerequisites### Prerequisites

- **Windows**: Windows 10/11, Server 2019+



### Installation

**Minimum Requirements:****Minimum Requirements:**

**Linux:**

- 2 CPU cores- 2 CPU cores

```bash

# Extract package- 4 GB RAM- 4 GB RAM

tar -xzf aria-erp-v0.1.0-linux.tar.gz

cd aria-erp-v0.1.0- 20 GB disk space- 20 GB disk space



# Load Docker images- Docker 20.10+ and Docker Compose 2.0+- Docker 20.10+ and Docker Compose 2.0+

sudo ./bin/load-images.sh

- Ports 80 and 443 available- Ports 80 and 443 available

# Install (modules: full, asset, crm, hrms, or inventory)

sudo ./bin/install-linux.sh --modules full

```

**Recommended:****Recommended:**

**Windows (PowerShell as Administrator):**

- 4 CPU cores- 4 CPU cores

```powershell

# Extract ZIP file and navigate to folder- 8 GB RAM- 8 GB RAM

cd aria-erp-v0.1.0

- 50 GB SSD- 50 GB SSD

# Load Docker images

.\bin\load-images.ps1- 1 Gbps network- 1 Gbps network



# Install (modules: full, asset, crm, hrms, or inventory)

.\bin\install-windows.ps1 -Modules "full"

```**Supported Platforms:****Supported Platforms:**



### Access URLs- **Linux**: Ubuntu 20.04+, Debian 11+, RHEL/CentOS 8+- **Linux**: Ubuntu 20.04+, Debian 11+, RHEL/CentOS 8+



After installation, access modules via:- **Windows**: Windows 10/11, Server 2019+- **Windows**: Windows 10/11, Server 2019+



```

https://<server-ip>/asset/       # Asset Management

https://<server-ip>/crm/         # Customer Relationship Management### Installation### Installation

https://<server-ip>/hrms/        # Human Resources

https://<server-ip>/inventory/   # Inventory Management

https://<server-ip>/api/         # Backend API

```**Linux:****Linux:**



## Documentation



- **[Installation Guide](docs/INSTALLATION.md)** - Detailed installation instructions```bash```bash

- **[Configuration Reference](docs/CONFIGURATION.md)** - Configuration options and settings

- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions# Extract package# Extract package

- **[Specification](docs/SPECIFICATION.md)** - Technical specifications

- **[Development Guide](DEVELOPMENT.md)** - Building and testing the packagetar -xzf aria-erp-v0.1.0-linux.tar.gztar -xzf aria-erp-v0.1.0-linux.tar.gz



## Available Modulescd aria-erp-v0.1.0cd aria-erp-v0.1.0



| Module | Description | License Key |

|--------|-------------|-------------|

| Asset | Asset management and tracking | `asset` |# Generate SSL certificate# Generate SSL certificate with all server IPs

| CRM | Customer relationship management | `crm` |

| HRMS | Human resources and payroll | `hrms` |sudo ./scripts/generate-ssl-cert-linux.shsudo ./scripts/generate-ssl-cert-linux.sh ./volumes/traefik

| Inventory | Inventory control and warehousing | `inventory` |



**Module Selection:**

# Load Docker images# Load Docker images

```bash

# Install all modulessudo ./scripts/load-images.sh

--modules full

- **Windows**: Windows 10/11, Server 2019+sudo ./scripts/load-images.sh

# Install specific modules

--modules asset,crm,hrms# Install (modules: full, asset, crm, hrms, or inventory)

```

sudo ./scripts/install-linux.sh --modules full

## Package Structure

```

The extracted deployment package has the following structure:

### Installation# Install (modules: full, asset,crm, hrms, or inventory)

```

aria-erp-v{version}/**Windows (PowerShell as Administrator):**

├── bin/

│   ├── install-linux.sh           # Linux installation scriptsudo ./scripts/install-linux.sh --modules full

│   ├── install-windows.ps1        # Windows installation script

│   ├── uninstall-linux.sh         # Linux removal script```powershell

│   ├── uninstall-windows.ps1      # Windows removal script

│   ├── load-images.sh             # Load Docker images (Linux)# Extract ZIP file and navigate to folder**Linux:**```

│   └── load-images.ps1            # Load Docker images (Windows)

├── images/cd aria-erp-v0.1.0

│   └── *.tar                      # Pre-built Docker images

├── config/```bash

│   └── traefik/                   # Traefik proxy configuration

├── docs/# Generate SSL certificate

│   ├── INSTALLATION.md            # Installation guide

│   ├── CONFIGURATION.md           # Configuration reference.\scripts\generate-ssl-cert-windows.ps1# Extract package**Windows (PowerShell as Administrator):**

│   ├── SPECIFICATION.md           # Technical specifications

│   └── TROUBLESHOOTING.md         # Troubleshooting guide

├── docker-compose.production.yml  # Production Docker Compose

├── .env.template                  # Environment configuration template# Load Docker imagestar -xzf aria-erp-v{version}-linux.tar.gz```powershell

└── VERSION                        # Package version

```.\scripts\load-images.ps1



## Featurescd aria-erp-v{version}# Extract ZIP file



- ✅ **Path-Based Routing**: Single IP/domain, multi-module access via paths# Install (modules: full, asset, crm, hrms, or inventory)

- ✅ **Static IP Support**: Works without domain (certificate includes all server IPs)

- ✅ **200 User Capacity**: Optimized PostgreSQL tuning and rate limiting.\scripts\install-windows.ps1 -Modules "full"cd aria-erp-v0.1.0

- ✅ **Cross-Platform**: Windows 10/11 and Linux (Ubuntu, Debian, RHEL)

- ✅ **Modular Licensing**: Enable only needed modules to save resources```

- ✅ **Secure**: SSL/TLS support with security headers and rate limiting

- ✅ **System Service**: systemd (Linux) or Scheduled Tasks (Windows) integration# Load Docker images

- ✅ **Auto-Restart**: Automatic service recovery on failure or reboot

- ✅ **Production-Ready**: Optimized Docker images with health checks### Access URLs

- ✅ **Simple**: Easy installation with minimal configuration

sudo ./bin/load-images.sh# Generate SSL certificate with all server IPs

## Service Management

After installation, access modules via:

### Linux (systemd)

.\scripts\generate-ssl-cert-windows.ps1

```bash

# Start service```

sudo systemctl start aria-erp

https://<server-ip>/asset/       # Asset Management# Install with all modules

# Stop service

sudo systemctl stop aria-erphttps://<server-ip>/crm/         # Customer Relationship Management



# Restart servicehttps://<server-ip>/hrms/        # Human Resourcessudo ./bin/install-linux.sh --modules full# Load Docker images

sudo systemctl restart aria-erp

https://<server-ip>/inventory/   # Inventory Management

# Check status

sudo systemctl status aria-erphttps://<server-ip>/api/         # Backend API```.\scripts\load-images.ps1



# View logs```

sudo journalctl -u aria-erp -f

```



### Windows (Scheduled Tasks)## Documentation



```powershell**Windows (Run as Administrator):**# Install (modules: full, asset,crm, hrms, or inventory)

# Start service

Start-ScheduledTask -TaskName "AriaERP"- **[Installation Guide](docs/INSTALLATION.md)** - Detailed installation instructions



# Stop service- **[Configuration Reference](docs/CONFIGURATION.md)** - Configuration options and settings```powershell.\scripts\install-windows.ps1 -Modules "full"

cd "C:\Program Files\AriaERP"

docker compose down- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions



# View status- **[Specification](docs/SPECIFICATION.md)** - Technical specifications# Extract ZIP and navigate to folder```

docker compose ps



# View logs

docker compose logs -f## Available Modulescd aria-erp-v{version}

```



## Configuration

| Module | Description | License Key |**Access after installation:**

Configuration is managed through the `.env` file:

|--------|-------------|-------------|

```env

# Domain Configuration| Asset | Asset management and tracking | `asset` |# Load Docker images```

DOMAIN=localhost

| CRM | Customer relationship management | `crm` |

# Database Configuration

POSTGRES_DB=aria| HRMS | Human resources and payroll | `hrms` |.\bin\load-images.ps1https://<server-ip>/asset/

POSTGRES_USER=aria

POSTGRES_PASSWORD=secure_password_here| Inventory | Inventory control and warehousing | `inventory` |



# Licensed Moduleshttps://<server-ip>/crm/

LICENSED_MODULES=full

**Module Selection:**

# Version

VERSION=latest# Install with all moduleshttps://<server-ip>/hrms/

```

```bash

## System Requirements

# Install all modules.\bin\install-windows.ps1 -Modules "full"https://<server-ip>/inventory/

### Minimum

--modules full

- **CPU**: 2 cores

- **RAM**: 4 GB``````

- **Storage**: 20 GB

- **OS**: Ubuntu 20.04+, Debian 11+, CentOS 8+, Windows 10/11, Windows Server 2019+# Install specific modules



### Recommended--modules asset,crm,hrms



- **CPU**: 4 cores```

- **RAM**: 8 GB

- **Storage**: 50 GB SSD### Access URLs## Access URLs

- **Network**: 1 Gbps

## Package Structure

## Security



- Database passwords are auto-generated during installation

- SSL/TLS encryption supported```

- Security headers enabled (HSTS, XSS protection, frame deny)

- Rate limiting: 100 requests/second per IParia-erp-v{version}/After installation, access the application at:After installation, access modules via:

- Designed for private network deployment

├── scripts/

## Backup and Restore

│   ├── install-linux.sh           # Linux installation script- `https://<server-ip>/asset/` - Asset Management

**Backup:**

│   ├── install-windows.ps1        # Windows installation script

```bash

# Database│   ├── uninstall-linux.sh         # Linux removal script```- `https://<server-ip>/crm/` - Customer Relationship Management

docker exec aria-database pg_dump -U aria aria > backup-$(date +%Y%m%d).sql

│   ├── uninstall-windows.ps1      # Windows removal script

# Configuration

cp .env .env.backup│   ├── load-images.sh             # Load Docker images (Linux)https://<server-ip>/asset/       # Asset Management- `https://<server-ip>/hrms/` - Human Resources

```

│   ├── load-images.ps1            # Load Docker images (Windows)

**Restore:**

│   ├── generate-ssl-cert-linux.sh # SSL certificate generator (Linux)https://<server-ip>/crm/         # Customer Relationship Management- `https://<server-ip>/inventory/` - Inventory Management

```bash

# Database│   └── generate-ssl-cert-windows.ps1 # SSL certificate generator (Windows)

cat backup.sql | docker exec -i aria-database psql -U aria -d aria

├── images/https://<server-ip>/hrms/        # Human Resources- `https://<server-ip>/api/` - Backend API

# Configuration

cp .env.backup .env│   └── *.tar                      # Pre-built Docker images

```

├── config/https://<server-ip>/inventory/   # Inventory Management

## Updating

│   └── traefik/                   # Traefik proxy configuration

1. Stop the current installation

2. Extract new version package├── docs/https://<server-ip>/api/         # Backend API## Documentation

3. Load new Docker images

4. Run installation script (preserves data and configuration)│   ├── INSTALLATION.md



## Uninstallation│   ├── CONFIGURATION.md```



**Linux:**│   ├── SPECIFICATION.md



```bash│   └── TROUBLESHOOTING.md- **[Path-Based Routing](docs/PATH_BASED_ROUTING.md)** - URL structure and SSL configuration ✨

sudo ./bin/uninstall-linux.sh

```├── docker-compose.production.yml  # Production Docker Compose



**Windows:**├── .env.template                  # Environment configuration template## Documentation



```powershell└── VERSION                        # Package version

.\bin\uninstall-windows.ps1

``````- **[Installation Guide](docs/INSTALLATION.md)** - Detailed installation instructions



This removes all services, containers, and installation files. Database data is preserved unless explicitly removed with `--remove-data` flag.- **[Configuration Reference](docs/CONFIGURATION.md)** - Configuration options and settings



## Support## Features- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions



For issues or questions:- **[Specification](docs/SPECIFICATION.md)** - Technical specifications



1. Check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md)- ✅ **Path-Based Routing**: Single IP/domain, multi-module access via paths

2. Review logs for error messages

3. Contact your system administrator- ✅ **Static IP Support**: Works without domain (certificate includes all server IPs)## Available Modules



## License- ✅ **200 User Capacity**: Optimized PostgreSQL tuning and rate limiting



This deployment package is part of Aria ERP. See included LICENSE file for details.- ✅ **Cross-Platform**: Windows 10/11 and Linux (Ubuntu, Debian, RHEL)| Module | Description | License Key |



---- ✅ **Modular Licensing**: Enable only needed modules to save resources|--------|-------------|-------------|



**Version**: 0.1.0  - ✅ **Auto-SSL Generation**: Scripts generate certificates with all server IPs| Asset | Asset management and tracking | `asset` |

**Build Date**: October 3, 2025  

**Supported Platforms**: Linux (Ubuntu, Debian, CentOS, RHEL), Windows (10/11, Server 2019/2022)- ✅ **Secure**: SSL/TLS support with security headers and rate limiting| CRM | Customer relationship management | `crm` |


- ✅ **System Service**: systemd (Linux) or Scheduled Tasks (Windows) integration| HRMS | Human resources and payroll | `hrms` |

- ✅ **Auto-Restart**: Automatic service recovery on failure or reboot| Inventory | Inventory control and warehousing | `inventory` |

- ✅ **Production-Ready**: Optimized Docker images with health checks

- ✅ **Simple**: Easy installation with minimal configuration**Module Selection:**



## Service Management```bash

# Install all modules

### Linux (systemd)--modules full



```bash# Install specific modules

# Start service--modules asset,crm,hrms

sudo systemctl start aria-erp```



# Stop service## Package Structure

sudo systemctl stop aria-erp

```

# Restart servicearia-erp-v{version}/

sudo systemctl restart aria-erp

├── bin/

# Check status

sudo systemctl status aria-erp**Module Selection:**│   ├── install-linux.sh           # Linux installation script



# View logs│   ├── install-windows.ps1        # Windows installation script

sudo journalctl -u aria-erp -f

``````bash│   ├── uninstall-linux.sh         # Linux removal script



### Windows (Scheduled Tasks)# Install all modules│   ├── uninstall-windows.ps1      # Windows removal script



```powershell--modules full│   ├── load-images.sh             # Load Docker images (Linux)

# Start service

Start-ScheduledTask -TaskName "AriaERP"│   └── load-images.ps1            # Load Docker images (Windows)



# Stop service# Install specific modules├── images/

cd "C:\Program Files\AriaERP"

docker compose down--modules asset,crm,hrms│   └── *.tar                      # Pre-built Docker images



# View status```├── config/

docker compose ps

│   └── traefik/                   # Traefik proxy configuration

# View logs

docker compose logs -f## Package Contents├── docs/

```

│   ├── INSTALLATION.md

## Configuration

```│   ├── CONFIGURATION.md

Configuration is managed through the `.env` file:

aria-erp-v{version}/│   └── TROUBLESHOOTING.md

```env

# Domain Configuration├── bin/                       # Installation scripts├── docker-compose.production.yml  # Production Docker Compose

DOMAIN=localhost

│   ├── install-linux.sh├── .env.template                  # Environment configuration template

# Database Configuration

POSTGRES_DB=aria│   ├── install-windows.ps1└── VERSION                        # Package version

POSTGRES_USER=aria

POSTGRES_PASSWORD=secure_password_here│   ├── uninstall-linux.sh```



# Licensed Modules│   ├── uninstall-windows.ps1

LICENSED_MODULES=full

│   ├── load-images.sh## Features

# Version

VERSION=latest│   └── load-images.ps1

```

├── images/                    # Docker images (*.tar)- ✅ **Path-Based Routing**: Single IP/domain, multi-module access via paths

## System Requirements

├── config/                    # Configuration templates- ✅ **Static IP Support**: Works without domain (certificate includes all server IPs)

### Minimum

│   └── traefik/              # Reverse proxy configuration- ✅ **200 User Capacity**: Optimized PostgreSQL tuning and rate limiting

- **CPU**: 2 cores

- **RAM**: 4 GB├── docs/                      # Documentation- ✅ **Cross-Platform**: Windows 10/11 and Linux (Ubuntu, Debian, RHEL)

- **Storage**: 20 GB

- **OS**: Ubuntu 20.04+, Debian 11+, CentOS 8+, Windows 10/11, Windows Server 2019+│   ├── INSTALLATION.md- ✅ **Modular Licensing**: Enable only needed modules to save resources



### Recommended│   ├── CONFIGURATION.md- ✅ **Auto-SSL Generation**: Scripts generate certificates with all server IPs



- **CPU**: 4 cores│   ├── SPECIFICATION.md- ✅ **Secure**: SSL/TLS support with security headers and rate limiting

- **RAM**: 8 GB

- **Storage**: 50 GB SSD│   └── TROUBLESHOOTING.md- ✅ **System Service**: systemd (Linux) or Scheduled Tasks (Windows) integration

- **Network**: 1 Gbps

├── docker-compose.production.yml- ✅ **Auto-Restart**: Automatic service recovery on failure or reboot

## Security

├── .env.template- ✅ **Production-Ready**: Optimized Docker images with health checks

- Database passwords are auto-generated during installation

- SSL/TLS encryption supported└── VERSION- ✅ **Simple**: Easy installation with minimal configuration

- Security headers enabled (HSTS, XSS protection, frame deny)

- Rate limiting: 100 requests/second per IP```

- Designed for private network deployment

## Module Selection

## Backup and Restore

## Service Management

**Backup:**

Available modules:

```bash

# Database### Linux (systemd)- **asset** - Asset Management

docker exec aria-database pg_dump -U aria aria > backup-$(date +%Y%m%d).sql

- **crm** - Customer Relationship Management

# Configuration

cp .env .env.backup```bash- **hrms** - Human Resource Management System

```

# Start service- **inventory** - Inventory Management

**Restore:**

sudo systemctl start aria-erp

```bash

# DatabaseInstall all modules:

cat backup.sql | docker exec -i aria-database psql -U aria -d aria

# Stop service```bash

# Configuration

cp .env.backup .envsudo systemctl stop aria-erp--modules full

```

```

## Updating

# Restart service

1. Stop the current installation

2. Extract new version packagesudo systemctl restart aria-erpInstall specific modules:

3. Load new Docker images

4. Run installation script (preserves data and configuration)```bash



## Uninstallation# Check status--modules asset,crm,hrms



**Linux:**sudo systemctl status aria-erp```



```bash

sudo ./scripts/uninstall-linux.sh

```# View logs## Service Management



**Windows:**sudo journalctl -u aria-erp -f



```powershell```### Linux

.\scripts\uninstall-windows.ps1

```



This removes all services, containers, and installation files. Database data is preserved unless explicitly removed with `--remove-data` flag.### Windows (Scheduled Tasks)```bash



## Support# Start



For issues or questions:```powershellsudo systemctl start aria-erp



1. Check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md)# Start service

2. Review logs for error messages

3. Contact your system administratorStart-ScheduledTask -TaskName "AriaERP"# Stop



## Licensesudo systemctl stop aria-erp



This deployment package is part of Aria ERP. See included LICENSE file for details.# Stop service



---cd "C:\Program Files\AriaERP"# Restart



**Version**: 0.1.0  docker compose downsudo systemctl restart aria-erp

**Build Date**: October 3, 2025  

**Supported Platforms**: Linux (Ubuntu, Debian, CentOS, RHEL), Windows (10/11, Server 2019/2022)


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
