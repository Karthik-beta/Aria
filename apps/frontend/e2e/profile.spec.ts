/**
 * E2E tests for the universal profile page.
 *
 * Verifies that the profile page is reachable from every app context,
 * renders the expected structural sections, and shows user-specific data
 * derived from the development auth bypass session.
 *
 * Relies on NEXT_PUBLIC_DEV_AUTH_BYPASS=true (set in playwright.config.ts
 * webServer env) which injects a predictable "System Administrator" session.
 */
import { expect, test } from "@playwright/test";

const PROFILE_ROUTES = [
	"/inventory/dashboard/profile",
	"/asset/dashboard/profile",
	"/crm/dashboard/profile",
	"/hrms/dashboard/profile",
] as const;

const APP_LABELS: Record<string, string> = {
	"/inventory/dashboard/profile": "Inventory",
	"/asset/dashboard/profile": "Asset",
	"/crm/dashboard/profile": "CRM",
	"/hrms/dashboard/profile": "HRMS",
};

test.describe("Profile page – universal sections", () => {
	for (const route of PROFILE_ROUTES) {
		const appLabel = APP_LABELS[route];

		test(`${appLabel}: renders My Profile heading`, async ({ page }) => {
			await page.goto(route);
			await expect(
				page.getByRole("heading", { name: /my profile/i }),
			).toBeVisible();
		});

		test(`${appLabel}: renders Personal Information section`, async ({
			page,
		}) => {
			await page.goto(route);
			await expect(page.getByText("Personal Information")).toBeVisible();
		});

		test(`${appLabel}: renders Account Security section`, async ({ page }) => {
			await page.goto(route);
			await expect(page.getByText("Account Security")).toBeVisible();
		});

		test(`${appLabel}: renders Roles & App Access section`, async ({
			page,
		}) => {
			await page.goto(route);
			await expect(page.getByText(/roles.*app access/i)).toBeVisible();
		});

		test(`${appLabel}: displays dev-bypass user name`, async ({ page }) => {
			await page.goto(route);
			// DEV_AUTH_BYPASS session → name: "System Administrator"
			await expect(page.getByText("System Administrator")).toBeVisible();
		});

		test(`${appLabel}: Change Password link is present`, async ({ page }) => {
			await page.goto(route);
			await expect(
				page.getByRole("link", { name: /change password/i }),
			).toBeVisible();
		});

		test(`${appLabel}: does NOT contain inventory-specific copy`, async ({
			page,
		}) => {
			await page.goto(route);
			await expect(
				page.getByText(/inventory administrator/i),
			).not.toBeVisible();
		});
	}
});

test.describe("Profile page – app access badges (dev bypass session)", () => {
	test("shows all four app access cards for super_admin dev session", async ({
		page,
	}) => {
		await page.goto("/inventory/dashboard/profile");

		// dev-bypass grants access to inventory, asset, crm, hrms
		await expect(page.getByTestId("app-access-inventory")).toBeVisible();
		await expect(page.getByTestId("app-access-asset")).toBeVisible();
		await expect(page.getByTestId("app-access-crm")).toBeVisible();
		await expect(page.getByTestId("app-access-hrms")).toBeVisible();
	});

	test("shows super admin system role badge", async ({ page }) => {
		await page.goto("/inventory/dashboard/profile");
		await expect(page.getByText("super admin")).toBeVisible();
	});
});

test.describe("Profile page – navigation via user menu", () => {
	test("user dropdown contains a Profile link pointing to current app", async ({
		page,
	}) => {
		await page.goto("/inventory/dashboard/overview");

		// Open user dropdown – the trigger is the avatar button in the header
		const userMenuTrigger = page
			.getByRole("button", { name: /open user menu/i })
			.or(page.locator("[data-testid='user-nav-trigger']"))
			.first();

		// If a named trigger isn't found, fall back to finding the profile link directly
		const profileLink = page.getByRole("link", { name: /^profile$/i });
		if (await profileLink.isVisible()) {
			await expect(profileLink).toHaveAttribute(
				"href",
				/\/inventory\/dashboard\/profile/,
			);
		} else {
			// Try opening user dropdown and then check the profile link
			await userMenuTrigger.click();
			const dropdownProfileLink = page
				.getByRole("menuitem", { name: /profile/i })
				.or(page.getByRole("link", { name: /profile/i }));
			await expect(dropdownProfileLink.first()).toBeVisible();
		}
	});
});
