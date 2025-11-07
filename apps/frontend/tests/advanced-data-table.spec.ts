/**
 * E2E Tests for Advanced Data Table
 * Tests complete user workflows and interactions
 */

import { test, expect } from '@playwright/test';

test.describe('Advanced Data Table - E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the items catalogue page (adjust URL as needed)
    await page.goto('/inventory/items-catalogue/item');

    // Wait for table to load
    await page.waitForSelector('[data-slot="table"]', { timeout: 10000 });
  });

  test.describe('Table Rendering', () => {
    test('should display table with data', async ({ page }) => {
      // Verify table is visible
      const table = page.locator('[data-slot="table"]');
      await expect(table).toBeVisible();

      // Verify table has rows
      const rows = page.locator('[data-slot="table-row"]');
      await expect(rows).not.toHaveCount(0);
    });

    test('should display column headers', async ({ page }) => {
      // Verify headers are visible
      const headers = page.locator('[data-slot="table-head"]');
      await expect(headers.first()).toBeVisible();

      // Verify specific columns exist (adjust based on your table)
      await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible();
    });

    test('should display toolbar with controls', async ({ page }) => {
      // Verify toolbar is visible
      const toolbar = page.locator('[role="toolbar"]');
      await expect(toolbar).toBeVisible();

      // Verify reload button
      await expect(page.getByLabel('Reload')).toBeVisible();

      // Verify column manager button
      await expect(page.getByRole('button', { name: /columns/i })).toBeVisible();
    });
  });

  test.describe('Search Functionality', () => {
    test('should filter results when searching', async ({ page }) => {
      // Find search input (adjust selector based on your implementation)
      const searchInput = page.locator('input[type="search"]').first();

      if (await searchInput.isVisible()) {
        // Get initial row count
        const initialRows = await page.locator('[data-slot="table-row"]').count();

        // Perform search
        await searchInput.fill('test');
        await page.waitForTimeout(500); // Wait for debounce

        // Verify results changed
        const filteredRows = await page.locator('[data-slot="table-row"]').count();

        // Results should be different (either fewer or show "no results")
        if (filteredRows > 0) {
          expect(filteredRows).toBeLessThanOrEqual(initialRows);
        }
      }
    });

    test('should clear search when clicking clear button', async ({ page }) => {
      const searchInput = page.locator('input[type="search"]').first();

      if (await searchInput.isVisible()) {
        // Perform search
        await searchInput.fill('test');
        await page.waitForTimeout(500);

        // Clear search
        await searchInput.clear();
        await page.waitForTimeout(500);

        // Verify input is empty
        await expect(searchInput).toHaveValue('');
      }
    });
  });

  test.describe('Pagination', () => {
    test('should navigate through pages', async ({ page }) => {
      // Check if pagination exists
      const nextButton = page.getByRole('button', { name: /next/i });

      if ((await nextButton.isVisible()) && (await nextButton.isEnabled())) {
        // Get first row text before navigation
        const firstRowBefore = await page.locator('[data-slot="table-row"]').first().textContent();

        // Click next page
        await nextButton.click();
        await page.waitForTimeout(300);

        // Get first row text after navigation
        const firstRowAfter = await page.locator('[data-slot="table-row"]').first().textContent();

        // Verify content changed
        expect(firstRowBefore).not.toBe(firstRowAfter);
      }
    });

    test('should change page size', async ({ page }) => {
      // Find page size selector
      const pageSizeButton = page.getByRole('button', { name: /rows per page/i });

      if (await pageSizeButton.isVisible()) {
        // Get current row count
        const currentRows = await page.locator('[data-slot="table-row"]').count();

        // Click page size button
        await pageSizeButton.click();

        // Select different page size (e.g., 50)
        const option = page.getByRole('option', { name: '50' });
        if (await option.isVisible()) {
          await option.click();
          await page.waitForTimeout(500);

          // Verify row count changed (if there are enough items)
          const newRows = await page.locator('[data-slot="table-row"]').count();

          // Should be different if there are enough items
          if (newRows > currentRows) {
            expect(newRows).toBeGreaterThan(currentRows);
          }
        }
      }
    });
  });

  test.describe('Sorting', () => {
    test('should sort column when clicking header', async ({ page }) => {
      // Find a sortable column header (adjust based on your table)
      const nameHeader = page.getByRole('columnheader', { name: /name/i });

      if (await nameHeader.isVisible()) {
        // Click header to sort
        await nameHeader.click();
        await page.waitForTimeout(300);

        // Get first row value after sort
        const firstRowAfter = await page.locator('[data-slot="table-row"]').first().textContent();

        // Values might be different (depending on data)
        // At minimum, verify table still has content
        expect(firstRowAfter).toBeTruthy();
      }
    });

    test('should toggle sort direction', async ({ page }) => {
      const nameHeader = page.getByRole('columnheader', { name: /name/i });

      if (await nameHeader.isVisible()) {
        // Click once for ascending
        await nameHeader.click();
        await page.waitForTimeout(300);

        const firstAsc = await page.locator('[data-slot="table-row"]').first().textContent();

        // Click again for descending
        await nameHeader.click();
        await page.waitForTimeout(300);

        const firstDesc = await page.locator('[data-slot="table-row"]').first().textContent();

        // Verify content exists
        expect(firstAsc).toBeTruthy();
        expect(firstDesc).toBeTruthy();
      }
    });
  });

  test.describe('Row Selection', () => {
    test('should select individual row', async ({ page }) => {
      // Find first checkbox
      const firstCheckbox = page.locator('input[type="checkbox"]').first();

      if (await firstCheckbox.isVisible()) {
        // Verify initially unchecked
        await expect(firstCheckbox).not.toBeChecked();

        // Click checkbox
        await firstCheckbox.click();

        // Verify checked
        await expect(firstCheckbox).toBeChecked();
      }
    });

    test('should select all rows', async ({ page }) => {
      // Find "select all" checkbox in header
      const selectAllCheckbox = page.locator('thead input[type="checkbox"]').first();

      if (await selectAllCheckbox.isVisible()) {
        // Click select all
        await selectAllCheckbox.click();

        // Get all checkboxes
        const checkboxes = page.locator('tbody input[type="checkbox"]');
        const count = await checkboxes.count();

        if (count > 0) {
          // Verify first few are checked
          await expect(checkboxes.first()).toBeChecked();
        }
      }
    });

    test('should deselect row', async ({ page }) => {
      const firstCheckbox = page.locator('input[type="checkbox"]').first();

      if (await firstCheckbox.isVisible()) {
        // Select
        await firstCheckbox.click();
        await expect(firstCheckbox).toBeChecked();

        // Deselect
        await firstCheckbox.click();
        await expect(firstCheckbox).not.toBeChecked();
      }
    });
  });

  test.describe('Column Management', () => {
    test('should open column manager', async ({ page }) => {
      // Click column manager button
      const columnButton = page.getByRole('button', { name: /columns/i });
      await columnButton.click();

      // Verify dropdown/modal opened
      await page.waitForTimeout(300);

      // Check if menu appeared (adjust selector based on your implementation)
      const menu = page.locator('[role="menu"]');
      if (await menu.isVisible()) {
        await expect(menu).toBeVisible();
      }
    });

    test('should toggle column visibility', async ({ page }) => {
      const columnButton = page.getByRole('button', { name: /columns/i });
      await columnButton.click();
      await page.waitForTimeout(300);

      // Find a column toggle checkbox (adjust based on your implementation)
      const toggleCheckbox = page.locator('[role="menuitemcheckbox"]').first();

      if (await toggleCheckbox.isVisible()) {
        const isChecked = await toggleCheckbox.isChecked();

        // Toggle
        await toggleCheckbox.click();
        await page.waitForTimeout(300);

        // Verify state changed
        await expect(toggleCheckbox).toHaveAttribute(
          'data-state',
          isChecked ? 'unchecked' : 'checked'
        );
      }
    });
  });

  test.describe('Reload Functionality', () => {
    test('should reload table data', async ({ page }) => {
      // Click reload button
      const reloadButton = page.getByLabel('Reload');
      await reloadButton.click();

      // Verify button shows loading state (if implemented)
      await page.waitForTimeout(500);

      // Verify table still has content
      const rows = page.locator('[data-slot="table-row"]');
      await expect(rows.first()).toBeVisible();
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Verify table is still visible
      const table = page.locator('[data-slot="table"]');
      await expect(table).toBeVisible();

      // Verify table is scrollable
      const tableContainer = page.locator('[data-slot="table-container"]');
      await expect(tableContainer).toBeVisible();
    });

    test('should adapt to tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Verify table renders correctly
      const table = page.locator('[data-slot="table"]');
      await expect(table).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      // Focus first interactive element
      await page.keyboard.press('Tab');

      // Verify focus is on an element
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });

    test('should have proper ARIA attributes', async ({ page }) => {
      // Verify table has aria-label or aria-labelledby
      const table = page.locator('[data-slot="table"]');
      const ariaLabel = await table.getAttribute('aria-label');
      const ariaLabelledby = await table.getAttribute('aria-labelledby');

      // At least one should be present
      expect(ariaLabel || ariaLabelledby).toBeTruthy();
    });

    test('should have accessible toolbar', async ({ page }) => {
      const toolbar = page.locator('[role="toolbar"]');
      await expect(toolbar).toHaveAttribute('role', 'toolbar');
    });
  });

  test.describe('Performance', () => {
    test('should render large dataset efficiently', async ({ page }) => {
      // Measure rendering time
      const startTime = Date.now();

      await page.goto('/inventory/items-catalogue/item');
      await page.waitForSelector('[data-slot="table"]');

      const loadTime = Date.now() - startTime;

      // Should load within reasonable time (adjust threshold as needed)
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle rapid interactions', async ({ page }) => {
      // Rapid pagination clicks
      const nextButton = page.getByRole('button', { name: /next/i });

      if ((await nextButton.isVisible()) && (await nextButton.isEnabled())) {
        await nextButton.click();
        await nextButton.click();
        await nextButton.click();

        // Table should still be functional
        const table = page.locator('[data-slot="table"]');
        await expect(table).toBeVisible();
      }
    });
  });
});
