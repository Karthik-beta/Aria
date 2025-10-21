# Playwright Quick Reference

> Fast reference for common Playwright E2E testing patterns

## Running Tests

| Command                 | Description                      |
| ----------------------- | -------------------------------- |
| `pnpm test:e2e`         | Run all E2E tests                |
| `pnpm test:e2e:ui`      | Run tests in interactive UI mode |
| `pnpm test:e2e:debug`   | Run tests with debugger          |
| `pnpm test:e2e:headed`  | Run tests with browser visible   |
| `pnpm test:e2e:codegen` | Generate tests using Codegen     |
| `pnpm test:e2e:report`  | View HTML test report            |

## Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/path');
  });

  test('scenario', async ({ page }) => {
    // test code
  });
});
```

## Locators (Recommended Priority)

```typescript
// 1. Role-based (BEST)
page.getByRole('button', { name: 'Submit' });
page.getByRole('heading', { level: 1 });
page.getByRole('textbox', { name: 'Email' });

// 2. Label-based
page.getByLabel('Password');

// 3. Placeholder
page.getByPlaceholder('Enter email');

// 4. Text
page.getByText('Welcome');

// 5. Test ID
page.getByTestId('submit-button');

// 6. CSS (AVOID if possible)
page.locator('.class-name');
```

## Actions

```typescript
// Click
await page.getByRole('button').click();

// Fill input
await page.getByLabel('Email').fill('test@example.com');

// Select dropdown
await page.getByRole('combobox').selectOption('value');

// Check checkbox
await page.getByRole('checkbox').check();

// Upload file
await page.getByLabel('Upload').setInputFiles('file.pdf');

// Hover
await page.getByRole('button').hover();

// Focus
await page.getByRole('textbox').focus();

// Clear input
await page.getByLabel('Search').clear();

// Press key
await page.keyboard.press('Enter');
await page.keyboard.type('Hello');
```

## Assertions

```typescript
// Visibility
await expect(page.getByText('Success')).toBeVisible();
await expect(page.getByText('Error')).not.toBeVisible();

// Text
await expect(page.getByRole('heading')).toHaveText('Dashboard');
await expect(page.getByRole('cell')).toContainText('John');

// Attributes
await expect(page.getByRole('button')).toBeEnabled();
await expect(page.getByRole('button')).toBeDisabled();
await expect(page.getByRole('checkbox')).toBeChecked();
await expect(input).toHaveAttribute('type', 'email');

// Count
await expect(page.getByRole('row')).toHaveCount(10);

// URL
await expect(page).toHaveURL('/dashboard');
await expect(page).toHaveURL(/dashboard/);

// Value
await expect(input).toHaveValue('test@example.com');

// Class
await expect(element).toHaveClass('active');
```

## Navigation

```typescript
// Go to URL
await page.goto('/path');
await page.goto('https://example.com');

// Wait for load
await page.waitForLoadState('networkidle');
await page.waitForLoadState('domcontentloaded');

// Wait for element
await page.waitForSelector('[data-testid="content"]');

// Wait for URL
await page.waitForURL('/dashboard');

// Go back
await page.goBack();

// Reload
await page.reload();
```

## Waiting

```typescript
// Auto-waiting (preferred)
await page.getByRole('button').click(); // Waits automatically

// Wait for selector
await page.waitForSelector('[data-slot="table"]');

// Wait for timeout (AVOID)
await page.waitForTimeout(1000);

// Wait for function
await page.waitForFunction(() => window.innerWidth < 768);

// Wait for response
await page.waitForResponse((res) => res.url().includes('/api/'));
```

## Network

```typescript
// Wait for response
const response = await page.waitForResponse('/api/items');
console.log(await response.json());

// Mock API
await page.route('/api/items', (route) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ items: [] }),
  });
});

// Intercept all API calls
await page.route('**/api/**', (route) => {
  console.log(route.request().url());
  route.continue();
});
```

## Multiple Elements

```typescript
// Get all matching elements
const items = page.getByRole('listitem');

// Count
const count = await items.count();

// Iterate
for (let i = 0; i < count; i++) {
  const item = items.nth(i);
  await item.click();
}

// Get specific element
const first = items.first();
const last = items.last();
const third = items.nth(2);

// Filter
const checked = page.getByRole('checkbox').filter({ checked: true });
```

## Screenshots

```typescript
// Full page
await page.screenshot({ path: 'screenshot.png' });

// Element
await page.getByRole('button').screenshot({ path: 'button.png' });

// Full page with scroll
await page.screenshot({
  path: 'full.png',
  fullPage: true,
});
```

## Viewport

```typescript
// Set viewport size
await page.setViewportSize({ width: 1280, height: 720 });

// Mobile
await page.setViewportSize({ width: 375, height: 667 });

// Tablet
await page.setViewportSize({ width: 768, height: 1024 });
```

## Keyboard

```typescript
// Press key
await page.keyboard.press('Enter');
await page.keyboard.press('Tab');
await page.keyboard.press('Escape');

// Type text
await page.keyboard.type('Hello World');

// Modifier keys
await page.keyboard.press('Control+A');
await page.keyboard.press('Shift+Tab');

// Input
await page.getByRole('textbox').pressSequentially('text', { delay: 100 });
```

## Mouse

```typescript
// Click
await page.mouse.click(x, y);

// Double click
await page.mouse.dblclick(x, y);

// Right click
await page.mouse.click(x, y, { button: 'right' });

// Drag
await page.mouse.move(x1, y1);
await page.mouse.down();
await page.mouse.move(x2, y2);
await page.mouse.up();
```

## Context & Storage

```typescript
// Get cookies
const cookies = await context.cookies();

// Set cookies
await context.addCookies([
  {
    name: 'session',
    value: 'abc123',
    url: 'http://localhost:3001',
  },
]);

// Local storage
await page.evaluate(() => {
  localStorage.setItem('key', 'value');
  return localStorage.getItem('key');
});

// Session storage
await page.evaluate(() => {
  sessionStorage.setItem('key', 'value');
});
```

## Conditional Logic

```typescript
// Check if visible
if (await page.getByRole('dialog').isVisible()) {
  await page.getByRole('button', { name: 'Close' }).click();
}

// Check if enabled
if (await page.getByRole('button').isEnabled()) {
  await page.getByRole('button').click();
}

// Check if checked
if (await page.getByRole('checkbox').isChecked()) {
  await page.getByRole('checkbox').uncheck();
}

// Get count
const count = await page.getByRole('row').count();
if (count > 0) {
  await page.getByRole('row').first().click();
}
```

## Debugging

```typescript
// Pause execution
await page.pause();

// Take screenshot
await page.screenshot({ path: 'debug.png' });

// Console log
page.on('console', (msg) => console.log(msg.text()));

// Listen to errors
page.on('pageerror', (error) => console.log(error));

// Slow motion (in config)
use: {
  launchOptions: {
    slowMo: 500; // Slow down by 500ms
  }
}
```

## Test Configuration

```typescript
// Set timeout
test.setTimeout(60000); // 1 minute

// Skip test
test.skip('not ready', async ({ page }) => {});

// Only run this test
test.only('focus', async ({ page }) => {});

// Conditional skip
test('mobile only', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Desktop only');
  // test code
});

// Retry
test.describe(() => {
  test.describe.configure({ retries: 2 });

  test('flaky', async ({ page }) => {});
});
```

## Fixtures

```typescript
// Use built-in fixtures
test('example', async ({ page, context, browser }) => {
  // page - Current page
  // context - Browser context
  // browser - Browser instance
});

// Custom fixture
import { test as base } from '@playwright/test';

const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/sign-in');
    // Login logic
    await use(page);
  },
});

test('protected', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
});
```

## Common Patterns

### Login Once

```typescript
// global-setup.ts
import { chromium } from '@playwright/test';

export default async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.context().storageState({ path: 'auth.json' });
  await browser.close();
}

// playwright.config.ts
export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  use: {
    storageState: 'auth.json',
  },
});
```

### Page Object Model

```typescript
// pages/inventory.ts
export class InventoryPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/inventory');
  }

  async search(query: string) {
    await this.page.getByPlaceholder('Search').fill(query);
  }

  async getItemCount() {
    return this.page.getByRole('row').count();
  }
}

// test
import { InventoryPage } from './pages/inventory';

test('search', async ({ page }) => {
  const inventory = new InventoryPage(page);
  await inventory.goto();
  await inventory.search('widget');
  expect(await inventory.getItemCount()).toBeGreaterThan(0);
});
```

### Wait for API

```typescript
test('load data', async ({ page }) => {
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/items') && res.status() === 200
  );

  await page.getByRole('button', { name: 'Load' }).click();
  const response = await responsePromise;

  expect(response.ok()).toBeTruthy();
});
```

## Aria Roles Reference

| Element                   | Role           | Example                              |
| ------------------------- | -------------- | ------------------------------------ |
| `<button>`                | `button`       | `getByRole('button')`                |
| `<a>`                     | `link`         | `getByRole('link')`                  |
| `<input type="text">`     | `textbox`      | `getByRole('textbox')`               |
| `<input type="checkbox">` | `checkbox`     | `getByRole('checkbox')`              |
| `<input type="radio">`    | `radio`        | `getByRole('radio')`                 |
| `<select>`                | `combobox`     | `getByRole('combobox')`              |
| `<table>`                 | `table`        | `getByRole('table')`                 |
| `<tr>`                    | `row`          | `getByRole('row')`                   |
| `<th>`                    | `columnheader` | `getByRole('columnheader')`          |
| `<td>`                    | `cell`         | `getByRole('cell')`                  |
| `<img>`                   | `img`          | `getByRole('img')`                   |
| `<h1>-<h6>`               | `heading`      | `getByRole('heading', { level: 1 })` |
| `<ul>, <ol>`              | `list`         | `getByRole('list')`                  |
| `<li>`                    | `listitem`     | `getByRole('listitem')`              |
| `<nav>`                   | `navigation`   | `getByRole('navigation')`            |
| `<form>`                  | `form`         | `getByRole('form')`                  |
| `<dialog>`                | `dialog`       | `getByRole('dialog')`                |
| `role="alert"`            | `alert`        | `getByRole('alert')`                 |

---

**Pro Tip**: Always prefer user-facing locators (`getByRole`, `getByLabel`, etc.) over CSS selectors for more resilient tests!
