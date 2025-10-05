# Aria ERP On-Premise Deployment# Aria ERP On-Premise Deployment# Aria ERP On-Premise Deployment# Aria ERP On-Premise Deployment# Aria ERP On-Premise Deployment

**Version**: 1.0.0

**Last Updated**: October 4, 2025

**Status**: Production Ready (100% Test Pass Rate)Production-ready deployment infrastructure for Aria ERP with **path-based routing** for static IP deployments.

---

## 📘 Documentation## OverviewProduction-ready deployment infrastructure for Aria ERP with **path-based routing** for static IP deployments.

**👉 [START HERE: Complete Deployment Guide](./DEPLOYMENT_GUIDE.md)**

This README provides quick reference only. For complete instructions, see the comprehensive deployment guide.This deployment package provides everything needed to install and run Aria ERP in client environments:

### Documentation Structure

```- **Path-Based Routing**: Access all modules via `https://<ip>/<module>/`## OverviewProduction-ready deployment infrastructure for Aria ERP with **path-based routing** for static IP deployments.Production-ready deployment infrastructure for Aria ERP with **path-based routing** for static IP deployments.

deployment/

├── 📘 DEPLOYMENT_GUIDE.md ⭐ Complete deployment guide (START HERE)- **Static IP Support**: No domain name required

├── 📄 README.md ℹ️ This file (quick reference)

├── 🔧 DEVELOPMENT.md 💻 Development environment setup- **200 User Capacity**: Optimized for ~200 concurrent users

├── docs/

│ ├── INSTALLATION.md 🔨 Detailed installation procedures- **Cross-Platform**: Native Windows and Linux support

│ ├── CONFIGURATION.md ⚙️ Configuration reference

│ ├── TROUBLESHOOTING.md 🩺 Problem resolution guide- **Modular**: Enable only the modules you needThis deployment package provides everything needed to install and run Aria ERP in client environments:

│ └── SPECIFICATION.md 📋 Technical specifications

├── scripts/

│ ├── backup/ 📦 Phase 1: Backup system

│ ├── monitoring/ 🏥 Phase 2: Health monitoring## Quick Start

│ ├── restore/ 🔄 Phase 3: Disaster recovery

│ └── _.sh, _.ps1 🚀 Installation/management scripts

└── templates/ 📝 Configuration templates

```### Prerequisites- **Path-Based Routing**: Access all modules via `https://<ip>/<module>/`## Overview## Overview

---

## 🚀 Quick Start**Minimum Requirements:**- **Static IP Support**: No domain name required

### Prerequisites- 2 CPU cores

- **Hardware**: 2+ CPU cores, 4GB+ RAM, 20GB+ disk- 4 GB RAM- **200 User Capacity**: Optimized for ~200 concurrent users

- **Software**: Docker 20.10+, Docker Compose 2.0+

- **Network**: Static IP address- 20 GB disk space

### 5-Minute Installation- Docker 20.10+ and Docker Compose 2.0+- **Cross-Platform**: Native Windows and Linux support

**Linux:**- Ports 80 and 443 available

```bash

# 1. Download and extract- **Modular**: Enable only the modules you needThis deployment package provides everything needed to install and run Aria ERP in client environments:This deployment package provides everything needed to install and run Aria ERP in client environments:

wget https://github.com/Karthik-beta/Aria/releases/latest/download/aria-erp-deployment.tar.gz

tar -xzf aria-erp-deployment.tar.gz && cd aria-erp-deployment**Recommended:**



# 2. Install- 4 CPU cores

sudo bash scripts/install-linux.sh

- 8 GB RAM

# 3. Start

cd /opt/aria-erp && sudo docker-compose up -d- 50 GB SSD## Quick Start



# 4. Verify- 1 Gbps network

sudo bash deployment/scripts/monitoring/health-check.sh

```

**Windows:\*\***Supported Platforms:\*\*

````powershell

# 1. Download from GitHub releases and extract- **Linux**: Ubuntu 20.04+, Debian 11+, RHEL/CentOS 8+### Prerequisites- **Path-Based Routing**: Access all modules via `https://<ip>/<module>/`- **Path-Based Routing**: Access all modules via `https://<ip>/<module>/`



# 2. Install (Administrator PowerShell)- **Windows**: Windows 10/11, Server 2019+

cd C:\aria-erp-deployment

.\scripts\install-windows.ps1



# 3. Start### Installation

cd C:\ProgramData\Aria-ERP

docker-compose up -d**Minimum Requirements:**- **Static IP Support**: No domain name required- **Static IP Support**: No domain name required



# 4. Verify**Linux:**

.\deployment\scripts\monitoring\health-check.ps1

```- 2 CPU cores



### First Access```bash



1. Browser: `https://<your-server-ip>/`# Extract package- 4 GB RAM- **200 User Capacity**: Optimized for ~200 concurrent users- **200 User Capacity**: Optimized for ~200 concurrent users

2. Login: `admin` / `changeme` (change immediately!)

tar -xzf aria-erp-v0.1.0-linux.tar.gz

---

cd aria-erp-v0.1.0- 20 GB disk space

## 📊 System Overview



### Architecture

# Load Docker images- Docker 20.10+ and Docker Compose 2.0+- **Cross-Platform**: Native Windows and Linux support- **Cross-Platform**: Native Windows and Linux support

````

Internet → Traefik (80/443) → Frontends (Asset/CRM/HRMS/Inventory) → Backend API → PostgreSQLsudo ./bin/load-images.sh

````

- Ports 80 and 443 available

### Path-Based Routing

# Install (modules: full, asset, crm, hrms, or inventory)

| URL | Service |

|-----|---------|sudo ./bin/install-linux.sh --modules full- **Modular**: Enable only the modules you need- **Modular**: Enable only the modules you need

| `https://<ip>/` | Asset Management |

| `https://<ip>/crm/` | CRM |```

| `https://<ip>/hrms/` | HRMS |

| `https://<ip>/inventory/` | Inventory |**Recommended:**

| `https://<ip>/api/` | Backend API |

**Windows (PowerShell as Administrator):**

### Resources

- 4 CPU cores

- **Total**: 4.5 CPU cores, 5.5GB RAM, 7 containers

- **Database**: PostgreSQL 18 (2GB RAM)```powershell

- **Backend**: NestJS API (1GB RAM)

- **Frontends**: 4× Next.js apps (512MB each)# Extract ZIP file and navigate to folder- 8 GB RAM

- **Proxy**: Traefik v3.5 (512MB)

cd aria-erp-v0.1.0

---

- 50 GB SSD## Quick Start## Quick Start

## 🔧 Operations Reference

# Load Docker images

### System Management

.\bin\load-images.ps1- 1 Gbps network

```bash

# Start all services

docker-compose up -d

# Install (modules: full, asset, crm, hrms, or inventory)

# Stop all services

docker-compose down.\bin\install-windows.ps1 -Modules "full"



# Restart service```**Supported Platforms:**

docker-compose restart [service-name]



# View logs

docker-compose logs -f [service-name]### Access URLs- **Linux**: Ubuntu 20.04+, Debian 11+, RHEL/CentOS 8+### Prerequisites### Prerequisites



# Check status

docker-compose ps

```After installation, access modules via:- **Windows**: Windows 10/11, Server 2019+



### Backup & Recovery



```bash```

# Create backup (Linux)

sudo bash deployment/scripts/backup/backup-manager.shhttps://<server-ip>/asset/       # Asset Management



# Create backup (Windows)https://<server-ip>/crm/         # Customer Relationship Management### Installation

.\deployment\scripts\backup\backup-manager.ps1

https://<server-ip>/hrms/        # Human Resources

# Full system restore (Linux)

sudo bash deployment/scripts/restore/full-restore.shhttps://<server-ip>/inventory/   # Inventory Management**Minimum Requirements:****Minimum Requirements:**



# Full system restore (Windows)https://<server-ip>/api/         # Backend API

.\deployment\scripts\restore\full-restore.ps1

```**Linux:**

# List available backups

# Linux: sudo bash deployment/scripts/restore/restore-database.sh --list

# Windows: .\deployment\scripts\restore\restore-database.ps1 -List

```## Documentation- 2 CPU cores- 2 CPU cores



### Health Monitoring



```bash- **[Installation Guide](docs/INSTALLATION.md)** - Detailed installation instructions```bash

# Manual health check (Linux)

sudo bash deployment/scripts/monitoring/health-check.sh- **[Configuration Reference](docs/CONFIGURATION.md)** - Configuration options and settings



# Manual health check (Windows)- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions# Extract package- 4 GB RAM- 4 GB RAM

.\deployment\scripts\monitoring\health-check.ps1

- **[Specification](docs/SPECIFICATION.md)** - Technical specifications

# Exit codes: 0=HEALTHY, 1=WARNING, 2=UNHEALTHY

```- **[Development Guide](DEVELOPMENT.md)** - Building and testing the packagetar -xzf aria-erp-v0.1.0-linux.tar.gz



---



## 🔒 Security Checklist## Available Modulescd aria-erp-v0.1.0- 20 GB disk space- 20 GB disk space



**Before Production:**

- [ ] Change default `admin` password

- [ ] Set strong `POSTGRES_PASSWORD` (16+ chars)| Module | Description | License Key |

- [ ] Generate `JWT_SECRET` (`openssl rand -base64 32`)

- [ ] Enable firewall (ports 80, 443)|--------|-------------|-------------|

- [ ] Configure SSL with trusted certificates

- [ ] Review user access controls| Asset | Asset management and tracking | `asset` |# Load Docker images- Docker 20.10+ and Docker Compose 2.0+- Docker 20.10+ and Docker Compose 2.0+

- [ ] Test disaster recovery

| CRM | Customer relationship management | `crm` |

**Ongoing:**

- [ ] Apply security updates monthly| HRMS | Human resources and payroll | `hrms` |sudo ./bin/load-images.sh

- [ ] Review logs weekly

- [ ] Test backups weekly| Inventory | Inventory control and warehousing | `inventory` |

- [ ] Update passwords quarterly

- Ports 80 and 443 available- Ports 80 and 443 available

---

**Module Selection:**

## ✅ Testing Status

# Install (modules: full, asset, crm, hrms, or inventory)

**Comprehensive Testing Completed: October 4, 2025**

```bash

| Phase | Tests | Passed | Status |

|-------|-------|--------|--------|# Install all modulessudo ./bin/install-linux.sh --modules full

| Phase 1 (Backup) | 5 | 5 | ✅ 100% |

| Phase 2 (Monitoring) | 6 | 6 | ✅ 100% |--modules full

| Phase 3 (Recovery) | 8 | 8 | ✅ 100% |

| Integration | 4 | 4 | ✅ 100% |```

| Security | 7 | 7 | ✅ 100% |

| **Total** | **30** | **30** | **✅ 100%** |# Install specific modules



**Full Report**: `../TESTING_REPORT.md`--modules asset,crm,hrms**Recommended:****Recommended:**



---```



## 🆘 Troubleshooting**Windows (PowerShell as Administrator):**



### Quick Diagnostics## Package Structure



**Cannot access web interface:**- 4 CPU cores- 4 CPU cores

```bash

docker-compose ps                 # Check containers runningThe extracted deployment package has the following structure:

docker-compose logs traefik-proxy # Check Traefik logs

sudo ufw status                   # Check firewall (Linux)```powershell

````

````

**Database connection errors:**

```basharia-erp-v{version}/# Extract ZIP file and navigate to folder- 8 GB RAM- 8 GB RAM

docker-compose logs aria-database

docker exec aria-database psql -U aria -d aria -c "SELECT 1;"├── bin/

````

│ ├── install-linux.sh # Linux installation scriptcd aria-erp-v0.1.0

**High resource usage:**

```bash│ ├── install-windows.ps1        # Windows installation script

docker stats                      # Monitor resources

# Adjust limits in docker-compose.yml or disable unused modules│   ├── uninstall-linux.sh         # Linux removal script- 50 GB SSD- 50 GB SSD

```

│ ├── uninstall-windows.ps1 # Windows removal script

**For detailed troubleshooting**: See `docs/TROUBLESHOOTING.md`

│ ├── load-images.sh # Load Docker images (Linux)# Load Docker images

---

│ └── load-images.ps1 # Load Docker images (Windows)

## 📚 Additional Resources

├── images/.\bin\load-images.ps1- 1 Gbps network- 1 Gbps network

### Essential Documentation

- **[Complete Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Start here for full instructions│ └── \*.tar # Pre-built Docker images

- **[Testing Report](../TESTING_REPORT.md)** - Comprehensive testing documentation

- **[Security Assessment](../SECURITY_ASSESSMENT.md)** - Security analysis and recommendations├── config/

- **[Implementation Progress](../IMPLEMENTATION_PROGRESS.md)** - Development timeline

│ └── traefik/ # Traefik proxy configuration

### Technical References

- **[Installation Guide](./docs/INSTALLATION.md)** - Detailed installation procedures├── docs/# Install (modules: full, asset, crm, hrms, or inventory)

- **[Configuration Reference](./docs/CONFIGURATION.md)** - All configuration options

- **[Troubleshooting Guide](./docs/TROUBLESHOOTING.md)** - Problem resolution procedures│ ├── INSTALLATION.md # Installation guide

- **[Technical Specification](./docs/SPECIFICATION.md)** - System architecture and design

│ ├── CONFIGURATION.md # Configuration reference.\bin\install-windows.ps1 -Modules "full"

### Script Documentation

- **[Backup System](./scripts/backup/README.md)** - Phase 1 automated backups│ ├── SPECIFICATION.md # Technical specifications

- **[Health Monitoring](./scripts/monitoring/README.md)** - Phase 2 system health checks

- **[Recovery System](./scripts/restore/README.md)** - Phase 3 disaster recovery│ └── TROUBLESHOOTING.md # Troubleshooting guide```**Supported Platforms:\*\***Supported Platforms:\*\*

### Project Guides├── docker-compose.production.yml # Production Docker Compose

- **[Agent Principles](../AGENTS.md)** - Architecture and development philosophy

- **[Contributing Guide](../CONTRIBUTING.md)** - Contribution guidelines├── .env.template # Environment configuration template

- **[Security Guide](../SECURITY.md)** - Security best practices

└── VERSION # Package version

---

````### Access URLs- **Linux**: Ubuntu 20.04+, Debian 11+, RHEL/CentOS 8+- **Linux**: Ubuntu 20.04+, Debian 11+, RHEL/CentOS 8+

## 🔄 Maintenance Schedule



| Frequency | Tasks |

|-----------|-------|## Features

| **Daily** (Auto) | Health checks (5 min intervals), log rotation |

| **Weekly** | Review backups, check disk space, monitor performance |

| **Monthly** | Apply updates, test restoration, review accounts, audit logs |

- ✅ **Path-Based Routing**: Single IP/domain, multi-module access via pathsAfter installation, access modules via:- **Windows**: Windows 10/11, Server 2019+- **Windows**: Windows 10/11, Server 2019+

---

- ✅ **Static IP Support**: Works without domain (certificate includes all server IPs)

## 💡 Features

- ✅ **200 User Capacity**: Optimized PostgreSQL tuning and rate limiting

✅ **Production-Ready Deployment**

- Automated backup system (Phase 1)- ✅ **Cross-Platform**: Windows 10/11 and Linux (Ubuntu, Debian, RHEL)

- Real-time health monitoring (Phase 2)

- Comprehensive disaster recovery (Phase 3)- ✅ **Modular Licensing**: Enable only needed modules to save resources```

- 100% test coverage (30/30 tests passed)

- ✅ **Secure**: SSL/TLS support with security headers and rate limiting

✅ **Path-Based Routing**

- Access via `https://<ip>/<module>/`- ✅ **System Service**: systemd (Linux) or Scheduled Tasks (Windows) integrationhttps://<server-ip>/asset/       # Asset Management

- No domain name required

- Static IP support- ✅ **Auto-Restart**: Automatic service recovery on failure or reboot

- Single entry point for all modules

- ✅ **Production-Ready**: Optimized Docker images with health checkshttps://<server-ip>/crm/         # Customer Relationship Management### Installation### Installation

✅ **Cross-Platform Support**

- Windows Server 2019+- ✅ **Simple**: Easy installation with minimal configuration

- Linux (Ubuntu 20.04+, CentOS 8+, RHEL 8+)

- Docker-based deploymenthttps://<server-ip>/hrms/        # Human Resources

- Consistent experience across platforms

## Service Management

✅ **Enterprise Features**

- SSL/TLS encryptionhttps://<server-ip>/inventory/   # Inventory Management

- Automated backups with retention

- Health monitoring with alerts### Linux (systemd)

- Full system recovery capability

- Security hardeninghttps://<server-ip>/api/         # Backend API

- Resource management

```bash

---

# Start service```**Linux:****Linux:**

## 📞 Support

sudo systemctl start aria-erp

**Getting Help:**

1. Check [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

2. Review [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

3. Check logs: `docker-compose logs -f [service]`# Stop service

4. Run health check script

5. Contact system administratorsudo systemctl stop aria-erp## Documentation



**Reporting Issues:**

Include:

- Health check output# Restart service

- Relevant log excerpts

- System specifications (OS, Docker version, resources)sudo systemctl restart aria-erp

- Steps to reproduce

- Expected vs actual behavior- **[Installation Guide](docs/INSTALLATION.md)** - Detailed installation instructions```bash```bash



---# Check status



## 📄 Licensesudo systemctl status aria-erp- **[Configuration Reference](docs/CONFIGURATION.md)** - Configuration options and settings



See main project LICENSE file.



---# View logs- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions# Extract package# Extract package



**Aria ERP On-Premise Deployment**  sudo journalctl -u aria-erp -f

**Ready for Production** | **Fully Tested** | **Comprehensive Documentation**

For complete instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)```- **[Specification](docs/SPECIFICATION.md)** - Technical specifications




### Windows (Scheduled Tasks)- **[Development Guide](DEVELOPMENT.md)** - Building and testing the packagetar -xzf aria-erp-v0.1.0-linux.tar.gztar -xzf aria-erp-v0.1.0-linux.tar.gz



```powershell

# Start service

Start-ScheduledTask -TaskName "AriaERP"## Available Modulescd aria-erp-v0.1.0cd aria-erp-v0.1.0



# Stop service

cd "C:\Program Files\AriaERP"

docker compose down| Module | Description | License Key |



# View status|--------|-------------|-------------|

docker compose ps

| Asset | Asset management and tracking | `asset` |# Generate SSL certificate# Generate SSL certificate with all server IPs

# View logs

docker compose logs -f| CRM | Customer relationship management | `crm` |

````

| HRMS | Human resources and payroll | `hrms` |sudo ./scripts/generate-ssl-cert-linux.shsudo ./scripts/generate-ssl-cert-linux.sh ./volumes/traefik

## Configuration

| Inventory | Inventory control and warehousing | `inventory` |

Configuration is managed through the `.env` file:

````env

# Domain Configuration**Module Selection:**

DOMAIN=localhost

# Load Docker images# Load Docker images

# Database Configuration

POSTGRES_DB=aria```bash

POSTGRES_USER=aria

POSTGRES_PASSWORD=secure_password_here# Install all modulessudo ./scripts/load-images.sh



# Licensed Modules--modules full

LICENSED_MODULES=full

- **Windows**: Windows 10/11, Server 2019+sudo ./scripts/load-images.sh

# Version

VERSION=latest# Install specific modules

````

--modules asset,crm,hrms# Install (modules: full, asset, crm, hrms, or inventory)

## System Requirements

````

### Minimum

sudo ./scripts/install-linux.sh --modules full

- **CPU**: 2 cores

- **RAM**: 4 GB## Package Structure

- **Storage**: 20 GB

- **OS**: Ubuntu 20.04+, Debian 11+, CentOS 8+, Windows 10/11, Windows Server 2019+```



### RecommendedThe extracted deployment package has the following structure:



- **CPU**: 4 cores### Installation# Install (modules: full, asset,crm, hrms, or inventory)

- **RAM**: 8 GB

- **Storage**: 50 GB SSD```

- **Network**: 1 Gbps

aria-erp-v{version}/**Windows (PowerShell as Administrator):**

## Security

├── bin/

- Database passwords are auto-generated during installation

- SSL/TLS encryption supported│   ├── install-linux.sh           # Linux installation scriptsudo ./scripts/install-linux.sh --modules full

- Security headers enabled (HSTS, XSS protection, frame deny)

- Rate limiting: 100 requests/second per IP│   ├── install-windows.ps1        # Windows installation script

- Designed for private network deployment

│   ├── uninstall-linux.sh         # Linux removal script```powershell

## Backup and Restore

│   ├── uninstall-windows.ps1      # Windows removal script

**Backup:**

│   ├── load-images.sh             # Load Docker images (Linux)# Extract ZIP file and navigate to folder**Linux:**```

```bash

# Database│   └── load-images.ps1            # Load Docker images (Windows)

docker exec aria-database pg_dump -U aria aria > backup-$(date +%Y%m%d).sql

├── images/cd aria-erp-v0.1.0

# Configuration

cp .env .env.backup│   └── *.tar                      # Pre-built Docker images

````

├── config/```bash

**Restore:**

│ └── traefik/ # Traefik proxy configuration

```bash

# Database├── docs/# Generate SSL certificate

cat backup.sql | docker exec -i aria-database psql -U aria -d aria

│   ├── INSTALLATION.md            # Installation guide

# Configuration

cp .env.backup .env│   ├── CONFIGURATION.md           # Configuration reference.\scripts\generate-ssl-cert-windows.ps1# Extract package**Windows (PowerShell as Administrator):**

```

│ ├── SPECIFICATION.md # Technical specifications

## Updating

│ └── TROUBLESHOOTING.md # Troubleshooting guide

1. Stop the current installation

2. Extract new version package├── docker-compose.production.yml # Production Docker Compose

3. Load new Docker images

4. Run installation script (preserves data and configuration)├── .env.template # Environment configuration template# Load Docker imagestar -xzf aria-erp-v{version}-linux.tar.gz```powershell

## Uninstallation└── VERSION # Package version

**Linux:**```.\scripts\load-images.ps1

````bash

sudo ./bin/uninstall-linux.sh

```## Featurescd aria-erp-v{version}# Extract ZIP file



**Windows:**



```powershell- ✅ **Path-Based Routing**: Single IP/domain, multi-module access via paths# Install (modules: full, asset, crm, hrms, or inventory)

.\bin\uninstall-windows.ps1

```- ✅ **Static IP Support**: Works without domain (certificate includes all server IPs)



This removes all services, containers, and installation files. Database data is preserved unless explicitly removed with `--remove-data` flag.- ✅ **200 User Capacity**: Optimized PostgreSQL tuning and rate limiting.\scripts\install-windows.ps1 -Modules "full"cd aria-erp-v0.1.0



## Support- ✅ **Cross-Platform**: Windows 10/11 and Linux (Ubuntu, Debian, RHEL)



For issues or questions:- ✅ **Modular Licensing**: Enable only needed modules to save resources```



1. Check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md)- ✅ **Secure**: SSL/TLS support with security headers and rate limiting

2. Review logs for error messages

3. Contact your system administrator- ✅ **System Service**: systemd (Linux) or Scheduled Tasks (Windows) integration# Load Docker images



## License- ✅ **Auto-Restart**: Automatic service recovery on failure or reboot



This deployment package is part of Aria ERP. See included LICENSE file for details.- ✅ **Production-Ready**: Optimized Docker images with health checks### Access URLs



---- ✅ **Simple**: Easy installation with minimal configuration



**Version**: 0.1.0  sudo ./bin/load-images.sh# Generate SSL certificate with all server IPs

**Build Date**: October 3, 2025

**Supported Platforms**: Linux (Ubuntu, Debian, CentOS, RHEL), Windows (10/11, Server 2019/2022)## Service Management


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

````

### Windows (Scheduled Tasks)## Documentation

````powershell**Windows (Run as Administrator):**# Install (modules: full, asset,crm, hrms, or inventory)

# Start service

Start-ScheduledTask -TaskName "AriaERP"- **[Installation Guide](docs/INSTALLATION.md)** - Detailed installation instructions



# Stop service- **[Configuration Reference](docs/CONFIGURATION.md)** - Configuration options and settings```powershell.\scripts\install-windows.ps1 -Modules "full"

cd "C:\Program Files\AriaERP"

docker compose down- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions



# View status- **[Specification](docs/SPECIFICATION.md)** - Technical specifications# Extract ZIP and navigate to folder```

docker compose ps



# View logs

docker compose logs -f## Available Modulescd aria-erp-v{version}

````

## Configuration

| Module | Description | License Key |**Access after installation:**

Configuration is managed through the `.env` file:

|--------|-------------|-------------|

````env

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

````

```````bash

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

```````

│ ├── load-images.ps1 # Load Docker images (Windows)

**Restore:**

│ ├── generate-ssl-cert-linux.sh # SSL certificate generator (Linux)https://<server-ip>/crm/ # Customer Relationship Management- `https://<server-ip>/inventory/` - Inventory Management

```bash

# Database│   └── generate-ssl-cert-windows.ps1 # SSL certificate generator (Windows)

cat backup.sql | docker exec -i aria-database psql -U aria -d aria

├── images/https://<server-ip>/hrms/        # Human Resources- `https://<server-ip>/api/` - Backend API

# Configuration

cp .env.backup .env│   └── *.tar                      # Pre-built Docker images

```

├── config/https://<server-ip>/inventory/ # Inventory Management

## Updating

│ └── traefik/ # Traefik proxy configuration

1. Stop the current installation

2. Extract new version package├── docs/https://<server-ip>/api/ # Backend API## Documentation

3. Load new Docker images

4. Run installation script (preserves data and configuration)│ ├── INSTALLATION.md

## Uninstallation│ ├── CONFIGURATION.md```

**Linux:**│ ├── SPECIFICATION.md

```````bash│ └── TROUBLESHOOTING.md- **[Path-Based Routing](docs/PATH_BASED_ROUTING.md)** - URL structure and SSL configuration ✨

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

```````

# Restart servicearia-erp-v{version}/

sudo systemctl restart aria-erp

├── bin/

# Check status

sudo systemctl status aria-erp**Module Selection:**│ ├── install-linux.sh # Linux installation script

# View logs│ ├── install-windows.ps1 # Windows installation script

sudo journalctl -u aria-erp -f

````bash│ ├── uninstall-linux.sh         # Linux removal script



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

````

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

````bash# Version

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

````

## Backup and Restore

**Note**: Database data is preserved. To remove all data, use the `--remove-data` flag.

**Backup:**

## Documentation```bash

# Database

- **[Installation Guide](docs/INSTALLATION.md)** - Detailed installation proceduresdocker exec aria-database pg_dump -U aria aria > backup-$(date +%Y%m%d).sql

- **[Configuration Reference](docs/CONFIGURATION.md)** - Complete configuration options

- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions# Configuration

- **[Specification](docs/SPECIFICATION.md)** - Technical specificationscp .env .env.backup

````

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
````
