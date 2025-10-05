# Aria ERP Deployment Guide

**Version**: 1.0.0  
**Last Updated**: October 4, 2025  
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Start](#quick-start)
5. [Installation](#installation)
6. [Configuration](#configuration)
7. [Operations](#operations)
8. [Troubleshooting](#troubleshooting)
9. [Security](#security)
10. [Maintenance](#maintenance)

---

## Overview

### What is Aria ERP?

Aria ERP is a comprehensive Business Resource Planning system designed for on-premise deployment in enterprise environments. It provides:

- **Asset Management** - Track and manage company assets
- **CRM** - Customer relationship management
- **HRMS** - Human resources management system
- **Inventory** - Inventory and warehouse management
- **Backend API** - Central business logic and data management
- **PostgreSQL Database** - Reliable data storage
- **Traefik Proxy** - Reverse proxy and load balancer

### Deployment Features

✅ **Production-Ready**
- Automated backup system
- Health monitoring
- Disaster recovery
- Security hardening

✅ **Path-Based Routing**
- Access via `https://<ip>/<module>/`
- No domain name required
- Static IP support

✅ **Cross-Platform**
- Windows Server 2019+
- Linux (Ubuntu 20.04+, CentOS 8+, RHEL 8+)

✅ **Scalable**
- Supports ~200 concurrent users
- Resource-efficient design
- Horizontal scaling ready

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   Traefik Proxy      │
              │   (Port 80/443)      │
              │  - Path routing      │
              │  - SSL termination   │
              └──────────┬───────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │  Asset  │    │   CRM   │    │  HRMS   │
    │Frontend │    │Frontend │    │Frontend │
    └─────────┘    └─────────┘    └─────────┘
         │               │               │
         │               ▼               │
         │         ┌─────────┐           │
         └────────►│Inventory│◄──────────┘
                   │Frontend │
                   └────┬────┘
                        │
                        ▼
                  ┌──────────┐
                  │ Backend  │
                  │   API    │
                  └────┬─────┘
                       │
                       ▼
                ┌─────────────┐
                │ PostgreSQL  │
                │  Database   │
                └─────────────┘
```

### Container Architecture

| Container | Purpose | Port | Resources |
|-----------|---------|------|-----------|
| **traefik-proxy** | Reverse proxy & routing | 80, 443 | 512MB RAM |
| **aria-frontend-asset** | Asset management UI | 3001 | 512MB RAM |
| **aria-frontend-crm** | CRM UI | 3002 | 512MB RAM |
| **aria-frontend-hrms** | HRMS UI | 3003 | 512MB RAM |
| **aria-frontend-inventory** | Inventory UI | 3004 | 512MB RAM |
| **aria-backend** | Business logic API | 3000 | 1GB RAM |
| **aria-database** | PostgreSQL 18 | 5432 | 2GB RAM |

**Total Resource Requirements:**
- CPU: 2 cores minimum, 4 cores recommended
- RAM: 4GB minimum, 8GB recommended
- Disk: 20GB minimum, 50GB recommended

### Network Architecture

**Path-Based Routing:**
- `https://<ip>/` → Asset Management (default)
- `https://<ip>/crm/` → CRM
- `https://<ip>/hrms/` → HRMS
- `https://<ip>/inventory/` → Inventory
- `https://<ip>/api/` → Backend API

**Internal Communication:**
- All containers on `aria-network` bridge network
- Database accessible only from backend
- Frontend → Backend → Database flow

---

## Prerequisites

### Hardware Requirements

**Minimum Configuration:**
- **CPU**: 2 cores (x86_64)
- **RAM**: 4 GB
- **Disk**: 20 GB
- **Network**: 100 Mbps

**Recommended Configuration:**
- **CPU**: 4 cores (x86_64)
- **RAM**: 8 GB
- **Disk**: 50 GB (SSD preferred)
- **Network**: 1 Gbps

### Software Requirements

**Windows:**
- Windows Server 2019 or later
- Docker Desktop 24.0+ or Docker Engine
- PowerShell 5.1 or later
- Administrator privileges

**Linux:**
- Ubuntu 20.04+, CentOS 8+, or RHEL 8+
- Docker Engine 20.10+
- Docker Compose 2.0+
- Root or sudo privileges

### Network Requirements

**Ports Required:**
- **80 (HTTP)**: Web access (redirects to HTTPS)
- **443 (HTTPS)**: Secure web access
- **5432 (Optional)**: PostgreSQL external access

**Firewall Rules:**
```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Optional: Allow PostgreSQL from specific IP
sudo ufw allow from <management-ip> to any port 5432
```

### Pre-Installation Checklist

- [ ] Hardware meets minimum requirements
- [ ] Operating system is supported version
- [ ] Docker and Docker Compose installed
- [ ] Ports 80 and 443 are available
- [ ] Static IP address configured
- [ ] Administrator/root access available
- [ ] Firewall rules configured
- [ ] Backup storage identified (USB, network, etc.)

---

## Quick Start

### 5-Minute Installation (Linux)

```bash
# 1. Download deployment package
wget https://github.com/Karthik-beta/Aria/releases/latest/download/aria-erp-deployment.tar.gz

# 2. Extract
tar -xzf aria-erp-deployment.tar.gz
cd aria-erp-deployment

# 3. Run installation script
sudo bash scripts/install-linux.sh

# 4. Configure (follow prompts)
# - Set server IP
# - Set database password
# - Configure modules

# 5. Start services
cd /opt/aria-erp
sudo docker-compose up -d

# 6. Verify installation
sudo bash deployment/scripts/monitoring/health-check.sh
```

### 5-Minute Installation (Windows)

```powershell
# 1. Download deployment package
# Download from: https://github.com/Karthik-beta/Aria/releases/latest

# 2. Extract to C:\aria-erp-deployment

# 3. Run installation script (Administrator PowerShell)
cd C:\aria-erp-deployment
.\scripts\install-windows.ps1

# 4. Configure (follow prompts)
# - Set server IP
# - Set database password
# - Configure modules

# 5. Start services
cd C:\ProgramData\Aria-ERP
docker-compose up -d

# 6. Verify installation
.\deployment\scripts\monitoring\health-check.ps1
```

### First Login

1. Open browser: `https://<your-server-ip>/`
2. Accept self-signed certificate warning (first time)
3. Default credentials:
   - **Username**: `admin`
   - **Password**: `changeme` (MUST change on first login)

### Post-Installation

1. **Change default password** (Critical!)
2. **Configure backups**: Set schedule in Task Scheduler/cron
3. **Configure monitoring**: Set up health check alerts
4. **Review security**: Check firewall, SSL, user access
5. **Train users**: Provide access credentials and training

---

## Installation

### Detailed Installation Steps

#### Step 1: Download Deployment Package

**Option A: From GitHub Releases**
```bash
wget https://github.com/Karthik-beta/Aria/releases/latest/download/aria-erp-deployment.tar.gz
tar -xzf aria-erp-deployment.tar.gz
```

**Option B: From Git Repository**
```bash
git clone https://github.com/Karthik-beta/Aria.git
cd Aria/deployment
```

#### Step 2: Verify Prerequisites

**Linux:**
```bash
# Check Docker
docker --version  # Should be 20.10+
docker-compose --version  # Should be 2.0+

# Check ports
sudo netstat -tuln | grep -E ':80|:443'  # Should be empty

# Check disk space
df -h /opt  # Should have 20GB+ available
```

**Windows:**
```powershell
# Check Docker
docker --version

# Check ports
netstat -an | findstr /C:":80" /C:":443"  # Should be empty

# Check disk space
Get-PSDrive C  # Should have 20GB+ available
```

#### Step 3: Run Installation Script

**Linux:**
```bash
cd aria-erp-deployment
sudo bash scripts/install-linux.sh

# Installation will:
# - Create /opt/aria-erp directory
# - Copy configuration files
# - Set file permissions
# - Generate SSL certificates
# - Create systemd services (optional)
# - Configure firewall (optional)
```

**Windows:**
```powershell
cd aria-erp-deployment
.\scripts\install-windows.ps1

# Installation will:
# - Create C:\ProgramData\Aria-ERP directory
# - Copy configuration files
# - Set file permissions
# - Generate SSL certificates
# - Create Windows Services (optional)
# - Configure Windows Firewall (optional)
```

#### Step 4: Configure Environment

Edit `.env` file:

**Linux:**
```bash
sudo nano /opt/aria-erp/.env
```

**Windows:**
```powershell
notepad C:\ProgramData\Aria-ERP\.env
```

**Required Configuration:**
```ini
# Server Configuration
SERVER_IP=192.168.1.100        # Your server's static IP
ENVIRONMENT=production

# Database Configuration
POSTGRES_DB=aria
POSTGRES_USER=aria
POSTGRES_PASSWORD=CHANGE_THIS_PASSWORD  # Set strong password!

# Security
JWT_SECRET=GENERATE_RANDOM_SECRET        # Use: openssl rand -base64 32

# Modules (enable/disable)
ENABLE_ASSET=true
ENABLE_CRM=true
ENABLE_HRMS=true
ENABLE_INVENTORY=true
```

#### Step 5: Generate SSL Certificates

**Linux:**
```bash
cd /opt/aria-erp
sudo bash deployment/scripts/generate-ssl-cert-linux.sh
```

**Windows:**
```powershell
cd C:\ProgramData\Aria-ERP
.\deployment\scripts\generate-ssl-cert-windows.ps1
```

This generates self-signed certificates for HTTPS. For production, consider:
- Using Let's Encrypt (free, trusted)
- Using company CA certificates
- Purchasing commercial SSL certificates

#### Step 6: Start Services

**Linux:**
```bash
cd /opt/aria-erp
sudo docker-compose up -d

# Check status
sudo docker-compose ps
```

**Windows:**
```powershell
cd C:\ProgramData\Aria-ERP
docker-compose up -d

# Check status
docker-compose ps
```

**Expected Output:**
```
NAME                      STATUS              PORTS
aria-backend              Up 10 seconds       0.0.0.0:3000->3000/tcp
aria-database             Up 15 seconds       0.0.0.0:5432->5432/tcp
aria-frontend-asset       Up 8 seconds        0.0.0.0:3001->3001/tcp
aria-frontend-crm         Up 8 seconds        0.0.0.0:3002->3002/tcp
aria-frontend-hrms        Up 8 seconds        0.0.0.0:3003->3003/tcp
aria-frontend-inventory   Up 8 seconds        0.0.0.0:3004->3004/tcp
traefik-proxy             Up 12 seconds       0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

#### Step 7: Verify Installation

**Run Health Check:**
```bash
# Linux
sudo bash deployment/scripts/monitoring/health-check.sh

# Windows
.\deployment\scripts\monitoring\health-check.ps1
```

**Expected: HEALTHY status**

**Test Web Access:**
```bash
curl -k https://<your-server-ip>/api/health
```

**Expected Output:**
```json
{
  "status": "OK",
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

#### Step 8: Configure Backups

**Linux (systemd timer):**
```bash
# Copy timer and service files
sudo cp deployment/templates/aria-backup.service /etc/systemd/system/
sudo cp deployment/templates/aria-backup.timer /etc/systemd/system/

# Enable and start timer
sudo systemctl enable aria-backup.timer
sudo systemctl start aria-backup.timer

# Verify
sudo systemctl status aria-backup.timer
```

**Windows (Task Scheduler):**
```powershell
# Open Task Scheduler
taskschd.msc

# Create new task:
# - Name: Aria ERP Backup
# - Trigger: Daily at 2:00 AM
# - Action: Run PowerShell script
#   Program: PowerShell.exe
#   Arguments: -File "C:\ProgramData\Aria-ERP\deployment\scripts\backup\backup-manager.ps1"
# - Run with highest privileges
```

#### Step 9: Configure Monitoring

**Linux (systemd timer):**
```bash
# Copy timer and service files
sudo cp deployment/templates/aria-health.service /etc/systemd/system/
sudo cp deployment/templates/aria-health.timer /etc/systemd/system/

# Enable and start timer
sudo systemctl enable aria-health.timer
sudo systemctl start aria-health.timer

# Verify
sudo systemctl status aria-health.timer
```

**Windows (Task Scheduler):**
```powershell
# Create new task:
# - Name: Aria ERP Health Check
# - Trigger: Every 5 minutes
# - Action: Run PowerShell script
#   Program: PowerShell.exe
#   Arguments: -File "C:\ProgramData\Aria-ERP\deployment\scripts\monitoring\health-check.ps1"
# - Run with highest privileges
```

#### Step 10: Security Hardening

See [Security](#security) section for:
- [ ] Change default passwords
- [ ] Configure firewall rules
- [ ] Set up SSL with trusted certificates
- [ ] Configure user access controls
- [ ] Enable audit logging
- [ ] Set up backup encryption

---

## Configuration

### Environment Variables

Complete `.env` file reference:

```ini
#=================================================================
# Aria ERP Configuration
#=================================================================

#-----------------------------------------------------------------
# Server Configuration
#-----------------------------------------------------------------
SERVER_IP=192.168.1.100           # Server's static IP address
ENVIRONMENT=production            # production, staging, or development
SERVER_NAME=aria-erp-prod         # Friendly server name

#-----------------------------------------------------------------
# Database Configuration
#-----------------------------------------------------------------
POSTGRES_DB=aria                  # Database name
POSTGRES_USER=aria                # Database username
POSTGRES_PASSWORD=CHANGE_ME       # Database password (REQUIRED)
POSTGRES_PORT=5432                # PostgreSQL port

#-----------------------------------------------------------------
# Backend API Configuration
#-----------------------------------------------------------------
NODE_ENV=production               # Node.js environment
API_PORT=3000                     # Backend API port
JWT_SECRET=CHANGE_ME              # JWT signing secret (REQUIRED)
JWT_EXPIRATION=24h                # Token expiration time

#-----------------------------------------------------------------
# Frontend Configuration
#-----------------------------------------------------------------
ASSET_PORT=3001                   # Asset management port
CRM_PORT=3002                     # CRM port
HRMS_PORT=3003                    # HRMS port
INVENTORY_PORT=3004               # Inventory port

#-----------------------------------------------------------------
# Module Enablement
#-----------------------------------------------------------------
ENABLE_ASSET=true                 # Enable asset management
ENABLE_CRM=true                   # Enable CRM
ENABLE_HRMS=true                  # Enable HRMS
ENABLE_INVENTORY=true             # Enable inventory

#-----------------------------------------------------------------
# Traefik Configuration
#-----------------------------------------------------------------
TRAEFIK_HTTP_PORT=80              # HTTP port
TRAEFIK_HTTPS_PORT=443            # HTTPS port
TRAEFIK_DASHBOARD=false           # Enable/disable dashboard

#-----------------------------------------------------------------
# Backup Configuration
#-----------------------------------------------------------------
BACKUP_RETENTION_DAYS=7           # Keep backups for 7 days
BACKUP_COMPRESSION=true           # Enable compression
BACKUP_LOCATION=auto              # auto, usb, network, or path

#-----------------------------------------------------------------
# Monitoring Configuration
#-----------------------------------------------------------------
HEALTH_CHECK_INTERVAL=300         # Health check every 5 minutes
DISK_WARNING_THRESHOLD=80         # Warn at 80% disk usage
DISK_CRITICAL_THRESHOLD=90        # Critical at 90% disk usage

#-----------------------------------------------------------------
# Security Configuration
#-----------------------------------------------------------------
ENABLE_SSL=true                   # Enable HTTPS
SSL_CERT_PATH=./config/traefik/certs/server.crt
SSL_KEY_PATH=./config/traefik/certs/server.key
CORS_ORIGIN=*                     # CORS allowed origins
RATE_LIMIT_ENABLED=true           # Enable rate limiting
RATE_LIMIT_MAX=100                # Max 100 requests per window
RATE_LIMIT_WINDOW=900000          # 15 minutes window

#-----------------------------------------------------------------
# Logging Configuration
#-----------------------------------------------------------------
LOG_LEVEL=info                    # debug, info, warn, error
LOG_FORMAT=json                   # json or text
LOG_RETENTION_DAYS=30             # Keep logs for 30 days
```

### Docker Compose Configuration

The `docker-compose.yml` file defines all services. Key sections:

**Networks:**
```yaml
networks:
  aria-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

**Volumes:**
```yaml
volumes:
  postgres-data:         # Database persistent storage
  traefik-certs:         # SSL certificates
  backend-uploads:       # File uploads
```

**Service Resource Limits:**
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### Traefik Configuration

**Path-Based Routing (`config/traefik/routes.yml`):**
```yaml
http:
  routers:
    asset-router:
      rule: "PathPrefix(`/`)"
      service: asset-service
      priority: 1
    
    crm-router:
      rule: "PathPrefix(`/crm`)"
      service: crm-service
      priority: 2
    
    # ... other routes
```

**TLS Configuration (`config/traefik/tls.yml`):**
```yaml
tls:
  certificates:
    - certFile: /certs/server.crt
      keyFile: /certs/server.key
```

---

## Operations

### Starting Services

**All Services:**
```bash
# Linux
cd /opt/aria-erp
sudo docker-compose up -d

# Windows
cd C:\ProgramData\Aria-ERP
docker-compose up -d
```

**Individual Service:**
```bash
docker-compose up -d aria-backend
docker-compose up -d aria-database
```

### Stopping Services

**All Services:**
```bash
docker-compose down
```

**Individual Service:**
```bash
docker-compose stop aria-backend
```

### Restarting Services

**All Services:**
```bash
docker-compose restart
```

**Individual Service:**
```bash
docker-compose restart aria-backend
```

### Viewing Logs

**All Services:**
```bash
docker-compose logs -f
```

**Individual Service:**
```bash
docker-compose logs -f aria-backend
```

**Last 100 Lines:**
```bash
docker-compose logs --tail=100 aria-backend
```

### Checking Status

**Docker Compose:**
```bash
docker-compose ps
```

**Health Check:**
```bash
# Linux
sudo bash deployment/scripts/monitoring/health-check.sh

# Windows
.\deployment\scripts\monitoring\health-check.ps1
```

### Updating Services

**Pull Latest Images:**
```bash
docker-compose pull
```

**Recreate Containers:**
```bash
docker-compose up -d --force-recreate
```

**Update Specific Service:**
```bash
docker-compose pull aria-backend
docker-compose up -d --force-recreate aria-backend
```

---

## Troubleshooting

### Common Issues

#### Issue 1: Cannot Access Web Interface

**Symptoms:**
- Browser shows "Connection refused"
- Timeout when accessing `https://<ip>/`

**Diagnosis:**
```bash
# Check if containers are running
docker-compose ps

# Check Traefik logs
docker-compose logs traefik-proxy

# Check firewall
# Linux
sudo ufw status
# Windows
netsh advfirewall show allprofiles
```

**Solutions:**
1. Ensure all containers are running: `docker-compose ps`
2. Check firewall allows ports 80 and 443
3. Verify SERVER_IP in `.env` matches actual IP
4. Check Traefik routes: `docker-compose logs traefik-proxy`

#### Issue 2: Database Connection Errors

**Symptoms:**
- Backend logs show "Connection to database failed"
- Health check shows database unreachable

**Diagnosis:**
```bash
# Check database container
docker-compose logs aria-database

# Try manual connection
docker exec aria-database psql -U aria -d aria -c "SELECT 1;"
```

**Solutions:**
1. Verify POSTGRES_PASSWORD in `.env`
2. Check database container is running
3. Wait for database initialization (may take 30s on first start)
4. Check database logs for errors

#### Issue 3: High Memory Usage

**Symptoms:**
- System becomes slow
- Docker containers restarting frequently

**Diagnosis:**
```bash
# Check container resources
docker stats

# Check system memory
free -h  # Linux
Get-ComputerInfo | Select-Object OsTotalVisibleMemorySize,OsFreePhysicalMemory  # Windows
```

**Solutions:**
1. Adjust resource limits in `docker-compose.yml`
2. Disable unused modules in `.env`
3. Add more RAM if consistently over 80%
4. Consider horizontal scaling

#### Issue 4: SSL Certificate Errors

**Symptoms:**
- Browser shows "Your connection is not private"
- Certificate warnings

**Expected Behavior:**
- Self-signed certificates will show warnings
- This is normal for first deployment

**Solutions:**
1. **Accept warning** (for testing)
2. **Install certificate** in client browsers
3. **Use Let's Encrypt** for trusted certificates
4. **Use company CA** certificates

For detailed troubleshooting, see: `deployment/docs/TROUBLESHOOTING.md`

---

## Security

### Security Checklist

#### Immediate (Before Production)
- [ ] Change default `admin` password
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Generate secure `JWT_SECRET`
- [ ] Enable firewall rules
- [ ] Review user access controls
- [ ] Configure SSL with trusted certificates

#### Regular (Ongoing)
- [ ] Apply security updates monthly
- [ ] Review access logs weekly
- [ ] Test backups weekly
- [ ] Update passwords quarterly
- [ ] Review user accounts monthly
- [ ] Audit system logs monthly

### Password Requirements

**Database Password:**
- Minimum 16 characters
- Include uppercase, lowercase, numbers, symbols
- Generate with: `openssl rand -base64 24`

**JWT Secret:**
- Minimum 32 characters
- Cryptographically random
- Generate with: `openssl rand -base64 32`

**User Passwords:**
- Minimum 12 characters
- Complexity enforced by application
- Must change on first login

### Firewall Configuration

**Linux (ufw):**
```bash
# Allow SSH (if remote)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Optional: Allow PostgreSQL from specific IP
sudo ufw allow from 192.168.1.50 to any port 5432

# Enable firewall
sudo ufw enable
```

**Windows:**
```powershell
# Allow HTTP
New-NetFirewallRule -DisplayName "Aria ERP HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# Allow HTTPS
New-NetFirewallRule -DisplayName "Aria ERP HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

### SSL/TLS Configuration

**Option 1: Self-Signed (Development)**
```bash
# Already generated by install script
# Located in: config/traefik/certs/
```

**Option 2: Let's Encrypt (Recommended)**
```bash
# Install certbot
sudo apt install certbot  # Ubuntu
sudo yum install certbot  # CentOS

# Generate certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy to Aria
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem config/traefik/certs/server.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem config/traefik/certs/server.key

# Restart Traefik
docker-compose restart traefik-proxy
```

**Option 3: Company CA**
```bash
# Copy your company certificates
cp /path/to/company.crt config/traefik/certs/server.crt
cp /path/to/company.key config/traefik/certs/server.key

# Restart Traefik
docker-compose restart traefik-proxy
```

### Backup Encryption

**Encrypt Backups:**
```bash
# Linux (GPG)
gpg --symmetric --cipher-algo AES256 database.sql

# Windows (7-Zip)
7z a -p -mhe=on -t7z database.7z database.sql
```

**Decrypt for Restoration:**
```bash
# Linux
gpg --decrypt database.sql.gpg > database.sql

# Windows
7z x -p database.7z
```

### Network Security

**Docker Network Isolation:**
- All containers on isolated `aria-network`
- Database not exposed externally by default
- Inter-container communication only

**Restrict External Access:**
```yaml
# In docker-compose.yml
# Remove port mappings for internal services
# aria-database:
#   ports:
#     - "5432:5432"  # Comment this out
```

---

## Maintenance

### Daily Tasks

**Automated:**
- Health checks (every 5 minutes)
- Log rotation
- Temporary file cleanup

**Manual:**
- Review health check alerts
- Check disk space usage
- Monitor performance metrics

### Weekly Tasks

- Review backup status
- Test backup restoration (monthly)
- Review application logs
- Check for security updates
- Monitor user activity

### Monthly Tasks

- Apply security updates
- Review user accounts
- Audit access logs
- Test disaster recovery
- Update documentation
- Review resource usage

### Backup Management

**Manual Backup:**
```bash
# Linux
sudo bash deployment/scripts/backup/backup-manager.sh

# Windows
.\deployment\scripts\backup\backup-manager.ps1
```

**Verify Backup:**
```bash
# Check backup directory
ls -lh /opt/aria-erp/backups/  # Linux
dir C:\ProgramData\Aria-ERP\backups\  # Windows

# Verify latest backup integrity
gunzip -t /opt/aria-erp/backups/latest/database.sql.gz  # Linux
```

**Restore from Backup:**
```bash
# Full system recovery
# Linux
sudo bash deployment/scripts/restore/full-restore.sh

# Windows
.\deployment\scripts\restore\full-restore.ps1
```

### Database Maintenance

**Vacuum Database:**
```bash
docker exec aria-database psql -U aria -d aria -c "VACUUM ANALYZE;"
```

**Check Database Size:**
```bash
docker exec aria-database psql -U aria -d aria -c "SELECT pg_size_pretty(pg_database_size('aria'));"
```

**Backup Database Only:**
```bash
docker exec aria-database pg_dump -U aria aria > backup-$(date +%Y%m%d).sql
```

### Log Management

> **📘 See [Log Management Guide](docs/LOG_MANAGEMENT.md)** for complete documentation on log rotation, retention policies, and troubleshooting.

**View Container Logs:**
```bash
# All containers
docker-compose logs -f

# Specific container (last hour)
docker logs --since 1h aria-backend

# Export logs
docker logs aria-backend > backend-logs.txt
```

**Log Rotation:**
```bash
# Linux - Run manually or via cron
bash scripts/rotate-logs-linux.sh

# Windows - Run manually or via Task Scheduler
.\scripts\rotate-logs-windows.ps1
```

**Check Log Disk Usage:**
```bash
# Linux
du -sh /opt/aria-erp/logs

# Windows
Get-ChildItem -Path "C:\aria-erp\logs" -Recurse | Measure-Object -Property Length -Sum
```

**Log Configuration:**
Edit `.env` to adjust log rotation settings:
```bash
LOG_MAX_SIZE=10m          # Max size per Docker log file
LOG_MAX_FILES=3           # Number of rotated files to keep
LOG_RETENTION_DAYS=30     # Days to retain application logs
LOG_COMPRESS_ENABLED=true # Compress rotated logs
```

### Performance Monitoring

**Resource Usage:**
```bash
# Real-time
docker stats

# Export metrics
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" > metrics.txt
```

**Database Performance:**
```bash
# Active connections
docker exec aria-database psql -U aria -d aria -c "SELECT count(*) FROM pg_stat_activity;"

# Slow queries
docker exec aria-database psql -U aria -d aria -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

### Update Procedures

**Update Application:**
1. Backup current installation
2. Pull latest images
3. Stop services
4. Update configuration if needed
5. Start services
6. Verify health check

```bash
# Backup
bash deployment/scripts/backup/backup-manager.sh

# Update
docker-compose pull
docker-compose down
docker-compose up -d

# Verify
bash deployment/scripts/monitoring/health-check.sh
```

---

## Additional Resources

### Documentation Files

- **Installation Guide**: `deployment/docs/INSTALLATION.md`
- **Configuration Reference**: `deployment/docs/CONFIGURATION.md`
- **Troubleshooting Guide**: `deployment/docs/TROUBLESHOOTING.md`
- **Technical Specification**: `deployment/docs/SPECIFICATION.md`

### Script Documentation

- **Backup System**: `deployment/scripts/backup/README.md`
- **Health Monitoring**: `deployment/scripts/monitoring/README.md`
- **Recovery System**: `deployment/scripts/restore/README.md`

### Project Documentation

- **Implementation Progress**: `IMPLEMENTATION_PROGRESS.md`
- **Security Assessment**: `SECURITY_ASSESSMENT.md`
- **Testing Report**: `TESTING_REPORT.md`
- **Agent Principles**: `AGENTS.md`

### Support

**For Issues:**
1. Check troubleshooting guide
2. Review relevant logs
3. Consult documentation
4. Contact system administrator

**For Enhancements:**
1. Review AGENTS.md for architecture principles
2. Follow contribution guidelines
3. Maintain documentation standards

---

## Appendix

### Quick Reference Commands

**Start System:**
```bash
cd /opt/aria-erp && docker-compose up -d
```

**Stop System:**
```bash
cd /opt/aria-erp && docker-compose down
```

**Check Health:**
```bash
bash deployment/scripts/monitoring/health-check.sh
```

**Create Backup:**
```bash
bash deployment/scripts/backup/backup-manager.sh
```

**Restore Backup:**
```bash
bash deployment/scripts/restore/full-restore.sh
```

**View Logs:**
```bash
docker-compose logs -f aria-backend
```

**Rotate Logs:**
```bash
# Linux
bash scripts/rotate-logs-linux.sh

# Windows
.\scripts\rotate-logs-windows.ps1
```

### Default Locations

**Linux:**
- Installation: `/opt/aria-erp`
- Backups: `/opt/aria-erp/backups`
- Logs: `/opt/aria-erp/logs`
- Configuration: `/opt/aria-erp/.env`

**Windows:**
- Installation: `C:\aria-erp`
- Backups: `C:\aria-erp\backups`
- Logs: `C:\aria-erp\logs`
- Configuration: `C:\aria-erp\.env`

### Port Reference

| Service | Internal Port | External Port | Protocol |
|---------|---------------|---------------|----------|
| Traefik HTTP | 80 | 80 | HTTP |
| Traefik HTTPS | 443 | 443 | HTTPS |
| Backend API | 3000 | - | HTTP |
| Asset Frontend | 3001 | - | HTTP |
| CRM Frontend | 3002 | - | HTTP |
| HRMS Frontend | 3003 | - | HTTP |
| Inventory Frontend | 3004 | - | HTTP |
| PostgreSQL | 5432 | (Optional) | PostgreSQL |

### Environment Variable Reference

See [Configuration](#configuration) section for complete `.env` reference.

---

**Aria ERP Deployment Guide v1.0.0**  
**Last Updated**: October 4, 2025  
**Status**: Production Ready  
**License**: See main project LICENSE file
