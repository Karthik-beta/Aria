import { expect, test as setup } from "@playwright/test";
import { ADMIN_STORAGE_STATE, E2E_ADMIN, E2E_BACKEND_URL } from "./auth";
import {
	ensureOrganization,
	FRONTEND_ORIGIN,
	setActiveOrganization,
	signInOrFail,
} from "./auth-api";

/**
 * Sign in once against the real backend and persist the session cookies.
 *
 * The E2E organization is created (if needed) and made active before the
 * storage state is saved, so the admin specs and the member spec share the
 * same organization (see the header of auth.ts).
 *
 * @see https://playwright.dev/docs/auth#basic-shared-account-in-all-tests
 */
setup("authenticate as super admin", async ({ playwright }) => {
	const request = await playwright.request.newContext({
		extraHTTPHeaders: { Origin: FRONTEND_ORIGIN },
	});

	await signInOrFail(request, E2E_ADMIN);

	const session = await request.get(`${E2E_BACKEND_URL}/api/auth/get-session`);
	expect((await session.json())?.user?.role).toBe("super_admin");

	const organization = await ensureOrganization(request);
	await setActiveOrganization(request, organization.id);

	await request.storageState({ path: ADMIN_STORAGE_STATE });
	await request.dispose();
});
