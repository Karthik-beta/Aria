import { expect, test } from "./fixtures";

test.describe("Asset value adjustment", () => {
	test("loads the persisted adjustment list route", async ({ page }) => {
		await page.goto("/asset/value-adjustments", {
			waitUntil: "domcontentloaded",
		});

		await expect(page).toHaveURL(/\/asset\/value-adjustments\/?$/);
		await expect(
			page.getByRole("heading", { name: /asset value adjustment/i }),
		).toBeVisible({ timeout: 30_000 });
		await expect(page.getByPlaceholder(/search adjustments/i)).toBeVisible();
	});

	test("loads the persisted adjustment form route", async ({ page }) => {
		await page.goto("/asset/value-adjustments/form", {
			waitUntil: "domcontentloaded",
		});

		await expect(page).toHaveURL(/\/asset\/value-adjustments\/form\/?$/);
		await expect(
			page.getByRole("heading", { name: /asset value adjustment/i }),
		).toBeVisible({ timeout: 30_000 });
		await expect(page.getByLabel(/new asset value/i)).toBeVisible();
		await expect(page.getByLabel(/difference account/i)).toBeVisible();
	});
});
