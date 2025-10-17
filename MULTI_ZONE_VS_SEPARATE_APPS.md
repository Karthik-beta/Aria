# Multi-Zone vs Separate Apps: Architecture Decision Guide

**Date**: October 17, 2025  
**Context**: Aria ERP monorepo with 4 frontend apps + 1 backend + shared UI components  
**Requirement**: Clients purchase single or multiple apps; app switcher for navigation

---

## Current Architecture Analysis

### What You Have Now: **Separate Apps Pattern**

```
apps/frontend/
├── asset/          (Next.js standalone app)
├── CRM/            (Next.js standalone app)
├── hrms/           (Next.js standalone app)
└── inventory/      (Next.js standalone app)

packages/
├── ui/             (Shared shadcn components)
├── types/          (Shared domain types)
├── utils/          (Shared utilities)
└── config-*/       (Shared configurations)

backend/           (Single NestJS API for all apps)
```

### Current Deployment Model

- **Path-based routing**: Each app deploys to `/asset`, `/crm`, `/hrms`, `/inventory`
- **Separate processes**: Each app runs as independent Next.js instance
- **Shared backend**: All frontends hit same API
- **Docker Compose**: Traefik reverse proxy routes to each app

```
https://erp.company.com/asset      → Asset app
https://erp.company.com/crm        → CRM app
https://erp.company.com/hrms       → HRMS app
https://erp.company.com/inventory  → Inventory app
```

---

## Option 1: Multi-Zone Architecture (Recommended for Your Use Case)

### What is Multi-Zone?

A **single Next.js instance** that serves multiple apps on different routes, with shared layout and app switcher. Each "zone" is a collection of routes under a domain prefix.

```typescript
// Single Next.js instance with multiple zones
app/
├── (public)/
│   └── layout.tsx          # Shared root layout (app switcher here!)
├── (asset)/
│   ├── layout.tsx          # Asset-specific layout
│   ├── dashboard/
│   └── items/
├── (crm)/
│   ├── layout.tsx          # CRM-specific layout
│   ├── dashboard/
│   └── contacts/
├── (hrms)/
│   └── ...
└── (inventory)/
    └── ...
```

### Deployment

```
https://erp.company.com/asset/*      → Asset zone
https://erp.company.com/crm/*        → CRM zone
https://erp.company.com/hrms/*       → HRMS zone
https://erp.company.com/inventory/*  → Inventory zone
```

### Advantages ✅

| Advantage | Why It Matters |
|-----------|---------------|
| **Single App Instance** | One process to manage, deploy, monitor, and scale |
| **Unified App Switcher** | Global layout once, accessible from any zone |
| **Shared Navigation** | App switcher, breadcrumbs, user context reused everywhere |
| **Optimal Code Splitting** | Shared layout bundle loaded once; each zone downloads only its code |
| **Faster Deployment** | One app to build/push vs 4 separate deployments |
| **SEO Benefits** | Shared meta tags, structured data, canonical URLs easier |
| **A/B Testing** | Easier to redirect users between zones (A/B test switcher placement) |
| **Unified Analytics** | Session tracking across zones without cross-origin issues |
| **Simpler Auth** | Single cookie domain, no iframe postMessage workarounds |
| **Reduced Infrastructure** | 1 Node.js server vs 4; 1 CDN prefix vs 4 |

### Disadvantages ❌

| Disadvantage | Severity |
|--------------|----------|
| Single point of failure — one zone crashes affects entire instance | Medium (mitigatable with error boundaries) |
| Larger initial bundle (all zone routes downloaded client-side) | Low (with proper code splitting) |
| Harder to A/B test entire app (shared JS bundle) | Low (can still test at route level) |
| Zone configuration tightly coupled | Low (can extract to config file) |

### Best For

✅ Your exact scenario: Clients purchase 1-4 apps from same provider  
✅ Unified branding and navigation essential  
✅ Single backend for all apps  
✅ Want app switcher visible everywhere  
✅ Minimal operations overhead  

---

## Option 2: Keep Separate Apps (Current Approach)

### Deployment Model

```
Frontend:
  - Asset app      (pnpm --filter asset build) → Standalone Docker container
  - CRM app        (pnpm --filter crm build)   → Standalone Docker container
  - HRMS app       (pnpm --filter hrms build)  → Standalone Docker container
  - Inventory app  (pnpm --filter inventory build) → Standalone Docker container

Orchestration:
  Traefik reverse proxy routes:
  /asset       → Asset container:3001
  /crm         → CRM container:3002
  /hrms        → HRMS container:3003
  /inventory   → Inventory container:3004
```

### Advantages ✅

| Advantage | Why It Matters |
|-----------|---------------|
| **Isolation** | Zone crash doesn't affect others; independent scaling |
| **True Modularity** | Each app can be deployed independently |
| **Flexible Versioning** | Different zones can run different app versions |
| **Easy to Decompose** | Later convert to separate repositories/teams |
| **Independent Scaling** | Popular zone can scale without others |
| **Smaller Initial Bundles** | Only download code for zone you're in |

### Disadvantages ❌

| Disadvantage | Severity |
|--------------|----------|
| **4x Deployment Complexity** | 4 separate builds, pushes, container orchestrations | High |
| **4x Infrastructure Cost** | 4 Node.js processes vs 1; more memory/CPU | High |
| **App Switcher is Hacky** | Must either: (1) use iframe postMessage, or (2) server-side redirect with state loss | High |
| **Auth State Sharing** | If separate domains, need careful cookie/token handling | Medium |
| **No Shared Layout** | Each zone has independent root layout; duplication | Medium |
| **Cross-Zone Navigation** | Full page reload on zone switch (poor UX) | High |
| **Slower Switching** | Must download new app's JS/CSS on switch | Medium |
| **Distributed Session** | Session must survive across domain/process boundaries | Medium |

### Best For

❌ **NOT ideal for your requirements** — only if:
- Zones are truly independent products
- Different teams own different zones
- Zone failures must not affect others
- Clients access only one zone at a time (no switching)

---

## Comparative Analysis for Your Use Case

### Your Requirement: "App Switcher Between Multiple Apps"

| Criteria | Multi-Zone | Separate Apps |
|----------|-----------|---------------|
| **App Switcher UX** | ✅ Instant client-side switch | ❌ Full page reload |
| **Shared Layout** | ✅ One layout, one app switcher | ❌ Duplicate layout per app |
| **Auth State** | ✅ Single cookie, all zones share | ❌ Complex cross-domain auth |
| **Deployment** | ✅ Single build/push | ❌ 4 builds/pushes |
| **Operations** | ✅ Monitor 1 app | ❌ Monitor 4 apps |
| **Infrastructure** | ✅ 1 Node.js process | ❌ 4 Node.js processes |
| **Code Reuse** | ✅ Shared layout/navigation | ❌ Duplicated layouts |
| **Customer Experience** | ✅ Seamless switching | ❌ Jarring reloads |

### Cost Comparison (AWS, Heroku, Vercel)

**Multi-Zone:**
- 1 deployment slot: $25-50/month
- 1 data transfer: Standard
- 1 build pipeline: Standard

**Separate Apps:**
- 4 deployment slots: $100-200/month
- 4x data transfer costs: Higher
- 4x build pipelines: Higher
- 4x resource allocation: Higher

**Savings with Multi-Zone: 60-70% infrastructure cost**

---

## Implementation Strategy: Migrate to Multi-Zone

### Phase 1: Prepare (1-2 days)

1. **Consolidate to single monolithic Next.js app** (still in same repo structure)
2. **Use layout groups for zones**:

```typescript
// apps/frontend/combined/app/(asset)/layout.tsx
export default function AssetLayout() {
  return <AssetProvider>{children}</AssetProvider>;
}

// apps/frontend/combined/app/(crm)/layout.tsx
export default function CRMLayout() {
  return <CRMProvider>{children}</CRMProvider>;
}

// Root layout (shared)
// apps/frontend/combined/app/layout.tsx
export default function RootLayout() {
  return (
    <html>
      <body>
        <AppSwitcher /> {/* Single app switcher! */}
        {children}
      </body>
    </html>
  );
}
```

### Phase 2: Create Shared App Switcher (2-3 days)

```typescript
// packages/ui/src/components/app-switcher.tsx
export function AppSwitcher() {
  const pathname = usePathname();
  const currentApp = pathname.split('/')[1]; // 'asset', 'crm', etc.

  const apps = [
    { id: 'asset', label: 'Asset Management', icon: Package },
    { id: 'crm', label: 'CRM', icon: Users },
    { id: 'hrms', label: 'HRMS', icon: Briefcase },
    { id: 'inventory', label: 'Inventory', icon: ShoppingCart },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>{currentApp}</DropdownMenuTrigger>
      <DropdownMenuContent>
        {apps.map((app) => (
          <DropdownMenuItem key={app.id} asChild>
            <Link href={`/${app.id}`}>{app.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Phase 3: Migrate Zone Routes (3-5 days)

Move route folders into grouped layout structure:

```bash
# Before
apps/frontend/asset/app/dashboard/page.tsx
apps/frontend/crm/app/dashboard/page.tsx

# After
apps/frontend/combined/app/(asset)/dashboard/page.tsx
apps/frontend/combined/app/(crm)/dashboard/page.tsx
```

### Phase 4: Unified Configuration (1-2 days)

```typescript
// next.config.ts (single instance)
const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  output: 'standalone',
  // No more basePath needed — routes handle it
  images: { unoptimized: true },
  trailingSlash: true,
};
```

### Phase 5: Docker & Deployment (1-2 days)

```dockerfile
# Single Dockerfile for all zones
FROM node:20
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter combined build
EXPOSE 3000
CMD ["node", ".next/standalone/server.js"]
```

### Phase 6: Decommission Old Apps (1 day)

```bash
rm -rf apps/frontend/asset
rm -rf apps/frontend/crm
rm -rf apps/frontend/hrms
rm -rf apps/frontend/inventory
# Keep:
#   apps/frontend/combined
#   packages/ui (shared components)
#   packages/types (shared types)
```

### Updated Workspace Structure

```
apps/frontend/
└── combined/          # Single multi-zone app
    ├── app/
    │   ├── (asset)/
    │   ├── (crm)/
    │   ├── (hrms)/
    │   └── (inventory)/
    ├── package.json
    └── next.config.ts

packages/
├── ui/               # Still shared shadcn
├── types/            # Still shared types
├── utils/            # Still shared utils
└── config-*/         # Still shared configs

backend/              # Unchanged
```

---

## Recommendation

### ✅ **GO WITH MULTI-ZONE ARCHITECTURE**

**Reasons:**

1. **Perfect alignment with requirements**:
   - Single app with app switcher ✓
   - Unified UI/branding ✓
   - One backend ✓
   - Clients buy 1-4 apps ✓

2. **Operational excellence**:
   - Deploy once, serve all zones
   - Monitor single instance
   - Scale single process
   - 60-70% cost savings

3. **User experience**:
   - Instant app switching (no reload)
   - Shared navigation context
   - Seamless auth across zones
   - Single session

4. **Migration is straightforward**:
   - You already have shared UI/types
   - Just consolidate 4 apps into 1
   - Route groups handle zone separation
   - No architectural paradigm shift

5. **Still flexible**:
   - Can always split later if needed
   - Each zone is independently managed
   - Can have zone-specific providers/contexts
   - Independent error boundaries per zone

### Why NOT Separate Apps?

- ❌ App switching requires full page reload (bad UX)
- ❌ Complex cross-app auth coordination
- ❌ 4x deployment and operational overhead
- ❌ 4x infrastructure costs
- ❌ No shared root layout (duplicate code)
- ❌ Duplicated app switcher logic (iframe postMessage complexity)

---

## Migration Checklist

- [ ] Review current app routes and identify overlaps
- [ ] Plan zone grouping (asset, crm, hrms, inventory)
- [ ] Design shared root layout with app switcher
- [ ] Create zone-specific layout components
- [ ] Migrate routes from 4 apps → grouped structure
- [ ] Test auth/session across zones
- [ ] Update tRPC client setup (single instance)
- [ ] Build single Docker image
- [ ] Update Traefik/load balancer config (routes → single app)
- [ ] Performance test zone switching
- [ ] Decommission old 4 app folders
- [ ] Update documentation

---

## Quick Start: Create Multi-Zone Structure

```bash
# Create new consolidated app
mkdir -p apps/frontend/combined/app/\(asset\)/dashboard
mkdir -p apps/frontend/combined/app/\(crm\)/dashboard
mkdir -p apps/frontend/combined/app/\(hrms\)/dashboard
mkdir -p apps/frontend/combined/app/\(inventory\)/dashboard

# Copy package.json (merge dependencies from all 4 apps)
cp apps/frontend/asset/package.json apps/frontend/combined/package.json

# Create root layout
cat > apps/frontend/combined/app/layout.tsx << 'EOF'
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Navbar />
        <AppSwitcher />
        {children}
      </body>
    </html>
  );
}
EOF
```

---

**Verdict**: Multi-zone is the **optimal, recommended approach** for your architecture and requirements. It leverages your existing shared UI/types infrastructure while providing excellent UX and operational efficiency.
