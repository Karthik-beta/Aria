import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		name: "frontend",
		globals: true,
		environment: "jsdom",
		pool: "forks",
		fileParallelism: false,
		isolate: true,
		clearMocks: true,
		mockReset: true,
		setupFiles: ["./test/setup.ts"],
		include: ["**/*.{test,spec}.{ts,tsx}"],
		exclude: [
			...configDefaults.exclude,
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
				"src/app/**",
				"src/lib/trpc/**",
			],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 75,
				statements: 80,
			},
		},
		restoreMocks: true,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@aria/types": path.resolve(__dirname, "../../packages/types/src"),
			"@aria/utils": path.resolve(__dirname, "../../packages/utils/src"),
		},
	},
});
