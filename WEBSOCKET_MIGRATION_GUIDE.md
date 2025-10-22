# WebSocket Migration Guide

## For Developers: What Changed?

### Backend Developers

#### Before (SSE-based subscriptions)
```typescript
// Subscriptions worked via Server-Sent Events (SSE)
// over the same HTTP endpoint as queries/mutations
```

#### After (WebSocket-based subscriptions)
```typescript
// Subscriptions now work via WebSocket protocol
// Endpoint: ws://localhost:3001/trpc-ws
```

**No code changes required in your subscription definitions!**

Your existing subscriptions like `onItemsChanged`, `onItemCreated`, etc., work exactly the same. The transport layer change is transparent.

### Frontend Developers

#### Before (httpSubscriptionLink)
```typescript
// Subscriptions used HTTP SSE
import { httpSubscriptionLink } from '@trpc/client';

links: [
  splitLink({
    condition: (op) => op.type === 'subscription',
    true: httpSubscriptionLink({ url: `${getBaseUrl()}/trpc` }),
    false: httpBatchLink({ url: `${getBaseUrl()}/trpc` }),
  }),
]
```

#### After (wsLink)
```typescript
// Subscriptions now use WebSocket
import { wsLink, createWSClient } from '@trpc/client';

const wsClient = createWSClient({
  url: getWsUrl(),
  WebSocket: getWebSocketImpl(),
  keepAlive: { enabled: true, intervalMs: 25000 },
});

links: [
  splitLink({
    condition: (op) => op.type === 'subscription',
    true: wsLink({ client: wsClient }),
    false: httpBatchLink({ url: `${getBaseUrl()}/trpc` }),
  }),
]
```

**No code changes required in components using subscriptions!**

Your existing `useSubscription` hooks work the same:

```typescript
// This code didn't change at all
trpc.inventory.onItemsChanged.useSubscription(undefined, {
  onData(event) {
    // Handle real-time updates
  },
});
```

## Running the Application

No changes to your development workflow:

```bash
# Backend (same command as before)
pnpm --filter backend dev

# Frontend (same command as before)
pnpm --filter frontend dev
```

## Verifying It Works

### 1. Check Browser DevTools
- Open DevTools → Network tab → WS filter
- You should see a WebSocket connection to `/trpc-ws`
- Status: 101 Switching Protocols (green indicator)

### 2. Look for These Logs

**Backend Console:**
```
tRPC WebSocket endpoint: ws://localhost:3001/trpc-ws
[Inventory] New subscription to onItemsChanged
```

**Browser Console:**
```
Real-time event: created/updated/deleted
```

## Troubleshooting

### "WebSocket connection failed"
- **Cause**: Backend not running or wrong URL
- **Fix**: Start backend with `pnpm --filter backend dev`

### Subscriptions not updating UI
- **Cause**: Subscription not active or component unmounted
- **Fix**: Verify component is mounted and `useSubscription` is called

### Connection drops after 30 seconds
- **Cause**: KeepAlive not working
- **Fix**: This shouldn't happen with our config. Check backend logs.

## What's Better Now?

### Before (SSE)
- ⚠️ Reconnects frequently on some browsers
- ⚠️ One-way communication only (server → client)
- ⚠️ More overhead per connection

### After (WebSocket)
- ✅ Stable, long-lived connections
- ✅ Bidirectional (ready for future features)
- ✅ Lower overhead, more efficient
- ✅ Industry standard for real-time apps

## Breaking Changes

**None!** This is a drop-in replacement. All existing code continues to work.

## Optional: Clean Up

You can now remove the `httpSubscriptionLink` import if it's no longer used:

```typescript
// apps/frontend/src/lib/trpc/provider.tsx
// Before:
import { httpBatchLink, httpSubscriptionLink, splitLink } from '@trpc/client';

// After:
import { httpBatchLink, splitLink, wsLink, createWSClient } from '@trpc/client';
```

(This is already done in the updated code.)

## Questions?

See full documentation in:
- `WEBSOCKET_SUBSCRIPTIONS.md` - Complete technical details
- `WEBSOCKET_IMPLEMENTATION_SUMMARY.md` - Quick summary

Or check the source code:
- Backend: `apps/backend/src/main.ts`
- Frontend: `apps/frontend/src/lib/trpc/provider.tsx`
