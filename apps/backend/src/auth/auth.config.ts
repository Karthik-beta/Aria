import { randomBytes } from "node:crypto";
import { logger } from "@aria/utils";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth/minimal";
import { createAccessControl } from "better-auth/plugins/access";
import { admin } from "better-auth/plugins/admin";
import { defaultStatements } from "better-auth/plugins/admin/access";
import { customSession } from "better-auth/plugins/custom-session";
import { username } from "better-auth/plugins/username";
import { prismaClient } from "../shared/prisma-client.js";

// Use the shared Prisma client singleton
const prisma = prismaClient;

const ac = createAccessControl({
	user: [
		"create",
		"list",
		"set-role",
		"ban",
		"impersonate",
		"delete",
		"set-password",
		"update",
	],
	session: ["list", "revoke"],
} as const);

// 1. Get the comma-separated string from the .env file
const frontendUrlsRaw = process.env.FRONTEND_URL || "http://localhost:3000";

// 2. Split the string into a proper array and remove trailing slashes
const frontendUrlsArray = frontendUrlsRaw
	.split(",")
	.map((url) => url.trim().replace(/\/$/, ""));

// 3. Get the backend URL and remove trailing slash
const backendUrl = (
	process.env.BETTER_AUTH_URL || "http://localhost:3001"
).replace(/\/$/, "");

// Determine whether to use secure cookies. In production we require secure cookies.
// Also allow secure when backendUrl uses https (useful for local HTTPS setups).
const useSecureCookies =
	process.env.NODE_ENV === "production" || backendUrl.startsWith("https");

// Extract parent domain from the first frontend URL for cookie sharing across subdomains.
// e.g. "https://app.aria.pivotr.in" -> ".aria.pivotr.in"
const cookieDomain = (() => {
	try {
		const firstFrontendUrl = frontendUrlsArray[0];
		if (firstFrontendUrl) {
			const url = new URL(firstFrontendUrl);
			const hostname = url.hostname; // e.g. "app.aria.pivotr.in"
			// Strip subdomain to get parent domain: "app.aria.pivotr.in" -> ".aria.pivotr.in"
			const parts = hostname.split(".");
			if (parts.length > 2) {
				return `.${parts.slice(-2).join(".")}`;
			}
			return hostname; // Return as-is for simple domains like "localhost"
		}
	} catch {
		// Fallback to null (let browser handle cookie scope)
	}
	return null;
})();

const resolveAuthSecret = (): string => {
	const configuredSecret = process.env.BETTER_AUTH_SECRET?.trim();
	if (configuredSecret) {
		return configuredSecret;
	}

	if (process.env.NODE_ENV === "production") {
		throw new Error(
			"BETTER_AUTH_SECRET is required in production. Refusing to start with an insecure auth secret.",
		);
	}

	const generatedSecret = randomBytes(32).toString("hex");
	logger.warn(
		"[Auth] BETTER_AUTH_SECRET is not set. Generated an ephemeral development secret for this process.",
	);
	return generatedSecret;
};

/**
 * Better Auth configuration with username/password authentication
 *
 * Uses Prisma adapter with PostgreSQL and the username plugin for authentication.
 * Sessions are configured with secure cookie handling and cross-site support.
 */
export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
		usePlural: false,
	}),

	// Enable email and password authentication
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false, // Disabled for production simplicity
		minPasswordLength: 8,
		maxPasswordLength: 128,
		sendResetPassword: async ({ user, url }) => {
			await sendPasswordResetEmail(user.email, url);
		},
		onPasswordReset: async ({ user }) => {
			try {
				await prisma.user.update({
					where: { id: user.id },
					data: {
						mustChangePassword: false,
						passwordChangedAt: new Date(),
					},
				});
			} catch (error) {
				logger.error("[Auth] Failed to update password reset metadata:", error);
			}
		},
	},

	// Username plugin for username-based sign-in
	plugins: [
		username({
			minUsernameLength: 3,
			maxUsernameLength: 20,
		}),
		customSession(async ({ user, session }) => {
			try {
				const passwordState = await prisma.user.findUnique({
					where: { id: user.id },
					select: {
						mustChangePassword: true,
						passwordChangedAt: true,
					},
				});

				return {
					user: {
						...user,
						mustChangePassword: passwordState?.mustChangePassword ?? false,
						passwordChangedAt: passwordState?.passwordChangedAt ?? null,
					},
					session,
				};
			} catch (error) {
				logger.error(
					"[Auth] Failed to load password metadata for session user:",
					error,
				);
				return {
					user: {
						...user,
						mustChangePassword: false,
						passwordChangedAt: null,
					},
					session,
				};
			}
		}),
		admin({
			ac,
			roles: {
				admin: ac.newRole({
					user: [
						"create",
						"list",
						"set-role",
						"ban",
						"impersonate",
						"delete",
						"set-password",
						"update",
					],
					session: ["list", "revoke"],
				}),
				user: ac.newRole({
					user: [],
					session: [],
				}),
				super_admin: ac.newRole({
					user: [
						"create",
						"list",
						"set-role",
						"ban",
						"impersonate",
						"delete",
						"set-password",
						"update",
					],
					session: ["list", "revoke"],
				}),
			},
			adminRoles: ["admin", "super_admin"],
			defaultRole: "user",
			defaultBanReason: "Policy violation",
			adminUserIds: process.env.DEFAULT_ADMIN_USER_ID
				? [process.env.DEFAULT_ADMIN_USER_ID]
				: [],
		}),
	],

	// Session configuration with cross-site cookie support
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // Update session every 24 hours
	},

	// Base URL for the authentication server
	// In production behind Caddy: this should be the domain where auth is accessible
	// Caddy proxies /api/auth/* to backend:3001, so baseURL should be the public domain
	baseURL: backendUrl,

	// Secret for signing tokens (must be set in production)
	secret: resolveAuthSecret(),

	// Trust proxy headers (required when behind reverse proxy)
	// Trust both the frontend domain and any localhost/IP access
	trustedOrigins: [
		...frontendUrlsArray, // This will add all your frontend URLs
		backendUrl, // Add your backend URL
		"https://localhost",
		"http://localhost",
	],

	// Advanced configuration for cross-site cookie support
	advanced: {
		// Control secure cookie behavior — enabled in production or when backend URL is HTTPS
		useSecureCookies,

		// Global cookie attributes for cross-site cookies
		defaultCookieAttributes: {
			// Browsers require 'Secure' when SameSite=None; fallback to 'lax' for non-secure dev
			sameSite: useSecureCookies ? "none" : "lax",
			secure: useSecureCookies,
			httpOnly: true, // XSS protection
			path: "/", // Cookie available to all routes
			...(cookieDomain && { domain: cookieDomain }),
		},

		// Customize individual cookie attributes
		// Use __Secure- prefix only in production (requires HTTPS)
		cookies: {
			sessionToken: {
				name:
					process.env.NODE_ENV === "production"
						? "__Secure-better-auth.session_token"
						: "better-auth.session_token",
				attributes: {
					sameSite: useSecureCookies ? "none" : "lax",
					secure: useSecureCookies,
					httpOnly: true, // XSS protection
					partitioned: process.env.NODE_ENV === "production", // CHIPS only in production
					...(cookieDomain && { domain: cookieDomain }),
				},
			},
			sessionData: {
				name:
					process.env.NODE_ENV === "production"
						? "__Secure-better-auth.session_data"
						: "better-auth.session_data",
				attributes: {
					sameSite: useSecureCookies ? "none" : "lax",
					secure: useSecureCookies,
					httpOnly: true, // XSS protection
					partitioned: process.env.NODE_ENV === "production", // CHIPS
					...(cookieDomain && { domain: cookieDomain }),
				},
			},
			dontRememberMe: {
				name:
					process.env.NODE_ENV === "production"
						? "__Secure-better-auth.dont_remember"
						: "better-auth.dont_remember",
				attributes: {
					sameSite: useSecureCookies ? "none" : "lax",
					secure: useSecureCookies,
					httpOnly: true, // XSS protection
					partitioned: process.env.NODE_ENV === "production", // CHIPS
					...(cookieDomain && { domain: cookieDomain }),
				},
			},
		},
	},
});

export type Auth = typeof auth;

async function sendPasswordResetEmail(email: string, resetUrl: string) {
	const apiKey = process.env.RESEND_API_KEY;
	const fromAddress = process.env.AUTH_EMAIL_FROM || "no-reply@aria.local";

	// Always log for audit trail, even if we cannot send the email
	logger.info("[Auth] Issuing password reset email", {
		email,
		resetUrl,
		provider: apiKey ? "resend" : "stdout",
	});

	if (!apiKey) {
		logger.warn(
			"[Auth] RESEND_API_KEY not configured. Password reset email will not be delivered.",
		);
		return;
	}

	try {
		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				from: fromAddress,
				to: [email],
				subject: "Reset your Aria ERP password",
				html: buildPasswordResetEmail(resetUrl),
			}),
		});

		if (!response.ok) {
			const text = await response.text();
			logger.error(
				"[Auth] Failed to send password reset email via Resend",
				text,
			);
		}
	} catch (error) {
		logger.error("[Auth] Error sending password reset email:", error);
	}
}

function buildPasswordResetEmail(resetUrl: string) {
	return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h1 style="font-size: 20px;">Reset your Aria ERP password</h1>
      <p>
        We received a request to reset the password for your Aria ERP account.
        Click the button below to choose a new password. This link expires in 30 minutes.
      </p>
      <p style="margin: 24px 0;">
        <a
          href="${resetUrl}"
          style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;"
        >
          Reset password
        </a>
      </p>
      <p>
        If you did not request this change, you can safely ignore this email.
        Your password will remain the same.
      </p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 32px;">
        If the button doesn’t work, copy and paste this URL into your browser:<br />
        <span style="word-break: break-all;">${resetUrl}</span>
      </p>
    </div>
  `;
}
