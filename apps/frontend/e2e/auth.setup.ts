import { expect, test as setup } from "@playwright/test";
import { ADMIN_STORAGE_STATE, E2E_ADMIN, E2E_BACKEND_URL } from "./auth";

/**
 * Sign in once against the real backend and persist the session cookies.
 *
 * @see https://playwright.dev/docs/auth#basic-shared-account-in-all-tests
 */
setup("authenticate as super admin", async ({ request, baseURL }) => {
	const response = await request.post(
		`${E2E_BACKEND_URL}/api/auth/sign-in/email`,
		{
			headers: { Origin: baseURL ?? "http://localhost:3000" },
			data: { email: E2E_ADMIN.email, password: E2E_ADMIN.password },
		},
	);
	expect(response.ok(), await response.text()).toBe(true);

	const session = await request.get(`${E2E_BACKEND_URL}/api/auth/get-session`);
	expect((await session.json())?.user?.role).toBe("super_admin");

	await request.storageState({ path: ADMIN_STORAGE_STATE });
});
