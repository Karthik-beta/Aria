# Multi-App NestJS Architecture with tRPC + Prisma

## Overview

This document outlines the architecture for a single NestJS backend serving multiple applications using tRPC and Prisma.

## Directory Structure

```
apps/backend/src/
├── main.ts
├── app.module.ts                 # Root application module
├── shared/                       # Shared utilities and services
│   ├── database/
│   │   ├── database.module.ts   # Database configuration
│   │   └── prisma.service.ts    # Prisma client service
│   ├── config/
│   │   ├── config.module.ts     # Configuration management
│   │   └── validation.schema.ts # Environment validation
│   └── common/
│       ├── interceptors/
│       ├── guards/
│       ├── decorators/
│       └── pipes/
├── apps/                        # Application-specific modules
│   ├── web-app/
│   │   ├── web-app.module.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   └── trpc/
│   │       ├── web-app.router.ts
│   │       └── procedures/
│   ├── mobile-app/
│   │   ├── mobile-app.module.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   └── trpc/
│   │       ├── mobile-app.router.ts
│   │       └── procedures/
│   └── admin-app/
│       ├── admin-app.module.ts
│       ├── controllers/
│       ├── services/
│       └── trpc/
│           ├── admin-app.router.ts
│           └── procedures/
├── domains/                     # Domain-specific business logic
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   └── strategies/
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   └── entities/
│   └── notifications/
│       ├── notifications.module.ts
│       ├── notifications.service.ts
│       └── notifications.controller.ts
└── trpc/
    ├── trpc.module.ts           # Global tRPC configuration
    ├── trpc.service.ts          # tRPC context and router setup
    ├── app.router.ts            # Main tRPC router
    └── middleware/
        ├── auth.middleware.ts
        └── logging.middleware.ts
```

## Key Principles

### 1. **Domain-Driven Design**
- Business logic organized by domain (auth, users, notifications)
- Each domain is self-contained with its own module, service, and controller
- Domains are reusable across different apps

### 2. **Application-Specific Modules**
- Each app (web, mobile, admin) has its own module
- App-specific business logic and tRPC routers
- Different authentication strategies per app if needed

### 3. **Shared Infrastructure**
- Database, configuration, and common utilities shared across all apps
- Single Prisma client instance
- Centralized logging and monitoring

### 4. **tRPC Integration**
- Each app has its own tRPC router
- Main router combines all app routers
- Shared procedures and middleware

## Implementation Details

### Database Layer (Prisma)
- Single Prisma schema for all apps
- Shared database service
- Multi-tenancy support if needed

### Authentication
- JWT-based authentication
- Different strategies per app (web sessions, mobile JWT, admin OAuth)
- Shared auth service with app-specific configurations

### API Structure
- `/api/web/*` - Web app endpoints
- `/api/mobile/*` - Mobile app endpoints  
- `/api/admin/*` - Admin app endpoints
- `/trpc` - tRPC endpoint with app-specific routers

### Environment Management
- Separate environment variables for each app context
- Shared database and infrastructure configs
- App-specific feature flags

## Benefits

1. **Code Reuse**: Shared business logic across apps
2. **Scalability**: Easy to add new apps without duplicating infrastructure
3. **Maintainability**: Clear separation of concerns
4. **Type Safety**: Full-stack type safety with tRPC
5. **Performance**: Single database connection pool
6. **Deployment**: Single backend deployment serving multiple frontends