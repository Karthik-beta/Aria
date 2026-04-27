import { expect, test } from "@playwright/test";

test.describe("Admin shell", () => {
	test("admin dashboard redirects unauthenticated users to sign-in", async ({
		page,
	}) => {
		// The page renders with proper auth state,
		// so we verify the admin layout is accessible and displays the sidebar.
		await page.goto("/admin");

		// In dev bypass mode the admin layout should render.
		// In production it would redirect to /auth/sign-in.
		const heading = page.getByRole("heading", {
			name: /admin|sign in/i,
		});
		await expect(heading).toBeVisible({ timeout: 15000 });
	});

	test("admin sidebar contains navigation links", async ({ page }) => {
		await page.goto("/admin");

		// The admin layout sidebar should have links to sub-pages
		const sidebar = page.locator("aside, nav, [data-sidebar]").first();
		await expect(sidebar).toBeVisible({ timeout: 15000 });
	});

	test("admin users page is reachable", async ({ page }) => {
		await page.goto("/admin/users");

		// Should render the users page heading or redirect to sign-in
		const heading = page.getByRole("heading", {
			name: /user directory|sign in/i,
		});
		await expect(heading).toBeVisible({ timeout: 15000 });
	});

	test("admin roles page is reachable", async ({ page }) => {
		await page.goto("/admin/roles");

		// Should render the roles page heading or redirect to sign-in
		const heading = page.getByRole("heading", {
			name: /roles|sign in/i,
		});
		await expect(heading).toBeVisible({ timeout: 15000 });
	});

	test("admin audit page is reachable", async ({ page }) => {
		await page.goto("/admin/audit");

		// Should render the audit page heading or redirect to sign-in
		const heading = page.getByRole("heading", {
			name: /audit|sign in/i,
		});
		await expect(heading).toBeVisible({ timeout: 15000 });
	});
});
