/**
 * E2E tests for profile page access and functionality.
 */
import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "./auth";

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

	test("displays the signed-in user name", async ({ page }) => {
		await page.goto("/profile");
		await expect(page.getByText(E2E_ADMIN.name).first()).toBeVisible();
	});

	test("Change Password link is present", async ({ page }) => {
		await page.goto("/profile");
		await expect(
			page.getByRole("link", { name: /change password/i }),
		).toBeVisible();
	});
});

test.describe("Profile page – roles (super admin session)", () => {
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
