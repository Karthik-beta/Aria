# Quick Start Guide: Using tRPC in Frontend

## Prerequisites

- Backend is running: `cd apps/backend && pnpm dev` (port 3000)
- Frontend packages are installed

## Basic Usage

### 1. Simple Query (Fetch Data)

```tsx
'use client';

import { trpc } from '@/lib/trpc';

export function InventoryList() {
  const { data, isLoading, error } = trpc.inventory.listItems.useQuery();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data?.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

### 2. Mutation (Create/Update/Delete)

```tsx
'use client';

import { trpc } from '@/lib/trpc';

export function CreateItemForm() {
  const utils = trpc.useUtils();

  const createItem = trpc.inventory.createItem.useMutation({
    onSuccess: () => {
      // Refetch list after creating
      utils.inventory.listItems.invalidate();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createItem.mutate({
      name: 'New Item',
      quantity: 10,
      price: 99.99,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={createItem.isPending}>
        {createItem.isPending ? 'Creating...' : 'Create Item'}
      </button>
      {createItem.isError && <p>Error: {createItem.error.message}</p>}
    </form>
  );
}
```

### 3. Server-Side Data Fetching

```tsx
import { trpcClient } from '@/lib/trpc';

export default async function ServerPage() {
  // Fetch data server-side
  const items = await trpcClient.inventory.listItems.query();

  return (
    <div>
      <h1>Inventory ({items.length} items)</h1>
      {items.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

## Available Endpoints

Currently configured backend endpoints:

- `trpc.inventory.listItems.useQuery()` - Get all inventory items
- `trpc.inventory.createItem.useMutation()` - Create a new item

## Testing Your Setup

1. **Start the backend:**

   ```bash
   cd apps/backend
   pnpm dev
   ```

2. **Start the frontend:**

   ```bash
   cd apps/frontend
   pnpm dev
   ```

3. **Use the example component:**

   ```tsx
   import { ExampleTRPCUsage } from '@/lib/trpc/example';

   export default function Page() {
     return <ExampleTRPCUsage />;
   }
   ```

## Next Steps

- See `TRPC_SETUP.md` for full documentation
- Check `src/lib/trpc/example.tsx` for more examples
- Open React Query DevTools (bottom-right in dev mode) to inspect queries
