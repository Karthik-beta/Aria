# 🏢 Asset Management Frontend

The **Asset Frontend** helps you track and manage company assets like computers, furniture, vehicles, and equipment. Built with **Next.js 15**, it provides a fast, modern interface for asset tracking.

## 📋 What Does This Do?

This application lets you:

- **View all assets** in one place with search and filters
- **Track asset details** like location, condition, and assigned employee
- **Manage assignments** (who has what asset)
- **Monitor asset lifecycle** from purchase to disposal
- **Generate reports** on asset utilization and depreciation

Think of it as a digital inventory for everything your company owns!

## 🚀 Quick Start

### First Time Setup

```bash
# 1. Install all dependencies (run from project root)
pnpm install

# 2. Start the development server
pnpm --filter asset dev
```

The app will open at `http://localhost:3001` (or the next available port).

### Common Commands

| What You Want To Do | Command | What Happens |
|---------------------|---------|--------------||
| Start the app | `pnpm --filter asset dev` | Runs in development mode with hot-reload |
| Build for production | `pnpm --filter asset build` | Creates optimized production build |
| Run tests | `pnpm --filter asset test` | Runs component tests |
| Check code style | `pnpm --filter asset lint` | Finds and fixes formatting issues |

## 📁 Project Structure

```
apps/frontend/asset/
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── page.tsx               # Home page (asset dashboard)
│   │   ├── assets/                # Asset listing and details
│   │   └── layout.tsx             # Shared layout
│   ├── components/                # Reusable UI components
│   │   ├── AssetCard.tsx
│   │   ├── AssetTable.tsx
│   │   └── SearchBar.tsx
│   ├── lib/                       # Utilities and helpers
│   │   ├── api.ts                 # API calling functions
│   │   └── utils.ts               # Helper functions
│   └── styles/                    # Global styles
└── public/                        # Static assets (images, icons)
```

### Understanding the Structure

- **`app/`**: Each folder represents a route (e.g., `app/assets` → `/assets`)
- **`components/`**: Reusable UI pieces used across multiple pages
- **`lib/`**: Helper functions and API calls
- **`public/`**: Images, logos, and other static files

## 🛠️ Adding New Features

### Creating a New Page

```bash
# Pages are created as folders in the app directory
cd apps/frontend/asset/src/app
mkdir new-page
echo "export default function NewPage() { return <div>New Page</div>; }" > new-page/page.tsx
```

The page will automatically be available at `/new-page`!

### Creating a New Component

```bash
cd apps/frontend/asset/src/components
# Create a new component file
```

```tsx
// Example: AssetCard.tsx
import { Asset } from '@aria/types';

interface AssetCardProps {
  asset: Asset;
}

export function AssetCard({ asset }: AssetCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <h3>{asset.name}</h3>
      <p>{asset.description}</p>
    </div>
  );
}
```

### Best Practices

1. **Use shared types**: Always import types from `@aria/types`
2. **Server Components first**: Use regular components by default; add `'use client'` only when you need interactivity
3. **Responsive design**: Use Tailwind classes to ensure mobile-friendly layouts
4. **Accessibility**: Add proper labels, ARIA attributes, and keyboard navigation

## 🔒 Type Safety & Shared Code

### Using Shared Types

```typescript
// ✅ Good: Import from shared types
import { Asset, AssetCategory } from '@aria/types';

function AssetList({ assets }: { assets: Asset[] }) {
  // Your code here
}

// ❌ Bad: Creating types locally
interface Asset {
  /* ... */
}
```

### Using Path Aliases

Next.js is configured with path aliases for cleaner imports:

```typescript
// ✅ Good: Using path alias
import { AssetCard } from '@asset/components/AssetCard';
import { fetchAssets } from '@asset/lib/api';

// ❌ Bad: Relative imports
import { AssetCard } from '../../components/AssetCard';
```

## 🐛 Debugging Tips

### App Won't Start?

1. **Make sure dependencies are installed**:

   ```bash
   pnpm install
   ```

2. **Check for TypeScript errors**:

   ```bash
   pnpm --filter asset exec tsc --noEmit
   ```

3. **Clear Next.js cache**:
   ```bash
   rm -rf apps/frontend/asset/.next
   ```

### Page Not Loading?

- Check the console (F12) for errors
- Verify the backend API is running
- Check network tab to see if API calls are failing

### Styling Not Working?

- Tailwind processes styles automatically
- Make sure class names are correct (check Tailwind docs)
- Hard refresh the page (Ctrl+Shift+R)

## 📚 Learning Resources

### New to Next.js?

- [Next.js Documentation](https://nextjs.org/docs) - Official Next.js docs
- [Learn Next.js](https://nextjs.org/learn) - Interactive tutorial
- [Next.js App Router](https://nextjs.org/docs/app) - App Router guide

### New to React?

- [React Documentation](https://react.dev/) - Official React docs
- [React Tutorial](https://react.dev/learn) - Learn React step by step

### New to Tailwind CSS?

- [Tailwind Documentation](https://tailwindcss.com/docs) - Complete Tailwind reference
- [Tailwind Cheat Sheet](https://nerdcave.com/tailwind-cheat-sheet) - Quick reference

## 🎯 Development Workflow

1. **Create a new branch** for your feature
2. **Start the dev server**: `pnpm --filter asset dev`
3. **Make your changes** - edit components, pages, or styles
4. **Test in browser** - check that everything works
5. **Run lint and type-check**:
   ```bash
   pnpm --filter asset lint
   pnpm --filter asset exec tsc --noEmit
   ```
6. **Build to verify**:
   ```bash
   pnpm --filter asset build
   ```

## 💡 Pro Tips

- **Hot reload**: Changes appear instantly in the browser—no manual refresh needed!
- **Console logs**: Use `console.log()` to debug—they appear in your terminal and browser console
- **TypeScript errors**: Red squiggles in your editor show problems before you run the code
- **Tailwind IntelliSense**: Install the Tailwind CSS IntelliSense VSCode extension for autocomplete
- **Network inspector**: Use browser DevTools (F12) → Network tab to see API calls

## 🔗 Related Documentation

- [Main Project README](../../../README.md) - Project overview and setup
- [Backend API README](../../backend/README.md) - API documentation
- [Shared Types](../../../packages/types/README.md) - TypeScript type definitions
- [Development Agents](../../../AGENTS.md) - Architectural principles

---

**Questions?** Check out the [Next.js Discord](https://discord.gg/nextjs) or review existing components in `src/components/` for examples!
