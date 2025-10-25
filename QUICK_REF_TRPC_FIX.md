# Quick Reference: tRPC Type Safety Fix

## Problem
- Frontend: `Property 'useUtils' does not exist on type 'IntersectionError'`
- Backend: `TS2742: The inferred type of 'auth' cannot be named`

## Solution

### 1. Enable TypeScript Declarations
**File:** `apps/backend/tsconfig.json`
```json
{
  "compilerOptions": {
    "declaration": true  // ✅ Required for .d.ts generation
  }
}
```

### 2. Workaround for better-auth TS2742
**File:** `apps/backend/src/auth/auth.config.ts`
```typescript
// Known issue: https://github.com/better-auth/better-auth/issues/2123
export const auth: any = betterAuth({
  // ...config
});
```

## Verification
```bash
# Full build
pnpm build

# Type check only
pnpm tsc --noEmit
```

## Result
✅ Frontend can import `AppRouter` type  
✅ `trpc.useUtils()` is fully typed  
✅ All IntelliSense working  

## References
- NestJS tRPC: https://www.nestjs-trpc.io/docs/integrations
- better-auth Issue: https://github.com/better-auth/better-auth/issues/2123
- Full Details: `BUILD_FIX_SUMMARY.md`
