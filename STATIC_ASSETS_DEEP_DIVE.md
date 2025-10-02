# Static Assets Root Cause Analysis - Deep Dive

## The Problem That Won't Go Away

After **three** rebuild attempts, static assets from `/public` folder still return 404 or have incorrect paths:
- ❌ Browser HTML shows: `<img src="/file.svg">` 
- ✅ Expected: `<img src="/hrms/file.svg">`
- ✅ Next.js internal assets work: `/hrms/_next/static/...`

## What We've Tried

### Attempt 1: Remove `assetPrefix`
**Hypothesis**: Documentation says assetPrefix auto-set from basePath  
**Result**: ❌ FAILED - images still had `/file.svg` paths

### Attempt 2: Add Back `assetPrefix`
**Hypothesis**: Unoptimized images need explicit assetPrefix  
**Result**: ❌ FAILED - images still had `/file.svg` paths

### Attempt 3: Change `|| undefined` to empty string
**Hypothesis**: Next.js might not handle undefined correctly  
**Status**: 🔄 Testing now...

## Technical Investigation

### What IS Working
✅ Routing: `https://localhost/hrms/` loads the page  
✅ Next.js scripts: `<script src="/hrms/_next/static/...">` ✓  
✅ Next.js CSS: `<link href="/hrms/_next/static/chunks/...">` ✓  
✅ Favicon: `<link rel="icon" href="/hrms/favicon.ico">` ✓  
✅ Server access: `curl https://localhost/hrms/next.svg` → HTTP 200 ✓

### What is NOT Working
❌ Image preloads: `<link rel="preload" as="image" href="/next.svg">` (no basePath!)  
❌ Image tags: `<img src="/file.svg">` (no basePath!)  
❌ Image components: `<Image src="/next.svg">` generates wrong HTML

## Key Discovery

Looking at the HTML output closely:
```html
<!-- These WORK (have /hrms/ prefix) -->
<link rel="preload" href="/hrms/_next/static/media/..." as="font" />
<script src="/hrms/_next/static/chunks/..."></script>
<link href="/hrms/_next/static/chunks/..." rel="stylesheet" />

<!-- These DON'T WORK (missing /hrms/ prefix) -->
<link rel="preload" as="image" href="/next.svg"/>
<img src="/file.svg"/>
<img src="/next.svg"/>
```

**Pattern**: Only assets from `/_next/` get the basePath prefix. Public folder assets do NOT.

## Why Is This Happening?

### Next.js Build Process
1. **Build Time**: `next build` reads `next.config.ts`
   - `basePath: "/hrms"`
   - `assetPrefix: "/hrms"`
   - `output: "standalone"`
   - `images.unoptimized: true`

2. **Asset Processing**:
   - `_next/static/*` → Processed by Next.js bundler → Gets basePath ✓
   - `/public/*` → Copied as-is → Does NOT get basePath ✗

3. **Runtime Image Component**:
   ```tsx
   <Image src="/next.svg" />
   ```
   - With optimization: Next.js adds basePath dynamically ✓
   - With `unoptimized: true`: Next.js uses src as-is ✗

## The Real Root Cause

**Next.js `images.unoptimized: true` bypasses ALL image processing**, including:
- ❌ No image optimization server
- ❌ No automatic basePath prepending
- ❌ No dynamic path resolution
- ✅ Just serves static files from `/public` as-is

When you set `assetPrefix`, Next.js applies it to:
- ✅ `/_next/static/*` (bundled assets)
- ✅ `/_next/image/*` (image optimization endpoint - not used when unoptimized)
- ❌ `/public/*` (static assets - served directly)

## Why Documentation Is Misleading

Next.js docs state:
> "assetPrefix is automatically set to match basePath"

This is **technically true** but **practically misleading** because:
1. It only applies to `_next` assets
2. Public folder assets are NOT affected
3. Unoptimized images bypass the prefix logic entirely

## The Solution Options

### Option A: Use Helper Function (Recommended)
Manually prepend basePath to all image paths:

```typescript
// packages/utils/src/assetPath.ts
export function getAssetPath(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return basePath ? `${basePath}/${cleanPath}` : `/${cleanPath}`;
}

// In components:
<Image src={getAssetPath('/next.svg')} alt="Logo" width={100} height={100} />
```

**Pros**:
- ✅ Guaranteed to work
- ✅ Full control over paths
- ✅ Works with any Next.js configuration

**Cons**:
- ❌ Requires code changes in every component
- ❌ Easy to forget for new images
- ❌ Not using Next.js built-in features

### Option B: Move Images to `/_next/static/media/`
Import images instead of using `/public`:

```typescript
import nextLogo from './next.svg';

<Image src={nextLogo} alt="Logo" width={100} height={100} />
```

**Pros**:
- ✅ Images processed by Next.js bundler
- ✅ Automatic basePath handling
- ✅ Better for production (hashing, caching)

**Cons**:
- ❌ Changes required in all components
- ❌ Large refactor for existing codebase
- ❌ Images no longer in `/public` (SEO considerations)

### Option C: Custom Server with Path Rewriting
Modify standalone server to rewrite image paths:

```javascript
// custom-server.js
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    // Rewrite /file.svg → /hrms/file.svg
    if (parsedUrl.pathname.match(/\.(svg|png|jpg|jpeg|gif|ico)$/)) {
      parsedUrl.pathname = `/hrms${parsedUrl.pathname}`;
    }
    handle(req, res, parsedUrl);
  }).listen(3000);
});
```

**Pros**:
- ✅ No component changes needed
- ✅ Transparent to application code

**Cons**:
- ❌ Custom server (loses some Next.js optimizations)
- ❌ More complex deployment
- ❌ Harder to maintain

### Option D: Traefik Path Rewriting
Add middleware in Traefik to rewrite paths:

```yaml
# traefik/dynamic/middleware.yml
http:
  middlewares:
    hrms-asset-rewrite:
      replacePathRegex:
        regex: "^/(.*\\.(svg|png|jpg|jpeg|gif|ico))$"
        replacement: "/hrms/$1"
```

**Pros**:
- ✅ No application code changes
- ✅ Centralized configuration
- ✅ Works for all frontends

**Cons**:
- ❌ Complex regex patterns
- ❌ Potential conflicts with other routes
- ❌ Harder to debug

## Recommended Solution

Given the constraints and goals, **Option A (Helper Function)** is recommended:

1. **Immediate**: Minimal code changes, works reliably
2. **Clear**: Explicit about path handling
3. **Maintainable**: Easy to understand and modify
4. **Portable**: Works in any environment

Implementation steps:
1. ✅ Create `getAssetPath()` utility in `@aria/utils`
2. ✅ Export as public API
3. Update all `<Image>` components to use helper
4. Add ESLint rule to enforce usage
5. Document in component guidelines

## Current Test: Empty String vs Undefined

Testing if changing:
```typescript
// FROM:
basePath: basePath || undefined,
assetPrefix: basePath || undefined,

// TO:
basePath: basePath,  // Empty string '' when not Docker
assetPrefix: basePath,
```

...makes any difference. This is based on the hypothesis that Next.js might handle empty strings differently than undefined values.

**Update**: If this doesn't work, we proceed with Option A (helper function).

---

**Status**: Testing empty string approach  
**Next Step**: If fails, implement helper function solution  
**Timeline**: 10-15 minutes for rebuild + testing
