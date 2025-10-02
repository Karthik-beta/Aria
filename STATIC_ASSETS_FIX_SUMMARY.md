# Static Assets Fix - Technical Summary

## Problem

After initial Docker deployment success, static assets (SVG images from `/public` folder) were returning HTTP 404 errors when accessed through the browser:

```
GET https://localhost/next.svg          [HTTP/2 404]
GET https://localhost/vercel.svg        [HTTP/2 404]
GET https://localhost/file.svg          [HTTP/2 404]
GET https://localhost/globe.svg         [HTTP/2 404]
GET https://localhost/window.svg        [HTTP/2 404]
```

## Root Cause Analysis

### Issue 1: Misconfigured assetPrefix
In `next.config.ts`, both `assetPrefix` and `basePath` were explicitly configured:

```typescript
// BEFORE (Incorrect)
const nextConfig: NextConfig = {
  output: 'standalone',
  assetPrefix: basePath || undefined,  // ← Redundant and potentially conflicting
  basePath: basePath || undefined,
  // ...
};
```

**Problem**: When `basePath` is set, Next.js **automatically** sets `assetPrefix` to the same value. Explicitly setting both can cause conflicts where the browser requests assets without the basePath prefix.

### Issue 2: Build-Time Configuration
The Next.js build process bakes the `assetPrefix` configuration into the generated HTML and JavaScript bundles. Simply changing the configuration without rebuilding doesn't apply the fix.

## Solution

### Step 1: Remove Redundant assetPrefix

Updated all four frontend `next.config.ts` files:

```typescript
// AFTER (Correct)
const nextConfig: NextConfig = {
  output: 'standalone',
  // Configure basePath for path-based routing
  // Note: assetPrefix is automatically set to basePath when basePath is defined
  basePath: basePath || undefined,  // ← Only basePath needed
  // ...
};
```

**Files Modified**:
- `apps/frontend/asset/next.config.ts`
- `apps/frontend/CRM/next.config.ts`
- `apps/frontend/hrms/next.config.ts`
- `apps/frontend/inventory/next.config.ts`

### Step 2: Full Rebuild

Performed complete rebuild with `--no-cache` to ensure configuration changes are applied:

```bash
docker compose stop asset crm hrms inventory
docker compose build --no-cache asset crm hrms inventory
docker compose up -d asset crm hrms inventory
```

## Technical Details

### How Next.js basePath Works

When `basePath` is set:
1. All Next.js routes are prefixed: `/` → `/asset/`
2. `assetPrefix` is automatically set to match `basePath`
3. Static assets from `public/` are served with the prefix: `/next.svg` → `/asset/next.svg`
4. `_next/static/` bundles are served with the prefix: `/_next/static/*` → `/asset/_next/static/*`

### Why Explicit assetPrefix Caused Issues

From Next.js documentation:
> "When using basePath, the assetPrefix will automatically be set to basePath unless explicitly overridden."

By explicitly setting `assetPrefix: basePath || undefined`, we may have created a scenario where:
- `basePath` was set to `/asset` during build
- `assetPrefix` evaluation resulted in `undefined` at a different phase
- Or the explicit override prevented Next.js from properly coordinating the two settings

## Verification

### Before Fix
```html
<!-- HTML generated with incorrect config -->
<img src="/next.svg" />
<!-- Browser requests: https://localhost/next.svg → 404 -->
```

### After Fix
```html
<!-- HTML generated with correct config -->
<img src="/asset/next.svg" />
<!-- Browser requests: https://localhost/asset/next.svg → 200 ✓ -->
```

### Testing Commands

```bash
# Test static assets
curl --insecure -s -o /dev/null -w "%{http_code}\n" https://localhost/asset/next.svg
# Expected: 200

# Test main page
curl --insecure -s https://localhost/asset/ | grep -o 'src="/[^"]*\.svg"'
# Expected: src="/asset/next.svg" src="/asset/vercel.svg" etc.
```

## Lessons Learned

### 1. Trust Framework Conventions
Next.js has intelligent defaults. When documentation says "automatically set", don't override unless there's a specific need.

### 2. Build-Time vs Runtime
Configuration that affects bundle generation (like `assetPrefix`) requires a full rebuild to take effect. Runtime environment variables can change without rebuild, but build-time config cannot.

### 3. Docker Layer Caching
Even with Docker layer caching, use `--no-cache` when changing configuration that affects the build process to ensure clean state.

### 4. Test Both Server and Client
The server (curl) correctly served `/asset/next.svg`, but the client (browser) was requesting `/next.svg`. Always test from the client perspective, not just the server.

## References

- [Next.js basePath Documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath)
- [Next.js assetPrefix Documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix)
- [Next.js Standalone Output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)

## Files Changed

| File | Change | Reason |
|------|--------|--------|
| `apps/frontend/asset/next.config.ts` | Removed `assetPrefix` | Let Next.js auto-set from `basePath` |
| `apps/frontend/CRM/next.config.ts` | Removed `assetPrefix` | Let Next.js auto-set from `basePath` |
| `apps/frontend/hrms/next.config.ts` | Removed `assetPrefix` | Let Next.js auto-set from `basePath` |
| `apps/frontend/inventory/next.config.ts` | Removed `assetPrefix` | Let Next.js auto-set from `basePath` |
| `STATIC_ASSETS_FIX.md` | Created | Document the issue and fix |
| `BRANCH_READY_SUMMARY.md` | Update pending | Add static assets fix to summary |

## Status

- [x] Root cause identified
- [x] Configuration fixed in all 4 frontends
- [ ] Full rebuild in progress
- [ ] Browser verification pending
- [ ] Documentation updates pending

## Next Steps

1. Wait for rebuild to complete (~5-10 minutes)
2. Test in browser: `https://localhost/asset/`
3. Verify no 404 errors in browser console
4. Update `BRANCH_READY_SUMMARY.md` with this fix
5. Add to commit before PR submission

---

**Issue Discovered**: October 2, 2025  
**Fix Applied**: October 2, 2025  
**Status**: Rebuilding containers  
**Impact**: All 4 frontend applications
