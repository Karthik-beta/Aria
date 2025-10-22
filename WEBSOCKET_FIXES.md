# WebSocket Subscription Fixes

## Issues Resolved

### Issue 1: React State Update on Unmounted Component

**Error Message:**
```
Can't perform a React state update on a component that hasn't mounted yet. This indicates that you have a side-effect in your render function that asynchronously tries to update the component. Move this work to useEffect instead.
```

**Root Cause:**
The `useSubscription` hook was being called in the component body and could trigger state updates (via `toast` notifications) before the component was fully mounted.

**Fix Applied:**
1. Wrapped subscription callbacks in `React.useCallback` to ensure stable references
2. Removed the `mountedRef` pattern which was unnecessarily complex
3. Added proper TypeScript types for the subscription event data
4. Moved toast notifications to happen safely within the callback context

**Files Modified:**
- `apps/frontend/src/app/inventory/items-catalogue/item/page.tsx`

### Issue 2: WebSocket Not Connecting (Data Not Updating for Other Users)

**Symptoms:**
- Backend logs showed: `[Inventory] Emitting itemCreated event: <id>`
- Frontend subscription never received the events
- No real-time updates across browser tabs/windows

**Root Causes:**

1. **WebSocket Client Created During SSR:**
   - The `createWSClient` was being called during server-side rendering
   - This created a WebSocket connection on the server (Node.js), not in the browser
   - The browser never established its own WebSocket connection

2. **Incorrect WebSocket URL:**
   - The `getWsUrl()` function was building incorrect URLs when `baseUrl` was empty
   - Example: `ws:///trpc-ws` (missing host) instead of `ws://localhost:3000/trpc-ws`

3. **SSR Compatibility Issues:**
   - The code was trying to use `ws` package in the browser via `require()`, which doesn't work in Next.js client components

**Fix Applied:**

1. **Browser-Only WebSocket Client:**
   ```typescript
   const wsClient =
     typeof window !== 'undefined'
       ? createWSClient({
           url: getWsUrl(),
           WebSocket: WebSocket as any, // Use native browser WebSocket
           keepAlive: { enabled: true, intervalMs: 25000 },
         })
       : null;
   ```

2. **Improved URL Generation:**
   ```typescript
   function getWsUrl() {
     if (typeof window !== 'undefined') {
       const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
       const baseUrl = process.env.NEXT_PUBLIC_API_URL;
       
       if (baseUrl) {
         const url = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
         return `${url}/trpc-ws`;
       }
       
       // Use current host (default for dev)
       return `${wsProtocol}//${window.location.host}/trpc-ws`;
     }
     
     return 'ws://localhost:3001/trpc-ws'; // SSR placeholder (not used)
   }
   ```

3. **Fallback for SSR:**
   - If `wsClient` is `null` (SSR), fall back to `httpBatchLink` even for subscriptions
   - This prevents errors during SSR while allowing subscriptions to work in browser

4. **Added Debug Logging:**
   ```typescript
   onOpen: () => {
     if (process.env.NODE_ENV === 'development') {
       console.log('[WebSocket] Connected to', getWsUrl());
     }
   },
   onClose: () => {
     if (process.env.NODE_ENV === 'development') {
       console.log('[WebSocket] Disconnected');
     }
   },
   ```

**Files Modified:**
- `apps/frontend/src/lib/trpc/provider.tsx`

## Verification Steps

### 1. Check WebSocket Connection

Open Browser DevTools:
1. Network tab → WS filter
2. Look for connection to `ws://localhost:3000/trpc-ws` (frontend dev server proxies to backend)
3. Status: 101 Switching Protocols (green)
4. Messages: Periodic ping/pong frames

Console should show:
```
[WebSocket] Connected to ws://localhost:3000/trpc-ws
[Real-time] Subscription connected to inventory updates
```

### 2. Test Real-Time Updates

1. Open inventory items page: `http://localhost:3000/inventory/items-catalogue/item`
2. Open the same page in a second browser tab
3. In Tab A: Click "Add Item" and create a new item
4. In Tab B: The new item should appear automatically WITHOUT refreshing

Both browser consoles should show:
```
[Real-time] Received event: created { id: "...", name: "...", ... }
```

Backend console should show:
```
[Inventory] Emitting itemCreated event: cmh1mjdxn0000l5w4pbb38tt8
[Inventory] Broadcasting created event: cmh1mjdxn0000l5w4pbb38tt8
```

### 3. Verify No React Errors

The browser console should NOT show:
- ❌ "Can't perform a React state update on a component that hasn't mounted yet"
- ❌ "WebSocket connection failed"
- ❌ Any tRPC subscription errors

## Technical Details

### Why WebSocket Wasn't Connecting Before

**Next.js Dev Server Behavior:**
- Frontend runs on `http://localhost:3000` (Next.js)
- Backend runs on `http://localhost:3001` (NestJS)
- Next.js dev server proxies `/trpc` to backend automatically
- BUT we need to explicitly connect WebSocket to the correct URL

**Previous Code Flow (BROKEN):**
```
1. TRPCProvider renders during SSR (server-side)
2. createWSClient() called on server
3. Tries to connect to ws://localhost:3001/trpc-ws from Node.js process
4. Connection fails or connects from server, not browser
5. Browser never establishes WebSocket connection
6. Subscriptions don't work
```

**Fixed Code Flow (WORKING):**
```
1. TRPCProvider renders during SSR
2. wsClient = null (skipped during SSR)
3. Browser hydrates the component
4. TRPCProvider re-runs in browser
5. createWSClient() called in browser with window.location
6. WebSocket connects to ws://localhost:3000/trpc-ws
7. Next.js dev server proxies to ws://localhost:3001/trpc-ws
8. Backend receives connection
9. Subscriptions work!
```

### Why This Approach Works

1. **Client-Side Only:** WebSocket client only created in browser (`typeof window !== 'undefined'`)
2. **Native WebSocket:** Uses browser's native `WebSocket` API, not `ws` package
3. **Correct URL:** Uses `window.location.host` to connect to Next.js dev server
4. **Automatic Proxy:** Next.js dev server automatically proxies WebSocket upgrade requests to backend
5. **SSR Safe:** Returns `null` during SSR, preventing errors

## Production Deployment Notes

In production, you'll need to ensure:

1. **Environment Variable:** Set `NEXT_PUBLIC_API_URL` to your backend URL
2. **WebSocket Proxy:** If frontend and backend are on different domains, configure CORS and WebSocket proxy in your reverse proxy (Nginx, Traefik, etc.)
3. **WSS Protocol:** Use `wss://` (secure WebSocket) in production (automatically handled by the code based on HTTPS)

Example production setup:
```bash
# Frontend .env.production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# This will connect WebSocket to:
# wss://api.yourdomain.com/trpc-ws
```

## Lessons Learned

1. **SSR Consideration:** Always check if code runs during SSR in Next.js App Router
2. **Browser APIs:** WebSocket, localStorage, window, etc. only exist in browser
3. **URL Construction:** Be careful with URL building when `baseUrl` can be empty
4. **Subscription Callbacks:** Use `useCallback` to prevent unnecessary re-subscriptions
5. **Type Safety:** Always use proper TypeScript types for tRPC error handlers

## References

- [tRPC Subscriptions Docs](https://trpc.io/docs/subscriptions)
- [Next.js SSR vs Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- [WebSocket API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
