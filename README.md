# Aria ERP Monorepo

Monorepo for the Aria B2B ERP suite. The workspace combines a NestJS 11 backend, four Next.js 1## Docker & ## Docker & environments

`docker-compose.yml` outlines the intended production topology (Traefik, backend, frontends, Postgres). As services mature:

- Document required environment variables in each app's README and `.env.example`.
- Keep Dockerfiles in sync with the runtime commands shipped in package scripts.
- Run `docker compose up` for local smoke tests once images are available.

## On-Premise Deployment

Aria ERP supports professional on-premise deployment to client environments with cross-platform support for Windows and Linux.

### Creating Deployment Packages

```bash
# Build all applications
pnpm build

# Create deployment package
pnpm package

# Test the package
pnpm package:test
```

### Installation

**Linux:**
```bash
tar -xzf aria-erp-v0.1.0-linux.tar.gz
cd aria-erp-v0.1.0
sudo ./bin/load-images.sh
sudo ./bin/install-linux.sh --domain erp.company.com --modules full
```

**Windows (PowerShell as Administrator):**
```powershell
# Extract ZIP file, then:
.\bin\load-images.ps1
.\bin\install-windows.ps1 -Domain "erp.company.com" -Modules "full"
```

### Documentation

- **[Deployment README](deployment/README.md)** - Package overview and quick start
- **[Installation Guide](deployment/docs/INSTALLATION.md)** - Detailed installation instructions
- **[Configuration Reference](deployment/docs/CONFIGURATION.md)** - Configuration options
- **[Troubleshooting Guide](deployment/docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Development Guide](deployment/DEVELOPMENT.md)** - For developers building packages

### Features

- ✅ Cross-platform (Windows/Linux)
- ✅ Modular frontend selection based on licensing
- ✅ System service integration (systemd/scheduled tasks)
- ✅ Auto-restart and auto-start on boot
- ✅ SSL/TLS support
- ✅ Comprehensive documentation

## Contribution checklistnts

`docker-compose.yml` outlines the intended production topology (Traefik, backend, frontends, Postgres). As services mature:

- Document required environment variables in each app's README and `.env.example`.
- Keep Dockerfiles in sync with the runtime commands shipped in package scripts.
- Run `docker compose up` for local smoke tests once images are available.

⚠️ **Security Note**: The included SSL certificates in `traefik/certs/` are self-signed and FOR DEVELOPMENT ONLY. For production deployment, use the on-premise deployment package which supports Let's Encrypt and custom certificates.

## Project layout

```
/Aria
├── apps/
│   ├── backend/            # NestJS API service
│   └── frontend/
│       ├── asset/          # Asset management frontend
│       ├── CRM/            # Customer management frontend
│       ├── hrms/           # HR and payroll frontend
│       └── inventory/      # Inventory control frontend
├── packages/
│   ├── config-eslint/      # Shared flat ESLint presets (Prettier integrated)
│   ├── config-typescript/  # Shared tsconfig profiles
│   ├── types/              # Canonical TypeScript contracts
│   └── utils/              # Pure, reusable helpers
├── .github/workflows/ci.yml # CI guardrails (lint, test, build)
├── docker-compose.yml       # Traefik + service orchestration (future)
├── README.md                # You are here
└── AGENTS.md                # Agent charter & governance
```

Each app/package keeps a README with day-to-day runbooks and testing roadmaps. Start there for surface-specific guidance.

## Prerequisites

- Node.js 22.x (managed via `nvm`/`nvs` recommended)
- pnpm 10.x (`corepack enable` or install manually)
- Git and a shell capable of running Turborepo commands
- (Optional) Docker + Docker Compose for full-stack orchestration

After cloning the repository, install dependencies once:

```bash
pnpm install
```

## Core commands

| Task             | Command                   | Notes                                                                                         |
| ---------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| Format code      | `pnpm format`             | Runs Prettier across the entire workspace.                                                    |
| Check formatting | `pnpm format:check`       | Useful for CI or local verification.                                                          |
| Lint             | `pnpm lint`               | Executes ESLint with Prettier integration in every package.                                   |
| Test             | `pnpm test`               | Delegates to package-level test suites (Vitest/Jest as they land).                            |
| Build            | `pnpm build`              | Runs production builds for backend + all frontends.                                           |
| Dev servers      | `pnpm --filter <app> dev` | Launches an individual frontend (`asset`, `crm`, `hrms`, `inventory`) or backend (`backend`). |

Use Turborepo filters to scope commands, e.g. `pnpm --filter asset lint`.

## Development workflow

1. Install dependencies (`pnpm install`).
2. Start the needed dev server(s) with `pnpm --filter <app> dev`.
3. Keep `pnpm lint` and `pnpm test` green while iterating. Prettier errors show up as ESLint violations—run `pnpm format` before committing.
4. Update the relevant app/package README with new capabilities or environment variables.
5. Summarize changes against the four agents in your PR description.

## Agent-aligned expectations

- **Simplicity Advocate**: follow framework generators (`pnpx next`, `pnpx nest g`), avoid bespoke configs, and reuse shared packages.
- **Type Safety Guardian**: import contracts from `@aria/types`, extend `@aria/tsconfig`, and keep strict TypeScript settings intact.
- **Automation Steward**: expose scripts via package `package.json`, keep Turborepo tasks cached, and mirror workflows in CI.
- **Quality Sentinel**: add or update unit/integration/E2E tests alongside features and enforce accessibility and observability standards.

Refer to [`AGENTS.md`](./AGENTS.md) for detailed responsibilities, checklists, and cross-agent rituals.

## Testing & QA

- Backfill Vitest suites for utilities and React components (packages and frontends).
- Maintain Jest-based unit and e2e tests in `apps/backend/test`.
- Add Playwright smoke tests per frontend under `apps/frontend/<app>/e2e` (planned).
- Keep coverage thresholds documented per surface and report failures in CI.

### Docker Testing

Comprehensive Docker testing suite for validating builds, deployments, and Next.js 15 static asset handling:

```bash
# Run complete test suite (Windows)
.\scripts\test-docker-setup.ps1 -Profile full

# Run complete test suite (Linux/Mac)
./scripts/test-docker-setup.sh full

# Verify static assets after deployment
.\scripts\verify-static-assets.ps1

# Pre-deployment validation
.\scripts\run-all-tests.ps1
```

**📚 Documentation:**

- **Quick Start:** [scripts/QUICK_START.md](scripts/QUICK_START.md) - Get testing in 5 minutes
- **Comprehensive Guide:** [scripts/DOCKER_TESTING_GUIDE.md](scripts/DOCKER_TESTING_GUIDE.md) - Full testing methodology
- **Quick Reference:** [scripts/QUICK_REFERENCE.md](scripts/QUICK_REFERENCE.md) - Command cheat sheet
- **Implementation Details:** [scripts/TEST_IMPLEMENTATION_SUMMARY.md](scripts/TEST_IMPLEMENTATION_SUMMARY.md) - Technical overview

**Key Features:**

- ✅ Next.js 15.5.4 static asset verification (critical for path-based routing)
- ✅ Profile-based testing (full, asset, hrms, inventory, crm)
- ✅ Automated SSL certificate generation for testing
- ✅ Health check validation for all services
- ✅ Container log analysis
- ✅ Cross-platform support (PowerShell + Bash)

## CI & automation

GitHub Actions (`.github/workflows/ci.yml`) enforces `pnpm lint`, `pnpm test`, and `pnpm build`. Extend the workflow whenever you add new quality gates (e.g., Playwright, typegen). Turborepo caching accelerates repeated runs—declare task outputs when adding generated artifacts.

## Docker & environments

`docker-compose.yml` outlines the intended production topology (Traefik, backend, frontends, Postgres). As services mature:

- Document required environment variables in each app’s README and `.env.example`.
- Keep Dockerfiles in sync with the runtime commands shipped in package scripts.
- Run `docker compose up` for local smoke tests once images are available.

## Contribution checklist

Before opening a pull request:

- [ ] `pnpm format`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Update applicable READMEs and note agent coverage in the PR summary

Staying disciplined with these steps keeps the Aria suite cohesive and production-ready as it grows. Happy building! 👋
