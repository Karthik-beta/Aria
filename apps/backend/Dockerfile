FROM node:22-alpine AS base

FROM base AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy all package.json files
COPY packages/config-eslint/package.json ./packages/config-eslint/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/backend/package.json ./apps/backend/

# Install ALL dependencies (including devDependencies needed for build)
RUN pnpm install --frozen-lockfile

FROM base AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy everything from deps (maintains pnpm virtual store structure)
COPY --from=deps /app ./

# Copy source files (overwrite empty dirs with actual source)
COPY packages ./packages
COPY apps/backend ./apps/backend

# Build shared packages first
RUN pnpm --filter "@aria/types" build || true
RUN pnpm --filter "@aria/utils" build || true

# Build the backend
RUN pnpm --filter backend build

# Use pnpm deploy to create a pruned production installation
RUN pnpm --filter backend --prod deploy --legacy /app/deploy

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy the deployed production dependencies
COPY --from=builder --chown=nestjs:nodejs /app/deploy ./

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./dist

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main"]
