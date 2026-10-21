# Contributing to Aria ERP

Thanks for your interest in Aria ERP! This guide covers setup, workflow and code standards.

By contributing, you agree that your contributions are licensed under the
[GNU Affero General Public License v3.0 or later](./LICENSE), and you agree to follow the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Development Setup

### Prerequisites

- **Node.js** 20 or 22 (LTS)
- **Bun** 1.3.x or later
- **Git**
- **PostgreSQL** 16+ (or Docker)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/Karthik-beta/Aria.git
cd Aria

# Install dependencies
bun install

# Start development
bun --filter backend start:dev  # Backend on port 3001
bun --filter frontend dev       # Frontend on port 3000
```

For detailed setup instructions, see the [Getting Started Guide](./docs/01-getting-started/README.md).

## Development Workflow

### 1. Create a Branch

Always branch from `master`:

```bash
git checkout master
git pull origin master
git checkout -b <type>/<short-description>
```

**Branch naming convention:**

| Prefix      | Use For                    |
| ----------- | -------------------------- |
| `feature/`  | New features               |
| `fix/`      | Bug fixes                  |
| `docs/`     | Documentation changes      |
| `refactor/` | Code refactoring           |
| `test/`     | Adding or updating tests   |
| `chore/`    | Maintenance and tooling    |

### 2. Make Your Changes

- Follow the [code standards](#code-standards) below
- Write or update tests for your changes
- Update documentation if behavior changes

### 3. Validate Locally

All checks must pass before submitting:

```bash
# Run all validations at once
bun run validate

# Or run individually
bun format            # Format code with Biome
bun run lint          # Lint checks
bun run test          # Unit and integration tests
bun run typecheck     # TypeScript type checking
bun run build         # Production builds
```

### 4. Commit Your Changes

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>: <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

**Examples:**

```
feat: add inventory batch tracking module
fix: resolve date parsing in asset depreciation
docs: update deployment guide for Caddy v2
```

### 5. Push and Open a Pull Request

```bash
git push origin <your-branch>
```

Open a PR on GitHub and fill out the [PR template](./.github/PULL_REQUEST_TEMPLATE.md) completely.

## Code Standards

### TypeScript

- **Strict mode** — no `any` types; use `unknown` when the type is truly unknown
- **Shared types** — import from `@aria/types` for cross-package contracts
- **Shared utilities** — import from `@aria/utils` for pure helper functions
- All apps extend `@aria/tsconfig` configurations

### Backend (NestJS)

- Generate modules, controllers, and services via `bun nest g` CLI
- Feature modules live in `apps/backend/src/modules/<domain>`
- Keep controllers thin — delegate to services for business logic
- Cross-cutting concerns (guards, pipes, interceptors) go in `apps/backend/src/common`

### Frontend (Next.js)

- Use the App Router with route groups (`/asset`, `/crm`, `/hrms`, `/inventory`)
- Server Components by default; add `'use client'` only when hooks or browser APIs are needed
- Tailwind CSS 4 for styling — follow existing patterns

### Formatting and Linting

All code quality tooling uses **Biome** (not ESLint/Prettier):

```bash
bun format       # Auto-format
bun run lint     # Check for issues
bun run lint:fix # Auto-fix issues
```

Install the [Biome VS Code extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) for in-editor feedback.

## Pull Request Guidelines

### Before Submitting

- [ ] `bun format` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds
- [ ] Documentation updated for new features
- [ ] Tests added for new functionality
- [ ] PR description filled out completely

### Review Process

1. Open a PR targeting `master`
2. A maintainer must approve the PR
3. All CI checks must pass
4. Address any requested changes by pushing additional commits
5. The reviewer or author merges once approved

### Keep PRs Focused

- One logical change per PR
- Small PRs are reviewed faster and more thoroughly
- If a change is large, consider splitting it into smaller PRs

## Project Structure

```
Aria/
├── apps/
│   ├── backend/        # NestJS API (tRPC, Prisma)
│   └── frontend/       # Next.js App Router (unified frontend)
├── packages/
│   ├── api-contract/   # Type-only tRPC contract layer
│   ├── config-typescript/  # Shared TypeScript configs
│   ├── types/          # Shared type definitions
│   └── utils/          # Shared utility functions
├── deployment/         # Docker, Caddy, monitoring configs
└── docs/               # Project documentation
```

For detailed architecture information, see the [Architecture Guide](./docs/02-architecture/README.md).

## Getting Help

- **Documentation** — [docs/README.md](./docs/README.md)
- **FAQ** — [docs/01-getting-started/01-faq/README.md](./docs/01-getting-started/01-faq/README.md)
- **GitHub Issues** — [File a bug or feature request](https://github.com/Karthik-beta/Aria/issues)
