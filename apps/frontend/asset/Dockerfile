FROM node:22-alpine AS base

FROM base AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config-eslint/package.json ./packages/config-eslint/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/frontend/asset/package.json ./apps/frontend/asset/

RUN pnpm install --frozen-lockfile

FROM base AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy everything from deps (maintains pnpm virtual store structure)
COPY --from=deps /app ./

# Copy source files (overwrite empty dirs with actual source)
COPY packages ./packages
COPY apps/frontend/asset ./apps/frontend/asset

ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_ENV=true

# Build shared packages first
RUN pnpm --filter "@aria/types" build || true
RUN pnpm --filter "@aria/utils" build || true

# Build the frontend app
RUN pnpm --filter asset build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_ENV=true

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/frontend/asset/public ./apps/frontend/asset/public

RUN mkdir -p .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/asset/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/asset/.next/static ./apps/frontend/asset/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/frontend/asset/server.js"]
