import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Configuration for Aria Frontend
 * E2E tests for Next.js application
 */
export default defineConfig({
	testDir: "./tests",

	/* Run tests in files in parallel */
	fullyParallel: true,

	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,

	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,

	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,

	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [["html"], ["list"], process.env.CI ? ["github"] : ["list"]],

	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('')`. */
		baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3001",

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: "on-first-retry",

		/* Screenshot on failure */
		screenshot: "only-on-failure",

		/* Video on failure */
		video: "retain-on-failure",

		/* Timeout for each action */
		actionTimeout: 15000,
	},

	/* Maximum time one test can run */
	timeout: 60000,

	/* Expect timeout */
	expect: {
		timeout: 10000,
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},

		{
			name: "firefox",
			use: { ...devices["Desktop Firefox"] },
		},

		{
			name: "webkit",
			use: { ...devices["Desktop Safari"] },
		},

		/* Test against mobile viewports. */
		{
			name: "Mobile Chrome",
			use: { ...devices["Pixel 5"] },
		},
		{
			name: "Mobile Safari",
			use: { ...devices["iPhone 12"] },
		},
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command: "pnpm dev",
		url: "http://localhost:3001",
		reuseExistingServer: !process.env.CI,
		timeout: 120000,
	},
});
