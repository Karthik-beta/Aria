# Aria ERP

> Modern, modular B2B ERP suite built with TypeScript, NestJS, and Next.js

Aria ERP is a full-stack monorepo providing enterprise resource planning capabilities through specialized modules for asset management, customer relations, human resources, and inventory control.

## Quick Links

- **[Getting Started](./docs/getting-started.md)** - Setup guide for new developers
- **[Documentation Hub](./docs/README.md)** - Complete documentation index
- **[Contributing](./CONTRIBUTING.md)** - How to contribute
- **[Deployment Guide](./docs/deployment.md)** - Production deployment

## Architecture

| Component       | Location          | Technology                           |
| --------------- | ----------------- | ------------------------------------ |
| Backend API     | `apps/backend`    | NestJS 11, TypeScript                |
| Frontends       | `apps/frontend/*` | Next.js 16, React, Tailwind CSS      |
| Shared Packages | `packages/*`      | TypeScript configs, types, utilities |
| Deployment      | `deployment/`     | Docker Compose, Caddy v2 (HTTP/3)    |

## Prerequisites

- **Node.js** 20 or 22 (LTS)
- **Bun** 1.3.x or later
- **Git**
- **Docker** 20.10+ (for deployment only)

## Quick Start

```bash
# Clone repository
git clone https://github.com/Karthik-beta/Aria.git
cd Aria

# Install dependencies
bun install

# Start development
bun --filter backend start:dev  # Backend (port 3000)
bun --filter frontend dev       # Frontend (port 3001)
```

See [Getting Started Guide](./docs/getting-started.md) for detailed instructions.

## Development Commands

| Command       | Description               |
| ------------- | ------------------------- |
| `bun format`  | Format code with Biome     |
| `bun run lint` | Run Biome lint/format checks via Turbo |
| `bun run test` | Run all tests             |
| `bun run typecheck` | Run all TypeScript checks |
| `bun run build` | Build all applications    |
| `bun package` | Build deployment package  |

> `bun format` and `bun lint` now delegate to Biome (`biome format` / `biome check`) through Turbo, replacing the earlier Prettier + ESLint toolchain.

## Documentation

### Getting Started

- **[Getting Started Guide](./docs/getting-started.md)** - Complete setup walkthrough
- **[FAQ](./docs/faq.md)** - Common questions and solutions
- **[Contributing Guide](./CONTRIBUTING.md)** - Contribution workflow

### Technical Documentation

- **[Architecture Guide](./docs/architecture.md)** - System design and patterns
- **[Development Agents](./AGENTS.md)** - Development philosophy
- **[API Documentation](./apps/backend/README.md)** - Backend API reference

### Deployment

- **[Deployment Guide](./docs/deployment.md)** - Production deployment
- **[Configuration](./deployment/docs/CONFIGURATION.md)** - Environment settings
- **[Troubleshooting](./deployment/docs/TROUBLESHOOTING.md)** - Common issues

### Package Documentation

- **[@aria/types](./packages/types/README.md)** - Shared TypeScript types
- **[@aria/utils](./packages/utils/README.md)** - Utility functions
- **[@aria/eslint-config](./packages/config-eslint/README.md)** - Biome-based linting/formatting rules (replacing the legacy ESLint setup)
- **[@aria/tsconfig](./packages/config-typescript/README.md)** - TypeScript configuration

**Complete documentation**: [docs/README.md](./docs/README.md)

## Project Resources

- **[Roadmap](./ROADMAP.md)** - Future plans and milestones
- **[Changelog](./CHANGELOG.md)** - Version history and release notes
- **[API Documentation](./docs/API.md)** - REST API reference
- **[Support](./SUPPORT.md)** - Get help and support
- **[Code of Conduct](./CODE_OF_CONDUCT.md)** - Community standards

## Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) before submitting pull requests.

**Quick checklist before PR:**

- [ ] `bun format` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds
- [ ] Documentation updated

## Security

Report security vulnerabilities following our [Security Policy](./SECURITY.md).

## License

MIT License - see [LICENSE](./LICENSE) file for details.
