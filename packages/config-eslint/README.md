# @aria/eslint-config

Shared flat ESLint presets for the Aria monorepo. These configs embody the four-agent charter by keeping linting simple, type-safe, automated, and quality-focused.

## Available Entrypoints

| Export                     | Use case                                                           |
| -------------------------- | ------------------------------------------------------------------ |
| `@aria/eslint-config`      | Base rules; extend and merge inside app-level `eslint.config.mjs`. |
| `@aria/eslint-config/base` | Framework-agnostic rules for packages and utilities.               |
| `@aria/eslint-config/next` | Next.js + React rules leveraged by frontend apps.                  |
| `@aria/eslint-config/nest` | NestJS-specific rules for the backend service.                     |

## How to Consume

```ts
// eslint.config.mjs
import aria from '@aria/eslint-config';
import ariaNext from '@aria/eslint-config/next';

export default [aria, ariaNext];
```

- Install `eslint@^9` in the target workspace; this package declares ESLint as a peer dependency.
- Add the configuration to each app’s `lint` script (`pnpm --filter <target> lint`).

## Agent Alignment

### Simplicity Advocate

- Prefer extending one of the shipped presets instead of rewriting rules per project.
- Contribute new rule customisations here so every app inherits the same baseline.

### Type Safety Guardian

- Enable plugins that reinforce TypeScript best practices. Keep experimental or permissive rules gated behind opt-in feature flags.
- Validate new rules against both backend and frontend projects to avoid conflicts with `@aria/tsconfig` paths.

### Automation Steward

- When a new rule affects autofix output or generated artifacts, update `turbo.json` outputs to keep caching effective.
- Ensure `.github/workflows/ci.yml` runs `pnpm lint` so changes here are exercised in CI.

### Quality Sentinel

- Add lint rules that catch accessibility issues (jsx-a11y), testing pitfalls, or security problems.
- Document breaking lint changes and provide codemods or fix scripts where possible.

## Maintenance Checklist

- [ ] Update dependencies when new ESLint major versions ship and verify against all apps.
- [ ] Record rule additions in the root changelog (pending) and notify app owners.
- [ ] Add tests (future `packages/config-eslint/test`) for custom rule wrappers before publishing.
