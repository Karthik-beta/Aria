# Aria ERP Troubleshooting Guide

Common issues and their solutions for Aria ERP on-premise deployment.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Service Issues](#service-issues)
- [Network Issues](#network-issues)
- [Database Issues](#database-issues)
- [Performance Issues](#performance-issues)
- [Module Issues](#module-issues)
- [Diagnostic Tools](#diagnostic-tools)

## Installation Issues

### Docker is not installed or not running

**Symptoms:**

- Installation script fails with "Docker not found"
- Commands like `docker version` fail

**Solution:**

**Linux:**

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Verify installation
docker version
```

**Windows:**

1. Download Docker Desktop from https://www.docker.com/products/docker-desktop
2. Install and restart your computer
3. Start Docker Desktop
4. Verify in PowerShell: `docker version`

### Permission denied errors (Linux)

**Symptoms:**

- "Permission denied" when running installation script
- Docker commands fail with permission errors

**Solution:**

```bash
# Run installation script with sudo
sudo ./bin/install-linux.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in for changes to take effect
# Or run: newgrp docker
```

### Port 80 or 443 already in use

**Symptoms:**

- Installation fails with "port already allocated"
- Services won't start

**Solution:**

**Find what's using the port:**

```bash
# Linux
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Windows
netstat -ano | findstr :80
netstat -ano | findstr :443
```

**Options:**

1. Stop the conflicting service
2. Or change Aria ERP ports in `docker-compose.yml`:
   ```yaml
   traefik:
     ports:
       - '8080:80'
       - '8443:443'
   ```

### Disk space issues

**Symptoms:**

- Installation fails with "no space left on device"

**Solution:**

```bash
# Check disk space
df -h

# Clean up Docker resources
docker system prune -a

# Remove unused images
docker image prune -a
```

## Service Issues

### Services won't start

**Symptoms:**

- Services fail to start after installation
- `docker compose ps` shows services as "Exited"

**Solution:**

**Check service status:**

```bash
# Linux
sudo systemctl status aria-erp
docker compose ps

# Windows
docker compose ps
```

**Check logs:**

```bash
# Linux
sudo journalctl -u aria-erp -n 100
docker compose logs

# Windows
docker compose logs
```

**Common fixes:**

1. Verify `.env` file exists and is properly configured
2. Check Docker daemon is running
3. Ensure all required images are loaded
4. Restart services:

   ```bash
   # Linux
   sudo systemctl restart aria-erp

   # Windows
   docker compose down
   docker compose --env-file .env up -d
   ```

### Service keeps restarting

**Symptoms:**

- Container status shows "Restarting"
- Service is unstable

**Solution:**

**Check container logs:**

```bash
docker logs aria-backend
docker logs aria-database
docker logs aria-proxy
```

**Common causes:**

1. **Database connection issues** - Check POSTGRES_PASSWORD in `.env`
2. **Missing environment variables** - Verify `.env` file
3. **Port conflicts** - Check if ports are available
4. **Resource limits** - Increase Docker memory/CPU allocation

### Cannot access service after installation

**Symptoms:**

- Services are running but not accessible via browser
- Connection timeout or refused

**Solution:**

**Verify services are running:**

```bash
docker compose ps
```

**Check network connectivity:**

```bash
# Test locally
curl http://localhost
curl https://localhost -k

# Check if ports are listening
# Linux
sudo netstat -tulpn | grep -E ':(80|443)'

# Windows
netstat -ano | findstr :80
netstat -ano | findstr :443
```

**Check firewall:**

```bash
# Linux (UFW)
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Linux (firewalld)
sudo firewall-cmd --list-all
sudo firewall-cmd --add-service=http --permanent
sudo firewall-cmd --add-service=https --permanent
sudo firewall-cmd --reload
```

**Windows Firewall:**

```powershell
# Check if rules exist
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Aria*"}

# Add rules if missing
New-NetFirewallRule -DisplayName "Aria HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "Aria HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

## Network Issues

### SSL certificate errors

**Symptoms:**

- "Your connection is not private" in browser
- Certificate warnings

**Solution:**

**For development/testing:**
Accept the self-signed certificate warning in your browser.

**For production:**

1. Verify certificates exist:

   ```bash
   # Linux
   ls -la /opt/aria-erp/volumes/traefik/

   # Windows
   dir "C:\Program Files\AriaERP\volumes\traefik"
   ```

2. Check certificate validity:

   ```bash
   openssl x509 -in server.crt -text -noout
   ```

3. Ensure Traefik configuration is correct in `config/traefik/tls.yml`

### Domain not resolving

**Symptoms:**

- Can access via IP but not domain name
- DNS lookup fails

**Solution:**

1. **Verify DNS configuration:**

   ```bash
   nslookup yourdomain.com
   dig yourdomain.com
   ```

2. **Check hosts file for local testing:**

   ```bash
   # Linux
   sudo nano /etc/hosts

   # Windows
   notepad C:\Windows\System32\drivers\etc\hosts
   ```

   Add entry (only one needed for path-based routing):

   ```
   127.0.0.1    yourdomain.com
   ```

   **Note**: Path-based routing uses a single domain, not subdomains.

3. **Flush DNS cache:**

   ```bash
   # Linux
   sudo systemd-resolve --flush-caches

   # Windows
   ipconfig /flushdns
   ```

### Cannot connect from external network

**Symptoms:**

- Works locally but not from other computers
- External access fails

**Solution:**

1. **Verify server IP:**

   ```bash
   # Linux
   ip addr show
   hostname -I

   # Windows
   ipconfig
   ```

2. **Check firewall allows external connections:**

   ```bash
   # Linux
   sudo ufw status verbose

   # Windows
   Get-NetFirewallProfile | Select Name, Enabled
   ```

3. **Verify router/gateway port forwarding** (if behind NAT)

4. **Check security groups/ACLs** (cloud environments)

## Database Issues

### Database connection failures

**Symptoms:**

- Backend logs show "connection refused"
- "Could not connect to database" errors

**Solution:**

**Check database container:**

```bash
docker ps | grep postgres
docker logs aria-database
```

**Verify database is healthy:**

```bash
docker exec aria-database pg_isready -d aria -U aria
```

**Check connection string:**

```bash
# Verify .env file
cat .env | grep POSTGRES
```

**Test database connection:**

```bash
docker exec -it aria-database psql -U aria -d aria
# If successful, type \q to exit
```

**Common fixes:**

1. Restart database container:

   ```bash
   docker restart aria-database
   ```

2. Check database logs for errors:

   ```bash
   docker logs aria-database --tail 100
   ```

3. Verify password matches in `.env`:
   ```env
   POSTGRES_PASSWORD=your_password
   DATABASE_URL=postgresql://aria:your_password@postgres:5432/aria
   ```

### Database data corruption

**Symptoms:**

- Services won't start
- Database logs show corruption errors
- Data inconsistencies

**Solution:**

1. **Stop all services:**

   ```bash
   # Linux
   sudo systemctl stop aria-erp

   # Windows
   docker compose down
   ```

2. **Restore from backup:**

   ```bash
   cat backup.sql | docker exec -i aria-database psql -U aria -d aria
   ```

3. **If no backup, try PostgreSQL recovery:**
   ```bash
   docker exec -it aria-database bash
   su - postgres
   pg_resetwal /var/lib/postgresql/data
   ```

### Out of disk space (database)

**Symptoms:**

- Database writes fail
- "No space left on device" in logs

**Solution:**

1. **Check disk usage:**

   ```bash
   df -h
   docker system df
   ```

2. **Clean up Docker resources:**

   ```bash
   docker system prune -a
   docker volume prune
   ```

3. **Archive old database data**

4. **Increase disk space** or move data directory

## Performance Issues

### Slow response times

**Symptoms:**

- Pages load slowly
- API requests timeout

**Solution:**

1. **Check resource usage:**

   ```bash
   docker stats
   ```

2. **Increase Docker resources:**
   - **Linux**: Edit `/etc/docker/daemon.json`
   - **Windows**: Docker Desktop → Settings → Resources

3. **Check database performance:**

   ```bash
   docker exec -it aria-database psql -U aria -d aria
   # Run: SELECT * FROM pg_stat_activity;
   ```

4. **Review logs for errors:**
   ```bash
   docker compose logs --tail=100
   ```

### High memory usage

**Symptoms:**

- System running out of memory
- Docker containers being killed

**Solution:**

1. **Increase system RAM** or Docker memory limit

2. **Add memory limits to services** in `docker-compose.yml`:

   ```yaml
   backend:
     deploy:
       resources:
         limits:
           memory: 512M
   ```

3. **Monitor memory usage:**
   ```bash
   docker stats --no-stream
   ```

## Module Issues

### Module not loading

**Symptoms:**

- Specific frontend module returns 404
- Module appears disabled

**Solution:**

1. **Check module is enabled in `.env`:**

   ```env
   LICENSED_MODULES=asset,crm,hrms,inventory
   # or
   LICENSED_MODULES=full
   ```

2. **Verify container is running:**

   ```bash
   docker compose ps
   ```

3. **Check container logs:**

   ```bash
   docker logs aria-asset
   docker logs aria-crm
   ```

4. **Restart with correct profile:**
   ```bash
   docker compose --env-file .env up -d
   ```

### Module shows blank page

**Symptoms:**

- Module loads but displays blank/white page
- No error messages visible

**Solution:**

1. **Check browser console** (F12) for JavaScript errors

2. **Verify environment variables:**

   ```bash
   docker exec aria-asset env | grep DOCKER_ENV
   ```

3. **Check module logs:**

   ```bash
   docker logs aria-asset --tail 100
   ```

4. **Rebuild and restart module:**
   ```bash
   docker compose up -d --force-recreate aria-asset
   ```

## Diagnostic Tools

### Comprehensive health check script

**Linux:**

```bash
#!/bin/bash
echo "=== Aria ERP Health Check ==="
echo ""
echo "Docker Status:"
docker version
echo ""
echo "Running Containers:"
docker compose ps
echo ""
echo "Container Health:"
docker ps --format "table {{.Names}}\t{{.Status}}"
echo ""
echo "Disk Usage:"
df -h | grep -E '/$|/opt'
echo ""
echo "Service Status:"
systemctl status aria-erp --no-pager
echo ""
echo "Recent Logs:"
docker compose logs --tail=20
```

**Windows (PowerShell):**

```powershell
Write-Host "=== Aria ERP Health Check ===" -ForegroundColor Green
Write-Host ""
Write-Host "Docker Status:"
docker version
Write-Host ""
Write-Host "Running Containers:"
docker compose ps
Write-Host ""
Write-Host "Container Health:"
docker ps --format "table {{.Names}}\t{{.Status}}"
Write-Host ""
Write-Host "Disk Usage:"
Get-PSDrive C | Select-Object Used,Free
Write-Host ""
Write-Host "Recent Logs:"
docker compose logs --tail=20
```

### Collect logs for support

**Linux:**

```bash
# Create log bundle
mkdir -p /tmp/aria-logs
docker compose logs > /tmp/aria-logs/docker-compose.log
journalctl -u aria-erp > /tmp/aria-logs/systemd.log
cp /opt/aria-erp/.env /tmp/aria-logs/config.env
tar -czf aria-logs-$(date +%Y%m%d-%H%M%S).tar.gz -C /tmp aria-logs
```

**Windows:**

```powershell
# Create log bundle
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logDir = "C:\Temp\aria-logs"
New-Item -ItemType Directory -Path $logDir -Force
docker compose logs > "$logDir\docker-compose.log"
Copy-Item "C:\Program Files\AriaERP\.env" "$logDir\config.env"
Compress-Archive -Path $logDir -DestinationPath "aria-logs-$timestamp.zip"
```

## Getting Help

If issues persist after trying these solutions:

1. **Collect diagnostic information** using the scripts above
2. **Review documentation** in the `docs/` folder
3. **Check recent logs** for specific error messages
4. **Contact support** with:
   - Description of the issue
   - Steps to reproduce
   - Log files
   - Environment details (OS, Docker version, etc.)

---

**Version**: 0.1.0  
**Last Updated**: October 3, 2025
