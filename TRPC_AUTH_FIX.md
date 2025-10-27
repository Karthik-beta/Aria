# tRPC + Better Auth Integration Fix

## Problem Summary

After integrating Better Auth into a working NestJS + tRPC application, all tRPC routes began returning 404 errors. The backend started successfully, but HTTP requests to `/trpc/*` endpoints failed.

## Root Cause

The issue stemmed from a **lifecycle timing conflict** between Better Auth and tRPC:

1. **Better Auth Requirement**: The `@thallesp/nestjs-better-auth` adapter requires `bodyParser: false` in the NestJS configuration to handle authentication requests properly.

2. **tRPC Lifecycle Dependency**: The `TrpcService` builds its router in the `onModuleInit()` lifecycle hook, which runs after NestJS's dependency injection completes.

3. **Middleware Mounting Timing**: When using `bodyParser: false`, NestJS's normal middleware mounting order is affected. The tRPC Express middleware was being mounted before the router was fully initialized.

## Solution

The fix involves **manually triggering the tRPC service lifecycle** before mounting the Express middleware:

### Updated `apps/backend/src/main.ts`

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Required for Better Auth
  });

  // Get tRPC service instance
  const trpcService = app.get(TrpcService);

  // CRITICAL FIX: Manually trigger onModuleInit if router not ready
  if (!trpcService.appRouter) {
    trpcService.onModuleInit();
  }

  const appRouter = trpcService.getAppRouter();

  // Mount tRPC HTTP middleware AFTER router is initialized
  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Configure WebSocket subscriptions
  // ... (WebSocket setup)

  await app.listen(3001);
}
```

### Key Points

1. **Call `onModuleInit()` manually**: This ensures the tRPC router is built before mounting middleware.
2. **Use `app.use()` directly**: Do NOT use `httpAdapter.use()` or mount middleware after `app.init()` when `bodyParser: false` is set.
3. **Check router readiness**: The `if (!trpcService.appRouter)` guard ensures idempotency.

## Better Auth Configuration Fix

Additionally, the Better Auth module API signature was updated to match the non-deprecated format:

### Updated `apps/backend/src/auth/auth.module.ts`

```typescript
@Module({
  imports: [
    BetterAuthModule.forRoot({
      auth, // Better Auth instance
      disableTrustedOriginsCors: false, // Options merged into object
      disableBodyParser: false,
      disableGlobalAuthGuard: true,
    }),
  ],
  // ...
})
export class AuthModule {}
```

**Before (deprecated)**:

```typescript
BetterAuthModule.forRoot(auth, {
  disableTrustedOriginsCors: false,
  // ...
});
```

**After (current API)**:

```typescript
BetterAuthModule.forRoot({
  auth,
  disableTrustedOriginsCors: false,
  // ...
});
```

## Verification

After applying these fixes, the following endpoints work correctly:

### HTTP Endpoints

```bash
# Single query
curl http://localhost:3001/trpc/inventory.listItems
# Response: {"result":{"data":[]}}

# Batched queries
curl 'http://localhost:3001/trpc/inventory.listItems,inventory.listItems'
# Response: [{"result":{"data":[]}},{"result":{"data":[]}}]
```

### WebSocket Subscriptions

```typescript
// Browser console shows successful connection
// Connected to ws://localhost:3001/trpc-ws
```

### Better Auth Endpoints

```bash
curl http://localhost:3001/api/auth/get-session
# Response: {"session":null,"user":null} (when not authenticated)
```

## Files Modified

1. `apps/backend/src/main.ts` - Manual lifecycle management
2. `apps/backend/src/auth/auth.module.ts` - API signature fix
3. Documentation and cleanup across frontend/backend (console.logs removed)

## Lessons Learned

1. **NestJS Lifecycle Hooks**: When using `bodyParser: false`, normal lifecycle behavior is affected. Always verify that services with initialization logic complete their setup before being used.

2. **Better Auth Adapter API**: The `@thallesp/nestjs-better-auth` package has evolved. Always use the object-based configuration format to avoid deprecation warnings.

3. **tRPC Middleware Mounting**: The tRPC Express middleware MUST be mounted after the router is initialized, but BEFORE `app.listen()`. The order matters.

4. **Official Documentation**: Always cross-reference with official documentation using MCP tools when integrating multiple frameworks. The solution came from understanding both Better Auth's requirements and NestJS's lifecycle.

## References

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
- [tRPC Express Adapter](https://trpc.io/docs/server/adapters/express)
- [@thallesp/nestjs-better-auth GitHub](https://github.com/thallesp/nestjs-better-auth)

---

**Status**: ✅ **RESOLVED** - All tRPC routes accessible, Better Auth working, no deprecation warnings.
