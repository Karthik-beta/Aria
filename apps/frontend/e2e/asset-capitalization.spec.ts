import { expect, test } from "./fixtures";

test.describe("Asset Capitalization E2E Workflow", () => {
	test("should load asset capitalizations page and open capitalization dialog", async ({
		page,
	}) => {
		await page.goto("/asset/capitalizations");
		await expect(
			page.getByRole("heading", { name: /asset capitalizations/i }),
		).toBeVisible();

		const capitalizeBtn = page.getByRole("button", {
			name: /capitalize asset/i,
		});
		await expect(capitalizeBtn).toBeVisible();
		await capitalizeBtn.click();

		await expect(page.getByText(/aggregate cwip stock items/i)).toBeVisible();
	});
});
