# Aria ERP

[![CI](https://github.com/Karthik-beta/Aria/actions/workflows/ci.yml/badge.svg)](https://github.com/Karthik-beta/Aria/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3.x-f9f1e1?logo=bun&logoColor=black)](https://bun.sh/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org/)

> Modern, modular B2B ERP suite built with TypeScript, NestJS, and Next.js

Aria ERP is a full-stack monorepo providing enterprise resource planning capabilities through specialized modules for asset management, customer relations, human resources, and inventory control.

> **Proprietary Software** — This repository contains confidential intellectual property of Pivotr. See [LICENSE](./LICENSE) for details.

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

All team members should read the [Contributing Guide](./CONTRIBUTING.md) before submitting pull requests.

**Quick checklist before PR:**

- [ ] `bun format` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds
- [ ] Documentation updated

## Resources

- **[Contributing Guide](./CONTRIBUTING.md)** — Internal development workflow and code standards
- **[Security Policy](./SECURITY.md)** — Vulnerability reporting and security practices
- **[Changelog](./CHANGELOG.md)** — Release history and notable changes

## License

Proprietary — All rights reserved. See [LICENSE](./LICENSE) for details.

Copyright (c) 2024-present Pivotr
