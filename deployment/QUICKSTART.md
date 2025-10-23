# Aria ERP Quick Start Guide

> Fast-track deployment for common scenarios

## Table of Contents

- [Development Setup (5 minutes)](#development-setup-5-minutes)
- [Production on Ubuntu/Debian](#production-on-ubuntudebian)
- [Production on Windows 11](#production-on-windows-11)
- [Docker Desktop (Mac/Windows Development)](#docker-desktop-macwindows-development)
- [Common Post-Installation Tasks](#common-post-installation-tasks)

---

## Development Setup (5 minutes)

**For local development with hot-reload**

### Prerequisites
- Docker 24.0+ installed
- Docker Compose 2.20+ installed
- 8GB RAM available

### Steps

```bash
# 1. Navigate to project root
cd /path/to/aria

# 2. Copy environment template
cp .env.development.template .env

# 3. Start all services
docker compose -f docker-compose.development.yml up -d

# 4. Wait for services to start (about 30 seconds)
docker compose -f docker-compose.development.yml logs -f

# 5. Access the application
# Frontend: http://localhost (or http://localhost:3000 direct)
# Backend API: http://localhost/api (or http://localhost:3001 direct)
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

### Quick Commands

```bash
# View logs
docker compose -f docker-compose.development.yml logs -f

# Restart specific service
docker compose -f docker-compose.development.yml restart backend

# Stop all services
docker compose -f docker-compose.development.yml down

# Stop and remove volumes (fresh start)
docker compose -f docker-compose.development.yml down -v
```

### Development Features

- ✅ Hot module replacement (HMR) for frontend and backend
- ✅ Source maps enabled
- ✅ Debugger port exposed (9229)
- ✅ Volume mounts for live code changes
- ✅ PostgreSQL accessible on localhost:5432
- ✅ No SSL required

---

## Production on Ubuntu/Debian

**Automated installation for Ubuntu 20.04+, Debian 11+**

### Prerequisites
- Ubuntu 20.04+ or Debian 11+
- Root/sudo access
- Minimum 4GB RAM, 20GB disk
- Static IP or domain name

### Installation (15 minutes)

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Extract deployment package
tar -xzf aria-erp-v1.0-linux.tar.gz
cd aria-erp-v1.0-linux

# 3. Configure environment
cp .env.production.template .env
nano .env

# Required changes in .env:
# - POSTGRES_PASSWORD=<strong-password>
# - REDIS_PASSWORD=<strong-password>
# - JWT_SECRET=<64-character-hex-string>
# - DOMAIN=your-server-ip-or-domain

# 4. Run installer (will install Docker if needed)
sudo ./deployment/scripts/install-linux.sh

# 5. Verify installation
./deployment/tests/health-check.sh
```

### Generate Secure Secrets

```bash
# PostgreSQL password (32 characters)
openssl rand -base64 32

# Redis password (32 characters)
openssl rand -base64 32

# JWT secret (64 hex characters)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# or without node:
openssl rand -hex 64
```

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

### Access Application

```
https://<your-server-ip>
```

**Note**: Self-signed SSL certificate will show a browser warning. Click "Advanced" and proceed for internal use.

---

## Production on Windows 11

**Automated installation for Windows 11 with Docker Desktop**

### Prerequisites
- Windows 11 Professional, Enterprise, or Education
- Administrator access
- Docker Desktop installed
- Minimum 8GB RAM, 20GB disk
- Static IP or domain name

### Installation (20 minutes)

```powershell
# 1. Open PowerShell as Administrator
# Press Win+X, select "Windows PowerShell (Admin)"

# 2. Extract deployment package
Expand-Archive aria-erp-v1.0-windows.zip -DestinationPath C:\aria
cd C:\aria

# 3. Configure environment
Copy-Item .env.production.template .env
notepad .env

# Required changes in .env:
# - POSTGRES_PASSWORD=<strong-password>
# - REDIS_PASSWORD=<strong-password>
# - JWT_SECRET=<64-character-hex-string>
# - DOMAIN=your-server-ip-or-domain

# 4. Run installer
.\deployment\scripts\install-windows.ps1

# 5. Verify installation
.\deployment\tests\health-check.ps1
```

### Generate Secure Secrets

```powershell
# PostgreSQL password (32 characters)
-join ((65..90) + (97..122) + (48..57) + 33,35,37,64 | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Redis password (32 characters)
-join ((65..90) + (97..122) + (48..57) + 33,35,37,64 | Get-Random -Count 32 | ForEach-Object {[char]$_})

# JWT secret (64 hex characters)
-join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

### Service Management

```powershell
# Start service
Start-Service AriaERP
# or
sc start AriaERP

# Stop service
Stop-Service AriaERP
# or
sc stop AriaERP

# Check status
Get-Service AriaERP
# or
sc query AriaERP

# View logs
Get-Content C:\aria\logs\*.log -Tail 50 -Wait
```

### Access Application

```
https://<your-server-ip>
```

**Note**: Self-signed SSL certificate will show a browser warning. Click "Advanced" and proceed for internal use.

---

## Docker Desktop (Mac/Windows Development)

**For developers using Docker Desktop on Mac or Windows**

### Prerequisites
- Docker Desktop installed and running
- 8GB RAM allocated to Docker
- Git installed

### Clone and Start

```bash
# 1. Clone repository
git clone <repository-url>
cd aria

# 2. Copy environment
cp .env.development.template .env

# 3. Start services
docker compose -f docker-compose.development.yml up -d

# 4. Access application
# Frontend: http://localhost
# Backend: http://localhost/api
```

### Docker Desktop Settings

**Recommended settings for development**:

1. **Resources**:
   - CPUs: 4
   - Memory: 8GB
   - Disk: 60GB

2. **General**:
   - ✅ Use Virtualization framework
   - ✅ Enable VirtioFS (Mac)

3. **Docker Engine** (optional, for performance):
   ```json
   {
     "builder": {
       "gc": {
         "enabled": true,
         "defaultKeepStorage": "20GB"
       }
     }
   }
   ```

### Quick Development Workflow

```bash
# Start services
docker compose -f docker-compose.development.yml up -d

# View logs
docker compose -f docker-compose.development.yml logs -f backend

# Exec into backend container
docker exec -it aria-backend sh

# Restart backend after env changes
docker compose -f docker-compose.development.yml restart backend

# Stop services
docker compose -f docker-compose.development.yml down

# Full cleanup (removes volumes)
docker compose -f docker-compose.development.yml down -v
docker system prune -a
```

---

## Common Post-Installation Tasks

### Configure Firewall

#### Linux (UFW)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

#### Windows

```powershell
# Allow HTTP
New-NetFirewallRule -DisplayName "Aria HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

# Allow HTTPS
New-NetFirewallRule -DisplayName "Aria HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow

# Allow HTTP/3
New-NetFirewallRule -DisplayName "Aria HTTP/3" -Direction Inbound -LocalPort 443 -Protocol UDP -Action Allow
```

### Set Up Database Backups

#### Linux (Cron)

```bash
# Create backup script
sudo nano /opt/aria/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/aria/backups"
mkdir -p "$BACKUP_DIR"
docker exec aria-postgres pg_dump -U aria aria > "$BACKUP_DIR/aria-$(date +%Y%m%d-%H%M%S).sql"
# Keep only last 7 days
find "$BACKUP_DIR" -name "aria-*.sql" -mtime +7 -delete
```

```bash
# Make executable
sudo chmod +x /opt/aria/backup-db.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add line:
# 0 2 * * * /opt/aria/backup-db.sh
```

#### Windows (Task Scheduler)

```powershell
# Create backup script
notepad C:\aria\backup-db.ps1
```

```powershell
$BackupDir = "C:\aria\backups"
if (!(Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir }
$BackupFile = "$BackupDir\aria-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"
docker exec aria-postgres pg_dump -U aria aria > $BackupFile
# Keep only last 7 days
Get-ChildItem $BackupDir -Filter "aria-*.sql" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item
```

```powershell
# Create scheduled task (daily at 2 AM)
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\aria\backup-db.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "Aria DB Backup" -Action $Action -Trigger $Trigger -Principal $Principal
```

### Monitor Disk Usage

```bash
# Linux
df -h
docker system df

# Windows
Get-PSDrive C
docker system df
```

### Rotate Logs

Docker automatically rotates logs by default. To customize:

Edit `docker-compose.production.yml`:

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Update Application

```bash
# 1. Backup database
docker exec aria-postgres pg_dump -U aria aria > backup-before-update.sql

# 2. Stop services
docker compose -f docker-compose.production.yml down

# 3. Pull new version (or extract new package)
# For git:
git pull origin main

# 4. Rebuild
docker compose -f docker-compose.production.yml build

# 5. Start services
docker compose -f docker-compose.production.yml up -d

# 6. Verify
docker compose ps
./deployment/tests/health-check.sh  # Linux
.\deployment\tests\health-check.ps1  # Windows
```

### Custom Domain Setup

#### Linux

```bash
# Edit .env
sudo nano /opt/aria/.env
# Change:
# DOMAIN=erp.yourcompany.com

# Restart services
sudo systemctl restart aria-erp
```

#### Windows

```powershell
# Edit .env
notepad C:\aria\.env
# Change:
# DOMAIN=erp.yourcompany.com

# Restart service
Restart-Service AriaERP
```

**DNS Configuration**:
1. Create A record pointing to server IP
2. Wait for DNS propagation (up to 48 hours)
3. Caddy will automatically obtain Let's Encrypt certificate

### Trust Self-Signed Certificate

For internal networks using self-signed certificates:

#### Linux

```bash
# Copy certificate to trusted store
sudo cp deployment/caddy/certs/server.crt /usr/local/share/ca-certificates/aria-erp.crt
sudo update-ca-certificates
```

#### Windows

```powershell
# Import to trusted root store
Import-Certificate -FilePath deployment\caddy\certs\server.crt -CertStoreLocation Cert:\LocalMachine\Root
```

#### Browser (Manual)

1. Visit https://your-server
2. Click "Not Secure" in address bar
3. Click "Certificate" → "Details" → "Export"
4. Install certificate in browser's trusted store

---

## Next Steps

After installation:

1. **Change default credentials**: Update all passwords and secrets in `.env`
2. **Configure firewall**: Limit access to necessary ports only
3. **Set up monitoring**: Configure logging and alerting
4. **Schedule backups**: Automate database backups
5. **Review security**: See `deployment/README.md` security checklist
6. **Read documentation**: Check `docs/` for detailed guides

## Getting Help

- **Documentation**: `deployment/README.md`
- **Troubleshooting**: `deployment/TROUBLESHOOTING.md`
- **GitHub Issues**: https://github.com/Karthik-beta/Aria/issues
- **Health Check**: `./deployment/tests/health-check.sh` (Linux) or `.\deployment\tests\health-check.ps1` (Windows)

## Quick Reference

### Default Ports

| Service    | Port(s)        | Access                   |
|------------|----------------|--------------------------|
| HTTP       | 80             | http://localhost         |
| HTTPS      | 443 (TCP)      | https://localhost        |
| HTTP/3     | 443 (UDP)      | https://localhost        |
| Caddy Admin| 2019           | Internal only            |
| Frontend   | 3000           | Development only         |
| Backend    | 3001           | Development only         |
| PostgreSQL | 5432           | Development only         |
| Redis      | 6379           | Development only         |

### Useful Commands

```bash
# Health check
./deployment/tests/health-check.sh                # Linux
.\deployment\tests\health-check.ps1              # Windows

# View all logs
docker compose logs -f                           # Development
docker compose -f docker-compose.production.yml logs -f  # Production

# Restart everything
docker compose restart                           # Development
docker compose -f docker-compose.production.yml restart  # Production

# Check disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

### Environment Variables

| Variable            | Required | Default       | Description                  |
|---------------------|----------|---------------|------------------------------|
| `POSTGRES_PASSWORD` | Yes      | (none)        | Database password            |
| `REDIS_PASSWORD`    | Yes      | (none)        | Redis password               |
| `JWT_SECRET`        | Yes      | (none)        | JWT signing secret           |
| `DOMAIN`            | Yes      | localhost     | Server domain or IP          |
| `LOG_LEVEL`         | No       | info          | Logging level                |
| `DEBUG`             | No       | false         | Enable debug mode            |
| `CORS_ORIGIN`       | No       | *             | Allowed CORS origins         |
| `JWT_EXPIRATION`    | No       | 12h           | JWT token lifetime           |

---

**Last Updated**: 2025-01-23  
**Version**: 1.0.0
