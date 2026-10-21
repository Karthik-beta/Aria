# Getting Started

There are two ways to run Aria: as a **demo** on Windows with one installer, or from **source** for development.

## Demo on Windows: Aria ERP Setup

1. Install and start [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Download [Aria-ERP-Setup.exe](https://github.com/Karthik-beta/Aria/releases/latest/download/Aria-ERP-Setup.exe) and run it. It installs per user, without admin rights.
3. Tick **Load demo data** if you want a populated company to explore.
4. Aria opens at <http://localhost:8080>.

Running the installer again offers **update** (rolls back if the new version fails to start) and **uninstall**. Under the hood it drives `aria-local.cmd` and `docker-compose.local.yml`; see [`deployment/local/README.md`](https://github.com/Karthik-beta/Aria/blob/master/deployment/local/README.md) for the command-line equivalents (`update`, `uninstall`, `reload-demo`, `reset`, `restore`).

## From source

**Prerequisites:** Bun 1.3.x, Node 20 or 22, Git, and PostgreSQL 16+ (or Docker to run it).

```bash
git clone https://github.com/Karthik-beta/Aria.git
cd Aria
bun install
```

Create the environment file with at least `DATABASE_URL`, `BETTER_AUTH_URL=http://localhost:3001`, `FRONTEND_URL=http://localhost:3000` and `NEXT_PUBLIC_API_URL`, then set up the database:

```bash
cd apps/backend
bun x --bun prisma migrate dev
bun prisma/demo-data/cli.ts load --scale=medium   # optional demo data
```

Start both apps from the repository root:

```bash
bun --filter backend start:dev    # API on http://localhost:3001
bun --filter frontend dev         # UI on http://localhost:3000
```

### With Docker Compose

`docker-compose.development.yml` runs Caddy, the frontend, the backend, PostgreSQL and Redis together. Migrations are run by hand:

```bash
docker compose -f docker-compose.development.yml run --rm backend bun run db:migrate
curl http://localhost:3001/health/ready
```

Full details: [Getting Started guide](https://github.com/Karthik-beta/Aria/blob/master/docs/01-getting-started/README.md) and [FAQ](https://github.com/Karthik-beta/Aria/blob/master/docs/01-getting-started/01-faq/README.md).
