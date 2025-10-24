# Frontend Dockerfile - Multi-stage build for Next.js 16
# Supports both development and production environments

# Base stage with Node.js and pnpm
# Using Node.js 20.15.1 - last version before transformAlgorithm bug
# Node.js 20.16+ introduced kState transformAlgorithm streaming bug
# Next.js 16 requires Node.js >= 20.9.0, so v18 doesn't work
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

# Install dependencies
RUN pnpm install --frozen-lockfile

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

# Copy everything from deps
COPY --from=deps /app ./

# Copy source files
COPY turbo.json ./
COPY packages ./packages
COPY apps/frontend ./apps/frontend

# Set build environment
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=1

# Build shared packages first
RUN pnpm --filter "@aria/types" build || true
RUN pnpm --filter "@aria/utils" build || true

# Build the frontend application with standalone output
RUN pnpm --filter frontend build

# Production runner stage - minimal production image with standalone output
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/apps/frontend/public ./public

# Create .next directory with proper permissions
RUN mkdir .next && chown nextjs:nodejs .next

# Copy standalone server and dependencies
# Next.js standalone output includes all necessary files
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# Start the Next.js standalone server
CMD ["node", "apps/frontend/server.js"]
