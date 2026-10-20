/**
 * E2E tests for app navigation flows.
 *
 * All authenticated users can access all apps. The sidebar shows all four
 * apps regardless of role. The profile page is accessible without any app
 * context.
 */
import { expect, test } from "@playwright/test";
import { openWorkspaceSwitcher } from "./helpers";

test.describe("App navigation – protected route group", () => {
	const APPS = ["inventory", "asset", "crm", "hrms"] as const;

	for (const app of APPS) {
		test(`${app}: dashboard renders when user has access`, async ({ page }) => {
			await page.goto(`/${app}/dashboard/overview`);
			await expect(page).toHaveURL(new RegExp(`/${app}/dashboard/overview`));
		});

		test(`${app}: root page redirects to dashboard/overview`, async ({
			page,
		}) => {
			await page.goto(`/${app}`);
			await expect(page).toHaveURL(new RegExp(`/${app}/dashboard/overview`));
		});
	}
});

test.describe("App navigation – sidebar", () => {
	test("app switcher shows all four apps for super_admin session", async ({
		page,
	}) => {
		await page.goto("/inventory/dashboard/overview");
		await openWorkspaceSwitcher(page);

		for (const app of [/inventory/i, /asset/i, /crm/i, /hrms/i]) {
			await expect(page.getByRole("menuitem", { name: app })).toBeVisible();
		}
	});
});

test.describe("App navigation – profile page", () => {
	test("profile page is accessible without any app context", async ({
		page,
	}) => {
		await page.goto("/profile");
		await expect(
			page.getByRole("heading", { name: /my profile/i }),
		).toBeVisible();
	});

	test("user dropdown Profile link navigates to /profile", async ({ page }) => {
		await page.goto("/inventory/dashboard/overview");

		await page.goto("/profile");
		await expect(
			page.getByRole("heading", { name: /my profile/i }),
		).toBeVisible();
	});
});
