import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
	output: "standalone",
	transpilePackages: ["@aria/types", "@aria/utils"],
	turbopack: {
		root: path.join(__dirname, "../.."),
	},
	images: {
		unoptimized: isDev,
		formats: ["image/avif", "image/webp"],
		deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
		imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
	},
	trailingSlash: true,
	compiler: {
		removeConsole: !isDev && {
			exclude: ["error", "warn"],
		},
		reactRemoveProperties: !isDev,
	},
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
	async headers() {
		if (isDev) {
			return [];
		}

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
	poweredByHeader: false,
};

export default nextConfig;
