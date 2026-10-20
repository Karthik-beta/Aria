# Local Docker demo (Windows)

Run the full Aria ERP stack on one Windows machine with Docker Desktop, with
settings, demo data and scheduled jobs already in place. The app runs as
production builds behind Caddy on `http://localhost:8080`.

## Requirements

- Windows 10/11 with [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  (WSL 2 backend, **Linux containers**)
- About 4 GB of memory for Docker (Docker Desktop > Settings > Resources) and
  15 GB of free disk
- A clone of this repository (and [Git for Windows](https://git-scm.com/download/win)
  for `update`)

## Install / start

From the repository root, double-click **`aria-local.cmd`**, or run:

```powershell
.\aria-local.cmd
```

The script will:

1. Start Docker Desktop if it is not running and check it uses Linux containers,
   enough memory and enough disk
2. Use port 8080 (port 80 is usually taken on Windows), or fall back to
   8081/8082/... when 8080 is in use too
3. Build the backend and frontend images (10-20 minutes the first time,
   retried once if the build fails)
4. Start PostgreSQL and Redis, then apply the Prisma migrations
5. Load the **medium** demo dataset (Pivotr Technologies inventory and asset
   data) into a fresh database, once
6. Start the backend, frontend, backup service and proxy, wait until they are
   healthy, confirm the scheduled jobs are running and open the browser

Only one `aria-local` command runs at a time; a second one stops with a message.

Sign in with:

| Field    | Value                                 |
| -------- | ------------------------------------- |
| URL      | `http://localhost:8080` (or the port shown) |
| Username | `admin`                               |
| Password | `admin123`                            |

Open the app at `http://localhost:8080`, not `127.0.0.1` or a LAN IP: auth
cookies are issued for `localhost`. The proxy listens on `127.0.0.1` only, so
the demo is not reachable from other machines.

### Automatic restart

Every long-running container uses `restart: unless-stopped`, so after a
reboot or a Docker Desktop restart Aria comes back by itself as soon as Docker
Desktop runs. The script does not change Docker Desktop settings; to have
Docker (and therefore Aria) start when you sign in to Windows, enable
Docker Desktop > Settings > General > **Start Docker Desktop when you sign in**.

### Scheduled jobs

| Job                     | Runs in   | When                                           |
| ----------------------- | --------- | ---------------------------------------------- |
| Depreciation discovery  | `backend` | Daily at 00:00 `APP_TIME_ZONE`, and at startup |
| Depreciation reconciliation | `backend` | Periodically while the backend runs        |
| Database backup         | `backup`  | `BACKUP_SCHEDULE` (default 02:00 daily)        |

All containers run in `APP_TIME_ZONE` (`Asia/Kolkata`), so log timestamps and
cron times match the app's business date. `start` and `status` report whether
the jobs are running.

## Commands

```powershell
.\aria-local.cmd start          # build if needed, start, load demo data once
.\aria-local.cmd stop           # stop and remove containers (data is kept)
.\aria-local.cmd restart        # stop + start without rebuilding
.\aria-local.cmd status         # container state, health and recent backups
.\aria-local.cmd logs           # follow all logs
.\aria-local.cmd logs -Service backend
.\aria-local.cmd update         # pull the latest version and apply it
.\aria-local.cmd backup         # back up the database now
.\aria-local.cmd restore -File aria-nightly-20261020-020000.dump
.\aria-local.cmd reload-demo    # wipe and reload the demo dataset
.\aria-local.cmd reset          # delete ALL local data and start fresh (backups are kept)
.\aria-local.cmd open           # open the app in the browser
.\aria-local.cmd uninstall      # remove everything Aria created
.\aria-local.cmd help
```

Options:

| Option            | Effect                                                    |
| ----------------- | --------------------------------------------------------- |
| `-Port 9090`      | Serve on `http://localhost:9090` instead of 8080          |
| `-Scale large`    | Demo data size for this load: `small`, `medium`, `large`  |
| `-NoDemoData`     | Start a fresh database without demo data                  |
| `-NoBuild`        | Reuse the images that are already built                   |
| `-NoBrowser`      | Do not open the browser                                   |
| `-Force`          | Skip confirmations (`restore`, `reset`, `uninstall`); `update`: rebuild even when up to date |
| `-File <name>`    | Backup to restore (a name in `deployment\local\backups`, or a path) |
| `-Branch <name>`  | Branch `update` follows (default `master`)                |
| `-KeepBackups`    | `uninstall` keeps `deployment\local\backups`              |
| `-PruneBuildCache` | `uninstall` also clears Docker's (shared) build cache without asking |

Demo data is loaded only into a database that does not have it yet. To change
the scale of an existing install, use `reload-demo -Scale large` or
`reset -Scale small`. Installs made before medium became the default keep
their dataset until then.

`aria-local.cmd` only launches `deployment\local\aria-local.ps1` with
`-ExecutionPolicy Bypass`. You can call the `.ps1` directly from PowerShell
with the same arguments.

## Update

```powershell
.\aria-local.cmd update
```

One command does the whole update:

1. Checks the clone is on `master` with no uncommitted changes to tracked
   files (put settings in `aria-local.override.env`, which is never touched)
2. Fetches `origin/master` and stops if there is nothing new
3. Saves a restore point: a `pre-update-<commit>` database backup and the
   current images
4. Fast-forwards the clone and shows the incoming commits
5. Rebuilds, applies new migrations, restarts and waits for health with the
   **new** version of this script and compose file. Your data and demo data
   are kept.
6. On success, removes the restore-point images and dangling old images. On
   failure, rolls back automatically: the previous commit, the
   previous images and the pre-update backup, then starts the old version
   again and removes the images the failed build left behind.

Updates only fast-forward. If the local branch has its own commits, `update`
stops and leaves it to you.

## Backups and restore

The `backup` service runs `pg_dump` on `BACKUP_SCHEDULE` and writes
`aria-nightly-<timestamp>.dump` files to `deployment\local\backups` (git-ignored,
visible in Explorer). It keeps the newest `BACKUP_RETENTION` nightly backups.
Backups from `backup` (`aria-manual-*`), `update` (`aria-pre-update-*`) and
`restore` (`aria-pre-restore-*`) are never pruned automatically.

```powershell
.\aria-local.cmd backup
.\aria-local.cmd restore -File aria-manual-20261020-170057.dump
```

`restore` saves the current database first (`pre-restore`), stops the app,
recreates the database from the backup, applies migrations and starts the app.
Demo data is never loaded on top of a restored database. `reset` deletes the
database but keeps the backups folder, so you can restore after a reset.

## Uninstall

```powershell
.\aria-local.cmd uninstall
```

Removes, after a confirmation (`-Force` skips it):

- All Aria containers, the network and the data volumes (database, Redis, Caddy)
- The built images (`aria-local-backend`, `aria-local-frontend`, any
  restore-point images and untagged builds left by an earlier update)
- The pinned PostgreSQL, Redis and Caddy images, unless a container from
  another project still uses them
- `deployment\local\backups` (keep it with `-KeepBackups`) and
  `aria-local.override.env`

Docker's build cache is shared by all your Docker projects, so it cannot be
cleared for Aria alone. Uninstall shows its size and asks whether to clear it;
`-PruneBuildCache` clears it without asking, and `-Force` alone keeps it.

It then checks Docker for anything still labelled with the `aria-local`
project and reports either a clean result or what is left. Docker Desktop and
the repository folder stay; delete the folder yourself afterwards.

## Settings

Every setting lives in [`aria-local.env`](./aria-local.env): database and Redis
passwords, auth secret, admin account, default organization, time zone
(`Asia/Kolkata`), demo-data scale, backup schedule and retention, and ports.
These are throwaway values for a single-machine demo. Do not reuse them for a
shared or internet-facing deployment; use `docker-compose.production.yml` for that.

To change a value without editing the committed file (which would block
`update`), create `deployment\local\aria-local.override.env` (git-ignored)
with just the keys you want to change:

```ini
DEFAULT_ADMIN_PASSWORD=MyLocalPassword1
DEMO_DATA_SCALE=large
ARIA_HTTP_PORT=9090
BACKUP_SCHEDULE=30 21 * * *
BACKUP_RETENTION=14
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
| `docker-compose.local.yml`                | Services: caddy, frontend, backend, migrate, demo-data, backup, postgres, redis |
| `deployment/local/aria-local.env`         | Preloaded settings                                |
| `deployment/local/Caddyfile.local`        | HTTP reverse proxy for `/api`, `/trpc`, `/trpc-ws`, `/health` and the frontend |
| `deployment/local/load-demo-data.ts`      | Runs `prisma/demo-data/cli.ts load` once per database |
| `deployment/local/backup.sh`              | `pg_dump` with retention, run by cron in `backup` |
| `deployment/local/restore.sh`             | Recreates the database from a backup              |
| `deployment/local/aria-local.ps1`         | Windows automation                                |
| `aria-local.cmd`                          | Double-click launcher                             |

Startup order: `postgres`/`redis` -> `migrate` -> `demo-data` -> `backend` ->
`frontend` -> `caddy`, with `backup` next to `postgres`. The demo loader
finishes before the backend starts, so the backend's depreciation scheduler
never runs during a load. After a successful load it records a marker in the
PostgreSQL database comment; later starts, updates and restores see it and
skip loading. A failed load leaves no marker, so the next start retries (the
loader clears partial demo data first).

## Troubleshooting

- **Port 8080 in use**: the script falls back to another port automatically,
  or pass `-Port 9090`.
- **Build killed / exit code 137**: give Docker more memory
  (Docker Desktop > Settings > Resources, or `memory=6GB` in `%UserProfile%\.wslconfig`).
- **"Switch to Linux containers"**: right-click the Docker tray icon and
  switch to Linux containers.
- **Demo data load failed**: the loader's output is printed in the window just
  above the error (the failed one-shot container is removed, so
  `logs -Service demo-data` has nothing to show). Fix the cause, then run
  `.\aria-local.cmd start` again; it retries.
- **"Another aria-local command is running"**: wait for the other window to
  finish. A lock left by a closed window is cleared automatically.
- **Update stops on uncommitted changes**: move your edits to
  `aria-local.override.env`, or commit/discard them.
- **Login does nothing / logs out immediately**: use `http://localhost:8080` (or the port shown), not
  `127.0.0.1`. If you changed the port, sign in again on the new URL.
- **Start over**: `.\aria-local.cmd reset -Force`.
