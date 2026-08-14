import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * APP_TIME_ZONE is the single application business-timezone authority. Next
 * embeds the validated value into the browser bundle; the Asset date helpers
 * must never guess a timezone when this build contract is missing.
 */
function requiredApplicationTimeZone(): string {
	const timeZone = process.env.APP_TIME_ZONE?.trim();
	if (!timeZone) {
		throw new Error(
			"APP_TIME_ZONE is required to build the frontend business-date contract.",
		);
	}
	try {
		new Intl.DateTimeFormat("en", { timeZone }).format();
	} catch {
		throw new Error(`APP_TIME_ZONE is not a valid IANA timezone: ${timeZone}`);
	}
	return timeZone;
}

const applicationTimeZone = requiredApplicationTimeZone();

const nextConfig: NextConfig = {
	output: "standalone",
	env: {
		NEXT_PUBLIC_APP_TIME_ZONE: applicationTimeZone,
	},
	transpilePackages: ["@aria/api-contract", "@aria/types", "@aria/utils"],
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
			// Asset routes were renamed to short, stable URLs. Keep bookmarked and
			// shared legacy links working while callers migrate to the canonical paths.
			{
				source: "/asset/asset-sub-module/asset/:path*",
				destination: "/asset/items/:path*",
				permanent: true,
			},
			{
				source: "/asset/asset-sub-module/location/:path*",
				destination: "/asset/locations/:path*",
				permanent: true,
			},
			{
				source: "/asset/asset-sub-module/asset-category/:path*",
				destination: "/asset/categories/:path*",
				permanent: true,
			},
			{
				source: "/asset/asset-maintenance/maintenance-team/:path*",
				destination: "/asset/maintenance-teams/:path*",
				permanent: true,
			},
			{
				source: "/asset/asset-maintenance/maintenance/:path*",
				destination: "/asset/maintenance/:path*",
				permanent: true,
			},
			{
				source: "/asset/asset-maintenance/log/:path*",
				destination: "/asset/maintenance/log/:path*",
				permanent: true,
			},
			{
				source: "/asset/asset-maintenance/value-adjustment/:path*",
				destination: "/asset/value-adjustments/:path*",
				permanent: true,
			},
			{
				source: "/asset/value-adjustment/:path*",
				destination: "/asset/value-adjustments/:path*",
				permanent: true,
			},
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
