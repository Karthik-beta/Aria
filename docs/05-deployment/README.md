# Deployment Documentation

Overview of the Aria ERP deployment process using Docker Compose, Caddy, and monitoring services.

## Overview

The deployment uses Docker Compose to orchestrate all services, with Caddy v2 as the reverse proxy providing automatic HTTPS, path-based routing, and security headers.

## Tech Stack

| Concern | Technology |
|---------|-----------|
| Containerization | Docker |
| Orchestration | Docker Compose |
| Reverse Proxy | Caddy v2 (HTTP/3, auto HTTPS) |
| Database | PostgreSQL 18 |
| Cache | Redis 7 |
| Monitoring | Prometheus + Grafana + cAdvisor + Node Exporter |

## Service Topology

The production deployment (`docker-compose.production.yml`) includes these services:

| Service | Image | Internal Port | Description |
|---------|-------|---------------|-------------|
| `caddy` | caddy:2.10.2-alpine | 80, 443 | Reverse proxy with auto HTTPS |
| `frontend` | aria-frontend | 3000 | Next.js application |
| `backend` | aria-backend | 3001 | NestJS API server |
| `postgres` | postgres:18-alpine | 5432 | PostgreSQL database |
| `redis` | redis:7-alpine | 6379 | Redis cache |
| `prometheus` | prom/prometheus | 9090 | Metrics collection |
| `grafana` | grafana/grafana | 3000 | Monitoring dashboards |
| `cadvisor` | gcr.io/cadvisor/cadvisor | 8080 | Container metrics |
| `node-exporter` | prom/node-exporter | 9100 | Host metrics |

All services communicate on a single `aria-network` bridge network.

## Project Structure

```
deployment/
├── caddy/
│   ├── Caddyfile.development     # Dev reverse proxy config
│   └── Caddyfile.production      # Production reverse proxy config
├── monitoring/
│   ├── grafana/                  # Grafana provisioning
│   └── prometheus/               # Prometheus config
├── scripts/
│   ├── install-linux.sh          # Linux installer
│   └── install-windows.ps1      # Windows installer
├── ssl/
│   ├── generate-certs.sh        # SSL cert generation (Linux)
│   └── generate-certs.ps1       # SSL cert generation (Windows)
├── systemd/
│   └── aria-erp.service          # Linux systemd service
├── tests/
│   ├── health-check.sh          # Health check (Linux)
│   └── health-check.ps1         # Health check (Windows)
└── windows/
    └── aria-erp.xml              # Windows service config
```

## Caddy Routing

Caddy routes requests based on URL path:

| Path | Destination | Description |
|------|-------------|-------------|
| `/health` | Direct 200 | Health check endpoint |
| `/api/*` | backend:3001 | better-auth and API endpoints |
| `/trpc/*` | backend:3001 | tRPC HTTP requests |
| `/trpc-ws` | backend:3001 | tRPC WebSocket (real-time) |
| `/*` | frontend:3000 | Next.js (all other routes) |

Features: HTTP/3 support, security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection), automatic local certificates, SSR streaming support.

## Quick Start

### Production Deployment

```bash
# Deploy all services
docker compose -f docker-compose.production.yml up -d --build

# Check service health
bash deployment/tests/health-check.sh

# View logs
docker compose -f docker-compose.production.yml logs -f backend
```

### Development Deployment

```bash
docker compose -f docker-compose.development.yml up -d
```

## Required Environment Variables

Set these in a `.env` file at the project root:

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `REDIS_PASSWORD` | Redis password (optional) |
| `BETTER_AUTH_SECRET` | Auth session signing secret |
| `DOMAIN` | Domain name or IP for Caddy |
| `DEFAULT_ADMIN_USERNAME` | Initial admin username |
| `DEFAULT_ADMIN_PASSWORD` | Initial admin password |
| `DEFAULT_ADMIN_EMAIL` | Initial admin email |
| `LOAD_DEMO_DATA` | Set to any value to load demo data on backend startup (optional) |
| `LOAD_DEMO_DATA_SCALE` | Demo data scale: `small`, `medium`, or `large` (default: `medium`) |

## Railway Cloud Deployment

For deployments on Railway (or any Docker-native cloud platform), images are built locally and pushed to Docker Hub, then deployed as containers.

### Build & Push to Docker Hub

```bash
# Build frontend with explicit backend URL for direct API calls (Railway, etc.)
docker build \
  --target runner \
  -f apps/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://backend.aria.pivotr.in \
  -t yourusername/aria-frontend:latest .

# Build backend
docker build --target runner -f apps/backend/Dockerfile -t yourusername/aria-backend:latest .

# Push to Docker Hub
docker push yourusername/aria-frontend:latest
docker push yourusername/aria-backend:latest
```

### Railway Service Configuration

Create two services in Railway dashboard (one for frontend, one for backend) and link them to your Docker Hub images.

#### Frontend Service

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `HOSTNAME` | `0.0.0.0` |
| `PORT` | `3000` |

#### Backend Service

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_URL` | From Railway PostgreSQL instance |
| `REDIS_URL` | `redis://redis:6379` (if using Railway Redis) |
| `JWT_SECRET` | Generate a secure random string |
| `BETTER_AUTH_SECRET` | Generate a secure random string |
| `BETTER_AUTH_URL` | Your Railway frontend URL |
| `FRONTEND_URL` | Your Railway frontend URL |
| `CORS_ORIGIN` | `*` or your frontend domain |

### Same-Origin vs Separate Backend

The frontend supports two deployment modes:

| Mode | `NEXT_PUBLIC_API_URL` | Use Case |
|------|----------------------|----------|
| **Separate domain** (default) | `https://api.example.com` | Backend hosted separately |
| **Same-origin** | `""` (empty) | Frontend and backend on same domain, proxied by Caddy/Nginx |

For Railway, set `NEXT_PUBLIC_API_URL` at **build time** via `--build-arg` to the backend's public URL (e.g., `https://backend.aria.pivotr.in`). Railway does not provide built-in proxy routing.

### Proxy Routing for Same-Origin (Docker/Caddy Only)

When using same-origin mode (empty `NEXT_PUBLIC_API_URL`), ensure your platform routes:

| Path | Destination |
|------|-------------|
| `/api/*` | Backend service (port 3001) |
| `/trpc/*` | Backend service (port 3001) |
| `/*` | Frontend service (port 3000) |

> **Note:** This routing is handled automatically by Caddy in Docker Compose deployments. Railway deployments should use the separate domain mode with `NEXT_PUBLIC_API_URL` set at build time.

## Installation Scripts

### Linux

```bash
sudo bash deployment/scripts/install-linux.sh
```

Installs Docker, creates directories, generates SSL certs, builds images, creates a systemd service, and starts the application.

### Windows

```powershell
.\deployment\scripts\install-windows.ps1
```

Checks Docker Desktop, creates directories, generates SSL certs, builds images, creates a Windows service, and starts the application.

## Database

PostgreSQL is configured with production-tuned settings:

- `max_connections=200`
- `shared_buffers=256MB`
- Health checks on startup
- Data persisted to `postgres-data` volume

Migrations run automatically on backend startup via `docker-entrypoint.sh`.

## Monitoring

The monitoring stack provides observability:

- **Prometheus** (port 9090) — Metrics collection from all services
- **Grafana** (port 3000 internally) — Dashboards and visualization
- **cAdvisor** (port 8080) — Container resource usage
- **Node Exporter** (port 9100) — Host system metrics

## Troubleshooting

### Container Issues

- **Container won't start**: `docker compose -f docker-compose.production.yml logs <service>`
- **Container keeps restarting**: Check health check and dependencies

### Network Issues

- **Cannot access application**: Verify Caddy is running and ports 80/443 are open
- **Internal communication failing**: Check Docker network with `docker network inspect aria-network`

### Database Issues

- **Connection failed**: Verify `DATABASE_URL` and PostgreSQL container health
- **Migration failed**: Check backend logs and see [Prisma docs](./03-backend/02-prisma/README.md)
