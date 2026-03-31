import { expect, test } from "@playwright/test";
import { expectPath } from "./helpers";

test.describe("Inventory module navigation", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/inventory/dashboard/overview");
		await expect(
			page.getByRole("heading", { name: /inventory dashboard/i }),
		).toBeVisible({ timeout: 15_000 });
	});

	test("sidebar contains core navigation links", async ({ page }) => {
		const sidebar = page.locator("nav, aside, [data-sidebar]").first();

		// Check for major inventory navigation sections
		for (const label of [
			"Items Catalogue",
			"Stock Transaction",
			"Stock Reports",
		]) {
			await expect(sidebar.getByText(label, { exact: false })).toBeVisible({
				timeout: 10_000,
			});
		}
	});

	test("navigates to items catalogue list", async ({ page }) => {
		await page.getByText("Items Catalogue", { exact: false }).first().click();
		// Wait for any items-related heading or content
		await expect(
			page.getByRole("heading", { name: /item/i }).first(),
		).toBeVisible({ timeout: 15_000 });

		// Verify URL navigated to an items-catalogue route
		await expect(page).toHaveURL(/\/inventory\/items-catalogue/);
	});

	test("navigates to warehouse settings", async ({ page }) => {
		// Open inventory settings section
		await page
			.getByText("Inventory Settings", { exact: false })
			.first()
			.click();
		await page.getByText("Warehouse", { exact: false }).first().click();

		await expectPath(page, "/inventory/inventory-settings/warehouse");
		await expect(
			page.getByRole("heading", { name: /warehouse/i }).first(),
		).toBeVisible({ timeout: 15_000 });
	});
});
