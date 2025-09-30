# @aria/utils

Shared, side-effect-free helper functions used across backend and frontend surfaces. Utilities must remain deterministic and leverage shared contracts from `@aria/types`.

## Layout

- `src/index.ts` — export surface for all helpers.
- `src/<category>/**/*.ts` — group by concern (formatting, parsing, calculations).
- `dist/` — generated via `tsc --build`; never edit manually.

## Daily Runbook

| Task       | Command                                       | Notes                                                                    |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| Build      | `pnpm --filter @aria/utils build`             | Emits ESM + DTS bundles referenced by apps.                              |
| Type-check | `pnpm --filter @aria/utils exec tsc --noEmit` | Optional quick verification while editing.                               |
| Unit tests | `pnpm --filter @aria/utils test`              | To be introduced using Vitest; co-locate specs under `src/**/*.test.ts`. |

## Authoring Guidelines

- Keep functions pure and synchronous. Side effects (I/O, network) belong in the consuming application.
- Use types from `@aria/types`; never duplicate DTOs or enums.
- Provide documentation comments when helpers have domain-specific behaviour.

## Agent Alignment

### Simplicity Advocate

- Prefer small, composable utilities over large kitchen-sink helpers.
- Promote reuse across apps by extracting common logic here instead of duplicating per frontend.

### Type Safety Guardian

- Enforce strict typing, generics, and exhaustive switch statements. Avoid `any`; use `never` to catch unreachable states.

### Automation Steward

- Add Vitest scripts and configure `turbo.json` outputs when unit tests are introduced.
- Include this package in CI by verifying `pnpm lint`, `pnpm test`, and `pnpm build` succeed post-changes.

### Quality Sentinel

- Require unit tests for each helper once test harness is in place. Prefer property-based tests for tricky calculations.
- Track coverage thresholds (target ≥90%) once testing is wired up.

## Maintenance Checklist

- [ ] Add Vitest configuration (shared across packages) and initial test suite.
- [ ] Document newly added helpers in this README with usage examples.
- [ ] Audit for tree-shaking friendliness; avoid exporting unused internals.
