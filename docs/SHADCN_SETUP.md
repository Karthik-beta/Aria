# Shadcn UI & Tailwind CSS v4 Setup Guide

## Overview

This document describes the Shadcn UI and Tailwind CSS v4 setup for the Aria ERP monorepo.

## Architecture

### Shared UI Package (`@aria/ui`)

All Shadcn UI components are centralized in the `packages/ui` directory and exported as `@aria/ui` package. This enables:

- **Single source of truth** for all UI components
- **Consistent theming** across all frontend apps
- **Easy updates** - update components once, reflect everywhere
- **Type safety** with TypeScript exports

### Package Structure

```
packages/ui/
├── src/
│   ├── components/
│   │   └── ui/           # Shadcn UI components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── form.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       └── sonner.tsx
│   ├── lib/
│   │   └── utils.ts      # cn() utility for class merging
│   ├── styles.css        # Base Tailwind v4 theme
│   └── index.ts          # Main exports
├── components.json       # Shadcn CLI configuration
├── package.json
└── tsconfig.json
```

## Technology Stack

| Technology         | Version | Purpose                |
| ------------------ | ------- | ---------------------- |
| **Next.js**        | 15.5.4  | Frontend framework     |
| **React**          | 19.1.0  | UI library             |
| **Tailwind CSS**   | v4      | Utility-first CSS      |
| **Shadcn UI**      | Latest  | Component library      |
| **Radix UI**       | Latest  | Headless UI primitives |
| **tw-animate-css** | 1.4.0   | Animation utilities    |

## Installation Details

### Dependencies Installed

#### UI Package Dependencies

```json
{
  "@radix-ui/react-slot": "^1.1.1",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.3.1",
  "tw-animate-css": "^1.4.0"
}
```

#### Frontend App Updates

All frontend apps (`asset`, `crm`, `hrms`, `inventory`) now include:

```json
{
  "@aria/ui": "workspace:*"
}
```

## Tailwind CSS v4 Configuration

### Key Features

1. **@theme inline directive** - New Tailwind v4 syntax for theme variables
2. **HSL color system** - Modern color handling
3. **CSS variables** - Full theme customization
4. **Dark mode support** - Built-in dark theme
5. **Chart colors** - Pre-configured color palette for data visualization

### Theme Variables

Each frontend app has a complete theme configuration in `globals.css`:

- **Colors**: background, foreground, primary, secondary, muted, accent, destructive
- **Radius**: sm, md, lg, xl variants
- **Chart colors**: 5 pre-configured colors for data visualization

### Example Usage

```tsx
import { Button } from '@aria/ui';

export default function MyComponent() {
  return <Button variant="default">Click me</Button>;
}
```

## Adding New Components

### Using Shadcn CLI

```bash
# Navigate to UI package
cd packages/ui

# Add a new component
pnpx shadcn@latest add [component-name]

# Examples:
pnpx shadcn@latest add table
pnpx shadcn@latest add tabs
pnpx shadcn@latest add select
```

### Export the Component

After adding a component, export it in `packages/ui/src/index.ts`:

```typescript
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './components/ui/table';
```

### Use in Frontend Apps

Import and use immediately in any frontend app:

```tsx
import { Table } from '@aria/ui';
```

## Component Catalog

### Currently Available Components

| Component         | Purpose                              | Radix Primitive               |
| ----------------- | ------------------------------------ | ----------------------------- |
| **Button**        | Interactive buttons with variants    | @radix-ui/react-slot          |
| **Card**          | Container with header/footer/content | -                             |
| **Dialog**        | Modal dialogs                        | @radix-ui/react-dialog        |
| **Dropdown Menu** | Context menus and dropdowns          | @radix-ui/react-dropdown-menu |
| **Form**          | Form handling with validation        | react-hook-form + zod         |
| **Input**         | Text input fields                    | -                             |
| **Label**         | Form labels                          | @radix-ui/react-label         |
| **Sonner**        | Toast notifications                  | sonner                        |

### Recommended Components to Add

```bash
# Tables
pnpx shadcn@latest add table

# Navigation
pnpx shadcn@latest add tabs navigation-menu breadcrumb

# Forms
pnpx shadcn@latest add select checkbox radio-group switch textarea

# Feedback
pnpx shadcn@latest add alert badge progress skeleton spinner

# Data Display
pnpx shadcn@latest add avatar tooltip popover

# Layout
pnpx shadcn@latest add separator sheet sidebar
```

## Frontend Apps Integration

### All Apps Updated

- ✅ `apps/frontend/asset`
- ✅ `apps/frontend/CRM`
- ✅ `apps/frontend/hrms`
- ✅ `apps/frontend/inventory`

### Changes Applied

1. **package.json**: Added `@aria/ui` workspace dependency
2. **globals.css**: Updated with full Tailwind v4 theme
3. **PostCSS**: Already configured with `@tailwindcss/postcss`

## Development Workflow

### Starting Development

```bash
# Start the frontend app (all modules available via route groups)
bun --filter frontend dev

# Visit http://localhost:3000 and navigate to:
# - /asset for Asset Management
# - /crm for CRM
# - /hrms for HRMS
# - /inventory for Inventory
```

### Building

```bash
# Build all apps
bun build

# Build specific app
bun --filter frontend build
```

### Linting

```bash
# Lint entire workspace
bun lint

# Format code
bun format
```

## Customization Guide

### Changing Theme Colors

Edit the CSS variables in each frontend app's `globals.css`:

```css
:root {
  --primary: hsl(0 0% 9%); /* Change primary color */
  --primary-foreground: hsl(0 0% 98%);
  /* ... other variables */
}
```

### Creating Custom Components

1. Create component in `packages/ui/src/components/ui/`
2. Use `cn()` utility for className management
3. Export from `packages/ui/src/index.ts`
4. Use Tailwind utility classes with theme variables

Example:

```tsx
import { cn } from '@/lib/utils';

export function CustomCard({ className, ...props }) {
  return (
    <div
      className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  );
}
```

## Testing

### Demo Page

A demo page has been created in `apps/frontend/asset/src/app/page.tsx` showcasing:

- Button variants
- Card components
- Form inputs with labels
- Typography examples

### Verify Installation

```bash
# Start the frontend app
bun --filter frontend dev

# Visit http://localhost:3000
# You should see the demo page with working Shadcn components
# Navigate to /asset, /crm, /hrms, or /inventory to see different modules
```

## Troubleshooting

### CSS @theme Lint Errors

You may see ESLint errors about unknown `@theme` at-rule. This is expected - it's new Tailwind v4 syntax. The build will work correctly.

### TypeScript Errors in UI Package

The UI package may show TypeScript errors before building. This is normal for workspace packages. They'll resolve when apps import them.

### Component Imports Not Working

1. Verify `@aria/ui` is in app's package.json dependencies
2. Run `bun install` at root
3. Check component is exported in `packages/ui/src/index.ts`

## Best Practices

### DO ✅

- Use `@aria/ui` imports in all frontend apps
- Add new components via Shadcn CLI
- Maintain consistent theming across apps
- Export all components from `packages/ui/src/index.ts`
- Use the `cn()` utility for conditional classes

### DON'T ❌

- Don't duplicate Shadcn components in individual apps
- Don't create app-specific UI packages
- Don't modify Radix UI primitives directly
- Don't hardcode colors - use CSS variables
- Don't skip exporting new components

## Resources

- [Shadcn UI Documentation](https://ui.shadcn.com/)
- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Next.js 16 Documentation](https://nextjs.org/docs)

## Next Steps

1. **Add more components** as needed for each app
2. **Create shared layouts** in `@aria/ui`
3. **Build form patterns** with react-hook-form integration
4. **Implement dark mode toggle** using next-themes
5. **Create component documentation** with Storybook or similar

## Support

For questions or issues:

- Check this documentation
- Review Shadcn UI docs
- Consult Aria ERP Copilot Instructions
- Follow AGENTS.md principles

---

**Last Updated**: October 7, 2025  
**Maintained By**: Aria ERP Team  
**Related Files**:

- `packages/ui/`
- `apps/frontend/*/src/app/globals.css`
- `.github/copilot-instructions.md`
