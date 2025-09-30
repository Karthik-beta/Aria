# Asset Frontend

Next.js 15 + Turbopack single-page workspace for managing the asset domain. It consumes backend APIs via shared contracts in `@aria/types` and shares pure helpers with the monorepo through `@aria/utils`.

## Daily Runbook

| Task               | Command                                    | Notes                                                          |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------- |
| Start dev server   | `pnpm --filter asset dev`                  | Runs with Turbopack from the monorepo root.                    |
| Lint               | `pnpm --filter asset lint`                 | Uses `@aria/eslint-config` and the shared flat config.         |
| Type-check         | `pnpm --filter asset exec tsc --noEmit`    | Extends `@aria/tsconfig/next.json`; keep zero `any`.           |
| Build              | `pnpm --filter asset build`                | Mirrors CI build; should stay fast under Turborepo caching.    |
| Run tests (Vitest) | `pnpm --filter asset test`                 | Add specs in `src/**/*.test.tsx?`; wire once components exist. |
| Run Playwright E2E | `pnpm --filter asset exec playwright test` | Add once flows are modeled; stash artifacts under `e2e/`.      |

## Agent Alignment

### Simplicity Advocate

- Scaffold new routes via `pnpx next` conventions; favor server components and RSC data fetching.
- Keep styling through Tailwind 4 defaults. Shared UI primitives should graduate into a future `packages/ui` library instead of local duplication.
- Document any environment variables in this README and mirror them in `apps/frontend/asset/.env.example`.

### Type Safety Guardian

- All types originate from `@aria/types`. Import DTOs and enums rather than redefining shapes.
- Preserve the `@asset/*` path alias inside `tsconfig.json` and ESLint to avoid fragile relative imports.
- Use `zod` or `valibot` (when introduced) alongside shared types for runtime validation of API payloads.

### Automation Steward

- Never bypass Turborepo scripts; rely on `pnpm lint|test|build` from the repo root for CI parity.
- Declare any new generated assets in `turbo.json` outputs so caching remains effective.
- If the app introduces Playwright or Vitest commands, expose them as scripts in `package.json` and ensure `.github/workflows/ci.yml` runs them.

### Quality Sentinel

- Co-locate Vitest component tests next to their source files using the `.test.tsx` suffix; mock network calls via `vi.mock`.
- Prepare Playwright scenarios for critical asset workflows (inventory listing, asset assignment lifecycle) under `apps/frontend/asset/e2e`.
- Audit accessibility: confirm interactive elements have keyboard support and ARIA labels.

## Testing & QA Roadmap

- [ ] Stand up Vitest config that mirrors the shared testing utilities once UI work begins.
- [ ] Backfill API contract tests that validate mocked backend responses match `@aria/types` definitions.
- [ ] Add Playwright smoke suite covering at least login → asset dashboard navigation before GA.
- [ ] Integrate visual regression snapshots once the component library stabilizes.

## Shared References

- Types: `import { Asset } from "@aria/types"`.
- Utilities: `import { formatCurrency } from "@aria/utils"`.
- Backend endpoints resolve to the service routed through Traefik (`asset.api.localhost` in Docker).

Keep this README current. Any deviation from the agent guidelines must be justified with a note plus a follow-up action item.
