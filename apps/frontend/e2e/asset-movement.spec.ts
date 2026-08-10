import { expect, test } from "./fixtures";

test.describe("Asset Movement E2E Workflow", () => {
	test("should load asset movements page and trigger new movement dialog", async ({
		page,
	}) => {
		await page.goto("/asset/movements");
		await expect(
			page.getByRole("heading", { name: /asset movements/i }),
		).toBeVisible();

		const newBtn = page.getByRole("button", { name: /new movement/i });
		await expect(newBtn).toBeVisible();
		await newBtn.click();

		await expect(page.getByText(/record asset transfers/i)).toBeVisible();
	});
});
