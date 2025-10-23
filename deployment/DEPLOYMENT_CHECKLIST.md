# Aria ERP Deployment Checklist

> Pre-deployment, deployment, and post-deployment verification checklist

Use this checklist to ensure a successful production deployment of Aria ERP.

---

## Pre-Deployment Checklist

### System Requirements

- [ ] Operating System meets requirements:
  - Linux: Ubuntu 20.04+, Debian 11+, RHEL 8+, or compatible
  - Windows: Windows 11 Professional, Enterprise, or Education
- [ ] Minimum hardware specifications met:
  - CPU: 2+ cores
  - RAM: 4GB minimum, 8GB recommended
  - Disk: 20GB+ free space
- [ ] Docker installed (version 24.0+)
- [ ] Docker Compose installed (version 2.20+)
- [ ] Static IP address or domain name available
- [ ] Network ports accessible: 80, 443 (TCP), 443 (UDP)

### Network Configuration

- [ ] Firewall configured to allow HTTP (port 80)
- [ ] Firewall configured to allow HTTPS (port 443 TCP)
- [ ] Firewall configured to allow HTTP/3 (port 443 UDP)
- [ ] DNS records configured (if using domain name):
  - A record pointing to server IP
  - Optional: AAAA record for IPv6
- [ ] Reverse proxy requirements assessed (if behind another proxy)
- [ ] Load balancer configuration reviewed (if applicable)

### Security Planning

- [ ] Strong passwords generated for:
  - PostgreSQL database
  - Redis cache
  - JWT secret (64+ characters)
- [ ] SSL certificate strategy decided:
  - Self-signed (for internal/private networks)
  - Let's Encrypt (for public domains)
  - Custom certificate (from CA)
- [ ] CORS origins determined and documented
- [ ] Access control list (ACL) prepared
- [ ] Backup strategy defined:
  - Backup frequency (daily, weekly)
  - Backup retention policy
  - Backup storage location
  - Recovery time objective (RTO)
  - Recovery point objective (RPO)

### Application Preparation

- [ ] Latest stable release downloaded
- [ ] Release notes reviewed for breaking changes
- [ ] Migration scripts identified (if upgrading)
- [ ] Environment-specific configuration planned
- [ ] Integration points documented:
  - External APIs
  - Third-party services
  - Email/SMS providers
- [ ] Monitoring strategy defined:
  - Log aggregation
  - Performance metrics
  - Alerting rules

---

## Deployment Checklist

### Environment Configuration

- [ ] `.env` file created from template:
  ```bash
  cp .env.production.template .env
  ```

- [ ] **Required** environment variables set:
  - [ ] `POSTGRES_PASSWORD` (strong, unique)
  - [ ] `REDIS_PASSWORD` (strong, unique)
  - [ ] `JWT_SECRET` (64+ character hex string)
  - [ ] `DOMAIN` (server IP or domain name)

- [ ] **Optional** environment variables reviewed:
  - [ ] `JWT_EXPIRATION` (default: 12h)
  - [ ] `CORS_ORIGIN` (default: *)
  - [ ] `LOG_LEVEL` (default: info)
  - [ ] `DEBUG` (should be false in production)
  - [ ] `SSL_EMAIL` (for Let's Encrypt)

- [ ] Environment file secured (permissions set to 600):
  ```bash
  chmod 600 .env
  ```

### SSL Certificate Setup

- [ ] SSL certificate generation method chosen:
  - [ ] Automated (self-signed) - run `./deployment/ssl/generate-certs.sh`
  - [ ] Let's Encrypt (automatic via Caddy)
  - [ ] Custom certificate - placed in `deployment/caddy/certs/`

- [ ] Certificate files present:
  - [ ] `deployment/caddy/certs/server.crt`
  - [ ] `deployment/caddy/certs/server.key`

- [ ] Certificate validity verified:
  ```bash
  openssl x509 -in deployment/caddy/certs/server.crt -noout -dates
  ```

### Installation Execution

#### Linux

- [ ] Installation script has execute permissions:
  ```bash
  chmod +x deployment/scripts/install-linux.sh
  ```

- [ ] Installation script executed:
  ```bash
  sudo ./deployment/scripts/install-linux.sh
  ```

- [ ] Installation completed without errors

- [ ] Systemd service installed and enabled:
  ```bash
  sudo systemctl status aria-erp
  ```

#### Windows

- [ ] PowerShell opened as Administrator

- [ ] Installation script executed:
  ```powershell
  .\deployment\scripts\install-windows.ps1
  ```

- [ ] Installation completed without errors

- [ ] Windows service installed and running:
  ```powershell
  Get-Service AriaERP
  ```

### Container Verification

- [ ] All containers running:
  ```bash
  docker ps
  ```
  Expected containers:
  - aria-caddy
  - aria-frontend
  - aria-backend
  - aria-postgres
  - aria-redis

- [ ] All containers healthy:
  ```bash
  docker ps --format "table {{.Names}}\t{{.Status}}"
  ```

- [ ] No containers restarting repeatedly

- [ ] Container logs reviewed for errors:
  ```bash
  docker logs aria-backend --tail=50
  docker logs aria-frontend --tail=50
  docker logs aria-caddy --tail=50
  ```

---

## Post-Deployment Verification

### Automated Health Checks

- [ ] Health check script executed successfully:
  ```bash
  # Linux
  ./deployment/tests/health-check.sh
  
  # Windows
  .\deployment\tests\health-check.ps1
  ```

- [ ] All health checks passing:
  - Container status
  - Health endpoints
  - HTTP/HTTPS endpoints
  - Database connectivity
  - Network configuration
  - Volume persistence
  - Resource usage
  - Log health

### Manual Endpoint Testing

- [ ] Frontend accessible via HTTP:
  ```bash
  curl -I http://<server-ip>
  ```
  Expected: 301 or 308 redirect to HTTPS

- [ ] Frontend accessible via HTTPS:
  ```bash
  curl -I https://<server-ip> -k
  ```
  Expected: 200 OK

- [ ] Backend API accessible:
  ```bash
  curl -I https://<server-ip>/api/health -k
  ```
  Expected: 200 OK with JSON response

- [ ] WebSocket connections working (if applicable)

- [ ] HTTP/3 support verified (optional):
  ```bash
  # Requires curl with HTTP/3 support
  curl --http3 https://<server-ip> -k -I
  ```

### Database Verification

- [ ] PostgreSQL accepting connections:
  ```bash
  docker exec aria-postgres pg_isready -U aria
  ```

- [ ] Database schema initialized:
  ```bash
  docker exec aria-postgres psql -U aria -c "\dt"
  ```

- [ ] Database migrations completed (if applicable)

- [ ] Sample data verified (if loaded)

- [ ] Database backup test performed:
  ```bash
  docker exec aria-postgres pg_dump -U aria aria > test-backup.sql
  ls -lh test-backup.sql
  ```

### Redis Verification

- [ ] Redis responding to ping:
  ```bash
  docker exec aria-redis redis-cli ping
  ```
  Expected: PONG

- [ ] Redis authentication working:
  ```bash
  docker exec aria-redis redis-cli -a <REDIS_PASSWORD> ping
  ```

- [ ] Redis persistence configured:
  ```bash
  docker exec aria-redis redis-cli -a <REDIS_PASSWORD> CONFIG GET save
  ```

### Security Verification

- [ ] Self-signed certificate warning acknowledged (if applicable)

- [ ] HTTPS enforced (HTTP redirects to HTTPS):
  ```bash
  curl -I http://<server-ip>
  # Should see 301/308 redirect
  ```

- [ ] Security headers present:
  ```bash
  curl -I https://<server-ip> -k | grep -i "strict-transport-security\|x-frame-options\|x-content-type-options"
  ```
  Expected headers:
  - Strict-Transport-Security
  - X-Frame-Options
  - X-Content-Type-Options
  - X-XSS-Protection

- [ ] Admin endpoints protected (if applicable)

- [ ] Database not accessible from external network:
  ```bash
  # From external machine, should fail:
  psql -h <server-ip> -U aria -d aria
  ```

- [ ] Redis not accessible from external network:
  ```bash
  # From external machine, should fail:
  redis-cli -h <server-ip> ping
  ```

### Performance Verification

- [ ] Response times acceptable:
  - Frontend: < 2 seconds
  - Backend API: < 500ms

- [ ] Resource usage within limits:
  ```bash
  docker stats --no-stream
  ```
  Check:
  - CPU usage < 70%
  - Memory usage < 80%
  - No swap usage

- [ ] Disk I/O not saturated:
  ```bash
  # Linux
  iostat -x 1 5
  
  # Windows
  Get-Counter '\PhysicalDisk(_Total)\Disk Reads/sec', '\PhysicalDisk(_Total)\Disk Writes/sec'
  ```

- [ ] Network latency acceptable:
  ```bash
  ping <server-ip>
  ```

### Logging and Monitoring

- [ ] Container logs accessible:
  ```bash
  docker logs aria-backend --tail=10
  ```

- [ ] Log rotation configured:
  ```bash
  docker inspect aria-backend --format='{{.HostConfig.LogConfig}}'
  ```

- [ ] No critical errors in logs:
  ```bash
  docker logs aria-backend 2>&1 | grep -i "error\|critical\|fatal"
  ```

- [ ] Monitoring dashboard configured (if applicable)

- [ ] Alerting rules tested (if applicable)

---

## Service Management Verification

### Linux (systemd)

- [ ] Service enabled for auto-start:
  ```bash
  sudo systemctl is-enabled aria-erp
  ```
  Expected: enabled

- [ ] Service starts on boot:
  ```bash
  sudo systemctl status aria-erp
  ```

- [ ] Service restart works:
  ```bash
  sudo systemctl restart aria-erp
  sudo systemctl status aria-erp
  ```

- [ ] Service logs accessible:
  ```bash
  sudo journalctl -u aria-erp -n 20 --no-pager
  ```

### Windows (WinSW)

- [ ] Service installed:
  ```powershell
  Get-Service AriaERP
  ```

- [ ] Service set to automatic start:
  ```powershell
  (Get-Service AriaERP).StartType
  ```
  Expected: Automatic

- [ ] Service starts on boot

- [ ] Service restart works:
  ```powershell
  Restart-Service AriaERP
  Get-Service AriaERP
  ```

- [ ] Service logs accessible:
  ```powershell
  Get-Content C:\aria\logs\*.log -Tail 20
  ```

---

## Backup and Recovery Verification

### Backup Test

- [ ] Database backup created successfully:
  ```bash
  docker exec aria-postgres pg_dump -U aria aria > backup-test.sql
  ```

- [ ] Backup file not empty:
  ```bash
  ls -lh backup-test.sql
  # Should be > 1KB
  ```

- [ ] Backup contains expected data:
  ```bash
  head -n 20 backup-test.sql
  ```

- [ ] Automated backup scheduled:
  - Linux: cron job configured
  - Windows: scheduled task configured

### Recovery Test (Optional but Recommended)

- [ ] Test environment prepared

- [ ] Backup restored successfully:
  ```bash
  # In test environment
  docker exec -i aria-postgres psql -U aria aria < backup-test.sql
  ```

- [ ] Restored data verified

- [ ] Recovery procedure documented

---

## Documentation

- [ ] Installation details documented:
  - Server IP/domain
  - Installation date
  - Installed version
  - Administrator contacts

- [ ] Access credentials securely stored:
  - Database password
  - Redis password
  - JWT secret
  - SSL certificate locations

- [ ] Runbook created/updated:
  - Common operations
  - Troubleshooting steps
  - Emergency procedures
  - Escalation contacts

- [ ] User documentation updated (if applicable)

- [ ] Change management ticket closed (if applicable)

---

## Stakeholder Communication

- [ ] Deployment notification sent to stakeholders

- [ ] Access instructions provided to users

- [ ] Training scheduled (if needed)

- [ ] Support channels communicated

- [ ] Known issues documented and communicated

---

## Post-Deployment Monitoring (First 24 Hours)

### Immediate (First Hour)

- [ ] All services remain healthy
- [ ] No error spikes in logs
- [ ] Response times remain acceptable
- [ ] Resource usage stable

### Short-term (First 24 Hours)

- [ ] No memory leaks detected
- [ ] No connection pool exhaustion
- [ ] Database performance stable
- [ ] No unexpected restarts
- [ ] Backup job completes successfully
- [ ] User feedback collected

---

## Sign-Off

### Deployment Team

- [ ] System Administrator: ______________________ Date: __________
- [ ] DevOps Engineer: ______________________ Date: __________
- [ ] Application Owner: ______________________ Date: __________

### Verification

- [ ] All critical items verified
- [ ] All blocking issues resolved
- [ ] All documentation complete
- [ ] Deployment declared successful

---

## Rollback Plan (If Needed)

In case of critical issues:

1. **Immediate Actions**:
   ```bash
   # Stop services
   docker compose -f docker-compose.production.yml down
   ```

2. **Restore Previous Version**:
   - Restore previous deployment package
   - Restore database backup (if schema changed)
   - Restart services

3. **Communication**:
   - Notify stakeholders
   - Document issues
   - Plan remediation

4. **Root Cause Analysis**:
   - Review logs
   - Identify failure points
   - Update deployment checklist

---

## Additional Resources

- **Deployment Guide**: `deployment/README.md`
- **Quick Start**: `deployment/QUICKSTART.md`
- **Troubleshooting**: `deployment/TROUBLESHOOTING.md`
- **Health Check Script**: `deployment/tests/health-check.sh` (Linux) or `deployment/tests/health-check.ps1` (Windows)

---

**Deployment Date**: __________  
**Deployed Version**: __________  
**Deployed By**: __________  
**Deployment Status**: ⬜ Success ⬜ Partial ⬜ Rolled Back
