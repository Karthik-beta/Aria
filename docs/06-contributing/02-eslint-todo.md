# ESLint Issues TODO

> **Context:** After updating to ESLint 9.38.0 with stricter React Compiler rules, several pre-existing code quality issues were exposed. These need to be fixed in a separate PR.

## Current Status

- ✅ All packages updated to latest stable versions
- ✅ Build succeeds (ESLint temporarily disabled during builds)
- ⚠️ 8 ESLint errors + 3 warnings need fixing

## Issues to Fix

### 🔴 High Priority Errors

#### 1. Unused Variables (2 errors)

**File:** `src/app/auth/sign-up/[[...sign-up]]/page.tsx:25`

```typescript
// Error: 'error' is defined but never used
```

**Fix:** Remove the unused variable or use it properly

---

**File:** `src/features/kanban/components/kanban-board.tsx:26`

```typescript
// Error: 'defaultCols' is assigned a value but only used as a type
```

**Fix:** Use `satisfies` or extract to type-only

---

**File:** `src/lib/format.ts:14`

```typescript
// Error: '_err' is defined but never used
```

**Fix:** Rename to `_` if intentionally unused for type narrowing

---

#### 2. Impure Functions in Render (2 errors)

**File:** `src/components/ui/sidebar.tsx:586`

```typescript
// Error: Cannot call Math.random() during render
const width = React.useMemo(() => {
  return `${Math.floor(Math.random() * 40) + 50}%`;
}, []);
```

**Fix:** Generate random value outside render or use useState with initial value

```typescript
const [width] = useState(() => `${Math.floor(Math.random() * 40) + 50}%`);
```

---

**File:** `src/features/overview/components/bar-graph-skeleton.tsx:32`

```typescript
// Error: Cannot call Math.random() during render
style={{ height: `${Math.max(20, Math.random() * 100)}%` }}
```

**Fix:** Pre-generate random heights outside render

```typescript
const heights = useMemo(
  () => Array.from({ length: 12 }, () => Math.max(20, Math.random() * 100)),
  []
);
```

---

#### 3. setState in useEffect (2 errors)

**File:** `src/components/modal/alert-modal.tsx:17`

```typescript
// Error: Calling setState synchronously within an effect
useEffect(() => {
  setIsMounted(true);
}, []);
```

**Fix:** This is the "mounted pattern" for client-only rendering. Can be suppressed with eslint-disable comment or refactored to use Suspense

---

**File:** `src/hooks/use-media-query.ts:8`

```typescript
// Error: Calling setState synchronously within an effect
useEffect(() => {
  const mediaQuery = window.matchMedia('(max-width: 768px)');
  setIsOpen(mediaQuery.matches);
  // ...
}, []);
```

**Fix:** Use `useSyncExternalStore` for external subscriptions (proper React 18+ pattern)

---

#### 4. Unused Expression

**File:** `src/features/kanban/components/column-action.tsx:65`

```typescript
// Error: Expected an assignment or function call and instead saw an expression
```

**Fix:** Check the code - likely a standalone expression that does nothing

---

### ⚠️ Warnings (Non-blocking)

#### 1. Missing Dependency

**File:** `src/components/file-uploader.tsx:174`

```typescript
// Warning: React Hook useEffect has missing dependency: 'files'
```

**Fix:** Add `files` to dependency array or suppress if intentional

---

#### 2. Incompatible Library Warnings (2)

**File:** `src/components/forms/demo-form.tsx:291`

```typescript
// Warning: React Hook Form's watch() cannot be memoized safely
{
  JSON.stringify(form.watch(), null, 2);
}
```

**Fix:** This is expected behavior - React Compiler skips memoization. No action needed unless performance issues.

---

**File:** `src/hooks/use-data-table.ts:242`

```typescript
// Warning: TanStack Table's useReactTable() cannot be memoized safely
const table = useReactTable({...});
```

**Fix:** This is expected behavior - no action needed.

---

## Recommended Fix Order

1. **Quick wins (10 min):**
   - Fix unused variables (3 files)
   - Fix unused expression (1 file)

2. **Medium effort (30 min):**
   - Fix Math.random() calls (2 files)
   - Add missing dependency (1 file)

3. **Refactoring (1 hour):**
   - Convert mounted pattern to Suspense
   - Convert media query to useSyncExternalStore

4. **Documentation:**
   - Add eslint-disable comments with explanations for library warnings

## Testing Checklist

After fixing each issue:

- [ ] `pnpm --filter frontend lint` passes
- [ ] `pnpm build` succeeds
- [ ] Component still renders correctly
- [ ] No console warnings in dev mode
- [ ] Manual test of affected feature

## Resources

- [React Compiler Rules](https://react.dev/reference/rules)
- [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [ESLint React Hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks)

---

**Created:** October 18, 2025  
**Priority:** Medium (doesn't block development)  
**Estimated Time:** 2-3 hours total
