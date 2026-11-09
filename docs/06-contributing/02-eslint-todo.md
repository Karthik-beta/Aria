# Biome Linting Notes

> **Context:** Aria uses [Biome](https://biomejs.dev/) for all linting and formatting. ESLint was fully replaced by Biome as of the v2.x migration.

## Configuration

Biome is configured at the workspace root via [biome.json](../../biome.json). All apps and packages inherit from this single configuration — no per-app overrides.

## Common Commands

```bash
# Format all files
bun format

# Lint via Turborepo (runs biome lint per package)
bun run lint

# Format + lint check (CI-style, no writes)
bun run validate
```

## Suppressing Rules

When a rule must be suppressed for a valid reason, use Biome's inline suppression:

```typescript
// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally excluding 'foo'
useEffect(() => { /* ... */ }, [bar]);
```

Always include a reason after the colon.

## Cleanup: Unused ESLint Packages

The frontend `devDependencies` still lists `@eslint/eslintrc` and `@eslint/js` from the previous ESLint setup. No ESLint config files exist in the repo — these are safe to remove:

```bash
cd apps/frontend
bun remove @eslint/eslintrc @eslint/js
```

## Resources

- [Biome Documentation](https://biomejs.dev/)
- [Biome Lint Rules Reference](https://biomejs.dev/linter/rules/)
- [Biome VS Code Extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)

**Created:** October 18, 2025  
**Priority:** Medium (doesn't block development)  
**Estimated Time:** 2-3 hours total
