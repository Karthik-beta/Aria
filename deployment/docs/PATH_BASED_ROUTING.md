# Path-Based Routing - Configuration Update

## Access URLs

With path-based routing, all modules are accessed through a single IP address or domain:

**Pattern**: `https://<ip-or-domain>/<module>/`

**Available Paths**:
- `https://192.168.1.100/asset/` - Asset Management
- `https://192.168.1.100/crm/` - Customer Relationship Management  
- `https://192.168.1.100/hrms/` - Human Resources
- `https://192.168.1.100/inventory/` - Inventory Management
- `https://192.168.1.100/api/` - Backend API

**With Domain** (if configured):
- `https://erp.company.com/asset/`
- `https://erp.company.com/crm/`
- etc.

## SSL Certificate Requirements

For path-based routing on static IP, the SSL certificate **MUST include all server IP addresses** in the Subject Alternative Names (SAN) field.

### Automatic Certificate Generation

Use the provided script to generate a certificate with all server IPs:

**Linux**:
```bash
sudo ./scripts/generate-ssl-cert-linux.sh ./volumes/traefik
```

**Windows (PowerShell as Administrator)**:
```powershell
.\scripts\generate-ssl-cert-windows.ps1 -CertPath "C:\Program Files\AriaERP\volumes\traefik"
```

The script will:
1. Detect all IPv4 and IPv6 addresses on the server
2. Create an OpenSSL configuration with all IPs
3. Generate a self-signed certificate valid for 365 days
4. Include all IPs in the certificate's SAN field

### Manual Certificate Configuration

If you have a commercial certificate or use Let's Encrypt, ensure it includes:
- All IPv4 addresses where the server is accessible
- All IPv6 addresses (if applicable)
- Domain name (if assigned to the IP)

Place the certificate files in:
- Linux: `/opt/aria-erp/volumes/traefik/`
- Windows: `C:\Program Files\AriaERP\volumes\traefik\`

Required files:
- `server.crt` - Certificate file
- `server.key` - Private key file

## Resource Allocation for ~200 Users

The docker-compose configuration includes optimized resource limits:

### Traefik (Reverse Proxy)
- CPU: 0.5-1 cores
- Memory: 256MB-512MB

### PostgreSQL (Database)
- CPU: 1-2 cores  
- Memory: 1GB-2GB
- Max connections: 250
- Tuned for concurrent access

### Backend (NestJS API)
- CPU: 1-2 cores
- Memory: 1GB-2GB

### Frontend Modules (Each)
- CPU: 0.5-1.5 cores
- Memory: 512MB-1GB

**Total Recommended Resources**:
- CPU: 8-12 cores
- RAM: 8-12 GB
- Storage: 50GB+ for database growth

## Rate Limiting

API rate limiting is configured to support 200 concurrent users:
- Average: 100 requests/second
- Burst: 200 requests
- Per-IP tracking via Traefik middleware

## Module Access Control

Modules are enabled/disabled via Docker Compose profiles based on `LICENSED_MODULES`:

```env
# Full suite
LICENSED_MODULES=full

# Specific modules only
LICENSED_MODULES=asset,crm

# Single module
LICENSED_MODULES=hrms
```

Disabled modules will not start, saving system resources.

## Default Landing Page

When accessing the root URL (`https://192.168.1.100/`), users are served the first available module in this priority order:
1. Asset Management (`/asset/`)
2. CRM (`/crm/`)
3. HRMS (`/hrms/`)
4. Inventory (`/inventory/`)

To change this, modify `traefik/dynamic/static-ip-routes.yml` and change the `default-redirect` router's service.
