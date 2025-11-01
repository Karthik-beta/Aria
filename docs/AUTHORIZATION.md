# Authorization System Documentation

Complete documentation for the Aria ERP authorization system implementing RBAC + ABAC hybrid model.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Backend Implementation](#backend-implementation)
- [Frontend Integration](#frontend-integration)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Security Considerations](#security-considerations)

## Overview

The Aria authorization system implements a hybrid Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) model that provides:

- **Hierarchical roles** with privilege levels
- **Fine-grained permissions** with wildcard support
- **App-scoped access control** for multi-application architecture
- **Team-based authorization** with manager hierarchies
- **Supervisor model** for delegated user creation
- **Comprehensive audit logging** for compliance
- **Policy caching** for performance
- **Session enrichment** for client-side authorization

### Key Features

✅ Role hierarchy: super_admin (100) > admin (80) > manager (60) > user (40) > viewer (20)  
✅ Permission taxonomy: `system:*`, `app:<appKey>:*`, `entity:<appKey>:<entity>:<action>`  
✅ App-scoped roles and permissions  
✅ Team membership and manager hierarchies  
✅ Supervisor-based delegated access  
✅ Tamper-evident audit logging  
✅ 60-second policy cache with auto-expiry  
✅ Better-auth session enrichment  
✅ Type-safe TRPC endpoints  
✅ React hooks for client-side authorization  

## Architecture

### Authorization Flow

```
┌─────────────────┐
│ HTTP Request    │
└────────┬────────┘
         │
         v
┌─────────────────────────┐
│ better-auth Session     │
│ (with enriched data)    │
└────────┬────────────────┘
         │
         v
┌─────────────────────────┐
│ PublicRouteGuard        │ ─── Skip if @PublicRoute
└────────┬────────────────┘
         │
         v
┌─────────────────────────┐
│ ActiveUserGuard         │ ─── Check isActive = true
└────────┬────────────────┘
         │
         v
┌─────────────────────────┐
│ AppScopeGuard           │ ─── Validate @AppScope
└────────┬────────────────┘
         │
         v
┌─────────────────────────┐
│ RolePermissionGuard     │ ─── Check @RequireRoles / @RequirePermissions
└────────┬────────────────┘
         │
         v
┌─────────────────────────┐
│ OwnershipGuard          │ ─── Optional: validate resource ownership
└────────┬────────────────┘
         │
         v
┌─────────────────────────┐
│ Route Handler           │
└─────────────────────────┘
```

### Service Layer

```
PolicyService (Core)
├── resolveUserPolicy()  ─── Fetch roles, apps, permissions (cached 60s)
├── can()                ─── Permission evaluation with wildcard matching
├── hasRole()            ─── Role check
└── getUserMaxRoleLevel()─── Get highest role level

RoleService
├── createRole()
├── updateRole()
├── deleteRole()
├── assignPermissions()
└── getRoleWithPermissions()

PermissionService
├── createPermission()
├── updatePermission()
├── deletePermission()
├── validatePermissionKey() ─── Regex validation
└── matchesPattern()        ─── Wildcard matching

ScopeService
├── isSupervisorOf()        ─── Check app supervisor
├── isTeamMember()          ─── Check team membership
├── isTeamManager()         ─── Check team manager
├── isInManagementHierarchy()─── Recursive manager check (max depth 10)
└── canCreateUsersInApp()   ─── Combined supervisor + role check

AuditService
├── logUserCreated()
├── logUserUpdated()
├── logUserStatusChanged()
├── logRoleAssigned()
└── queryLogs()
```

## Database Schema

### Core Tables

#### roles
Defines system and custom roles with hierarchy levels.

| Column      | Type    | Description                    |
|-------------|---------|--------------------------------|
| id          | String  | UUID primary key               |
| key         | String  | Unique identifier (e.g., "admin") |
| name        | String  | Display name                   |
| description | String? | Role description               |
| level       | Int     | Hierarchy level (0-100)        |
| isSystem    | Boolean | Protected system role          |
| createdAt   | DateTime| Creation timestamp             |
| updatedAt   | DateTime| Last update timestamp          |

#### permissions
Defines fine-grained permissions.

| Column      | Type    | Description                          |
|-------------|---------|--------------------------------------|
| id          | String  | UUID primary key                     |
| key         | String  | Unique identifier (e.g., "system:user.manage") |
| name        | String  | Display name                         |
| description | String? | Permission description               |
| scope       | Enum    | system / app / entity                |
| createdAt   | DateTime| Creation timestamp                   |
| updatedAt   | DateTime| Last update timestamp                |

#### user_roles
Maps users to roles (with optional app scoping).

| Column    | Type     | Description                     |
|-----------|----------|---------------------------------|
| id        | String   | UUID primary key                |
| userId    | String   | FK to users.id                  |
| roleId    | String   | FK to roles.id                  |
| appKey    | String?  | Optional app scope              |
| assignedAt| DateTime | Assignment timestamp            |

**Unique constraint**: (userId, roleId, appKey)

#### role_permissions
Maps roles to permissions.

| Column       | Type     | Description              |
|--------------|----------|--------------------------|
| id           | String   | UUID primary key         |
| roleId       | String   | FK to roles.id           |
| permissionId | String   | FK to permissions.id     |
| assignedAt   | DateTime | Assignment timestamp     |

**Unique constraint**: (roleId, permissionId)

#### apps
Defines applications in the ERP suite.

| Column      | Type    | Description                    |
|-------------|---------|--------------------------------|
| id          | String  | UUID primary key               |
| key         | String  | Unique identifier (e.g., "crm")|
| name        | String  | Display name                   |
| description | String? | App description                |
| createdAt   | DateTime| Creation timestamp             |
| updatedAt   | DateTime| Last update timestamp          |

#### app_supervisors
Defines supervisors who can create users for an app.

| Column     | Type     | Description              |
|------------|----------|--------------------------|
| id         | String   | UUID primary key         |
| userId     | String   | FK to users.id           |
| appId      | String   | FK to apps.id            |
| assignedAt | DateTime | Assignment timestamp     |

**Unique constraint**: (userId, appId)

#### teams
Defines teams with optional managers.

| Column     | Type    | Description              |
|------------|---------|--------------------------|
| id         | String  | UUID primary key         |
| name       | String  | Team name                |
| description| String? | Team description         |
| appKey     | String? | Optional app association |
| createdAt  | DateTime| Creation timestamp       |
| updatedAt  | DateTime| Last update timestamp    |

#### team_members
Maps users to teams.

| Column   | Type     | Description              |
|----------|----------|--------------------------|
| id       | String   | UUID primary key         |
| userId   | String   | FK to users.id           |
| teamId   | String   | FK to teams.id           |
| isManager| Boolean  | Team manager flag        |
| joinedAt | DateTime | Join timestamp           |

**Unique constraint**: (userId, teamId)

#### audit_logs
Append-only audit trail for authorization changes.

| Column    | Type     | Description                     |
|-----------|----------|---------------------------------|
| id        | String   | UUID primary key                |
| timestamp | DateTime | Event timestamp                 |
| action    | String   | Action type                     |
| actorId   | String   | User who performed action       |
| userId    | String?  | Affected user (if applicable)   |
| metadata  | Json     | Additional event data           |

### Extended Users Table

The existing `users` table is extended with:

| Column      | Type    | Description                    |
|-------------|---------|--------------------------------|
| isActive    | Boolean | Account active flag (default true) |
| displayName | String? | Full display name              |
| department  | String? | Department/team                |
| managerId   | String? | FK to users.id (manager)       |

## Backend Implementation

### NestJS Module Structure

```
src/
└── authorization/
    ├── authorization.module.ts    # @Global module
    ├── index.ts                   # Centralized exports
    ├── audit.service.ts           # Audit logging
    ├── scope.service.ts           # Team/ownership checks
    ├── role-permission.service.ts # CRUD for roles/permissions
    ├── policy.service.ts          # Core RBAC+ABAC engine
    ├── decorators.ts              # @RequirePermissions, @RequireRoles, @AppScope, @PublicRoute
    └── guards.ts                  # 5 NestJS guards
```

### Session Enrichment

Located in `src/auth/auth.config.ts`:

```typescript
import { PolicyService } from '../authorization/policy.service';

plugins: [
  {
    id: 'custom-session',
    init: () => {
      return {
        hooks: {
          session: {
            async created({ session, user }) {
              const policy = await policyService.resolveUserPolicy(user.id);
              
              return {
                session: {
                  ...session,
                  roles: policy.roles,
                  apps: policy.apps,
                  permissions: policy.permissions,
                  supervisedApps: policy.supervisedApps,
                  isActive: policy.isActive,
                },
                user: {
                  ...user,
                  isActive: policy.isActive,
                  displayName: user.name || user.email,
                },
              };
            },
          },
        },
      };
    },
  },
]
```

### TRPC Endpoints

Located in `src/trpc/routers/admin.router.ts`:

#### User Management
- `admin.listUsers` - Paginated user list with search
- `admin.getUser` - Get single user with full details
- `admin.createUser` - Create new user
- `admin.updateUser` - Update user details
- `admin.disableUser` - Disable user account
- `admin.enableUser` - Enable user account
- `admin.deleteUser` - Soft delete (disable) user

#### Role Assignment
- `admin.assignRole` - Assign role to user (app-scoped or global)
- `admin.revokeRole` - Revoke role from user

#### Supervisor Management
- `admin.assignSupervisor` - Assign supervisor to app
- `admin.revokeSupervisor` - Revoke supervisor from app

#### Role Management
- `admin.listRoles` - List all roles
- `admin.getRole` - Get role with permissions
- `admin.createRole` - Create new role
- `admin.updateRole` - Update role
- `admin.deleteRole` - Delete role (if not system role)
- `admin.assignPermissionToRole` - Assign permission to role
- `admin.removePermissionFromRole` - Remove permission from role

#### Permission Management
- `admin.listPermissions` - List all permissions (optionally filtered by scope)
- `admin.getPermission` - Get permission details
- `admin.createPermission` - Create new permission
- `admin.updatePermission` - Update permission
- `admin.deletePermission` - Delete permission

#### Audit Logs
- `admin.getAuditLogs` - Query audit logs with filters

## Frontend Integration

### Client-Side Hooks

Located in `src/hooks/use-auth.ts`:

#### useAuth()
Main authorization hook providing:

```typescript
const {
  isAuthenticated,       // Boolean
  isActive,              // Boolean
  user,                  // User object
  roles,                 // string[]
  permissions,           // string[]
  apps,                  // Record<string, { roles: string[] }>
  supervisedApps,        // string[]
  hasPermission,         // (key: string) => boolean
  hasAnyPermission,      // (...keys: string[]) => boolean
  hasRole,               // (key: string) => boolean
  hasAnyRole,            // (...keys: string[]) => boolean
  canAccessApp,          // (appKey: string) => boolean
  isSupervisorOf,        // (appKey: string) => boolean
  isLoading,             // boolean
} = useAuth();
```

#### usePermission(permission)
Check single permission or array of permissions (any match).

```typescript
const canManageUsers = usePermission('system:user.manage');
const canEditCRM = usePermission(['entity:crm:lead.update', 'app:crm:*']);
```

#### useRole(role)
Check single role or array of roles (any match).

```typescript
const isAdmin = useRole('admin');
const isManagerOrAdmin = useRole(['manager', 'admin']);
```

#### useAppAccess(appKey)
Check if user can access a specific app.

```typescript
const canAccessCRM = useAppAccess('crm');
```

### UI Components

Located in `src/components/auth/protected-content.tsx`:

#### PermissionGate
```tsx
<PermissionGate permission="system:user.manage" fallback={<AccessDenied />}>
  <UserManagementPanel />
</PermissionGate>

<PermissionGate 
  permission={['entity:crm:lead.create', 'entity:crm:lead.update']} 
  requireAll={false}
>
  <CreateLeadButton />
</PermissionGate>
```

#### RoleGate
```tsx
<RoleGate role="admin" fallback={<Unauthorized />}>
  <AdminPanel />
</RoleGate>

<RoleGate role={['manager', 'admin']}>
  <ManagerTools />
</RoleGate>
```

#### AppGate
```tsx
<AppGate appKey="crm" fallback={<AppNotAvailable />}>
  <CRMDashboard />
</AppGate>
```

#### AuthGate
```tsx
<AuthGate fallback={<LoginPrompt />}>
  <ProtectedContent />
</AuthGate>
```

#### ProtectedContent (Combined)
```tsx
<ProtectedContent
  permission="entity:crm:lead.update"
  role="manager"
  appKey="crm"
  fallback={<AccessDenied />}
>
  <EditLeadForm />
</ProtectedContent>
```

### Admin Dashboard

Located in `src/app/admin/`:

- `/admin` - Dashboard overview
- `/admin/users` - User management with data table
- `/admin/roles` - Roles & permissions management
- `/admin/audit` - Audit logs viewer

## API Reference

### Permission Key Format

```
system:<resource>.<action>
app:<appKey>:<resource>.<action>
entity:<appKey>:<entity>.<action>
```

**Examples:**
```
system:*                      # Full system access
system:user.read              # Read all users
system:user.manage            # Full user management
system:role.assign            # Assign roles globally

app:crm:*                     # Full CRM app access
app:crm:config.update         # Update CRM configuration
app:crm:user.create           # Create users in CRM

entity:crm:lead.read          # Read CRM leads
entity:crm:lead.create        # Create CRM leads
entity:crm:lead.update        # Update CRM leads
entity:crm:lead.delete        # Delete CRM leads
entity:crm:lead.*             # All lead operations

entity:inventory:item.*       # All inventory item operations
```

### Wildcard Matching

The permission system supports wildcard matching:

- `system:*` matches all system-level permissions
- `app:crm:*` matches all CRM app permissions
- `entity:crm:lead.*` matches all lead entity permissions
- `entity:crm:*` matches all CRM entity permissions

## Usage Examples

### Backend: Protect Controller Endpoints

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { 
  AppScope, 
  RequirePermissions, 
  RequireRoles,
  RolePermissionGuard 
} from '@/authorization';

@Controller('crm/leads')
@AppScope('crm')
@UseGuards(RolePermissionGuard)
export class LeadsController {
  
  @Get()
  @RequirePermissions('entity:crm:lead.read')
  async getLeads() {
    // Only users with entity:crm:lead.read can access
    return this.leadsService.findAll();
  }
  
  @Post()
  @RequirePermissions('entity:crm:lead.create')
  async createLead(@Body() dto: CreateLeadDto) {
    // Only users with entity:crm:lead.create can access
    return this.leadsService.create(dto);
  }
  
  @Post('bulk-delete')
  @RequireRoles('admin', 'manager')
  async bulkDelete(@Body() dto: BulkDeleteDto) {
    // Only admins or managers can bulk delete
    return this.leadsService.bulkDelete(dto.ids);
  }
}
```

### Backend: Programmatic Permission Check

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PolicyService, AuditService } from '@/authorization';

@Injectable()
export class UserService {
  constructor(
    private policyService: PolicyService,
    private auditService: AuditService,
    private prisma: PrismaClient,
  ) {}
  
  async deleteUser(actorId: string, targetUserId: string) {
    // Check permission programmatically
    const result = await this.policyService.can(
      actorId,
      'system:user.manage',
    );
    
    if (!result.allowed) {
      throw new ForbiddenException(result.reason);
    }
    
    // Prevent self-deletion
    if (actorId === targetUserId) {
      throw new ForbiddenException('Cannot delete your own account');
    }
    
    // Perform deletion
    await this.prisma.user.delete({ 
      where: { id: targetUserId } 
    });
    
    // Log the action
    await this.auditService.logUserDeleted(actorId, targetUserId);
    
    // Invalidate cache
    this.policyService.invalidateUserCache(targetUserId);
  }
}
```

### Frontend: Conditional Rendering

```tsx
import { useAuth, usePermission } from '@/hooks/use-auth';
import { PermissionGate, RoleGate } from '@/components/auth/protected-content';

export function Dashboard() {
  const { user, roles, hasPermission } = useAuth();
  const canManageUsers = usePermission('system:user.manage');
  
  return (
    <div>
      <h1>Welcome, {user.displayName}</h1>
      
      {/* Show admin panel only to admins */}
      <RoleGate role="admin">
        <AdminPanel />
      </RoleGate>
      
      {/* Show user management to those with permission */}
      <PermissionGate permission="system:user.manage">
        <UserManagementSection />
      </PermissionGate>
      
      {/* Inline check */}
      {canManageUsers && (
        <Button onClick={handleCreateUser}>Create User</Button>
      )}
      
      {/* Show different content based on role */}
      {hasPermission('system:*') && <SuperAdminTools />}
      {hasPermission('app:crm:*') && <CRMFullAccess />}
      {hasPermission('entity:crm:lead.read') && <CRMReadOnly />}
    </div>
  );
}
```

### Frontend: TRPC Mutations

```tsx
'use client';

import { trpc } from '@/lib/trpc/client';

export function UserManagement() {
  const utils = trpc.useUtils();
  
  const assignRole = trpc.admin.assignRole.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
    },
  });
  
  const handleAssignRole = async (userId: string) => {
    await assignRole.mutateAsync({
      userId,
      roleKey: 'manager',
      appKey: 'crm',
    });
  };
  
  return (
    <Button onClick={() => handleAssignRole('user-123')}>
      Assign Manager Role
    </Button>
  );
}
```

## Security Considerations

### 1. Default Deny
All routes require authentication unless explicitly marked with `@PublicRoute` decorator.

### 2. Principle of Least Privilege
- Users start with no permissions
- Roles must be explicitly assigned
- App access must be granted explicitly

### 3. Separation of Duties
- **Super Admin**: Full system access across all apps
- **Admin**: App-level administration
- **Manager**: Team and entity management
- **User**: Standard access to assigned entities
- **Viewer**: Read-only access

### 4. Audit Trail
All authorization changes are logged immutably in `audit_logs`:
- User creation, updates, deletions
- Role assignments and revocations
- Supervisor assignments and revocations
- Account status changes

### 5. Cache Security
- Policy cache expires after 60 seconds
- Cache is invalidated on authorization changes
- Inactive users are rejected even if cached

### 6. Session Security
- Session enrichment happens server-side
- Better-auth handles cookie security (HttpOnly, Secure, SameSite)
- Sessions expire after 7 days with 24-hour refresh

### 7. Input Validation
- Permission keys validated with regex patterns
- Role levels constrained to 0-100 range
- System roles protected from deletion

### 8. Rate Limiting
Consider implementing rate limiting on:
- Admin endpoints (user creation, role assignment)
- Authentication endpoints
- Audit log queries

## Troubleshooting

### User Cannot Access Protected Route

1. Check if user is authenticated: `useAuth().isAuthenticated`
2. Check if user account is active: `useAuth().isActive`
3. Verify user has required permission: `useAuth().hasPermission('...')`
4. Check role assignment in database
5. Verify permission is assigned to role
6. Check app scope if using `@AppScope` decorator

### Permission Not Working

1. Verify permission key format matches taxonomy
2. Check wildcard permissions (e.g., `app:crm:*` should match `app:crm:user.create`)
3. Clear policy cache: restart backend or wait 60 seconds
4. Check audit logs for permission changes

### Session Not Enriched

1. Verify `auth.config.ts` has session enrichment plugin
2. Check PolicyService is accessible (module initialized)
3. Clear browser cookies and re-authenticate
4. Check backend logs for session creation errors

### Performance Issues

1. Verify policy cache is working (check logs)
2. Consider increasing cache TTL if security permits
3. Add database indexes for frequently queried fields
4. Monitor audit_logs table size (consider archiving)

---

**Documentation Version**: 1.0.0  
**Last Updated**: November 1, 2025  
**Maintainer**: Aria Development Team
