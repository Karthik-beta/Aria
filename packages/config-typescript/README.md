# @aria/tsconfig

Centralised TypeScript configuration set for the Aria Turborepo. Every app and package extends one of these profiles to keep compilation strict, predictable, and in sync with the agent charter.

## Provided Configs

| Export                     | Extends                                                 | Intended Consumers                                 |
| -------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| `@aria/tsconfig/base.json` | `tsconfig.base.json` settings tuned for shared packages | `packages/utils`, `packages/types`, node utilities |
| `@aria/tsconfig/next.json` | Base + Next.js specific options                         | `apps/frontend/*`                                  |
| `@aria/tsconfig/nest.json` | Base + Node/Nest settings                               | `apps/backend`                                     |

## Usage

```jsonc
// apps/frontend/asset/tsconfig.json
{
  "extends": "@aria/tsconfig/next.json",
  "compilerOptions": {
    "noEmit": true,
  },
}
```

- Rely on path aliases defined here (`@aria/types`, `@aria/utils`, etc.) instead of redeclaring them locally.
- Keep `composite` and `declaration` options untouched unless coordinating a change across the monorepo.

## Agent Alignment

### Simplicity Advocate

- Centralise changes here to avoid drifting compiler options per project.
- When adding a new profile, document the justification and update `pnpm-workspace.yaml` consumers.

### Type Safety Guardian

- Maintain `strict: true`, `noImplicitAny`, and related flags. New projects must inherit the same strictness.
- Export new shared path aliases or type roots from this package so that apps consume them consistently.

### Automation Steward

- Every update should pass `pnpm build` across the repo to validate project references.
- If new build outputs are produced (e.g., declaration maps), reflect them in `turbo.json`.

### Quality Sentinel

- Ensure test utilities compile under these configs; add comments describing rationale for relaxed settings when unavoidable.

## Maintenance Checklist

- [ ] Run `pnpm --filter @aria/tsconfig build` after edits to confirm JSON schema validity (todo: add `ts-json-schema` test).
- [ ] Coordinate TypeScript version bumps with downstream packages to avoid lockstep failures.
- [ ] Document any intentional deviations from upstream framework recommendations.
