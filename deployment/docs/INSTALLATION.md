# Aria ERP Installation Guide

This guide provides step-by-step instructions for installing Aria ERP on-premise.

## Table of Contents

- [System Requirements](#system-requirements)
- [Pre-Installation](#pre-installation)
- [Linux Installation](#linux-installation)
- [Windows Installation](#windows-installation)
- [Post-Installation](#post-installation)
- [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 20 GB free space
- **OS**: 
  - Linux: Ubuntu 20.04+, Debian 11+, CentOS 8+, RHEL 8+
  - Windows: Windows 10/11, Windows Server 2019/2022

### Required Software

- **Docker**: 20.10 or later
- **Docker Compose**: 2.0 or later (included with Docker Desktop on Windows)

### Network Requirements

- Ports 80 and 443 available
- Internet connection for initial setup (downloading Docker images)

## Pre-Installation

### 1. Install Docker

#### Linux

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**CentOS/RHEL:**
```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker
```

#### Windows

Download and install Docker Desktop from: https://www.docker.com/products/docker-desktop

### 2. Extract Installation Package

**Linux:**
```bash
tar -xzf aria-erp-v0.1.0-linux.tar.gz
cd aria-erp-v0.1.0
```

**Windows:**
Extract the ZIP file and navigate to the extracted folder.

### 3. Load Docker Images

**Linux:**
```bash
sudo ./bin/load-images.sh
```

**Windows (PowerShell as Administrator):**
```powershell
.\bin\load-images.ps1
```

## Linux Installation

### Basic Installation

```bash
sudo ./bin/install-linux.sh
```

### Custom Installation

```bash
sudo ./bin/install-linux.sh \
  --install-dir /opt/aria-erp \
  --modules full \
  --domain erp.company.com
```

### Installation Options

- `--install-dir PATH`: Installation directory (default: `/opt/aria-erp`)
- `--modules LIST`: Modules to install - comma-separated: `asset,crm,hrms,inventory` or `full` (default: `full`)
- `--domain DOMAIN`: Domain name (default: `localhost`)
- `--version VERSION`: Version tag (default: `latest`)

### Service Management

```bash
# Start service
sudo systemctl start aria-erp

# Stop service
sudo systemctl stop aria-erp

# Restart service
sudo systemctl restart aria-erp

# Check status
sudo systemctl status aria-erp

# View logs
sudo journalctl -u aria-erp -f
```

## Windows Installation

### Basic Installation

Run PowerShell as Administrator:

```powershell
.\bin\install-windows.ps1
```

### Custom Installation

```powershell
.\bin\install-windows.ps1 `
  -InstallPath "C:\Program Files\AriaERP" `
  -Modules "asset,crm" `
  -Domain "erp.company.com"
```

### Installation Options

- `-InstallPath PATH`: Installation directory (default: `C:\Program Files\AriaERP`)
- `-Modules LIST`: Modules to install (default: `full`)
- `-Domain DOMAIN`: Domain name (default: `localhost`)
- `-Version VERSION`: Version tag (default: `latest`)

### Service Management

**Start Service:**
```powershell
Start-ScheduledTask -TaskName "AriaERP"
```

**Stop Service:**
```powershell
cd "C:\Program Files\AriaERP"
docker compose down
```

**Check Status:**
```powershell
cd "C:\Program Files\AriaERP"
docker compose ps
```

**View Logs:**
```powershell
cd "C:\Program Files\AriaERP"
docker compose logs -f
```

## Post-Installation

### 1. Configure Environment

Edit the `.env` file in the installation directory:

**Linux:**
```bash
sudo nano /opt/aria-erp/.env
```

**Windows:**
```
notepad "C:\Program Files\AriaERP\.env"
```

Key configuration options:
- `DOMAIN`: Your domain name
- `POSTGRES_PASSWORD`: Database password (auto-generated, keep secure)
- `LICENSED_MODULES`: Modules to enable

### 2. Configure SSL Certificates

For production use, configure SSL certificates:

**Using existing certificates:**

1. Copy your certificate files to:
   - Linux: `/opt/aria-erp/volumes/traefik/`
   - Windows: `C:\Program Files\AriaERP\volumes\traefik\`

2. Update Traefik configuration in `config/traefik/tls.yml`

**Using Let's Encrypt:**

The system is pre-configured for Let's Encrypt. Ensure:
- Your domain points to the server IP
- Ports 80 and 443 are accessible from the internet

### 3. Access the Application

After installation, access your Aria ERP:

- **Backend API**: `https://your-domain.com/api`
- **Asset Management**: `https://asset.your-domain.com`
- **CRM**: `https://crm.your-domain.com`
- **HRMS**: `https://hrms.your-domain.com`
- **Inventory**: `https://inventory.your-domain.com`

For localhost testing, use `http://localhost` or the configured domain.

### 4. Initial Setup

1. Access the backend API to verify it's running
2. Follow the application's initial setup wizard
3. Create your admin account
4. Configure module-specific settings

## Troubleshooting

### Services won't start

**Check Docker is running:**
```bash
# Linux
sudo systemctl status docker

# Windows
docker version
```

**Check logs:**
```bash
# Linux
sudo journalctl -u aria-erp -n 50

# Windows
cd "C:\Program Files\AriaERP"
docker compose logs
```

### Port conflicts

If ports 80 or 443 are in use:

1. Stop conflicting services
2. Or modify ports in `docker-compose.yml`

### Database connection issues

1. Check database password in `.env`
2. Verify PostgreSQL container is healthy:
   ```bash
   docker ps
   docker logs aria-database
   ```

### Module not loading

1. Verify module is enabled in `.env`:
   ```
   LICENSED_MODULES=asset,crm,hrms,inventory
   ```

2. Restart services:
   ```bash
   # Linux
   sudo systemctl restart aria-erp
   
   # Windows
   docker compose down && docker compose --env-file .env up -d
   ```

### Permission issues (Linux)

Ensure proper ownership:
```bash
sudo chown -R root:root /opt/aria-erp
sudo chmod -R 755 /opt/aria-erp
```

## Uninstallation

### Linux

```bash
sudo ./bin/uninstall-linux.sh
```

### Windows

Run PowerShell as Administrator:
```powershell
.\bin\uninstall-windows.ps1
```

## Support

For additional support:

1. Check the documentation in the `docs/` folder
2. Review logs for error messages
3. Contact your system administrator or Aria ERP support

---

**Version**: 0.1.0  
**Last Updated**: October 3, 2025
