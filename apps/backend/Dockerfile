# Backend Dockerfile - Multi-stage build for NestJS
# Supports both development and production environments

# Base stage with Node.js and pnpm
FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache libc6-compat

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
COPY apps/backend/package.json ./apps/backend/

# Install dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Development stage - for local development with hot reload
FROM base AS development
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy source code
COPY packages ./packages
COPY apps/backend ./apps/backend

# Expose ports
EXPOSE 3001 9229

# Development entrypoint: Run migrations then start dev server
# Official Prisma recommendation: Use migrate dev for development environments
CMD ["sh", "-c", "cd /app/apps/backend && npx prisma migrate dev && pnpm dev"]

# Builder stage - build the application
FROM base AS builder
WORKDIR /app

# Copy everything from deps (includes node_modules and pnpm store)
COPY --from=deps /app ./

# Copy all source code (will overwrite package.json files with same content)
COPY turbo.json ./
COPY packages ./packages
COPY apps/backend ./apps/backend

# Generate Prisma client FIRST (required for backend build)
# This ensures the Prisma Query Engine is present and types are available
RUN cd /app/apps/backend && npx prisma generate

# Build shared packages (in dependency order)
# These create packages/*/dist directories
RUN pnpm --filter "@aria/types" build
RUN pnpm --filter "@aria/utils" build

# Build the backend application
RUN pnpm --filter backend build

# Prune development dependencies and create production deployment
RUN pnpm --filter backend --prod deploy --legacy /app/deploy

# Production runner stage - minimal production image
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy production dependencies from deploy
COPY --from=builder --chown=nestjs:nodejs /app/deploy/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/deploy/package.json ./package.json

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./dist

# Copy Prisma schema and generated client if exists
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma ./prisma/
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/generated ./generated/

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Copy entrypoint script for production migration handling
COPY --chown=nestjs:nestjs apps/backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Switch to non-root user
USER nestjs

# Expose application port
EXPOSE 3001

# Production entrypoint: Handle baseline migration resolution and apply pending migrations
# Official Prisma recommendation: https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining
# Reference: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
ENTRYPOINT ["/app/docker-entrypoint.sh"]
