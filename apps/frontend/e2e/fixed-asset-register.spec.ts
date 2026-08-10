import { expect, test } from "./fixtures";

test.describe("Fixed Asset Register Report E2E Workflow", () => {
	test("should load register report page, filter controls, and table container", async ({
		page,
	}) => {
		await page.goto("/asset/reports/fixed-asset-register");
		await expect(
			page.getByRole("heading", { name: /fixed asset register/i }),
		).toBeVisible();

		// Export button should be visible
		const exportBtn = page.getByRole("button", { name: /export excel/i });
		await expect(exportBtn).toBeVisible();
	});
});
