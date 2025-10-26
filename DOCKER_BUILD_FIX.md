# Docker Production Build Fix - TypeScript Module Resolution

## Problem

The Docker production build was failing with the error:

```
error TS2307: Cannot find module '@aria/types' or its corresponding type declarations.
```

This occurred during the `nest build` step in the backend Docker build, even though:
- Local builds worked fine
- The workspace packages (`@aria/types`, `@aria/utils`) were being built successfully (claimed "Done")
- pnpm workspace links were created correctly

## Root Cause

**The real issue was `*.tsbuildinfo` files being copied into the Docker context.**

When running `tsc --build`, TypeScript creates `.tsbuildinfo` files to track the build state and enable incremental compilation. These files were present locally from development builds and were being copied into the Docker image because `.dockerignore` only excluded:

```
# Typescript
*.tsbuildinfo  # Only excludes in root
next-env.d.ts
```

But NOT:
```
**/*.tsbuildinfo  # Needed to exclude in all subdirectories
```

### What Happened

1. Local development builds created `packages/types/tsconfig.tsbuildinfo` 
2. `.dockerignore` didn't exclude subdirectory `.tsbuildinfo` files
3. These files were copied into the Docker build context
4. During Docker build, when running `cd /app/packages/types && npx tsc --build tsconfig.json`:
   - TypeScript saw the existing `.tsbuildinfo` file
   - Assumed the project was already up-to-date
   - **Skipped building entirely** (no "Building project..." message)
   - No `dist/` folder was created
5. When backend tried to build, it couldn't find `@aria/types` because `dist/` didn't exist
6. This resulted in `TS2307: Cannot find module` error

### Proof from Build Logs

For `@aria/types`:
```
Projects in this build:
    * tsconfig.json

(NO "Building project" message!)
(Creates tsconfig.tsbuildinfo but NO dist/)
```

For `@aria/utils`:
```
Projects in this build:
    * tsconfig.json

Project 'tsconfig.json' is out of date because output file 'dist/tsconfig.tsbuildinfo' does not exist

Building project '/app/packages/utils/tsconfig.json'...
```

## Solution

### 1. Fix .dockerignore to Exclude All tsbuildinfo Files

**File**: `.dockerignore`

```diff
 # Typescript
 *.tsbuildinfo
+**/*.tsbuildinfo
 next-env.d.ts
```

This ensures that `.tsbuildinfo` files from ALL subdirectories are excluded from the Docker build context, forcing TypeScript to perform fresh builds inside the container.

### 2. Add `exports` Field to Workspace Packages (Bonus Fix)

While not strictly necessary for this specific error, adding proper `exports` fields improves modern Node.js module resolution:

**File**: `packages/types/package.json`
```json
{
  "name": "@aria/types",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    }
  }
}
```

**File**: `packages/utils/package.json`
```json
{
  "name": "@aria/utils",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    }
  }
}
```

### 3. Updated Dockerfile Builder Stage

**File**: `apps/backend/Dockerfile`

Key changes:

```dockerfile
# Builder stage - build the application
FROM base AS builder
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy all package.json files first (maintains workspace structure)
COPY packages/config-eslint/package.json ./packages/config-eslint/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/backend/package.json ./apps/backend/

# Copy all source code BEFORE install so workspace links are created correctly
# This is critical for monorepo builds - pnpm needs to see the full workspace structure
COPY packages ./packages
COPY apps/backend ./apps/backend

# Install all dependencies (including dev dependencies needed for build)
# Official pnpm recommendation: Install with full workspace context
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Generate Prisma client (required before any backend builds)
RUN cd /app/apps/backend && npx prisma generate

# Build workspace packages individually in dependency order
# Run TypeScript directly (not through pnpm) to ensure fresh builds
RUN cd /app/packages/types && npx tsc --build tsconfig.json
RUN cd /app/packages/utils && npx tsc --build tsconfig.json

# Build the backend application
RUN pnpm --filter backend build

# Prune development dependencies and create production deployment
# Note: pnpm v10+ requires --legacy flag for deploy
RUN pnpm --filter backend --prod deploy --legacy /app/deploy
```

### 4. Updated Dependencies Stage

```dockerfile
FROM base AS deps
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy all package.json files to maintain workspace structure
COPY packages/config-eslint/package.json ./packages/config-eslint/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/backend/package.json ./apps/backend/

# Copy source code for workspace packages (required for proper pnpm workspace linking)
# Official pnpm recommendation: Source must be present for workspace protocol to work correctly
COPY packages ./packages

# Install dependencies with BuildKit cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
```

## Why This Works

1. **Excludes stale build info**: `.dockerignore` now excludes all `.tsbuildinfo` files, forcing TypeScript to build fresh in Docker
2. **Proper workspace setup**: pnpm creates symlinks with full knowledge of the workspace structure
3. **BuildKit caching**: Speeds up subsequent builds significantly
4. **Explicit build order**: Builds dependencies before consumers
5. **Modern module resolution**: The `exports` field properly exposes dist files for Node.js

## Testing

Test the fix with:

```powershell
# Clean Docker build cache
docker builder prune -af

# Build production images
docker compose -f docker-compose.production.yml build

# Or build backend only
docker compose -f docker-compose.production.yml build backend
```

## Lessons Learned

1. **Always exclude build artifacts from Docker context**, including:
   - `dist/`, `build/`, `.next/`
   - `.tsbuildinfo`, `tsconfig.tsbuildinfo`
   - `node_modules` (already excluded)
   
2. **Use glob patterns in `.dockerignore`**:
   - `dist` excludes only root-level `dist`
   - `**/dist` excludes `dist` in all subdirectories

3. **TypeScript's incremental builds can silently skip** when `.tsbuildinfo` indicates project is up-to-date

4. **Debug Docker builds** by adding `ls -la` and `find` commands to inspect state at each layer

## References

- [Official pnpm Docker documentation](https://pnpm.io/docker)
- [TypeScript Build Mode](https://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript)
- [Node.js Package Entry Points](https://nodejs.org/api/packages.html#package-entry-points)
- [Docker .dockerignore reference](https://docs.docker.com/engine/reference/builder/#dockerignore-file)

## Agent Attribution

- **Simplicity Advocate**: Guided the use of official framework patterns and pnpm recommendations
- **Type Safety Guardian**: Identified the missing `exports` field for proper TypeScript resolution
- **Automation Steward**: Ensured BuildKit caching and proper CI/CD alignment
- **Official Docs Enforcer**: Verified solution against pnpm's official Docker documentation
- **Code Cleaner**: Identified the root cause (stale `.tsbuildinfo` files) through systematic debugging
