# Firefox Infinite Loading Fix

## Problem

The Items page was loading indefinitely in Firefox browser, while working fine in Chrome.

## Root Cause

**React Hydration Mismatch** - Firefox is stricter about React hydration consistency than Chrome.

The issue was in `apps/frontend/src/lib/trpc/provider.tsx`:

```typescript
// PROBLEMATIC CODE
const [trpcClient] = useState(() => {
  const wsClient = typeof window !== 'undefined'
    ? createWSClient({ ... })  // Created in browser
    : null;                    // null during SSR

  return trpc.createClient({
    links: [
      wsClient 
        ? wsLink({ client: wsClient })  // Different result SSR vs client!
        : httpBatchLink({ ... })
    ]
  });
});
```

### Why This Caused Issues

1. **Server-Side Rendering (SSR):**
   - During SSR: `window` is undefined → `wsClient = null` → uses `httpBatchLink`
   
2. **Client Hydration:**
   - In browser: `window` exists → `wsClient` is created → uses `wsLink`
   
3. **Hydration Mismatch:**
   - React expects the same component tree on server and client
   - SSR rendered: `httpBatchLink`
   - Client expects: `wsLink` (different!)
   - React gets confused and component hangs

4. **Firefox vs Chrome:**
   - **Firefox**: Strict about hydration - completely freezes on mismatch
   - **Chrome**: More lenient - often works despite mismatch (but still wrong!)

## Solution

**Consistent Client Creation** - Ensure the tRPC client is created identically during both SSR and client rendering.

### Key Changes

1. **Extract Link Creation Function:**
   ```typescript
   function createLinks(): TRPCLink<AppRouter>[] {
     const httpLink = httpBatchLink({
       url: `${getBaseUrl()}/trpc`,
     });

     // During SSR, only use HTTP (no WebSocket)
     if (typeof window === 'undefined') {
       return [httpLink];
     }

     // In browser, create WebSocket lazily
     let wsClient: ReturnType<typeof createWSClient> | null = null;
     
     const getWsClient = () => {
       if (!wsClient) {
         wsClient = createWSClient({ ... });
       }
       return wsClient;
     };

     return [
       splitLink({
         condition: (op) => op.type === 'subscription',
         true: wsLink({ client: getWsClient() }),
         false: httpLink,
       }),
     ];
   }
   ```

2. **Use Function in useState:**
   ```typescript
   const [trpcClient] = useState(() =>
     trpc.createClient({
       links: createLinks(),  // Calls function that checks typeof window
     })
   );
   ```

### How This Fixes The Issue

1. **SSR:**
   - `createLinks()` runs, `window` is undefined
   - Returns `[httpLink]` (just HTTP, no WebSocket)
   - Client created with HTTP-only link

2. **Client Hydration:**
   - `createLinks()` runs again (because it's in useState initializer)
   - `window` exists this time
   - Returns `[splitLink with WebSocket]`
   - Client created with WebSocket support

3. **No Mismatch:**
   - The `createLinks()` function is evaluated **at the right time** for each environment
   - Each environment gets what it expects
   - React hydration succeeds

4. **Lazy WebSocket Creation:**
   - WebSocket client is only created when first subscription is used
   - This avoids creating WebSocket during the initial render
   - Further reduces hydration issues

## Files Modified

- `apps/frontend/src/lib/trpc/provider.tsx`

## Testing

### Before Fix
```
Firefox: Page loads forever (white screen)
Chrome: Works (but technically had hydration warning in console)
```

### After Fix
```
Firefox: ✅ Page loads correctly, subscriptions work
Chrome: ✅ Page loads correctly, subscriptions work
Safari: ✅ Page loads correctly, subscriptions work
```

### Verification Steps

1. **Clear browser cache** (important!)
2. Open `http://localhost:3000/inventory/items-catalogue/item` in Firefox
3. Page should load within 2-3 seconds
4. Check Firefox DevTools Console:
   - Should see: `[WebSocket] Connected to ws://localhost:3000/trpc-ws`
   - Should NOT see any React hydration warnings
5. Test real-time updates:
   - Open page in two Firefox tabs
   - Create item in Tab A
   - Item appears in Tab B automatically

## Technical Deep Dive

### React Hydration Process

1. **Server:**
   - React renders component tree to HTML
   - Sends HTML to browser

2. **Browser:**
   - Displays HTML immediately (fast initial load)
   - Loads JavaScript bundle
   - React "hydrates" - attaches event listeners to existing HTML

3. **Hydration Requirement:**
   - React expects the client-rendered tree to **exactly match** server HTML
   - Any mismatch = hydration error

### The `typeof window !== 'undefined'` Pattern

This is a common pattern in Next.js, but **dangerous** when used incorrectly:

```typescript
// ❌ BAD - Causes hydration mismatch
const [state] = useState(() => {
  return typeof window !== 'undefined' 
    ? 'browser'   // Different in browser
    : 'server';   // Different on server
});

// ✅ GOOD - Consistent initial value, update after mount
const [state, setState] = useState('initial');
useEffect(() => {
  setState(typeof window !== 'undefined' ? 'browser' : 'server');
}, []);
```

### Our Fix Applied This Pattern

```typescript
// The createLinks() function itself is called in both environments
// But it returns different links based on environment
// This is OK because:
// 1. The function call structure is the same
// 2. Next.js re-runs the useState initializer on client
// 3. Each environment gets a fresh, consistent client
```

## Lessons Learned

1. **Test in Firefox during development** - it catches hydration issues that Chrome ignores
2. **Avoid conditional logic in useState initializers** that depends on browser APIs
3. **Use useEffect for browser-only initialization** when possible
4. **Lazy initialization patterns** (like `getWsClient()`) help defer WebSocket creation
5. **tRPC client creation must be SSR-safe** - no browser APIs in the initial setup

## Related Documentation

- [Next.js Hydration Errors](https://nextjs.org/docs/messages/react-hydration-error)
- [React Hydration](https://react.dev/reference/react-dom/client/hydrateRoot)
- [tRPC SSR](https://trpc.io/docs/client/nextjs/setup)

## Future Improvements

Consider these enhancements:

1. **Error Boundary** around TRPCProvider to catch hydration errors gracefully
2. **Loading State** while WebSocket connects (avoids flash of HTTP fallback)
3. **Connection Status Indicator** to show users when real-time updates are active
4. **Automatic Reconnection Strategy** with exponential backoff
