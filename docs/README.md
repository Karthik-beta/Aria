# Aria ERP Documentation

Welcome to the Aria ERP documentation hub. This guide will help you find the right information quickly.

> The [project wiki](https://github.com/Karthik-beta/Aria/wiki) is the short overview. Its pages live in [`wiki/`](./wiki/) and are published by the Wiki Sync workflow on merge to `master`, so edit them here rather than in the wiki's web editor.

## Documentation Structure

### Getting Started

**New to Aria ERP?** Start here:

- **[Getting Started Guide](./01-getting-started/README.md)** — Complete setup walkthrough for beginners
- **[FAQ](./01-getting-started/01-faq/README.md)** — Common questions and troubleshooting

### Architecture & Design

- **[Architecture Guide](./02-architecture/README.md)** — System design and technical overview
- **[Authentication](./02-architecture/01-authentication/README.md)** — better-auth integration and server-protected layouts
- **[Frontend Auth Architecture](./frontend-auth-architecture.md)** — server-first protected layouts and hydrated auth state
- **[Authorization](./02-architecture/02-authorization/README.md)** — flat role model via better-auth admin plugin
- **[Development Agents](../AGENTS.md)** — Development philosophy and best practices

### Backend

- **[Backend Overview](./03-backend/README.md)** — NestJS, tRPC, and Prisma
- **[tRPC API](./03-backend/01-api/README.md)** — tRPC routers and procedures
- **[Prisma & Migrations](./03-backend/02-prisma/README.md)** — Database schema and migrations

### Frontend

- **[Frontend Overview](./04-frontend/README.md)** — Next.js App Router with route groups
- **[Testing](./04-frontend/01-testing/README.md)** — Vitest and Playwright test suites

### Deployment & Operations

- **[Deployment Guide](./05-deployment/README.md)** — Docker Compose, Caddy, and monitoring

### Contributing

- **[Contributing Guide](./06-contributing/README.md)** — How to contribute code and documentation
- **[Dependency Management](./06-contributing/01-dependencies.md)** — Package update process
- **[Admin Console Guide](./06-contributing/admin-console-guide.md)** — Admin UI reference

### Project

- **[Project Overview](./07-project/README.md)** — Roadmap, changelog, and development philosophy

### Package Documentation

- **[@aria/api-contract](../packages/api-contract/package.json)** — Type-only tRPC contract layer
- **[@aria/types](../packages/types/README.md)** — TypeScript type definitions
- **[@aria/utils](../packages/utils/README.md)** — Utility functions
- **[@aria/tsconfig](../packages/config-typescript/README.md)** — TypeScript configuration

### Application Documentation

- **[Backend (NestJS)](../apps/backend/README.md)** — API server documentation
- **[Frontend (Next.js)](../apps/frontend/README.md)** — Unified application with route groups for Asset, CRM, HRMS, and Inventory modules

## Quick Navigation

### I want to...

- **Set up the project for the first time** → [Getting Started](./01-getting-started/README.md)
- **Understand the architecture** → [Architecture Guide](./02-architecture/README.md)
- **Learn how the API works** → [tRPC API](./03-backend/01-api/README.md)
- **Contribute code** → [Contributing Guide](./06-contributing/README.md)
- **Deploy to production** → [Deployment Guide](./05-deployment/README.md)
- **Fix a problem** → [FAQ](./01-getting-started/01-faq/README.md)

## External Resources

- **NestJS Documentation** — https://docs.nestjs.com/
- **Next.js Documentation** — https://nextjs.org/docs
- **tRPC Documentation** — https://trpc.io/docs
- **Prisma Documentation** — https://www.prisma.io/docs
- **Biome Documentation** — https://biomejs.dev/
- **Bun Documentation** — https://bun.sh/docs
- **Turborepo Documentation** — https://turbo.build/repo/docs
- **better-auth Documentation** — https://www.better-auth.com/docs

## Getting Help

1. **Check the FAQ** — Most common questions are answered in [FAQ](./01-getting-started/01-faq/README.md)
2. **Search the docs** — Use your browser's search (Ctrl+F / Cmd+F)
3. **Review existing issues** — Check GitHub issues for similar problems
4. **Ask questions** — Open a GitHub issue with the `question` label
