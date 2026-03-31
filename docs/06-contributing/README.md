# Contributing to Aria ERP

Thank you for your interest in contributing to Aria ERP! This guide will help you make your first contribution.

## Getting Started

### Prerequisites

Before you begin, make sure you've completed the [Getting Started Guide](../01-getting-started/README.md).

### Finding Something to Work On

1. **Check open issues** — Look for issues labeled `good-first-issue` or `help-wanted`
2. **Review the roadmap** — Check the [Project Overview](../07-project/README.md) for planned features
3. **Fix bugs** — Bug fixes are always welcome
4. **Improve documentation** — Documentation improvements are highly valued

## Development Workflow

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR-USERNAME/Aria.git
cd Aria
git remote add upstream https://github.com/Karthik-beta/Aria.git
```

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

**Branch Naming Convention:**

- `feature/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation changes
- `refactor/` — Code refactoring
- `test/` — Adding or updating tests

### 3. Make Your Changes

Follow the [Code Standards](#code-standards) below.

### 4. Validate Your Changes

```bash
# Format code (Biome)
bun format

# Lint (Biome via Turbo)
bun run lint

# Run tests
bun run test

# Type-check
bun run typecheck

# Build
bun run build

# Or run all validations at once
bun run validate
```

All checks must pass before submitting.

### 5. Commit Your Changes

```bash
git add .
git commit -m "feat: add user authentication module"
```

**Commit Message Format:**

```
<type>: <description>

[optional body]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### 6. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Code Standards

### TypeScript

**Use strict typing:**

```typescript
// Good
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Bad — never use `any`
function calculateTotal(items: any): any { /* ... */ }
```

**Import from shared packages:**

```typescript
import type { Inventory } from '@aria/types';
import { paginate } from '@aria/utils';
```

### React / Next.js

**Server Components by default:**

```tsx
// Server Component (default — no directive needed)
export default function UserList({ users }: { users: User[] }) {
  return <div>{users.map(u => <div key={u.id}>{u.name}</div>)}</div>;
}

// Client Component — only when hooks/browser APIs are needed
'use client';
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Formatting & Linting

All code quality tooling uses **Biome** (not ESLint/Prettier):

```bash
# Format
bun format

# Lint
bun run lint
```

Install the **Biome VS Code extension** for in-editor feedback.

## PR Checklist

Before submitting:

- [ ] `bun format` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds
- [ ] Documentation updated for new features
- [ ] Tests added for new functionality
