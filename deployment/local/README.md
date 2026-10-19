# Local Docker demo (Windows)

Run the full Aria ERP stack on one Windows machine with Docker Desktop, with
settings and demo data already in place. The app runs as production builds
behind Caddy on `http://localhost`.

## Requirements

- Windows 10/11 with [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  (WSL 2 backend, **Linux containers**)
- About 4 GB of memory for Docker (Docker Desktop > Settings > Resources) and
  15 GB of free disk
- A clone of this repository

## Start

From the repository root, double-click **`aria-local.cmd`**, or run:

```powershell
.\aria-local.cmd
```

The script will:

1. Start Docker Desktop if it is not running and check it uses Linux containers
2. Pick port 80, or fall back to 8080/8081/... when 80 is taken
3. Build the backend and frontend images (10-20 minutes the first time)
4. Start PostgreSQL and Redis, then apply the Prisma migrations
5. Load the demo dataset (Pivotr Technologies inventory and asset data)
   into a fresh database, once
6. Start the backend, frontend and proxy, wait until they are healthy and open
   the browser

Sign in with:

| Field    | Value                                 |
| -------- | ------------------------------------- |
| URL      | `http://localhost` (or the port shown) |
| Username | `admin`                               |
| Password | `Admin@123`                           |

Open the app at `http://localhost`, not `127.0.0.1` or a LAN IP: auth
cookies are issued for `localhost`.

## Commands

```powershell
.\aria-local.cmd start          # build if needed, start, load demo data once
.\aria-local.cmd stop           # stop and remove containers (data is kept)
.\aria-local.cmd restart        # stop + start without rebuilding
.\aria-local.cmd status         # container state and health
.\aria-local.cmd logs           # follow all logs
.\aria-local.cmd logs -Service backend
.\aria-local.cmd reload-demo    # wipe and reload the demo dataset
.\aria-local.cmd reset          # delete ALL local data and start fresh
.\aria-local.cmd open           # open the app in the browser
.\aria-local.cmd uninstall      # remove containers, volumes and images
.\aria-local.cmd help
```

Options:

| Option            | Effect                                                    |
| ----------------- | --------------------------------------------------------- |
| `-Port 8080`      | Serve on `http://localhost:8080`                          |
| `-Scale medium`   | Demo data size for this load: `small`, `medium`, `large`  |
| `-NoDemoData`     | Start a fresh database without demo data                  |
| `-NoBuild`        | Reuse the images that are already built                   |
| `-NoBrowser`      | Do not open the browser                                   |
| `-Force`          | Skip the confirmation for `reset` and `uninstall`         |

Demo data is loaded only into a database that does not have it yet. To change
the scale of an existing install, use `reload-demo -Scale medium` or
`reset -Scale medium`.

`aria-local.cmd` only launches `deployment\local\aria-local.ps1` with
`-ExecutionPolicy Bypass`. You can call the `.ps1` directly from PowerShell
with the same arguments.

## Settings

Every setting lives in [`aria-local.env`](./aria-local.env): database and Redis
passwords, auth secret, admin account, default organization, time zone
(`Asia/Kolkata`), demo-data scale and ports. These are throwaway values for a
single-machine demo. Do not reuse them for a shared or internet-facing
deployment; use `docker-compose.production.yml` for that.

To change a value without editing the committed file, create
`deployment\local\aria-local.override.env` (git-ignored) with just the keys you
want to change:

```ini
DEFAULT_ADMIN_PASSWORD=MyLocalPassword1
DEMO_DATA_SCALE=medium
ARIA_HTTP_PORT=8080
```

Admin credentials and the organization are created on the first backend
start, so changing them later needs `reset`.

PostgreSQL is published on `127.0.0.1:5433` for tools like pgAdmin or DBeaver
(database `aria`, user `aria`, password from `aria-local.env`).

## Without Windows

The stack is plain Docker Compose, so it also runs on macOS and Linux:

```bash
docker compose --env-file deployment/local/aria-local.env -f docker-compose.local.yml up -d --build
```

Compose runs migrations and the demo-data load before starting the backend.
The first `up` blocks until the demo data has loaded.

## How it works

| File                                      | Purpose                                           |
| ----------------------------------------- | ------------------------------------------------- |
| `docker-compose.local.yml`                | Services: caddy, frontend, backend, migrate, demo-data, postgres, redis |
| `deployment/local/aria-local.env`         | Preloaded settings                                |
| `deployment/local/Caddyfile.local`        | HTTP reverse proxy for `/api`, `/trpc`, `/trpc-ws`, `/health` and the frontend |
| `deployment/local/load-demo-data.ts`      | Runs `prisma/demo-data/cli.ts load` once per database |
| `deployment/local/aria-local.ps1`         | Windows automation                                |
| `aria-local.cmd`                          | Double-click launcher                             |

Startup order: `postgres`/`redis` -> `migrate` -> `demo-data` -> `backend` ->
`frontend` -> `caddy`. The demo loader finishes before the backend starts, so
the backend's depreciation scheduler never runs during a load. After a
successful load it records a marker in the PostgreSQL database comment; later
starts see it and skip loading. A failed load leaves no marker, so the next
start retries (the loader clears partial demo data first).

## Troubleshooting

- **Port 80 in use**: the script falls back to another port automatically,
  or pass `-Port 8080`.
- **Build killed / exit code 137**: give Docker more memory
  (Docker Desktop > Settings > Resources, or `memory=6GB` in `%UserProfile%\.wslconfig`).
- **"Switch to Linux containers"**: right-click the Docker tray icon and
  switch to Linux containers.
- **Demo data load failed**: check `.\aria-local.cmd logs -Service demo-data`,
  then run `.\aria-local.cmd start` again; it retries.
- **Login does nothing / logs out immediately**: use `http://localhost`, not
  `127.0.0.1`. If you changed the port, sign in again on the new URL.
- **Start over**: `.\aria-local.cmd reset -Force`.
