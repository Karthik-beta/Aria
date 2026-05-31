import { expect, test } from "@playwright/test";

/**
 * E2E smoke tests for core application flows.
 */
test.describe("Smoke tests", () => {
	test("home page redirects to inventory dashboard", async ({ page }) => {
		const response = await page.goto("/");
		expect(response?.ok()).toBe(true);

		// Should redirect to the default workspace
		await expect(
			page.getByRole("heading", { name: /inventory dashboard/i }),
		).toBeVisible({ timeout: 15_000 });
	});

	test("sign-in page renders correctly", async ({ page }) => {
		const response = await page.goto("/auth/sign-in");
		expect(response?.ok()).toBe(true);

		await expect(page.getByText(/sign in/i).first()).toBeVisible({
			timeout: 10_000,
		});
	});

	test("inventory dashboard loads without console errors", async ({ page }) => {
		const consoleErrors: string[] = [];

		page.on("console", (msg) => {
			if (msg.type() === "error") {
				consoleErrors.push(msg.text());
			}
		});

		await page.goto("/inventory/dashboard/overview");
		await expect(
			page.getByRole("heading", { name: /inventory dashboard/i }),
		).toBeVisible({ timeout: 15_000 });

		// Filter out known benign errors (hydration, chunk loading in dev)
		const criticalErrors = consoleErrors.filter(
			(msg) =>
				!msg.includes("Hydration") &&
				!msg.includes("chunk") &&
				!msg.includes("favicon"),
		);

		expect(criticalErrors).toHaveLength(0);
	});

	test("admin page loads for authenticated users", async ({ page }) => {
		const response = await page.goto("/admin");

		// In dev bypass mode, should render the admin page
		// In non-bypass mode, may redirect to sign-in (both are acceptable)
		expect(response?.status()).toBeLessThan(500);

		// Should show either the admin content or a sign-in redirect
		await expect(
			page
				.getByRole("heading")
				.or(page.getByText(/sign in/i))
				.first(),
		).toBeVisible({ timeout: 10_000 });
	});

	test("non-existent route returns 404 page", async ({ page }) => {
		await page.goto("/this-route-does-not-exist-12345");

		// Should show a 404 or not-found indicator — not a 500 error
		const content = page.locator("body");
		await expect(content).not.toContainText("Internal Server Error");

		const heading = page.getByRole("heading").first();
		await expect(heading).toBeVisible({ timeout: 10_000 });
	});
});
