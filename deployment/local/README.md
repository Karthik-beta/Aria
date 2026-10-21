# Local Docker demo (Windows)

Run the full Aria ERP stack on one Windows machine with Docker Desktop, with
settings, demo data and scheduled jobs already in place. The app runs as
production builds behind Caddy on `http://localhost:8080`.

For demo laptops (sales), use the **Windows installer** instead of a clone:
see [Windows installer](#windows-installer). The rest of this page covers the
clone, which developers use.

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
3. Download the backend and frontend images that GitHub Actions built for
   the checked-out commit (see [Prebuilt images](#prebuilt-images)). When
   they are not available it builds them instead (10-20 minutes the first
   time, retried once if the build fails)
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
.\aria-local.cmd start          # fetch or build images if needed, start, load demo data once
.\aria-local.cmd stop           # stop and remove containers (data is kept)
.\aria-local.cmd restart        # stop + start without fetching or rebuilding
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
| `-NoBuild`        | Reuse the images that are already here                    |
| `-FromSource`     | Build the images from source instead of downloading them  |
| `-NoBrowser`      | Do not open the browser                                   |
| `-Force`          | Skip confirmations (`restore`, `reset`, `uninstall`); `update`: reinstall even when up to date |
| `-File <name>`    | Backup to restore (a name in `deployment\local\backups`, or a path) |
| `-Branch <name>`  | Branch `update` follows (default `master`)                |
| `-KeepRestorePoint` | `update` keeps the pre-update backup after a successful update |
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
2. Fetches `origin/master`, stops if there is nothing new, and shows the
   incoming commits
3. Checks that the prebuilt images for the new commit are published. If they
   are not (yet), it stops without changing anything instead of building on
   this machine; run `update` again later, or pass `-FromSource`
4. Creates a restore point: stops the app (so nothing is written after it),
   saves a `pre-update-<commit>` database backup and the current images, and
   records the data: the row count of every table, plus fingerprints of the
   depreciation schedules, posted depreciation entries and depreciation
   journal entries and lines
5. Fast-forwards the clone, downloads the new images, applies new migrations,
   restarts and waits for health with the **new** version of this script and
   compose file. Your data and demo data are kept.
6. Checks the new version: backend and frontend health, the depreciation
   scheduler's startup pass, and the data. Every table must still have at
   least as many rows as before (new records and scheduler catch-up are
   fine), and the depreciation records that existed before must be unchanged.
7. On success, removes the restore point (backup and images) and dangling old
   images; pass `-KeepRestorePoint` to keep the backup. On any failure, rolls
   back automatically: the previous commit, the previous images and the
   restore-point backup, then starts the old version, checks it the same way
   and keeps the restore point for you to inspect.

If the update stops before installing anything (for example the backup
fails), the current version is started again.

Updates only fast-forward. If the local branch has its own commits, `update`
stops and leaves it to you.

## Windows installer

`AriaSetup-<version>.exe` installs, updates and uninstalls the demo without
Git or a clone. Every `vX.Y.Z` tag attaches it to the GitHub Release (built by
`.github/workflows/windows-installer.yml` from `deployment/windows/installer`).
It runs the images CI built for that tag, so nothing is built on the laptop.

**Before the first install**, on each laptop: install
[Docker Desktop](https://www.docker.com/products/docker-desktop/) (this needs
administrator rights), start it once, and enable *Settings > General > Start
Docker Desktop when you sign in*. Aria restarts with Docker Desktop, so the
link keeps working after a reboot. The installer stops with a download link
when Docker Desktop is missing.

| Task      | How                                                                 |
| --------- | ------------------------------------------------------------------- |
| Install   | Run `AriaSetup-<version>.exe`. A console window shows progress (download, demo data, health checks), then the browser opens. |
| Use       | Open the **Aria ERP** shortcut (desktop or Start Menu), or `http://localhost:8080` |
| Update    | Run the newer `AriaSetup-<version>.exe`                             |
| Uninstall | Windows Settings > Apps > Aria ERP (or the Start Menu's *Uninstall Aria ERP*); it asks whether to keep the backups |

The installer needs no administrator rights. It installs per user to
`%LOCALAPPDATA%\Programs\Aria ERP`:

```text
Aria ERP\
  versions\<version>\     compose file and deployment\local of each installed version
  backups\                database backups (shared by every version)
  logs\                   one log per install or update
  current-version.txt     the version that is running
  Aria ERP.url            what the shortcuts open (follows the port Aria runs on)
```

An update installs the new version next to the old one, then runs the same
steps as `update` above: it checks the new images are published, creates a
restore point (app stopped, database backup, data snapshot, images), switches
to the new version and checks health, the depreciation scheduler and the data.
On success it removes the restore point and the old version's folder. On any
failure it rolls back to the old folder, images and database, and the installer
shows where the log is. Installed copies refuse `update` and `-FromSource`.

To publish a release:

```bash
git tag v0.2.0
```

```bash
git push origin v0.2.0
```

Release Images then builds the images, then the installer, then the GitHub
Release with `AriaSetup-0.2.0.exe` attached. The installer is not code-signed,
so Windows SmartScreen shows an *unknown publisher* warning (*More info >
Run anyway*).

## Prebuilt images

The [Release Images](../../.github/workflows/release-images.yml) workflow
builds the production backend and frontend images on every push to `master`
and every `v*` tag, for `linux/amd64` and `linux/arm64`, and publishes them to
GitHub Container Registry:

| Image                                | Tags                                               |
| ------------------------------------ | -------------------------------------------------- |
| `ghcr.io/karthik-beta/aria-backend`  | `sha-<commit>`, `master`, `X.Y.Z`, `X.Y`, `latest` |
| `ghcr.io/karthik-beta/aria-frontend` | same                                               |

`start` and `update` pull `sha-<commit>` for the checked-out commit and tag it
as `aria-local-backend:latest` / `aria-local-frontend:latest`, so the images
always match the migrations, compose file and script in the clone. CI only
publishes images for commits pushed to `master`, so when the checked-out commit
has none (a branch, or a change outside `apps/` and `packages/`), the script
uses the newest earlier commit (up to 50 back) whose images were built from the
same sources. If matching images are already here, nothing is downloaded. The
script builds from source instead when:

- no matching images are published yet (the workflow takes about 10-15
  minutes after a push; run `update -Force` later to switch to them), or the
  registry cannot be reached
- `apps/`, `packages/` or the root build files have local changes, or the
  folder is not a git clone
- you pass `-FromSource`

To use your own fork's images, set `ARIA_IMAGE_REGISTRY` (for example
`ghcr.io/<your-user>`) in `aria-local.override.env`.

## Backups and restore

The `backup` service runs `pg_dump` on `BACKUP_SCHEDULE` and writes
`aria-nightly-<timestamp>.dump` files to `deployment\local\backups` (git-ignored,
visible in Explorer). It keeps the newest `BACKUP_RETENTION` nightly backups.
Backups from `backup` (`aria-manual-*`) and `restore` (`aria-pre-restore-*`)
are never pruned automatically. `update`'s restore point (`aria-pre-update-*`)
is removed after a successful update and kept after a rollback.

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
- The app images (`aria-local-backend`, `aria-local-frontend`, any
  restore-point images, untagged builds left by an earlier update and
  leftover `ghcr.io/karthik-beta/aria-*` downloads)
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
- **"Prebuilt images ... are not available"**: the commit was pushed only
  minutes ago and the Release Images workflow is still running, or
  `ghcr.io` cannot be reached. `start` builds locally instead; run
  `.\aria-local.cmd update -Force` later to switch to the prebuilt images.
  `update` stops without changing anything; run it again later.
- **Update rolled back because of the data check**: the output lists the
  table that lost rows or the depreciation records that changed. Aria is back
  on the previous version with the restore-point data, and the backup stays in
  `deployment\local\backups`.
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
