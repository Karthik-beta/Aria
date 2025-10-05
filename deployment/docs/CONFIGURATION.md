# Aria ERP Configuration Reference

This document provides detailed information about configuring Aria ERP for your environment.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Module Configuration](#module-configuration)
- [Database Configuration](#database-configuration)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Network Configuration](#network-configuration)
- [Performance Tuning](#performance-tuning)

## Environment Variables

All configuration is managed through the `.env` file in the installation directory.

### Core Settings

| Variable                  | Default      | Description                     |
| ------------------------- | ------------ | ------------------------------- |
| `VERSION`                 | `latest`     | Docker image version to use     |
| `DOMAIN`                  | `localhost`  | Base domain for the application |
| `NODE_ENV`                | `production` | Node.js environment mode        |
| `NEXT_TELEMETRY_DISABLED` | `1`          | Disable Next.js telemetry       |

### Database Settings

| Variable            | Default    | Description                                |
| ------------------- | ---------- | ------------------------------------------ |
| `POSTGRES_DB`       | `aria`     | PostgreSQL database name                   |
| `POSTGRES_USER`     | `aria`     | PostgreSQL username                        |
| `POSTGRES_PASSWORD` | (required) | PostgreSQL password - **must be changed!** |

**Security Note**: Always change the default database password before deploying to production.

### Log Management Settings

| Variable               | Default | Description                                           |
| ---------------------- | ------- | ----------------------------------------------------- |
| `LOG_MAX_SIZE`         | `10m`   | Maximum size of Docker container logs before rotation |
| `LOG_MAX_FILES`        | `3`     | Number of rotated log files to keep per container     |
| `LOG_RETENTION_DAYS`   | `30`    | Days to retain application log files                  |
| `LOG_COMPRESS_ENABLED` | `true`  | Enable compression of rotated log files               |

**See**: [Log Management Guide](LOG_MANAGEMENT.md) for complete log rotation and retention documentation.

### Module Licensing

| Variable           | Default | Description                                       |
| ------------------ | ------- | ------------------------------------------------- |
| `LICENSED_MODULES` | `full`  | Comma-separated list of enabled modules or 'full' |

Available modules:

- `asset` - Asset Management
- `crm` - Customer Relationship Management
- `hrms` - Human Resource Management System
- `inventory` - Inventory Management

**Examples:**

```env
# Enable all modules
LICENSED_MODULES=full

# Enable specific modules
LICENSED_MODULES=asset,crm

# Enable single module
LICENSED_MODULES=inventory
```

## Module Configuration

### Enabling/Disabling Modules

1. Edit the `.env` file:

   ```bash
   # Linux
   sudo nano /opt/aria-erp/.env

   # Windows
   notepad "C:\Program Files\AriaERP\.env"
   ```

2. Update `LICENSED_MODULES`:

   ```env
   LICENSED_MODULES=asset,crm,hrms
   ```

3. Restart the services:

   ```bash
   # Linux
   sudo systemctl restart aria-erp

   # Windows
   cd "C:\Program Files\AriaERP"
   docker compose down
   docker compose --env-file .env up -d
   ```

### Module URLs

All modules are accessible via path-based routing:

| Module      | URL Pattern                   |
| ----------- | ----------------------------- |
| Asset       | `https://{DOMAIN}/asset/`     |
| CRM         | `https://{DOMAIN}/crm/`       |
| HRMS        | `https://{DOMAIN}/hrms/`      |
| Inventory   | `https://{DOMAIN}/inventory/` |
| Backend API | `https://{DOMAIN}/api/`       |

**Note**: This deployment uses path-based routing, not subdomain-based routing. All modules share a single IP/domain.

## Database Configuration

### Connection String

The database connection is automatically configured using the environment variables:

```
postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@postgres:5432/{POSTGRES_DB}
```

### Data Persistence

Database data is stored in:

- **Linux**: `/opt/aria-erp/volumes/postgres`
- **Windows**: `C:\Program Files\AriaERP\volumes\postgres`

### Backup and Restore

**Backup:**

```bash
# Linux
docker exec aria-database pg_dump -U aria aria > backup.sql

# Windows
docker exec aria-database pg_dump -U aria aria > backup.sql
```

**Restore:**

```bash
# Linux
cat backup.sql | docker exec -i aria-database psql -U aria -d aria

# Windows
Get-Content backup.sql | docker exec -i aria-database psql -U aria -d aria
```

### Database Performance

For better performance with larger datasets:

1. Increase PostgreSQL shared memory (edit `docker-compose.yml`):

   ```yaml
   postgres:
     environment:
       POSTGRES_SHARED_BUFFERS: 256MB
       POSTGRES_WORK_MEM: 16MB
   ```

2. Restart services after changes.

## SSL/TLS Configuration

### Self-Signed Certificates (Development)

For development/testing environments, you can use self-signed certificates:

**Linux:**

```bash
cd /opt/aria-erp/volumes/traefik
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key -out server.crt
```

**Windows:**

```powershell
cd "C:\Program Files\AriaERP\volumes\traefik"
# Use OpenSSL or create certificate via Windows Certificate Manager
```

### Production Certificates

#### Option 1: Let's Encrypt (Automatic)

The system is pre-configured for Let's Encrypt. Requirements:

- Domain must resolve to your server's public IP
- Ports 80 and 443 must be accessible from the internet

Let's Encrypt will automatically provision and renew certificates.

#### Option 2: Custom Certificates

1. Place your certificate files in the Traefik volumes directory:
   - `server.crt` - SSL certificate
   - `server.key` - Private key

2. Update `config/traefik/tls.yml` to reference your certificates

3. Restart services

### SSL Configuration File

Edit `config/traefik/tls.yml`:

```yaml
tls:
  certificates:
    - certFile: /etc/ssl/traefik/server.crt
      keyFile: /etc/ssl/traefik/server.key
```

## Network Configuration

### Port Mapping

Default ports:

- `80` - HTTP (redirects to HTTPS)
- `443` - HTTPS

To change ports, edit `docker-compose.yml`:

```yaml
traefik:
  ports:
    - '8080:80'
    - '8443:443'
```

### Firewall Configuration

**Linux (UFW):**

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**Linux (firewalld):**

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

**Windows Firewall:**

```powershell
New-NetFirewallRule -DisplayName "Aria ERP HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "Aria ERP HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

### DNS Configuration

For production deployment with path-based routing:

**Option 1: Use Server IP Directly**

- No DNS configuration needed
- Access via `https://<server-ip>/<module>/`

**Option 2: Configure Domain Name**

1. Create a single A record for your domain:

   ```
   yourdomain.com       A    YOUR_SERVER_IP
   ```

2. Access modules via paths:
   ```
   https://yourdomain.com/asset/
   https://yourdomain.com/crm/
   https://yourdomain.com/hrms/
   https://yourdomain.com/inventory/
   ```

**Note**: With path-based routing, you only need ONE DNS record, not subdomains.

## Performance Tuning

### Docker Resources

**Linux** - Edit `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

**Windows** - Configure in Docker Desktop settings:

- Memory: 4 GB minimum, 8 GB recommended
- CPU: 2 cores minimum, 4 cores recommended

### Application Tuning

For high-traffic environments, consider:

1. **Increase backend replicas** (edit `docker-compose.yml`):

   ```yaml
   backend:
     deploy:
       replicas: 3
   ```

2. **Add Redis caching** (future enhancement)

3. **Configure PostgreSQL connection pooling**

### Log Management

Logs are stored in:

- **Linux**: `/opt/aria-erp/logs/`
- **Windows**: `C:\Program Files\AriaERP\logs\`

**Log rotation (Linux):**

```bash
sudo tee /etc/logrotate.d/aria-erp << EOF
/opt/aria-erp/logs/**/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
EOF
```

## Advanced Configuration

### Custom Docker Compose Settings

For advanced users, you can modify `docker-compose.yml` to:

- Add additional services (Redis, Elasticsearch, etc.)
- Configure resource limits
- Add custom networks
- Mount additional volumes

After modifications, restart services:

```bash
# Linux
sudo systemctl restart aria-erp

# Windows
docker compose down && docker compose --env-file .env up -d
```

### Environment-Specific Overrides

Create environment-specific override files:

```bash
# Create docker-compose.override.yml
version: '3.8'
services:
  backend:
    environment:
      CUSTOM_VAR: value
```

This file will be automatically merged with the main compose file.

## Configuration Best Practices

1. **Security**:
   - Always change default passwords
   - Use strong, unique passwords
   - Regularly update SSL certificates
   - Keep Docker images updated

2. **Backup**:
   - Regularly backup the database
   - Backup configuration files
   - Store backups off-site

3. **Monitoring**:
   - Regularly check service status
   - Monitor disk space usage
   - Review logs for errors

4. **Updates**:
   - Test updates in a staging environment first
   - Backup before updating
   - Follow the update documentation

---

**Version**: 0.1.0  
**Last Updated**: October 3, 2025
