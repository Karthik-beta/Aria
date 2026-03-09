import { logger } from "@aria/utils";
import { protectedProcedure, router } from "../trpc";

/**
 * Authorization router for fetching user roles and permissions
 *
 * Provides procedures to get user's authorization data after authentication.
 * This data is used by the frontend's useAuth hook for permission checks.
 */
export const authorizationRouter = router({
	/**
	 * Get current user's roles, permissions, and app access
	 *
	 * Fetches:
	 * - All roles assigned to the user
	 * - All permissions for those roles
	 * - App access information
	 * - Supervised apps
	 *
	 * This is called by the frontend after user signs in to populate authorization context.
	 */
	getUserAuthorization: protectedProcedure.query(async ({ ctx }) => {
		try {
			const { prisma, user } = ctx;

			if (!prisma) {
				throw new Error("Prisma client not available in tRPC context");
			}

			// Get user ID from authenticated context
			const userId = user?.id;

			if (!userId) {
				return {
					roles: [],
					permissions: [],
					apps: {},
					supervisedApps: [],
					isActive: false,
				};
			}

			// Fetch user's roles
			const userRoles = await prisma.userRole.findMany({
				where: { userId },
				include: { role: true },
			});

			// Fetch all permissions for the user's roles
			const roleIds = userRoles.map((ur) => ur.role.id);
			const rolePermissions = await prisma.rolePermission.findMany({
				where: { roleId: { in: roleIds } },
				include: { permission: true },
			});

			// Get unique permission keys
			const permissionKeys = [
				...new Set(rolePermissions.map((rp) => rp.permission.key)),
			];

			// Get roles as keys
			const roleKeys = userRoles.map((ur) => ur.role.key);

			// Fetch user's app access through teams and direct role assignments
			const userTeams = await prisma.teamMember.findMany({
				where: { userId },
				include: { team: { select: { appKey: true } } },
			});

			const appKeysFromTeams = userTeams.map((ut) => ut.team.appKey);
			const appKeysFromRoles = userRoles
				.map((ur) => ur.appKey)
				.filter((appKey): appKey is string => Boolean(appKey));

			// Fetch supervised apps
			const supervisedApps = await prisma.appSupervisor.findMany({
				where: { supervisorUserId: userId },
				include: { app: true },
			});

			const supervisedAppKeys = supervisedApps.map((sa) => sa.app.appKey);

			// Build apps object with roles per app
			const scopedAppKeys = new Set<string>([
				...appKeysFromTeams,
				...appKeysFromRoles,
			]);

			const apps: Record<string, { roles: string[] }> = {};
			for (const appKey of scopedAppKeys) {
				const scopedRoles = userRoles.filter(
					(ur) => ur.appKey === appKey || ur.appKey === null,
				);

				if (scopedRoles.length > 0) {
					apps[appKey] = {
						roles: scopedRoles.map((ur) => ur.role.key),
					};
				}
			}

			return {
				roles: roleKeys,
				permissions: permissionKeys,
				apps,
				supervisedApps: supervisedAppKeys,
				isActive: true,
			};
		} catch (error) {
			logger.error("[Authorization] Error fetching user authorization:", error);
			return {
				roles: [],
				permissions: [],
				apps: {},
				supervisedApps: [],
				isActive: false,
			};
		}
	}),
});
