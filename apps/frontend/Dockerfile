# syntax=docker/dockerfile:1
# Frontend Dockerfile - Multi-stage build for Next.js 16 🚀
# Based on official Next.js with-docker example (best practices) 📚
# Reference: https://github.com/vercel/next.js/tree/canary/examples/with-docker

# Base stage with Bun package manager 🧱
# Using Bun's official image which includes Node.js runtime
FROM oven/bun:1.3.1@sha256:9c5d3c92b234b4708198577d2f39aab7397a242a40da7c2f059e51b9dc62b408 AS base
WORKDIR /app

# Dependencies stage - install all dependencies 📦
FROM base AS deps
WORKDIR /app

# Copy workspace configuration files
COPY bun.lock package.json turbo.json tsconfig.base.json ./

# Copy all package.json files to maintain workspace structure
COPY packages/api-contract/package.json ./packages/api-contract/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/report-export/package.json ./packages/report-export/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/

# Install dependencies using the committed lockfile
RUN bun install --frozen-lockfile

# Copy shared packages source (JIT pattern - no build needed, consumed as TypeScript)
COPY packages ./packages

# Copy backend source for Prisma types
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/tsconfig.json ./apps/backend/tsconfig.json
COPY apps/backend/tsconfig.build.json ./apps/backend/tsconfig.build.json
COPY apps/backend/tsconfig.public-types.json ./apps/backend/tsconfig.public-types.json

# Development stage - for local development with hot reload 🛠️
FROM base AS development
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules

# Copy workspace files
COPY bun.lock package.json turbo.json tsconfig.base.json ./

# Copy source code
COPY packages ./packages
COPY apps/frontend ./apps/frontend

# Set environment
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Expose ports
EXPOSE 3000

# Development command (will be overridden by docker-compose)
CMD ["bun", "--filter", "frontend", "dev"]

# Builder stage - build the Next.js application 🏗️
FROM base AS builder
WORKDIR /app

# Prisma type generation needs OpenSSL available in the build stage.
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

# Copy everything from deps (includes node_modules and source files)
COPY --from=deps /app ./

# Copy frontend source files
COPY apps/frontend ./apps/frontend

# Set build environment
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=1

# CRITICAL: Accept NEXT_PUBLIC_* variables as build args
# Next.js embeds NEXT_PUBLIC_* env vars into the client bundle at BUILD time
# For same-origin deployments (proxy handles routing), use empty string
# For separate backend domains, set to the backend URL (e.g., https://api.example.com)
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# APP_TIME_ZONE is the backend-owned business-date authority. next.config.ts
# validates it and embeds the same value as NEXT_PUBLIC_APP_TIME_ZONE.
ARG APP_TIME_ZONE
ENV APP_TIME_ZONE=${APP_TIME_ZONE}
RUN test -n "$APP_TIME_ZONE"

# Prisma config uses env("DATABASE_URL"), so provide a build-time placeholder.
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public
ENV DATABASE_URL=${DATABASE_URL}

# Generate Prisma client before building (required for backend types)
RUN cd apps/backend && bun prisma generate

# CRITICAL: Compile shared packages before backend/frontend builds
# Production requires compiled packages - JIT pattern only works in Next.js dev mode
RUN cd packages/api-contract && bun tsc -p tsconfig.build.json && cp -r src/trpc src/apps dist/
RUN cd packages/types && bun tsc --build tsconfig.json
RUN cd packages/utils && bun tsc --build tsconfig.json
RUN cd packages/report-export && bun tsc --build tsconfig.build.json

# Build backend (required for tRPC types that frontend imports).
# Railway's cache mounts require a service-specific cache key, so this shared
# Dockerfile deliberately relies on ordinary Docker layer caching instead.
RUN bun --filter backend build

# Build frontend using Turbo.
RUN bun x turbo run build --filter=frontend...

# Production runner stage - minimal production image with standalone output 🏁
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security (following official Next.js Docker pattern)
RUN set -eux; \
    if command -v addgroup >/dev/null 2>&1; then \
      addgroup --system --gid 1001 nodejs; \
      adduser --system --uid 1001 --ingroup nodejs nextjs; \
    else \
      groupadd -g 1001 -r nodejs; \
      useradd -u 1001 -r -g nodejs -m -s /usr/sbin/nologin nextjs; \
    fi

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
# Official pattern: Copy standalone output to root, then copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public

# Health check - require the dedicated readiness route to return exactly 200
HEALTHCHECK --interval=60s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "const request=require('http').get('http://localhost:3000/ready/',(response)=>process.exit(response.statusCode===200?0:1));request.on('error',()=>process.exit(1))"

# Switch to non-root user
USER nextjs

# Expose application port 📡
EXPOSE 3000

# Environment variables must be redefined at run time (will be set by docker-compose)
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the Next.js standalone server ▶️
# Standalone output creates: /app/.next/standalone structure
# In this monorepo output, server.js is at /app/apps/frontend/server.js
CMD ["node", "apps/frontend/server.js"]
