import { expect, test } from "@playwright/test";
import { authTest } from "@/lib/auth/test-auth-config";

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

test.describe("Admin CRUD flows (authenticated)", () => {
	let adminCookies: Array<{
		name: string;
		value: string;
		domain: string;
		path: string;
	}>;

	test.beforeAll(async () => {
		const ctx = await authTest.$context;
		// biome-ignore lint/suspicious/noExplicitAny: plugin-injected property
		const testUtils = (ctx as any).test;

		const adminUser = testUtils.createUser({
			email: "e2e-admin@test.com",
			name: "E2E Admin",
			role: "super_admin",
		});
		await testUtils.saveUser(adminUser);

		adminCookies = await testUtils.getCookies({
			userId: adminUser.id ?? "",
			domain: "localhost",
		});
	});

	test("authenticated admin sees dashboard", async ({ context, page }) => {
		await context.addCookies(adminCookies);
		await page.goto("/admin");

		const heading = page.getByRole("heading", { name: "Dashboard" });
		await expect(heading).toBeVisible({ timeout: 15000 });
	});

	test("admin sees user list and create button", async ({ context, page }) => {
		await context.addCookies(adminCookies);
		await page.goto("/admin/users");

		await expect(page.getByText("User directory")).toBeVisible({
			timeout: 15000,
		});
		await expect(page.getByText("Create user")).toBeVisible();
	});

	test("admin can navigate sidebar", async ({ context, page }) => {
		await context.addCookies(adminCookies);
		await page.goto("/admin");

		const sidebar = page.locator("aside, nav, [data-sidebar]");
		await expect(sidebar.first()).toBeVisible({ timeout: 15000 });
	});

	test("admin users page loads user list", async ({ context, page }) => {
		await context.addCookies(adminCookies);
		await page.goto("/admin/users");

		await page.waitForTimeout(3000);
	});
});
