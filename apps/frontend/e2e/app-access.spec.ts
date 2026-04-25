/**
 * E2E tests for app access flows.
 *
 * Tests the protected route group architecture where app-level access
 * is enforced server-side via requireAppAccess(). Routes outside the
 * (protected) route group (e.g. access-denied pages) render without
 * triggering the app access check.
 *
 * Relies on NEXT_PUBLIC_DEV_AUTH_BYPASS=true which grants full access,
 * so these tests cover the "happy path" and structural correctness.
 */
import { expect, test } from "@playwright/test";

test.describe("App access – protected route group", () => {
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

		test(`${app}: access-denied page renders without crash`, async ({
			page,
		}) => {
			await page.goto(`/${app}/access-denied`);
			await expect(
				page.getByText(/access restricted|do not have permission/i),
			).toBeVisible();
		});
	}
});

test.describe("App access – sidebar navigation", () => {
	test("app switcher shows all four apps for super_admin session", async ({
		page,
	}) => {
		await page.goto("/inventory/dashboard/overview");

		await page.goto("/profile");

		await expect(page.getByTestId("app-access-inventory")).toBeVisible();
		await expect(page.getByTestId("app-access-asset")).toBeVisible();
		await expect(page.getByTestId("app-access-crm")).toBeVisible();
		await expect(page.getByTestId("app-access-hrms")).toBeVisible();
	});
});

test.describe("App access – profile page independence", () => {
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
