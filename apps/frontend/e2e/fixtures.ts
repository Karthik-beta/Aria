import { test as base, expect } from "@playwright/test";

const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL;
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD;

/**
 * Authenticated browser fixture for Asset E2E tests.
 *
 * Credentials are deliberately supplied by the test environment rather than
 * committed to the repository. The fixture first visits the protected target
 * so the app's callback URL is preserved by the normal sign-in flow.
 */
export const test = base.extend({
	page: async ({ page }, use, testInfo) => {
		if (!DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) {
			throw new Error(
				`Missing DEFAULT_ADMIN_EMAIL/DEFAULT_ADMIN_PASSWORD for ${testInfo.title}`,
			);
		}

		await page.goto("/asset/items", { waitUntil: "domcontentloaded" });
		const signInHeading = page.getByRole("heading", { name: /sign in/i });
		if (await signInHeading.isVisible().catch(() => false)) {
			await page.getByLabel(/email or username/i).fill(DEFAULT_ADMIN_EMAIL);
			await page.getByLabel(/^password$/i).fill(DEFAULT_ADMIN_PASSWORD);
			await page.getByRole("button", { name: /^sign in$/i }).click();
			await expect(page).not.toHaveURL(/\/auth\/sign-in/);
		}

		await use(page);
	},
});

export { expect };
