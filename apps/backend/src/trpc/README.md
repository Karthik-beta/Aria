# tRPC Backend Setup

## Architecture

- **tRPC v11** with native NestJS integration
- **Zod v4** for runtime validation
- **Prisma** for database access

## Structure

```
src/
├── trpc/
│   ├── trpc.ts              # tRPC instance & procedures
│   ├── trpc.context.ts      # Context with Prisma service
│   ├── trpc.service.ts      # AppRouter composition
│   └── trpc.module.ts       # NestJS module
├── apps/
│   └── inventory/
│       ├── inventory.service.ts
│       ├── inventory.module.ts
│       └── trpc/
│           └── inventory.router.ts  # Inventory procedures
```

## Endpoints

**Base URL**: `http://localhost:3000/trpc`

### Inventory Routes

- `inventory.listItems` - Query: List all items
- `inventory.createItem` - Mutation: Create new item

## Adding New Routes

1. Create router class in `apps/<domain>/trpc/<domain>.router.ts`
2. Define procedures using `publicProcedure` from `trpc/trpc.ts`
3. Export router in domain module
4. Register in `trpc/trpc.service.ts`

Example:

```typescript
@Injectable()
export class MyRouter {
  getRouter() {
    return router({
      myQuery: publicProcedure.query(() => { ... }),
    });
  }
}
```

## Type Safety

The `AppRouter` type is exported from `trpc.service.ts` for frontend consumption.
