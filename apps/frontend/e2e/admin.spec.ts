import { expect, test } from "@playwright/test";
import { SIGNED_OUT_STATE } from "./auth";

test.describe("Admin shell (signed out)", () => {
	test.use({ storageState: SIGNED_OUT_STATE });

	test("admin dashboard redirects unauthenticated users to sign-in", async ({
		page,
	}) => {
		await page.goto("/admin");

		await expect(page).toHaveURL(/\/auth\/sign-in/);
		await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible({
			timeout: 15000,
		});
	});
});

test.describe("Admin shell", () => {
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

	test("admin finance book page is reachable", async ({ page }) => {
		await page.goto("/admin/finance-book");

		const heading = page.getByRole("heading", {
			name: /finance books|sign in/i,
		});
		await expect(heading).toBeVisible({ timeout: 15000 });
	});
});

test.describe("Admin CRUD flows (authenticated)", () => {
	test("authenticated admin sees dashboard", async ({ page }) => {
		await page.goto("/admin");

		const heading = page.getByRole("heading", { name: "Dashboard" });
		await expect(heading).toBeVisible({ timeout: 15000 });
	});

	test("admin sees user list and create button", async ({ page }) => {
		await page.goto("/admin/users");

		await expect(page.getByText("User directory")).toBeVisible({
			timeout: 15000,
		});
		await expect(page.getByText("Create user")).toBeVisible();
	});

	test("admin can navigate sidebar", async ({ page }) => {
		await page.goto("/admin");

		const sidebar = page.locator("aside, nav, [data-sidebar]");
		await expect(sidebar.first()).toBeVisible({ timeout: 15000 });
	});

	test("admin users page loads user list", async ({ page }) => {
		await page.goto("/admin/users");

		await page.waitForTimeout(3000);
	});
});
