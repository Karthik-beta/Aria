# syntax=docker/dockerfile:1

# Production-ready NestJS + Prisma using Bun workspaces
# Key goals:
# - Multi-stage for small, secure images (build tools excluded from runtime)
# - Bun prod-only install in the final image to avoid broken virtual-store symlinks
# - Prisma: generate at build time in final image and migrate deploy at startup
# - Workspace-aware caching: manifests first, sources later to maximize cache hits

############################
# Base: Bun runtime/tooling
############################
FROM oven/bun:1 AS base
WORKDIR /app

########################################
# Deps: Full install for development CI
########################################
# Purpose:
# - Install all deps (including dev) to support local dev and builder caching
# - Copy manifests first to maximize docker layer caching
FROM base AS deps
WORKDIR /app

# Workspace manifests (root + package manifests only)
COPY bun.lock package.json turbo.json tsconfig.base.json ./
COPY packages/api-contract/package.json ./packages/api-contract/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Copy workspace sources needed for workspace protocol resolution
COPY packages ./packages

# Full install (dev + prod) for development/builder caching
RUN bun install --frozen-lockfile

##############################################
# Development: quick-start image for local dev
##############################################
FROM base AS development
WORKDIR /app

# Reuse deps from the deps stage to avoid reinstalling
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

# Add app sources
COPY bun.lock package.json turbo.json tsconfig.base.json ./
COPY apps/backend ./apps/backend

# Useful ports for dev
EXPOSE 3001 9229

# Dev workflow: migrate + start in watch mode
CMD ["sh", "-c", "cd /app/apps/backend && bun prisma migrate dev && bun --filter backend dev"]

##############################################
# Builder: compile TS, produce app build output
##############################################
FROM base AS builder
WORKDIR /app

# Copy manifests first for better caching
COPY bun.lock package.json turbo.json tsconfig.base.json ./
COPY packages/api-contract/package.json ./packages/api-contract/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Copy sources
COPY packages ./packages
COPY apps/backend ./apps/backend

# Install all deps (dev + prod) to enable build toolchain and generators
RUN bun install --frozen-lockfile

# Prisma config uses env("DATABASE_URL"), so provide a build-time placeholder.
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public
ENV DATABASE_URL=${DATABASE_URL}

# Generate Prisma Client for type-safe compilation (dev deps available here)
RUN cd /app/apps/backend && bun prisma generate

# Pre-compile shared workspace packages to JS to satisfy Node/Bun runtime
# (Node’s TS type-stripping does not apply for files under node_modules)
RUN cd /app/packages/types && bun tsc --build tsconfig.json
RUN cd /app/packages/utils && bun tsc --build tsconfig.json

# Optional: Turborepo remote cache
ARG TURBO_TOKEN
ARG TURBO_TEAM
ARG TURBO_API
ENV TURBO_TOKEN=${TURBO_TOKEN} \
    TURBO_TEAM=${TURBO_TEAM} \
    TURBO_API=${TURBO_API}

# Build backend (compiles NestJS to dist)
RUN --mount=type=cache,id=turbo-backend,target=/app/.turbo/cache bun --filter backend build

#######################################################
# Runner: minimal prod image with prod-only dependencies
# Strategy:
# - Install production dependencies in this final image using Bun
#   to keep Bun’s virtual-store links valid (no cross-layer copy)
# - Copy only compiled JS and required runtime assets
#######################################################
FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
# Put CLI tools in PATH (e.g., prisma, if present)
ENV PATH="/app/node_modules/.bin:${PATH}"

# Security: non-root user
RUN set -eux; \
    if command -v addgroup >/dev/null 2>&1; then \
      addgroup --system --gid 1001 nodejs; \
      adduser --system --uid 1001 --ingroup nodejs nestjs; \
    else \
      groupadd -g 1001 -r nodejs; \
      useradd -u 1001 -r -g nodejs -m -s /usr/sbin/nologin nestjs; \
    fi

# 1) Copy only the minimal manifests required for a workspace-aware prod install
# Root + per-package manifests (no sources yet)
COPY package.json bun.lock ./
COPY packages/api-contract/package.json ./packages/api-contract/package.json
COPY packages/config-typescript/package.json ./packages/config-typescript/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/utils/package.json ./packages/utils/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend/package.json ./apps/backend/package.json

# 2) Production install happens in the final image to keep symlinks valid
# Use BuildKit cache for Bun downloads; install prod-only to reduce size
# Single workspace install ensures all dependencies are resolved together
# Ignore lifecycle scripts in runtime image install (e.g., root prepare=husky)
RUN bun install --frozen-lockfile --production --ignore-scripts

# 3) Bring in the compiled application and only the runtime artifacts
# Backend compiled code + prisma schema/migrations
COPY --from=builder /app/apps/backend/dist /app/apps/backend/dist
COPY --from=builder /app/apps/backend/prisma /app/apps/backend/prisma
COPY --from=builder /app/apps/backend/prisma.config.ts /app/apps/backend/prisma.config.ts

# Prisma-generated client (required at runtime for demo-data CLI scripts)
COPY --from=builder /app/apps/backend/src/generated/prisma /app/apps/backend/src/generated/prisma

# Compiled service files required by demo-data scripts (stock-snapshot.js, etc.)
COPY --from=builder /app/apps/backend/dist/apps/inventory/services /app/apps/backend/src/apps/inventory/services
COPY --from=builder /app/apps/backend/dist/apps/asset /app/apps/backend/src/apps/asset

# Shared workspace packages: copy only their compiled JS outputs + package.json
# This keeps workspace symlinks valid and avoids shipping TS sources
COPY --from=builder /app/packages/types/dist /app/packages/types/dist
COPY --from=builder /app/packages/utils/dist /app/packages/utils/dist

# 4) Install OpenSSL for Prisma (required by oven/bun image)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*


# Runtime assets for health checks and startup scripts
COPY --chown=nestjs:nodejs apps/backend/docker-entrypoint.sh /app/docker-entrypoint.sh

USER root
RUN chmod +x /app/docker-entrypoint.sh && \
    apt-get update -y && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/* && \
    chown -R nestjs:nodejs /app/node_modules

USER nestjs

# Healthcheck and port
HEALTHCHECK --interval=15s --timeout=10s --start-period=120s --retries=10 \
    CMD curl -fsS http://localhost:3001/health || exit 1
EXPOSE 3001

ENTRYPOINT ["/app/docker-entrypoint.sh"]
