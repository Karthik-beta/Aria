# Aria ERP Deployment Infrastructure

> Complete deployment infrastructure rewrite for Aria B2B ERP system

## Overview

This directory contains the complete production-ready deployment infrastructure for the Aria ERP system, designed to support both Linux and Windows 11 platforms with enterprise-grade features.

## Architecture Highlights

### Technology Stack

- **Caddy v2.8**: Modern reverse proxy with automatic HTTPS, HTTP/3 support, and zero-config SSL
- **Docker 24.0+**: Container orchestration with multi-stage builds
- **Docker Compose v2.20+**: Service orchestration with separate dev/prod configurations
- **PostgreSQL 18 Alpine**: Production database with optimized settings
- **Redis 7 Alpine**: High-performance caching and session management
- **Next.js 16**: Multi-zone architecture consolidated in single app with standalone output
- **NestJS 11**: Backend API with TypeScript-first development

### Key Features

✅ **Cross-Platform Support**: Linux (Ubuntu/Debian/RHEL) and Windows 11  
✅ **HTTP/3 Ready**: Caddy configured for HTTP/3 with UDP support  
✅ **Auto-SSL**: Self-signed certificates for private networks, Let's Encrypt for public domains  
✅ **Multi-Stage Builds**: Optimized Docker images (development and production targets)  
✅ **Health Checks**: Comprehensive health monitoring for all services  
✅ **Resource Limits**: CPU and memory constraints to prevent resource exhaustion  
✅ **Security Hardening**: HSTS, CSP, rate limiting, and security headers  
✅ **Service Management**: systemd (Linux) and WinSW (Windows)  
✅ **Automated Testing**: Health check scripts and CI/CD pipeline  
✅ **Hot Reload**: Development environment with HMR for frontend and backend

## Directory Structure

```
deployment/
├── README.md                      # Comprehensive deployment guide
├── QUICKSTART.md                  # Fast-track installation for common scenarios
├── TROUBLESHOOTING.md             # Detailed troubleshooting guide
├── DEPLOYMENT_CHECKLIST.md        # Pre/post deployment verification checklist
│
├── caddy/                         # Caddy reverse proxy configuration
│   ├── Caddyfile.development      # Development config (HTTP, debug logging)
│   ├── Caddyfile.production       # Production config (HTTPS, HTTP/3, security)
│   └── certs/                     # SSL certificate storage (generated)
│       ├── server.crt
│       └── server.key
│
├── ssl/                           # SSL certificate generation
│   ├── generate-certs.sh          # Linux certificate generation script
│   ├── generate-certs.ps1         # Windows certificate generation script
│   └── Dockerfile                 # Docker container for SSL generation
│
├── scripts/                       # Installation automation
│   ├── install-linux.sh           # Linux automated installer (400+ lines)
│   └── install-windows.ps1        # Windows automated installer (450+ lines)
│
├── systemd/                       # Linux service management
│   └── aria-erp.service           # systemd unit file
│
├── windows/                       # Windows service management
│   └── aria-erp.xml               # WinSW service configuration
│
└── tests/                         # Deployment testing
    ├── health-check.sh            # Linux health check script
    └── health-check.ps1           # Windows health check script
```

## Quick Start

### Development (5 minutes)

```bash
# Copy environment template
cp .env.development.template .env

# Start all services
docker compose -f docker-compose.development.yml up -d

# Access application
open http://localhost
```

### Production - Linux (15 minutes)

```bash
# Configure environment
cp .env.production.template .env
nano .env  # Set POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, DOMAIN

# Run automated installer
sudo ./deployment/scripts/install-linux.sh

# Verify deployment
./deployment/tests/health-check.sh
```

### Production - Windows (20 minutes)

```powershell
# Configure environment (Run as Administrator)
Copy-Item .env.production.template .env
notepad .env  # Set POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, DOMAIN

# Run automated installer
.\deployment\scripts\install-windows.ps1

# Verify deployment
.\deployment\tests\health-check.ps1
```

## Documentation Quick Links

| Document                                           | Purpose                                    |
| -------------------------------------------------- | ------------------------------------------ |
| [README.md](README.md)                             | Complete deployment guide with all details |
| [QUICKSTART.md](QUICKSTART.md)                     | Fast installation for common scenarios     |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md)           | Solutions for common deployment issues     |
| [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) | Pre/post deployment verification           |

## Configuration Files

### Docker Compose

| File                             | Purpose                 | Environment |
| -------------------------------- | ----------------------- | ----------- |
| `docker-compose.development.yml` | Development environment | Development |
| `docker-compose.production.yml`  | Production deployment   | Production  |

**Key Differences**:

| Feature           | Development                 | Production                     |
| ----------------- | --------------------------- | ------------------------------ |
| SSL               | Disabled (HTTP only)        | Enabled (HTTPS + HTTP/3)       |
| Hot Reload        | Enabled with volume mounts  | Disabled (standalone builds)   |
| Logging           | Debug level, console output | Info level, JSON structured    |
| Resource Limits   | None                        | CPU and memory limits enforced |
| Health Checks     | Relaxed intervals           | Strict intervals with retries  |
| Container Restart | `no`                        | `unless-stopped`               |

### Caddy Reverse Proxy

| File                          | Purpose                   | Features                        |
| ----------------------------- | ------------------------- | ------------------------------- |
| `caddy/Caddyfile.development` | Development reverse proxy | HTTP, debug logs, no SSL        |
| `caddy/Caddyfile.production`  | Production reverse proxy  | HTTPS, HTTP/3, security headers |

**Production Security Features**:

- Strict Transport Security (HSTS) with 1-year max-age
- Content Security Policy (CSP)
- X-Frame-Options: SAMEORIGIN
- Rate limiting: 100 requests/minute per IP
- Zstandard and gzip compression
- Health check endpoints

### Environment Variables

| Variable            | Required | Default   | Description                           |
| ------------------- | -------- | --------- | ------------------------------------- |
| `POSTGRES_PASSWORD` | **Yes**  | (none)    | PostgreSQL database password          |
| `REDIS_PASSWORD`    | **Yes**  | (none)    | Redis cache password                  |
| `JWT_SECRET`        | **Yes**  | (none)    | JWT signing secret (64+ chars)        |
| `DOMAIN`            | **Yes**  | localhost | Server domain or IP address           |
| `LOG_LEVEL`         | No       | info      | Logging level (debug/info/warn/error) |
| `DEBUG`             | No       | false     | Enable debug mode                     |
| `CORS_ORIGIN`       | No       | \*        | Allowed CORS origins                  |
| `JWT_EXPIRATION`    | No       | 12h       | JWT token lifetime                    |

## Service Architecture

### Network Topology

```
Internet/LAN
     │
     ▼
  [Caddy] :80, :443 (TCP/UDP)
     │
     ├─────────────┬──────────────┐
     ▼             ▼              ▼
[Frontend]    [Backend]      [Health]
  :3000         :3001
     │             │
     │             ├────────┬─────────┐
     │             ▼        ▼         ▼
     │        [PostgreSQL] [Redis]
     │           :5432     :6379
     │
     └─────────────┘
```

### Container Communication

- **External Access**: Only Caddy exposes ports (80, 443) to host
- **Internal Network**: All services communicate via Docker bridge network `aria-network`
- **Database Isolation**: PostgreSQL and Redis are not accessible from outside Docker network
- **Service Discovery**: Containers reference each other by service name (e.g., `postgres`, `backend`)

## Multi-Stage Dockerfiles

### Backend (`apps/backend/Dockerfile`)

**Stages**:

1. **base**: Base Node.js 22 Alpine with pnpm
2. **deps**: Install production and development dependencies separately
3. **development**: Development target with hot-reload support
4. **builder**: Build NestJS application with Prisma
5. **runner**: Minimal production image (non-root user, health check)

**Optimizations**:

- Separate dependency layers for better caching
- Multi-architecture support (amd64, arm64)
- Non-root user execution (`nestjs:nodejs`)
- Health check endpoint monitoring
- Prisma client pre-generated

### Frontend (`apps/frontend/Dockerfile`)

**Stages**:

1. **base**: Base Node.js 22 Alpine with pnpm
2. **deps**: Install dependencies
3. **development**: Development target with hot-reload
4. **builder**: Build Next.js standalone output
5. **runner**: Minimal production image with standalone server

**Optimizations**:

- Next.js standalone output for minimal image size
- Automatic static file optimization
- Non-root user execution (`nextjs:nodejs`)
- Health check monitoring
- Multi-architecture support

## SSL/TLS Configuration

### Self-Signed Certificates (Private Networks)

**Linux**:

```bash
cd deployment/ssl
./generate-certs.sh
```

**Windows**:

```powershell
cd deployment\ssl
.\generate-certs.ps1
```

**Features**:

- Automatic IP address detection
- Multi-IP Subject Alternative Name (SAN) support
- 365-day validity (configurable)
- EC P-384 curve (secure and performant)

### Let's Encrypt (Public Domains)

Caddy automatically obtains and renews Let's Encrypt certificates when:

1. `DOMAIN` is set to a public domain name (not IP)
2. Ports 80 and 443 are accessible from the internet
3. DNS A record points to server IP

**No additional configuration required** - Caddy handles everything automatically.

### Custom Certificates

Place your certificate files in `deployment/caddy/certs/`:

- `server.crt` - SSL certificate (PEM format)
- `server.key` - Private key (PEM format)

Restart Caddy to apply:

```bash
docker restart aria-caddy
```

## Service Management

### Linux (systemd)

| Command                           | Purpose          |
| --------------------------------- | ---------------- |
| `sudo systemctl start aria-erp`   | Start service    |
| `sudo systemctl stop aria-erp`    | Stop service     |
| `sudo systemctl restart aria-erp` | Restart service  |
| `sudo systemctl status aria-erp`  | Check status     |
| `sudo journalctl -u aria-erp -f`  | View logs (live) |

**Service Features**:

- Automatic start on boot
- Restart on failure (max 5 times in 300s)
- 300-second startup timeout
- Journal logging integration

### Windows (WinSW)

| Command                   | Purpose         |
| ------------------------- | --------------- |
| `Start-Service AriaERP`   | Start service   |
| `Stop-Service AriaERP`    | Stop service    |
| `Restart-Service AriaERP` | Restart service |
| `Get-Service AriaERP`     | Check status    |

**Service Features**:

- Automatic start on boot (delayed)
- Restart on failure (3 times)
- Log rotation (10MB per file, 8 files)
- Environment variable passthrough

## Testing and Validation

### Health Check Scripts

**Linux**:

```bash
./deployment/tests/health-check.sh
```

**Windows**:

```powershell
.\deployment\tests\health-check.ps1
```

**Test Coverage**:

- ✅ Container status (running, healthy)
- ✅ HTTP/HTTPS endpoint availability
- ✅ Backend API health endpoint
- ✅ Database connectivity (PostgreSQL)
- ✅ Redis connectivity
- ✅ Docker network configuration
- ✅ Volume persistence
- ✅ Resource usage (CPU, memory)
- ✅ Log health (error detection)

**Output**: Color-coded pass/fail with summary statistics

### CI/CD Pipeline (`.github/workflows/deployment-test.yml`)

**GitHub Actions Workflow**:

| Job                       | Purpose                           |
| ------------------------- | --------------------------------- |
| `test-linux-deployment`   | Build and test Linux deployment   |
| `test-windows-deployment` | Build and test Windows deployment |
| `security-scan`           | Trivy vulnerability scanning      |
| `performance-test`        | Artillery load testing            |

**Triggers**:

- Push to `main`, `master`, or `refactor` branches
- Pull requests to these branches
- Manual workflow dispatch

**Features**:

- Docker layer caching for faster builds
- Parallel job execution
- Health check validation
- Endpoint testing
- Security vulnerability reports
- Performance metrics

## Installation Scripts

### Linux (`scripts/install-linux.sh`)

**Features** (400+ lines):

- ✅ System requirements check
- ✅ Docker and Docker Compose installation
- ✅ Environment validation
- ✅ SSL certificate generation
- ✅ Service build and start
- ✅ systemd service installation
- ✅ Health check verification
- ✅ Rollback capability
- ✅ Color-coded logging

### Windows (`scripts/install-windows.ps1`)

**Features** (450+ lines):

- ✅ Administrator privilege check
- ✅ Docker Desktop validation
- ✅ Environment validation
- ✅ SSL certificate generation
- ✅ Service build and start
- ✅ WinSW download and installation
- ✅ Windows service registration
- ✅ Health check verification
- ✅ Detailed error handling
- ✅ PowerShell help system

## Security Considerations

### Production Security Checklist

- [x] Strong passwords for PostgreSQL, Redis, JWT
- [x] HTTPS enforced (HTTP redirects to HTTPS)
- [x] Security headers configured (HSTS, CSP, X-Frame-Options)
- [x] Rate limiting enabled (100 req/min per IP)
- [x] Database and Redis not exposed externally
- [x] Non-root container execution
- [x] Resource limits prevent DoS
- [x] Structured JSON logging for audit trails
- [x] Health check endpoints (no sensitive data)
- [ ] Firewall configuration (manual step)
- [ ] Regular security updates (manual maintenance)
- [ ] Backup encryption (to be implemented)

### Network Security

**Exposed Ports**:

- 80/tcp (HTTP, redirects to HTTPS)
- 443/tcp (HTTPS)
- 443/udp (HTTP/3)

**Internal Only**:

- PostgreSQL (5432) - Docker network only
- Redis (6379) - Docker network only
- Backend (3001) - Docker network only
- Frontend (3000) - Docker network only

**Recommendation**: Configure firewall to allow only ports 80 and 443 from trusted networks.

## Performance Optimization

### Resource Limits (Production)

| Service    | CPU Limit | Memory Limit | Reservation |
| ---------- | --------- | ------------ | ----------- |
| Frontend   | 1.0       | 1GB          | 512MB       |
| Backend    | 1.0       | 1GB          | 512MB       |
| PostgreSQL | 2.0       | 2GB          | 1GB         |
| Redis      | 0.5       | 512MB        | 256MB       |
| Caddy      | 0.5       | 256MB        | 128MB       |

### Database Tuning

**PostgreSQL Production Settings**:

- `max_connections=200`
- `shared_buffers=256MB`
- `effective_cache_size=768MB`
- `maintenance_work_mem=64MB`
- `random_page_cost=1.1` (SSD optimized)

### Caching Strategy

**Redis Configuration**:

- RDB persistence enabled
- AOF persistence optional
- Password authentication required
- Connection pooling via backend

## Maintenance

### Regular Tasks

| Frequency | Task                             | Command                                                       |
| --------- | -------------------------------- | ------------------------------------------------------------- |
| Daily     | Check service health             | `./deployment/tests/health-check.sh`                          |
| Daily     | Database backup                  | `docker exec aria-postgres pg_dump -U aria aria > backup.sql` |
| Weekly    | Review logs for errors           | `docker logs aria-backend 2>&1 \| grep -i error`              |
| Monthly   | Update Docker images             | `docker compose pull && docker compose up -d`                 |
| Monthly   | Rotate logs manually (if needed) | `truncate -s 0 /var/lib/docker/containers/*/log`              |
| Quarterly | Review security settings         | Review `.env`, firewall rules, certificates                   |
| Quarterly | Test disaster recovery           | Restore from backup in test environment                       |
| Annually  | Rotate passwords and secrets     | Update `.env` and restart services                            |

### Backup Procedures

**Database Backup** (Daily recommended):

```bash
# Create backup
docker exec aria-postgres pg_dump -U aria aria > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup_20250123.sql | docker exec -i aria-postgres psql -U aria aria
```

**Volume Backup** (Weekly recommended):

```bash
# Backup volume
docker run --rm -v aria_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-data-$(date +%Y%m%d).tar.gz -C /data .

# Restore volume
docker run --rm -v aria_postgres-data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/postgres-data-20250123.tar.gz"
```

### Updating the Application

```bash
# 1. Backup database
docker exec aria-postgres pg_dump -U aria aria > backup-before-update.sql

# 2. Stop services
docker compose -f docker-compose.production.yml down

# 3. Update files (pull new version or extract package)
git pull origin main  # or extract new deployment package

# 4. Rebuild images
docker compose -f docker-compose.production.yml build --no-cache

# 5. Start services
docker compose -f docker-compose.production.yml up -d

# 6. Verify health
./deployment/tests/health-check.sh
```

## Troubleshooting

For detailed troubleshooting guidance, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

**Common Issues Quick Reference**:

| Issue                     | Quick Fix                                        |
| ------------------------- | ------------------------------------------------ |
| Container won't start     | Check logs: `docker logs aria-<service>`         |
| HTTP 502 errors           | Restart Caddy: `docker restart aria-caddy`       |
| Database connection fails | Verify DATABASE_URL in `.env`                    |
| SSL certificate errors    | Regenerate: `./deployment/ssl/generate-certs.sh` |
| Service won't auto-start  | Check systemd/service status                     |

## Support and Resources

- **GitHub Repository**: https://github.com/Karthik-beta/Aria
- **Issues**: https://github.com/Karthik-beta/Aria/issues
- **Documentation**: `docs/` directory
- **Deployment Guide**: [README.md](README.md)
- **Quick Start**: [QUICKSTART.md](QUICKSTART.md)

## License

This deployment configuration is part of the Aria ERP project. See the main project LICENSE file for details.

---

**Last Updated**: 2025-01-23  
**Infrastructure Version**: 1.0.0  
**Supported Platforms**: Linux (Ubuntu 20.04+, Debian 11+, RHEL 8+), Windows 11
