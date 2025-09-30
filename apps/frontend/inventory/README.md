# Inventory Frontend

Next.js 15 experience focused on stock visibility, replenishment, and vendor coordination. Conforms to the Aria agent mandates for simplicity, type safety, automation, and quality.

## Daily Runbook

| Task        | Command                                        | Notes                                       |
| ----------- | ---------------------------------------------- | ------------------------------------------- |
| Development | `pnpm --filter inventory dev`                  | Turbopack + React server components.        |
| Lint        | `pnpm --filter inventory lint`                 | Shared ESLint config; zero warnings policy. |
| Type-check  | `pnpm --filter inventory exec tsc --noEmit`    | Extends `@aria/tsconfig/next.json`.         |
| Build       | `pnpm --filter inventory build`                | Same as CI pipeline; keep fast via caching. |
| Vitest      | `pnpm --filter inventory test`                 | Stand up when UI components arrive.         |
| Playwright  | `pnpm --filter inventory exec playwright test` | For replenishment/transfer flows.           |

## Agent Alignment

### Simplicity Advocate

- Lean on file-system routing for stock dashboards and vendor views; avoid manual route configuration.
- Consolidate shared table/grid components so they can port to other apps or a shared UI package.
- Keep tooling minimal—prefer Next.js data fetching semantics and avoid client-side state libraries until justified.

### Type Safety Guardian

- Treat `@aria/types` inventory contracts (`Inventory.Item`, `Inventory.Transfer`) as the source of truth.
- Maintain the `@inventory/*` import alias. Update ESLint + tsconfig when adding new alias paths.
- Introduce narrow type guards for parsing query params or CSV imports.

### Automation Steward

- Wrap new automation tasks (e.g., data generators) in `pnpm --filter inventory exec ...` scripts.
- Add artifact directories (coverage, reports) to `turbo.json` outputs to keep caches valid.
- Expand `.github/workflows/ci.yml` once Playwright/Vitest suites exist so CI mirrors local workflows.

### Quality Sentinel

- Prioritize tests for fast-moving stock flows: purchase order creation, warehouse transfers, cycle counts.
- Build Playwright smoke tests that trace inventory adjustments end-to-end with backend stubs.
- Validate accessibility for data-heavy tables: keyboard navigation, focus order, SR-friendly labeling.

## Testing & Automation Checklist

- [ ] Scaffold shared Vitest utilities for table components and data hooks.
- [ ] Mock backend inventory endpoints using MSW in tests to prevent contract drift.
- [ ] Capture performance metrics (LCP, TTFB) during CI using Lighthouse or custom probes when available.
- [ ] Integrate regression snapshots for critical inventory charts once stable.

## Shared References

- Types: `import { Inventory } from "@aria/types"`.
- Utilities: `import { formatQuantity } from "@aria/utils"` as helpers land.
- Backend access: proxied via Traefik (`inventory.api.localhost`).

Update this document alongside major feature merges to keep onboarding friction low.
