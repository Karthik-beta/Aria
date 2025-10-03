## Aria ERP Monorepo

Aria ERP is a full-stack TypeScript workspace that powers a modular B2B ERP suite. The repository is organized as a pnpm + Turborepo monorepo with a NestJS backend, four Next.js 15 frontends, and shared packages that centralize configuration, types, and utilities. An on-premise deployment toolkit lives under `deployment/` for air-gapped or self-hosted environments.

## Architecture at a Glance

| Surface     | Location                                 | Highlights                                                                 |
| ----------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| Backend     | `apps/backend`                           | NestJS 11 API service generated with the `nest` CLI, Jest unit and e2e tests, strict TypeScript. |
| Frontends   | `apps/frontend/{asset,CRM,hrms,inventory}` | Next.js 15 App Router apps using Turbopack, Tailwind 4, and shared contracts imported from `@aria/types`. |
| Shared libs | `packages/{config-eslint,config-typescript,types,utils}` | Flat ESLint presets, tsconfig bases, canonical DTOs, and pure utilities reused across the suite. |
| Deployment  | `deployment/`                            | Cross-platform Docker-based installer with Traefik path-based routing plus PowerShell/Bash automation. |

## Requirements

- Node.js 20 or 22 (recommended via `corepack enable pnpm`)
- pnpm 10.x
- Docker 20.10+ and Docker Compose 2.0+ (required for deployment tooling)
- Git

## Quick Start

**New to the project?** Check out our [**Getting Started Guide**](./GETTING_STARTED.md) for a complete walkthrough!

```bash
# Install dependencies (run once after clone)
pnpm install

# Start the backend API (NestJS)
pnpm --filter backend start:dev

# Start individual frontends (Next.js 15)
pnpm --filter asset dev
pnpm --filter crm dev
pnpm --filter hrms dev
pnpm --filter inventory dev
```

## Workspace Commands

| Task          | Command             | Notes                                                                 |
| ------------- | ------------------- | --------------------------------------------------------------------- |
| Format        | `pnpm format`       | Runs Prettier via the shared flat ESLint config.                      |
| Lint          | `pnpm lint`         | Executes workspace-wide ESLint with Turborepo caching.                |
| Test          | `pnpm test`         | Runs package-level test suites (Jest/Vitest).                         |
| Build         | `pnpm build`        | Produces production bundles for the backend and all frontends.        |
| Package       | `pnpm package`      | Builds the on-prem deployment artifacts into `deployment/dist`.       |
| Package check | `pnpm package:test` | Validates the generated deployment bundles and path-based routing.    |

> Turborepo caches command outputs. When you add build or test steps, declare their outputs in `turbo.json` to keep incremental runs fast.

## Development Practices

- **Simplicity:** Prefer framework CLIs (Nest generators, Next.js scaffolds) and existing shared packages over bespoke configuration.
- **Types-first:** Import contracts from `@aria/types` and extend `@aria/tsconfig` everywhere to keep the suite consistent.
- **Automation:** Surface new workflows through `package.json` scripts and mirror them in CI (`.github/workflows/ci.yml`).
- **Quality:** Ship tests with each feature and uphold accessibility expectations for UI work.

### Contributing Checklist

Before opening a pull request:

- [ ] `pnpm format`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Update relevant documentation and reference applicable development agents in the PR summary (see `AGENTS.md`).

## Deployment Toolkit

- The on-premise installer, automation scripts, and environment guidance live in `deployment/`.
- Start with `deployment/README.md` for installation prerequisites, walkthroughs, and service management.
- Additional references:
  - `deployment/docs/INSTALLATION.md` — detailed setup instructions.
  - `deployment/docs/TROUBLESHOOTING.md` — common issues and resolutions.
  - `deployment/scripts/` — PowerShell and Bash helpers for build, test, install, and uninstall flows.

## Documentation Map

### For Beginners

- **[Getting Started Guide](./GETTING_STARTED.md)** — Your first steps with Aria ERP
- **[Contributing Guide](./CONTRIBUTING.md)** — How to contribute to the project
- **[FAQ](./FAQ.md)** — Frequently asked questions and troubleshooting

### For Developers

- **[Development Agents](./AGENTS.md)** — Development philosophy and architectural principles
- **[Backend Guide](./apps/backend/README.md)** — NestJS API development
- **[Frontend Guides](./apps/frontend/)** — Next.js web app development
  - [Asset Management](./apps/frontend/asset/README.md)
  - [CRM](./apps/frontend/CRM/README.md)
  - [HRMS](./apps/frontend/hrms/README.md)
  - [Inventory](./apps/frontend/inventory/README.md)

### Shared Packages

- **[@aria/types](./packages/types/README.md)** — Shared TypeScript type definitions
- **[@aria/utils](./packages/utils/README.md)** — Shared utility functions
- **[@aria/eslint-config](./packages/config-eslint/README.md)** — Code style configuration
- **[@aria/tsconfig](./packages/config-typescript/README.md)** — TypeScript configuration

### Deployment & Operations

- **[Deployment Guide](./deployment/README.md)** — On-premise installation
- **[Installation Guide](./deployment/docs/INSTALLATION.md)** — Detailed setup instructions
- **[Configuration Reference](./deployment/docs/CONFIGURATION.md)** — Environment and settings
- **[Troubleshooting Guide](./deployment/docs/TROUBLESHOOTING.md)** — Common issues and solutions

### Security

- **[Security Policy](./SECURITY.md)** — Security guidelines and vulnerability reporting

## Support & Security

- For deployment assistance, review the troubleshooting guide above or the quick reference in `deployment/QUICK_REFERENCE.md`.
- ⚠️ Development SSL certificates in `traefik/certs/` are self-signed and intended only for local use. Production deployments should rely on certificates provisioned by the on-prem package (Let's Encrypt or custom CA).
- Security questions and disclosures should follow the process outlined in `SECURITY.md`.

## License

Proprietary – All rights reserved.
