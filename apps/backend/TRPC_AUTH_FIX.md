# tRPC + Better Auth Integration Fix

## Problem Summary

After integrating Better Auth into the NestJS backend, tRPC routes started returning 404 errors:

```http
GET http://localhost:3001/trpc/inventory.listItems?batch=1&input={} [HTTP/1.1 404 Not Found]
```

## Root Cause

The `@thallesp/nestjs-better-auth` library, even with `disableGlobalAuthGuard: true`, was potentially interfering with the tRPC Express middleware due to improper module configuration and missing body parser setup options.

### Key Issues Identified

1. **Incomplete Better Auth Module Configuration**: The `AuthModule.forRoot()` was only setting `disableGlobalAuthGuard`, but not configuring other critical options like `disableBodyParser`, `disableTrustedOriginsCors`, and `disableExceptionFilter`.

2. **Middleware Mounting Order**: The tRPC Express middleware needed to be mounted after `app.init()` to ensure Better Auth's middleware was already registered and wouldn't interfere.

3. **Body Parser Configuration**: While `bodyParser: false` was set in `NestFactory.create()`, the Better Auth module's `disableBodyParser` option wasn't explicitly configured.

## Solution Applied

### 1. Updated `auth.module.ts`

Following the official `@thallesp/nestjs-better-auth` documentation, configured all available module options:

```typescript
BetterAuthModule.forRoot({
  auth,
  // Disable global guard - we'll use @UseGuards or @AllowAnonymous explicitly
  disableGlobalAuthGuard: true,
  // Keep body parser disabled (handled in main.ts bootstrap)
  disableBodyParser: false, // Module will re-add parsers automatically
  // Keep trusted origins CORS enabled for Better Auth endpoints
  disableTrustedOriginsCors: false,
  // Keep exception filter enabled for proper Better Auth error responses
  disableExceptionFilter: false,
});
```

**Key Points**:

- `disableGlobalAuthGuard: true` — Prevents automatic `APP_GUARD` registration, allowing us to control route protection explicitly
- `disableBodyParser: false` — Lets Better Auth module re-add necessary body parsers after we disable the default ones in `main.ts`
- `disableTrustedOriginsCors: false` — Allows Better Auth to add CORS for its trusted origins (from `auth.config.ts`)
- `disableExceptionFilter: false` — Uses Better Auth's built-in exception filter for proper `APIError` responses

### 2. Enhanced `main.ts` Documentation

Added comprehensive inline documentation explaining:

- Why `bodyParser: false` is required for Better Auth
- The importance of calling `app.init()` before accessing providers
- Why tRPC middleware is mounted after initialization
- The middleware mounting order and how it prevents conflicts

```typescript
/**
 * CRITICAL: Disable body parser for Better Auth compatibility
 *
 * Per @thallesp/nestjs-better-auth official docs, we must disable NestJS's
 * built-in body parser to allow Better Auth to handle request bodies correctly.
 * The Better Auth module will automatically re-add the necessary body parsers.
 */
const app = await NestFactory.create(AppModule, {
  bodyParser: false,
});

// ... CORS setup ...

/**
 * Initialize the application BEFORE accessing providers
 * This ensures lifecycle hooks (onModuleInit) execute...
 */
await app.init();

// Get providers and mount tRPC
const trpcService = app.get(TrpcService);
const trpcContext = app.get(TrpcContext);
const appRouter = trpcService.getAppRouter();

/**
 * Mount tRPC adapter AFTER Better Auth middleware
 * Mounting order matters...
 */
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => trpcContext,
  }),
);

await app.listen(process.env.PORT ?? 3001);
```

## Testing the Fix

1. **Restart the backend server**:

   ```bash
   bun --filter backend dev
   ```

2. **Verify tRPC routes are accessible**:
   - Open browser to `http://localhost:3000/inventory/items-catalogue/item/`
   - Check browser console — should NOT see 404 errors for tRPC calls
   - Should see inventory items loading successfully

3. **Verify authentication still works**:
   - Auth endpoints at `/api/auth/*` should still respond correctly
   - Sign-in flow should work as expected
   - Protected routes (if added) should enforce authentication properly

## Future: Adding Authentication to tRPC Procedures

Currently, all tRPC procedures use `publicProcedure`, making them accessible without authentication. To add authentication:

### Option 1: Create Protected Procedure Type

```typescript
// apps/backend/src/trpc/trpc.ts
import { TRPCError } from '@trpc/server';

// Protected procedure that requires authentication
export const protectedProcedure = publicProcedure.use(async (opts) => {
  const { ctx } = opts;

  // Access auth from context (would need to enhance TrpcContext)
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return opts.next({
    ctx: {
      ...ctx,
      user: ctx.session.user, // Now guaranteed to exist
    },
  });
});
```

### Option 2: Enhance tRPC Context with Session

```typescript
// apps/backend/src/trpc/trpc.context.ts
import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../shared/prisma.service';

export interface CreateContextOptions {
  req?: Request;
  res?: Response;
}

@Injectable()
export class TrpcContext {
  constructor(public readonly prisma: PrismaService) {}

  async create(opts: CreateContextOptions) {
    // Extract session from Better Auth cookie
    const session = opts.req?.session; // Added by Better Auth middleware

    return {
      prisma: this.prisma,
      session,
      req: opts.req,
      res: opts.res,
    };
  }
}
```

Then update `main.ts` to pass the request:

```typescript
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }) => trpcContext.create({ req, res }),
  }),
);
```

## References

- [@thallesp/nestjs-better-auth Official Docs](https://github.com/thallesp/nestjs-better-auth)
- [tRPC Authentication Docs](https://trpc.io/docs/server/authorization)
- [Better Auth Core Docs](https://www.better-auth.com/)
- [NestJS tRPC Integration](https://www.nestjs-trpc.io/)

## Agent Alignment

This fix aligns with the following agents from `AGENTS.md`:

- **Agent 7 (Official Docs Enforcer)**: Used MCP tools to retrieve and follow official documentation for both `@thallesp/nestjs-better-auth` and `nestjs-trpc` integration patterns
- **Agent 2 (Type Safety Guardian)**: Maintained strong typing throughout, prepared for future type-safe authentication context
- **Agent 5 (Documentation Scribe)**: Added comprehensive inline documentation explaining the "why" behind each configuration choice
- **Agent 1 (Simplicity Advocate)**: Kept the solution simple by properly configuring existing modules rather than introducing custom middleware or workarounds
