import { type APIRequestContext, expect } from "@playwright/test";
import { E2E_BACKEND_URL, E2E_ORGANIZATION } from "./auth";

/**
 * Thin helpers around better-auth's HTTP endpoints, shared by the setup
 * projects. Every helper is idempotent so setup can run against a database
 * that already holds the E2E organization and users.
 */

export const FRONTEND_ORIGIN =
	process.env.PLAYWRIGHT_BASE_URL ||
	process.env.PLAYWRIGHT_TEST_BASE_URL ||
	"http://localhost:3000";

const authUrl = (path: string) => `${E2E_BACKEND_URL}/api/auth${path}`;

export type Credentials = { email: string; password: string };

type OrganizationSummary = { id: string; slug: string; name: string };

/** Signs in and leaves the session cookies on the request context. */
export async function signIn(
	request: APIRequestContext,
	credentials: Credentials,
) {
	return request.post(authUrl("/sign-in/email"), {
		data: { email: credentials.email, password: credentials.password },
	});
}

export async function signInOrFail(
	request: APIRequestContext,
	credentials: Credentials,
) {
	const response = await signIn(request, credentials);
	expect(
		response.ok(),
		`sign-in as ${credentials.email}: ${await response.text()}`,
	).toBe(true);
}

export async function listOrganizations(
	request: APIRequestContext,
): Promise<OrganizationSummary[]> {
	const response = await request.get(authUrl("/organization/list"));
	expect(response.ok(), await response.text()).toBe(true);
	return (await response.json()) as OrganizationSummary[];
}

/**
 * Returns the E2E organization, creating it when it does not exist yet.
 * Must run as a super admin (the only role allowed to create organizations).
 */
export async function ensureOrganization(
	request: APIRequestContext,
): Promise<OrganizationSummary> {
	const existing = (await listOrganizations(request)).find(
		(organization) => organization.slug === E2E_ORGANIZATION.slug,
	);
	if (existing) return existing;

	const response = await request.post(authUrl("/organization/create"), {
		data: { name: E2E_ORGANIZATION.name, slug: E2E_ORGANIZATION.slug },
	});
	if (!response.ok()) {
		// Another worker may have created it between the list and the create.
		const retry = (await listOrganizations(request)).find(
			(organization) => organization.slug === E2E_ORGANIZATION.slug,
		);
		if (retry) return retry;
	}
	expect(response.ok(), await response.text()).toBe(true);
	return (await response.json()) as OrganizationSummary;
}

/** Stores the organization on the session (`session.activeOrganizationId`). */
export async function setActiveOrganization(
	request: APIRequestContext,
	organizationId: string,
) {
	const response = await request.post(authUrl("/organization/set-active"), {
		data: { organizationId },
	});
	expect(response.ok(), await response.text()).toBe(true);
}

/** Admin plugin endpoint: creates a plain (non super admin) user. */
export async function createUser(
	request: APIRequestContext,
	user: Credentials & { name: string },
) {
	const response = await request.post(authUrl("/admin/create-user"), {
		data: {
			email: user.email,
			password: user.password,
			name: user.name,
			role: "user",
		},
	});
	expect(response.ok(), await response.text()).toBe(true);
}

/**
 * Invites `email` as a member and returns the invitation id. `resend` makes a
 * rerun reuse an invitation that is still pending instead of failing.
 */
export async function inviteMember(
	request: APIRequestContext,
	organizationId: string,
	email: string,
): Promise<string> {
	const response = await request.post(authUrl("/organization/invite-member"), {
		data: { email, role: "member", organizationId, resend: true },
	});
	expect(response.ok(), await response.text()).toBe(true);
	return ((await response.json()) as { id: string }).id;
}

/**
 * Accepts an invitation as the signed-in invitee. The id comes from the invite
 * response because listing a user's invitations requires a verified email.
 */
export async function acceptInvitation(
	request: APIRequestContext,
	invitationId: string,
) {
	const response = await request.post(
		authUrl("/organization/accept-invitation"),
		{ data: { invitationId } },
	);
	expect(response.ok(), await response.text()).toBe(true);
}
