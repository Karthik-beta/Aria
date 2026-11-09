/**
 * Shared E2E auth settings.
 *
 * The Playwright backend web server seeds this super admin on boot through
 * DEFAULT_ADMIN_* (see AuthService.createDefaultUser), and auth.setup.ts signs
 * in with it once so every spec starts from an authenticated storage state.
 */
export const E2E_BACKEND_URL =
	process.env.E2E_BACKEND_URL ?? "http://localhost:3001";

export const E2E_ADMIN = {
	name: "E2E Administrator",
	username: process.env.E2E_ADMIN_USERNAME ?? "e2eadmin",
	email: process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@aria.test",
	password: process.env.E2E_ADMIN_PASSWORD ?? "E2e-Admin-Pass-123",
};

export const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";

/** Storage state for specs that exercise signed-out behaviour. */
export const SIGNED_OUT_STATE = { cookies: [], origins: [] };
