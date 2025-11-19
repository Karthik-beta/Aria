# Frontend Documentation

This document provides a comprehensive overview of the Aria ERP frontend, built with Next.js, tRPC, and shadcn/ui.

## Overview

The frontend is a single Next.js application that contains all the different modules of the ERP, each in its own route group.

## Tech Stack

- **Framework**: Next.js
- **Language**: TypeScript
- **API**: tRPC
- **UI**: shadcn/ui, Radix UI, Tailwind CSS
- **Testing**: Playwright for E2E tests, Vitest for unit tests

## Project Structure

```
apps/frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── asset/
│   │   ├── crm/
│   │   ├── hrms/
│   │   └── inventory/
│   ├── components/
│   ├── features/
│   ├── lib/
│   ├── hooks/
│   └── types/
├── tests/
└── playwright.config.ts
```

- **`app/`**: Contains all the routes of the application, organized by module.
- **`components/`**: Contains shared UI components.
- **`features/`**: Contains components that are specific to a feature.
- **`lib/`**: Contains utility functions and configurations.
- **`hooks/`**: Contains custom React hooks.
- **`types/`**: Contains TypeScript type definitions.
- **`tests/`**: Contains E2E tests.

## Modules

The frontend is organized into modules, each in its own route group.

- **Asset Management**: `/asset`
- **CRM**: `/crm`
- **HRMS**: `/hrms`
- **Inventory**: `/inventory`

Each module has its own layout and pages.

## API

The frontend communicates with the backend using tRPC. This allows for type-safe API calls without the need for code generation.

### tRPC Setup

The tRPC setup is located in `src/lib/trpc`.

- **`client.ts`**: Creates the tRPC client and React hooks.
- **`provider.tsx`**: Wraps the application with the tRPC and TanStack Query providers.

### Using tRPC

- **Queries**: Use the `useQuery` hook to fetch data.
- **Mutations**: Use the `useMutation` hook to create, update, or delete data.
- **Subscriptions**: Use the `useSubscription` hook to listen for real-time updates.

## UI

The UI is built with shadcn/ui, a collection of reusable components built with Radix UI and Tailwind CSS.

### Shared UI Package

All shadcn/ui components are centralized in the `packages/ui` directory and exported as the `@aria/ui` package.

### Adding New Components

New components can be added to the `@aria/ui` package using the shadcn/ui CLI.

```bash
cd packages/ui
pnpx shadcn@latest add <component-name>
```

## Testing

The frontend has a comprehensive testing setup, with Playwright for E2E tests and Vitest for unit tests.

### E2E Tests

E2E tests are located in the `tests/` directory. They use Playwright to simulate user interactions with the application.

To run the E2E tests:

```bash
pnpm test:e2e
```

### Unit Tests

Unit tests are located next to the code they are testing. They use Vitest and React Testing Library to test individual components and hooks.

To run the unit tests:

```bash
pnpm test
```

## Best Practices

### Next.js

- **Use the App Router** for all new pages.
- **Use Server Components by default**. Only use Client Components when necessary.
- **Organize files by feature**.
- **Use a scalable folder structure**.

### tRPC

- **Use Zod** to validate input data.
- **Keep routers modular**.
- **Use context** to pass data between middleware and procedures.

### UI

- **Use the shared UI package** for all UI components.
- **Don't create custom UI components** when a shadcn/ui component is available.
- **Use the `cn()` utility** for conditional classes.

### Testing

- **Write E2E tests** for all critical user flows.
- **Write unit tests** for complex components and hooks.
- **Use user-facing locators** in E2E tests.
- **Test user behavior, not implementation details**.
