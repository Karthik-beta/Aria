# Multi-Zone Architecture: Visual Guide

## Current State vs Target State

### Current Architecture (4 Separate Apps)

```
                          Browser
                            │
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    http://app1        http://app2        http://app3        http://app4
         │                  │                  │
         ↓                  ↓                  ↓               ↓
    ┌─────────┐        ┌─────────┐        ┌─────────┐    ┌─────────┐
    │ Asset   │        │ CRM     │        │ HRMS    │    │Inventory│
    │ Next.js │        │Next.js  │        │Next.js  │    │Next.js  │
    │App      │        │App      │        │App      │    │App      │
    │Port3001 │        │Port3002 │        │Port3003 │    │Port3004 │
    └────┬────┘        └────┬────┘        └────┬────┘    └────┬────┘
         │                  │                  │              │
         └──────────────────┼──────────────────┴──────────────┘
                            │
                      ┌─────▼─────┐
                      │  Traefik  │
                      │  Reverse  │ /asset → Port 3001
                      │  Proxy    │ /crm → Port 3002
                      │           │ /hrms → Port 3003
                      │           │ /inventory → Port 3004
                      └─────┬─────┘
                            │
                      ┌─────▼─────┐
                      │  Backend  │
                      │  NestJS   │
                      │  API      │
                      └───────────┘

Problem: App switcher = full page reload + lose session
```

---

### Target Architecture (Multi-Zone)

```
                          Browser
                            │
                       http://app:3000
                            │
                      ┌─────▼──────────┐
                      │ Single Next.js │
                      │ Multi-Zone App │
                      │                │
    ┌─────────────────┤  Root Layout   │◄────────────────┐
    │ App Switcher    │  + Nav + Auth  │                 │
    │ (Client-side)   │                │                 │
    └────────┬────────┴─────┬──────────┴────────┬────────┘
             │              │                   │
             ↓              ↓                   ↓
         /asset/*       /crm/*              /hrms/*         /inventory/*
             │              │                   │
         ┌──────────┐   ┌──────────┐        ┌──────────┐ ┌──────────┐
         │ (asset)  │   │ (crm)    │        │ (hrms)   │ │ (inv.)   │
         │ Layout   │   │ Layout   │        │ Layout   │ │ Layout   │
         ├──────────┤   ├──────────┤        ├──────────┤ ├──────────┤
         │Dashboard │   │Dashboard │        │Dashboard │ │Dashboard │
         │ Items    │   │ Contacts │        │ Employees│ │ Stock    │
         │Settings  │   │ Deals    │        │ Leaves   │ │ Orders   │
         └──────────┘   └──────────┘        └──────────┘ └──────────┘
                            │
                      ┌─────▼─────┐
                      │ Shared UI  │
                      │ Components │
                      │ from       │
                      │ @aria/ui   │
                      └─────┬─────┘
                            │
                      ┌─────▼─────┐
                      │  Backend  │
                      │  NestJS   │
                      │  API      │
                      └───────────┘

Benefit: App switcher = instant route change (no reload)
```

---

## Routing Flow: Multi-Zone Detail

```
User starts at:
  https://company.com/asset/dashboard

┌─────────────────────────────────────────────────────────────┐
│ Root Layout (app/layout.tsx)                                │
│ ├─ Navbar with App Switcher                                │
│ ├─ Authentication context                                  │
│ ├─ Theme provider                                          │
│ └─ {children} - Zone content                               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ├─ Match route: /asset/dashboard
                  │
                  ↓
        ┌─────────────────────┐
        │ (asset) Layout      │ app/(asset)/layout.tsx
        │ (Zone-specific)     │
        ├─────────────────────┤
        │ Asset Sidebar       │
        │ Asset Nav           │
        │ {children}          │
        └────────┬────────────┘
                 │
                 ├─ Match: /dashboard
                 │
                 ↓
        ┌─────────────────────┐
        │ Asset Dashboard     │ app/(asset)/dashboard/page.tsx
        │ Page                │
        ├─────────────────────┤
        │ - Total Assets: 234 │
        │ - Active: 198       │
        │ - [Asset Table]     │
        └─────────────────────┘

─────────────────────────────────────────────────────────────

User clicks "CRM" in app switcher:

┌─────────────────────────────────────────────────────────────┐
│ Root Layout (stays the same - shared!)                      │
│ ├─ Navbar with App Switcher (highlights "CRM")            │
│ ├─ Authentication context (same user)                      │
│ ├─ Theme provider (same theme)                             │
│ └─ {children} - NEW ZONE CONTENT                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ├─ Match route: /crm/dashboard (NEW!)
                  │
                  ↓
        ┌─────────────────────┐
        │ (crm) Layout        │ app/(crm)/layout.tsx
        │ (Zone-specific)     │ (NEW! Renders in place)
        ├─────────────────────┤
        │ CRM Sidebar         │
        │ CRM Nav             │
        │ {children}          │
        └────────┬────────────┘
                 │
                 ├─ Match: /dashboard
                 │
                 ↓
        ┌─────────────────────┐
        │ CRM Dashboard       │ app/(crm)/dashboard/page.tsx
        │ Page                │
        ├─────────────────────┤
        │ - Total Contacts: 5k│
        │ - Deals Pending: 12 │
        │ - [Contacts Table]  │
        └─────────────────────┘

⏱️ Time taken: ~200ms (client-side routing, no page reload!)
```

---

## File Structure Mapping

```
apps/frontend/combined/
│
├── app/
│   ├── layout.tsx ─────────────────┬─────── Shared root layout
│   │                               │       (App Switcher lives here!)
│   ├── (asset)/
│   │   ├── layout.tsx ─────────────┼─────── Asset zone layout
│   │   ├── page.tsx ────────────────┼─────── /asset
│   │   ├── dashboard/
│   │   │   └── page.tsx ────────────┼─────── /asset/dashboard
│   │   ├── items/
│   │   │   └── page.tsx ────────────┼─────── /asset/items
│   │   └── settings/
│   │       └── page.tsx ────────────┼─────── /asset/settings
│   │
│   ├── (crm)/
│   │   ├── layout.tsx ──────────────┼─────── CRM zone layout
│   │   ├── page.tsx ────────────────┼─────── /crm
│   │   ├── dashboard/
│   │   │   └── page.tsx ────────────┼─────── /crm/dashboard
│   │   ├── contacts/
│   │   │   └── page.tsx ────────────┼─────── /crm/contacts
│   │   └── deals/
│   │       └── page.tsx ────────────┼─────── /crm/deals
│   │
│   ├── (hrms)/
│   │   └── ... (similar structure)
│   │
│   └── (inventory)/
│       └── ... (similar structure)
│
├── components/
│   ├── root-nav.tsx ────────────────┴─────── App Switcher Component
│   ├── zone-sidebar.tsx
│   ├── auth-context.tsx
│   └── ...
│
├── lib/
│   ├── trpc.ts ───────────────────────────── tRPC client
│   └── api.ts ────────────────────────────── API utilities
│
├── package.json ──────────────────────────── Dependencies
└── next.config.ts ────────────────────────── Next.js config
```

---

## Session Flow: Multi-Zone

```
Browser Storage:
┌──────────────────────────┐
│ Cookie: auth_token       │ ← Set on first login
│ LocalStorage: user_prefs │ ← Shared across zones
│ SessionStorage: temp_data│ ← Shared across zones
└──────────────────────────┘
   ▲         ▲         ▲
   │         │         │
   │         │         │
  /asset   /crm     /hrms
   │         │         │
   └─────────┼─────────┘
             │
       Same JavaScript Runtime
       (Single Next.js process)
       
       All routes see same auth_token
       All routes see same user_prefs
       No re-authentication needed on zone switch
```

---

## Bundle Size Comparison

### Separate Apps (4 Apps)

```
app1.js (50KB) ────────► Asset App
  ├─ React (45KB)
  ├─ UI Components (20KB)
  ├─ Routes (10KB)
  └─ Utils (5KB)

app2.js (50KB) ────────► CRM App
  ├─ React (45KB)      ◄── DUPLICATE!
  ├─ UI Components (20KB)  ◄── DUPLICATE!
  ├─ Routes (10KB)
  └─ Utils (5KB)

app3.js (50KB) ────────► HRMS App
  ├─ React (45KB)      ◄── DUPLICATE!
  ├─ UI Components (20KB)  ◄── DUPLICATE!
  ├─ Routes (10KB)
  └─ Utils (5KB)

app4.js (50KB) ────────► Inventory App
  ├─ React (45KB)      ◄── DUPLICATE!
  ├─ UI Components (20KB)  ◄── DUPLICATE!
  ├─ Routes (10KB)
  └─ Utils (5KB)

Total JS downloaded: 200KB
Total JS in memory (if using all 4): 200KB
```

### Multi-Zone (1 App)

```
combined.js (100KB) ─────► All Zones
  ├─ React (45KB)       ◄── Shared
  ├─ UI Components (20KB) ◄── Shared
  ├─ Root Layout (5KB)
  ├─ Asset Zone (8KB)    ◄── Lazy loaded
  ├─ CRM Zone (8KB)      ◄── Lazy loaded
  ├─ HRMS Zone (8KB)     ◄── Lazy loaded
  └─ Inventory Zone (8KB) ◄── Lazy loaded

Total JS downloaded: 100KB
Total JS in memory: ~60KB (root + current zone)
JS for zone switch: 8KB (lazy loaded)

Benefit: 50% smaller initial bundle!
```

---

## Network Timeline: App Switch

### Separate Apps (Current)

```
User clicks "CRM" button
  │
  ├─ 200ms: Navigate to /crm
  ├─ 100ms: DNS lookup (if different domain)
  ├─ 100ms: TCP connection
  ├─ 100ms: TLS handshake
  ├─ 500ms: Download CRM app HTML
  ├─ 1000ms: Download CRM app JS
  ├─ 1000ms: Download CRM app CSS
  ├─ 500ms: Parse & compile JS
  ├─ 500ms: Fetch initial data from API
  ├─ 500ms: Render page
  │
  └─ Total: 5-7 seconds ❌

User stares at blank screen for 5-7 seconds
```

### Multi-Zone (Target)

```
User clicks "CRM" button
  │
  ├─ 50ms: Client-side route change
  ├─ 50ms: Load CRM layout component
  ├─ 50ms: Load CRM routes (if not cached)
  ├─ 100ms: Fetch CRM initial data (parallel with render)
  │
  └─ Total: 200-300ms ✅

User sees new zone almost instantly!
```

---

## Deployment Comparison

### Separate Apps: Deploy Process

```
Day 1:
  10:00 - Make code change in Asset app
  10:05 - Run: pnpm --filter asset build
  10:10 - Build complete, run: docker build -f apps/frontend/asset/Dockerfile
  10:15 - Docker image ready, push to registry
  10:20 - Deploy Asset app to production
  
  10:25 - Make code change in CRM app
  10:30 - Run: pnpm --filter crm build
  10:35 - Build complete, run: docker build -f apps/frontend/CRM/Dockerfile
  10:40 - Docker image ready, push to registry
  10:45 - Deploy CRM app to production
  
  (Repeat for HRMS and Inventory...)
  
  Total time: ~45 minutes for 4 apps
  Error risk: 4x higher (each deploy can fail)
```

### Multi-Zone: Deploy Process

```
Day 1:
  10:00 - Make code change in any zone
  10:05 - Run: pnpm --filter combined build
  10:10 - Build complete, run: docker build .
  10:15 - Docker image ready, push to registry
  10:20 - Deploy combined app to production
  
  ✅ All zones updated!
  
  Total time: ~20 minutes
  Error risk: Lower (one deploy, one point of failure)
```

---

## Decision: Multi-Zone vs Separate Apps

```
                     ┌─────────────────┐
                     │ Your Scenario:  │
                     │                 │
                     │ ✓ 4 frontend    │
                     │ ✓ 1 backend     │
                     │ ✓ Shared UI     │
                     │ ✓ App switcher  │
                     │ ✓ Clients buy   │
                     │   1-4 apps      │
                     └────────┬────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Multi-Zone? 👇  │
                    └────────┬─────────┘
                             │
                    ┌────────▼────────┐
                    │ YES - Go with   │
                    │ Multi-Zone! ✅   │
                    │                 │
                    │ • Faster UX     │
                    │ • Lower cost    │
                    │ • Simpler ops   │
                    │ • 1-2 weeks     │
                    └─────────────────┘
```

---

## Summary

**Multi-Zone Architecture:**

```
✅ One Next.js app
✅ Multiple layout groups (zones)
✅ Shared root layout with app switcher
✅ Instant app switching (client-side routing)
✅ Shared session across zones
✅ Single deployment
✅ 60% cost savings
✅ Better UX

Implementation time: 1-2 weeks
Maintenance overhead: Low
Customer satisfaction: High
```

---

**Ready to build?** Start with `MULTI_ZONE_IMPLEMENTATION.md` 🚀
