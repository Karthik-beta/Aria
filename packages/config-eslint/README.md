# 🛡️ @aria/eslint-config - Code Style Configuration

This package contains **ESLint configurations** that check your code for style issues and potential bugs. Think of it as a helpful assistant that reviews your code!

## 🎯 What is ESLint?

ESLint is a tool that:
- **Finds bugs** before you run your code
- **Enforces consistency** (everyone writes code the same way)
- **Auto-fixes issues** (it can fix many problems automatically!)
- **Prevents bad practices** (warns you about code that might cause issues)

### Real-World Example

```typescript
// ESLint catches this issue:
if (user = null) {  // ❌ Using = instead of ===
  console.log('No user');
}

// ESLint suggests:
if (user === null) {  // ✅ Correct comparison
  console.log('No user');
}
```

## 📚 Available Configurations

### For Next.js Apps (Frontends)

```javascript
// eslint.config.mjs
import ariaNext from '@aria/eslint-config/next';

export default [ariaNext];
```

This includes:
- React best practices
- Next.js specific rules
- Accessibility checks (a11y)
- TypeScript integration

### For NestJS (Backend)

```javascript
// eslint.config.mjs
import ariaNest from '@aria/eslint-config/nest';

export default [ariaNest];
```

This includes:
- NestJS patterns
- Node.js best practices
- TypeScript integration

### For Shared Packages

```javascript
// eslint.config.mjs
import ariaBase from '@aria/eslint-config/base';

export default [ariaBase];
```

This includes:
- Core TypeScript rules
- Universal JavaScript best practices

## 🚀 How to Use

### Running ESLint

```bash
# Check for issues in your app
pnpm --filter <app-name> lint

# Examples:
pnpm --filter backend lint      # Check backend code
pnpm --filter asset lint        # Check asset frontend
pnpm --filter crm lint          # Check CRM frontend
```

### Auto-Fixing Issues

```bash
# Fix issues automatically
pnpm --filter <app-name> lint --fix

# Or run format (which includes linting)
pnpm format
```

## 💡 Common Issues ESLint Catches

### 1. Unused Variables

```typescript
// ❌ ESLint will warn:
const unusedVariable = 'never used';
function hello() {
  return 'world';
}

// ✅ Fixed:
function hello() {
  return 'world';
}
```

### 2. Missing Dependencies in React Hooks

```typescript
// ❌ ESLint warns:
useEffect(() => {
  console.log(user.name);  // 'user' should be in dependency array
}, []);

// ✅ Fixed:
useEffect(() => {
  console.log(user.name);
}, [user]);  // Added user to dependencies
```

### 3. Accessibility Issues

```tsx
// ❌ ESLint warns:
<img src="logo.png" />  // Missing alt text

// ✅ Fixed:
<img src="logo.png" alt="Company Logo" />
```

### 4. Inconsistent Code Style

```typescript
// ❌ ESLint warns:
const message = "Hello"  // Missing semicolon, wrong quotes

// ✅ Fixed:
const message = 'Hello';
```

## 🐛 Understanding ESLint Messages

### Warning vs Error

- **Error** (❌): Your code won't pass CI - must fix
- **Warning** (⚠️): Should fix but not blocking

### Reading Error Messages

```
Error: 'user' is not defined (no-undef)
  --> src/components/UserCard.tsx:15:20
```

This means:
- **What**: Variable 'user' is not defined
- **Rule**: no-undef (the rule that caught it)
- **Where**: Line 15, column 20 in UserCard.tsx

## ⚙️ Configuring ESLint in Your App

### Basic Setup

```javascript
// eslint.config.mjs (for a Next.js app)
import ariaNext from '@aria/eslint-config/next';

export default [ariaNext];
```

### Adding Custom Rules

```javascript
// eslint.config.mjs
import ariaNext from '@aria/eslint-config/next';

export default [
  ariaNext,
  {
    rules: {
      // Customize specific rules
      'no-console': 'warn',  // Warn on console.log
      'prefer-const': 'error',  // Error if 'let' could be 'const'
    }
  }
];
```

## 🛠️ Editor Integration

### Visual Studio Code

1. **Install ESLint Extension**:
   - Open VSCode
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "ESLint"
   - Install it

2. **Enable Auto-Fix on Save**:
   ```json
   // .vscode/settings.json
   {
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     }
   }
   ```

Now ESLint will:
- Show errors with red squiggles
- Show warnings with yellow squiggles
- Auto-fix issues when you save!

## 📚 Rule Categories

### Possible Errors
Catches actual bugs:
- No duplicate keys in objects
- No unreachable code
- Valid regex patterns

### Best Practices
Encourages good patterns:
- Use `===` instead of `==`
- No unused variables
- Consistent return statements

### TypeScript
TypeScript-specific rules:
- Explicit return types for functions
- No `any` type (use specific types)
- Proper async/await usage

### React/Next.js
React-specific rules:
- Hook dependencies
- Key props in lists
- Proper component patterns

### Accessibility (a11y)
Ensures accessible code:
- Alt text for images
- Proper ARIA labels
- Keyboard navigation support

## 🐛 Troubleshooting

### "Parsing error" Messages

```bash
# Usually means TypeScript config issue
# Fix by rebuilding:
pnpm install
pnpm --filter @aria/eslint-config build
```

### ESLint is Slow

```bash
# Clear ESLint cache
rm -rf .eslintcache

# Or disable caching temporarily
pnpm lint --no-cache
```

### Rules Conflicting with Prettier

Our config already handles this! Prettier runs through ESLint, so they work together.

## 🔗 Related Documentation

- [ESLint Official Docs](https://eslint.org/docs/latest/) - Complete ESLint documentation
- [TypeScript ESLint](https://typescript-eslint.io/) - TypeScript-specific rules
- [Main Project README](../../README.md)

---

**Pro Tip**: Don't fight ESLint! If it warns about something, there's usually a good reason. These rules are based on community best practices.
