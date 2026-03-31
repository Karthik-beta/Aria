import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { auth } from "../../auth/auth.config";
import { generateTemporaryPassword } from "../../auth/password.util";
import type { AuditService } from "../../authorization/audit.service";
import type { PolicyService } from "../../authorization/policy.service";
import type {
	PermissionService,
	RoleService,
} from "../../authorization/role-permission.service";
import type { ScopeService } from "../../authorization/scope.service";
import type { Prisma } from "../../generated/prisma/client";
import { protectedProcedure, router } from "../trpc";

type AdminRouterDependencies = {
	auditService: AuditService;
	policyService: PolicyService;
	permissionService: PermissionService;
	roleService: RoleService;
	scopeService: ScopeService;
};

/**
 * Extract the authenticated actor's user ID from the tRPC context.
 */
function getActorUserId(ctx: { user?: { id?: unknown } }) {
	if (!ctx.user || typeof ctx.user.id !== "string") {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authenticated session is missing a valid user id",
		});
	}

	return ctx.user.id;
}

const GLOBAL_APP_KEY = "global";

function getDefaultResetRedirectUrl() {
	const fallback = "http://localhost:3000";
	const envUrls = process.env.FRONTEND_URL;
	const firstUrl = envUrls
		?.split(",")
		.map((url) => url.trim())
		.filter(Boolean)[0];

	const base = (firstUrl || fallback).replace(/\/$/, "");
	return `${base}/auth/reset-password`;
}

/**
 * Build the admin tRPC router using Nest-managed authorization services.
 *
 * All endpoints require authentication and specific permissions
 */
export function createAdminRouter(deps: AdminRouterDependencies) {
	const requirePermission = async (userId: string, permission: string) => {
		const result = await deps.policyService.can(userId, permission);
		if (!result.allowed) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: result.reason || "Insufficient permissions",
			});
		}
	};

	return router({
		// ==================== USER MANAGEMENT ====================

		/**
		 * List all users with pagination
		 */
		listUsers: protectedProcedure
			.input(
				z.object({
					page: z.number().min(1).default(1),
					limit: z.number().min(1).max(100).default(20),
					search: z.string().optional(),
					appKey: z.string().optional(),
					isActive: z.boolean().optional(),
				}),
			)
			.query(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:user.read");

				const skip = (input.page - 1) * input.limit;
				const where: Prisma.UserWhereInput = {};

				if (input.search) {
					where.OR = [
						{ email: { contains: input.search, mode: "insensitive" } },
						{ name: { contains: input.search, mode: "insensitive" } },
						{ displayName: { contains: input.search, mode: "insensitive" } },
					];
				}

				if (input.isActive !== undefined) {
					where.isActive = input.isActive;
				}

				const [users, total] = await Promise.all([
					ctx.prisma.user.findMany({
						where,
						skip,
						take: input.limit,
						select: {
							id: true,
							email: true,
							name: true,
							displayName: true,
							username: true,
							isActive: true,
							department: true,
							mustChangePassword: true,
							passwordChangedAt: true,
							createdAt: true,
							userRoles: {
								include: {
									role: true,
								},
							},
							supervisedApps: {
								include: {
									app: true,
								},
							},
						},
						orderBy: { createdAt: "desc" },
					}),
					ctx.prisma.user.count({ where }),
				]);

				return {
					users,
					pagination: {
						page: input.page,
						limit: input.limit,
						total,
						totalPages: Math.ceil(total / input.limit),
					},
				};
			}),

		getProvisioningContext: protectedProcedure.query(async ({ ctx }) => {
			const actorUserId = getActorUserId(ctx);

			const prismaClient = ctx.prisma;
			if (!prismaClient) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Database client not available",
				});
			}

			const apps: Array<{
				appKey: string;
				name: string;
				description: string | null;
			}> = await prismaClient.app.findMany({
				where: { isActive: true },
				select: { appKey: true, name: true, description: true },
				orderBy: { name: "asc" },
			});
			const systemPermission = await deps.policyService.can(
				actorUserId,
				"system:user.manage",
			);

			const scopedChecks: Array<{ appKey: string; allowed: boolean }> =
				await Promise.all(
					apps.map(async (app) => {
						const result = await deps.policyService.can(
							actorUserId,
							`app:${app.appKey}:user.create`,
						);
						return { appKey: app.appKey, allowed: result.allowed };
					}),
				);

			const manageableAppKeys = scopedChecks
				.filter((check) => check.allowed)
				.map((check) => check.appKey);

			return {
				canManageSystem: systemPermission.allowed,
				manageableAppKeys,
				apps,
				defaultAppKey: systemPermission.allowed
					? GLOBAL_APP_KEY
					: (manageableAppKeys[0] ?? null),
			};
		}),

		/**
		 * Get single user by ID with full details
		 */
		getUser: protectedProcedure
			.input(z.object({ userId: z.string() }))
			.query(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:user.read");

				const user = await ctx.prisma.user.findUnique({
					where: { id: input.userId },
					include: {
						userRoles: {
							include: {
								role: {
									include: {
										rolePermissions: {
											include: { permission: true },
										},
									},
								},
							},
						},
						supervisedApps: {
							include: { app: true },
						},
						managedTeams: {
							select: {
								id: true,
								name: true,
							},
						},
						teamMemberships: {
							include: {
								team: true,
							},
						},
						manager: {
							select: {
								id: true,
								email: true,
								name: true,
								displayName: true,
							},
						},
						subordinates: {
							select: {
								id: true,
								email: true,
								name: true,
								displayName: true,
							},
						},
					},
				});

				if (!user) {
					throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
				}

				return user;
			}),

		/**
		 * Create new user
		 */
		createUser: protectedProcedure
			.input(
				z.object({
					email: z.string().email(),
					username: z
						.string()
						.min(3)
						.max(32)
						.regex(
							/^[a-zA-Z0-9._-]+$/,
							"Username can include letters, numbers, ., _, and -",
						),
					name: z.string().min(1),
					displayName: z.string().optional(),
					department: z.string().optional(),
					managerId: z.string().optional(),
					roleKeys: z.array(z.string()).optional(),
					appKey: z.string().optional(),
					passwordStrategy: z.enum(["auto", "manual"]).default("auto"),
					password: z.string().min(8).max(128).optional(),
					providedPassword: z.string().min(8).max(128).optional(),
					mustChangePassword: z.boolean().optional(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);

				// Check if user can create users (either globally or for specific app)
				if (input.appKey) {
					await requirePermission(
						actorUserId,
						`app:${input.appKey}:user.create`,
					);
				} else {
					await requirePermission(actorUserId, "system:user.manage");
				}

				const prismaTx = ctx.prisma;

				// Ensure email/username uniqueness prior to provisioning
				const existingUser = await prismaTx.user.findFirst({
					where: {
						OR: [{ email: input.email }, { username: input.username }],
					},
				});

				if (existingUser) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "A user with the same email or username already exists.",
					});
				}

				const passwordStrategy = input.passwordStrategy ?? "auto";
				if (passwordStrategy === "manual" && !input.password) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Password is required when using manual password strategy.",
					});
				}

				if (passwordStrategy === "auto" && input.password) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Do not provide the password field when using auto password strategy. Use providedPassword instead.",
					});
				}

				if (passwordStrategy === "manual" && input.providedPassword) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"providedPassword is only accepted when password strategy is set to auto.",
					});
				}

				const providedPassword = input.providedPassword?.trim();

				const tempPassword =
					passwordStrategy === "auto"
						? providedPassword && providedPassword.length > 0
							? providedPassword
							: generateTemporaryPassword(14)
						: (input.password as string);

				const signUpRequest = new Request(
					`${process.env.BETTER_AUTH_URL || "http://localhost:3001"}/api/auth/sign-up/email`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							email: input.email,
							password: tempPassword,
							name: input.name,
							username: input.username,
						}),
					},
				);

				const signUpResponse = await auth.handler(signUpRequest);

				if (!signUpResponse.ok) {
					let errorMessage = "Failed to create user account.";
					try {
						const errorData = await signUpResponse.json();
						if (errorData?.error?.message) {
							errorMessage = errorData.error.message;
						}
					} catch {
						const fallbackText = await signUpResponse.text();
						if (fallbackText) {
							errorMessage = fallbackText;
						}
					}

					throw new TRPCError({ code: "BAD_REQUEST", message: errorMessage });
				}

				const createdUserPayload = await signUpResponse.json();
				const createdUserId = createdUserPayload?.user?.id;

				if (!createdUserId) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message:
							"User provisioning succeeded but user id was not returned.",
					});
				}

				const mustChangePassword =
					input.mustChangePassword ?? passwordStrategy === "auto";

				await prismaTx.user.update({
					where: { id: createdUserId },
					data: {
						displayName: input.displayName || input.name,
						department: input.department,
						managerId: input.managerId,
						username: input.username,
						mustChangePassword,
						passwordChangedAt: mustChangePassword ? null : new Date(),
						isActive: true,
					},
				});

				// Assign roles if provided
				if (input.roleKeys && input.roleKeys.length > 0) {
					for (const roleKey of input.roleKeys) {
						const role = await deps.roleService.getRoleByKey(roleKey);
						if (!role) continue;

						await ctx.prisma.userRole.create({
							data: {
								userId: createdUserId,
								roleId: role.id,
								appKey: input.appKey,
							},
						});
					}
				}

				const user = await prismaTx.user.findUnique({
					where: { id: createdUserId },
					include: {
						userRoles: {
							include: {
								role: true,
							},
						},
					},
				});

				if (!user) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to load user after creation.",
					});
				}

				// Audit log
				await deps.auditService.logUserCreated(actorUserId, user.id, {
					email: user.email,
					username: user.username,
					roles: input.roleKeys,
					appKey: input.appKey,
					passwordStrategy,
					mustChangePassword,
				});

				return {
					user,
					generatedPassword:
						passwordStrategy === "auto" ? tempPassword : undefined,
					mustChangePassword,
				};
			}),

		/**
		 * Check username availability before creating a user
		 */
		checkUsernameAvailability: protectedProcedure
			.input(
				z.object({
					username: z
						.string()
						.min(3)
						.max(32)
						.regex(
							/^[a-zA-Z0-9._-]+$/,
							"Username can include letters, numbers, ., _, and -",
						),
					appKey: z.string().optional(),
				}),
			)
			.query(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				if (input.appKey) {
					await requirePermission(
						actorUserId,
						`app:${input.appKey}:user.create`,
					);
				} else {
					await requirePermission(actorUserId, "system:user.manage");
				}

				const existingUser = await ctx.prisma.user.findFirst({
					where: {
						username: {
							equals: input.username,
							mode: "insensitive",
						},
					},
					select: { id: true },
				});

				return { available: !existingUser };
			}),

		/**
		 * Generate a temporary password that matches complexity rules
		 */
		generateSecurePassword: protectedProcedure
			.input(
				z
					.object({
						length: z.number().min(8).max(64).default(14),
					})
					.optional(),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:user.manage");

				const password = generateTemporaryPassword(input?.length ?? 14);
				return { password };
			}),

		/**
		 * Trigger password reset email for a user
		 */
		sendPasswordReset: protectedProcedure
			.input(
				z.object({
					userId: z.string(),
					appKey: z.string().optional(),
					redirectTo: z.string().url().optional(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				const scopedAppKey =
					input.appKey && input.appKey !== "global" ? input.appKey : undefined;

				if (scopedAppKey) {
					await requirePermission(
						actorUserId,
						`app:${scopedAppKey}:user.create`,
					);
				} else {
					await requirePermission(actorUserId, "system:user.manage");
				}

				const targetUser: {
					id: string;
					email: string;
					userRoles: Array<{
						appKey: string | null;
					}>;
				} | null = await ctx.prisma.user.findUnique({
					where: { id: input.userId },
					select: {
						id: true,
						email: true,
						userRoles: {
							select: {
								appKey: true,
							},
						},
					},
				});

				if (!targetUser) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "User not found",
					});
				}

				if (scopedAppKey) {
					const hasAppAssignment = targetUser.userRoles.some(
						(ur) => ur.appKey === scopedAppKey,
					);

					if (!hasAppAssignment) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"Target user is not assigned to the specified application.",
						});
					}
				}

				const resetRedirect = input.redirectTo || getDefaultResetRedirectUrl();
				const authBaseUrl =
					process.env.BETTER_AUTH_URL || "http://localhost:3001";

				const resetRequest = new Request(
					`${authBaseUrl.replace(/\/$/, "")}/api/auth/request-password-reset`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							email: targetUser.email,
							redirectTo: resetRedirect,
						}),
					},
				);

				const resetResponse = await auth.handler(resetRequest);

				if (!resetResponse.ok) {
					let errorMessage = "Failed to initiate password reset.";
					try {
						const payload = await resetResponse.json();
						if (payload?.error?.message) {
							errorMessage = payload.error.message;
						}
					} catch {
						const fallbackText = await resetResponse.text();
						if (fallbackText) {
							errorMessage = fallbackText;
						}
					}

					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: errorMessage,
					});
				}

				await ctx.prisma.user.update({
					where: { id: targetUser.id },
					data: {
						mustChangePassword: true,
						passwordChangedAt: null,
					},
				});

				await deps.auditService.log({
					actorUserId,
					action: "user.password_reset_requested",
					subjectType: "user",
					subjectId: targetUser.id,
					appKey: scopedAppKey,
					metadata: {
						redirectTo: resetRedirect,
					},
				});

				return { success: true };
			}),

		/**
		 * Update user details
		 */
		updateUser: protectedProcedure
			.input(
				z.object({
					userId: z.string(),
					name: z.string().optional(),
					displayName: z.string().optional(),
					department: z.string().optional(),
					managerId: z.string().optional(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:user.manage");

				const { userId, ...updateData } = input;

				const user = await ctx.prisma.user.update({
					where: { id: userId },
					data: updateData,
				});

				await deps.auditService.logUserUpdated(actorUserId, userId, updateData);

				return user;
			}),

		/**
		 * Disable user account
		 */
		disableUser: protectedProcedure
			.input(z.object({ userId: z.string() }))
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:user.manage");

				// Prevent self-disable
				if (input.userId === actorUserId) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Cannot disable your own account",
					});
				}

				const user = await ctx.prisma.user.update({
					where: { id: input.userId },
					data: { isActive: false },
				});

				await deps.auditService.logUserStatusChanged(
					actorUserId,
					input.userId,
					false,
				);

				// Invalidate user's policy cache
				deps.policyService.invalidateUserCache(input.userId);

				return user;
			}),

		/**
		 * Enable user account
		 */
		enableUser: protectedProcedure
			.input(z.object({ userId: z.string() }))
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:user.manage");

				const user = await ctx.prisma.user.update({
					where: { id: input.userId },
					data: { isActive: true },
				});

				await deps.auditService.logUserStatusChanged(
					actorUserId,
					input.userId,
					true,
				);

				deps.policyService.invalidateUserCache(input.userId);

				return user;
			}),

		/**
		 * Delete user (soft delete by disabling)
		 */
		deleteUser: protectedProcedure
			.input(z.object({ userId: z.string() }))
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:user.manage");

				// Prevent self-deletion
				if (input.userId === actorUserId) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Cannot delete your own account",
					});
				}

				// Soft delete by disabling
				await ctx.prisma.user.update({
					where: { id: input.userId },
					data: { isActive: false },
				});

				await deps.auditService.logUserDeleted(actorUserId, input.userId);

				deps.policyService.invalidateUserCache(input.userId);

				return { success: true };
			}),

		// ==================== ROLE ASSIGNMENT ====================

		/**
		 * Assign role to user
		 */
		assignRole: protectedProcedure
			.input(
				z.object({
					userId: z.string(),
					roleKey: z.string(),
					appKey: z.string().optional(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				// Check permission - use system:role.manage which exists in seed data
				// Users with system:* (super_admin) will match this via wildcard
				await requirePermission(actorUserId, "system:role.manage");

				const role = await deps.roleService.getRoleByKey(input.roleKey);
				if (!role) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
				}

				// Check if already assigned
				const existing = await ctx.prisma.userRole.findFirst({
					where: {
						userId: input.userId,
						roleId: role.id,
						appKey: input.appKey || null,
					},
				});

				if (existing) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Role already assigned",
					});
				}

				const userRole = await ctx.prisma.userRole.create({
					data: {
						userId: input.userId,
						roleId: role.id,
						appKey: input.appKey,
					},
				});

				await deps.auditService.logRoleAssigned(
					actorUserId,
					input.userId,
					input.roleKey,
					input.appKey,
				);

				deps.policyService.invalidateUserCache(input.userId);

				return userRole;
			}),

		/**
		 * Revoke role from user
		 */
		revokeRole: protectedProcedure
			.input(
				z.object({
					userId: z.string(),
					roleKey: z.string(),
					appKey: z.string().optional(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				// Check permission - use system:role.manage which exists in seed data
				// Users with system:* (super_admin) will match this via wildcard
				await requirePermission(actorUserId, "system:role.manage");

				// Prevent revoking own admin/super_admin role
				if (
					input.userId === actorUserId &&
					(input.roleKey === "super_admin" || input.roleKey === "admin")
				) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Cannot revoke your own admin role",
					});
				}

				const role = await deps.roleService.getRoleByKey(input.roleKey);
				if (!role) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
				}

				await ctx.prisma.userRole.deleteMany({
					where: {
						userId: input.userId,
						roleId: role.id,
						appKey: input.appKey || null,
					},
				});

				await deps.auditService.logRoleRevoked(
					actorUserId,
					input.userId,
					input.roleKey,
					input.appKey,
				);

				deps.policyService.invalidateUserCache(input.userId);

				return { success: true };
			}),

		// ==================== SUPERVISOR MANAGEMENT ====================

		/**
		 * Assign supervisor to app
		 */
		assignSupervisor: protectedProcedure
			.input(
				z.object({
					userId: z.string(),
					appKey: z.string(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(
					actorUserId,
					`app:${input.appKey}:supervisor.assign`,
				);

				const app = await ctx.prisma.app.findUnique({
					where: { appKey: input.appKey },
				});

				if (!app) {
					throw new TRPCError({ code: "NOT_FOUND", message: "App not found" });
				}

				// Check if already a supervisor
				const existing = await ctx.prisma.appSupervisor.findFirst({
					where: {
						supervisorUserId: input.userId,
						appKey: input.appKey,
					},
				});

				if (existing) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "User is already a supervisor",
					});
				}

				const supervisor = await ctx.prisma.appSupervisor.create({
					data: {
						supervisorUserId: input.userId,
						appKey: input.appKey,
					},
				});

				await deps.auditService.logSupervisorAssigned(
					actorUserId,
					input.userId,
					input.appKey,
				);

				deps.policyService.invalidateUserCache(input.userId);

				return supervisor;
			}),

		/**
		 * Revoke supervisor from app
		 */
		revokeSupervisor: protectedProcedure
			.input(
				z.object({
					userId: z.string(),
					appKey: z.string(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(
					actorUserId,
					`app:${input.appKey}:supervisor.assign`,
				);

				const app = await ctx.prisma.app.findUnique({
					where: { appKey: input.appKey },
				});

				if (!app) {
					throw new TRPCError({ code: "NOT_FOUND", message: "App not found" });
				}

				await ctx.prisma.appSupervisor.deleteMany({
					where: {
						supervisorUserId: input.userId,
						appKey: input.appKey,
					},
				});

				await deps.auditService.logSupervisorRevoked(
					actorUserId,
					input.userId,
					input.appKey,
				);

				deps.policyService.invalidateUserCache(input.userId);

				return { success: true };
			}),

		// ==================== ROLE MANAGEMENT ====================

		/**
		 * List all roles with permissions
		 */
		listRoles: protectedProcedure.query(async ({ ctx }) => {
			const actorUserId = getActorUserId(ctx);
			await requirePermission(actorUserId, "system:role.read");
			return ctx.prisma.role.findMany({
				include: {
					rolePermissions: {
						include: {
							permission: true,
						},
					},
				},
				orderBy: [{ level: "desc" }, { name: "asc" }],
			});
		}),

		/**
		 * Get role with permissions
		 */
		getRole: protectedProcedure
			.input(z.object({ roleKey: z.string() }))
			.query(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:role.read");
				const role = await deps.roleService.getRoleWithPermissions(
					input.roleKey,
				);
				if (!role) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
				}
				return role;
			}),

		/**
		 * Create new role
		 */
		createRole: protectedProcedure
			.input(
				z.object({
					key: z.string(),
					name: z.string(),
					description: z.string().optional(),
					level: z.number().min(0).max(100),
					isSystem: z.boolean().default(false),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:role.manage");
				const role = await deps.roleService.createRole(input);

				await deps.auditService.log({
					actorUserId,
					action: "role.created",
					subjectType: "role",
					subjectId: role.key,
					metadata: { key: role.key, name: role.name, level: role.level },
				});

				return role;
			}),

		/**
		 * Update role
		 */
		updateRole: protectedProcedure
			.input(
				z.object({
					roleKey: z.string(),
					name: z.string().optional(),
					description: z.string().optional(),
					level: z.number().min(0).max(100).optional(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:role.manage");
				const { roleKey, ...updates } = input;
				const role = await deps.roleService.updateRole(roleKey, updates);

				await deps.auditService.log({
					actorUserId,
					action: "role.updated",
					subjectType: "role",
					subjectId: roleKey,
					metadata: { changes: updates },
				});

				return role;
			}),

		/**
		 * Delete role
		 */
		deleteRole: protectedProcedure
			.input(z.object({ roleKey: z.string() }))
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:role.manage");
				await deps.roleService.deleteRole(input.roleKey);

				await deps.auditService.log({
					actorUserId,
					action: "role.deleted",
					subjectType: "role",
					subjectId: input.roleKey,
				});

				return { success: true };
			}),

		/**
		 * Assign permission to role
		 */
		assignPermissionToRole: protectedProcedure
			.input(
				z.object({
					roleKey: z.string(),
					permissionKey: z.string(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:role.manage");
				await deps.roleService.addPermission(
					input.roleKey,
					input.permissionKey,
				);

				await deps.auditService.log({
					actorUserId,
					action: "permission.assigned_to_role",
					subjectType: "role_permission",
					subjectId: input.roleKey,
					metadata: {
						roleKey: input.roleKey,
						permissionKey: input.permissionKey,
					},
				});

				return { success: true };
			}),

		/**
		 * Remove permission from role
		 */
		removePermissionFromRole: protectedProcedure
			.input(
				z.object({
					roleKey: z.string(),
					permissionKey: z.string(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:role.manage");
				await deps.roleService.removePermission(
					input.roleKey,
					input.permissionKey,
				);

				await deps.auditService.log({
					actorUserId,
					action: "permission.removed_from_role",
					subjectType: "role_permission",
					subjectId: input.roleKey,
					metadata: {
						roleKey: input.roleKey,
						permissionKey: input.permissionKey,
					},
				});

				return { success: true };
			}),

		// ==================== PERMISSION MANAGEMENT ====================

		/**
		 * List all permissions with scope information
		 */
		listPermissions: protectedProcedure
			.input(
				z
					.object({
						scope: z.enum(["system", "app", "entity"]).optional(),
					})
					.optional(),
			)
			.query(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:permission.read");
				const permissions = await deps.permissionService.listPermissions(
					input ? { scope: input.scope } : undefined,
				);

				// Add scope information to each permission
				return permissions.map((permission) => {
					const parsed = deps.permissionService.parsePermissionKey(
						permission.key,
					);
					return {
						...permission,
						scope: parsed.scope,
					};
				});
			}),

		/**
		 * Get permission details
		 */
		getPermission: protectedProcedure
			.input(z.object({ permissionKey: z.string() }))
			.query(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:permission.read");
				const permission = await deps.permissionService.getPermissionByKey(
					input.permissionKey,
				);
				if (!permission) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Permission not found",
					});
				}
				return permission;
			}),

		/**
		 * Create new permission
		 */
		createPermission: protectedProcedure
			.input(
				z.object({
					key: z.string(),
					name: z.string(),
					description: z.string().optional(),
					scope: z.enum(["system", "app", "entity"]),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:permission.manage");
				return deps.permissionService.createPermission(input);
			}),

		/**
		 * Update permission
		 */
		updatePermission: protectedProcedure
			.input(
				z.object({
					permissionKey: z.string(),
					name: z.string().optional(),
					description: z.string().optional(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:permission.manage");
				const { permissionKey, ...updates } = input;
				return deps.permissionService.updatePermission(permissionKey, updates);
			}),

		/**
		 * Delete permission
		 */
		deletePermission: protectedProcedure
			.input(z.object({ permissionKey: z.string() }))
			.mutation(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:permission.manage");
				await deps.permissionService.deletePermission(input.permissionKey);
				return { success: true };
			}),

		// ==================== AUDIT LOGS ====================

		/**
		 * Query audit logs
		 */
		getAuditLogs: protectedProcedure
			.input(
				z.object({
					startDate: z.date().optional(),
					endDate: z.date().optional(),
					actorId: z.string().optional(),
					userId: z.string().optional(),
					action: z.string().optional(),
					limit: z.number().min(1).max(500).default(50),
				}),
			)
			.query(async ({ ctx, input }) => {
				const actorUserId = getActorUserId(ctx);
				await requirePermission(actorUserId, "system:audit.read");
				return deps.auditService.queryLogs({
					fromDate: input.startDate,
					toDate: input.endDate,
					actorUserId: input.actorId,
					action: input.action,
					limit: input.limit,
				});
			}),
	});
}
