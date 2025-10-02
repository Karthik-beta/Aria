FROM node:22-alpine AS base

FROM base AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/backend/package.json ./apps/backend/

RUN pnpm install --frozen-lockfile

FROM base AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

RUN pnpm --filter backend build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./package.json
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main"]