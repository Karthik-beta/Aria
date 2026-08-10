import { expect, test } from "./fixtures";

test.describe("Asset Repair E2E Workflow", () => {
	test("should load asset repairs page and open repair dialog", async ({
		page,
	}) => {
		await page.goto("/asset/repairs");
		await expect(
			page.getByRole("heading", { name: /asset repairs/i }),
		).toBeVisible();

		const recordBtn = page.getByRole("button", { name: /record repair/i });
		await expect(recordBtn).toBeVisible();
		await recordBtn.click();

		await expect(
			page.getByText(/record breakdown repair costs/i),
		).toBeVisible();
	});
});
