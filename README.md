# Aria ERP

[![CI](https://github.com/Karthik-beta/Aria/actions/workflows/ci.yml/badge.svg)](https://github.com/Karthik-beta/Aria/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3.x-f9f1e1?logo=bun&logoColor=black)](https://bun.sh/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)

> Modern, modular B2B ERP suite built with TypeScript, NestJS, and Next.js

**Try the demo on Windows:** [Download AriaSetup.exe](https://github.com/Karthik-beta/Aria/releases/latest/download/AriaSetup.exe)
(needs [Docker Desktop](https://www.docker.com/products/docker-desktop/); see [Windows installer](./deployment/local/README.md#windows-installer)
and the [Code signing policy](./CODE_SIGNING.md)).

Aria ERP is a full-stack monorepo providing enterprise resource planning capabilities through specialized modules for asset management, customer relations, human resources, and inventory control.

> **Open source** — Aria ERP is free software under the [GNU AGPL v3.0 or later](./LICENSE).

## Quick Links

- **[Getting Started](./docs/01-getting-started/README.md)** — Setup guide for new developers
- **[Documentation Hub](./docs/README.md)** — Complete documentation index
- **[Contributing](./CONTRIBUTING.md)** — How to contribute
- **[Deployment Guide](./docs/05-deployment/README.md)** — Production deployment

## Architecture

| Component       | Location       | Technology                                    |
| --------------- | -------------- | --------------------------------------------- |
| Backend API     | `apps/backend` | NestJS 11, tRPC, Prisma 7, PostgreSQL         |
| Frontend        | `apps/frontend`| Next.js (App Router), React, Tailwind CSS 4   |
| API Contract    | `packages/api-contract` | Type-only tRPC contract layer        |
| Shared Packages | `packages/*`   | TypeScript configs, types, utilities          |
| Deployment      | `deployment/`  | Docker Compose, Caddy v2 (HTTP/3)             |

## Prerequisites

- **Node.js** 20 or 22 (LTS)
- **Bun** 1.3.x or later
- **Git**
- **PostgreSQL** 16+ (or Docker)
- **Docker** 20.10+ (for deployment only)

## Quick Start

```bash
# Clone repository
git clone https://github.com/Karthik-beta/Aria.git
cd Aria

# Install dependencies
bun install

# Start development
bun --filter backend start:dev  # Backend on port 3001
bun --filter frontend dev       # Frontend on port 3000
```

See the [Getting Started Guide](./docs/01-getting-started/README.md) for detailed instructions including database setup.

### Local Docker demo (Windows)

With Docker Desktop running, double-click `aria-local.cmd` (or run `.\aria-local.cmd`).
It downloads the prebuilt images for the checked-out commit (building them only when they
are unavailable) and starts the full stack on `http://localhost:8080` with preloaded settings,
medium-scale demo data and nightly backups. Sign in as `admin` / `admin123`.
Later, `.\aria-local.cmd update` pulls and applies the latest version (rolling back on failure)
and `.\aria-local.cmd uninstall` removes everything. See [deployment/local](./deployment/local/README.md).
For demo laptops without Git, each GitHub Release has `AriaSetup-<version>.exe`, which installs,
updates and uninstalls the same demo ([Windows installer](./deployment/local/README.md#windows-installer)).

## Development Commands

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `bun format`         | Format code with Biome               |
| `bun run lint`       | Run Biome lint/format checks via Turbo |
| `bun run test`       | Run all tests                        |
| `bun run test:e2e`   | Run the monorepo E2E suite           |
| `bun run typecheck`  | Run all TypeScript checks            |
| `bun run build`      | Build all applications               |
| `bun run validate`   | Run all checks (lint + test + typecheck + build) |

> All code quality tooling uses **Biome** for linting and formatting (`biome check` / `biome format`), orchestrated through Turborepo.

## Documentation

### Getting Started

- **[Getting Started Guide](./docs/01-getting-started/README.md)** — Complete setup walkthrough
- **[FAQ](./docs/01-getting-started/01-faq/README.md)** — Common questions and solutions

### Technical Documentation

- **[Architecture Guide](./docs/02-architecture/README.md)** — System design and patterns
- **[Backend Documentation](./docs/03-backend/README.md)** — NestJS, tRPC, and Prisma
- **[Frontend Documentation](./docs/04-frontend/README.md)** — Next.js App Router
- **[Development Agents](./AGENTS.md)** — Development philosophy

### Deployment

- **[Deployment Guide](./docs/05-deployment/README.md)** — Production deployment with Docker and Caddy
- **[Local Docker demo](./deployment/local/README.md)** — One-command Windows/Docker Desktop setup with demo data

### Contributing

- **[Contributing Guide](./docs/06-contributing/README.md)** — Contribution workflow
- **[Dependency Management](./docs/06-contributing/01-dependencies.md)** — Package update process
- **[Admin Console Guide](./docs/06-contributing/admin-console-guide.md)** — Admin UI reference

### Package Documentation

- **[@aria/api-contract](./packages/api-contract/package.json)** — Type-only tRPC contract layer
- **[@aria/types](./packages/types/README.md)** — Shared TypeScript type definitions
- **[@aria/utils](./packages/utils/README.md)** — Shared utility functions
- **[@aria/tsconfig](./packages/config-typescript/README.md)** — TypeScript configuration presets

**Complete documentation**: [docs/README.md](./docs/README.md)

## Contributing

Contributions are welcome. Read the [Contributing Guide](./CONTRIBUTING.md) and the
[Code of Conduct](./CODE_OF_CONDUCT.md) before submitting pull requests.

**Quick checklist before PR:**

- [ ] `bun format` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds
- [ ] Documentation updated

## Resources

- **[Contributing Guide](./CONTRIBUTING.md)** — Development workflow and code standards
- **[Code of Conduct](./CODE_OF_CONDUCT.md)** — Community standards
- **[Security Policy](./SECURITY.md)** — Vulnerability reporting and security practices
- **[Code signing policy](./CODE_SIGNING.md)** — How release installers are signed
- **[Changelog](./CHANGELOG.md)** — Release history and notable changes

## License

Copyright (C) 2024-present Karthik P ([@Karthik-beta](https://github.com/Karthik-beta))

This program is free software: you can redistribute it and/or modify it under the terms
of the GNU Affero General Public License as published by the Free Software Foundation,
either version 3 of the License, or (at your option) any later version. It is distributed
in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](./LICENSE)
for the full text.
