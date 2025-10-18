# Dependency Management Guide

## Current Status

### Package Updates (October 18, 2025)

All packages have been updated to their latest stable versions with the following considerations:

#### ✅ Successfully Updated

- **Next.js**: 15.5.4 → 15.5.6
- **React**: 19.1.0 → 19.2.0
- **React DOM**: 19.1.0 → 19.2.0
- **TypeScript**: 5.9.3 (standardized across workspace)
- **ESLint**: 9.38.0 (with updated plugins)
- **Sentry**: 9.46.0 → 10.20.0
- **Motion**: 11.18.2 → 12.23.24
- **Lucide Icons**: 0.476.0 → 0.546.0
- And 20+ more packages...

See full update list in git history.

#### ⚠️ Intentionally Held Back

**recharts**: Kept at v2.15.4 (v3.3.0 available)

**Reason:** shadcn-ui chart components are not yet compatible with recharts v3.

**Tracking:** https://github.com/shadcn-ui/ui/issues/7669

**Status:** Issue is labeled "roadmap" and assigned to shadcn. Active discussion ongoing.

**Action:** Monitor the issue. Once shadcn releases recharts v3 support, we can upgrade.

**Impact:** No functional impact. v2.15.4 is stable and well-tested.

## Peer Dependencies

### Known Warnings (Safe to Ignore)

#### 1. kbar → react-virtual peer dependency

```
kbar 0.1.0-beta.48
└─┬ react-virtual 2.10.4
  └── ✕ unmet peer react@"^16.6.3 || ^17.0.0": found 19.2.0
```

**Status:** ✅ Safe - React 19 is backward compatible
**Impact:** None - library works correctly
**Action:** None needed until kbar updates

## Type Safety Strategy

### Philosophy: Beginner-Friendly Strictness

We balance type safety with developer experience:

✅ **What we do:**

- Use clear, simple types with JSDoc comments
- Provide helpful inline documentation
- Extract complex types into named types
- Use Zod for runtime validation
- Namespace related types for organization

❌ **What we avoid:**

- Overly complex generic types
- Deep type inference chains
- `any` type (use `unknown` if needed)
- Inline complex type intersections
- Magic type transformations

### Examples

#### ❌ Complex (hard for beginners)

```typescript
function getData<T extends Record<string, unknown>>(): Promise<ApiResponse<T>> {
  // Complex generics are confusing
}
```

#### ✅ Simple (beginner-friendly)

```typescript
/**
 * Fetches product data from the API
 * Returns a list of products wrapped in our standard response
 */
function getProducts(): Promise<ApiResponse<Product[]>> {
  // Clear return type, easy to understand
}
```

#### ❌ Inline complex types

```typescript
function handleData({
  active,
  payload,
}: React.ComponentProps<typeof SomeLib.Component> &
  React.ComponentProps<'div'> & { extra?: boolean }) {
  // Type is hard to read
}
```

#### ✅ Named types with docs

```typescript
/** Props for the DataHandler component */
type DataHandlerProps = React.ComponentProps<typeof SomeLib.Component> &
  React.ComponentProps<'div'> & {
    /** Show extra information */
    extra?: boolean;
  };

function handleData(props: DataHandlerProps) {
  // Much clearer!
}
```

## Updating Dependencies

### Process

1. **Check for updates:**

   ```bash
   pnpm outdated -r
   ```

2. **Update to latest:**

   ```bash
   pnpm update -r --latest
   ```

3. **Review changes:**
   - Check for breaking changes in CHANGELOG files
   - Review peer dependency warnings
   - Test critical paths

4. **Fix breaking changes:**
   - Update code to match new APIs
   - Run `pnpm build` to catch type errors
   - Run `pnpm lint` to catch code issues

5. **Test thoroughly:**
   ```bash
   pnpm build
   pnpm test
   pnpm lint
   ```

### Breaking Change Checklist

When a major version update occurs:

- [ ] Read the package's CHANGELOG/migration guide
- [ ] Check shadcn-ui components if UI library updated
- [ ] Test in development mode first
- [ ] Run full test suite
- [ ] Check for type errors
- [ ] Review console warnings
- [ ] Test critical user flows manually

## Common Issues & Solutions

### Issue: Type errors after update

**Solution:**

1. Check if types package needs updating
2. Rebuild types: `pnpm --filter @aria/types build`
3. Clear cache: `rm -rf node_modules/.cache`

### Issue: Peer dependency warnings

**Solution:**

1. Check if warning is safe (usually is)
2. If needed, add to `pnpm.overrides` in root package.json
3. Document why in this file

### Issue: Build fails after update

**Solution:**

1. Check for breaking changes in updated packages
2. Search GitHub issues for migration guides
3. Revert problematic update, fix incrementally
4. Update in smaller chunks if needed

## Monitoring Strategy

### Weekly

- Check `pnpm outdated -r` for security updates
- Review dependabot alerts

### Monthly

- Review major version updates available
- Plan upgrade strategy for breaking changes
- Update documentation

### Before Release

- Ensure all dependencies are on stable versions
- Run full test suite
- Check bundle size hasn't increased significantly

## Resources

- [pnpm Workspace Guide](https://pnpm.io/workspaces)
- [React 19 Breaking Changes](https://react.dev/blog/2024/04/25/react-19)
- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)
- [TypeScript Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/overview.html)

---

**Last Updated:** October 18, 2025  
**Maintainer:** Development Team
