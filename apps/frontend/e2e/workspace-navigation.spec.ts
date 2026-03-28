import { expect, test } from "@playwright/test";
import { expectPath, switchWorkspace, WORKSPACES } from "./helpers";

test.describe("Workspace navigation", () => {
	test("root redirects to the inventory dashboard", async ({ page }) => {
		await page.goto("/");

		await expectPath(page, "/inventory/dashboard/overview");
		await expect(
			page.getByRole("heading", { name: /inventory dashboard/i }),
		).toBeVisible();
	});

	for (const workspace of WORKSPACES) {
		test(`inventory shell switches to ${workspace.label}`, async ({ page }) => {
			await page.goto("/inventory/dashboard/overview");

			await expect(
				page.getByRole("heading", { name: /inventory dashboard/i }),
			).toBeVisible();

			await switchWorkspace(page, workspace);
		});
	}
});
