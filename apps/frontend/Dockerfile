# syntax=docker.io/docker/dockerfile:1
# Frontend Dockerfile - Multi-stage build for Next.js 15
# Based on official Next.js with-docker example
# Reference: https://github.com/vercel/next.js/tree/canary/examples/with-docker

# Base stage with Node.js and pnpm
# Using Node.js 20.15.1 - last version before transformAlgorithm bug
# Node.js 20.16+ introduced kState transformAlgorithm streaming bug
# Next.js 15 requires Node.js >= 20.9.0, so v18 doesn't work
# See: https://github.com/vercel/next.js/issues/68319
# See: https://github.com/vercel/next.js/discussions/75995
FROM node:20.15.1-slim AS base
WORKDIR /app
# Install pnpm directly via npm to avoid Node.js 20.15.1 corepack signature issues
RUN npm install -g pnpm@10.17.1

# Dependencies stage - install all dependencies
FROM base AS deps
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy all package.json files to maintain workspace structure
COPY packages/config-eslint/package.json ./packages/config-eslint/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/

# Install dependencies with BuildKit cache mount for faster rebuilds
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy shared packages source (JIT pattern - no build needed, consumed as TypeScript)
COPY packages ./packages

# Copy backend source for Prisma types
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/tsconfig.json ./apps/backend/tsconfig.json
COPY apps/backend/tsconfig.build.json ./apps/backend/tsconfig.build.json

# Development stage - for local development with hot reload
FROM base AS development
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy source code
COPY packages ./packages
COPY apps/frontend ./apps/frontend

# Set environment
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Expose ports
EXPOSE 3000

# Development command (will be overridden by docker-compose)
CMD ["pnpm", "--filter", "frontend", "dev"]

# Builder stage - build the Next.js application
FROM base AS builder
WORKDIR /app

# Copy everything from deps (includes node_modules and source files)
COPY --from=deps /app ./

# Copy frontend source files
COPY turbo.json ./
COPY apps/frontend ./apps/frontend

# Set build environment
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=1

# CRITICAL: Accept NEXT_PUBLIC_* variables as build args
# Next.js embeds NEXT_PUBLIC_* env vars into the client bundle at BUILD time
# These must be passed as build args, not just runtime environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

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
RUN pnpm turbo build --filter=frontend...

# Production runner stage - minimal production image with standalone output
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security (following official Next.js Docker pattern)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
# Official pattern: Copy standalone output to root, then copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./app/apps/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/public ./app/apps/frontend/public

# Health check - accept 2xx and 3xx status codes (redirects are OK)
HEALTHCHECK --interval=60s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', (r) => process.exit((r.statusCode >= 200 && r.statusCode < 400) ? 0 : 1))"

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# Environment variables must be redefined at run time (will be set by docker-compose)
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the Next.js standalone server
# Standalone output creates: /app/.next/standalone structure
# The server.js file is generated at the root of standalone output
CMD ["node", "app/apps/frontend/server.js"]
