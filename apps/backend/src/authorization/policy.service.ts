import { Injectable, type OnModuleDestroy } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../shared/prisma.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PermissionService } from "./role-permission.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { ScopeService } from "./scope.service";

/**
 * User policy resolution result
 */
export interface UserPolicy {
	userId: string;
	roles: Array<{
		roleKey: string;
		appKey: string | null;
		level: number;
	}>;
	permissions: Array<{
		key: string;
		appKey?: string;
	}>;
	apps: string[]; // Apps the user has any role in
	supervisedApps: string[]; // Apps the user supervises
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
export class PolicyService implements OnModuleDestroy {
	// Simple in-memory cache with TTL
	private cache = new Map<string, { policy: UserPolicy; expires: number }>();
	private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds
	private readonly cacheCleanupInterval: NodeJS.Timeout;

	constructor(
		private readonly prisma: PrismaService,
		private readonly permissionService: PermissionService,
		private readonly scopeService: ScopeService,
	) {
		// Clear expired cache entries every minute
		this.cacheCleanupInterval = setInterval(
			() => this.clearExpiredCache(),
			60 * 1000,
		);
		this.cacheCleanupInterval.unref?.();
	}

	onModuleDestroy(): void {
		clearInterval(this.cacheCleanupInterval);
	}

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
		// Check cache first
		const cacheKey = `${userId}:${appKey || "global"}`;
		const cached = this.cache.get(cacheKey);
		if (cached && cached.expires > Date.now()) {
			return cached.policy;
		}

		// Fetch fresh policy
		const policy = await this.fetchUserPolicy(userId, appKey);

		// Cache the result
		this.cache.set(cacheKey, {
			policy,
			expires: Date.now() + this.CACHE_TTL_MS,
		});

		return policy;
	}

	/**
	 * Fetch user policy from database
	 */
	private async fetchUserPolicy(
		userId: string,
		appKey?: string,
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
			where: {
				userId,
				...(appKey && {
					OR: [{ appKey: null }, { appKey }],
				}),
			},
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

		// Extract roles with levels
		const roles = userRoles.map((ur) => ({
			roleKey: ur.role.key,
			appKey: ur.appKey,
			level: ur.role.level,
		}));

		// Collect all permissions from all roles
		const permissionSet = new Set<string>();
		for (const ur of userRoles) {
			for (const rp of ur.role.rolePermissions) {
				permissionSet.add(rp.permission.key);
			}
		}

		// Get apps user has roles in
		const apps = Array.from(
			new Set(
				userRoles
					.map((ur) => ur.appKey)
					.filter((appKey): appKey is string => typeof appKey === "string"),
			),
		);

		// Get supervised apps
		const supervisedApps = await this.scopeService.getSupervisedApps(userId);

		return {
			userId,
			roles,
			permissions: Array.from(permissionSet).map((key) => ({ key })),
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
		// Development bypass
		if (
			process.env.NODE_ENV === "development" &&
			process.env.DISABLE_AUTH === "true"
		) {
			return { allowed: true };
		}

		const policy = await this.resolveUserPolicy(userId, context?.appKey);

		// 1. Check if account is active
		if (!policy.isActive) {
			return {
				allowed: false,
				reason: "Account is not active",
			};
		}

		// 2. Check if user has the permission (including wildcard matches)
		const hasPermission = policy.permissions.some((p) =>
			this.permissionService.matchesPattern(permissionKey, p.key),
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
				policy.apps.includes(context.appKey) ||
				policy.supervisedApps.includes(context.appKey) ||
				policy.roles.some((r) => r.roleKey === "super_admin"); // Super admins bypass app scope

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
			const isSuperAdmin = policy.roles.some(
				(r) => r.roleKey === "super_admin",
			);

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
			const isSuperAdmin = policy.roles.some(
				(r) => r.roleKey === "super_admin",
			);

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
			const isSuperAdmin = policy.roles.some(
				(r) => r.roleKey === "super_admin",
			);

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
	 * @param appKey - Optional app context
	 * @returns true if user has the role
	 */
	async hasRole(
		userId: string,
		roleKey: string,
		appKey?: string,
	): Promise<boolean> {
		// Development bypass
		if (
			process.env.NODE_ENV === "development" &&
			process.env.DISABLE_AUTH === "true"
		) {
			return true;
		}

		const policy = await this.resolveUserPolicy(userId, appKey);

		return policy.roles.some(
			(r) =>
				r.roleKey === roleKey &&
				(!appKey || r.appKey === null || r.appKey === appKey),
		);
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
	 */
	async getUserMaxRoleLevel(userId: string, appKey?: string): Promise<number> {
		// Development bypass
		if (
			process.env.NODE_ENV === "development" &&
			process.env.DISABLE_AUTH === "true"
		) {
			return 100; // Super admin level
		}

		const policy = await this.resolveUserPolicy(userId, appKey);

		if (policy.roles.length === 0) {
			return 0;
		}

		return Math.max(...policy.roles.map((r) => r.level));
	}

	/**
	 * Invalidate cache for a user
	 * Call this when user roles/permissions change
	 */
	invalidateUserCache(userId: string, appKey?: string): void {
		const cacheKey = `${userId}:${appKey || "global"}`;
		this.cache.delete(cacheKey);

		// Also clear global cache if app-specific was invalidated
		if (appKey) {
			this.cache.delete(`${userId}:global`);
		}
	}

	/**
	 * Clear all expired cache entries
	 */
	private clearExpiredCache(): void {
		const now = Date.now();
		for (const [key, value] of this.cache.entries()) {
			if (value.expires <= now) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Clear all cache entries
	 */
	clearCache(): void {
		this.cache.clear();
	}
}
