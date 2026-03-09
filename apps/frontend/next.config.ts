import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../..",
);
const isDev = process.env.NODE_ENV !== "production";

// Multi-zone doesn't need basePath - routes are native to zones
const nextConfig: NextConfig = {
	// Transpile internal workspace packages (JIT pattern)
	transpilePackages: ["@aria/types", "@aria/utils"],

	// Turbopack configuration for monorepo
	turbopack: {
		root: workspaceRoot,
		// Enable resolve extensions for faster module resolution
		resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
	},

	// Development optimizations
	...(isDev
		? {
				// Faster refresh
				reactStrictMode: false, // Disable in dev for faster HMR

				// Webpack config for development (fallback when Turbopack not available)
				webpack: (config, { dev, isServer }) => {
					if (dev && !isServer) {
						// Enable HMR optimizations
						config.watchOptions = {
							poll: 300, // Check for changes every 300ms
							aggregateTimeout: 300, // Delay rebuild after change
							ignored: [
								"**/node_modules/**",
								"**/.git/**",
								"**/.next/**",
								"**/dist/**",
								"**/build/**",
							],
						};

						// Optimize module resolution
						config.snapshot = {
							managedPaths: [resolve(workspaceRoot, "node_modules")],
						};

						// Faster builds with caching
						config.cache = {
							type: "filesystem",
							allowCollectingMemory: true,
							buildDependencies: {
								config: [__filename],
							},
						};
					}
					return config;
				},
			}
		: {
				// Production optimizations
				reactStrictMode: true,
			}),

	// Enable standalone output for Docker
	output: isDev ? undefined : "standalone",

	// Optimize images
	images: {
		unoptimized: isDev, // Faster dev builds
		formats: ["image/avif", "image/webp"],
		deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
		imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
	},

	// Add trailing slash for consistent routing
	trailingSlash: true,

	// Performance optimizations
	experimental: {
		// Optimize package imports for smaller bundles
		optimizePackageImports: [
			"@radix-ui/react-icons",
			"@tabler/icons-react",
			"lucide-react",
			"recharts",
			"date-fns",
			"@dnd-kit/core",
			"@dnd-kit/sortable",
		],

		// Note: staleTimes was removed as it was causing infinite request loops
		// when combined with client-side navigation and redirects

		// Faster builds with module federation
		// optimizeCss: !isDev, // Disabled due to missing critters dependency
	},

	// Compiler optimizations
	compiler: {
		// Remove console logs in production only
		removeConsole: !isDev && {
			exclude: ["error", "warn"],
		},

		// React compiler optimizations
		reactRemoveProperties: !isDev,
	},

	// Server-side external packages (prevent bundling issues)
	serverExternalPackages: [
		"import-in-the-middle",
		"require-in-the-middle",
		"@sentry/nextjs",
		"@sentry/node",
		"@sentry/node-core",
		"@opentelemetry/instrumentation",
		"prisma",
		"@prisma/client",
	],

	// HTTP headers for better caching
	async headers() {
		if (isDev) return [];

		return [
			{
				source: "/:all*(svg|jpg|png|gif|ico|webp)",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
			{
				source: "/_next/static/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
		];
	},

	// No rewrites needed - Caddy reverse proxy handles all routing
	// In local development without Docker, access backend at localhost:3001 directly
	// or run Caddy locally for the full stack experience

	// Compression for faster loads
	compress: true,

	// Power saving mode off for better dev performance
	poweredByHeader: false,

	// Faster page generation
	generateEtags: !isDev,
};

export default nextConfig;
