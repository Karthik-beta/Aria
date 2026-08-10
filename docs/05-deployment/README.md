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
| `/ready/` | frontend:3000 | Exact-200 frontend process readiness |
| `/api/*` | backend:3001 | better-auth and API endpoints |
| `/trpc/*` | backend:3001 | tRPC HTTP requests |
| `/trpc-ws` | backend:3001 | tRPC WebSocket (real-time) |
| `/*` | frontend:3000 | Next.js (all other routes) |

Features: HTTP/3 support, security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection), automatic local certificates, SSR streaming support.

## Quick Start

### Production Deployment

```bash
cp -n .env.production.template .env.production
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.production.yml build backend frontend
docker compose --env-file .env.production -f docker-compose.production.yml up -d postgres redis
docker compose --env-file .env.production -f docker-compose.production.yml run --rm migrate
docker compose --env-file .env.production -f docker-compose.production.yml run --rm \
  -e ARIA_ALLOW_DEMO_DATA_MUTATION=true -e ARIA_DEMO_DATABASE_ISOLATED=true \
  backend bun run demo:load:small
docker compose --env-file .env.production -f docker-compose.production.yml up -d backend frontend caddy
curl --fail https://YOUR_DOMAIN/health/ready
bash deployment/tests/health-check.sh
docker compose -f docker-compose.production.yml logs -f backend
```

The demo command is optional and intended for a fresh disposable demo database.
The two `ARIA_*` confirmations are required because loading first removes the
previous demo dataset. It is an explicit one-time operation: the backend
entrypoint never migrates or loads demo data automatically. The commands above
are one line each and work in Bash
and PowerShell. On Windows, use Linux containers in Docker Desktop and replace
the first `cp` command with:

```powershell
Copy-Item .env.production.template .env.production
```

To reload Pivotr data later, stop the backend first because the loader cleans
and rebuilds that dataset:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml stop backend
docker compose --env-file .env.production -f docker-compose.production.yml run --rm \
  -e ARIA_ALLOW_DEMO_DATA_MUTATION=true -e ARIA_DEMO_DATABASE_ISOLATED=true \
  backend bun run demo:load:small
docker compose --env-file .env.production -f docker-compose.production.yml start backend
```

### Development Deployment

```bash
# Copy local-only values, then start PostgreSQL and Redis.
cp -n .env.development.template .env
docker compose -f docker-compose.development.yml up -d postgres redis

# Apply migrations before starting the application for the first time and after
# pulling a schema change. Development Compose does not run migrations itself.
docker compose -f docker-compose.development.yml run --rm backend \
  bun run db:migrate

# Start the application stack and verify dependency-aware readiness.
docker compose -f docker-compose.development.yml up -d
curl --fail http://localhost:3001/health/ready
```

The development Compose file is intended for local data only. Do not run its
database reset or demo-data commands against a production database.

## Environment Variables

For self-hosted Compose, place production values in `.env.production` and pass
`--env-file .env.production` as shown above. Railway and other managed platforms
set the same runtime values in the service configuration instead.

### Required runtime values

| Target | Variables |
|--------|-----------|
| Self-hosted Compose | `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `APP_TIME_ZONE`, `BETTER_AUTH_SECRET`, `FRONTEND_URL`, `BETTER_AUTH_URL`, `DOMAIN` |
| Railway backend | `DATABASE_URL`, `REDIS_URL`, `APP_TIME_ZONE`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FRONTEND_URL` |
| Railway frontend build | `NEXT_PUBLIC_API_URL` |

`BETTER_AUTH_URL` is the public backend URL. `FRONTEND_URL` is the public
frontend origin used for trusted origins and CORS. `JWT_SECRET` is not used by
the current Better Auth implementation. Managed Railway Redis already provides
credentials through `REDIS_URL`, so do not add `REDIS_PASSWORD` there.

### Initial administrator

Set `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD`, and
`DEFAULT_ADMIN_EMAIL` together only when bootstrapping the first administrator.
They are not required after that account exists. `DEFAULT_ADMIN_NAME` is
optional and defaults to `Administrator`.

### Optional worker tuning

`ASSET_DEPRECIATION_QUEUE_CONCURRENCY`,
`ASSET_DEPRECIATION_BARRIER_TIMEOUT_MS`,
`ASSET_DEPRECIATION_QUEUE_OPERATION_TIMEOUT_MS`, and
`ASSET_DEPRECIATION_RECONCILIATION_INTERVAL_MS` retain the defaults documented
in `.env.production.template`.

## Railway Cloud Deployment

Railway runs the frontend and one persistent backend service, plus managed
PostgreSQL and Redis. The backend container contains the API, Nest scheduler,
and BullMQ worker; do not use a Railway Cron Job for depreciation and do not
scale this backend above one replica until those roles are separated.

All four services must be in the same Railway project and environment so the
PostgreSQL and Redis private service references resolve. Connect both app
services to the GitHub repository's `master` branch, leave Root Directory empty,
and set each service's Config File path:

- Backend: `/apps/backend/railway.json`
- Frontend: `/apps/frontend/railway.json`

Those checked-in files select the Dockerfile builder and absolute Dockerfile
paths. Do not set `RAILWAY_DOCKERFILE_PATH`, a custom build command, or a custom
start command in Railway. Before investigating runtime behavior, confirm the
deployment SHA contains the current Dockerfile and the deployment details show
the config values came from the expected `railway.json` file.

The backend config runs this pre-deploy command from the built image:

```text
bun --cwd=/app/apps/backend run db:migrate:deploy
```

It validates `DATABASE_URL`, logs only the target host, port, and database,
waits a bounded time for PostgreSQL, then executes Prisma migration deployment
once. Migration-history or SQL failures are returned immediately.

Railway has no Compose `depends_on`; the backend readiness endpoint is the
operational gate for PostgreSQL, Redis, the BullMQ worker, and queue events.

### GitHub-to-Railway CI/CD Gate

The `CI` GitHub Actions workflow is the production gate. Pull requests run
linting, unit and integration tests, migration compatibility, type checking,
browser tests, and the production build. A push to `master` repeats those
checks, then performs an isolated production Compose smoke test that verifies
migrations, the queue, frontend and backend readiness, Redis recovery, and
backend restart idempotency. The older cross-platform deployment diagnostics
workflow is manual-only so it cannot create a second production gate.

In both the Railway Backend and Frontend services, enable **Wait for CI** on the
GitHub deployment trigger. A failed or unavailable check suite must skip the new
deployment and leave the current healthy release active. Keep both services on
the same `master` branch and repository so they evaluate the same commit.

The checked-in health gates are:

- Backend: `GET /health/ready` must return exactly `200`.
- Frontend: `GET /ready/` must return exactly `200` without authentication or
  redirects.

After Railway reports a successful deployment, the `Production Smoke` workflow
checks both public endpoints. It can also be run manually from GitHub Actions.
This smoke test observes production but does not change application or database
state.

Do not put `demo:load:*` in GitHub Actions, a Railway start command, a
pre-deploy command, or a cron job. Demo loading cleans and rebuilds the Pivotr
dataset and must remain an explicit maintenance operation. Before any
intentional demo reload or potentially destructive migration, create and verify
a PostgreSQL volume backup in Railway.

### Railway Service Configuration

Create a frontend service, one persistent backend service, and Railway-managed
PostgreSQL and Redis services. Use Railway service-reference values for
`DATABASE_URL` and `REDIS_URL` rather than hard-coding hostnames or credentials.

#### Frontend Service

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://${{<exact-backend-service-name>.RAILWAY_PUBLIC_DOMAIN}}` |

#### Backend Service

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{<exact-postgres-service-name>.DATABASE_URL}}` |
| `REDIS_URL` | `${{<exact-redis-service-name>.REDIS_URL}}` |
| `APP_TIME_ZONE` | `Asia/Kolkata` |
| `BETTER_AUTH_SECRET` | A sealed random secret |
| `BETTER_AUTH_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |
| `FRONTEND_URL` | `https://${{<exact-frontend-service-name>.RAILWAY_PUBLIC_DOMAIN}}` |

Replace every angle-bracket placeholder with the exact Railway service name.
Add the three initial-administrator variables only for first-account bootstrap.
Keep the backend at one replica.

After migration and deployment, require `GET /health/ready` to return `200`.
Then load the small Pivotr dataset exactly once on the fresh database using the
current Railway CLI:

```bash
railway ssh --service <exact-backend-service-name> -- \
  env ARIA_ALLOW_DEMO_DATA_MUTATION=true ARIA_DEMO_DATABASE_ISOLATED=true \
  bun --cwd=/app/apps/backend run demo:load:small
```

Run `bun --cwd=/app/apps/backend prisma/demo-data/cli.ts status` through the
same SSH command to inspect the result. Never add a demo-loading startup flag.
If reloading an existing demo is intentional, stop the backend first.

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

The package-owned command used by Compose, Railway, and CI is:

```bash
bun --cwd=apps/backend run db:migrate:deploy
```

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
  bun --cwd=/app/apps/backend run depreciation:queue -- status

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
- **Railway has no Deploy or Network logs**: the pre-deploy command has not
  succeeded, so Railway has not started the deploy or health-check phases. Read
  the pre-deploy log for the sanitized target and PostgreSQL readiness result.
- **Railway selects Railpack**: confirm the service Config File path is the
  absolute `/apps/backend/railway.json` or `/apps/frontend/railway.json`, then
  verify the deployment details show the checked-in Dockerfile builder config.
- **Container keeps restarting**: Check health check and dependencies

### Network Issues

- **Cannot access application**: Verify Caddy is running and ports 80/443 are open
- **Internal communication failing**: Check Docker network with `docker network inspect aria-network`

### Database Issues

- **Connection failed**: Verify `DATABASE_URL` and PostgreSQL container health
- **Migration failed**: Check backend logs and see the [Prisma guide](../03-backend/02-prisma/README.md)

## Official Platform Guidance

- [Railway Config as Code](https://docs.railway.com/config-as-code)
- [Railway pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command)
- [Railway private networking](https://docs.railway.com/networking/private-networking)
- [Railway SSH](https://docs.railway.com/cli/ssh)
- [Prisma `migrate deploy`](https://docs.prisma.io/docs/cli/migrate/deploy)
