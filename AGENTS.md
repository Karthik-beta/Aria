# Aria Development Agents

> Guardians of a modular, type-safe, and relentlessly simple B2B ERP suite.

## Operating Context

Aria is a pnpm-powered Turborepo that hosts the entire ERP surface area under one roof. The backend NestJS service lives in `apps/backend`, four Next.js 15 App Router frontends (asset, CRM, hrms, inventory) live in `apps/frontend/*`, and reusable building blocks reside in `packages/config-eslint`, `packages/config-typescript`, `packages/types`, and `packages/utils`. Docker Compose plus Traefik orchestrate deployment, and `.github/workflows/ci.yml` guards the main branch. Every contribution must respect this living architecture.

### Shared Principles

- **Simplicity over cleverness**: reach first for framework conventions and generator commands before authoring bespoke config or scripts.
- **Types-first**: all code paths—from database contracts to React components—derive their types from shared sources to eliminate drift.
- **Automation everywhere**: the root scripts (`pnpm lint`, `pnpm test`, `pnpm build`, `pnpm dev`) remain the single entry points for validation and local orchestration.
- **Quality as a default**: unit, integration, and E2E coverage evolve in lockstep with features; no feature is “done” until the relevant tests are green.

The four agents below interpret and enforce these principles from complementary perspectives.

## Agent 1 – Simplicity Advocate

### Mission

Keep the codebase frictionless by stripping complexity, honoring framework defaults, and ensuring every structural decision justifies itself against a simpler alternative.

### Guardrails

1. **Convention as the baseline**: scaffold new resources with official CLIs (`pnpx next`, `pnpx nest g`, `pnpm dlx playwright install`) and keep generated layouts intact unless there is a proven need to customize.
2. **Minimal configuration surface**: when a config change is essential, centralize it in the relevant package (e.g., `packages/config-typescript`) and share it across apps instead of repeating snippets.
3. **Composable monorepo layout**: new apps belong inside `apps/<domain>/<name>` and new shared libraries inside `packages/*`, maintaining the existing Turborepo graph.

### Playbook by Surface

**Monorepo & Workspace**

- Keep `pnpm-workspace.yaml` aligned with the directory structure. Any new directory added to `apps` or `packages` must be reflected there.
- Favor incremental Turborepo pipelines—extend `turbo.json` tasks rather than adding ad-hoc scripts in individual package manifests.

**Frontend Apps (`apps/frontend/*`)**

- Lean on Next.js defaults: use `app/` routing, server components where possible, and the shared Tailwind 4 toolchain. Avoid ejecting from Turbopack.
- Share UI primitives through a future `packages/ui` module instead of duplicating React components across apps—plan ahead when introducing new UI foundations.
- Align environment variables through `next.config.ts` and `.env` definitions scoped by app; document any addition in the corresponding README.

**Backend (`apps/backend`)**

- Generate modules, controllers, and services via `nest g` to maintain Nest’s module graph. Store feature modules under `src/modules/<domain>`.
- Centralize shared pipes, guards, and interceptors; cross-cutting concerns belong in `src/common`.
- Keep transport adapters (HTTP, messaging) slim and delegate to services or repositories for real work.

**Shared Packages (`packages/*`)**

- `@aria/tsconfig` remains the single source for TypeScript compiler options; apps extend the closest matching config (`next.json`, `nest.json`, `base.json`).
- `@aria/types` houses cross-app contracts. Promote a types-first workflow by exporting domain-level namespaces (e.g., `Asset`, `Inventory`) and referencing them across frontends and backend.
- `@aria/utils` stores pure, deterministic helpers. Anything with side effects (I/O, network) should live with the consuming application instead.
- `@aria/eslint-config` is the place to capture lint strategy updates—avoid app-specific `.eslintrc` overrides unless absolutely necessary.

### Anti-pattern Watchlist

- Duplicated configuration snippets or scripts inside individual packages.
- Overly bespoke webpack configuration—Next.js 15 + Turbopack should stay unmodified.
- Business logic baked into UI components or Nest controllers instead of dedicated services/utilities.

## Agent 2 – Type Safety Guardian

### Mission

Guarantee that every boundary is strongly typed, ensuring backend, frontends, tests, and utilities compile with zero `any` leakage and maintain compatibility through shared contracts.

### Core Directives

1. **Unified compiler settings**: all `tsconfig.json` files must extend `@aria/tsconfig`. No ad-hoc compilerOption overrides that contradict the shared baseline.
2. **Source-of-truth types**: domain schemas, DTOs, API payloads, and shared enums originate in `packages/types/src`. Update the barrel exports and re-run the package build (`pnpm --filter @aria/types build`) after every change.
3. **Path discipline**: rely on the configured path aliases—`@aria/types`, `@aria/utils`, and app-level aliases (e.g., `@asset/*`). Update `tsconfig.json` and `eslint` settings together whenever you add or rename an alias.
4. **Generics before duplication**: when multiple call sites share structural similarities, extract generic utilities or mapped types rather than copying interfaces.

### Integration Touchpoints

- **Backend ↔ Frontend contracts**: publish API response/request contracts in `packages/types` and import them into Nest controllers and Next.js data fetchers. Validate runtime payloads via DTOs referencing the same interfaces.
- **Database schema alignment**: once Prisma is introduced, generate types from the Prisma schema and map them to exported contracts; never handcraft overlapping types.
- **Testing**: write test helpers in TypeScript and share stubs/mocks via `packages/types/testing` (create this namespace when needed) to prevent divergence between production and test data shapes.

### Review Checklist

- [ ] Does the change compile under `pnpm build` without type errors for the touched packages?
- [ ] Are newly introduced types exported from a central index to prevent deep import drift?
- [ ] If a contract changed, did all consumers (frontends, backend, tests) adopt the new signature?
- [ ] Are third-party library typings (`@types/*`) added where required and scoped to the package that needs them?

## Agent 3 – Automation Steward

### Mission

Preserve the reliability of the developer experience by enforcing scripted workflows, comprehensive CI coverage, and reproducible environments from laptop to production.

### Responsibilities

- **Script parity**: every package that supports `dev`, `build`, `lint`, or `test` must expose scripts that proxy to shared tooling. Prefer `turbo run` and workspace inheritance over bespoke commands.
- **Pipeline hygiene**: when a new task is introduced (e.g., Playwright E2E), extend `turbo.json` and `.github/workflows/ci.yml` accordingly. The CI pipeline should mirror the local workflows exactly.
- **Caching mindfulness**: configure Turborepo task outputs carefully—ensure new packages define appropriate `outputs` in `turbo.json` to unlock caching and avoid unnecessary rebuilds.
- **Environment reproducibility**: document required environment variables in package-level README files and sync them with `.env.example` templates. Docker Compose definitions must stay in sync with service scripts.
- **Dependency discipline**: manage dependencies via pnpm workspaces. After adding a dependency, run `pnpm install` at the root to refresh the lockfile and commit the change.

### Automation Playbook

- Guard root commands: `pnpm lint`, `pnpm test`, and `pnpm build` should remain green at all times. If they fail locally, fix the issue before opening a PR.
- Extend Git hooks or pre-commit tooling inside a future `packages/config-linting` package if additional automation is needed; keep hooks optional yet documented.
- Monitor CI durations via GitHub Actions summaries. If a job grows beyond acceptable limits, investigate caching opportunities or test parallelization.
- Keep Docker images minimal: update Dockerfiles to use multistage builds, and verify they continue to run with a single `docker compose up` using the definitions in `docker-compose.yml`.

## Agent 4 – Quality Sentinel

### Mission

Embed quality gates into daily work so that regressions are caught before they hit production and confidence remains high as the suite scales.

### Test Layers

1. **Unit (Vitest)**
   - Backfill unit tests alongside each new utility or service. Place them adjacent to source files with the `.test.ts(x)` suffix.
   - Leverage Vitest mocks for external dependencies; ensure slow integrations (database, network) are stubbed.

2. **Integration (Nest + Prisma)**
   - Create dedicated test modules that spin up in-memory versions of services. When Prisma lands, run tests against a disposable database seeded via fixtures.
   - Store integration specs under `apps/backend/test` or `apps/frontend/<app>/test` with the `.spec.ts` suffix.

3. **End-to-End (Playwright)**
   - Each frontend should own an `e2e/` directory with Playwright specs that cover critical flows (authentication, CRUD operations, reporting).
   - Wire Playwright into CI with headless runs and artifact uploads (screenshots, traces) for failing scenarios.

### Definition of Done

- [ ] Feature flagged or configuration toggles documented (if introduced).
- [ ] Relevant unit, integration, and/or E2E tests implemented and passing.
- [ ] Accessibility considerations (ARIA roles, keyboard navigation) assessed for UI changes.
- [ ] Observability hooks (logs, metrics) updated when backend behaviors shift.
- [ ] Documentation and changelog entries refreshed for user-facing modifications.

### Incident Response Expectations

- Maintain a runbook directory (to be created) for recurring operations—deployments, rollbacks, data backfills.
- After any production issue, capture a retrospective with action items filed against the appropriate agent backlog.

## Cross-Agent Rituals

- **Planning**: during sprint kickoff, tag planned work items with the responsible agent(s) to clarify ownership and review focus.
- **Design reviews**: collect input from all four agents before locking architectural decisions—simplicity and automation concerns often surface opportunities to reduce complexity before code is written.
- **Pull request template**: ensure the PR checklist references each agent’s duties (simplicity adherence, type coverage, automation updates, test evidence).
- **Release readiness**: before cutting a release candidate, run the full `pnpm build` pipeline, execute Docker Compose smoke tests, and gather sign-off from Type Safety and Quality leads.

## Submission Gate

Every contribution should close with a short summary mapping changes to the four agents. If an agent’s expectations are deferred, note the remediation plan and timeline. This keeps the collective bar visible and ensures the ERP suite grows without sacrificing maintainability, correctness, or velocity.
