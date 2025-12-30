import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { prismaClient } from '../shared/prisma-client.js';
import { auth } from './auth.config';

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

  async onModuleInit() {
    // Create default user in both development and production for testing
    await this.createDefaultUser();
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
    const name = process.env.DEFAULT_ADMIN_NAME || 'Administrator';

    if (!username || !password || !email) {
      this.logger.warn(
        'Default admin credentials not configured. Skipping user creation. ' +
        'Set DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, and DEFAULT_ADMIN_EMAIL.',
      );
      return;
    }

    try {
      // Wait for database to be ready
      await this.prisma.$connect();

      // Check if user already exists
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
        // Create user via better-auth's Request API
        // Username plugin uses /sign-up/email endpoint with username field
        const request = new Request(
          `${process.env.BETTER_AUTH_URL || 'http://localhost:3001'}/api/auth/sign-up/email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username,
              password,
              email,
              name,
            }),
          },
        );

        const response = await auth.handler(request);

        if (response.ok) {
          this.logger.log(
            `Default admin user created successfully: ${username}`,
          );
          userCreated = true;
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
        } catch (updateError: any) {
          this.logger.error(
            'Failed to update default admin password metadata (non-critical):',
            updateError?.message || updateError,
          );
        }
      }

      // Always seed authorization system and assign super_admin role if user exists or was created
      if (userCreated) {
        try {
          await this.seedAuthorizationAndAssignRole(email);
          this.logger.log(
            `Authorization system seeded and super_admin role assigned to ${username}`,
          );
        } catch (seedError: any) {
          this.logger.error(
            'Failed to seed authorization or assign roles (non-critical):',
            seedError?.message || seedError,
          );
        }
      }
    } catch (error: any) {
      // Log error but don't crash the application
      this.logger.error(
        'Failed to create default admin user (non-critical):',
        error?.message || error,
      );
    }
  }

  /**
   * Seed authorization system and assign super_admin role to default admin user
   *
   * @remarks
   * Creates roles, permissions, and role-permission mappings.
   * Assigns the super_admin role to the provided email address.
   */
  private async seedAuthorizationAndAssignRole(adminEmail: string) {
    // Seed roles
    await this.seedRoles();

    // Seed permissions
    await this.seedPermissions();

    // Seed role-permission mappings
    await this.seedRolePermissions();

    // Seed apps
    await this.seedApps();

    // Assign super_admin role to the admin user
    await this.assignSuperAdminRole(adminEmail);
  }

  /**
   * Seed default roles into the database
   */
  private async seedRoles() {
    const roles = [
      {
        key: 'super_admin',
        name: 'System Administrator',
        description: 'Full system access with no restrictions',
        level: 100,
        isSystem: true,
      },
      {
        key: 'admin',
        name: 'Administrator',
        description:
          'Administrative control within designated application domains',
        level: 80,
        isSystem: true,
      },
      {
        key: 'manager',
        name: 'Manager / Supervisor',
        description: 'Read/write within team scope with approval capabilities',
        level: 60,
        isSystem: true,
      },
      {
        key: 'user',
        name: 'User / Employee',
        description: 'Standard user with own data access',
        level: 40,
        isSystem: true,
      },
      {
        key: 'viewer',
        name: 'Viewer',
        description: 'Read-only access across permitted scopes',
        level: 20,
        isSystem: true,
      },
    ];

    for (const role of roles) {
      const result = await this.prisma.role.upsert({
        where: { key: role.key },
        update: {},
        create: role,
      });
      this.logger.debug(
        `[Seed] Role created/updated: ${role.key} (id: ${result.id})`,
      );
    }

    this.logger.log(`[Seed] ${roles.length} roles seeded successfully`);
  }

  /**
   * Seed system permissions into the database
   */
  private async seedPermissions() {
    const permissions = [
      {
        key: 'system:*',
        name: 'System: All Permissions',
        description:
          'Full system-level access including infrastructure and security',
      },
      {
        key: 'system:user.manage',
        name: 'System: Manage Users',
        description: 'Create, update, disable, and delete users globally',
      },
      {
        key: 'system:role.manage',
        name: 'System: Manage Roles',
        description: 'Create, update, and delete roles and permissions',
      },
      {
        key: 'system:config.manage',
        name: 'System: Manage Configuration',
        description: 'Modify system-wide configuration and settings',
      },
      {
        key: 'system:audit.read',
        name: 'System: Read Audit Logs',
        description: 'View audit logs for all system activities',
      },
    ];

    for (const permission of permissions) {
      const result = await this.prisma.permission.upsert({
        where: { key: permission.key },
        update: {},
        create: permission,
      });
      this.logger.debug(
        `[Seed] Permission created/updated: ${permission.key} (id: ${result.id})`,
      );
    }

    this.logger.log(
      `[Seed] ${permissions.length} permissions seeded successfully`,
    );
  }

  /**
   * Seed role-permission mappings
   */
  private async seedRolePermissions() {
    // Get super_admin role
    const superAdminRole = await this.prisma.role.findUnique({
      where: { key: 'super_admin' },
    });

    if (!superAdminRole) {
      this.logger.warn(
        '[Seed] super_admin role not found for permission mapping',
      );
      return;
    }

    // Assign all system permissions to super_admin
    const systemPermissions = await this.prisma.permission.findMany({
      where: {
        key: {
          startsWith: 'system:',
        },
      },
    });

    this.logger.debug(
      `[Seed] Found ${systemPermissions.length} system permissions`,
    );

    for (const permission of systemPermissions) {
      await this.prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      });
    }

    this.logger.log(
      `[Seed] ${systemPermissions.length} permissions mapped to super_admin role`,
    );
  }

  /**
   * Seed default applications
   */
  private async seedApps() {
    const apps = [
      {
        appKey: 'asset',
        name: 'Asset Management',
        description: 'Manage company assets and inventory',
        isActive: true,
      },
      {
        appKey: 'crm',
        name: 'Customer Relationship Management',
        description: 'Manage customer relationships and sales',
        isActive: true,
      },
      {
        appKey: 'hrms',
        name: 'Human Resource Management',
        description: 'Manage HR and employee information',
        isActive: true,
      },
      {
        appKey: 'inventory',
        name: 'Inventory Management',
        description: 'Manage inventory and stock levels',
        isActive: true,
      },
    ];

    for (const app of apps) {
      await this.prisma.app.upsert({
        where: { appKey: app.appKey },
        update: { isActive: app.isActive },
        create: app,
      });
      this.logger.debug(`[Seed] App created/updated: ${app.appKey}`);
    }

    this.logger.log(`[Seed] ${apps.length} applications seeded successfully`);
  }

  /**
   * Assign super_admin role to a user by email
   */
  private async assignSuperAdminRole(email: string) {
    this.logger.debug(`[Seed] Starting role assignment for user: ${email}`);

    const adminUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!adminUser) {
      this.logger.warn(`[Seed] Admin user not found with email: ${email}`);
      return;
    }

    this.logger.debug(`[Seed] Found admin user: ${adminUser.id}`);

    const superAdminRole = await this.prisma.role.findUnique({
      where: { key: 'super_admin' },
    });

    if (!superAdminRole) {
      this.logger.warn('[Seed] super_admin role not found');
      return;
    }

    this.logger.debug(`[Seed] Found super_admin role: ${superAdminRole.id}`);

    // Check if assignment already exists
    const existingAssignment = await this.prisma.userRole.findFirst({
      where: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
        appKey: null,
      },
    });

    if (existingAssignment) {
      this.logger.log(`[Seed] super_admin role already assigned to ${email}`);
      return;
    }

    const userRole = await this.prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
        appKey: null,
        assignedBy: adminUser.id,
      },
    });

    this.logger.log(
      `[Seed] ✅ super_admin role assigned to ${email} (userRoleId: ${userRole.id})`,
    );
  }
}
