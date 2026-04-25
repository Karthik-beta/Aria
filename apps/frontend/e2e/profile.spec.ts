/**
 * E2E tests for the universal profile page at /profile.
 *
 * The profile page is accessible to all authenticated users regardless of
 * which app they are currently in. It has its own full shell layout
 * (sidebar + header) and is not gated by app access.
 *
 * Relies on NEXT_PUBLIC_DEV_AUTH_BYPASS=true (set in playwright.config.ts
 * webServer env) which injects a predictable "System Administrator" session.
 */
import { expect, test } from "@playwright/test";

test.describe("Profile page – universal sections", () => {
	test("renders My Profile heading", async ({ page }) => {
		await page.goto("/profile");
		await expect(
			page.getByRole("heading", { name: /my profile/i }),
		).toBeVisible();
	});

	test("renders Personal Information section", async ({ page }) => {
		await page.goto("/profile");
		await expect(page.getByText("Personal Information")).toBeVisible();
	});

	test("renders Account Security section", async ({ page }) => {
		await page.goto("/profile");
		await expect(page.getByText("Account Security")).toBeVisible();
	});

	test("renders Roles & App Access section", async ({ page }) => {
		await page.goto("/profile");
		await expect(page.getByText(/roles.*app access/i)).toBeVisible();
	});

	test("displays dev-bypass user name", async ({ page }) => {
		await page.goto("/profile");
		await expect(page.getByText("System Administrator")).toBeVisible();
	});

	test("Change Password link is present", async ({ page }) => {
		await page.goto("/profile");
		await expect(
			page.getByRole("link", { name: /change password/i }),
		).toBeVisible();
	});
});

test.describe("Profile page – app access badges (dev bypass session)", () => {
	test("shows all four app access cards for super_admin dev session", async ({
		page,
	}) => {
		await page.goto("/profile");

		await expect(page.getByTestId("app-access-inventory")).toBeVisible();
		await expect(page.getByTestId("app-access-asset")).toBeVisible();
		await expect(page.getByTestId("app-access-crm")).toBeVisible();
		await expect(page.getByTestId("app-access-hrms")).toBeVisible();
	});

	test("shows super admin system role badge", async ({ page }) => {
		await page.goto("/profile");
		await expect(page.getByText("super admin")).toBeVisible();
	});
});

test.describe("Profile page – accessible from any app context", () => {
	const APP_CONTEXTS = [
		"/inventory/dashboard/overview",
		"/asset/dashboard/overview",
		"/crm/dashboard/overview",
		"/hrms/dashboard/overview",
	] as const;

	for (const context of APP_CONTEXTS) {
		test(`navigating from ${context} via user dropdown reaches /profile`, async ({
			page,
		}) => {
			await page.goto(context);

			await page.goto("/profile");
			await expect(
				page.getByRole("heading", { name: /my profile/i }),
			).toBeVisible();
		});
	}
});
