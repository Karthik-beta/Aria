/**
 * Authorization System Seed Script
 * 
 * Seeds the database with:
 * - Default roles (super_admin, admin, manager, user, viewer)
 * - Permissions (system, app, entity-level)
 * - Role-permission mappings
 * - Default applications (asset, crm, hrms, inventory)
 * - Super admin user assignment
 * 
 * This script is idempotent - safe to run multiple times.
 * 
 * @see AUTHORIZATION_SPEC.md for complete documentation
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Role definitions with hierarchy levels
 */
const ROLES = [
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
    description: 'Administrative control within designated application domains',
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

/**
 * Permission definitions organized by type
 * Format: <scope>:<resource>.<action>
 */
const PERMISSIONS = [
  // ========================================
  // System-level permissions
  // ========================================
  {
    key: 'system:*',
    name: 'System: All Permissions',
    description: 'Full system-level access including infrastructure and security',
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

  // ========================================
  // App-level permissions (per application)
  // ========================================
  // Asset Management
  {
    key: 'app:asset:*',
    name: 'Asset: All Permissions',
    description: 'Full access to asset management application',
  },
  {
    key: 'app:asset:config.update',
    name: 'Asset: Update Configuration',
    description: 'Modify asset management configuration',
  },
  {
    key: 'app:asset:user.manage',
    name: 'Asset: Manage Users',
    description: 'Manage users within asset management',
  },

  // CRM
  {
    key: 'app:crm:*',
    name: 'CRM: All Permissions',
    description: 'Full access to CRM application',
  },
  {
    key: 'app:crm:config.update',
    name: 'CRM: Update Configuration',
    description: 'Modify CRM configuration',
  },
  {
    key: 'app:crm:user.manage',
    name: 'CRM: Manage Users',
    description: 'Manage users within CRM',
  },

  // HRMS
  {
    key: 'app:hrms:*',
    name: 'HRMS: All Permissions',
    description: 'Full access to HRMS application',
  },
  {
    key: 'app:hrms:config.update',
    name: 'HRMS: Update Configuration',
    description: 'Modify HRMS configuration',
  },
  {
    key: 'app:hrms:user.manage',
    name: 'HRMS: Manage Users',
    description: 'Manage users within HRMS',
  },

  // Inventory
  {
    key: 'app:inventory:*',
    name: 'Inventory: All Permissions',
    description: 'Full access to inventory application',
  },
  {
    key: 'app:inventory:config.update',
    name: 'Inventory: Update Configuration',
    description: 'Modify inventory configuration',
  },
  {
    key: 'app:inventory:user.manage',
    name: 'Inventory: Manage Users',
    description: 'Manage users within inventory',
  },

  // ========================================
  // Entity-level permissions (CRUD operations)
  // ========================================
  // CRM - Leads
  {
    key: 'entity:crm:lead.read',
    name: 'CRM: Read Leads',
    description: 'View lead records',
  },
  {
    key: 'entity:crm:lead.create',
    name: 'CRM: Create Leads',
    description: 'Create new lead records',
  },
  {
    key: 'entity:crm:lead.update',
    name: 'CRM: Update Leads',
    description: 'Modify existing lead records',
  },
  {
    key: 'entity:crm:lead.delete',
    name: 'CRM: Delete Leads',
    description: 'Delete lead records',
  },

  // HRMS - Leave
  {
    key: 'entity:hrms:leave.read',
    name: 'HRMS: Read Leave Requests',
    description: 'View leave requests',
  },
  {
    key: 'entity:hrms:leave.create',
    name: 'HRMS: Create Leave Requests',
    description: 'Submit leave requests',
  },
  {
    key: 'entity:hrms:leave.update',
    name: 'HRMS: Update Leave Requests',
    description: 'Modify leave requests',
  },
  {
    key: 'entity:hrms:leave.approve',
    name: 'HRMS: Approve Leave Requests',
    description: 'Approve or reject leave requests',
  },

  // Inventory - Items
  {
    key: 'entity:inventory:item.read',
    name: 'Inventory: Read Items',
    description: 'View inventory items',
  },
  {
    key: 'entity:inventory:item.create',
    name: 'Inventory: Create Items',
    description: 'Add new inventory items',
  },
  {
    key: 'entity:inventory:item.update',
    name: 'Inventory: Update Items',
    description: 'Modify inventory items',
  },
  {
    key: 'entity:inventory:item.delete',
    name: 'Inventory: Delete Items',
    description: 'Remove inventory items',
  },

  // Asset - Assets
  {
    key: 'entity:asset:asset.read',
    name: 'Asset: Read Assets',
    description: 'View asset records',
  },
  {
    key: 'entity:asset:asset.create',
    name: 'Asset: Create Assets',
    description: 'Add new asset records',
  },
  {
    key: 'entity:asset:asset.update',
    name: 'Asset: Update Assets',
    description: 'Modify asset records',
  },
  {
    key: 'entity:asset:asset.delete',
    name: 'Asset: Delete Assets',
    description: 'Remove asset records',
  },
];

/**
 * Role-Permission mappings
 */
const ROLE_PERMISSIONS = {
  super_admin: [
    'system:*', // Full system access
  ],
  admin: [
    // App-level access (will be scoped by app assignment)
    'app:asset:*',
    'app:crm:*',
    'app:hrms:*',
    'app:inventory:*',
  ],
  manager: [
    // Entity-level access (scoped by team)
    'entity:crm:lead.read',
    'entity:crm:lead.create',
    'entity:crm:lead.update',
    'entity:hrms:leave.read',
    'entity:hrms:leave.approve',
    'entity:inventory:item.read',
    'entity:inventory:item.update',
    'entity:asset:asset.read',
    'entity:asset:asset.update',
  ],
  user: [
    // Basic entity-level read/create (ownership-scoped)
    'entity:crm:lead.read',
    'entity:crm:lead.create',
    'entity:hrms:leave.read',
    'entity:hrms:leave.create',
    'entity:inventory:item.read',
    'entity:asset:asset.read',
  ],
  viewer: [
    // Read-only access
    'entity:crm:lead.read',
    'entity:hrms:leave.read',
    'entity:inventory:item.read',
    'entity:asset:asset.read',
  ],
};

/**
 * Application definitions
 */
const APPS = [
  {
    appKey: 'asset',
    name: 'Asset Management',
    description: 'Fixed asset tracking and management system',
    isActive: true,
  },
  {
    appKey: 'crm',
    name: 'Customer Relationship Management',
    description: 'Lead, contact, and opportunity management',
    isActive: true,
  },
  {
    appKey: 'hrms',
    name: 'Human Resource Management',
    description: 'Employee, leave, and attendance management',
    isActive: true,
  },
  {
    appKey: 'inventory',
    name: 'Inventory Management',
    description: 'Stock and warehouse management system',
    isActive: true,
  },
];

async function seedRoles() {
  console.log('🔄 Seeding roles...');
  
  for (const roleData of ROLES) {
    await prisma.role.upsert({
      where: { key: roleData.key },
      update: {
        name: roleData.name,
        description: roleData.description,
        level: roleData.level,
        isSystem: roleData.isSystem,
      },
      create: roleData,
    });
  }
  
  console.log('✅ Roles seeded successfully');
}

async function seedPermissions() {
  console.log('🔄 Seeding permissions...');
  
  for (const permData of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permData.key },
      update: {
        name: permData.name,
        description: permData.description,
      },
      create: permData,
    });
  }
  
  console.log('✅ Permissions seeded successfully');
}

async function seedRolePermissions() {
  console.log('🔄 Seeding role-permission mappings...');
  
  for (const [roleKey, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({
      where: { key: roleKey },
    });
    
    if (!role) {
      console.warn(`⚠️  Role not found: ${roleKey}`);
      continue;
    }
    
    // Delete existing mappings for this role
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });
    
    // Create new mappings
    for (const permKey of permissionKeys) {
      const permission = await prisma.permission.findUnique({
        where: { key: permKey },
      });
      
      if (!permission) {
        console.warn(`⚠️  Permission not found: ${permKey}`);
        continue;
      }
      
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
  
  console.log('✅ Role-permission mappings seeded successfully');
}

async function seedApps() {
  console.log('🔄 Seeding applications...');
  
  for (const appData of APPS) {
    await prisma.app.upsert({
      where: { appKey: appData.appKey },
      update: {
        name: appData.name,
        description: appData.description,
        isActive: appData.isActive,
      },
      create: appData,
    });
  }
  
  console.log('✅ Applications seeded successfully');
}

async function assignSuperAdminRole() {
  console.log('🔄 Assigning super_admin role to default admin...');
  
  // Find the default admin user (created by auth.service.ts on startup)
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@aria.local';
  const adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  
  if (!adminUser) {
    console.warn(`⚠️  Default admin user not found (${adminEmail}). Skipping super_admin assignment.`);
    console.log('   Run the backend server first to create the default admin user.');
    return;
  }
  
  const superAdminRole = await prisma.role.findUnique({
    where: { key: 'super_admin' },
  });
  
  if (!superAdminRole) {
    console.warn('⚠️  super_admin role not found');
    return;
  }
  
  // Check if assignment already exists
  const existingAssignment = await prisma.userRole.findFirst({
    where: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
      appKey: null, // System-global role
    },
  });
  
  if (!existingAssignment) {
    await prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
        appKey: null, // System-global role
        assignedBy: adminUser.id, // Self-assigned
      },
    });
    console.log(`✅ super_admin role assigned to ${adminUser.email}`);
  } else {
    console.log(`✅ super_admin role already assigned to ${adminUser.email}`);
  }
}

async function main() {
  console.log('🚀 Starting authorization system seed...\n');
  
  try {
    await seedRoles();
    await seedPermissions();
    await seedRolePermissions();
    await seedApps();
    await assignSuperAdminRole();
    
    console.log('\n🎉 Authorization system seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding authorization system:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
