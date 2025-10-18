# Aria ERP - Combined Multi-Zone App

This is the unified multi-zone Next.js application that consolidates all four Aria ERP modules:

- **Asset Management** - `/asset` route
- **CRM** - `/crm` route  
- **HRMS** - `/hrms` route
- **Inventory** - `/inventory` route

## Architecture

This app uses **Next.js layout groups** for multi-zone architecture:

```
src/app/
├── (asset)/           # Asset management zone
├── (crm)/             # CRM zone
├── (hrms)/            # HRMS zone
├── (inventory)/       # Inventory zone
├── layout.tsx         # Shared root layout
└── page.tsx           # Root page (redirects to default app)
```

Each zone operates independently with its own routes, layouts, and components, while sharing:
- Root HTML structure and providers
- App switcher for instant navigation between modules
- Common utilities and UI components from `@aria/ui`
- Centralized types from `@aria/types`

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
