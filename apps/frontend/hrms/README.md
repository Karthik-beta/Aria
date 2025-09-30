# HRMS Frontend

Next.js 15 application for employee and payroll experiences. It aligns with the monorepo’s four-agent charter and shares runtime contracts via `@aria/types`.

## Daily Runbook

| Task            | Command                                   | Notes                                                 |
| --------------- | ----------------------------------------- | ----------------------------------------------------- |
| Development     | `pnpm --filter hrms dev`                  | Turbopack with workspace root as compilation root.    |
| Lint            | `pnpm --filter hrms lint`                 | Uses `@aria/eslint-config`; keep zero lint debt.      |
| Type-check      | `pnpm --filter hrms exec tsc --noEmit`    | Extend shared tsconfig; no implicit anys.             |
| Build           | `pnpm --filter hrms build`                | CI-equivalent build; rely on caching for speed.       |
| Component tests | `pnpm --filter hrms test`                 | Add Vitest soon; colocate specs alongside components. |
| E2E             | `pnpm --filter hrms exec playwright test` | Future Playwright suite for onboarding/payroll flows. |

## Agent Alignment

### Simplicity Advocate

- Rely on Next.js App Router and server components for data-driven screens (benefits, leave balances).
- Prefer shared UI primitives; avoid ad-hoc styling if Tailwind or shared components suffice.
- Document all environment variables (SSO, payroll integrations) and keep them synchronized with `.env.example`.

### Type Safety Guardian

- Reference `@aria/types` HR domain models (`HR.Employee`, `HR.Payroll`) and avoid local duplications.
- Preserve the `@hrms/*` alias to keep imports maintainable.
- Validate third-party payloads (e.g., HRIS webhooks) with schema validators before use.

### Automation Steward

- Add new scripts only if they delegate to shared tooling; no bespoke build pipelines.
- Configure `turbo.json` outputs when introducing static asset generation or report exports.
- Ensure `.github/workflows/ci.yml` mirrors any added testing/linting stages.

### Quality Sentinel

- Plan Vitest suites for key components like the employee profile editor and time-off request flows.
- Record Playwright scenarios covering hire-to-retire, approvals, and payroll preview.
- Evaluate accessibility for HR-critical tasks: keyboard navigation, screen reader labels, form validation feedback.

## Testing & Automation Checklist

- [ ] Establish Vitest + Testing Library config reused across frontends.
- [ ] Seed Playwright with HR fixtures matching backend DTOs.
- [ ] Track coverage thresholds once Vitest suite exists (target ≥80%).
- [ ] Integrate CI artifacts (screenshots, traces) collection for flaky flows.

## Shared References

- Types: `import { HR } from "@aria/types"`.
- Utilities: `import { formatDateRange } from "@aria/utils"` once implemented.
- Backend base URL proxied behind Traefik (`hrms.api.localhost`).

Keep this document updated as features land. Note any exceptions to agent guidance inside PR summaries with follow-up tasks.
