# 🧰 @aria/utils - Shared Utility Functions

This package contains **helper functions** that are used throughout the Aria ERP system. Instead of writing the same code multiple times, we write it once here and share it!

## 🎯 Why Do We Need This?

Imagine you need to format currency in 10 different places. Without shared utils:

- ❌ Copy-paste the same code 10 times
- ❌ If you find a bug, fix it in 10 places
- ❌ Different developers might format things differently

With shared utils:

- ✅ Write the function once
- ✅ Fix bugs in one place
- ✅ Everyone formats things the same way

## 📚 What's Inside?

### Formatting Functions

```typescript
import { formatCurrency, formatDate, formatPhone } from '@aria/utils';

// Currency formatting
formatCurrency(1234.56); // "$1,234.56"
formatCurrency(1234.56, 'EUR'); // "€1,234.56"

// Date formatting
formatDate(new Date()); // "Jan 15, 2024"
formatDate(new Date(), 'short'); // "1/15/24"

// Phone number formatting
formatPhone('1234567890'); // "(123) 456-7890"
```

### Validation Functions

```typescript
import { isValidEmail, isValidPhone, isValidURL } from '@aria/utils';

// Email validation
isValidEmail('user@example.com'); // true
isValidEmail('invalid-email'); // false

// Phone validation
isValidPhone('(123) 456-7890'); // true
isValidPhone('12345'); // false

// URL validation
isValidURL('https://example.com'); // true
isValidURL('not a url'); // false
```

### Calculation Functions

```typescript
import { calculateTax, calculateDiscount, roundTo } from '@aria/utils';

// Tax calculation
calculateTax(100, 0.08); // 8 (8% of 100)

// Discount calculation
calculateDiscount(100, 20); // 80 (20% off 100)

// Round to specific decimal places
roundTo(3.14159, 2); // 3.14
```

### String Manipulation

```typescript
import { capitalize, truncate, slugify } from '@aria/utils';

// Capitalize first letter
capitalize('hello world'); // "Hello world"

// Truncate long strings
truncate('This is a very long text...', 20); // "This is a very lo..."

// Create URL-friendly slugs
slugify('Hello World!'); // "hello-world"
```

## 🚀 How to Use

### In Frontend

```typescript
// app/products/page.tsx
import { formatCurrency } from '@aria/utils';

function ProductCard({ price }: { price: number }) {
  return (
    <div>
      <span>Price: {formatCurrency(price)}</span>
    </div>
  );
}
```

### In Backend

```typescript
// src/modules/orders/orders.service.ts
import { calculateTax } from '@aria/utils';

export class OrdersService {
  calculateTotal(subtotal: number, taxRate: number) {
    const tax = calculateTax(subtotal, taxRate);
    return subtotal + tax;
  }
}
```

## ➕ Adding New Utilities

### Step 1: Write the Function

```typescript
// packages/utils/src/formatting.ts

/**
 * Formats a number as a percentage
 * @param value - The number to format (0.15 = 15%)
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
```

### Step 2: Export It

```typescript
// packages/utils/src/index.ts
export * from './formatting';
export * from './validation';
export * from './calculations';
```

### Step 3: Build

```bash
pnpm --filter @aria/utils build
```

### Step 4: Use It!

```typescript
import { formatPercentage } from '@aria/utils';

formatPercentage(0.15); // "15%"
formatPercentage(0.1567, 2); // "15.67%"
```

## 💡 Best Practices

### 1. Keep Functions Pure

```typescript
// ❌ Bad: Has side effects (modifies external state)
let total = 0;
function addToTotal(value: number) {
  total += value; // Modifies external variable
}

// ✅ Good: Pure function (no side effects)
function add(a: number, b: number): number {
  return a + b; // Only uses inputs, returns output
}
```

### 2. Add Type Safety

```typescript
// ❌ Bad: No types
function format(value, currency) {
  return `${currency}${value}`;
}

// ✅ Good: With types
function formatCurrency(value: number, currency: string = 'USD'): string {
  return `${currency}${value.toFixed(2)}`;
}
```

### 3. Document Your Functions

```typescript
/**
 * Calculates the discount amount
 * @param price - Original price
 * @param discountPercent - Discount percentage (0-100)
 * @returns The discount amount
 * @example
 * calculateDiscount(100, 20)  // Returns 20
 */
export function calculateDiscount(price: number, discountPercent: number): number {
  return (price * discountPercent) / 100;
}
```

### 4. Write Tests (Coming Soon)

```typescript
// packages/utils/src/formatting.test.ts
import { formatCurrency } from './formatting';

test('formatCurrency formats correctly', () => {
  expect(formatCurrency(1234.56)).toBe('$1,234.56');
  expect(formatCurrency(0)).toBe('$0.00');
  expect(formatCurrency(-50)).toBe('-$50.00');
});
```

## 🐛 Common Mistakes

### Mistake 1: Including Side Effects

```typescript
// ❌ Bad: Makes API calls
export function fetchAndFormat(id: string) {
  const data = fetch(`/api/${id}`); // API call = side effect!
  return format(data);
}

// ✅ Good: Just formatting
export function formatData(data: any) {
  return {
    // Pure transformation
    ...data,
    formatted: true,
  };
}
```

### Mistake 2: Not Handling Edge Cases

```typescript
// ❌ Bad: Crashes on null/undefined
export function formatName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`;
}

// ✅ Good: Handles edge cases
export function formatName(firstName?: string, lastName?: string): string {
  if (!firstName && !lastName) return 'Unknown';
  if (!firstName) return lastName!;
  if (!lastName) return firstName;
  return `${firstName} ${lastName}`;
}
```

## 🔧 Commands

```bash
# Build the package
pnpm --filter @aria/utils build

# Check for type errors
pnpm --filter @aria/utils exec tsc --noEmit

# Run tests (coming soon)
pnpm --filter @aria/utils test
```

## 📚 Project Structure

```
packages/utils/
├── src/
│   ├── index.ts           # Main export file
│   ├── formatting.ts      # Format functions
│   ├── validation.ts      # Validation functions
│   ├── calculations.ts    # Math/calculation functions
│   └── strings.ts         # String manipulation
├── dist/                  # Generated files
├── package.json
└── tsconfig.json
```

## 🔗 Related Documentation

- [Main Project README](../../README.md)
- [@aria/types Package](../types/README.md) - Type definitions
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Pro Tip**: Before adding a new utility, check if it already exists. Use your editor's autocomplete to explore available functions!
