# E2E Testing with Playwright

> Comprehensive guide to End-to-End testing in the Aria frontend using Playwright

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)
- [Debugging](#debugging)
- [Troubleshooting](#troubleshooting)

## Overview

### What is E2E Testing?

End-to-End (E2E) testing validates complete user workflows from start to finish, simulating real user interactions with the application. Unlike unit or component tests, E2E tests run against the fully deployed application.

### Why Playwright?

- **Cross-browser testing**: Chromium, Firefox, WebKit
- **Mobile emulation**: Test responsive designs
- **Auto-wait**: Built-in smart waiting for elements
- **Network control**: Intercept and mock API calls
- **Trace viewer**: Visual debugging of test failures
- **Parallel execution**: Fast test runs
- **CI/CD ready**: First-class GitHub Actions support

### Test Structure

```
apps/frontend/
├── tests/                          # E2E test files
│   ├── advanced-data-table.spec.ts # Data table tests
│   ├── auth.spec.ts                # Authentication tests
│   └── user-journeys.spec.ts       # Complete user workflows
├── playwright.config.ts            # Playwright configuration
└── .github/
    └── workflows/
        └── playwright.yml          # CI/CD workflow
```

## Setup

### Installation

Playwright was installed using the official setup wizard:

```bash
pnpm create playwright
```

This installed:

- `@playwright/test` - Latest stable version (1.56.1)
- Browser binaries (Chromium, Firefox, WebKit)
- Example configuration and tests
- GitHub Actions workflow template

### Configuration

Our `playwright.config.ts` includes:

```typescript
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Multiple reporters for different environments
  reporter: process.env.CI ? [['github'], ['html']] : [['html'], ['list']],

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Test against multiple browsers
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],

  // Auto-start dev server
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

## Running Tests

### Basic Commands

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests in UI mode (interactive)
pnpm test:e2e:ui

# Run tests with browser visible
pnpm test:e2e:headed

# Run and debug tests
pnpm test:e2e:debug

# Generate tests using Codegen
pnpm test:e2e:codegen

# View HTML report
pnpm test:e2e:report
```

### Advanced Options

```bash
# Run specific test file
pnpm playwright test tests/auth.spec.ts

# Run tests matching pattern
pnpm playwright test --grep "sign in"

# Run on specific browser
pnpm playwright test --project=chromium

# Run with specific number of workers
pnpm playwright test --workers=4

# Update snapshots
pnpm playwright test --update-snapshots
```

## Writing Tests

### Test Anatomy

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/path/to/feature');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    const button = page.getByRole('button', { name: 'Submit' });

    // Act
    await button.click();

    // Assert
    await expect(page.getByText('Success')).toBeVisible();
  });
});
```

### Locator Strategies

Playwright recommends locating elements by user-facing attributes:

```typescript
// ✅ GOOD: User-facing locators (prioritize these)
page.getByRole('button', { name: 'Sign in' });
page.getByLabel('Email address');
page.getByPlaceholder('Enter your email');
page.getByText('Welcome back');
page.getByAltText('Company logo');
page.getByTitle('Close dialog');

// ✅ GOOD: Test IDs for complex scenarios
page.getByTestId('checkout-button');

// ⚠️ AVOID: CSS selectors (brittle to style changes)
page.locator('.btn-primary');
page.locator('#submit-form');
```

### Common Patterns

#### Navigation and Waiting

```typescript
// Navigate and wait for load
await page.goto('/inventory/items');
await page.waitForLoadState('networkidle');

// Wait for specific element
await page.waitForSelector('[data-slot="table"]');

// Auto-waiting (Playwright does this automatically)
await page.getByRole('button').click(); // Waits for button to be clickable
```

#### Form Interactions

```typescript
// Fill text input
await page.getByLabel('Email').fill('user@example.com');

// Select dropdown option
await page.getByRole('combobox').selectOption('Option 1');

// Check checkbox
await page.getByRole('checkbox', { name: 'I agree' }).check();

// Upload file
await page.getByLabel('Upload').setInputFiles('path/to/file.pdf');
```

#### Assertions

```typescript
// Visibility
await expect(page.getByText('Success')).toBeVisible();
await expect(page.getByText('Error')).not.toBeVisible();

// Text content
await expect(page.getByRole('heading')).toHaveText('Dashboard');
await expect(page.getByRole('cell')).toContainText('John');

// Attributes
await expect(page.getByRole('button')).toBeEnabled();
await expect(page.getByRole('checkbox')).toBeChecked();
await expect(input).toHaveAttribute('type', 'email');

// Count
await expect(page.getByRole('row')).toHaveCount(10);

// URL
await expect(page).toHaveURL(/dashboard/);
```

#### Network Interception

```typescript
// Wait for API call
const responsePromise = page.waitForResponse(
  (response) => response.url().includes('/api/items') && response.status() === 200
);
await page.getByRole('button', { name: 'Load' }).click();
await responsePromise;

// Mock API response
await page.route('/api/items', (route) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ items: [{ id: 1, name: 'Test' }] }),
  });
});
```

### Page Object Model (Advanced)

For complex applications, use Page Object Model:

```typescript
// pages/inventory-page.ts
export class InventoryPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/inventory/items');
  }

  async searchItems(query: string) {
    await this.page.getByPlaceholder('Search items').fill(query);
  }

  async selectFirstItem() {
    await this.page.locator('tbody input[type="checkbox"]').first().click();
  }

  async getItemCount() {
    return this.page.locator('[data-slot="table-row"]').count();
  }
}

// In test file
test('should search items', async ({ page }) => {
  const inventoryPage = new InventoryPage(page);
  await inventoryPage.goto();
  await inventoryPage.searchItems('widget');

  const count = await inventoryPage.getItemCount();
  expect(count).toBeGreaterThan(0);
});
```

## Best Practices

### 1. Use User-Facing Locators

```typescript
// ✅ Good - semantic, resilient
await page.getByRole('button', { name: 'Submit' }).click();

// ❌ Bad - implementation detail, brittle
await page.locator('.btn-primary.submit-btn').click();
```

### 2. Auto-Waiting Over Manual Waits

```typescript
// ✅ Good - Playwright waits automatically
await page.getByRole('button').click();

// ❌ Bad - unnecessary manual wait
await page.waitForTimeout(1000);
await page.locator('button').click();
```

### 3. Test Isolation

```typescript
// ✅ Good - each test is independent
test.beforeEach(async ({ page }) => {
  await page.goto('/inventory');
  // Reset state if needed
});

test('test 1', async ({ page }) => {
  // Test doesn't depend on other tests
});

test('test 2', async ({ page }) => {
  // Starts fresh
});
```

### 4. Descriptive Test Names

```typescript
// ✅ Good - clear intent
test('should display validation error when email is invalid', async ({ page }) => {

// ❌ Bad - unclear
test('email test', async ({ page }) => {
```

### 5. Group Related Tests

```typescript
test.describe('Authentication', () => {
  test.describe('Sign In', () => {
    test('should display form', async ({ page }) => {});
    test('should validate email', async ({ page }) => {});
  });

  test.describe('Sign Up', () => {
    test('should create account', async ({ page }) => {});
  });
});
```

### 6. Use Fixtures for Common Setup

```typescript
// fixtures.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/dashboard');
    await use(page);
  },
});

// In test
test('should access protected route', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/protected');
  await expect(authenticatedPage).toHaveURL('/protected');
});
```

### 7. Handle Conditional UI

```typescript
// Check if element exists before interacting
const popup = page.getByRole('dialog');
if (await popup.isVisible()) {
  await page.getByRole('button', { name: 'Close' }).click();
}
```

### 8. Meaningful Assertions

```typescript
// ✅ Good - specific assertion
await expect(page.getByRole('alert')).toHaveText('Item added to cart');

// ❌ Bad - vague
await expect(page.getByRole('alert')).toBeVisible();
```

## CI/CD Integration

### GitHub Actions

Our `.github/workflows/playwright.yml`:

```yaml
name: Playwright Tests
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright Browsers
        run: pnpm playwright install --with-deps

      - name: Run Playwright tests
        run: pnpm test:e2e

      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

### Running in CI

Tests automatically run on:

- Push to `main` or `master` branch
- Pull requests targeting `main` or `master`

View results:

1. Go to Actions tab in GitHub
2. Click on workflow run
3. Download `playwright-report` artifact for detailed HTML report

## Debugging

### Debug Mode

```bash
# Open Playwright Inspector
pnpm test:e2e:debug

# Debug specific test
pnpm playwright test tests/auth.spec.ts --debug
```

Features in debug mode:

- Step through test execution
- Inspect page at each step
- Edit and continue
- View console logs

### UI Mode

```bash
pnpm test:e2e:ui
```

Features:

- Watch mode with auto-rerun
- Time travel debugging
- Network tab
- Trace viewer

### Trace Viewer

Traces are automatically captured on first retry. View them:

```bash
# View trace from test-results
pnpm playwright show-trace test-results/<test-name>/trace.zip
```

Features:

- Action log with screenshots
- Network activity
- Console messages
- Source code

### Screenshots and Videos

Configured in `playwright.config.ts`:

```typescript
use: {
  screenshot: 'only-on-failure',  // Take screenshot on failure
  video: 'retain-on-failure',      // Record video, keep on failure
}
```

Find them in `test-results/<test-name>/` after test run.

### Console Logs

```typescript
// Listen to console messages
page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

// Listen to page errors
page.on('pageerror', (error) => console.log('PAGE ERROR:', error));
```

## Troubleshooting

### Test Timeout

```typescript
// Increase timeout for slow operations
test('slow operation', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes

  await page.goto('/slow-page');
});
```

### Flaky Tests

```typescript
// Retry flaky tests
test('potentially flaky', async ({ page }) => {
  test.fail(); // Mark as expected to fail sometimes

  // Or configure retries in playwright.config.ts
  // retries: 2
});
```

### Element Not Found

```typescript
// Wait for element to appear
await page.waitForSelector('[data-testid="content"]', { timeout: 10000 });

// Or use auto-waiting locators
await expect(page.getByTestId('content')).toBeVisible();
```

### Authentication Issues

```typescript
// Save authenticated state
test('login once', async ({ page, context }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('user@test.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Save storage state
  await context.storageState({ path: 'auth.json' });
});

// Reuse authenticated state
test.use({ storageState: 'auth.json' });

test('use authenticated session', async ({ page }) => {
  // Already logged in
  await page.goto('/dashboard');
});
```

### Port Conflicts

If port 3001 is already in use:

```typescript
// In playwright.config.ts, change webServer port
webServer: {
  command: 'pnpm dev',
  url: 'http://localhost:3002', // Different port
  // Also update baseURL
}
```

Or stop the existing server:

```bash
# Find process on port 3001
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess

# Kill it
Stop-Process -Id <PID>
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Locators Guide](https://playwright.dev/docs/locators)
- [Test Assertions](https://playwright.dev/docs/test-assertions)
- [GitHub Actions](https://playwright.dev/docs/ci-intro)

## Next Steps

1. **Add more test coverage**: Expand tests to cover all user journeys
2. **Visual regression testing**: Add screenshot comparison tests
3. **API mocking**: Mock backend responses for isolated frontend tests
4. **Performance testing**: Add performance assertions with web vitals
5. **Accessibility testing**: Integrate axe-core for automated a11y checks

---

**Happy Testing! 🎭**

For questions or issues, refer to the [Playwright Discord](https://aka.ms/playwright/discord) or create an issue in our repository.
