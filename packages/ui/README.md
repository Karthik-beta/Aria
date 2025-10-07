# @aria/ui

Shared UI component library for Aria ERP using Shadcn UI and Tailwind CSS v4.

## Overview

This package contains all shared UI components built with:

- **Shadcn UI** - Beautifully designed components
- **Tailwind CSS v4** - Latest utility-first CSS framework
- **Radix UI** - Unstyled, accessible component primitives
- **React 19** - Latest React features

## Usage

Import components in any frontend app:

```tsx
import { Button } from '@aria/ui';

export default function MyPage() {
  return <Button>Click me</Button>;
}
```

## Adding New Components

Use the Shadcn CLI from the package directory:

```bash
cd packages/ui
pnpx shadcn@latest add button
```

## Structure

```
src/
├── components/
│   └── ui/           # Shadcn UI components
├── hooks/            # Shared React hooks
├── lib/
│   └── utils.ts      # Utility functions (cn helper)
└── index.ts          # Main exports
```

## Development

```bash
# Type check
pnpm type-check

# Lint
pnpm lint
```
