# Dependency Management Guide

## Key Dependencies

### Root Workspace

| Package | Version | Purpose |
| --- | --- | --- |
| `@biomejs/biome` | ^2.4.6 | Linting & formatting |
| `turbo` | ^2.8.20 | Monorepo build orchestration |
| `prisma` | ^7.2.0 | Database toolkit (CLI) |
| `husky` | ^9.1.7 | Git hooks |

### Backend (`apps/backend`)

| Package | Version | Purpose |
| --- | --- | --- |
| `@nestjs/common` | ^11.1.10 | NestJS framework |
| `@trpc/server` | ^11.8.1 | tRPC server |
| `@prisma/client` | ^7.5.0 | Database client |
| `@prisma/adapter-pg` | ^7.4.2 | PostgreSQL adapter for Prisma |
| `better-auth` | ^1.5.4 | Authentication |
| `zod` | ^4.3.6 | Runtime validation |
| `express` | ^5.2.1 | HTTP server |
| `ws` | ^8.18.3 | WebSocket |
| `typescript` | ^5.9.3 | TypeScript compiler |
| `jest` | ^29.7.0 | Testing framework |

### Frontend (`apps/frontend`)

| Package | Version | Purpose |
| --- | --- | --- |
| `next` | ^16.2.0 | React meta-framework |
| `react` | ^19.2.4 | UI library |
| `@trpc/react-query` | ^11.8.1 | tRPC React client |
| `@tanstack/react-query` | ^5.90.12 | Server state management |
| `@tanstack/react-table` | ^8.21.3 | Table component |
| `@sentry/nextjs` | ^10.45.0 | Error monitoring |
| `tailwindcss` | ^4.1.18 | CSS framework |
| `recharts` | ^3.6.0 | Charts |
| `zod` | ^4.3.6 | Runtime validation |
| `zustand` | ^5.0.9 | Client state management |
| `motion` | ^12.23.26 | Animations |
| `vitest` | ^4.0.18 | Unit testing |
| `@playwright/test` | ^1.57.0 | E2E testing |
| `typescript` | 5.9.3 | TypeScript compiler |

### Shared Packages

All internal packages use `workspace:*` protocol:

- `@aria/types` — Shared TypeScript types and Zod schemas
- `@aria/utils` — Pure utility functions
- `@aria/api-contract` — Type-only tRPC contract layer
- `@aria/tsconfig` — Shared TypeScript configurations

## Peer Dependencies

### Known Warnings (Safe to Ignore)

**kbar → react-virtual peer dependency:**

```
kbar 0.1.0-beta.48
└─┬ react-virtual 2.10.4
  └── ✕ unmet peer react@"^16.6.3 || ^17.0.0": found 19.2.x
```

Safe — React 19 is backward compatible. No action needed until kbar updates.

### React Types Override

The frontend `package.json` includes an `overrides` section to pin `@types/react` and `@types/react-dom` to `19.2.2` for compatibility.

## Updating Dependencies

### Process

1. **Check for updates:**

   ```bash
   bun outdated
   ```

2. **Update packages:**

   ```bash
   bun update --latest
   ```

3. **Validate after updating:**

   ```bash
   bun run lint
   bun run test
   bun run typecheck
   bun run build
   ```

4. **Review changes:**
   - Check for breaking changes in changelogs
   - Review peer dependency warnings
   - Test critical user flows

### Breaking Change Checklist

When a major version update occurs:

- [ ] Read the package's migration guide
- [ ] Check shadcn/ui components if a UI library updated
- [ ] Run full validation suite
- [ ] Test in development mode
- [ ] Review console warnings
- [ ] Test critical user flows manually

## Common Issues & Solutions

### Issue: Type errors after update

1. Check if `@types/*` packages need updating
2. Shared packages use JIT — no rebuild needed
3. Clear cache: `rm -rf node_modules/.cache`

### Issue: Peer dependency warnings

1. Check if the warning is safe (usually is)
2. If needed, add to `overrides` in the relevant `package.json`
3. Document the override in this file

### Issue: Build fails after update

1. Check for breaking changes in updated packages
2. Search GitHub issues for migration guides
3. Revert the problematic update and fix incrementally

## Cleanup Notes

The frontend `devDependencies` still contains unused ESLint packages (`@eslint/eslintrc`, `@eslint/js`) left over from the migration to Biome. These have no effect (no ESLint config files exist) but can be safely removed.

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [React 19 Release Notes](https://react.dev/blog/2024/04/25/react-19)
- [Next.js Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading)
- [TypeScript Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/overview.html)
