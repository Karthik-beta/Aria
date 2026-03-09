import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		name: "frontend",
		globals: true,
		environment: "jsdom",
		setupFiles: ["./test/setup.ts"],
		include: ["**/*.{test,spec}.{ts,tsx}"],
		exclude: [
			"node_modules",
			".next",
			"dist",
			"tests/**",
			"e2e/**",
			"playwright-report/**",
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html", "lcov"],
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/**/*.{test,spec}.{ts,tsx}",
				"src/**/*.d.ts",
				"src/app/**", // Exclude Next.js app directory (integration tests separate)
				"src/lib/trpc/**", // Exclude tRPC setup
			],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 75,
				statements: 80,
			},
		},
		mockReset: true,
		restoreMocks: true,
		clearMocks: true,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@aria/types": path.resolve(__dirname, "../../packages/types/src"),
			"@aria/utils": path.resolve(__dirname, "../../packages/utils/src"),
		},
	},
});
