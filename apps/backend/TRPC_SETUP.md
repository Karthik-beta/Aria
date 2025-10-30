# tRPC Backend Configuration - Latest Packages ✅

## Package Versions (All Latest)

- **@trpc/server**: `11.6.0` (latest)
- **zod**: `4.1.12` (latest)
- **@nestjs/common**: `11.0.1` (latest)
- **@nestjs/core**: `11.0.1` (latest)
- **express**: `5.1.0` (latest)

## ✅ Native tRPC v11 Setup (No Third-Party Adapters)

Replaced incompatible `nestjs-trpc@1.6.1` with native tRPC v11 integration following official patterns.

### Setup Complete

1. **tRPC Core** (`src/trpc/`)
   - `trpc.ts` - tRPC instance with context
   - `trpc.context.ts` - Injectable context with PrismaService
   - `trpc.service.ts` - AppRouter composition
   - `trpc.module.ts` - NestJS module

2. **Inventory Router** (`src/apps/inventory/trpc/`)
   - `inventory.router.ts` - Native procedures with Zod v4 schemas
   - Procedures: `listItems` (query), `createItem` (mutation)

3. **Express Adapter** (`src/main.ts`)
   - Mounted at `/trpc` endpoint
   - Uses `@trpc/server/adapters/express`

## Usage Example

### Backend (Router Definition)

```typescript
@Injectable()
export class InventoryRouter {
  constructor(private readonly inventoryService: InventoryService) {}

  getRouter() {
    return router({
      listItems: publicProcedure
        .output(z.array(inventoryItemSchema))
        .query(async () => {
          return this.inventoryService.findAll();
        }),

      createItem: publicProcedure
        .input(createInventoryItemSchema)
        .output(inventoryItemSchema)
        .mutation(async ({ input }) => {
          return this.inventoryService.create(input);
        }),
    });
  }
}
```

### Frontend (Type-Safe Client)

```typescript
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'backend/src/trpc/trpc.service';

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
});

// Fully typed!
const items = await client.inventory.listItems.query();
const newItem = await client.inventory.createItem.mutate({
  name: 'Item',
  sku: 'SKU-001',
  quantity: 10,
});
```

## Benefits

✅ **Latest Packages**: All dependencies up-to-date  
✅ **Type Safety**: End-to-end TypeScript types  
✅ **Native Integration**: No third-party adapters  
✅ **NestJS DI**: Full dependency injection support  
✅ **Zod v4**: Latest validation features  
✅ **Framework Aligned**: Follows NestJS patterns

## Next Steps

1. ✅ Backend tRPC configured
2. ⏳ Run migration: `bun --filter backend exec -- prisma migrate dev --name init`
3. ⏳ Start server: `bun --filter backend start:dev`
4. ⏳ Setup frontend tRPC client in Next.js apps
5. ⏳ Export `AppRouter` type to `@aria/types`

## Testing

```bash
# Lint
bun --filter backend lint

# Test
bun --filter backend test

# Start dev server
bun --filter backend start:dev
```

Server will run at: `http://localhost:3000`  
tRPC endpoint: `http://localhost:3000/trpc`
