import { expect, test as setup } from "@playwright/test";
import {
	E2E_ADMIN,
	E2E_BACKEND_URL,
	E2E_MEMBER,
	MEMBER_STORAGE_STATE,
} from "./auth";
import {
	acceptInvitation,
	createUser,
	ensureOrganization,
	FRONTEND_ORIGIN,
	inviteMember,
	listOrganizations,
	setActiveOrganization,
	signIn,
	signInOrFail,
} from "./auth-api";

/**
 * Provisions a plain organization member and stores its session.
 *
 * Runs after `setup` (which creates the organization). Idempotent: an existing
 * user, membership or invitation is reused. See the header of auth.ts for why
 * this uses better-auth's HTTP endpoints rather than a database seed.
 */
setup("authenticate as organization member", async ({ playwright }) => {
	const headers = { Origin: FRONTEND_ORIGIN };
	const adminRequest = await playwright.request.newContext({
		extraHTTPHeaders: headers,
	});
	const memberRequest = await playwright.request.newContext({
		extraHTTPHeaders: headers,
	});

	await signInOrFail(adminRequest, E2E_ADMIN);
	const organization = await ensureOrganization(adminRequest);

	// Create the member the first time; later runs sign in straight away.
	const firstSignIn = await signIn(memberRequest, E2E_MEMBER);
	if (!firstSignIn.ok()) {
		await createUser(adminRequest, E2E_MEMBER);
		await signInOrFail(memberRequest, E2E_MEMBER);
	}

	const memberOrganizations = await listOrganizations(memberRequest);
	if (!memberOrganizations.some((item) => item.id === organization.id)) {
		await inviteMember(adminRequest, organization.id, E2E_MEMBER.email);
		await acceptInvitation(memberRequest, organization.id);
	}

	await setActiveOrganization(memberRequest, organization.id);

	const session = await memberRequest.get(
		`${E2E_BACKEND_URL}/api/auth/get-session`,
	);
	const body = await session.json();
	expect(body?.user?.email).toBe(E2E_MEMBER.email);
	expect(body?.user?.role).not.toBe("super_admin");
	expect(body?.session?.activeOrganizationId).toBe(organization.id);

	await memberRequest.storageState({ path: MEMBER_STORAGE_STATE });
	await Promise.all([adminRequest.dispose(), memberRequest.dispose()]);
});
