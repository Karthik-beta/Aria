# Aria ERP Deployment - Quick Reference Card

## 🚀 Package Creation

```bash
# Build applications
pnpm build

# Create deployment package
pnpm package

# Test package
pnpm package:test
```

**Output**: `dist/aria-erp-v{version}-{platform}.{tar.gz|zip}`

---

## 📦 Linux Installation

```bash
# 1. Extract
tar -xzf aria-erp-v0.1.0-linux.tar.gz
cd aria-erp-v0.1.0

# 2. Load Docker images
sudo ./bin/load-images.sh

# 3. Install
sudo ./bin/install-linux.sh \
  --domain erp.company.com \
  --modules full

# 4. Verify
sudo systemctl status aria-erp
```

### Service Management (Linux)
```bash
sudo systemctl start aria-erp      # Start
sudo systemctl stop aria-erp       # Stop
sudo systemctl restart aria-erp    # Restart
sudo systemctl status aria-erp     # Status
sudo journalctl -u aria-erp -f     # Logs
```

---

## 🪟 Windows Installation

```powershell
# 1. Extract ZIP file to a folder

# 2. Open PowerShell as Administrator
cd aria-erp-v0.1.0

# 3. Load Docker images
.\bin\load-images.ps1

# 4. Install
.\bin\install-windows.ps1 `
  -Domain "erp.company.com" `
  -Modules "full"

# 5. Verify
docker compose ps
```

### Service Management (Windows)
```powershell
Start-ScheduledTask -TaskName "AriaERP"  # Start
docker compose down                       # Stop
docker compose restart                    # Restart
docker compose ps                         # Status
docker compose logs -f                    # Logs
```

---

## ⚙️ Configuration

**Location:**
- Linux: `/opt/aria-erp/.env`
- Windows: `C:\Program Files\AriaERP\.env`

**Key Settings:**
```env
DOMAIN=erp.company.com
POSTGRES_PASSWORD=secure_password
LICENSED_MODULES=full
```

**Modules:** `asset`, `crm`, `hrms`, `inventory`, or `full`

After changes:
```bash
# Linux
sudo systemctl restart aria-erp

# Windows
docker compose down
docker compose --env-file .env up -d
```

---

## 🌐 Access URLs

- **Backend API**: `https://{DOMAIN}/api`
- **Asset**: `https://asset.{DOMAIN}`
- **CRM**: `https://crm.{DOMAIN}`
- **HRMS**: `https://hrms.{DOMAIN}`
- **Inventory**: `https://inventory.{DOMAIN}`

---

## 🔍 Troubleshooting

### Quick Checks
```bash
# Docker running?
docker version

# Containers healthy?
docker compose ps

# Check logs
docker compose logs backend
docker compose logs aria-database

# Database accessible?
docker exec aria-database pg_isready -U aria
```

### Common Issues

**Port conflict (80/443):**
```bash
# Linux
sudo netstat -tulpn | grep -E ':(80|443)'

# Windows
netstat -ano | findstr :80
```

**Database connection:**
- Check `POSTGRES_PASSWORD` in `.env`
- Restart database: `docker restart aria-database`

**Module not loading:**
- Check `LICENSED_MODULES` in `.env`
- Ensure module in docker-compose profiles
- Restart services

---

## 🔐 Security

**Default Passwords:**
- Auto-generated during installation
- Located in `.env` file
- **Change immediately** for production

**SSL Certificates:**
- Development: Self-signed (auto-created)
- Production: Let's Encrypt (automatic) or custom

---

## 💾 Backup

**Database:**
```bash
docker exec aria-database pg_dump -U aria aria > backup.sql
```

**Configuration:**
```bash
# Linux
cp /opt/aria-erp/.env /backup/aria.env

# Windows
Copy-Item "C:\Program Files\AriaERP\.env" "C:\backup\aria.env"
```

**Restore:**
```bash
cat backup.sql | docker exec -i aria-database psql -U aria -d aria
```

---

## 🗑️ Uninstall

**Linux:**
```bash
sudo ./bin/uninstall-linux.sh
```

**Windows:**
```powershell
.\bin\uninstall-windows.ps1
```

---

## 📚 Documentation

- **[Installation Guide](docs/INSTALLATION.md)** - Full installation instructions
- **[Configuration](docs/CONFIGURATION.md)** - All configuration options
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Problem solutions
- **[Development](DEVELOPMENT.md)** - Developer guide

---

## 📊 System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4 GB
- Disk: 20 GB
- OS: Ubuntu 20.04+ / Windows 10+

**Recommended:**
- CPU: 4 cores
- RAM: 8 GB
- Disk: 50 GB SSD
- Network: 1 Gbps

---

## 🆘 Support

**Health Check:**
```bash
# Comprehensive check
docker ps
docker compose ps
docker stats --no-stream
```

**Collect Logs for Support:**
```bash
# Linux
docker compose logs > aria-logs.txt
journalctl -u aria-erp > systemd-logs.txt

# Windows
docker compose logs > aria-logs.txt
```

**Contact:**
- Check logs first
- Review troubleshooting guide
- Contact system administrator

---

**Version**: 0.1.0 | **Updated**: October 3, 2025
