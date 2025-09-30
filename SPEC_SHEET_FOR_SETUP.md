# Project Spec Sheet: B2B ERP Suite

This document outlines the technical specifications, architecture, and setup for the B2B ERP suite. The guiding principle is to keep every component as simple, minimal, and maintainable as possible.

## 1. Guiding Principles

- Simplicity Over Complexity: Choose the simplest tool and pattern that solves the problem effectively.

- Convention Over Configuration: Leverage the defaults and established patterns of latest stable version of frameworks like Next.js, NestJS, and Turborepo. While setting up, do not manually create files; use commands from the official documentation.

- Strongly Typed: Utilize TypeScript across the entire stack to reduce errors and improve developer experience.

- Monorepo, Modular Code: All code resides in a single repository but is organized into independent, modular packages and applications.

## 2. Monorepo Structure

We will use pnpm workspaces for dependency management and Turborepo for high-performance task running.

```
/Aria
├── .github/
│   └── workflows/
│       └── ci.yml          # Basic CI pipeline for linting, testing, and building
├── apps/
│   ├── backend/            # Single NestJS Backend
│   └── frontend/           # Frontend apps grouped in a folder
│       ├── asset/          # Next.js Frontend App 1
│       ├── hrms/           # Next.js Frontend App 2
│       ├── inventory/      # Next.js Frontend App 3
│       └── CRM/            # Next.js Frontend App 4
├── packages/
│   ├── config-eslint/      # Shared ESLint configurations
│   ├── config-typescript/  # Shared tsconfig.json files
│   ├── types/              # Shared types and interfaces
│   └── utils/              # Shared utility functions (e.g., formatters, constants)
├── .dockerignore
├── .eslintrc.js
├── .gitignore
├── .prettierrc
├── AGENTS.md               # Core architectural principles
├── docker-compose.yml      # Deployment configuration
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 3. Core Technologies

| Category        | Technology                         | Reason                                                                   |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Package Manager | pnpm                               | Fast, disk-space efficient, and provides native workspace support.       |
| Monorepo Tool   | Turborepo                          | High-performance build caching and simple task orchestration.            |
| Backend         | NestJS (version 11+)               | Modular, TypeScript-first architecture that scales well.                 |
| Frontend        | Next.js 15+ (React with AppRouter) | Excellent DX, powerful features, and a vast component ecosystem.         |
| Database        | PostgreSQL                         | Robust, reliable, and open-source relational database.                   |
| ORM             | Prisma                             | Type-safe database access and simplified query building.                 |
| Testing (Unit)  | Vitest                             | Fast, modern, and compatible with both backend and frontend.             |
| Testing (E2E)   | Playwright                         | Reliable end-to-end testing with a simple API and powerful features.     |
| Code Formatting | Prettier                           | Enforces a consistent code style across the entire project.              |
| Linting         | ESLint                             | Catches common errors and enforces code quality rules.                   |
| Deployment      | Docker Compose + Traefik           | Simple, container-based deployment with automated SSL via Let's Encrypt. |

## 4. Setup & Configuration Files

Below are the essential configuration files needed to bootstrap the project.

### 4.1. Root Level Configuration

These files will live in the project root and configure the tools for the entire monorepo.

- package.json: Defines workspace scripts and root dependencies.

- pnpm-workspace.yaml: Defines the location of packages within the monorepo.

- turbo.json: Configures the Turborepo task pipeline and caching.

- .prettierrc: Defines formatting rules for Prettier.

- .eslintrc.js: Root ESLint config that delegates to shared packages.

### 4.2. Shared Packages (/packages)

These packages are consumed by the applications to reduce code duplication.

- packages/config-typescript: Contains base tsconfig.json files to be extended by each app and package. This ensures TypeScript consistency.

- packages/config-eslint: Contains base ESLint configurations for Next.js, NestJS, and general Node packages.

- packages/types: The single source of truth for all shared types and interfaces (e.g., API payloads, database models).

- packages/utils: Common, pure functions shared across the stack (e.g., formatDate, calculateVAT).

## 5. Testing Strategy

Testing is critical for stability. The strategy is divided into three layers:

- Unit Tests (Vitest):
  - Backend: Test individual services, controllers, and utility functions in isolation. Use mocking for database and external dependencies.

  - Frontend: Test individual React components (UI and logic) and utility functions.

  - Location: _.test.ts or _.test.tsx files alongside the source code.

- Integration Tests (Vitest + Prisma):
  - Backend: Test the interaction between services and the database. A separate test database will be spun up to run tests against.

  - Location: \*.spec.ts files.

- End-to-End (E2E) Tests (Playwright):
  - Tests the entire application flow from a user's perspective.

  - Simulates user actions like logging in, filling out forms, and verifying data on the screen.

  - Each app (asset-management, hrms) will have its own E2E test suite.

  - Location: A separate /e2e directory inside each frontend app.

## 6. Deployment with Docker Compose & Traefik

The entire stack will be containerized for simple, reproducible on-premise deployments. Traefik will act as a reverse proxy, automatically handling routing and SSL certificate generation/renewal from Let's Encrypt.

### 6.1. Dockerfiles

- A multi-stage Dockerfile will be created for the NestJS backend.

- A separate, multi-stage Dockerfile will be created for each Next.js frontend app. These will be optimized for small image size and performance.

### 6.2. Docker Compose

The docker-compose.yml file will orchestrate all services:

- traefik service: The public-facing entry point. It listens on ports 80 and 443.

- postgres service: The database, with a volume mounted for persistent data storage.

- backend service: The NestJS API. Not exposed publicly. Traefik will route traffic to it based on a hostname rule (e.g., api.yourdomain.com).

- Frontend services (asset-management, hrms, etc.): Each Next.js app runs as its own service. Traefik will route traffic to them based on hostnames (e.g., assets.yourdomain.com, hrms.yourdomain.com).

Environment variables (database credentials, domain names) will be managed via a .env file.

## 7. AGENTS.md

This file defines the core philosophies and "agents" that guide our development decisions. It serves as a high-level technical constitution.
