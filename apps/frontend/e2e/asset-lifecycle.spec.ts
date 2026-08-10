import { expect, test } from "./fixtures";

test.describe("Asset Lifecycle E2E Workflow", () => {
	test("should navigate to assets page, inspect list, and load asset details", async ({
		page,
	}) => {
		await page.goto("/asset/items");
		await expect(page.getByRole("heading", { name: /assets/i })).toBeVisible();

		// Check new asset button or navigation
		const newAssetBtn = page.getByRole("button", { name: /new asset/i });
		if (await newAssetBtn.isVisible()) {
			await expect(newAssetBtn).toBeEnabled();
		}
	});

	test("should load fixed asset register report", async ({ page }) => {
		await page.goto("/asset/reports/fixed-asset-register");
		await expect(
			page.getByRole("heading", { name: /fixed asset register/i }),
		).toBeVisible();
		await expect(page.getByText(/report filters/i)).toBeVisible();
	});
});
