# Project Documentation

## Overview

Aria ERP is a modern, modular B2B ERP suite built with TypeScript. It uses a Bun + Turborepo monorepo hosting a NestJS backend and a single Next.js 16 frontend with route groups for each business domain (asset, CRM, HRMS, inventory). Communication between frontend and backend is via tRPC with type-safe contracts.

## Current State

### What's Implemented

| Area | Status | Details |
| --- | --- | --- |
| **Monorepo** | ✅ | Bun workspaces + Turborepo 2.8 |
| **Backend API** | ✅ | NestJS 11 + tRPC 11 |
| **Frontend** | ✅ | Next.js 16 (App Router, Turbopack) |
| **Database** | ✅ | PostgreSQL + Prisma 7 (PrismaPg adapter) |
| **Authentication** | ✅ | better-auth (email/password, session-based) |
| **Authorization** | ✅ | Custom RBAC (roles, permissions, apps) |
| **Inventory Module** | ✅ | Full CRUD — items, warehouses, stock, UoM, categories, brands, suppliers, purchase/sales/transfer orders, reports |
| **Admin Console** | ✅ | User/role/permission management, audit logs |
| **Monitoring** | ✅ | Prometheus + Grafana + cAdvisor + Node Exporter |
| **Deployment** | ✅ | Docker Compose + Caddy v2 reverse proxy |
| **CI/CD** | ✅ | GitHub Actions (lint, test, typecheck, build) |
| **Demo Data** | ✅ | 8 seed files (Pivotr Electronics business context) |
| **Linting/Formatting** | ✅ | Biome 2.4 |
| **Testing** | ✅ | Jest (backend), Vitest (frontend), Playwright (E2E) |

### Planned / In Progress

- **Asset Management Module** — Registration, lifecycle tracking, maintenance scheduling, depreciation
- **CRM Module** — Customer database, lead tracking, sales pipeline, communication history
- **HRMS Module** — Employee management, attendance, leave, payroll
- **Advanced Inventory** — Barcode/QR support, multi-warehouse transfers, stock alerts
- **Report Generation** — PDF/Excel export, dashboard analytics
- **Real-Time Updates** — tRPC WebSocket subscriptions for live data
- **Mobile Support** — Responsive design improvements, PWA considerations

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Bun 1.3.x |
| Build Orchestration | Turborepo 2.8 |
| Backend Framework | NestJS 11 |
| API Layer | tRPC 11 |
| Frontend Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| Database | PostgreSQL 18, Prisma 7 |
| Authentication | better-auth |
| Validation | Zod 4 |
| State Management | Zustand, TanStack React Query |
| Linting/Formatting | Biome 2.4 |
| Testing | Jest, Vitest, Playwright |
| Monitoring | Prometheus, Grafana |
| Reverse Proxy | Caddy v2 |
| Containerization | Docker Compose |

## Changelog

### [Unreleased]

- Complete documentation overhaul
- Demo data system (Pivotr Electronics Pvt Ltd — 8 seed files)
- Inventory module coverage for all CRUD operations and reports

### [0.1.0] - 2025-10-05

- Initial monorepo structure with Bun workspaces and Turborepo
- NestJS backend API service with tRPC
- Single Next.js frontend with route groups
- Shared packages (`@aria/types`, `@aria/utils`, `@aria/api-contract`, `@aria/tsconfig`)
- PostgreSQL integration with Prisma
- better-auth authentication system
- RBAC authorization system
- Docker Compose deployment with Caddy reverse proxy
- Monitoring stack (Prometheus, Grafana, cAdvisor, Node Exporter)
- GitHub Actions CI pipeline
- Development and deployment documentation

## Security

### Secrets Management

- Never commit secrets to Git
- Use environment variables at runtime
- Use Docker secrets or external secrets managers for production

### Container Security

- Official base images with multi-stage builds
- Non-root container users
- Regular vulnerability scanning

### Network Security

- HTTPS via Caddy (automatic TLS in production)
- Security headers (HSTS, CSP, X-Frame-Options)
- Rate limiting on API endpoints

## Development Philosophy

Aria follows a **multi-agent philosophy** to maintain code quality. See [AGENTS.md](../../AGENTS.md) for full details.

1. **Simplicity Advocate** — Use framework CLIs, avoid custom configs, centralize in shared packages
2. **Type Safety Guardian** — All types in `@aria/types`, strict TypeScript, no `any`
3. **Automation Steward** — Scripts via `package.json`, Turborepo caching, CI mirrors local dev
4. **Quality Sentinel** — Tests accompany features, coverage maintained, accessibility enforced
5. **Documentation Scribe** — TSDoc for public APIs, concise inline comments
6. **Code Cleaner** — Remove dead code, resolve lint issues, safe refactors
7. **Official Docs Enforcer** — Always reference authoritative docs before implementing
