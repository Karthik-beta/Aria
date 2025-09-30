# CRM Frontend

Next.js 15 + Turbopack app dedicated to customer lifecycle management. It shares contracts via `@aria/types`, uses `@aria/utils` for pure helpers, and adheres to the cross-agent guidelines defined in `AGENTS.md`.

## Daily Runbook

| Task                     | Command                                  | Notes                                                                |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------------------- |
| Start dev server         | `pnpm --filter crm dev`                  | Turbopack hot reload with workspace root as the project root.        |
| Lint                     | `pnpm --filter crm lint`                 | Flat ESLint config propagates from `@aria/eslint-config`.            |
| Type-check               | `pnpm --filter crm exec tsc --noEmit`    | Extends `@aria/tsconfig/next.json`; keep strict typing.              |
| Build                    | `pnpm --filter crm build`                | Mirrors CI output; should be green before PR.                        |
| Component tests (Vitest) | `pnpm --filter crm test`                 | Configure once components exist; colocate under `src/**/*.test.tsx`. |
| E2E tests (Playwright)   | `pnpm --filter crm exec playwright test` | Add `apps/frontend/CRM/e2e` to cover lead-to-deal lifecycle.         |

## Agent Alignment

### Simplicity Advocate

- Favor App Router conventions and server components; use React Client Components only when interactivity is required.
- Centralize CRM-specific form logic in reusable hooks/components to avoid copy-paste across feature routes.
- Record any environment variable usage (e.g., analytics keys) in `.env.example` and reference them here.

### Type Safety Guardian

- Source all API contracts from `@aria/types` (`CRM.Contact`, `CRM.PipelineStage`, etc.).
- Maintain the `@crm/*` path alias for internal modules and update both `tsconfig.json` and ESLint if new aliases are introduced.
- Use discriminated unions or branded types to capture CRM domain nuances (lead vs. opportunity) instead of runtime flags.

### Automation Steward

- Add new scripts to `package.json` only as thin wrappers around shared tooling (Vitest, Playwright, Storybook when introduced).
- If tasks produce artifacts (reports, coverage), list them in `turbo.json` outputs to keep caching deterministic.
- Mirror any new QA task inside `.github/workflows/ci.yml` so CI stays in lockstep with local workflows.

### Quality Sentinel

- Target high-value flows for Playwright coverage: lead import, pipeline stage dragging, activity logging.
- Use Vitest DOM testing library utilities for component-level accessibility assertions.
- Keep Storybook (planned) stories in sync with Vitest tests to catch regressions early.

## Testing & Automation Checklist

- [ ] Implement Vitest setup using shared test utilities from `@aria/utils/testing` once available.
- [ ] Seed Playwright with fixture data that mirrors backend DTOs to prevent contract drift.
- [ ] Enforce `pnpm lint` and `pnpm test` in pre-commit hooks once the repo adopts them.
- [ ] Configure bundle-size checks when CRM dashboards grow past baseline limits.

## Shared References

- Types: `import { CRM } from "@aria/types"`.
- Utilities: `import { formatPhoneNumber } from "@aria/utils"` (pending helper).
- Backend routing: traffic proxied via Traefik (`crm.api.localhost` inside Docker).

Document deviations from these expectations and list remediation tasks in your PR summaries.
