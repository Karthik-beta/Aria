# Aria ERP Deployment Guide

> Complete deployment infrastructure for the Aria B2B ERP system

## Overview

This deployment infrastructure provides a production-ready setup for Aria ERP with:

- **Caddy v2** reverse proxy with automatic HTTPS and HTTP/3 support
- **Next.js 16** frontend with multi-zone architecture (consolidated into single app)
- **NestJS 11** backend API
- **PostgreSQL 18** database
- **Redis 7** for caching and sessions
- **Cross-platform support** for Linux and Windows 11

## Table of Contents

- [Quick Start](#quick-start)
- [System Requirements](#system-requirements)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
  - [Linux Deployment](#linux-deployment)
  - [Windows Deployment](#windows-deployment)
- [Configuration](#configuration)
- [SSL Certificates](#ssl-certificates)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Quick Start

### Development (Local)

```bash
# 1. Copy environment template
cp .env.development.template .env

# 2. Start development environment
docker compose -f docker-compose.development.yml up -d

# 3. Access the application
# Frontend: http://localhost
# Backend API: http://localhost/api
# Caddy Admin: http://localhost:2019
```

### Production (Linux)

```bash
# 1. Navigate to deployment directory
cd /path/to/aria-deployment-package

# 2. Configure environment
cp .env.production.template .env
nano .env  # Edit and set all required values

# 3. Run installation script
sudo ./deployment/scripts/install-linux.sh

# 4. Access the application
# https://your-server-ip
```

### Production (Windows)

```powershell
# 1. Open PowerShell as Administrator
# 2. Navigate to deployment directory
cd C:\path\to\aria-deployment-package

# 3. Configure environment
Copy-Item .env.production.template .env
notepad .env  # Edit and set all required values

# 4. Run installation script
.\deployment\scripts\install-windows.ps1

# 5. Access the application
# https://your-server-ip
```

## System Requirements

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4GB (8GB recommended)
- **Disk**: 20GB free space
- **Docker**: Version 24.0 or higher
- **Docker Compose**: Version 2.20 or higher

### Operating Systems

- **Linux**: Ubuntu 20.04+, Debian 11+, RHEL 8+, or compatible
- **Windows**: Windows 11 with Docker Desktop

### Network Requirements

- **Ports**: 80 (HTTP), 443 (HTTPS), 443/UDP (HTTP/3)
- **Internet**: Required for initial image download and SSL certificates

## Development Setup

### Prerequisites

1. Install Docker and Docker Compose
2. Install Node.js 22+ and pnpm (for local development without Docker)
3. Install Git

### Setup Steps

```bash
# 1. Clone the repository
git clone <repository-url>
cd aria

# 2. Copy environment template
cp .env.development.template .env

# 3. Start services
docker compose -f docker-compose.development.yml up -d

# 4. View logs
docker compose -f docker-compose.development.yml logs -f

# 5. Stop services
docker compose -f docker-compose.development.yml down
```

### Development Features

- **Hot Module Replacement (HMR)**: Automatic code reloading for frontend and backend
- **Debugging**: Node.js debugger exposed on port 9229
- **Database Access**: PostgreSQL accessible on port 5432
- **Redis Access**: Redis accessible on port 6379
- **Direct Access**: Frontend on port 3000, Backend on port 3001

## Production Deployment

### Linux Deployment

#### Automated Installation

```bash
# 1. Extract deployment package
tar -xzf aria-erp-v1.0-linux.tar.gz
cd aria-erp-v1.0-linux

# 2. Configure environment
cp .env.production.template .env
nano .env  # Edit all REQUIRED values

# 3. Run installation script
sudo ./deployment/scripts/install-linux.sh
```

#### Manual Installation

```bash
# 1. Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# 2. Copy files to installation directory
sudo mkdir -p /opt/aria
sudo cp -r * /opt/aria/
cd /opt/aria

# 3. Configure environment
sudo cp .env.production.template .env
sudo nano .env  # Edit all required values

# 4. Generate SSL certificates
cd deployment/ssl
chmod +x generate-certs.sh
sudo ./generate-certs.sh
cd ../..

# 5. Build and start services
sudo docker compose -f docker-compose.production.yml build
sudo docker compose -f docker-compose.production.yml up -d

# 6. Install systemd service
sudo cp deployment/systemd/aria-erp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable aria-erp
sudo systemctl start aria-erp
```

#### Service Management (Linux)

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

# Docker Compose logs
sudo docker compose -f /opt/aria/docker-compose.production.yml logs -f
```

### Windows Deployment

#### Automated Installation

```powershell
# 1. Extract deployment package (Run as Administrator)
Expand-Archive aria-erp-v1.0-windows.zip -DestinationPath C:\aria

# 2. Navigate to directory
cd C:\aria

# 3. Configure environment
Copy-Item .env.production.template .env
notepad .env  # Edit all REQUIRED values

# 4. Run installation script
.\deployment\scripts\install-windows.ps1
```

#### Manual Installation

```powershell
# Run PowerShell as Administrator

# 1. Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop/

# 2. Copy files to installation directory
New-Item -ItemType Directory -Path C:\aria -Force
Copy-Item -Path * -Destination C:\aria -Recurse
cd C:\aria

# 3. Configure environment
Copy-Item .env.production.template .env
notepad .env  # Edit all required values

# 4. Generate SSL certificates
cd deployment\ssl
.\generate-certs.ps1
cd ..\..

# 5. Build and start services
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d

# 6. Install Windows service
# Download WinSW from: https://github.com/winsw/winsw/releases
# Rename to AriaERP.exe and place in C:\aria
# Copy service configuration
Copy-Item deployment\windows\aria-erp.xml AriaERP.xml
# Install service
.\AriaERP.exe install
.\AriaERP.exe start
```

#### Service Management (Windows)

```powershell
# Start service
sc start AriaERP
# or
.\AriaERP.exe start

# Stop service
sc stop AriaERP
# or
.\AriaERP.exe stop

# Check status
sc query AriaERP
# or
Get-Service AriaERP

# View logs
Get-Content C:\aria\logs\*.log -Tail 50 -Wait

# Docker Compose logs
docker compose -f C:\aria\docker-compose.production.yml logs -f
```

## Configuration

### Environment Variables

All configuration is done through environment variables in the `.env` file.

#### Required Variables (Production)

```env
# Database password - MUST be changed!
POSTGRES_PASSWORD=your_secure_password

# Redis password - MUST be changed!
REDIS_PASSWORD=your_secure_redis_password

# JWT secret - MUST be changed!
JWT_SECRET=your_cryptographically_secure_random_string

# Domain or IP address
DOMAIN=your-domain.com
```

#### Optional Variables

```env
# JWT token expiration (default: 12h)
JWT_EXPIRATION=12h

# CORS origins (comma-separated)
CORS_ORIGIN=https://your-domain.com

# Log level (debug, info, warn, error)
LOG_LEVEL=info

# Enable debug mode (false for production)
DEBUG=false
```

### Generating Secure Secrets

```bash
# Generate PostgreSQL password
openssl rand -base64 32

# Generate Redis password
openssl rand -base64 32

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## SSL Certificates

### Automatic SSL Generation

The deployment automatically generates self-signed SSL certificates for private networks.

#### Linux

```bash
cd deployment/ssl
chmod +x generate-certs.sh
./generate-certs.sh
```

#### Windows

```powershell
cd deployment\ssl
.\generate-certs.ps1
```

### Custom SSL Certificates

To use custom SSL certificates:

1. Place your certificate files in `deployment/caddy/certs/`:
   - `server.crt` - SSL certificate
   - `server.key` - Private key

2. Update Caddyfile if needed (for advanced configurations)

3. Restart services:
   ```bash
   # Linux
   sudo systemctl restart aria-erp
   
   # Windows
   sc stop AriaERP && sc start AriaERP
   ```

### Let's Encrypt (Public Domains)

For public domains, Caddy automatically obtains Let's Encrypt certificates.

Update your `.env`:
```env
DOMAIN=erp.yourcompany.com
SSL_EMAIL=admin@yourcompany.com
```

Ensure ports 80 and 443 are accessible from the internet.

## Monitoring and Maintenance

### Health Checks

#### Automated Health Check Scripts

```bash
# Linux
./deployment/tests/health-check.sh

# Windows
.\deployment\tests\health-check.ps1
```

#### Manual Health Checks

```bash
# Check all containers
docker ps

# Check container health
docker inspect aria-frontend --format='{{.State.Health.Status}}'

# Test endpoints
curl http://localhost/health
curl http://localhost/api/health
```

### Viewing Logs

```bash
# View all service logs
docker compose -f docker-compose.production.yml logs -f

# View specific service logs
docker logs aria-frontend -f
docker logs aria-backend -f
docker logs aria-caddy -f

# View last 100 lines
docker logs aria-backend --tail 100
```

### Database Backups

```bash
# Create backup
docker exec aria-postgres pg_dump -U aria aria > backup_$(date +%Y%m%d).sql

# Restore backup
docker exec -i aria-postgres psql -U aria aria < backup_20250123.sql
```

### Updating the Application

```bash
# 1. Pull latest deployment package
# 2. Stop services
docker compose -f docker-compose.production.yml down

# 3. Backup database
docker exec aria-postgres pg_dump -U aria aria > backup_before_update.sql

# 4. Update files
cp -r /path/to/new-version/* /opt/aria/

# 5. Rebuild and restart
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d

# 6. Verify health
./deployment/tests/health-check.sh
```

## Troubleshooting

### Common Issues

#### Services Not Starting

```bash
# Check Docker daemon
sudo systemctl status docker

# Check container logs
docker logs aria-frontend --tail 50
docker logs aria-backend --tail 50

# Check disk space
df -h

# Check memory
free -h
```

#### Database Connection Errors

```bash
# Check PostgreSQL is running
docker exec aria-postgres pg_isready -U aria

# Check database logs
docker logs aria-postgres --tail 50

# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

#### HTTP 502/504 Errors

```bash
# Check backend health
curl http://localhost:3001/api/health

# Check Caddy configuration
docker exec aria-caddy caddy validate --config /etc/caddy/Caddyfile

# Restart Caddy
docker restart aria-caddy
```

#### SSL Certificate Errors

```bash
# Regenerate certificates
cd deployment/ssl
./generate-certs.sh

# Check certificate validity
openssl x509 -in deployment/caddy/certs/server.crt -noout -dates

# Restart Caddy
docker restart aria-caddy
```

### Getting Help

1. Check the logs (see [Viewing Logs](#viewing-logs))
2. Run health check script (see [Health Checks](#health-checks))
3. Review the [GitHub Issues](https://github.com/Karthik-beta/Aria/issues)
4. Contact your system administrator

## Security Considerations

### Production Checklist

- [ ] Changed all default passwords in `.env`
- [ ] Generated strong JWT secret
- [ ] Set appropriate CORS_ORIGIN values
- [ ] Configured firewall to restrict access
- [ ] Set LOG_LEVEL to `info` or `warn` (not `debug`)
- [ ] Disabled DEBUG mode (`DEBUG=false`)
- [ ] Configured regular database backups
- [ ] Set up SSL certificates (Let's Encrypt or custom)
- [ ] Reviewed and limited exposed ports
- [ ] Configured monitoring and alerting
- [ ] Tested backup and restore procedures

### Firewall Configuration

#### Linux (ufw)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp

# Enable firewall
sudo ufw enable
```

#### Windows (PowerShell)

```powershell
# Allow HTTP
New-NetFirewallRule -DisplayName "Aria HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

# Allow HTTPS
New-NetFirewallRule -DisplayName "Aria HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Aria HTTP/3" -Direction Inbound -LocalPort 443 -Protocol UDP -Action Allow
```

### Regular Maintenance

- **Weekly**: Review logs for errors
- **Monthly**: Update Docker images, rotate logs
- **Quarterly**: Review security settings, test disaster recovery
- **Annually**: Rotate passwords and secrets

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Internet/LAN                        │
└────────────────────────┬────────────────────────────────┘
                         │
                         │ HTTP/HTTPS/HTTP3
                         │
                    ┌────▼────┐
                    │  Caddy  │
                    │ Reverse │
                    │  Proxy  │
                    └─┬────┬──┘
                      │    │
           ┌──────────┘    └──────────┐
           │                          │
      ┌────▼─────┐              ┌────▼────┐
      │  Next.js │              │ NestJS  │
      │ Frontend │              │ Backend │
      └──────────┘              └─┬───┬───┘
                                  │   │
                       ┌──────────┘   └──────────┐
                       │                         │
                  ┌────▼─────┐           ┌──────▼──────┐
                  │PostgreSQL│           │   Redis     │
                  │ Database │           │   Cache     │
                  └──────────┘           └─────────────┘
```

### Network Architecture

- **aria-network**: Internal Docker bridge network
- All services communicate internally via Docker network
- Only Caddy exposes ports 80, 443 to the host
- Database and Redis are not exposed externally

### Data Persistence

- **postgres-data**: PostgreSQL database files
- **redis-data**: Redis persistence files
- **caddy-data**: Caddy certificates and configuration
- **caddy-config**: Caddy runtime configuration

---

## License

This deployment configuration is part of the Aria ERP project.
See the main project LICENSE file for details.

## Support

For issues, questions, or contributions, please visit:
- GitHub: https://github.com/Karthik-beta/Aria
- Issues: https://github.com/Karthik-beta/Aria/issues
