# Node.js v24 JIT Package Incompatibility Fix

**Date**: January 27, 2025  
**Issue**: Backend production deployment failed with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`  
**Root Cause**: Node.js v24 native TypeScript support incompatible with JIT (Just-in-Time) pattern in production  
**Status**: ✅ **RESOLVED**

---

## Problem Summary

After updating Dockerfiles to official Next.js patterns and removing manual package compilation (assuming JIT would work), the backend container entered a crash loop in production with:

```
Error [ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING]: Stripping types is currently unsupported for files under node_modules, for "/app/node_modules/.pnpm/@aria+types@file+packages+types/node_modules/@aria/types/src/index.ts"
```

### Technical Root Cause

1. **JIT Pattern**: Shared packages (`@aria/types`, `@aria/utils`) were exporting source `.ts` files directly
2. **Node.js v24 Limitation**: Experimental native TypeScript support strips types, **but explicitly disallows this for files in `node_modules/`**
3. **Production Runtime**: NestJS compiled backend tries to `require('@aria/types')` → pnpm resolves to `.ts` file in node_modules → Node.js v24 **refuses** to load it
4. **Development Works**: Next.js `transpilePackages` transparently compiles JIT packages, so dev mode had no issues

---

## Solution: Hybrid Compilation Strategy

### Development Mode

- ✅ JIT pattern preserved - no manual builds needed
- Next.js transpiles shared packages via `transpilePackages`
- Fast hot reload, zero build overhead

### Production Mode

- ✅ Pre-compile shared packages to JavaScript
- Docker builds now execute `tsc --build` for `@aria/types` and `@aria/utils`
- Backend/frontend import **compiled** `.js` files from `dist/`

---

## Files Modified

### 1. **packages/types/tsconfig.json**

```json
{
  "extends": "@aria/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "incremental": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Changes**:

- ✅ Removed `"noEmit": true` (was blocking compilation)
- ✅ Added `outDir`, `declaration`, `declarationMap` for proper builds
- ✅ Added `composite: true` for TypeScript project references
- ✅ Added `rootDir: "./src"` for correct output structure

### 2. **packages/utils/tsconfig.json**

Same changes as `types`, plus:

```json
{
  "references": [{ "path": "../types" }]
}
```

**Reason**: `utils` depends on `types`, TypeScript project references ensure proper build order

### 3. **packages/types/package.json**

```json
{
  "name": "@aria/types",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./src/*": "./src/*"
  },
  "scripts": {
    "build": "tsc --build",
    "check-types": "tsc --noEmit",
    "clean": "rimraf .turbo dist *.tsbuildinfo"
  }
}
```

**Changes**:

- ✅ `main` and `types` now point to **compiled** `dist/index.js` (was `src/index.ts`)
- ✅ Added `build` script: `tsc --build`
- ✅ Updated `clean` to remove `dist` and `.tsbuildinfo`
- ✅ Kept `./src/*` export for potential direct source access

### 4. **packages/utils/package.json**

Same changes as `types` package

### 5. **apps/backend/Dockerfile**

```dockerfile
# CRITICAL: Production requires compiled packages
# Node.js v24's native TypeScript support explicitly disallows type-stripping for files in node_modules
# Error: ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING
# The JIT pattern works in development (Next.js transpiles) but fails in production NestJS runtime
# Solution: Pre-compile shared packages to JavaScript before backend build
RUN cd /app/packages/types && npx tsc --build tsconfig.json
RUN cd /app/packages/utils && npx tsc --build tsconfig.json

# Build the backend application (Nest compile step)
RUN pnpm --filter backend build
```

**Changes**:

- ✅ Re-added manual compilation commands (previously removed during official pattern update)
- ✅ Added detailed comment explaining Node.js v24 limitation
- ✅ Compiles `types` **then** `utils` (respects dependency order)

### 6. **apps/frontend/Dockerfile**

```dockerfile
# Generate Prisma client before building (required for backend types)
RUN cd apps/backend && pnpm exec prisma generate

# CRITICAL: Compile shared packages before backend/frontend builds
# Production requires compiled packages - JIT pattern only works in Next.js dev mode
RUN cd packages/types && npx tsc --build tsconfig.json
RUN cd packages/utils && npx tsc --build tsconfig.json

# Build backend (required for tRPC types that frontend imports)
RUN pnpm --filter backend build

# Build frontend using Turbo
RUN pnpm turbo build --filter=frontend...
```

**Changes**:

- ✅ Added package compilation before backend build
- ✅ Fixed standalone output path: `CMD ["node", "app/apps/frontend/server.js"]` (was `apps/frontend/server.js`)

---

## Validation

### ✅ All Containers Healthy

```bash
$ docker ps
NAMES           STATUS
aria-caddy      Up 7 minutes (healthy)
aria-frontend   Up 7 minutes (healthy)
aria-backend    Up 7 minutes (healthy)
aria-postgres   Up 7 minutes (healthy)
aria-redis      Up 7 minutes (healthy)
```

### ✅ Backend Logs Clean

No more `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` errors

### ✅ Frontend Serving

Next.js standalone server running on port 3000

---

## Build Commands

```bash
# Full rebuild
docker compose --env-file .env.production -f docker-compose.production.yml build --no-cache

# Start production stack
docker compose --env-file .env.production -f docker-compose.production.yml up -d --force-recreate

# Check container health
docker ps
```

---

## Key Learnings

1. **Node.js v24 Limitation**: Experimental TS support doesn't work for files in `node_modules/` - this is a **deliberate design choice** by Node.js team
2. **JIT ≠ Universal**: JIT pattern works **only when the consuming tool transpiles** (Next.js does, raw Node.js doesn't)
3. **Hybrid is Best**: Keep JIT for dev speed, compile for production compatibility
4. **TypeScript Project References**: When packages depend on each other, use `composite: true` + `references: []`
5. **Standalone Output Structure**: Next.js standalone creates nested structure - `server.js` is under `app/apps/frontend/`, not root

---

## Future Considerations

### Option 1: Downgrade to Node.js 20 (Backend)

- Node.js 20 doesn't have native TS support, so no type-stripping errors
- **Tradeoff**: Lose potential future TS performance benefits

### Option 2: Keep Current Hybrid Approach ✅ **RECOMMENDED**

- Best of both worlds: fast dev, compatible production
- No behavioral changes needed, just build-time compilation

### Option 3: Abandon JIT Entirely

- Always compile packages, even for dev
- **Tradeoff**: Slower dev workflow, manual rebuilds required

**Decision**: Keeping **Option 2 (Hybrid)** - zero impact on developer experience, full production compatibility.

---

## Related Documentation

- Official Next.js Docker Example: https://github.com/vercel/next.js/tree/canary/examples/with-docker
- Node.js Type Stripping: https://nodejs.org/api/typescript.html#type-stripping
- TypeScript Project References: https://www.typescriptlang.org/docs/handbook/project-references.html
- Next.js Standalone Output: https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
