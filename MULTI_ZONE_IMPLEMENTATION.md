# Multi-Zone Implementation Guide

## Overview

This guide walks through converting your 4 separate Next.js apps into a single multi-zone application using Next.js layout groups.

---

## Step 1: Create the Combined App Structure

```bash
# Create the new consolidated app directory
mkdir -p apps/frontend/combined/app
cd apps/frontend/combined

# Create zone route groups
mkdir -p app/\(asset\)/{dashboard,items,settings}
mkdir -p app/\(crm\)/{dashboard,contacts,deals,settings}
mkdir -p app/\(hrms\)/{dashboard,employees,leaves,settings}
mkdir -p app/\(inventory\)/{dashboard,stock,orders,settings}
```

---

## Step 2: Unified package.json

Merge dependencies from all 4 apps into a single package.json:

```json
{
  "name": "combined-erp",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build --turbopack",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@aria/types": "workspace:*",
    "@aria/ui": "workspace:*",
    "@aria/utils": "workspace:*",
    "next": "15.5.4",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {
    "@aria/eslint-config": "workspace:*",
    "@aria/tsconfig": "workspace:*",
    "@eslint/eslintrc": "^3",
    "@eslint/js": "^9.37.0",
    "@tailwindcss/postcss": "^4.1.14",
    "@types/node": "^24.8.1",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "eslint": "^9.37.0",
    "eslint-config-next": "15.5.4",
    "tailwindcss": "^4.1.14",
    "typescript": "^5.9.3"
  }
}
```

---

## Step 3: Root Layout (Shared for All Zones)

**File**: `apps/frontend/combined/app/layout.tsx`

```typescript
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import { RootNav } from '@/components/root-nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aria ERP',
  description: 'Unified ERP Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {/* Shared navigation with app switcher */}
          <RootNav />
          
          {/* Zone content */}
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

---

## Step 4: Root Navigation with App Switcher

**File**: `apps/frontend/combined/components/root-nav.tsx`

```typescript
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@aria/ui/components/dropdown-menu';
import { Button } from '@aria/ui/components/button';
import {
  Package,
  Users,
  Briefcase,
  ShoppingCart,
  ChevronDown,
} from 'lucide-react';

interface App {
  id: 'asset' | 'crm' | 'hrms' | 'inventory';
  label: string;
  icon: React.ReactNode;
  href: string;
  description: string;
}

const APPS: App[] = [
  {
    id: 'asset',
    label: 'Asset Management',
    icon: <Package className="w-4 h-4" />,
    href: '/asset',
    description: 'Manage company assets',
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: <Users className="w-4 h-4" />,
    href: '/crm',
    description: 'Customer relationship management',
  },
  {
    id: 'hrms',
    label: 'HRMS',
    icon: <Briefcase className="w-4 h-4" />,
    href: '/hrms',
    description: 'Human resources management',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: <ShoppingCart className="w-4 h-4" />,
    href: '/inventory',
    description: 'Inventory management',
  },
];

export function RootNav() {
  const pathname = usePathname();
  
  // Extract current app from pathname
  const currentAppId = pathname
    .split('/')
    .filter(Boolean)[0] as 'asset' | 'crm' | 'hrms' | 'inventory' | undefined;

  const currentApp = APPS.find((app) => app.id === currentAppId);

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between h-16 px-4 max-w-7xl mx-auto">
        {/* Logo/Brand */}
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-xl">Aria ERP</h1>
        </div>

        {/* App Switcher */}
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <span>{currentApp?.label || 'Select App'}</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {APPS.map((app) => (
                <DropdownMenuItem key={app.id} asChild>
                  <Link href={app.href} className="flex items-center gap-2 cursor-pointer">
                    {app.icon}
                    <div>
                      <div className="font-medium">{app.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {app.description}
                      </div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}

function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          👤
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## Step 5: Zone-Specific Layouts

**File**: `apps/frontend/combined/app/(asset)/layout.tsx`

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Asset Management - Aria ERP',
};

export default function AssetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      {/* Asset-specific sidebar */}
      <aside className="w-64 border-r">
        <nav className="p-4 space-y-2">
          <NavLink href="/asset" label="Dashboard" />
          <NavLink href="/asset/items" label="Assets" />
          <NavLink href="/asset/depreciation" label="Depreciation" />
          <NavLink href="/asset/reports" label="Reports" />
          <NavLink href="/asset/settings" label="Settings" />
        </nav>
      </aside>
      
      {/* Zone content */}
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block px-3 py-2 rounded hover:bg-accent text-sm"
    >
      {label}
    </a>
  );
}
```

Repeat for `(crm)`, `(hrms)`, and `(inventory)` with their respective navigation items.

---

## Step 6: Zone Pages

**File**: `apps/frontend/combined/app/(asset)/page.tsx`

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Asset Dashboard - Aria ERP',
};

export default function AssetDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Asset Management Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Assets" value="1,234" />
        <StatCard title="Active" value="1,100" />
        <StatCard title="Depreciation" value="$45,000" />
        <StatCard title="Last Updated" value="2 hours ago" />
      </div>

      {/* Zone-specific content */}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="p-4 border rounded-lg bg-card">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
```

---

## Step 7: Providers & Context

**File**: `apps/frontend/combined/components/providers.tsx`

```typescript
'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ReactNode } from 'react';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

---

## Step 8: Update pnpm-workspace.yaml

```yaml
packages:
  # Old paths (to be removed after migration)
  # - apps/frontend/asset
  # - apps/frontend/CRM
  # - apps/frontend/hrms
  # - apps/frontend/inventory
  
  # New path
  - apps/frontend/combined
  
  # Shared packages
  - apps/backend
  - packages/*
```

---

## Step 9: Update Turborepo

**File**: `turbo.json` - no changes needed, but verify:

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "dev": {
      "persistent": true,
      "cache": false
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"],
      "cache": true
    }
  }
}
```

---

## Step 10: Docker Configuration

**File**: `Dockerfile`

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/frontend/combined ./apps/frontend/combined
COPY apps/backend ./apps/backend
COPY packages ./packages

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Build frontend
WORKDIR /app/apps/frontend/combined
RUN pnpm build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Copy built app
COPY --from=builder /app/apps/frontend/combined/.next/standalone ./
COPY --from=builder /app/apps/frontend/combined/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Step 11: Migration Checklist

```bash
# 1. Create new combined structure
mkdir -p apps/frontend/combined
cp -r apps/frontend/asset/app/* apps/frontend/combined/app/(asset)/
cp -r apps/frontend/CRM/app/* apps/frontend/combined/app/(crm)/
cp -r apps/frontend/hrms/app/* apps/frontend/combined/app/(hrms)/
cp -r apps/frontend/inventory/app/* apps/frontend/combined/app/(inventory)/

# 2. Merge package.json dependencies
pnpm --filter combined add react next @aria/ui @aria/types

# 3. Create shared components
touch apps/frontend/combined/components/{root-nav,providers}.tsx

# 4. Test
cd apps/frontend/combined
pnpm dev  # Should start on http://localhost:3000

# 5. Verify zones are accessible
# http://localhost:3000/asset
# http://localhost:3000/crm
# http://localhost:3000/hrms
# http://localhost:3000/inventory

# 6. Backup and remove old apps (AFTER VERIFICATION)
rm -rf apps/frontend/asset
rm -rf apps/frontend/CRM
rm -rf apps/frontend/hrms
rm -rf apps/frontend/inventory

# 7. Update workspace
pnpm install
pnpm build
```

---

## Step 12: Update pnpm-workspace.yaml

```yaml
packages:
  - apps/backend
  - apps/frontend/combined  # UPDATED
  - packages/*
```

---

## Testing the Migration

```bash
# Development mode
pnpm --filter combined dev

# Visit:
# http://localhost:3000/asset
# http://localhost:3000/crm
# http://localhost:3000/hrms
# http://localhost:3000/inventory

# Test app switcher (should switch instantly without reload)

# Build for production
pnpm --filter combined build

# Start production build
pnpm --filter combined start

# Visit http://localhost:3000 and test all zones
```

---

## Before & After

### Before (4 separate apps)
```
pnpm --filter asset dev          # Port 3001
pnpm --filter crm dev            # Port 3002
pnpm --filter hrms dev           # Port 3003
pnpm --filter inventory dev      # Port 3004

# 4 deployments
docker build -f apps/frontend/asset/Dockerfile
docker build -f apps/frontend/crm/Dockerfile
docker build -f apps/frontend/hrms/Dockerfile
docker build -f apps/frontend/inventory/Dockerfile
```

### After (1 multi-zone app)
```
pnpm --filter combined dev       # Port 3000, serves all zones

# 1 deployment
docker build -f Dockerfile

# All zones at same address
http://localhost:3000/asset
http://localhost:3000/crm
http://localhost:3000/hrms
http://localhost:3000/inventory
```

---

## Performance Considerations

### Code Splitting Per Zone

Next.js automatically code-splits at the route segment level:

```
Initial bundle:  Root layout + app switcher     (~50KB)
Zone-specific:   Asset zone routes               (~30KB on demand)
Zone-specific:   CRM zone routes                 (~30KB on demand)
Zone-specific:   HRMS zone routes                (~30KB on demand)
Zone-specific:   Inventory zone routes           (~30KB on demand)

Total on initial load: ~50KB
Total per zone switch: ~30KB (if not already cached)
```

### Production Optimizations

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  output: 'standalone',
  images: { unoptimized: true },
  compress: true,
  swcMinify: true,
  productionBrowserSourceMaps: false,
  // Optimize zone switching with SWR
  experimental: {
    optimizePackageImports: ['@aria/ui'],
  },
};

export default config;
```

---

## Rollback Plan

If migration doesn't work:

```bash
# Keep old apps in separate branch
git checkout -b keep/old-apps-backup
git push origin keep/old-apps-backup

# Then migrate to multi-zone on main branch
git checkout main
# ... do migration ...
git commit -am "Migrate to multi-zone architecture"
git push origin main

# If needed, revert
git revert HEAD
git push origin main
```

---

**Next**: Once you complete this migration, you'll have a seamless multi-zone experience with instant app switching and unified navigation!
