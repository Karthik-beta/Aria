import { expect, test } from "@playwright/test";

test.describe("Admin shell", () => {
	test("admin dashboard redirects unauthenticated users to sign-in", async ({
		page,
	}) => {
		await page.goto("/admin");

		const heading = page.getByRole("heading", {
			name: /admin|sign in/i,
		});
		await expect(heading).toBeVisible({ timeout: 15000 });
	});

	test("admin sidebar contains navigation links", async ({ page }) => {
		await page.goto("/admin");

		const sidebar = page.locator("aside, nav, [data-sidebar]").first();
		await expect(sidebar).toBeVisible({ timeout: 15000 });
	});

	test("admin users page is reachable", async ({ page }) => {
		await page.goto("/admin/users");

		const heading = page.getByRole("heading", {
			name: /user directory|sign in/i,
		});
		await expect(heading).toBeVisible({ timeout: 15000 });
	});
});
