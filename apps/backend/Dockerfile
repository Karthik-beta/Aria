# syntax=docker.io/docker/dockerfile:1
# Backend Dockerfile - Production-ready NestJS with Bun package manager 🚀
# Purpose: Multi-stage Docker build for minimal, production-ready NestJS container
# Architecture: Separates concerns into base, deps, development, builder, and runner stages
# Key Feature: Handles Bun's virtual store to avoid broken symlinks in production
#
# IMPORTANT - Bun Virtual Store Issue:
# Bun uses node_modules/.bun for efficient disk usage via symlinks and hard links
# These work fine during development but break when copied between Docker layers
# because symlinks use relative paths that don't resolve correctly
# Solution: Use rsync --copy-links to materialize dependencies (see builder stage below)

# Base stage with Bun package manager 🚀
FROM oven/bun:1 AS base
WORKDIR /app


# Dependencies Stage - Workspace-aware dependency installation 🧩
# Purpose: Install all workspace dependencies with Bun's virtual store
# Strategy: Copy manifests → sources → install (maximizes layer caching)
FROM base AS deps
WORKDIR /app

# Step 1: Copy workspace metadata first (enables layer caching)
# When dependencies don't change, Docker reuses this layer (faster rebuilds)
COPY bun.lock package.json turbo.json ./

# Step 2: Copy per-package manifests to preserve workspace structure
# Bun's workspace: protocol requires knowing about all packages before install
COPY packages/config-eslint/package.json ./packages/config-eslint/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/backend/package.json ./apps/backend/

# Step 3: Copy workspace sources (needed for workspace: protocol resolution)
# This allows Bun to create proper virtual store links between workspace packages
COPY packages ./packages

# Step 4: Install all dependencies (including dev dependencies)
# Uses BuildKit cache mount to speed up repeated builds (bypasses Docker layer cache)
# Note: --frozen-lockfile removed to allow builds with updated package.json
RUN --mount=type=cache,id=bun,target=/root/.bun bun install

# Development Stage - Local development convenience image 🛠️
# Purpose: Fast-start image for developers (avoids full rebuild on changes)
# Optimization: Reuses installed node_modules from deps stage
FROM base AS development
WORKDIR /app

# Reuse installed dependencies from deps stage (skip full reinstall)
# This dramatically speeds up local development (install happens once, reused)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy manifests and application source for development
COPY bun.lock package.json turbo.json ./
COPY apps/backend ./apps/backend

# Development ports:
#  - 3001: Backend API server
#  - 9229: Debugger (Node.js inspector protocol)
EXPOSE 3001 9229

# Development workflow:
#  1. Run database migrations (ensures schema is up-to-date)
#  2. Start NestJS in watch mode (auto-restart on file changes)
CMD ["sh", "-c", "cd /app/apps/backend && bun prisma migrate dev && bun --filter backend dev"]

# Builder Stage - Production build with dependency materialization 🏗️
# Purpose: Compile TypeScript and materialize dependencies for production
# Key Challenge: Bun's virtual store symlinks break when copied between layers
FROM base AS builder
WORKDIR /app

# Step 1: Copy workspace metadata (enables Docker layer caching)
COPY bun.lock package.json turbo.json ./

# Step 2: Copy per-package manifests (preserves workspace structure for Bun)
COPY packages/config-eslint/package.json ./packages/config-eslint/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/backend/package.json ./apps/backend/

# Step 3: Copy all workspace sources (required for workspace: protocol resolution)
COPY packages ./packages
COPY apps/backend ./apps/backend

# Step 4: Install dependencies (both dev + production)
# Note: --frozen-lockfile removed to allow builds with updated package.json
RUN --mount=type=cache,id=bun,target=/root/.bun bun install

# Step 5: Generate Prisma Client
# Must run before build so generated types are available for compilation
RUN cd /app/apps/backend && bun prisma generate

# Step 6: Pre-compile shared packages to JavaScript
# CRITICAL: Node.js v24+ disallows type-stripping in node_modules
# Error: ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING
# NestJS runtime needs compiled JS, not TS, for production
RUN cd /app/packages/types && bun tsc --build tsconfig.json
RUN cd /app/packages/utils && bun tsc --build tsconfig.json

# Step 7: Configure Turborepo remote cache (optional, for faster CI/CD)
# Pass via build args: --build-arg TURBO_TOKEN=xxx --build-arg TURBO_TEAM=xxx
ARG TURBO_TOKEN
ARG TURBO_TEAM
ARG TURBO_API

# Make Turborepo credentials available during build
ENV TURBO_TOKEN=${TURBO_TOKEN}
ENV TURBO_TEAM=${TURBO_TEAM}
ENV TURBO_API=${TURBO_API}

# Step 8: Build the backend application
# Turborepo handles parallel builds and caching
RUN --mount=type=cache,id=turbo-build-cache,target=/app/.turbo/cache bun --filter backend build

# Deploy Directory Creation - CRITICAL: Materialize dependencies for production 🚨
# Purpose: Create minimal production bundle with resolved dependencies
#
# WHY THIS IS CRITICAL:
# Bun creates symlinks in node_modules/ pointing to node_modules/.bun/virtual-store/
# These work during development but BREAK when copied with cp -r (relative paths)
# Result: Runtime errors like "ENOENT reading @nestjs/core" in production
#
# THE SOLUTION: rsync -aL (dereference ALL symlinks)
# - -a: Archive mode (preserves permissions, timestamps, etc.)
# - -L: Dereference symlinks (follow them to the actual files)
# This ensures ALL symlinks are resolved to real files
# Creates a production-ready node_modules that works standalone
#
# Why -L instead of --copy-links?
# --copy-links only resolves symlinks pointing OUTSIDE the source
# -L resolves ALL symlinks, including nested ones in .bun store
# This is necessary for packages like @prisma/engines that have complex symlink chains
RUN apt-get update && apt-get install -y rsync && rm -rf /var/lib/apt/lists/* && \
    mkdir -p /app/deploy && \
    \
    # Copy package manifests
    cp /app/package.json /app/deploy/ && \
    cp /app/apps/backend/package.json /app/deploy/backend_package.json && \
    \
    # Copy compiled application artifacts
    cp -r /app/apps/backend/dist /app/deploy/apps_backend_dist && \
    cp -r /app/apps/backend/prisma /app/deploy/prisma && \
    \
    # Copy workspace node_modules with COMPLETE symlink dereferencing
    # Step 1: Copy workspace root dependencies (hoisted packages)
    # Use -aL to dereference ALL symlinks, not just external ones
    rsync -aL /app/node_modules/ /app/deploy/node_modules/ && \
    \
    # Step 2: Copy backend-specific dependencies (non-hoisted packages)
    # In monorepos, some deps stay in app/node_modules instead of root
    if [ -d "/app/apps/backend/node_modules" ]; then \
    rsync -aL /app/apps/backend/node_modules/ /app/deploy/node_modules/ 2>/dev/null || true; \
    fi

# Production Runner Stage - Minimal runtime image 🏁
# Purpose: Only runtime artifacts, no build tools, minimal attack surface
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Security: Create non-root user for running the application
# Prevents privilege escalation in case of container compromise
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy production dependencies from builder stage
# These are fully materialized (symlinks resolved) from rsync step above
COPY --from=builder --chown=nestjs:nodejs /app/deploy/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/deploy/package.json ./package.json

# Add node_modules/.bin to PATH for CLI tools
# Required for: prisma (migration), prettier (formatting), etc.
ENV PATH="/app/node_modules/.bin:${PATH}"

# Copy compiled application code
# Built in builder stage with tsc compilation
COPY --from=builder --chown=nestjs:nodejs /app/deploy/apps_backend_dist ./dist

# Copy Prisma schema directory
# Needed for migration commands and database introspection
COPY --from=builder --chown=nestjs:nodejs /app/deploy/prisma ./prisma/

# Runtime tooling installation 🧰
# Installed in runner (not builder) to keep builder image smaller
USER root
RUN apt-get update && \
    # curl + wget: Healthcheck and debugging
    apt-get install -y curl wget --no-install-recommends && \
    # Clean up apt cache (reduces image size)
    rm -rf /var/lib/apt/lists/*
USER nestjs

# Copy and install entrypoint script
# Handles database migrations before starting the application
COPY --chown=nestjs:nodejs apps/backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Health check configuration 🩺
# How container orchestration knows the app is healthy
# start_period: 60s (accommodates slow migrations on first start)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fsS http://localhost:3001/health || exit 1

# Application port
# Backend API listens on port 3001
EXPOSE 3001

# Entrypoint: Production startup sequence 🚦
# 1. Deploy database migrations (with baselining for existing databases)
# 2. Start NestJS application
# 3. Handle graceful shutdown on SIGTERM
ENTRYPOINT ["/app/docker-entrypoint.sh"]
