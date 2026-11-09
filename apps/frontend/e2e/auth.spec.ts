import { expect, test } from "@playwright/test";
import { SIGNED_OUT_STATE } from "./auth";

test.describe("Authentication shell", () => {
	test.use({ storageState: SIGNED_OUT_STATE });

	test("sign-in exposes the public login controls", async ({ page }) => {
		await page.goto("/auth/sign-in");

		await expect(
			page.getByText("Sign In", { exact: true }).first(),
		).toBeVisible();
		await expect(page.getByLabel(/email or username/i)).toBeVisible();
		await expect(page.getByLabel(/^password$/i)).toBeVisible();
		await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

		const passwordInput = page.getByLabel(/^password$/i);
		const toggleButton = page.getByRole("button", { name: /show password/i });

		await passwordInput.fill("Password123!");
		await expect(passwordInput).toHaveAttribute("type", "password");

		await toggleButton.click();
		await expect(passwordInput).toHaveAttribute("type", "text");

		await page.getByRole("button", { name: /hide password/i }).click();
		await expect(passwordInput).toHaveAttribute("type", "password");
	});

	test("sign-in routes to forgot password", async ({ page }) => {
		await page.goto("/auth/sign-in");

		await page.getByRole("button", { name: /forgot password/i }).click();

		await expect(page).toHaveURL(/\/auth\/forgot-password\/?$/);
		await expect(page.getByText(/reset your password/i)).toBeVisible();
	});

	test("forgot password returns to sign in", async ({ page }) => {
		await page.goto("/auth/forgot-password");

		await expect(page.getByText(/reset your password/i)).toBeVisible();
		await expect(page.getByLabel(/work email address/i)).toBeVisible();
		await expect(
			page.getByRole("button", { name: /send reset link/i }),
		).toBeVisible();

		await page.getByRole("button", { name: /back to sign in/i }).click();

		await expect(page).toHaveURL(/\/auth\/sign-in\/?$/);
		await expect(
			page.getByText("Sign In", { exact: true }).first(),
		).toBeVisible();
	});

	test("reset password surfaces the invalid token state", async ({ page }) => {
		await page.goto("/auth/reset-password");

		await expect(page.getByText(/unable to reset password/i)).toBeVisible();
		await expect(
			page.getByRole("button", { name: /back to reset request/i }),
		).toBeVisible();
	});

	test("sign-up points signed-out visitors at the dashboard sign-in", async ({
		page,
	}) => {
		await page.goto("/auth/sign-up");

		await expect(
			page.getByText(/self-service sign up disabled/i),
		).toBeVisible();

		await page.getByRole("link", { name: /view dashboard/i }).click();

		await expect(page).toHaveURL(/\/auth\/sign-in/);
		await expect(
			page.getByRole("button", { name: /^sign in$/i }),
		).toBeVisible();
	});
});
