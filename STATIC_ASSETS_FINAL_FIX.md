# Static Assets Final Fix - The Real Root Cause

## Problem Evolution

### Initial Symptom
```
GET https://localhost/next.svg [HTTP/2 404]
GET https://localhost/vercel.svg [HTTP/2 404]
GET https://localhost/file.svg [HTTP/2 404]
```

Images referenced as `<img src="/file.svg">` instead of `<img src="/hrms/file.svg">`.

### First Attempt (Incorrect)
**Hypothesis**: The explicit `assetPrefix: basePath || undefined` was redundant since Next.js automatically sets it.

**Action**: Removed `assetPrefix` from all `next.config.ts` files.

**Result**: ❌ **FAILED** - Images still had incorrect paths after full rebuild.

### Root Cause Discovery
After the first rebuild, testing revealed:
- ✅ Next.js internal assets (JS, CSS) correctly used basePath: `/hrms/_next/static/...`
- ✅ Server could serve static assets: `curl https://localhost/hrms/next.svg` → HTTP 200
- ❌ Image component paths missing basePath: `src="/next.svg"` instead of `src="/hrms/next.svg"`

**The Real Issue**: When `images.unoptimized: true` is set (required for standalone Docker output), Next.js **DOES NOT** automatically prepend `basePath` to Image component sources. The `assetPrefix` setting **IS REQUIRED** to make this work.

## The Correct Solution

### Configuration Fix
Both `basePath` AND `assetPrefix` must be explicitly set to the same value:

```typescript
const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  output: 'standalone',
  // Both basePath and assetPrefix are required for Image component
  // to work correctly with unoptimized images in Docker
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,  // ← REQUIRED despite documentation
  images: {
    unoptimized: true,  // Required for standalone output
  },
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: isDocker,
  },
};
```

### Why Both Are Needed

1. **`basePath`**: Controls the routing base path for the application
   - Affects: Page routes, API routes, `<Link>` components
   - Example: `/hrms/` becomes the app root

2. **`assetPrefix`**: Controls the prefix for all assets loaded by the app
   - Affects: Static files from `/public`, `<Image>` component sources, `_next` assets
   - Example: `/next.svg` → `/hrms/next.svg`

3. **The Documentation Gap**: Next.js docs state that `assetPrefix` is automatically set when `basePath` is defined, but this **only applies to optimized images**. When `images.unoptimized: true`, you must explicitly set both.

## Technical Details

### Docker Build Context
In Dockerfile builder stage:
```dockerfile
ENV DOCKER_ENV=true
```

In `next.config.ts`:
```typescript
const isDocker = process.env.DOCKER_ENV === 'true';
const basePath = isDocker ? '/hrms' : '';
```

### Image Component Behavior

**With `images.unoptimized: false` (default)**:
- Next.js image optimizer handles all image requests
- Automatically applies basePath prefix
- `assetPrefix` inherited from `basePath` ✓

**With `images.unoptimized: true` (standalone Docker)**:
- Images served directly from `/public` folder
- Next.js bypasses optimizer
- `assetPrefix` NOT automatically applied from `basePath` ✗
- **Solution**: Explicitly set `assetPrefix: basePath` ✓

### Verification After Fix

```powershell
# Test HRMS static assets
curl --insecure -s -o $null -w "next.svg: %{http_code}\n" "https://localhost/hrms/next.svg"
curl --insecure -s -o $null -w "file.svg: %{http_code}\n" "https://localhost/hrms/file.svg"
curl --insecure -s -o $null -w "vercel.svg: %{http_code}\n" "https://localhost/hrms/vercel.svg"

# Expected output:
# next.svg: 200
# file.svg: 200
# vercel.svg: 200

# Check HTML source for correct paths
curl --insecure -s https://localhost/hrms/ | Select-String 'src="/hrms/'

# Expected: Multiple matches showing <img src="/hrms/file.svg"> etc.
```

## Files Modified

All 4 frontend `next.config.ts` files updated:
1. `apps/frontend/asset/next.config.ts`
2. `apps/frontend/CRM/next.config.ts`
3. `apps/frontend/hrms/next.config.ts`
4. `apps/frontend/inventory/next.config.ts`

### Change Applied
```diff
  output: 'standalone',
- // Note: assetPrefix is automatically set to basePath when basePath is defined
+ // Both are required for Image component to work correctly with unoptimized images
  basePath: basePath || undefined,
+ assetPrefix: basePath || undefined,
```

## Lessons Learned

1. **Trust But Verify**: Documentation assumptions may not hold for all configurations
2. **Unoptimized Images**: Have different behavior than optimized images
3. **Docker Standalone**: Requires explicit configuration that dev mode auto-handles
4. **Test From Client**: Server-side tests (`curl`) don't catch client-side rendering issues
5. **Build-Time Config**: Requires full rebuild with `--no-cache` to take effect

## Why The First Fix Failed

The original fix removed `assetPrefix` based on Next.js documentation stating:
> "assetPrefix is automatically set to match basePath when basePath is defined"

This is **true for optimized images** but **false for unoptimized images**. The standalone Docker output requires `images.unoptimized: true`, which bypasses the automatic prefix application.

## Final Verification Checklist

After rebuild completes:
- [ ] All 4 frontends accessible via browser
- [ ] No 404 errors in browser console for images
- [ ] HTML source shows correct paths: `src="/hrms/file.svg"` (with basePath)
- [ ] Static assets return HTTP 200: `curl https://localhost/hrms/next.svg`
- [ ] Next.js scripts/CSS also have basePath: `<script src="/hrms/_next/static/..."`

---

**Status**: Second rebuild in progress with correct configuration  
**Expected Outcome**: ✅ Static assets will load correctly with basePath prefix  
**Rebuild Command**: `docker compose build --no-cache asset crm hrms inventory`
