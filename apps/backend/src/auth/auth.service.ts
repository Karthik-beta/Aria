import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { prismaClient } from "../shared/prisma-client.js";
import { auth } from "./auth.config";

/**
 * Authentication service for managing users and default account creation
 *
 * Creates default admin user on startup using better-auth API.
 * Credentials are sourced from environment variables.
 */
@Injectable()
export class AuthService implements OnModuleInit {
	private readonly logger = new Logger(AuthService.name);
	private readonly prisma = prismaClient;

	private getSafeErrorMessage(error: unknown): string {
		if (error instanceof Error && error.message.trim().length > 0) {
			return error.message;
		}

		if (typeof error === "string" && error.trim().length > 0) {
			return error;
		}

		return "Unexpected error";
	}

	private getErrorDetails(error: unknown): string | undefined {
		if (error instanceof Error) {
			return error.stack;
		}

		if (typeof error === "string" && error.trim().length > 0) {
			return error;
		}

		if (error && typeof error === "object") {
			try {
				const serialized = JSON.stringify(error);
				if (serialized && serialized !== "{}") {
					return serialized;
				}
			} catch {
				return undefined;
			}
		}

		return undefined;
	}

	private logSafeError(message: string, error: unknown): void {
		this.logger.error(
			`${message} ${this.getSafeErrorMessage(error)}`,
			this.getErrorDetails(error),
		);
	}

	async onModuleInit() {
		await this.createDefaultUser();
		await this.createDefaultOrganizations();
	}

	/**
	 * Create default admin user from environment variables
	 *
	 * Uses better-auth's sign-up endpoint to ensure proper password hashing.
	 * Reads DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, and DEFAULT_ADMIN_EMAIL
	 * from environment. Skips if user already exists.
	 */
	async createDefaultUser() {
		const username = process.env.DEFAULT_ADMIN_USERNAME;
		const password = process.env.DEFAULT_ADMIN_PASSWORD;
		const email = process.env.DEFAULT_ADMIN_EMAIL;
		const name = process.env.DEFAULT_ADMIN_NAME || "Administrator";

		this.logger.log(
			`[createDefaultUser] Checking admin creation — username: "${username}", email: "${email}", name: "${name}"`,
		);

		if (!username || !password || !email) {
			this.logger.warn(
				"Default admin credentials not configured. Skipping user creation. " +
					"Set DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, and DEFAULT_ADMIN_EMAIL.",
			);
			return;
		}

		this.logger.log(
			"[createDefaultUser] All required env vars present, proceeding...",
		);

		try {
			this.logger.log("[createDefaultUser] Connecting to database...");
			await this.prisma.$connect();
			this.logger.log("[createDefaultUser] Database connected");

			this.logger.log("[createDefaultUser] Checking for existing user...");
			const existingUser = await this.prisma.user.findFirst({
				where: {
					OR: [{ username }, { email }],
				},
			});

			let userCreated = false;

			if (existingUser) {
				this.logger.log(`Default admin user already exists: ${username}`);
				userCreated = true;
			} else {
				this.logger.log(
					"[createDefaultUser] Creating new admin user via better-auth API...",
				);
				const authUrl = `${process.env.BETTER_AUTH_URL || "http://localhost:3001"}/api/auth/sign-up/email`;
				this.logger.log(`[createDefaultUser] Using auth URL: ${authUrl}`);

				const request = new Request(authUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						username,
						password,
						email,
						name,
					}),
				});

				this.logger.log("[createDefaultUser] Sending sign-up request...");
				const response = await auth.handler(request);
				this.logger.log(
					`[createDefaultUser] Response status: ${response.status}`,
				);

				if (response.ok) {
					this.logger.log(
						`Default admin user created successfully: ${username}`,
					);
					userCreated = true;

					const createdUser = await this.prisma.user.findUnique({
						where: { email },
					});
					if (createdUser) {
						await this.prisma.user.update({
							where: { id: createdUser.id },
							data: {
								role: "super_admin",
								mustChangePassword: false,
								passwordChangedAt: new Date(),
							},
						});
						this.logger.log(
							`[createDefaultUser] Set super_admin role for ${username}`,
						);
					}
				} else {
					const responseText = await response.text();
					this.logger.error(
						`Failed to create admin user via better-auth: ${response.status}`,
						responseText,
					);
				}
			}

			if (userCreated) {
				try {
					await this.prisma.user.update({
						where: { email },
						data: {
							mustChangePassword: false,
							passwordChangedAt: new Date(),
						},
					});
				} catch (updateError) {
					this.logSafeError(
						"Failed to update default admin password metadata (non-critical):",
						updateError,
					);
				}
			}
		} catch (error) {
			this.logSafeError(
				"Failed to create default admin user (non-critical):",
				error,
			);
		}
	}

	/**
	 * Ensure default app organizations exist and the super admin is an owner in each.
	 *
	 * Creates one organization per Aria app (HRMS, CRM, Asset, Inventory, Admin).
	 * Uses better-auth's server-side createOrganization API (no session headers)
	 * to create orgs on behalf of the super admin user.
	 */
	private async createDefaultOrganizations() {
		const superAdmin = await this.prisma.user.findFirst({
			where: { role: "super_admin" },
			select: { id: true, email: true },
		});

		if (!superAdmin) {
			this.logger.warn(
				"[createDefaultOrganizations] No super admin user found. Skipping organization creation.",
			);
			return;
		}

		const apps = [
			{ name: "Aria HRMS", slug: "hrms" },
			{ name: "Aria CRM", slug: "crm" },
			{ name: "Aria Asset", slug: "asset" },
			{ name: "Aria Inventory", slug: "inventory" },
			{ name: "Aria Admin", slug: "admin" },
		];

		for (const app of apps) {
			const existing = await this.prisma.organization.findUnique({
				where: { slug: app.slug },
			});

			if (existing) {
				this.logger.log(
					`[createDefaultOrganizations] Organization "${app.name}" already exists.`,
				);
				continue;
			}

			try {
				this.logger.log(
					`[createDefaultOrganizations] Creating organization "${app.name}"...`,
				);
				await auth.api.createOrganization({
					body: {
						name: app.name,
						slug: app.slug,
						userId: superAdmin.id,
					},
				});
				this.logger.log(
					`[createDefaultOrganizations] Created "${app.name}" (slug: ${app.slug})`,
				);
			} catch (error) {
				this.logSafeError(
					`[createDefaultOrganizations] Error creating "${app.name}":`,
					error,
				);
			}
		}
	}
}
