import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { PrismaClient } from '@prisma/client';
import {
  RoleService,
  PermissionService,
} from '../../authorization/role-permission.service';
import { PolicyService } from '../../authorization/policy.service';
import { ScopeService } from '../../authorization/scope.service';
import { AuditService } from '../../authorization/audit.service';

// Initialize services
const prisma = new PrismaClient();
const roleService = new RoleService(prisma);
const permissionService = new PermissionService(prisma);
const scopeService = new ScopeService(prisma);
const policyService = new PolicyService(
  prisma,
  permissionService,
  scopeService,
);
const auditService = new AuditService(prisma);

/**
 * Helper to check if user has required permission
 */
async function requirePermission(userId: string, permission: string) {
  const result = await policyService.can(userId, permission);
  if (!result.allowed) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: result.reason || 'Insufficient permissions',
    });
  }
}

/**
 * Admin router for user, role, and permission management
 *
 * All endpoints require authentication and specific permissions
 */
export const adminRouter = router({
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
      await requirePermission(ctx.user.id, 'system:user.read');

      const skip = (input.page - 1) * input.limit;
      const where: any = {};

      if (input.search) {
        where.OR = [
          { email: { contains: input.search, mode: 'insensitive' } },
          { name: { contains: input.search, mode: 'insensitive' } },
          { displayName: { contains: input.search, mode: 'insensitive' } },
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
            isActive: true,
            department: true,
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
          orderBy: { createdAt: 'desc' },
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

  /**
   * Get single user by ID with full details
   */
  getUser: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, 'system:user.read');

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
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
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
        name: z.string().min(1),
        displayName: z.string().optional(),
        department: z.string().optional(),
        managerId: z.string().optional(),
        roleKeys: z.array(z.string()).optional(),
        appKey: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user can create users (either globally or for specific app)
      if (input.appKey) {
        await requirePermission(ctx.user.id, `app:${input.appKey}:user.create`);
      } else {
        await requirePermission(ctx.user.id, 'system:user.manage');
      }

      // Create user
      const user = await ctx.prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          displayName: input.displayName || input.name,
          department: input.department,
          managerId: input.managerId,
          isActive: true,
        },
      });

      // Assign roles if provided
      if (input.roleKeys && input.roleKeys.length > 0) {
        for (const roleKey of input.roleKeys) {
          const role = await roleService.getRoleByKey(roleKey);
          if (!role) continue;

          await ctx.prisma.userRole.create({
            data: {
              userId: user.id,
              roleId: role.id,
              appKey: input.appKey,
            },
          });
        }
      }

      // Audit log
      await auditService.logUserCreated(ctx.user.id, user.id, {
        email: user.email,
        roles: input.roleKeys,
        appKey: input.appKey,
      });

      return user;
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
      await requirePermission(ctx.user.id, 'system:user.manage');

      const { userId, ...updateData } = input;

      const user = await ctx.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      await auditService.logUserUpdated(ctx.user.id, userId, updateData);

      return user;
    }),

  /**
   * Disable user account
   */
  disableUser: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, 'system:user.manage');

      const user = await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { isActive: false },
      });

      await auditService.logUserStatusChanged(ctx.user.id, input.userId, false);

      // Invalidate user's policy cache
      policyService.invalidateUserCache(input.userId);

      return user;
    }),

  /**
   * Enable user account
   */
  enableUser: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, 'system:user.manage');

      const user = await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { isActive: true },
      });

      await auditService.logUserStatusChanged(ctx.user.id, input.userId, true);

      policyService.invalidateUserCache(input.userId);

      return user;
    }),

  /**
   * Delete user (soft delete by disabling)
   */
  deleteUser: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, 'system:user.manage');

      // Prevent self-deletion
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete your own account',
        });
      }

      // Soft delete by disabling
      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { isActive: false },
      });

      await auditService.logUserDeleted(ctx.user.id, input.userId);

      policyService.invalidateUserCache(input.userId);

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
      // Check permission
      if (input.appKey) {
        await requirePermission(ctx.user.id, `app:${input.appKey}:role.assign`);
      } else {
        await requirePermission(ctx.user.id, 'system:role.assign');
      }

      const role = await roleService.getRoleByKey(input.roleKey);
      if (!role) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' });
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
          code: 'BAD_REQUEST',
          message: 'Role already assigned',
        });
      }

      const userRole = await ctx.prisma.userRole.create({
        data: {
          userId: input.userId,
          roleId: role.id,
          appKey: input.appKey,
        },
      });

      await auditService.logRoleAssigned(
        ctx.user.id,
        input.userId,
        input.roleKey,
        input.appKey,
      );

      policyService.invalidateUserCache(input.userId);

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
      // Check permission
      if (input.appKey) {
        await requirePermission(ctx.user.id, `app:${input.appKey}:role.assign`);
      } else {
        await requirePermission(ctx.user.id, 'system:role.assign');
      }

      const role = await roleService.getRoleByKey(input.roleKey);
      if (!role) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' });
      }

      await ctx.prisma.userRole.deleteMany({
        where: {
          userId: input.userId,
          roleId: role.id,
          appKey: input.appKey || null,
        },
      });

      await auditService.logRoleRevoked(
        ctx.user.id,
        input.userId,
        input.roleKey,
        input.appKey,
      );

      policyService.invalidateUserCache(input.userId);

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
      await requirePermission(
        ctx.user.id,
        `app:${input.appKey}:supervisor.assign`,
      );

      const app = await ctx.prisma.app.findUnique({
        where: { appKey: input.appKey },
      });

      if (!app) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'App not found' });
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
          code: 'BAD_REQUEST',
          message: 'User is already a supervisor',
        });
      }

      const supervisor = await ctx.prisma.appSupervisor.create({
        data: {
          supervisorUserId: input.userId,
          appKey: input.appKey,
        },
      });

      await auditService.logSupervisorAssigned(
        ctx.user.id,
        input.userId,
        input.appKey,
      );

      policyService.invalidateUserCache(input.userId);

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
      await requirePermission(
        ctx.user.id,
        `app:${input.appKey}:supervisor.assign`,
      );

      const app = await ctx.prisma.app.findUnique({
        where: { appKey: input.appKey },
      });

      if (!app) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'App not found' });
      }

      await ctx.prisma.appSupervisor.deleteMany({
        where: {
          supervisorUserId: input.userId,
          appKey: input.appKey,
        },
      });

      await auditService.logSupervisorRevoked(
        ctx.user.id,
        input.userId,
        input.appKey,
      );

      policyService.invalidateUserCache(input.userId);

      return { success: true };
    }),

  // ==================== ROLE MANAGEMENT ====================

  /**
   * List all roles
   */
  listRoles: protectedProcedure.query(async ({ ctx }) => {
    await requirePermission(ctx.user.id, 'system:role.read');
    return roleService.listRoles();
  }),

  /**
   * Get role with permissions
   */
  getRole: protectedProcedure
    .input(z.object({ roleKey: z.string() }))
    .query(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, 'system:role.read');
      const role = await roleService.getRoleWithPermissions(input.roleKey);
      if (!role) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' });
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
      await requirePermission(ctx.user.id, 'system:role.manage');
      return roleService.createRole(input);
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
      await requirePermission(ctx.user.id, 'system:role.manage');
      const { roleKey, ...updates } = input;
      return roleService.updateRole(roleKey, updates);
    }),

  /**
   * Delete role
   */
  deleteRole: protectedProcedure
    .input(z.object({ roleKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, 'system:role.manage');
      await roleService.deleteRole(input.roleKey);
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
      await requirePermission(ctx.user.id, 'system:role.manage');
      await roleService.addPermission(input.roleKey, input.permissionKey);
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
      await requirePermission(ctx.user.id, 'system:role.manage');
      await roleService.removePermission(input.roleKey, input.permissionKey);
      return { success: true };
    }),

  // ==================== PERMISSION MANAGEMENT ====================

  /**
   * List all permissions
   */
  listPermissions: protectedProcedure
    .input(
      z
        .object({
          scope: z.enum(['system', 'app', 'entity']).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, 'system:permission.read');
      return permissionService.listPermissions(
        input ? { scope: input.scope } : undefined,
      );
    }),

  /**
   * Get permission details
   */
  getPermission: protectedProcedure
    .input(z.object({ permissionKey: z.string() }))
    .query(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, 'system:permission.read');
      const permission = await permissionService.getPermissionByKey(
        input.permissionKey,
      );
      if (!permission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Permission not found',
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
        scope: z.enum(['system', 'app', 'entity']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, 'system:permission.manage');
      return permissionService.createPermission(input);
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
      await requirePermission(ctx.user.id, 'system:permission.manage');
      const { permissionKey, ...updates } = input;
      return permissionService.updatePermission(permissionKey, updates);
    }),

  /**
   * Delete permission
   */
  deletePermission: protectedProcedure
    .input(z.object({ permissionKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, 'system:permission.manage');
      await permissionService.deletePermission(input.permissionKey);
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
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, 'system:audit.read');
      return auditService.queryLogs({
        fromDate: input.startDate,
        toDate: input.endDate,
        actorUserId: input.actorId,
        action: input.action,
        limit: input.limit,
      });
    }),
});
