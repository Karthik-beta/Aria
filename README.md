# Aria ERP# Aria ERP Monorepo



Enterprise Resource Planning suite built as a modern monorepo, combining a NestJS backend with Next.js 15 frontends for modular B2B operations.Monorepo for the Aria B2B ERP suite. The workspace combines a NestJS 11 backend, four Next.js 1## Docker & ## Docker & environments



## Architecture`docker-compose.yml` outlines the intended production topology (Traefik, backend, frontends, Postgres). As services mature:



Aria ERP is a full-stack TypeScript monorepo managed with pnpm workspaces and Turborepo:- Document required environment variables in each app's README and `.env.example`.

- Keep Dockerfiles in sync with the runtime commands shipped in package scripts.

- **Backend**: NestJS 11 API service- Run `docker compose up` for local smoke tests once images are available.

- **Frontends**: Four Next.js 15 applications (Asset Management, CRM, HRMS, Inventory)

- **Shared Packages**: Type definitions, utilities, and configuration presets## On-Premise Deployment

- **Deployment**: Cross-platform on-premise deployment with Docker

Aria ERP supports professional on-premise deployment to client environments with cross-platform support for Windows and Linux.

## Project Structure

### Creating Deployment Packages

```

aria/```bash

├── apps/# Build all applications

│   ├── backend/          # NestJS API servicepnpm build

│   └── frontend/

│       ├── asset/        # Asset management# Create deployment package

│       ├── CRM/          # Customer relationship managementpnpm package

│       ├── hrms/         # Human resources & payroll

│       └── inventory/    # Inventory control# Test the package

├── packages/pnpm package:test

│   ├── config-eslint/    # Shared ESLint configuration```

│   ├── config-typescript/# Shared TypeScript configuration

│   ├── types/            # Shared type definitions### Installation

│   └── utils/            # Shared utilities

├── deployment/           # On-premise deployment infrastructure**Linux:**

│   ├── docs/            # User documentation```bash

│   ├── scripts/         # Installation and build scriptstar -xzf aria-erp-v0.1.0-linux.tar.gz

│   └── templates/       # Configuration templatescd aria-erp-v0.1.0

└── .github/             # CI/CD workflowssudo ./bin/load-images.sh

```sudo ./bin/install-linux.sh --domain erp.company.com --modules full

```

## Quick Start

**Windows (PowerShell as Administrator):**

### Prerequisites```powershell

# Extract ZIP file, then:

- Node.js 22.x.\bin\load-images.ps1

- pnpm 10.x (`corepack enable`).\bin\install-windows.ps1 -Domain "erp.company.com" -Modules "full"

- Docker 20.10+ (for deployment testing)```



### Installation### Documentation



```bash- **[Deployment README](deployment/README.md)** - Package overview and quick start

# Install dependencies- **[Installation Guide](deployment/docs/INSTALLATION.md)** - Detailed installation instructions

pnpm install- **[Configuration Reference](deployment/docs/CONFIGURATION.md)** - Configuration options

- **[Troubleshooting Guide](deployment/docs/TROUBLESHOOTING.md)** - Common issues and solutions

# Format code- **[Development Guide](deployment/DEVELOPMENT.md)** - For developers building packages

pnpm format

### Features

# Run linting

pnpm lint- ✅ Cross-platform (Windows/Linux)

- ✅ Modular frontend selection based on licensing

# Run tests- ✅ System service integration (systemd/scheduled tasks)

pnpm test- ✅ Auto-restart and auto-start on boot

- ✅ SSL/TLS support

# Build all applications- ✅ Comprehensive documentation

pnpm build

```## Contribution checklistnts



### Development`docker-compose.yml` outlines the intended production topology (Traefik, backend, frontends, Postgres). As services mature:



Start individual applications:- Document required environment variables in each app's README and `.env.example`.

- Keep Dockerfiles in sync with the runtime commands shipped in package scripts.

```bash- Run `docker compose up` for local smoke tests once images are available.

# Backend API

pnpm --filter backend dev⚠️ **Security Note**: The included SSL certificates in `traefik/certs/` are self-signed and FOR DEVELOPMENT ONLY. For production deployment, use the on-premise deployment package which supports Let's Encrypt and custom certificates.



# Frontend applications## Project layout

pnpm --filter asset dev      # Asset management

pnpm --filter crm dev        # CRM```

pnpm --filter hrms dev       # HRMS/Aria

pnpm --filter inventory dev  # Inventory├── apps/

```│   ├── backend/            # NestJS API service

│   └── frontend/

## On-Premise Deployment│       ├── asset/          # Asset management frontend

│       ├── CRM/            # Customer management frontend

Aria ERP supports professional on-premise deployment with path-based routing optimized for ~200 concurrent users.│       ├── hrms/           # HR and payroll frontend

│       └── inventory/      # Inventory control frontend

### Creating Deployment Packages├── packages/

│   ├── config-eslint/      # Shared flat ESLint presets (Prettier integrated)

```bash│   ├── config-typescript/  # Shared tsconfig profiles

# Create deployment package│   ├── types/              # Canonical TypeScript contracts

pnpm package│   └── utils/              # Pure, reusable helpers

├── .github/workflows/ci.yml # CI guardrails (lint, test, build)

# Validate package├── docker-compose.yml       # Traefik + service orchestration (future)

pnpm package:test├── README.md                # You are here

```└── AGENTS.md                # Agent charter & governance

```

Output: `dist/aria-erp-v{version}-{platform}.{tar.gz|zip}`

Each app/package keeps a README with day-to-day runbooks and testing roadmaps. Start there for surface-specific guidance.

### Installation

## Prerequisites

**Linux:**

```bash- Node.js 22.x (managed via `nvm`/`nvs` recommended)

tar -xzf aria-erp-v{version}-linux.tar.gz- pnpm 10.x (`corepack enable` or install manually)

cd aria-erp-v{version}- Git and a shell capable of running Turborepo commands

sudo ./bin/load-images.sh- (Optional) Docker + Docker Compose for full-stack orchestration

sudo ./bin/install-linux.sh --modules full

```After cloning the repository, install dependencies once:



**Windows (Administrator):**```bash

```powershellpnpm install

# Extract ZIP, then:```

.\bin\load-images.ps1

.\bin\install-windows.ps1 -Modules "full"## Core commands

```

| Task             | Command                   | Notes                                                                                         |

### Deployment Documentation| ---------------- | ------------------------- | --------------------------------------------------------------------------------------------- |

| Format code      | `pnpm format`             | Runs Prettier across the entire workspace.                                                    |

- **[Deployment Guide](deployment/README.md)** - Complete deployment overview| Check formatting | `pnpm format:check`       | Useful for CI or local verification.                                                          |

- **[Installation](deployment/docs/INSTALLATION.md)** - Step-by-step installation| Lint             | `pnpm lint`               | Executes ESLint with Prettier integration in every package.                                   |

- **[Configuration](deployment/docs/CONFIGURATION.md)** - Configuration options| Test             | `pnpm test`               | Delegates to package-level test suites (Vitest/Jest as they land).                            |

- **[Troubleshooting](deployment/docs/TROUBLESHOOTING.md)** - Common issues| Build            | `pnpm build`              | Runs production builds for backend + all frontends.                                           |

| Dev servers      | `pnpm --filter <app> dev` | Launches an individual frontend (`asset`, `crm`, `hrms`, `inventory`) or backend (`backend`). |

## Development Workflow

Use Turborepo filters to scope commands, e.g. `pnpm --filter asset lint`.

1. **Install dependencies**: `pnpm install`

2. **Start dev server**: `pnpm --filter <app> dev`## Development workflow

3. **Make changes**: Follow TypeScript strict mode and ESLint rules

4. **Format code**: `pnpm format`1. Install dependencies (`pnpm install`).

5. **Run tests**: `pnpm test`2. Start the needed dev server(s) with `pnpm --filter <app> dev`.

6. **Build**: `pnpm build`3. Keep `pnpm lint` and `pnpm test` green while iterating. Prettier errors show up as ESLint violations—run `pnpm format` before committing.

7. **Commit**: Ensure all checks pass before committing4. Update the relevant app/package README with new capabilities or environment variables.

5. Summarize changes against the four agents in your PR description.

## Development Principles

## Agent-aligned expectations

Aria ERP follows four guiding principles documented in [AGENTS.md](./AGENTS.md):

- **Simplicity Advocate**: follow framework generators (`pnpx next`, `pnpx nest g`), avoid bespoke configs, and reuse shared packages.

1. **Simplicity** - Use framework conventions, minimize custom configuration- **Type Safety Guardian**: import contracts from `@aria/types`, extend `@aria/tsconfig`, and keep strict TypeScript settings intact.

2. **Type Safety** - Strict TypeScript, shared type definitions- **Automation Steward**: expose scripts via package `package.json`, keep Turborepo tasks cached, and mirror workflows in CI.

3. **Automation** - Comprehensive scripts, Turborepo caching, CI/CD- **Quality Sentinel**: add or update unit/integration/E2E tests alongside features and enforce accessibility and observability standards.

4. **Quality** - Test coverage, accessibility, observability

Refer to [`AGENTS.md`](./AGENTS.md) for detailed responsibilities, checklists, and cross-agent rituals.

## Testing

## Testing & QA

### Unit & Integration Tests

- Backfill Vitest suites for utilities and React components (packages and frontends).

- **Backend**: Jest (`apps/backend/test/`)- Maintain Jest-based unit and e2e tests in `apps/backend/test`.

- **Frontend**: Vitest (to be configured)- Add Playwright smoke tests per frontend under `apps/frontend/<app>/e2e` (planned).

- **Shared Packages**: Test adjacent to source files- Keep coverage thresholds documented per surface and report failures in CI.



```bash### Docker Testing

# Run all tests

pnpm testComprehensive Docker testing suite for validating builds, deployments, and Next.js 15 static asset handling:



# Run specific package tests```bash

pnpm --filter backend test# Run complete test suite (Windows)

```.\scripts\test-docker-setup.ps1 -Profile full



## CI/CD# Run complete test suite (Linux/Mac)

./scripts/test-docker-setup.sh full

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:

# Verify static assets after deployment

1. Format check (`pnpm format:check`).\scripts\verify-static-assets.ps1

2. Lint (`pnpm lint`)

3. Test (`pnpm test`)# Pre-deployment validation

4. Build (`pnpm build`).\scripts\run-all-tests.ps1

```

## Contributing

**📚 Documentation:**

### Before Opening a PR

- **Quick Start:** [scripts/QUICK_START.md](scripts/QUICK_START.md) - Get testing in 5 minutes

- [ ] Run `pnpm format`- **Comprehensive Guide:** [scripts/DOCKER_TESTING_GUIDE.md](scripts/DOCKER_TESTING_GUIDE.md) - Full testing methodology

- [ ] Run `pnpm lint` (must pass)- **Quick Reference:** [scripts/QUICK_REFERENCE.md](scripts/QUICK_REFERENCE.md) - Command cheat sheet

- [ ] Run `pnpm test` (must pass)- **Implementation Details:** [scripts/TEST_IMPLEMENTATION_SUMMARY.md](scripts/TEST_IMPLEMENTATION_SUMMARY.md) - Technical overview

- [ ] Run `pnpm build` (must pass)

- [ ] Update relevant documentation**Key Features:**

- [ ] Reference applicable development principles in PR description

- ✅ Next.js 15.5.4 static asset verification (critical for path-based routing)

### Code Standards- ✅ Profile-based testing (full, asset, hrms, inventory, crm)

- ✅ Automated SSL certificate generation for testing

- **TypeScript**: Strict mode enabled- ✅ Health check validation for all services

- **Formatting**: Prettier (enforced via ESLint)- ✅ Container log analysis

- **Imports**: Use path aliases (`@aria/types`, `@aria/utils`)- ✅ Cross-platform support (PowerShell + Bash)

- **Testing**: Include tests with new features

- **Documentation**: Update README files as needed## CI & automation



## SecurityGitHub Actions (`.github/workflows/ci.yml`) enforces `pnpm lint`, `pnpm test`, and `pnpm build`. Extend the workflow whenever you add new quality gates (e.g., Playwright, typegen). Turborepo caching accelerates repeated runs—declare task outputs when adding generated artifacts.



⚠️ **Development SSL Certificates**: The certificates in `traefik/certs/` are self-signed for development only. Production deployments should use the on-premise package which supports Let's Encrypt and custom certificates.## Docker & environments



See [SECURITY.md](./SECURITY.md) for security policies and reporting vulnerabilities.`docker-compose.yml` outlines the intended production topology (Traefik, backend, frontends, Postgres). As services mature:



## License- Document required environment variables in each app’s README and `.env.example`.

- Keep Dockerfiles in sync with the runtime commands shipped in package scripts.

Proprietary - All rights reserved- Run `docker compose up` for local smoke tests once images are available.



## Support## Contribution checklist



For deployment issues, see [Troubleshooting Guide](deployment/docs/TROUBLESHOOTING.md).Before opening a pull request:


- [ ] `pnpm format`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Update applicable READMEs and note agent coverage in the PR summary

Staying disciplined with these steps keeps the Aria suite cohesive and production-ready as it grows. Happy building! 👋
