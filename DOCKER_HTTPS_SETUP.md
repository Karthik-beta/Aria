# Docker HTTPS Setup Guide

This guide documents the complete Docker-based deployment architecture for the Aria ERP system with HTTPS support via Traefik reverse proxy.

## Architecture Overview

The Aria ERP system consists of:

- **Traefik** (v3.1): Reverse proxy with automatic HTTPS/TLS termination
- **PostgreSQL** (16): Database service
- **Backend** (NestJS 11): API service on Node 22-alpine
- **Frontend Apps** (Next.js 15.5.4): Four applications (Asset, CRM, HRMS, Inventory) with Turbopack

All services communicate over a Docker network (`aria_default`) and are accessible via path-based routing on a single IP address.

## Service Access Points

| Service          | URL                            | Description                      |
| ---------------- | ------------------------------ | -------------------------------- |
| Backend API      | `https://localhost/api/`       | NestJS REST API                  |
| Asset Management | `https://localhost/asset/`     | Asset tracking frontend          |
| CRM              | `https://localhost/crm/`       | Customer relationship management |
| HRMS             | `https://localhost/hrms/`      | Human resources management       |
| Inventory        | `https://localhost/inventory/` | Inventory management             |

## Directory Structure

```
Aria/
├── docker-compose.yml          # Service orchestration
├── traefik/
│   ├── certs/
│   │   ├── server.crt         # SSL certificate (self-signed for dev)
│   │   ├── server.key         # SSL private key
│   │   └── openssl.conf       # Certificate configuration
│   └── dynamic/
│       ├── static-ip-routes.yml # Path-based routing config
│       └── tls.yml             # TLS/SSL configuration
├── apps/
│   ├── backend/
│   │   └── Dockerfile          # NestJS backend container
│   └── frontend/
│       ├── asset/Dockerfile    # Asset app container
│       ├── CRM/Dockerfile      # CRM app container
│       ├── hrms/Dockerfile     # HRMS app container
│       └── inventory/Dockerfile # Inventory app container
└── packages/                   # Shared TypeScript packages
```

## SSL Certificate Setup

### Development Certificates (Self-Signed)

The repository includes self-signed SSL certificates for local development. These certificates:

- Use 4096-bit RSA encryption
- Are valid for 365 days
- Include SAN (Subject Alternative Name) entries for localhost and service names
- Support both IP (127.0.0.1) and DNS (localhost) access

### Certificate Files

- `traefik/certs/server.crt` - Public certificate
- `traefik/certs/server.key` - Private key
- `traefik/certs/openssl.conf` - OpenSSL configuration

### Regenerating Certificates

If you need to regenerate the certificates:

```powershell
# On Windows (using Git's OpenSSL)
cd traefik/certs
& "C:\Program Files\Git\usr\bin\openssl.exe" req -x509 -nodes -days 365 -newkey rsa:4096 `
  -keyout server.key -out server.crt -config openssl.conf `
  -extensions v3_req
```

```bash
# On Linux/Mac
cd traefik/certs
openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
  -keyout server.key -out server.crt -config openssl.conf \
  -extensions v3_req
```

### Production Certificates

For production deployment, replace the self-signed certificates with:

1. **Let's Encrypt** (automated via Traefik ACME)
2. **Commercial certificates** from a trusted CA

Update `traefik/dynamic/tls.yml` to point to production certificate paths.

## Traefik Configuration

### Static Configuration (docker-compose.yml)

Traefik is configured via Docker labels and command arguments:

```yaml
command:
  - '--api.insecure=true'
  - '--providers.docker=true'
  - '--providers.docker.exposedbydefault=false'
  - '--providers.file.directory=/etc/traefik/dynamic'
  - '--providers.file.watch=true'
  - '--entrypoints.web.address=:80'
  - '--entrypoints.websecure.address=:443'
```

Key features:

- Docker provider for container auto-discovery
- File provider for custom routing (`/etc/traefik/dynamic`)
- HTTP on port 80, HTTPS on port 443
- Automatic config reload on file changes

### Dynamic Routing (static-ip-routes.yml)

Path-based routing configuration:

```yaml
http:
  routers:
    backend-static:
      rule: 'PathPrefix(`/api`)'
      service: backend
      middlewares:
        - backend-stripprefix # Strips /api before forwarding

    asset-static:
      rule: 'PathPrefix(`/asset`)'
      service: asset
      # No stripprefix - Next.js needs full path with basePath
```

**Important**: Frontend apps use Next.js `basePath` configuration and expect the full path (including `/asset`, `/crm`, etc.) in the URL. Do NOT strip prefixes for frontend routes.

### Health Checks

Each service has health check endpoints:

- **Backend**: `http://backend:3000/` → HTTP 200
- **Frontends**: `http://<service>:3000/<basePath>/` → HTTP 200

Health checks run every 30 seconds with a 5-second timeout.

## Docker Build Architecture

### Backend (NestJS)

The backend uses a multi-stage Dockerfile with pnpm workspace support:

```dockerfile
# Stage 1: Install all dependencies
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile

# Stage 2: Build application
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
RUN pnpm build

# Stage 3: Production dependencies using pnpm deploy
FROM node:22-alpine AS prod-deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/*/package.json ./packages/
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter backend deploy --legacy /app/production

# Stage 4: Final runtime
FROM node:22-alpine AS runner
WORKDIR /app/apps/backend
COPY --from=prod-deps /app/production/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

**Key Points**:

- Uses `pnpm deploy --legacy` to create a proper production `node_modules` structure
- The `--legacy` flag is crucial for NestJS module resolution
- Separates deps, build, prod-deps, and runtime stages for optimal caching

### Frontend (Next.js)

Frontends use a similar multi-stage build with Next.js standalone output:

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/frontend/asset/package.json ./apps/frontend/asset/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY apps/frontend/asset ./apps/frontend/asset
WORKDIR /app/apps/frontend/asset
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/apps/frontend/asset/.next/standalone ./
COPY --from=builder /app/apps/frontend/asset/.next/static ./apps/frontend/asset/.next/static
COPY --from=builder /app/apps/frontend/asset/public ./apps/frontend/asset/public
EXPOSE 3000
CMD ["node", "apps/frontend/asset/server.js"]
```

**Key Points**:

- Uses Next.js `output: 'standalone'` mode for optimized production builds
- `basePath` configured per app for path-based routing
- Turbopack enabled for faster builds
- `eslint.ignoreDuringBuilds` set for Docker environment

## Environment Configuration

### Backend Environment Variables

```yaml
# docker-compose.yml
environment:
  NODE_ENV: production
  DATABASE_URL: postgresql://aria_user:aria_password@postgres:5432/aria_erp
  PORT: 3000
```

### Frontend Environment Variables

All frontends share:

```yaml
environment:
  NODE_ENV: production
  NEXT_TELEMETRY_DISABLED: 1
```

Additional app-specific variables can be added via `.env` files or `docker-compose.yml`.

## Running the Stack

### Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+
- pnpm 8+ (for local development)

### Start All Services

```bash
# Start everything
docker compose up -d

# Start with specific profile
docker compose --profile all up -d

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f traefik
docker compose logs -f backend
docker compose logs -f asset
```

### Stop Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes database data)
docker compose down -v
```

### Restart Single Service

```bash
# Restart Traefik to reload config
docker compose restart traefik

# Restart backend
docker compose restart backend
```

## Troubleshooting

### 1. SSL Certificate Errors

**Symptom**: Traefik fails to start with "failed to find any PEM data in certificate input"

**Solution**: Regenerate certificates using the commands above. Ensure:

- `server.crt` is a valid PEM-encoded certificate
- `server.key` is a valid PEM-encoded private key
- Files have proper line endings (LF, not CRLF)

### 2. Backend Module Resolution Errors

**Symptom**: Backend logs show "Cannot find module '@nestjs/core'"

**Solution**: Ensure Dockerfile uses `pnpm deploy --legacy` in the prod-deps stage. The `--legacy` flag creates a traditional `node_modules` structure that NestJS requires.

### 3. Frontend 404 Errors

**Symptom**: Frontend returns 404 for static assets (`/_next/static/*`)

**Solution**:

- Verify `basePath` is set in `next.config.ts`
- Ensure Traefik does NOT use `stripprefix` middleware for frontend routes
- Check health check paths include basePath (e.g., `/asset/`, not `/`)

### 4. Traefik "No Available Server"

**Symptom**: Traefik returns 503 with "no available server"

**Solution**:

- Check health check endpoints return HTTP 200
- Verify service names match Docker Compose service definitions
- Ensure containers are running: `docker compose ps`

### 5. HTTPS Redirect Loops

**Symptom**: Browser shows "too many redirects"

**Solution**:

- Check `X-Forwarded-Proto: https` header is set in middleware
- Verify Next.js apps don't have conflicting HTTPS redirect logic
- Review Traefik router priority values

## Security Considerations

### Development Environment

The current setup uses:

- Self-signed certificates (browser will show warnings)
- Insecure Traefik API on port 8080
- Default database credentials

**These are acceptable for local development only.**

### Production Hardening

Before deploying to production:

1. **Replace Self-Signed Certificates**
   - Use Let's Encrypt or commercial CA
   - Enable Traefik ACME integration

2. **Secure Database**
   - Use strong, unique passwords
   - Store credentials in secrets management (e.g., Docker Secrets, Vault)
   - Restrict network access

3. **Disable Traefik API**
   - Remove `--api.insecure=true`
   - Or secure with authentication

4. **Enable Security Headers**
   - Apply `security-headers` middleware to all routes
   - Configure CSP (Content Security Policy)

5. **Network Isolation**
   - Remove unnecessary `expose` directives
   - Use internal Docker networks
   - Restrict public-facing services

6. **Update Dependencies**
   - Regularly update base images
   - Scan for vulnerabilities with `docker scan`

## Performance Optimization

### Traefik

- Enable compression middleware for HTTP responses
- Configure rate limiting for API endpoints
- Use connection pooling for services

### Database

- Configure connection pooling in backend
- Set appropriate `max_connections` in PostgreSQL
- Use read replicas for high-traffic deployments

### Frontend

- Enable Next.js image optimization
- Configure CDN for static assets
- Use Redis for session storage

## Monitoring and Observability

### Traefik Metrics

Access Traefik dashboard:

```
http://localhost:8080/dashboard/
```

### Service Health

Check service health:

```bash
# Backend
curl --insecure https://localhost/api/

# Asset
curl --insecure https://localhost/asset/
```

### Container Logs

```bash
# All services
docker compose logs -f

# Specific service with timestamp
docker compose logs -f --timestamps backend
```

### Docker Stats

```bash
# Real-time resource usage
docker stats

# Specific services
docker stats aria-backend-1 aria-asset-1
```

## CI/CD Integration

The project includes GitHub Actions CI at `.github/workflows/ci.yml` that runs:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`

For Docker-based CI/CD:

```yaml
# Example: Build and push to registry
- name: Build Docker images
  run: |
    docker compose build

- name: Push to registry
  run: |
    docker compose push
```

## Additional Resources

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [NestJS Docker](https://docs.nestjs.com/recipes/docker)
- [pnpm Workspaces](https://pnpm.io/workspaces)

## Support

For issues or questions:

1. Check this documentation
2. Review logs: `docker compose logs`
3. Check running containers: `docker compose ps`
4. Verify configuration files in `traefik/dynamic/`

---

**Last Updated**: 2025
**Maintainer**: Aria Development Team
