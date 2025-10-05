# 📋 @aria/types - Shared Type Definitions

This package contains **all the TypeScript type definitions** used across the Aria ERP system. Think of it as a dictionary that ensures the backend and all frontends speak the same language!

## 🎯 Why Do We Need This?

Imagine the backend says a "Customer" has a `phoneNumber`, but the frontend expects `phone`. Things break!

This package solves that by:

- **Single source of truth**: One definition of each data type
- **Prevents mistakes**: TypeScript catches mismatches before runtime
- **Easy updates**: Change a type once, everyone gets the update
- **Better autocomplete**: Your editor knows all available properties

## 📚 What's Inside?

### Domain Namespaces

Types are organized by business domain:

```typescript
import { Asset, CRM, HR, Inventory } from '@aria/types';

// Asset Management types
const asset: Asset.Item = {
  id: '123',
  name: 'Laptop',
  category: 'Electronics',
  assignedTo: 'emp-456',
};

// CRM types
const contact: CRM.Contact = {
  id: '789',
  name: 'John Doe',
  email: 'john@example.com',
  company: 'Acme Corp',
};

// HR types
const employee: HR.Employee = {
  id: 'emp-456',
  firstName: 'Jane',
  lastName: 'Smith',
  department: 'Engineering',
};

// Inventory types
const item: Inventory.Item = {
  sku: 'WIDGET-001',
  name: 'Widget',
  quantity: 100,
  warehouse: 'WH-A',
};
```

## 🚀 How to Use

### In Frontend Apps

```typescript
// app/contacts/page.tsx
import { CRM } from '@aria/types';

interface ContactListProps {
  contacts: CRM.Contact[];  // ✅ Using shared type
}

export function ContactList({ contacts }: ContactListProps) {
  return (
    <div>
      {contacts.map(contact => (
        <div key={contact.id}>{contact.name}</div>
      ))}
    </div>
  );
}
```

### In Backend

```typescript
// src/modules/crm/contacts.controller.ts
import { CRM } from '@aria/types';
import { Controller, Get } from '@nestjs/common';

@Controller('contacts')
export class ContactsController {
  @Get()
  findAll(): CRM.Contact[] {
    // ✅ Same type as frontend
    return this.contactsService.findAll();
  }
}
```

## 🔧 Common Commands

```bash
# Build the types package (run after making changes)
pnpm --filter @aria/types build

# Check for type errors
pnpm --filter @aria/types exec tsc --noEmit
```

## ➕ Adding New Types

### Step 1: Create the Type

```typescript
// packages/types/src/crm.ts
export namespace CRM {
  export interface Contact {
    id: string;
    name: string;
    email: string;
    phone?: string; // Optional property
    company?: string;
    createdAt: Date;
  }

  export enum ContactStatus {
    Active = 'ACTIVE',
    Inactive = 'INACTIVE',
    Archived = 'ARCHIVED',
  }
}
```

### Step 2: Export It

```typescript
// packages/types/src/index.ts
export * from './crm';
export * from './assets';
export * from './hr';
export * from './inventory';
```

### Step 3: Build

```bash
pnpm --filter @aria/types build
```

### Step 4: Use Everywhere!

Now all apps can import your new type:

```typescript
import { CRM } from '@aria/types';
```

## 💡 Best Practices

### 1. Make Types Descriptive

```typescript
// ❌ Bad: Vague
interface Data {
  value: string;
}

// ✅ Good: Clear
interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
}
```

### 2. Use Optional Properties

```typescript
interface Contact {
  id: string; // Required
  name: string; // Required
  email?: string; // Optional (notice the ?)
  phone?: string; // Optional
}
```

### 3. Use Enums for Fixed Values

```typescript
// ❌ Bad: String literals everywhere
function setStatus(status: 'active' | 'inactive') {}

// ✅ Good: Enum with autocomplete
enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}
function setStatus(status: Status) {}
```

### 4. Document Complex Types

```typescript
export interface PayrollCalculation {
  /** Base salary before any deductions */
  baseSalary: number;

  /** Total tax deductions (federal + state) */
  taxDeductions: number;

  /** Final amount paid to employee */
  netPay: number;
}
```

## 🐛 Troubleshooting

### "Cannot find module '@aria/types'"

```bash
# Make sure dependencies are installed
pnpm install

# Build the types package
pnpm --filter @aria/types build
```

### "Type 'X' is not assignable to type 'Y'"

This means there's a mismatch between what you're sending and what's expected.

```typescript
// If you see this error, check:
// 1. Are you passing all required fields?
// 2. Are the field types correct (string vs number)?
// 3. Is the data structure matching?

const contact: CRM.Contact = {
  id: '123',
  name: 'John',
  // email: 'john@example.com',  // ❌ Missing required field!
};
```

### Changes Not Showing Up?

```bash
# Rebuild the types package
pnpm --filter @aria/types build

# Restart your dev server
pnpm --filter <app-name> dev
```

## 📚 Project Structure

```
packages/types/
├── src/
│   ├── index.ts           # Main export file
│   ├── assets.ts          # Asset management types
│   ├── crm.ts             # CRM types
│   ├── hr.ts              # HR types
│   ├── inventory.ts       # Inventory types
│   └── common.ts          # Shared utility types
├── dist/                  # Generated files (don't edit!)
├── package.json
└── tsconfig.json
```

## 🔗 Related Documentation

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) - Learn TypeScript
- [Main Project README](../../README.md) - Project overview

---

**Remember**: When you change a type here, it affects the ENTIRE application. Always rebuild and test!
