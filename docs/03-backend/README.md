# Backend Documentation

This document provides a comprehensive overview of the Aria ERP backend, built with NestJS, Prisma, and tRPC.

## Overview

The backend is a monolithic application responsible for:

- Business logic
- Database access
- API for the frontend

## Tech Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **API**: tRPC
- **ORM**: Prisma
- **Database**: PostgreSQL

## Project Structure

```
apps/backend/
├── src/
│   ├── modules/          # Feature modules (users, products, etc.)
│   ├── common/           # Shared pipes, guards, interceptors
│   ├── app.module.ts     # Root module
│   └── main.ts           # Application entry point
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
└── test/                 # Integration tests
```

## Modules

The backend is organized into modules, each responsible for a specific feature.

- **`AuthModule`**: Handles authentication and authorization.
- **`UsersModule`**: Manages users.
- **`InventoryModule`**: Manages inventory items.
- ...and so on.

Each module typically contains:

- A **controller** to handle incoming requests.
- A **service** to handle business logic.
- A **module file** to tie everything together.

## API

The backend exposes a tRPC API. tRPC allows for type-safe API calls from the frontend, without the need for code generation.

### tRPC Setup

The tRPC setup is located in `src/trpc`.

- **`trpc.ts`**: Defines the tRPC instance and procedures.
- **`trpc.context.ts`**: Defines the context for tRPC procedures.
- **`trpc.service.ts`**: The main tRPC router, which combines all other routers.
- **`trpc.module.ts`**: The NestJS module for tRPC.

### Adding a new tRPC router

1.  Create a new router in the module's directory (e.g., `src/modules/users/users.router.ts`).
2.  Define the router's procedures.
3.  Add the router to the main tRPC router in `src/trpc/trpc.service.ts`.

## Database

The backend uses Prisma to interact with the PostgreSQL database.

### Schema

The database schema is defined in `prisma/schema.prisma`. This file is the single source of truth for the database schema.

### Migrations

Database migrations are managed with `prisma migrate`.

- **Development**: Use `prisma migrate dev` to create and apply migrations.
- **Production**: Use `prisma migrate deploy` to apply existing migrations.

Migrations are automatically run when the backend starts in a production environment.

### Seeding

The database can be seeded with initial data using the `prisma/seed.ts` file.

## Production Build

To create a production build of the backend, run:

```bash
bun --filter backend build
```

This will create a `dist` directory with the compiled JavaScript code.

## Best Practices

### NestJS

- **Use the NestJS CLI** to generate new modules, controllers, and services.
- **Keep controllers thin**. They should only be responsible for handling requests and returning responses.
- **Put business logic in services**.
- **Use DTOs** (Data Transfer Objects) to validate incoming data.
- **Use dependency injection** to manage dependencies between services.

### Prisma

- **Treat `schema.prisma` as the single source of truth** for the database schema.
- **Always use migrations** to make changes to the database schema.
- **Use the Prisma Client** for all database queries.
- **Use transactions** for operations that need to be atomic.

### tRPC

- **Use Zod** to validate input data.
- **Keep routers modular** by splitting them into multiple files.
- **Use context** to pass data between middleware and procedures.
