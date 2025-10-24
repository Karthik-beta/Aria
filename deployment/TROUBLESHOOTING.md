# Aria ERP Deployment Troubleshooting Guide

> Comprehensive solutions for common deployment issues

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Container Issues](#container-issues)
- [Network Issues](#network-issues)
- [Database Issues](#database-issues)
- [SSL/HTTPS Issues](#sslhttps-issues)
- [Performance Issues](#performance-issues)
- [Build Issues](#build-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Recovery Procedures](#recovery-procedures)

## Quick Diagnostics

### Run Health Check

```bash
# Linux
./deployment/tests/health-check.sh

# Windows
.\deployment\tests\health-check.ps1
```

### Check All Services Status

```bash
# Check Docker containers
docker ps -a

# Check service health
docker inspect aria-frontend --format='{{.State.Health.Status}}'
docker inspect aria-backend --format='{{.State.Health.Status}}'
docker inspect aria-postgres --format='{{.State.Health.Status}}'

# View logs
docker compose -f docker-compose.production.yml logs --tail=50
```

### System Resources

```bash
# Disk space
df -h

# Memory usage
free -h
# or on Windows:
systeminfo | findstr /C:"Available Physical Memory"

# Docker disk usage
docker system df
```

## Container Issues

### Container Won't Start

**Symptoms**: Container repeatedly restarting or failing to start

**Diagnosis**:

```bash
# Check container status
docker ps -a

# View logs
docker logs aria-<service-name> --tail=100

# Inspect container
docker inspect aria-<service-name>
```

**Solutions**:

1. **Port Conflict**:

   ```bash
   # Check if port is already in use (Linux)
   sudo netstat -tulpn | grep :80
   sudo netstat -tulpn | grep :443

   # Windows
   netstat -ano | findstr :80
   netstat -ano | findstr :443
   ```

   - Stop the conflicting process or change the port in docker-compose

2. **Insufficient Resources**:

   ```bash
   # Increase Docker memory limit in Docker Desktop settings
   # Or modify docker-compose resource limits
   ```

3. **Configuration Error**:

   ```bash
   # Validate environment variables
   cat .env

   # Check for missing required variables
   grep -E "^[A-Z_]+=$" .env
   ```

4. **Corrupted Image**:
   ```bash
   # Remove and rebuild
   docker compose down
   docker system prune -a
   docker compose -f docker-compose.production.yml build --no-cache
   docker compose -f docker-compose.production.yml up -d
   ```

### Container Keeps Restarting

**Diagnosis**:

```bash
# Check restart count
docker inspect aria-<service> --format='{{.RestartCount}}'

# View recent logs
docker logs aria-<service> --tail=50 --since=10m
```

**Common Causes**:

1. **Database Not Ready**:

   ```bash
   # Check database health
   docker exec aria-postgres pg_isready -U aria

   # Wait for database
   timeout 30 bash -c 'until docker exec aria-postgres pg_isready -U aria; do sleep 1; done'
   ```

2. **Failed Health Checks**:

   ```bash
   # Test health endpoint manually
   docker exec aria-backend curl -f http://localhost:3001/api/health

   # Check health check configuration
   docker inspect aria-backend --format='{{json .State.Health}}' | jq
   ```

3. **Application Crash**:

   ```bash
   # Check for errors in logs
   docker logs aria-backend 2>&1 | grep -i error

   # Run container in foreground for debugging
   docker compose stop backend
   docker compose run --rm backend npm run start:prod
   ```

### Container Running but Not Responding

**Diagnosis**:

```bash
# Check if process is running inside container
docker exec aria-backend ps aux

# Check listening ports
docker exec aria-backend netstat -tlnp

# Test internal connectivity
docker exec aria-caddy wget -O- http://backend:3001/api/health
```

**Solutions**:

1. **Application Not Listening**:

   ```bash
   # Check backend port configuration
   docker exec aria-backend cat /app/.env | grep PORT

   # Restart backend
   docker restart aria-backend
   ```

2. **Network Issues** (see [Network Issues](#network-issues))

## Network Issues

### Cannot Access Application from Browser

**Symptoms**: Connection timeout, connection refused, or 502/504 errors

**Diagnosis**:

```bash
# Test local access (on server)
curl -I http://localhost
curl -I https://localhost -k

# Test from network (replace with server IP)
curl -I http://192.168.1.100
curl -I https://192.168.1.100 -k

# Check if Caddy is listening
docker exec aria-caddy netstat -tlnp | grep caddy
```

**Solutions**:

1. **Firewall Blocking**:

   ```bash
   # Linux - check firewall
   sudo ufw status

   # Allow HTTP/HTTPS
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 443/udp

   # Windows - check firewall
   Get-NetFirewallRule | Where-Object {$_.LocalPort -eq 80 -or $_.LocalPort -eq 443}

   # Add rules if missing
   New-NetFirewallRule -DisplayName "Aria HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "Aria HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
   ```

2. **Docker Network Issues**:

   ```bash
   # Recreate network
   docker compose down
   docker network prune
   docker compose -f docker-compose.production.yml up -d
   ```

3. **Caddy Not Running**:

   ```bash
   # Check Caddy status
   docker logs aria-caddy --tail=50

   # Restart Caddy
   docker restart aria-caddy
   ```

### Internal Service Communication Failing

**Symptoms**: Backend can't reach database, frontend can't reach backend

**Diagnosis**:

```bash
# Check network connectivity
docker exec aria-backend ping postgres -c 3
docker exec aria-frontend ping backend -c 3

# Check DNS resolution
docker exec aria-backend nslookup postgres
docker exec aria-backend nslookup backend

# List networks
docker network ls
docker network inspect aria-network
```

**Solutions**:

1. **Network Not Created**:

   ```bash
   # Create network manually
   docker network create aria-network

   # Restart services
   docker compose -f docker-compose.production.yml up -d
   ```

2. **Service Name Mismatch**:

   ```bash
   # Verify service names in docker-compose
   docker compose config | grep -A 2 "container_name:"

   # Ensure DATABASE_URL uses correct hostname
   cat .env | grep DATABASE_URL
   # Should be: postgresql://aria:password@postgres:5432/aria
   ```

### HTTP 502 Bad Gateway

**Symptoms**: Caddy returns 502 error

**Diagnosis**:

```bash
# Check if backend is responding
docker exec aria-backend curl http://localhost:3001/api/health

# Check Caddy logs
docker logs aria-caddy --tail=50

# Check backend logs
docker logs aria-backend --tail=50
```

**Solutions**:

1. **Backend Not Ready**:

   ```bash
   # Wait for backend health check
   timeout 60 bash -c 'until docker exec aria-backend curl -f http://localhost:3001/api/health; do sleep 2; done'
   ```

2. **Wrong Backend Port**:

   ```bash
   # Verify backend port in Caddyfile
   docker exec aria-caddy cat /etc/caddy/Caddyfile | grep reverse_proxy

   # Should match backend port (default 3001)
   docker exec aria-backend cat /app/.env | grep PORT
   ```

3. **Caddy Configuration Error**:

   ```bash
   # Validate Caddyfile
   docker exec aria-caddy caddy validate --config /etc/caddy/Caddyfile

   # Reload Caddy
   docker exec aria-caddy caddy reload --config /etc/caddy/Caddyfile
   ```

## Database Issues

### Database Connection Failed

**Symptoms**: Backend logs show database connection errors

**Diagnosis**:

```bash
# Check if PostgreSQL is running
docker exec aria-postgres pg_isready -U aria

# Test connection
docker exec aria-postgres psql -U aria -d aria -c "SELECT version();"

# Check DATABASE_URL
cat .env | grep DATABASE_URL
```

**Solutions**:

1. **Wrong Password**:

   ```bash
   # Verify password matches in .env
   cat .env | grep POSTGRES_PASSWORD
   cat .env | grep DATABASE_URL

   # Update DATABASE_URL if mismatch found
   nano .env
   docker compose restart backend
   ```

2. **Database Not Ready**:

   ```bash
   # Wait for database
   docker exec aria-postgres bash -c 'until pg_isready -U aria; do sleep 1; done'

   # Restart backend
   docker restart aria-backend
   ```

3. **Database Corrupted**:

   ```bash
   # Check database integrity
   docker exec aria-postgres psql -U aria -c "SELECT pg_database_size('aria');"

   # If corrupted, restore from backup (see Recovery Procedures)
   ```

### Database Performance Issues

**Symptoms**: Slow queries, high CPU usage

**Diagnosis**:

```bash
# Check active connections
docker exec aria-postgres psql -U aria -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
docker exec aria-postgres psql -U aria -c "SELECT pid, now() - query_start as duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC;"

# Check database size
docker exec aria-postgres psql -U aria -c "SELECT pg_size_pretty(pg_database_size('aria'));"
```

**Solutions**:

1. **Too Many Connections**:

   ```bash
   # Increase max_connections (edit docker-compose.production.yml)
   # Add under postgres command:
   # - -c max_connections=200

   docker compose down
   docker compose -f docker-compose.production.yml up -d
   ```

2. **Missing Indexes**:

   ```sql
   -- Connect to database
   docker exec -it aria-postgres psql -U aria

   -- Find missing indexes
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats
   WHERE schemaname = 'public'
   ORDER BY abs(correlation) DESC;

   -- Add indexes as needed (consult with development team)
   ```

3. **Insufficient Resources**:
   ```bash
   # Increase shared_buffers (edit docker-compose.production.yml)
   # - -c shared_buffers=512MB
   # - -c effective_cache_size=1GB
   ```

### Database Disk Full

**Diagnosis**:

```bash
# Check disk usage
df -h
docker system df -v

# Check database size
docker exec aria-postgres psql -U aria -c "SELECT pg_size_pretty(pg_database_size('aria'));"
```

**Solutions**:

1. **Clean Old Data**:

   ```bash
   # Vacuum database
   docker exec aria-postgres psql -U aria -c "VACUUM FULL;"

   # Analyze tables
   docker exec aria-postgres psql -U aria -c "ANALYZE;"
   ```

2. **Clean Docker Volumes**:

   ```bash
   # WARNING: This will delete all unused data
   docker system prune -a --volumes
   ```

3. **Expand Disk** (consult system administrator)

## SSL/HTTPS Issues

### SSL Certificate Errors

**Symptoms**: Browser shows "Your connection is not private" or "NET::ERR_CERT_AUTHORITY_INVALID"

**Diagnosis**:

```bash
# Check certificate validity
openssl x509 -in deployment/caddy/certs/server.crt -noout -dates -subject -issuer

# Check Caddy SSL configuration
docker exec aria-caddy caddy adapt --config /etc/caddy/Caddyfile
```

**Solutions**:

1. **Self-Signed Certificate Warning** (Expected for private networks):
   - Click "Advanced" in browser and proceed (for internal use only)
   - Or install the certificate in browser/OS trusted store

2. **Expired Certificate**:

   ```bash
   # Regenerate certificates
   cd deployment/ssl
   ./generate-certs.sh  # Linux
   # or
   .\generate-certs.ps1  # Windows

   # Restart Caddy
   docker restart aria-caddy
   ```

3. **Certificate Not Matching Domain**:

   ```bash
   # Check certificate SAN (Subject Alternative Name)
   openssl x509 -in deployment/caddy/certs/server.crt -noout -text | grep "DNS:"

   # Regenerate with correct IPs
   cd deployment/ssl
   IP_ADDRESSES="192.168.1.100,192.168.1.101" ./generate-certs.sh
   ```

### HTTP/3 Not Working

**Diagnosis**:

```bash
# Check if UDP 443 is open
nc -u -v localhost 443

# Check Caddy logs for HTTP/3 support
docker logs aria-caddy | grep -i "http/3"

# Test with curl (requires curl with HTTP/3 support)
curl --http3 https://localhost -k -I
```

**Solutions**:

1. **Firewall Blocking UDP**:

   ```bash
   # Linux
   sudo ufw allow 443/udp

   # Windows
   New-NetFirewallRule -DisplayName "Aria HTTP/3" -Direction Inbound -LocalPort 443 -Protocol UDP -Action Allow
   ```

2. **Client Doesn't Support HTTP/3**:
   - Caddy automatically falls back to HTTP/2 or HTTP/1.1
   - No action needed

## Performance Issues

### Slow Response Times

**Diagnosis**:

```bash
# Test response times
time curl -I http://localhost

# Check resource usage
docker stats

# Check backend logs for slow operations
docker logs aria-backend | grep -i slow
```

**Solutions**:

1. **Insufficient Resources**:

   ```bash
   # Increase container resources (edit docker-compose.production.yml)
   # Under services > backend:
   #   deploy:
   #     resources:
   #       limits:
   #         cpus: '2'
   #         memory: 2G
   ```

2. **Database Query Issues** (see [Database Performance Issues](#database-performance-issues))

3. **Enable Caching**:

   ```bash
   # Verify Redis is running
   docker exec aria-redis redis-cli ping

   # Check Redis password configuration
   cat .env | grep REDIS_PASSWORD
   cat .env | grep REDIS_URL
   ```

### High Memory Usage

**Diagnosis**:

```bash
# Check container memory usage
docker stats --no-stream

# Check individual processes
docker exec aria-backend ps aux --sort=-%mem | head -10
```

**Solutions**:

1. **Memory Leak** (requires investigation by development team):

   ```bash
   # Restart affected service as temporary fix
   docker restart aria-backend
   ```

2. **Increase Memory Limits**:
   ```bash
   # Edit docker-compose.production.yml
   # Increase memory limits for affected services
   docker compose down
   docker compose -f docker-compose.production.yml up -d
   ```

### High CPU Usage

**Diagnosis**:

```bash
# Check CPU usage
docker stats --no-stream

# Check processes
docker exec aria-backend top -b -n 1
```

**Solutions**:

1. **Runaway Process**:

   ```bash
   # Identify and kill problematic process
   docker exec aria-backend ps aux
   docker exec aria-backend kill -9 <PID>

   # Or restart container
   docker restart aria-backend
   ```

2. **Increase CPU Limits**:
   ```bash
   # Edit docker-compose.production.yml
   # Adjust CPU limits
   ```

## Build Issues

### Docker Build Fails

**Symptoms**: `docker compose build` fails with errors

**Diagnosis**:

```bash
# Build with verbose output
docker compose -f docker-compose.production.yml build --progress=plain --no-cache

# Check disk space
df -h
docker system df
```

**Common Errors**:

1. **COPY Failed: No Such File or Directory**:

   ```bash
   # Verify files exist
   ls -la apps/backend/package.json
   ls -la apps/frontend/package.json

   # Check Dockerfile paths
   cat apps/backend/Dockerfile | grep COPY
   ```

2. **npm/pnpm Install Fails**:

   ```bash
   # Clear npm cache
   docker builder prune -a

   # Rebuild with fresh cache
   docker compose -f docker-compose.production.yml build --no-cache
   ```

3. **Network Timeout**:

   ```bash
   # Configure DNS (edit /etc/docker/daemon.json)
   {
     "dns": ["8.8.8.8", "8.8.4.4"]
   }

   # Restart Docker
   sudo systemctl restart docker
   ```

### Build Succeeds but Runtime Fails

**Diagnosis**:

```bash
# Check built image
docker images | grep aria

# Inspect image layers
docker history aria-backend:latest

# Run container interactively
docker run --rm -it aria-backend:latest sh
```

**Solutions**:

1. **Missing Files**:

   ```bash
   # List files in image
   docker run --rm aria-backend:latest ls -la /app

   # Check Dockerfile COPY commands
   cat apps/backend/Dockerfile
   ```

2. **Wrong Entry Point**:
   ```bash
   # Check CMD/ENTRYPOINT
   docker inspect aria-backend:latest --format='{{.Config.Cmd}}'
   docker inspect aria-backend:latest --format='{{.Config.Entrypoint}}'
   ```

## Platform-Specific Issues

### Linux-Specific Issues

#### Permission Denied Errors

```bash
# Check file ownership
ls -la /opt/aria

# Fix ownership
sudo chown -R $USER:$USER /opt/aria

# Check Docker permissions
groups | grep docker
# If not in docker group:
sudo usermod -aG docker $USER
newgrp docker
```

#### Systemd Service Won't Start

```bash
# Check service status
sudo systemctl status aria-erp

# Check journal logs
sudo journalctl -u aria-erp -n 50 --no-pager

# Validate service file
sudo systemd-analyze verify /etc/systemd/system/aria-erp.service

# Reload systemd
sudo systemctl daemon-reload
sudo systemctl restart aria-erp
```

### Windows-Specific Issues

#### Docker Desktop Not Running

```powershell
# Check Docker Desktop status
Get-Process "Docker Desktop" -ErrorAction SilentlyContinue

# Start Docker Desktop
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# Wait for Docker to be ready
while (-not (docker ps 2>$null)) {
    Start-Sleep -Seconds 2
}
```

#### WinSW Service Issues

```powershell
# Check service status
Get-Service AriaERP

# View service logs
Get-Content C:\aria\logs\*.log -Tail 50

# Reinstall service
.\AriaERP.exe uninstall
.\AriaERP.exe install
.\AriaERP.exe start
```

#### Windows Firewall Blocking

```powershell
# Check firewall rules
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Aria*"}

# Disable firewall temporarily for testing (not recommended for production)
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

# Re-enable after testing
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

## Recovery Procedures

### Complete System Recovery

```bash
# 1. Stop all services
docker compose -f docker-compose.production.yml down

# 2. Backup current state
docker run --rm -v aria_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup-$(date +%Y%m%d).tar.gz -C /data .

# 3. Remove all containers and volumes
docker compose -f docker-compose.production.yml down -v

# 4. Clean Docker system
docker system prune -a

# 5. Rebuild from scratch
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d

# 6. Wait for services to be healthy
./deployment/tests/health-check.sh

# 7. Restore database if needed (see Database Recovery)
```

### Database Recovery

#### From SQL Backup

```bash
# 1. Stop backend to prevent new connections
docker compose stop backend

# 2. Drop and recreate database
docker exec aria-postgres psql -U aria -c "DROP DATABASE IF EXISTS aria;"
docker exec aria-postgres psql -U aria -c "CREATE DATABASE aria;"

# 3. Restore from backup
cat backup_20250123.sql | docker exec -i aria-postgres psql -U aria -d aria

# 4. Start backend
docker compose start backend

# 5. Verify restoration
docker exec aria-postgres psql -U aria -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
```

#### From Volume Backup

```bash
# 1. Stop all services
docker compose down

# 2. Remove old volume
docker volume rm aria_postgres-data

# 3. Create new volume
docker volume create aria_postgres-data

# 4. Restore volume data
docker run --rm -v aria_postgres-data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/postgres-backup-20250123.tar.gz"

# 5. Start services
docker compose -f docker-compose.production.yml up -d
```

### Configuration Recovery

```bash
# 1. Restore from backup
cp .env.backup .env
cp docker-compose.production.yml.backup docker-compose.production.yml

# 2. Restart services
docker compose -f docker-compose.production.yml up -d

# 3. Verify configuration
docker compose config
./deployment/tests/health-check.sh
```

## Logging and Debugging

### Enable Debug Logging

```bash
# Edit .env
LOG_LEVEL=debug
DEBUG=true

# Restart services
docker compose restart
```

### Collect Diagnostic Information

```bash
#!/bin/bash
# Create diagnostic bundle

DIAG_DIR="aria-diagnostics-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIAG_DIR"

# System info
uname -a > "$DIAG_DIR/system-info.txt"
docker version > "$DIAG_DIR/docker-version.txt"
docker compose version > "$DIAG_DIR/compose-version.txt"

# Container status
docker ps -a > "$DIAG_DIR/containers.txt"
docker stats --no-stream > "$DIAG_DIR/container-stats.txt"

# Logs
docker logs aria-frontend > "$DIAG_DIR/frontend.log" 2>&1
docker logs aria-backend > "$DIAG_DIR/backend.log" 2>&1
docker logs aria-postgres > "$DIAG_DIR/postgres.log" 2>&1
docker logs aria-redis > "$DIAG_DIR/redis.log" 2>&1
docker logs aria-caddy > "$DIAG_DIR/caddy.log" 2>&1

# Network
docker network inspect aria-network > "$DIAG_DIR/network.txt"

# Configuration (sanitized)
cat .env | sed 's/PASSWORD=.*/PASSWORD=***REDACTED***/g' > "$DIAG_DIR/env-sanitized.txt"

# Create archive
tar czf "$DIAG_DIR.tar.gz" "$DIAG_DIR"
rm -rf "$DIAG_DIR"

echo "Diagnostic bundle created: $DIAG_DIR.tar.gz"
```

## Getting Additional Help

If the issue persists after trying the solutions above:

1. **Collect diagnostics** using the script above
2. **Run health check** and save output
3. **Gather logs** from affected services
4. **Document steps to reproduce** the issue
5. **Create a GitHub Issue** with:
   - Problem description
   - Steps to reproduce
   - Expected vs actual behavior
   - Diagnostic bundle
   - Environment details (OS, Docker version, etc.)

## Contact

- GitHub Issues: https://github.com/Karthik-beta/Aria/issues
- Documentation: https://github.com/Karthik-beta/Aria/tree/main/docs
