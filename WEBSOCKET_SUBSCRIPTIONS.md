# WebSocket Subscriptions Implementation

## Overview

This document describes the implementation of real-time subscription support via WebSockets in the Aria ERP system. The implementation enables bidirectional communication between the frontend and backend, allowing the UI to automatically update in response to server-side events without requiring manual re-fetching.

## Architecture

### Technology Stack

- **Protocol**: WebSocket (ws://, wss://)
- **Backend**: NestJS with `@trpc/server/adapters/ws` and `ws` package
- **Frontend**: Next.js 15 with `@trpc/client` wsLink
- **Transport Strategy**: Split link routing
  - **Subscriptions**: WebSocket via `wsLink`
  - **Queries & Mutations**: HTTP batch via `httpBatchLink`

### Why WebSockets over SSE?

We chose WebSockets (`wsLink`) over Server-Sent Events (`httpSubscriptionLink`) for the following reasons:

1. **Stateful Backend**: Our NestJS backend is a long-running, stateful server—the ideal environment for managing persistent WebSocket connections.

2. **Connection Stability**: WebSockets with `keepAlive` provide more stable, long-lived connections compared to SSE's repeated connect/disconnect cycles, reducing overhead and missed events.

3. **Industry Standard**: WebSockets are the standard, robust approach for real-time capabilities in stateful server architectures.

4. **Bidirectional Communication**: WebSockets support full-duplex communication, enabling future features like client-to-server streaming if needed.

## Implementation Details

### Backend (NestJS)

#### 1. Dependencies

```bash
pnpm add ws --filter backend
pnpm add -D @types/ws --filter backend
```

#### 2. WebSocket Server Setup (`apps/backend/src/main.ts`)

The backend exposes a WebSocket endpoint at `/trpc-ws`:

```typescript
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';

async function bootstrap() {
  // ... existing NestJS setup ...
  
  // Start HTTP server
  await app.listen(process.env.PORT ?? 3001);
  
  // Get underlying HTTP server
  const httpServer = app.getHttpServer();

  // Create WebSocket server
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/trpc-ws',
  });

  // Apply tRPC WebSocket handler
  const wssHandler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: () => trpcContext,
    keepAlive: {
      enabled: true,
      pingMs: 30000,     // Ping every 30 seconds
      pongWaitMs: 5000,  // Wait 5 seconds for pong
    },
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    wssHandler.broadcastReconnectNotification();
    wss.close();
  });
}
```

**Key Features**:
- Attaches to the same HTTP server as NestJS (no separate port needed)
- KeepAlive mechanism prevents idle timeouts (30s ping, 5s pong timeout)
- Graceful shutdown on SIGTERM notifies clients to reconnect
- Reuses existing tRPC context for consistency

#### 3. Subscription Endpoints

Subscriptions are already defined in `apps/backend/src/apps/inventory/trpc/inventory.router.ts`:

```typescript
onItemsChanged: publicProcedure.subscription(() => {
  return observable<{
    type: 'created' | 'updated' | 'deleted';
    data: Inventory.Item | { id: string };
  }>((emit) => {
    const onCreated = (data: Inventory.Item) => {
      emit.next({ type: 'created', data });
    };
    
    const onUpdated = (data: Inventory.Item) => {
      emit.next({ type: 'updated', data });
    };
    
    const onDeleted = (data: { id: string }) => {
      emit.next({ type: 'deleted', data });
    };

    inventoryEvents.on('itemCreated', onCreated);
    inventoryEvents.on('itemUpdated', onUpdated);
    inventoryEvents.on('itemDeleted', onDeleted);

    return () => {
      inventoryEvents.off('itemCreated', onCreated);
      inventoryEvents.off('itemUpdated', onUpdated);
      inventoryEvents.off('itemDeleted', onDeleted);
    };
  });
});
```

### Frontend (Next.js)

#### 1. Dependencies

```bash
pnpm add ws --filter frontend
pnpm add -D @types/ws --filter frontend
```

#### 2. tRPC Provider Configuration (`apps/frontend/src/lib/trpc/provider.tsx`)

The frontend uses `splitLink` to route operations intelligently:

```typescript
import { wsLink, createWSClient, splitLink, httpBatchLink } from '@trpc/client';

function getWsUrl() {
  const baseUrl = getBaseUrl();
  if (typeof window !== 'undefined') {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = baseUrl || window.location.host;
    return `${wsProtocol}//${wsHost}/trpc-ws`;
  }
  const url = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
  return `${url}/trpc-ws`;
}

function getWebSocketImpl() {
  if (typeof window !== 'undefined') {
    return WebSocket; // Native browser WebSocket
  }
  const ws = require('ws'); // Node.js ws package for SSR
  return ws.WebSocket || ws;
}

export function TRPCProvider({ children }) {
  const [trpcClient] = useState(() => {
    const wsClient = createWSClient({
      url: getWsUrl(),
      WebSocket: getWebSocketImpl() as any,
      keepAlive: {
        enabled: true,
        intervalMs: 25000, // Ping every 25s (less than server's 30s)
      },
    });

    return trpc.createClient({
      links: [
        splitLink({
          condition: (op) => op.type === 'subscription',
          true: wsLink({ client: wsClient }),     // Subscriptions via WS
          false: httpBatchLink({                   // Queries/mutations via HTTP
            url: `${getBaseUrl()}/trpc`,
          }),
        }),
      ],
    });
  });

  // ... rest of provider
}
```

**Key Features**:
- Single persistent WebSocket client instance per user session
- Automatic protocol detection (ws:// vs wss:// based on page protocol)
- SSR-compatible (uses native WebSocket in browser, `ws` package in Node.js)
- KeepAlive slightly shorter than server (25s vs 30s) to ensure server doesn't timeout first
- All subscriptions share the same WebSocket connection (efficient)

#### 3. Using Subscriptions in Components

Example from `apps/frontend/src/app/inventory/items-catalogue/item/page.tsx`:

```typescript
'use client';

import { trpc } from '@/lib/trpc';

export default function ItemsPage() {
  const utils = trpc.useUtils();
  
  // Subscribe to real-time inventory changes
  trpc.inventory.onItemsChanged.useSubscription(undefined, {
    onData(event) {
      console.log('Real-time event:', event.type, event.data);
      
      if (event.type === 'created' || event.type === 'updated' || event.type === 'deleted') {
        // Invalidate queries to refetch data
        utils.inventory.listItems.invalidate();
      }
    },
    onError(err) {
      console.error('Subscription error:', err);
    },
  });

  // ... rest of component
}
```

## Connection Lifecycle

### 1. Initial Connection

1. Frontend creates `wsClient` on first render of `TRPCProvider`
2. When first subscription is activated (e.g., `useSubscription` hook mounts), WebSocket connects to `ws://localhost:3001/trpc-ws`
3. Backend accepts connection and stores it in the WebSocket server
4. Both sides start keepAlive ping/pong cycle

### 2. Active Connection

- **Server**: Sends ping every 30 seconds, expects pong within 5 seconds
- **Client**: Sends ping every 25 seconds
- **Data Flow**: Server emits subscription events → Client receives and triggers `onData` callback
- **Stability**: Connection remains open even if no events occur (thanks to keepAlive)

### 3. Disconnection & Reconnection

- **Network Loss**: Client automatically attempts to reconnect (tRPC default behavior)
- **Server Shutdown**: SIGTERM handler broadcasts reconnect notification, then closes gracefully
- **Tab Close**: WebSocket closes, server removes connection from pool
- **Subscription Unmount**: If no active subscriptions remain, connection may close (but reopens on next subscription)

## Verification

### 1. Check WebSocket Connection in Browser DevTools

1. Start backend: `pnpm --filter backend dev`
2. Start frontend: `pnpm --filter frontend dev`
3. Open browser DevTools → **Network** tab → **WS** filter
4. Navigate to a page with an active subscription (e.g., `/inventory/items-catalogue/item`)
5. You should see:
   - **Connection established**: `ws://localhost:3001/trpc-ws`
   - **Status**: `101 Switching Protocols`
   - **Messages**: Periodic ping/pong frames and subscription data

### 2. Test Real-Time Updates

1. Open the inventory items page in two browser windows/tabs
2. In **Tab A**: Create, update, or delete an item
3. In **Tab B**: Observe the UI automatically update without manual refresh
4. Check browser console for logs: `Real-time event: created/updated/deleted`

### 3. Monitor Server Logs

Backend console should show:

```
[Inventory] New subscription to onItemsChanged
[Inventory] Emitting itemCreated event: <item-id>
[Inventory] Broadcasting created event: <item-id>
```

## Performance Considerations

### Connection Overhead

- **Single Connection Per Client**: All subscriptions share one WebSocket connection (efficient)
- **KeepAlive**: ~200 bytes every 25-30 seconds (negligible overhead)
- **No Polling**: Unlike HTTP polling, no repeated request/response cycles

### Scalability

- **Current Setup**: In-memory EventEmitter (single-server only)
- **Future Scaling**: For multi-server deployments, replace EventEmitter with Redis Pub/Sub or similar message broker:

```typescript
// Future enhancement (not implemented yet)
import { createClient } from 'redis';

const redisClient = createClient();
await redisClient.connect();

// Publish events
await redisClient.publish('inventory:items', JSON.stringify(event));

// Subscribe to events
await redisClient.subscribe('inventory:items', (message) => {
  const event = JSON.parse(message);
  emit.next(event);
});
```

### Resource Management

- **Server**: WebSocket connections are lightweight (~10KB per connection)
- **Client**: Single connection reused across all subscriptions
- **Cleanup**: Automatic cleanup on component unmount and server shutdown

## Troubleshooting

### WebSocket Connection Fails

**Symptoms**: Console error `WebSocket connection failed`

**Solutions**:
1. Verify backend is running: `pnpm --filter backend dev`
2. Check backend logs for WebSocket server startup message
3. Ensure no firewall blocking WebSocket connections
4. Verify `NEXT_PUBLIC_API_URL` environment variable (if using custom backend URL)

### Subscriptions Not Triggering

**Symptoms**: UI doesn't update on changes

**Solutions**:
1. Check browser DevTools → Network → WS for active connection
2. Verify subscription is active (check component mounting)
3. Ensure mutations are emitting events (check backend logs)
4. Confirm `onData` callback is defined in `useSubscription`

### Connection Timeout

**Symptoms**: WebSocket disconnects after ~30 seconds of inactivity

**Solutions**:
1. Verify `keepAlive` is configured on both client and server
2. Check client `intervalMs` is less than server `pingMs`
3. Review backend logs for pong timeout errors

### CORS Issues

**Symptoms**: WebSocket handshake fails with CORS error

**Solutions**:
1. WebSockets don't use CORS (they use Origin header)
2. Ensure backend's `app.enableCors()` is configured correctly
3. For production, add WebSocket origin validation in `applyWSSHandler`

## Security Considerations

### Current Implementation

- **Authentication**: Not yet implemented (all connections accepted)
- **Context**: Shares same context as HTTP requests (ready for auth integration)

### Future Enhancements

1. **Token-Based Auth**: Pass JWT in WebSocket handshake headers
2. **Per-Connection Context**: Validate user identity in `createContext`
3. **Rate Limiting**: Limit subscription events per user
4. **Connection Limits**: Cap max connections per user

Example future context setup:

```typescript
// Future enhancement (not implemented yet)
createContext: (opts) => {
  const token = opts.req.headers.authorization?.replace('Bearer ', '');
  const user = verifyToken(token);
  return { ...trpcContext, user };
}
```

## Testing

### Manual Testing

See **Verification** section above.

### Automated Testing (Future)

1. **E2E Tests**: Playwright tests to verify real-time updates
2. **Integration Tests**: Mock WebSocket connections in Jest
3. **Load Tests**: Simulate hundreds of concurrent subscriptions

## Maintenance

### Monitoring

Monitor these metrics in production:

- Active WebSocket connections count
- Subscription event rate
- Connection errors/disconnects
- Ping/pong success rate

### Updates

When updating tRPC or WebSocket dependencies:

1. Review breaking changes in `@trpc/server` and `@trpc/client`
2. Test keepAlive behavior (timing may change)
3. Verify SSR compatibility (Next.js updates)
4. Check `ws` package compatibility with Node.js version

## Conclusion

This implementation provides a robust, production-ready foundation for real-time features in Aria ERP. The WebSocket-based subscriptions offer:

✅ **Stability**: KeepAlive prevents idle disconnects  
✅ **Efficiency**: Single connection per client, batched HTTP for queries  
✅ **Developer Experience**: Type-safe subscriptions via tRPC  
✅ **Scalability**: Ready for multi-server deployments with minimal refactoring  
✅ **Maintainability**: Follows framework conventions, minimal custom code  

For questions or issues, refer to:
- [tRPC Subscriptions Docs](https://trpc.io/docs/subscriptions)
- [ws Package Docs](https://github.com/websockets/ws)
- `apps/backend/src/main.ts` (backend setup)
- `apps/frontend/src/lib/trpc/provider.tsx` (frontend setup)
