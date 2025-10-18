# tRPC + TanStack Query Frontend Setup ✅

## Installed Packages (Latest Stable)

- **@trpc/client**: `^11.6.0` - tRPC client for making API calls
- **@trpc/server**: `^11.6.0` - tRPC server types (for AppRouter type import)
- **@trpc/react-query**: `^11.6.0` - React Query integration for tRPC
- **@tanstack/react-query**: `^5.90.5` - TanStack Query for data fetching
- **@tanstack/react-query-devtools**: `^5.90.2` (dev) - React Query DevTools

All packages are using the **latest stable versions** as of installation.

## Setup Complete ✅

### 1. tRPC Client Configuration (`src/lib/trpc/`)

```
src/lib/trpc/
├── client.ts       # tRPC client instance and React hooks
├── provider.tsx    # TanStack Query and tRPC provider
├── index.ts        # Barrel exports for clean imports
└── example.tsx     # Example usage component
```

### 2. Files Created

#### `src/lib/trpc/client.ts`

- Creates type-safe tRPC React hooks from backend `AppRouter`
- Exports `trpc` for React components
- Exports `trpcClient` for server-side or non-React usage
- Configures base URL for development (localhost:3000)

#### `src/lib/trpc/provider.tsx`

- Wraps app with TanStack Query and tRPC providers
- Configures QueryClient with sensible defaults (1-minute stale time)
- Includes React Query DevTools in development mode
- Uses `httpBatchLink` for efficient request batching

#### `src/lib/trpc/example.tsx`

- Demonstrates query and mutation usage
- Shows error and loading states
- Fully type-safe with autocomplete

### 3. Root Layout Integration

The `TRPCProvider` has been added to `src/app/layout.tsx`:

```tsx
import { TRPCProvider } from '@/lib/trpc';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>
          {/* Other providers */}
          {children}
        </TRPCProvider>
      </body>
    </html>
  );
}
```

## Usage Guide

### In Client Components

```tsx
'use client';

import { trpc } from '@/lib/trpc';

export function MyComponent() {
  // Query - fetches data automatically
  const { data, isLoading, error } = trpc.inventory.listItems.useQuery();

  // Mutation - call manually
  const createItem = trpc.inventory.createItem.useMutation({
    onSuccess: () => {
      console.log('Success!');
    },
  });

  const handleCreate = () => {
    createItem.mutate({
      name: 'New Item',
      quantity: 10,
      price: 99.99,
    });
  };

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {data && data.map((item) => <div key={item.id}>{item.name}</div>)}
      <button onClick={handleCreate}>Create Item</button>
    </div>
  );
}
```

### In Server Components

```tsx
import { trpcClient } from '@/lib/trpc';

export default async function ServerPage() {
  // Use vanilla client for server-side data fetching
  const items = await trpcClient.inventory.listItems.query();

  return (
    <div>
      {items.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

### Advanced: Query Invalidation

```tsx
'use client';

import { trpc } from '@/lib/trpc';

export function MyComponent() {
  const utils = trpc.useUtils();

  const createItem = trpc.inventory.createItem.useMutation({
    onSuccess: () => {
      // Invalidate and refetch inventory list
      utils.inventory.listItems.invalidate();
    },
  });

  return <button onClick={() => createItem.mutate(...)}>Create</button>;
}
```

### Advanced: Optimistic Updates

```tsx
'use client';

import { trpc } from '@/lib/trpc';

export function MyComponent() {
  const utils = trpc.useUtils();

  const createItem = trpc.inventory.createItem.useMutation({
    onMutate: async (newItem) => {
      // Cancel outgoing refetches
      await utils.inventory.listItems.cancel();

      // Snapshot previous value
      const previousItems = utils.inventory.listItems.getData();

      // Optimistically update
      utils.inventory.listItems.setData(undefined, (old) =>
        old ? [...old, { ...newItem, id: 'temp-id' }] : [{ ...newItem, id: 'temp-id' }]
      );

      return { previousItems };
    },
    onError: (err, newItem, context) => {
      // Rollback on error
      utils.inventory.listItems.setData(undefined, context?.previousItems);
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.inventory.listItems.invalidate();
    },
  });

  return <button onClick={() => createItem.mutate(...)}>Create</button>;
}
```

## Type Safety

All tRPC calls are **fully type-safe** because they import the `AppRouter` type from the backend:

```tsx
import type { AppRouter } from '../../../../backend/src/trpc/trpc.service';
```

This means:

- ✅ Autocomplete for all procedures
- ✅ Type errors if you pass wrong input
- ✅ IntelliSense for response data
- ✅ Compile-time safety for API changes

## Backend Connection

The frontend connects to the backend tRPC endpoint at:

- Development: `http://localhost:3000/trpc`
- Production: Configured via environment variables

The backend already has:

- ✅ tRPC server setup (`@trpc/server@^11.6.0`)
- ✅ Express adapter mounted at `/trpc`
- ✅ Inventory router with `listItems` and `createItem` procedures
- ✅ Zod schemas for input validation

## TanStack Query Features

### Automatic Features

- ✅ Request batching (multiple queries in one HTTP request)
- ✅ Automatic refetching on window focus (disabled by default)
- ✅ Request deduplication
- ✅ Background refetching
- ✅ Garbage collection
- ✅ Retry logic

### DevTools

In development mode, open the React Query DevTools by clicking the icon in the bottom-right corner. This shows:

- Active queries and their states
- Query cache
- Mutation history
- Performance metrics

## Environment Configuration

To customize the backend URL, create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Then update `src/lib/trpc/client.ts` and `src/lib/trpc/provider.tsx`:

```tsx
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || '';
  }
  return process.env.API_URL || `http://localhost:${process.env.PORT ?? 3000}`;
}
```

## Authentication (Future)

To add authentication headers to all tRPC requests:

```tsx
// In provider.tsx
httpBatchLink({
  url: `${getBaseUrl()}/trpc`,
  headers() {
    return {
      authorization: `Bearer ${getAuthToken()}`,
    };
  },
});
```

## Testing

### Unit Testing with tRPC

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils';

test('fetches inventory items', async () => {
  const { result } = renderHook(() => trpc.inventory.listItems.useQuery(), {
    wrapper: createWrapper(),
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(3);
});
```

## Next Steps

1. **Add Error Boundaries**: Wrap components with error boundaries to catch tRPC errors
2. **Add Loading States**: Create reusable loading components
3. **Implement Authentication**: Add auth headers to tRPC requests
4. **Add More Routers**: Extend backend with more tRPC routers for different modules
5. **Setup React Query Persistence**: Persist cache to localStorage for offline support

## Resources

- [tRPC Documentation](https://trpc.io/docs)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Next.js with tRPC](https://trpc.io/docs/client/nextjs)
- [Backend Setup](../../../backend/TRPC_SETUP.md)

## Troubleshooting

### Type Import Errors

If you see type errors about `AppRouter`, ensure:

1. Backend is built: `cd apps/backend && pnpm build`
2. Backend types are up to date
3. Restart TypeScript server in VS Code

### Connection Errors

If you see network errors:

1. Ensure backend is running: `cd apps/backend && pnpm dev`
2. Check backend is on port 3000
3. Verify `/trpc` endpoint is accessible

### React Query Not Working

If queries aren't running:

1. Ensure `TRPCProvider` is wrapping your app
2. Check component is using `'use client'` directive
3. Verify backend router is properly exported
