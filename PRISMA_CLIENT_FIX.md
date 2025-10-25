# Prisma Client Import Fix - Summary

## Issue

The backend build was failing with error:

```
TS2307: Cannot find module '../generated/prisma' or its corresponding type declarations.
TS2742: The inferred type of 'auth' cannot be named without a reference to '.pnpm/@better-auth+core@1.3.31...'. This is likely not portable. A type annotation is necessary.
```

## Root Cause

1. **Prisma Import Issue**: Using relative path imports for Prisma client with custom output directory is not recommended by official Prisma documentation
2. **TypeScript Declaration Issue**: The TS2742 error is a known TypeScript compiler limitation when generating declaration files with complex types from better-auth adapters

## Solution Implemented

### 1. Added Prisma Client as Linked Dependency (Official Recommendation)

Following official Prisma documentation for custom output directories:

**File**: `apps/backend/package.json`

```json
"dependencies": {
  ...
  "db": "link:./generated/prisma",
  ...
}
```

### 2. Updated All Imports to Use Linked Dependency

Changed from relative paths to the linked dependency alias:

**Files Updated**:

- `apps/backend/src/auth/auth.config.ts`
- `apps/backend/src/auth/auth.service.ts`
- `apps/backend/src/shared/prisma.service.ts`
- `apps/backend/src/apps/inventory/inventory.service.ts`
- `apps/backend/src/apps/inventory/inventory.service.spec.ts`

**Before**:

```typescript
import { PrismaClient } from '../generated/prisma';
import { Prisma } from '../../../generated/prisma';
```

**After**:

```typescript
import { PrismaClient } from 'db';
import { Prisma } from 'db';
```

### 3. Added Prebuild Script for Prisma Generation

Ensures Prisma client is generated before TypeScript compilation:

**File**: `apps/backend/package.json`

```json
"scripts": {
  "prebuild": "prisma generate",
  "build": "nest build",
  ...
}
```

### 4. Disabled Declaration Generation

Fixed TS2742 error by disabling declaration file generation (backend apps don't need to export type declarations):

**File**: `apps/backend/tsconfig.json`

```json
{
  "compilerOptions": {
    ...
    "declaration": false,  // Changed from true
    ...
  }
}
```

## Verification

```powershell
PS C:\Users\Admin\Desktop\Aria> pnpm --filter backend build
✔ Generated Prisma Client (v6.17.1) to .\generated\prisma in 787ms
✔ Compiled successfully
```

Build output confirmed in `apps/backend/dist/main.js`.

## Technical Background

### Why Use Linked Dependencies?

According to Prisma documentation (https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client):

> When using driver adapters with a custom output path for Prisma Client (since Prisma 5.9.0), directly referencing the generated client using a relative path is not recommended. Instead, add it as a linked dependency using your package manager.

### Why Disable Declaration Generation?

The TS2742 error occurs because TypeScript cannot serialize complex adapter types when generating `.d.ts` files. This is a known limitation:

- GitHub Issue: better-auth/better-auth#2036
- The better-auth library itself uses custom build tooling (tsdown) to work around this
- NestJS backend applications typically don't need to export type declarations (they're not libraries)

## References

- Prisma Custom Output Documentation: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client
- Better-Auth Prisma Adapter: https://www.better-auth.com/docs/adapters/prisma
- TypeScript TS2742 Issue: https://github.com/better-auth/better-auth/issues/2036
