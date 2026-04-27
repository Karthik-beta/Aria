import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../shared/prisma.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PermissionService } from "./role-permission.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { ScopeService } from "./scope.service";

/**
 * User policy resolution result - aligned with frontend AuthorizationData shape
 */
export interface UserPolicy {
	userId: string;
	roles: string[];
	permissions: string[];
	apps: Record<string, { roles: string[] }>;
	supervisedApps: string[];
	isActive: boolean;
}

/**
 * Authorization check context
 */
export interface AuthContext {
	userId: string;
	appKey?: string;
	teamId?: string;
	resourceOwnerId?: string; // For ownership checks
	resourceTeamId?: string; // For team-scoped resources
}

/**
 * Authorization check result
 */
export interface AuthResult {
	allowed: boolean;
	reason?: string;
}

/**
 * PolicyService - Core RBAC + ABAC evaluation engine
 *
 * Responsibilities:
 * - Resolve user policies (roles + permissions + scopes)
 * - Evaluate permission checks with context
 * - Apply ownership and team-based filtering
 * - Cache policies with TTL
 *
 * Policy evaluation order:
 * 1. Account active check
 * 2. System-wide denies (future use)
 * 3. Role → Permission resolution (RBAC)
 * 4. Scope guards (app, team, ownership)
 * 5. Field-level filters (future use)
 *
 * @see AUTHORIZATION_SPEC.md - Policy Evaluation section
 */
@Injectable()
export class PolicyService {
	private readonly requestStore = new AsyncLocalStorage<
		Map<string, { policy: UserPolicy; expires: number }>
	>();
	private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds

	constructor(
		private readonly prisma: PrismaService,
		private readonly permissionService: PermissionService,
		private readonly scopeService: ScopeService,
	) {}

	/**
	 * Resolve complete user policy (roles, permissions, scopes)
	 * Results are cached with TTL
	 *
	 * @param userId - User ID
	 * @param appKey - Optional app context for filtering
	 * @returns User policy object
	 */
	async resolveUserPolicy(
		userId: string,
		appKey?: string,
	): Promise<UserPolicy> {
		const cacheKey = `${userId}:${appKey || "global"}`;

		const cached = this.requestStore.getStore();
		if (cached) {
			const entry = cached.get(cacheKey);
			if (entry && entry.expires > Date.now()) {
				return entry.policy;
			}
		}

		const policy = await this.fetchUserPolicy(userId, appKey);

		const store = this.requestStore.getStore();
		if (store) {
			store.set(cacheKey, {
				policy,
				expires: Date.now() + this.CACHE_TTL_MS,
			});
		}

		return policy;
	}

	/**
	 * Fetch user policy from database
	 */
	private async fetchUserPolicy(
		userId: string,
		_appKey?: string,
	): Promise<UserPolicy> {
		// Get user and check active status
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { isActive: true },
		});

		if (!user) {
			throw new Error(`User not found: ${userId}`);
		}

		// Get user roles (global + app-scoped)
		const userRoles = await this.prisma.userRole.findMany({
			where: { userId },
			include: {
				role: {
					include: {
						rolePermissions: {
							include: {
								permission: true,
							},
						},
					},
				},
			},
		});

		// Extract role keys
		const roles = userRoles.map((ur) => ur.role.key);

		// Collect all permissions from all roles
		const permissionSet = new Set<string>();
		for (const ur of userRoles) {
			for (const rp of ur.role.rolePermissions) {
				permissionSet.add(rp.permission.key);
			}
		}

		// Build apps object with roles per app
		const appsMap = new Map<string, { roles: string[] }>();
		for (const ur of userRoles) {
			if (ur.appKey) {
				const existing = appsMap.get(ur.appKey) ?? { roles: [] };
				if (!existing.roles.includes(ur.role.key)) {
					existing.roles.push(ur.role.key);
				}
				appsMap.set(ur.appKey, existing);
			}
		}
		const apps = Object.fromEntries(appsMap);

		// Get supervised apps
		const supervisedApps = await this.scopeService.getSupervisedApps(userId);

		return {
			userId,
			roles,
			permissions: Array.from(permissionSet),
			apps,
			supervisedApps,
			isActive: user.isActive,
		};
	}

	/**
	 * Check if user has a specific permission
	 *
	 * @param userId - User ID
	 * @param permissionKey - Permission key to check
	 * @param context - Authorization context (app, team, ownership, etc.)
	 * @returns Authorization result with reason
	 */
	async can(
		userId: string,
		permissionKey: string,
		context?: AuthContext,
	): Promise<AuthResult> {
		const policy = await this.resolveUserPolicy(userId, context?.appKey);

		// 1. Check if account is active
		if (!policy.isActive) {
			return {
				allowed: false,
				reason: "Account is not active",
			};
		}

		// 2. Check if user has the permission (including wildcard matches)
		const hasPermission = policy.permissions.some((perm) =>
			this.permissionService.matchesPattern(permissionKey, perm),
		);

		if (!hasPermission) {
			return {
				allowed: false,
				reason: `Missing permission: ${permissionKey}`,
			};
		}

		// 3. Apply scope guards if context provided
		if (context) {
			const scopeCheck = await this.checkScopes(userId, policy, context);
			if (!scopeCheck.allowed) {
				return scopeCheck;
			}
		}

		return { allowed: true };
	}

	/**
	 * Apply scope-based access control checks
	 */
	private async checkScopes(
		userId: string,
		policy: UserPolicy,
		context: AuthContext,
	): Promise<AuthResult> {
		// App scope check
		if (context.appKey) {
			const hasAppAccess =
				context.appKey in policy.apps ||
				policy.supervisedApps.includes(context.appKey) ||
				policy.roles.includes("super_admin"); // Super admins bypass app scope

			if (!hasAppAccess) {
				return {
					allowed: false,
					reason: `No access to app: ${context.appKey}`,
				};
			}
		}

		// Team scope check
		if (context.teamId) {
			const isTeamMember = await this.scopeService.isTeamMember(
				userId,
				context.teamId,
			);
			const isTeamManager = await this.scopeService.isTeamManager(
				userId,
				context.teamId,
			);
			const isSuperAdmin = policy.roles.includes("super_admin");

			if (!isTeamMember && !isTeamManager && !isSuperAdmin) {
				return {
					allowed: false,
					reason: `Not a member of team: ${context.teamId}`,
				};
			}
		}

		// Ownership check
		if (context.resourceOwnerId) {
			const isOwner = userId === context.resourceOwnerId;
			const isManager = await this.scopeService.isInManagementHierarchy(
				userId,
				context.resourceOwnerId,
			);
			const isSuperAdmin = policy.roles.includes("super_admin");

			if (!isOwner && !isManager && !isSuperAdmin) {
				return {
					allowed: false,
					reason: "Not the owner or manager of this resource",
				};
			}
		}

		// Resource team scope check (for resources assigned to teams)
		if (context.resourceTeamId) {
			const isTeamMember = await this.scopeService.isTeamMember(
				userId,
				context.resourceTeamId,
			);
			const isTeamManager = await this.scopeService.isTeamManager(
				userId,
				context.resourceTeamId,
			);
			const isSuperAdmin = policy.roles.includes("super_admin");

			if (!isTeamMember && !isTeamManager && !isSuperAdmin) {
				return {
					allowed: false,
					reason: `Not a member of resource team: ${context.resourceTeamId}`,
				};
			}
		}

		return { allowed: true };
	}

	/**
	 * Check if user has a specific role
	 *
	 * @param userId - User ID
	 * @param roleKey - Role key to check
	 * @param _appKey - Optional app context (unused, kept for API compatibility)
	 * @returns true if user has the role
	 */
	async hasRole(
		userId: string,
		roleKey: string,
		_appKey?: string,
	): Promise<boolean> {
		const policy = await this.resolveUserPolicy(userId);
		return policy.roles.includes(roleKey);
	}

	/**
	 * Check if user has any of the specified roles
	 */
	async hasAnyRole(
		userId: string,
		roleKeys: string[],
		appKey?: string,
	): Promise<boolean> {
		for (const roleKey of roleKeys) {
			if (await this.hasRole(userId, roleKey, appKey)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Get highest role level for user (for hierarchical checks)
	 * Note: Role levels are no longer exposed in the simplified roles array.
	 * Returns 1 as a sensible default for any authenticated user.
	 */
	async getUserMaxRoleLevel(_userId: string): Promise<number> {
		return 1;
	}

	/**
	 * Invalidate cache for a user
	 * Note: With request-scoped caching via AsyncLocalStorage, manual invalidation
	 * is not needed - cache is automatically scoped to each request.
	 */
	invalidateUserCache(_userId: string, _appKey?: string): void {
		// No-op: request-scoped cache auto-clears on request end
	}

	/**
	 * Clear all expired cache entries
	 * Note: With request-scoped caching, entries are isolated per request.
	 */
	private clearExpiredCache(): void {
		// No-op: request-scoped cache auto-clears on request end
	}

	/**
	 * Clear all cache entries
	 * Note: With request-scoped caching, entries are isolated per request.
	 */
	clearCache(): void {
		// No-op: request-scoped cache auto-clears on request end
	}
}
