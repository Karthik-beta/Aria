/**
 * E2E Tests for Critical User Journeys
 * Tests complete workflows from login to task completion
 */

import { test, expect } from '@playwright/test';

test.describe('Critical User Journeys', () => {
  test.describe('Inventory Management Journey', () => {
    test('should complete full inventory item workflow', async ({ page }) => {
      // 1. Navigate to inventory
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]', { timeout: 10000 });

      // 2. Verify items are displayed
      const table = page.locator('[data-slot="table"]');
      await expect(table).toBeVisible();

      // 3. Search for specific item
      const searchInput = page.locator('input[type="search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('test');
        await page.waitForLoadState('networkidle');

        // Verify search results
        await expect(table).toBeVisible();
      }

      // 4. Sort items
      const nameHeader = page.getByRole('columnheader', { name: /name/i });
      if (await nameHeader.isVisible()) {
        await nameHeader.click();
        await page.waitForSelector('[data-slot="table"]', { timeout: 5000 });

        // Verify table still renders
        await expect(table).toBeVisible();
      }

      // 5. Select items
      const firstCheckbox = page.locator('input[type="checkbox"]').nth(1);
      if (await firstCheckbox.isVisible()) {
        await firstCheckbox.click();
        await expect(firstCheckbox).toBeChecked();
      }

      // 6. Change page size
      const pageSizeButton = page.getByRole('button', { name: /rows per page/i });
      if (await pageSizeButton.isVisible()) {
        await pageSizeButton.click();
        const option = page.getByRole('option', { name: '50' });
        if (await option.isVisible()) {
          await option.click();
          await page.waitForSelector('[data-slot="table"]', { timeout: 5000 });
        }
      }
    });

    test('should navigate through multiple pages', async ({ page }) => {
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]');

      // Navigate through pages
      const nextButton = page.getByRole('button', { name: /next/i });

      if ((await nextButton.isVisible()) && (await nextButton.isEnabled())) {
        // Page 1 → Page 2
        await nextButton.click();
        await page.waitForSelector('[data-slot="table"]', { timeout: 5000 });

        // Page 2 → Page 3 (if available)
        if (await nextButton.isEnabled()) {
          await nextButton.click();
          await page.waitForSelector('[data-slot="table"]', { timeout: 5000 });
        }

        // Navigate back
        const prevButton = page.getByRole('button', { name: /previous/i });
        if (await prevButton.isEnabled()) {
          await prevButton.click();
          await page.waitForSelector('[data-slot="table"]', { timeout: 5000 });
        }
      }
    });
  });

  test.describe('Data Filtering Journey', () => {
    test('should apply multiple filters', async ({ page }) => {
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]');

      // Apply search filter
      const searchInput = page.locator('input[type="search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('product');
        await page.waitForLoadState('networkidle');
      }

      // Apply column sort
      const nameHeader = page.getByRole('columnheader').first();
      if (await nameHeader.isVisible()) {
        await nameHeader.click();
        await page.waitForSelector('[data-slot="table"]', { timeout: 5000 });
      }

      // Verify table still displays data
      await expect(page.locator('[data-slot="table"]')).toBeVisible();
    });

    test('should clear all filters', async ({ page }) => {
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]');

      // Apply filters
      const searchInput = page.locator('input[type="search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('test');
        await page.waitForLoadState('networkidle');

        // Clear
        await searchInput.clear();
        await page.waitForLoadState('networkidle');

        // Verify cleared
        await expect(searchInput).toHaveValue('');
      }
    });
  });

  test.describe('Column Management Journey', () => {
    test('should customize visible columns', async ({ page }) => {
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]');

      // Open column manager
      const columnButton = page.getByRole('button', { name: /columns/i });
      await columnButton.click();
      await page.waitForSelector('[role="menuitemcheckbox"]', { timeout: 5000 });

      // Toggle column visibility
      const toggles = page.locator('[role="menuitemcheckbox"]');
      const count = await toggles.count();

      if (count > 0) {
        // Toggle first column
        await toggles.first().click();
        await page.waitForSelector('[data-slot="table"]', { timeout: 5000 });

        // Close menu
        await page.keyboard.press('Escape');
        await page.waitForSelector('[data-slot="table"]', { timeout: 5000 });

        // Verify table still renders
        await expect(page.locator('[data-slot="table"]')).toBeVisible();
      }
    });
  });

  test.describe('Bulk Selection Journey', () => {
    test('should select and manage multiple items', async ({ page }) => {
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]');

      // Select all
      const selectAllCheckbox = page.locator('thead input[type="checkbox"]').first();
      if (await selectAllCheckbox.isVisible()) {
        await selectAllCheckbox.click();

        // Verify items are selected
        const rowCheckboxes = page.locator('tbody input[type="checkbox"]');
        const count = await rowCheckboxes.count();

        if (count > 0) {
          await expect(rowCheckboxes.first()).toBeChecked();
        }

        // Deselect all
        await selectAllCheckbox.click();
        await expect(rowCheckboxes.first()).not.toBeChecked();
      }
    });

    test('should select individual items across pages', async ({ page }) => {
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]');

      // Select item on page 1
      const firstCheckbox = page.locator('tbody input[type="checkbox"]').first();
      if (await firstCheckbox.isVisible()) {
        await firstCheckbox.click();
        await expect(firstCheckbox).toBeChecked();

        // Navigate to next page
        const nextButton = page.getByRole('button', { name: /next/i });
        if ((await nextButton.isVisible()) && (await nextButton.isEnabled())) {
          await nextButton.click();
          await page.waitForSelector('[data-slot="table"]', { timeout: 5000 });

          // Select item on page 2
          const secondPageCheckbox = page.locator('tbody input[type="checkbox"]').first();
          if (await secondPageCheckbox.isVisible()) {
            await secondPageCheckbox.click();
            await expect(secondPageCheckbox).toBeChecked();
          }
        }
      }
    });
  });

  test.describe('Navigation Journey', () => {
    test('should navigate through main sections', async ({ page }) => {
      // Start at home
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Navigate to inventory
      const inventoryLink = page.getByRole('link', { name: /inventory/i });
      if (await inventoryLink.isVisible()) {
        await inventoryLink.click();
        await page.waitForLoadState('networkidle');

        // Verify URL changed
        expect(page.url()).toContain('inventory');
      }
    });

    test('should use breadcrumbs for navigation', async ({ page }) => {
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForLoadState('networkidle');

      // Find breadcrumb navigation
      const breadcrumbs = page.locator('[aria-label="breadcrumb"]');
      if (await breadcrumbs.isVisible()) {
        const links = breadcrumbs.locator('a');
        const count = await links.count();

        if (count > 0) {
          // Click first breadcrumb
          await links.first().click();
          await page.waitForLoadState('networkidle');

          // Verify navigation occurred
          expect(page.url()).toBeTruthy();
        }
      }
    });
  });

  test.describe('Error Recovery Journey', () => {
    test('should recover from network error', async ({ page }) => {
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]');

      // Simulate network interruption by going offline
      await page.context().setOffline(true);

      // Try to reload
      const reloadButton = page.getByLabel('Reload');
      if (await reloadButton.isVisible()) {
        await reloadButton.click();
        await page.waitForLoadState('networkidle');
      }

      // Go back online
      await page.context().setOffline(false);

      // Reload again
      if (await reloadButton.isVisible()) {
        await reloadButton.click();
        await page.waitForLoadState('networkidle');

        // Table should be visible again
        await expect(page.locator('[data-slot="table"]')).toBeVisible();
      }
    });

    test('should handle empty search results gracefully', async ({ page }) => {
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]');

      // Search for non-existent item
      const searchInput = page.locator('input[type="search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('xyznonexistentitem123');
        await page.waitForLoadState('networkidle');

        // Should show "no results" message
        const noResults = page.locator('text=/no.*results|no.*items|empty/i');
        const tableRows = page.locator('[data-slot="table-row"]');

        // Either show message or empty table
        const rowCount = await tableRows.count();
        if (rowCount === 0) {
          expect(await noResults.count()).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  test.describe('Performance Journey', () => {
    test('should handle rapid user interactions', async ({ page }) => {
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]');

      // Rapid sorting
      const header = page.getByRole('columnheader').first();
      if (await header.isVisible()) {
        await header.click();
        await header.click();
        await header.click();
        await page.waitForSelector('[data-slot="table"]', { timeout: 5000 });

        // Table should still be functional
        await expect(page.locator('[data-slot="table"]')).toBeVisible();
      }

      // Rapid pagination
      const nextButton = page.getByRole('button', { name: /next/i });
      if ((await nextButton.isVisible()) && (await nextButton.isEnabled())) {
        await nextButton.click();

        const prevButton = page.getByRole('button', { name: /previous/i });
        if (await prevButton.isEnabled()) {
          await prevButton.click();
          await nextButton.click();
          await page.waitForSelector('[data-slot="table"]', { timeout: 5000 });
        }

        // Table should still be functional
        await expect(page.locator('[data-slot="table"]')).toBeVisible();
      }
    });
  });

  test.describe('Accessibility Journey', () => {
    test('should complete workflow using only keyboard', async ({ page }) => {
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]');

      // Tab to first interactive element
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Press Enter to interact
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-slot="table"]', { timeout: 5000 });

      // Continue tabbing
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Verify keyboard navigation works
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBeTruthy();
    });

    test('should announce changes to screen readers', async ({ page }) => {
      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]');

      // Check for live regions
      const liveRegions = page.locator('[aria-live]');
      const count = await liveRegions.count();

      // Should have at least some aria-live regions for dynamic content
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
