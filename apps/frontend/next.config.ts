import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";
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
	// Keep server-only observability and Prisma dependencies external in the standalone server build.
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
	async redirects() {
		return [
			{
				source: "/asset",
				destination: "/asset/dashboard/overview",
				permanent: false,
			},
			{
				source: "/crm",
				destination: "/crm/dashboard/overview",
				permanent: false,
			},
			{
				source: "/hrms",
				destination: "/hrms/dashboard/overview",
				permanent: false,
			},
			{
				source: "/inventory",
				destination: "/inventory/dashboard/overview",
				permanent: false,
			},
			{
				source: "/asset/dashboard",
				destination: "/asset/dashboard/overview",
				permanent: false,
			},
			{
				source: "/crm/dashboard",
				destination: "/crm/dashboard/overview",
				permanent: false,
			},
			{
				source: "/hrms/dashboard",
				destination: "/hrms/dashboard/overview",
				permanent: false,
			},
			{
				source: "/inventory/dashboard",
				destination: "/inventory/dashboard/overview",
				permanent: false,
			},
			{
				source: "/admin",
				destination: "/admin/dashboard/overview",
				permanent: false,
			},
			{
				source: "/admin/dashboard",
				destination: "/admin/dashboard/overview",
				permanent: false,
			},
		];
	},
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
		];
	},
	poweredByHeader: false,
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();
const sentryOrg = process.env.SENTRY_ORG?.trim();
const sentryProject = process.env.SENTRY_PROJECT?.trim();
const hasSentryReleaseCredentials = Boolean(
	sentryAuthToken && sentryOrg && sentryProject,
);

export default hasSentryReleaseCredentials
	? withSentryConfig(nextConfig, {
			authToken: sentryAuthToken,
			org: sentryOrg,
			project: sentryProject,
			silent: true,
		})
	: nextConfig;
