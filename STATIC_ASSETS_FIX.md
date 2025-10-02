# Static Assets 404 Fix - Documentation Update

## Issue Identified

When using Next.js with `basePath` configuration in Docker deployment, static assets from the `public` folder are being requested at root `/` instead of with the basePath prefix `/asset/`.

## Root Cause

The Next.js Image component and static asset references need the basePath to be applied, but the configuration was using both `assetPrefix` and `basePath` which can conflict.

## Solution Applied

Removed explicit `assetPrefix` configuration from all Next.js configs. Next.js automatically sets `assetPrefix` to match `basePath` when `basePath` is defined.

### Files Modified

1. `apps/frontend/asset/next.config.ts`
2. `apps/frontend/CRM/next.config.ts`
3. `apps/frontend/hrms/next.config.ts`
4. `apps/frontend/inventory/next.config.ts`

### Change

**Before:**
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  assetPrefix: basePath || undefined,  // ← Removed
  basePath: basePath || undefined,
  // ...
};
```

**After:**
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  // Configure basePath for path-based routing
  // Note: assetPrefix is automatically set to basePath when basePath is defined
  basePath: basePath || undefined,
  // ...
};
```

## Verification Required

After rebuilding all frontend containers, verify:

1. Main page loads: `https://localhost/asset/`
2. Static assets load with basePath:
   - `https://localhost/asset/next.svg` → HTTP 200
   - `https://localhost/asset/vercel.svg` → HTTP 200
   - `https://localhost/asset/file.svg` → HTTP 200

3. CSS/JS bundles load:
   - `https://localhost/asset/_next/static/*` → HTTP 200

## Additional Testing Needed

- Test all 4 frontends (Asset, CRM, HRMS, Inventory)
- Verify browser console shows no 404 errors
- Check that images display correctly in browser
- Test production build with `docker compose up --build`

## Status

- ✅ Asset frontend rebuilt
- ⏳ Need to rebuild CRM, HRMS, Inventory
- ⏳ Need to verify in browser (not just curl)

---

**Note**: The assets ARE being served correctly at `/asset/next.svg` (curl confirms HTTP 200 with SVG content), but the HTML is still referencing them as `/next.svg`. This suggests the build needs to be done from scratch to pick up the configuration change properly.

**Next Action**: Full rebuild of all frontends to ensure configuration is applied during build time.
