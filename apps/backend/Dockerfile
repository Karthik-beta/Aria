# Backend Dockerfile - multi-stage build for NestJS
# Purpose: produce a minimal, production-ready container for the NestJS backend
# This file intentionally separates concerns into stages: base, deps (install),
# development (local dev), builder (compile + bundle), and runner (final image).

# Base stage with Node.js and pnpm
FROM node:24-alpine AS base
WORKDIR /app
# Enable corepack and prepare the pnpm client used for installs/builds.
RUN corepack enable && corepack prepare pnpm@latest --activate
# Install lightweight compatibility libs used by some native deps on Alpine
RUN apk add --no-cache libc6-compat

# Dependencies stage (install step)
FROM base AS deps
WORKDIR /app

# Copy only workspace metadata first (lockfile + root manifests) so layer cache
# can be reused when dependencies don't change.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy per-package package.json files to preserve workspace shape for pnpm
# (this allows pnpm to create proper virtual store / workspace links).
COPY packages/config-eslint/package.json ./packages/config-eslint/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/backend/package.json ./apps/backend/

# Copy workspace sources before running install so pnpm can link workspace
# packages (workspace: protocol) correctly during installation.
COPY packages ./packages

# Install all dependencies (including devDeps required for building).
# Uses BuildKit cache mount for pnpm store to speed up repeated builds.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Development stage (convenience image for local dev)
FROM base AS development
WORKDIR /app

# Reuse installed modules and workspace layout from deps stage so local dev
# can start quickly without re-running a full install.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy manifests and backend sources for development use
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/backend ./apps/backend

# Ports: 3001 for app, 9229 for debugger (when needed)
EXPOSE 3001 9229

# Development command: run migrations then start NestJS in watch mode
CMD ["sh", "-c", "cd /app/apps/backend && npx prisma migrate dev && pnpm dev"]

# Builder stage (compile and bundle)
FROM base AS builder
WORKDIR /app

# Copy manifests first to leverage layer cache when dependencies do not change
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy per-package manifests to preserve workspace layout for pnpm
COPY packages/config-eslint/package.json ./packages/config-eslint/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/backend/package.json ./apps/backend/

# Copy full workspace sources before install so pnpm can correctly link
# workspace packages during installation
COPY packages ./packages
COPY apps/backend ./apps/backend

# Install all deps (dev + prod) required to build the project
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Generate Prisma client early so generated client types are available
RUN cd /app/apps/backend && npx prisma generate

# Build internal shared packages first (ensure dist/ outputs exist)
# We invoke tsc directly for predictable incremental behavior inside the image
RUN cd /app/packages/types && npx tsc --build tsconfig.json
RUN cd /app/packages/utils && npx tsc --build tsconfig.json

# Build the backend application (Nest compile step)
RUN pnpm --filter backend build

# Create a deploy directory with only production dependencies and files
# Note: pnpm v10+ requires either inject flags or the --legacy deploy behavior
RUN pnpm --filter backend --prod deploy --legacy /app/deploy

# Production runner stage - minimal image containing only runtime artifacts
FROM base AS runner
WORKDIR /app

# Runtime mode
ENV NODE_ENV=production

# Create a non-root user to run the app (security best practice)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy only production node_modules and package.json from the builder's deploy
COPY --from=builder --chown=nestjs:nodejs /app/deploy/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/deploy/package.json ./package.json

# Copy compiled application code
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./dist

# Copy Prisma artifacts if generated (schema + client)
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma ./prisma/
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/generated ./generated/

# Ensure the generated Prisma client is available under the runtime package name 'db'
# so runtime imports like `import { PrismaClient } from 'db'` resolve correctly.
# Copy the generated client into node_modules/db at build time so node's resolver
# can load it via require('db') in the production container.
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/generated/prisma ./node_modules/db

# Lightweight healthcheck for container orchestration to probe the app
# Use curl (installed in runner) which is available on Alpine; wget may not
# be present in minimal images and can cause false unhealthy signals.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:3001/health || exit 1

# Copy entrypoint that handles migration baseline resolution and startup
COPY --chown=nestjs:nestjs apps/backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Use the non-root user for runtime
USER nestjs

# Expose application port
EXPOSE 3001

# Entrypoint handles production-friendly migration and then starts the process
ENTRYPOINT ["/app/docker-entrypoint.sh"]
 
# Install runtime tooling required by the entrypoint and healthcheck.
# We install Prisma CLI globally so `prisma` and `npx prisma` work inside the
# production container (necessary for `prisma migrate deploy` in the entrypoint).
# Also install curl to make the HEALTHCHECK reliable on Alpine base images.
USER root
RUN apk add --no-cache curl && npm install -g prisma@6.17.1 --location=global && chown -R nestjs:nodejs /app
USER nestjs
