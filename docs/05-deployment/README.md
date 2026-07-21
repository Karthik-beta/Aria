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
| `migrate` | aria-backend | n/a | One-shot `prisma migrate deploy` gate |
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
| `/health/live` | backend:3001 | Process-only liveness |
| `/health/ready` | backend:3001 | PostgreSQL, Redis, worker, and queue-events readiness |
| `/health` | backend:3001 | Compatibility alias for readiness |
| `/api/*` | backend:3001 | better-auth and API endpoints |
| `/trpc/*` | backend:3001 | tRPC HTTP requests |
| `/trpc-ws` | backend:3001 | tRPC WebSocket (real-time) |
| `/*` | frontend:3000 | Next.js (all other routes) |

Features: HTTP/3 support, security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection), automatic local certificates, SSR streaming support.

## Quick Start

### Production Deployment

```bash
# Copy and complete the production environment template.
cp -n .env.production.template .env.production

# Validate the rendered configuration, then deploy. The `migrate` service is a
# one-shot gate; the backend starts only after it completes successfully.
docker compose --env-file .env.production \
  -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production \
  -f docker-compose.production.yml up -d --build

# Check dependency-aware backend readiness.
curl --fail https://YOUR_DOMAIN/health/ready
bash deployment/tests/health-check.sh

# View logs
docker compose -f docker-compose.production.yml logs -f backend
```

### Development Deployment

```bash
# Copy local-only values, then start PostgreSQL and Redis.
cp -n .env.development.template .env
docker compose -f docker-compose.development.yml up -d postgres redis

# Apply migrations before starting the application for the first time and after
# pulling a schema change. Development Compose does not run migrations itself.
docker compose -f docker-compose.development.yml run --rm backend \
  bun x --bun prisma migrate dev

# Start the application stack and verify dependency-aware readiness.
docker compose -f docker-compose.development.yml up -d
curl --fail http://localhost:3001/health/ready
```

The development Compose file is intended for local data only. Do not run its
database reset or demo-data commands against a production database.

## Required Environment Variables

For self-hosted Compose, place production values in `.env.production` and pass
`--env-file .env.production` as shown above. Railway and other managed platforms
set the same runtime values in the service configuration instead.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection URL for the backend on managed platforms. Self-hosted production Compose derives this from `POSTGRES_PASSWORD`. |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `REDIS_PASSWORD` | Redis password; required by self-hosted production Compose. Do not set a second password when a managed `REDIS_URL` already embeds one. |
| `REDIS_URL` | BullMQ URL; defaults to `redis://redis:6379`. Managed URLs may embed credentials |
| `APP_TIME_ZONE` | IANA timezone used for depreciation business dates and midnight discovery |
| `ASSET_DEPRECIATION_QUEUE_CONCURRENCY` | Concurrent depreciation workers (default `5`) |
| `ASSET_DEPRECIATION_BARRIER_TIMEOUT_MS` | Report synchronization timeout in milliseconds (default `120000`) |
| `ASSET_DEPRECIATION_QUEUE_OPERATION_TIMEOUT_MS` | Producer connection and operation timeout (default `5000`) |
| `ASSET_DEPRECIATION_RECONCILIATION_INTERVAL_MS` | Missed-work discovery interval (default `900000`) |
| `JWT_SECRET` | API authentication secret |
| `BETTER_AUTH_SECRET` | Auth session signing secret |
| `DOMAIN` | Domain name or IP for Caddy |
| `DEFAULT_ADMIN_USERNAME` | Initial admin username |
| `DEFAULT_ADMIN_PASSWORD` | Initial admin password |
| `DEFAULT_ADMIN_EMAIL` | Initial admin email |
| `LOAD_DEMO_DATA` | Set to any value to load demo data on backend startup (optional) |
| `LOAD_DEMO_DATA_SCALE` | Demo data scale: `small`, `medium`, or `large` (default: `medium`) |

## Railway Cloud Deployment

Railway runs the frontend and one persistent backend service, plus managed
PostgreSQL and Redis. The backend container contains the API, Nest scheduler,
and BullMQ worker; do not use a Railway Cron Job for depreciation and do not
scale this backend above one replica until those roles are separated.

Deploy from the repository using the Dockerfiles. In the backend service, set
`RAILWAY_DOCKERFILE_PATH=apps/backend/Dockerfile` and keep the Dockerfile start
command unchanged. Configure this pre-deploy command:

```bash
cd apps/backend && bun x --bun prisma migrate deploy
```

Railway has no Compose `depends_on`; the backend readiness endpoint is the
operational gate for PostgreSQL, Redis, the BullMQ worker, and queue events.

### Railway Service Configuration

Create a frontend service, one persistent backend service, and Railway-managed
PostgreSQL and Redis services. Use Railway service-reference values for
`DATABASE_URL` and `REDIS_URL` rather than hard-coding hostnames or credentials.

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
| `DATABASE_URL` | Reference to the Railway PostgreSQL service |
| `REDIS_URL` | Reference to the Railway Redis service; preserve embedded credentials if supplied |
| `APP_TIME_ZONE` | Required IANA timezone, for example `Asia/Kolkata` |
| `ASSET_DEPRECIATION_QUEUE_CONCURRENCY` | Optional worker concurrency; defaults to `5` |
| `ASSET_DEPRECIATION_BARRIER_TIMEOUT_MS` | Optional reporting timeout; defaults to `120000` |
| `JWT_SECRET` | Generate a secure random string |
| `BETTER_AUTH_SECRET` | Generate a secure random string |
| `BETTER_AUTH_URL` | Your Railway frontend URL |
| `FRONTEND_URL` | Your Railway frontend URL (drives CORS automatically) |

After deployment, require `GET /health/ready` to return `200` before routing
traffic or resuming the depreciation queue. A liveness-only check is not enough.

### Same-Origin vs Separate Backend

The frontend supports two deployment modes:

| Mode | `NEXT_PUBLIC_API_URL` | Use Case |
|------|----------------------|----------|
| **Separate domain** (default) | `https://api.example.com` | Backend hosted separately |
| **Same-origin** | `""` (empty) | Frontend and backend on same domain, proxied by Caddy/Nginx |

For Railway, set `NEXT_PUBLIC_API_URL` as a frontend **build-time** value to the
backend's public URL (for example, `https://backend.example.com`). Next.js embeds
this value in the browser bundle; changing it after the image is built has no
effect. Railway does not provide Compose-style path routing between services.

### Proxy Routing for Same-Origin (Docker/Caddy Only)

When using same-origin mode (empty `NEXT_PUBLIC_API_URL`), ensure your platform routes:

| Path | Destination |
|------|-------------|
| `/api/*` | Backend service (port 3001) |
| `/trpc/*` | Backend service (port 3001) |
| `/*` | Frontend service (port 3000) |

> **Note:** This routing is handled automatically by Caddy in Docker Compose
> deployments. Railway deployments should use the separate-domain mode with
> `NEXT_PUBLIC_API_URL` configured at build time.

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

The one-shot `migrate` service runs only `prisma migrate deploy`. The backend
starts only when that service exits successfully. No container automatically
marks a failed migration as applied.

## Depreciation Recovery

Asset depreciation does not depend on the server being online at midnight. On
every backend startup, Aria generates any missing base schedules for migrated
submitted assets, discovers all due unposted periods, and places one durable
BullMQ job per asset finance book and schedule date in Redis. The same discovery
path runs daily at midnight in `APP_TIME_ZONE` and every 15 minutes by default.

Redis uses append-only persistence in both Compose environments. Do not remove
the Redis data volume during normal upgrades or restarts. PostgreSQL remains the
accounting source of truth: a unique posting constraint prevents duplicate
journal entries if power is lost after the database commit but before BullMQ
acknowledges the job.

Depreciation and asset-balance reports fail closed while due periods remain
unposted. A timeout or failed job indicates a business-data issue such as
missing company/category accounts or an accounting freeze. Readiness fails when
PostgreSQL, Redis, the worker, or queue events are unavailable.

### Recovery checks

```bash
# Confirm PostgreSQL and Redis are healthy
docker compose -f docker-compose.production.yml ps postgres redis

# Inspect structured discovery and worker events
docker compose -f docker-compose.production.yml logs backend \
  | grep asset_depreciation

# Inspect the queue without changing accounting data
docker compose -f docker-compose.production.yml exec backend \
  bun run depreciation:queue -- status

# Restart only the backend; startup/reconciliation discovery catches up state
docker compose -f docker-compose.production.yml restart backend
```

Before retrying a permanently failed posting, verify the company depreciation
expense and accumulated-depreciation accounts, category overrides, finance-book
configuration, and `accountsFrozenThrough` date in the admin UI. Terminal
accounting failures are not automatically retried.

See the [depreciation production runbook](./depreciation-production-runbook.md)
for preflight, rollout, baselining, recovery, and rollback procedures.
The latest isolated Compose evidence, including migration, worker, readiness,
and restart/idempotency checks, is retained in the
[depreciation verification report](./depreciation-verification-2026-07-20.md).

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
- **Migration failed**: Check backend logs and see the [Prisma guide](../03-backend/02-prisma/README.md)
