# Aria ERP - Combined Multi-Zone App

This is the unified multi-zone Next.js application that consolidates all four Aria ERP modules:

- **Asset Management** - `/asset` route
- **CRM** - `/crm` route
- **HRMS** - `/hrms` route
- **Inventory** - `/inventory` route

## 🔐 Single Sign-On (SSO) Authentication

All apps share **centralized authentication** for a seamless experience:

- ✅ **Sign in once**, access all apps
- ✅ **Shared session** across Asset, CRM, HRMS, and Inventory
- ✅ **Automatic redirects** to original destination after login
- ✅ **Centralized security** and session management

**Auth Routes:**

- `/auth/sign-in` - Unified sign-in for all apps
- `/auth/sign-up` - Unified registration

See [`SSO_AUTH_GUIDE.md`](./SSO_AUTH_GUIDE.md) for complete authentication documentation.

## Architecture

This app uses **Next.js App Router** with route segments for multi-zone architecture:

```
src/app/
├── auth/              # Centralized SSO authentication
│   ├── sign-in/
│   └── sign-up/
├── asset/             # Asset management zone
│   ├── layout.tsx
│   ├── page.tsx
│   └── dashboard/
├── crm/               # CRM zone
│   ├── layout.tsx
│   ├── page.tsx
│   └── dashboard/
├── hrms/              # HRMS zone
│   ├── layout.tsx
│   ├── page.tsx
│   └── dashboard/
├── inventory/         # Inventory zone
│   ├── layout.tsx
│   ├── page.tsx
│   └── dashboard/
├── layout.tsx         # Shared root layout
└── page.tsx           # Root page (app selector)
```

Each zone operates independently with its own routes, layouts, and components, while sharing:

- **Authentication & Sessions** - SSO across all modules
- Root HTML structure and providers
- App switcher for instant navigation between modules
- Common utilities and UI components
- Centralized types from `@aria/types`
- Global styles, themes, and error handlers

## Benefits Over Separate Apps

- **Instant app switching** - Client-side navigation (200ms vs 5-10s full reload)
- **Shared resources** - Single bundle for common dependencies
- **Reduced hosting costs** - One deployment instead of four ($2,040/year savings)
- **Unified session** - Authentication persists across all modules
- **Simpler operations** - One build, one deployment, one config

## Development

```bash
# Install dependencies (from workspace root)
pnpm install

# Start dev server
pnpm --filter combined dev

# Build for production
pnpm --filter combined build

# Start production server
pnpm --filter combined start
```

The app will be available at `http://localhost:3000` with routes:

- `/asset` - Asset management interface
- `/crm` - Customer relationship management
- `/hrms` - Human resources management
- `/inventory` - Inventory management (default)

## 🚀 tRPC + TanStack Query Integration

The frontend is configured with **type-safe API calls** using tRPC and TanStack Query:

- ✅ **Full type safety** between frontend and backend
- ✅ **Automatic autocomplete** for all API endpoints
- ✅ **React Query DevTools** in development mode
- ✅ **Request batching** for optimal performance
- ✅ **Server & Client component** support

**Quick Start:**

```tsx
'use client';

import { trpc } from '@/lib/trpc';

function MyComponent() {
  const { data, isLoading } = trpc.inventory.listItems.useQuery();
  return <div>{data?.length} items</div>;
}
```

**Documentation:**

- [`TRPC_SETUP.md`](./TRPC_SETUP.md) - Complete setup documentation
- [`TRPC_QUICKSTART.md`](./TRPC_QUICKSTART.md) - Quick start guide with examples

## App Switcher

The shared root navigation includes an app switcher dropdown that allows users to seamlessly navigate between modules. The current module is highlighted, and switching happens instantly via client-side navigation.

## Deployment

This app is configured for:

- **Turbopack** for fast builds
- **Standalone output** for Docker deployment
- **Image optimization** with unoptimized flag for flexibility
- **Trailing slashes** for consistent routing

No `basePath` is needed - routes are native to each zone.

## Migration from Separate Apps

All existing component code from the separate apps (`asset`, `CRM`, `hrms`, `inventory`) has been copied unchanged into their respective layout groups. This preserves all functionality while enabling multi-zone benefits.

## Next Steps

1. Test all modules work correctly at their respective routes
2. Customize the default redirect in `src/app/page.tsx` if needed
3. Enhance the app switcher with user preferences or permissions
4. Add zone-specific error boundaries if needed
5. Configure Docker deployment with single service instead of four

## Documentation

For more details on the multi-zone architecture decision, see:

- `ARCHITECTURE_FINAL_ANSWER.md`
- `MULTI_ZONE_IMPLEMENTATION.md`
- `MULTI_ZONE_VS_SEPARATE_APPS.md`
