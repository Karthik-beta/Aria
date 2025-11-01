# ⚙️ @aria/tsconfig - TypeScript Configuration

This package contains **TypeScript configuration files** that tell TypeScript how to check and compile your code. Think of it as the rulebook for TypeScript!

## 🎯 What is TypeScript Configuration?

The `tsconfig.json` file controls:

- **How strict** TypeScript checks your code
- **Which JavaScript version** to compile to
- **Path aliases** (like `@aria/types` instead of `../../../packages/types`)
- **What files** to include/exclude

## 📚 Available Configurations

### For Next.js Apps (Frontends)

```json
// apps/frontend/asset/tsconfig.json
{
  "extends": "@aria/tsconfig/next.json",
  "include": ["src"]
}
```

**What you get**:

- React/JSX support
- Next.js path aliases
- Browser-compatible settings
- Strict type checking

### For NestJS (Backend)

```json
// apps/backend/tsconfig.json
{
  "extends": "@aria/tsconfig/nest.json",
  "include": ["src"]
}
```

**What you get**:

- Node.js compatibility
- Decorator support (for NestJS)
- CommonJS modules
- Strict type checking

### For Shared Packages

```json
// packages/types/tsconfig.json
{
  "extends": "@aria/tsconfig/base.json",
  "include": ["src"]
}
```

**What you get**:

- Universal TypeScript settings
- No framework-specific rules
- Works everywhere

## 💡 Key Features

### 1. Strict Type Checking

All configs have **strict mode enabled**, which catches more errors:

```typescript
// ❌ TypeScript catches this:
function greet(name) {
  // Error: Parameter 'name' needs a type
  return `Hello ${name}`;
}

// ✅ Fixed:
function greet(name: string): string {
  return `Hello ${name}`;
}
```

### 2. Path Aliases

Instead of messy relative paths:

```typescript
// ❌ Bad:
import { User } from '../../../packages/types/src/user';
import { formatDate } from '../../../../packages/utils/src/format';

// ✅ Good:
import { User } from '@aria/types';
import { formatDate } from '@aria/utils';
```

Configured path aliases:

- `@aria/types` → Shared type definitions
- `@aria/utils` → Shared utilities
- `@asset/*` → Asset app internal paths
- `@crm/*` → CRM app internal paths
- `@hrms/*` → HRMS app internal paths
- `@inventory/*` → Inventory app internal paths

### 3. Modern JavaScript Output

All configs compile to **ES2022**, which means:

- Modern JavaScript features available
- Better performance
- Cleaner output code

## 🐛 Common TypeScript Errors

### Error: "Cannot find module '@aria/types'"

**Cause**: Package not built or not installed

**Fix**:

```bash
bun install
bun --filter @aria/types build
```

### Error: "Type 'string' is not assignable to type 'number'"

**Cause**: You're passing the wrong type

**Fix**: Check what type is expected and convert if needed

```typescript
// ❌ Error:
const age: number = '25'; // String to number

// ✅ Fixed:
const age: number = 25; // Correct type
// or
const age: number = parseInt('25'); // Convert string to number
```

### Error: "Object is possibly 'undefined'"

**Cause**: Strict null checks are enabled (good!)

**Fix**: Check for undefined before using

```typescript
// ❌ Error:
function greet(name?: string) {
  return name.toUpperCase(); // name might be undefined
}

// ✅ Fixed:
function greet(name?: string) {
  if (!name) return 'Hello';
  return name.toUpperCase();
}

// ✅ Or use optional chaining:
function greet(name?: string) {
  return name?.toUpperCase() ?? 'Hello';
}
```

### Error: "Property 'X' does not exist on type 'Y'"

**Cause**: Trying to access a property that doesn't exist

**Fix**: Check the type definition or add the property

```typescript
// ❌ Error:
interface User {
  name: string;
}
const user: User = { name: 'John' };
console.log(user.age); // 'age' doesn't exist

// ✅ Fixed: Add the property
interface User {
  name: string;
  age?: number; // Optional property
}
const user: User = { name: 'John', age: 30 };
console.log(user.age);
```

## 🛠️ Editor Setup

### Visual Studio Code

VSCode has built-in TypeScript support! It will:

- Show type errors with red squiggles
- Provide autocomplete based on types
- Show type information on hover
- Suggest quick fixes

**Pro Tip**: Hover over any variable to see its type!

### Key Shortcuts

- `F12` - Go to definition
- `Shift+F12` - Find all references
- `Ctrl+Space` - Trigger autocomplete
- `Ctrl+.` - Quick fix suggestions

## 📚 Understanding tsconfig.json Options

### Compiler Options (Most Important)

```json
{
  "compilerOptions": {
    // Type Checking
    "strict": true, // Enable all strict checks
    "noImplicitAny": true, // Don't allow 'any' type implicitly

    // Modules
    "module": "ESNext", // Use modern modules
    "moduleResolution": "bundler", // How to resolve imports

    // Emit
    "noEmit": true, // Don't output files (Next.js handles this)
    "target": "ES2022", // Output JavaScript version

    // Paths
    "baseUrl": ".",
    "paths": {
      "@aria/*": ["../../packages/*"] // Path aliases
    }
  }
}
```

## 🚀 Checking Your Code

### Type Check Without Building

```bash
# Check for type errors
bun --filter <app-name> exec tsc --noEmit

# Examples:
bun --filter backend exec tsc --noEmit
bun --filter asset exec tsc --noEmit
```

### Watch Mode (Auto-Check)

```bash
# Watch for changes and check automatically
bun --filter <app-name> exec tsc --noEmit --watch
```

## 💡 Pro Tips

1. **Trust TypeScript**: If TypeScript says something is wrong, it probably is
2. **Use hover**: Hover over variables to see their types
3. **Let TypeScript infer**: Don't over-annotate—let TypeScript figure out types
4. **Read error messages**: They usually tell you exactly what's wrong

### Type Inference Example

```typescript
// ❌ Don't over-annotate:
const name: string = 'John'; // TypeScript already knows it's a string

// ✅ Let TypeScript infer:
const name = 'John'; // TypeScript infers string type

// ✅ Do annotate function returns:
function getName(): string {
  // Good to be explicit here
  return 'John';
}
```

## 🔗 Related Documentation

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) - Official TypeScript docs
- [TypeScript for JavaScript Programmers](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html) - Quick intro
- [Main Project README](../../README.md)

---

**Remember**: TypeScript is here to help you, not frustrate you. The stricter the settings, the fewer bugs in production!
