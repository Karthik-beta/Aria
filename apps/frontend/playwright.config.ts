import { defineConfig, devices } from "@playwright/test";
import { ADMIN_STORAGE_STATE, E2E_ADMIN, E2E_BACKEND_URL } from "./e2e/auth";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI
		? [["github"], ["html", { open: "never" }]]
		: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL:
			process.env.PLAYWRIGHT_BASE_URL ||
			process.env.PLAYWRIGHT_TEST_BASE_URL ||
			"http://localhost:3000",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		actionTimeout: 15000,
	},
	timeout: 60000,
	expect: {
		timeout: 10000,
	},
	projects: [
		{
			name: "setup",
			testMatch: /auth\.setup\.ts/,
		},
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"], storageState: ADMIN_STORAGE_STATE },
			dependencies: ["setup"],
		},
	],
	webServer: [
		{
			// The frontend resolves sessions through the backend, so E2E runs the
			// real API. DEFAULT_ADMIN_* seeds the super admin used by auth.setup.ts.
			command: "bun run build && bun run start",
			cwd: "../backend",
			url: E2E_BACKEND_URL,
			reuseExistingServer: !process.env.CI,
			timeout: 180000,
			env: {
				PORT: new URL(E2E_BACKEND_URL).port || "3001",
				BETTER_AUTH_URL: E2E_BACKEND_URL,
				FRONTEND_URL: "http://localhost:3000",
				DEFAULT_ADMIN_NAME: E2E_ADMIN.name,
				DEFAULT_ADMIN_USERNAME: E2E_ADMIN.username,
				DEFAULT_ADMIN_EMAIL: E2E_ADMIN.email,
				DEFAULT_ADMIN_PASSWORD: E2E_ADMIN.password,
			},
		},
		{
			command: "bun dev",
			url: "http://localhost:3000",
			reuseExistingServer: !process.env.CI,
			timeout: 120000,
			env: {
				NEXT_PUBLIC_API_URL: E2E_BACKEND_URL,
				BACKEND_URL: E2E_BACKEND_URL,
			},
		},
	],
});
