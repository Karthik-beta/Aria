# Frontend Documentation

Overview of the Aria ERP frontend, built with Next.js, tRPC, and shadcn/ui.

## Overview

The frontend is a single Next.js application using the App Router with route groups for each ERP module. It communicates with the backend exclusively through tRPC.

## Tech Stack

| Concern | Technology |
|---------|-----------|
| Framework | Next.js (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| API Client | tRPC + TanStack Query |
| UI Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS 4 + PostCSS |
| Unit Testing | Vitest + React Testing Library |
| E2E Testing | Playwright |
| Linting | Biome |

## Project Structure

```
apps/frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout (TRPCProvider)
│   │   ├── page.tsx          # Server redirect to the first accessible app
│   │   ├── admin/            # Admin console (users)
│   │   ├── asset/            # Asset management module
│   │   ├── auth/             # Authentication pages
│   │   ├── crm/              # CRM module
│   │   ├── hrms/             # HRMS module
│   │   └── inventory/        # Inventory module
│   ├── components/           # Shared UI components (shadcn/ui)
│   │   └── ui/               # shadcn/ui primitives
│   ├── features/             # Feature-specific components
│   ├── lib/                  # Utilities, tRPC client, auth helpers
│   ├── hooks/                # Custom React hooks
│   └── types/                # Frontend-specific type definitions
├── e2e/                      # Playwright E2E tests
├── test/                     # Vitest test setup
├── public/                   # Static assets
├── vitest.config.ts          # Vitest configuration
└── playwright.config.ts      # Playwright configuration
```

## Modules (Route Groups)

The frontend is organized into modules, each as a route group under `src/app/`:

| Module | Path | Description |
|--------|------|-------------|
| Admin | `/admin` | User management |
| Asset | `/asset` | Asset management and tracking |
| CRM | `/crm` | Customer relationship management |
| HRMS | `/hrms` | Human resources and payroll |
| Inventory | `/inventory` | Inventory control, warehousing, stock transactions |
| Auth | `/auth` | Sign-in, sign-up pages |

Each module has its own layout and pages within the route group.

## Authentication

Protected route groups resolve auth on the server before rendering. Each zone layout calls `requireProtectedAuthState()`, wraps children in `AuthStateProvider`, and lets `useAuth()` read from the hydrated snapshot. The `proxy.ts` layer only preserves callback URLs and short-circuits obviously unauthenticated requests.

See [Frontend Auth Architecture](../frontend-auth-architecture.md) for the full flow.

## tRPC Integration

The frontend communicates with the backend through tRPC, importing the `AppRouter` type from `@aria/api-contract`.

### Client Setup

The tRPC client and providers are set up in `src/lib/`:

- **Client creation** — Creates the tRPC client pointing at the backend
- **Provider** — Wraps the app with tRPC + TanStack Query providers

### Usage

```typescript
// Queries (data fetching)
const { data } = trpc.inventory.listItems.useQuery({ page: 1, pageSize: 20 });

// Mutations (create/update/delete)
const createItem = trpc.inventory.createItem.useMutation();
await createItem.mutateAsync({ name: 'Widget', code: 'WDG-001' });

// Subscriptions (real-time via WebSocket)
trpc.inventory.onStockUpdate.useSubscription(undefined, {
  onData: (update) => { /* handle real-time stock update */ }
});
```

## UI Components

UI components are built with **shadcn/ui** (Radix UI primitives + Tailwind CSS). Components live within the frontend app at `src/components/ui/`.

### Adding New shadcn/ui Components

```bash
cd apps/frontend
bunx --bun shadcn@latest add <component-name>
```

This generates the component in `src/components/ui/`.

### Conventions

- Use the `cn()` utility for conditional Tailwind classes
- Prefer shadcn/ui components over custom implementations
- Icons from `lucide-react`

## Testing

### E2E Tests (Playwright)

E2E tests are in the `e2e/` directory. They simulate user interactions:

```bash
# Run E2E tests
bun run test:e2e

# Run with UI mode
bunx playwright test --ui

# Run specific test
bunx playwright test e2e/inventory.spec.ts
```

### Unit Tests (Vitest)

Unit tests are co-located with source or in the `test/` directory:

```bash
# Run unit tests
bun --filter frontend test

# Run in watch mode
bun --filter frontend test -- --watch
```

## Best Practices

### Next.js

- **Server Components by default** — Only add `'use client'` when hooks or browser APIs are needed
- **App Router** for all routes — No Pages Router
- **Turbopack** for development builds — Do not eject or configure webpack

### tRPC

- **Use Zod schemas** from `@aria/types` for input validation
- **TanStack Query** handles caching and refetching automatically
- **Optimistic updates** for better UX on mutations

### Styling

- **Tailwind CSS 4** with PostCSS
- **Dark mode** supported via CSS variables and theme toggling
- **Responsive design** with mobile-first approach
