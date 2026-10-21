/**
 * Shared E2E auth settings.
 *
 * The Playwright backend web server seeds this super admin on boot through
 * DEFAULT_ADMIN_* (see AuthService.createDefaultUser), and auth.setup.ts signs
 * in with it once so every spec starts from an authenticated storage state.
 *
 * Organization member fixture (used by asset-member-readonly.spec.ts):
 * member.setup.ts provisions an organization member through better-auth's
 * public HTTP endpoints only, so no backend change, database access or extra
 * CI env var is needed:
 *   1. the super admin creates the E2E organization (`/organization/create`;
 *      only super admins may create organizations, see auth.config.ts),
 *   2. the super admin creates a plain user (`/admin/create-user`),
 *   3. the super admin invites that user with the `member` role
 *      (`/organization/invite-member`) and the user accepts the invitation
 *      (`/organization/accept-invitation`), because adding a member directly
 *      (`addMember`) exists only as a server-side API,
 *   4. the member calls `/organization/set-active` so the session carries
 *      `activeOrganizationId`, then the session is saved to MEMBER_STORAGE_STATE.
 * Every step checks for existing data first, so re-running the setup against a
 * database that already holds the user and organization is a no-op.
 *
 * The organization slug is `asset` on purpose: the asset workspace layout wraps
 * its pages in `<OrganizationGate orgSlug="asset">`, which only lets non-super
 * admins in when they belong to the organization with that slug. The admin
 * session also sets this organization active, so the admin specs and the member
 * spec operate on the same organization.
 */
export const E2E_BACKEND_URL =
	process.env.E2E_BACKEND_URL ?? "http://localhost:3001";

export const E2E_ADMIN = {
	name: "E2E Administrator",
	username: process.env.E2E_ADMIN_USERNAME ?? "e2eadmin",
	email: process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@aria.test",
	password: process.env.E2E_ADMIN_PASSWORD ?? "E2e-Admin-Pass-123",
};

export const E2E_MEMBER = {
	name: process.env.E2E_MEMBER_NAME ?? "E2E Member",
	email: process.env.E2E_MEMBER_EMAIL ?? "e2e-member@aria.test",
	password: process.env.E2E_MEMBER_PASSWORD ?? "E2e-Member-Pass-123",
};

export const E2E_ORGANIZATION = {
	name: process.env.E2E_ORGANIZATION_NAME ?? "Asset",
	slug: process.env.E2E_ORGANIZATION_SLUG ?? "asset",
};

export const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";
export const MEMBER_STORAGE_STATE = "playwright/.auth/member.json";

/** Storage state for specs that exercise signed-out behaviour. */
export const SIGNED_OUT_STATE = { cookies: [], origins: [] };
