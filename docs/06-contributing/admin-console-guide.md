# Admin Console Guide

The Admin Console provides a professional interface for managing users, roles, permissions, and viewing audit logs.

## Features

### 1. **Navigation**

- Professional sidebar navigation with expandable/collapsible functionality
- Active route highlighting
- Keyboard shortcut support (Ctrl/Cmd + B to toggle)
- Responsive mobile menu

### 2. **User Management** (`/admin/users`)

- **List Users**: Searchable, paginated table with user information
- **Create User**: Dialog form to add new users with email, name, display name, and department
- **Edit User**: Update user details (name, display name, department)
- **Manage Roles**: Assign/revoke roles with application context
- **Enable/Disable**: Toggle user active status
- **Delete User**: Remove users with confirmation dialog

**Features:**

- Search by email or name
- Pagination controls
- Role badges showing assigned roles
- Status indicators (Active/Inactive)
- Dropdown actions menu for each user

### 3. **Roles & Permissions** (`/admin/roles`)

- **List Roles**: Card-based view of all roles with permission counts
- **Create Role**: Add new roles with key, name, description, and level
- **Edit Role**: Update role details
- **Manage Permissions**: Assign/remove permissions organized by scope (system, app, entity)
- **Delete Role**: Remove roles with confirmation (system roles protected)
- **View Permissions**: Browse all permissions organized by scope

**Features:**

- Tabbed interface for roles and permissions
- System role protection
- Permission grouping by scope
- Search and filter capabilities
- Visual permission counts

### 4. **Audit Logs** (`/admin/audit`)

- **View Logs**: Comprehensive audit trail of authorization changes
- **Filter**: By action type, search term
- **Details View**: Expandable log details with full metadata
- **Export**: Export logs (placeholder for implementation)

**Features:**

- Timestamp with calendar icons
- Action type badges with color coding
- Actor and subject information
- Metadata preview with full details dialog
- Search and filter controls
- Adjustable results per page

## Component Structure

```
apps/frontend/src/app/admin/
├── layout.tsx          # Sidebar navigation layout
├── page.tsx            # Dashboard with section cards
├── users/
│   └── page.tsx        # User management
├── roles/
│   └── page.tsx        # Roles & permissions
└── audit/
    └── page.tsx        # Audit logs
```

## Key Components Used

### shadcn/ui Components

- `Sidebar`, `SidebarProvider`, `SidebarContent`, etc.
- `Dialog`, `DialogContent`, `DialogHeader`, etc.
- `AlertDialog` for confirmations
- `Table`, `TableHeader`, `TableBody`, etc.
- `Select`, `Input`, `Label`, `Textarea`
- `Badge` for status and role indicators
- `Button` with variants
- `Checkbox` for multi-select
- `ScrollArea` for long lists
- `Tabs` for organized content

### Icons (lucide-react)

- `Users`, `Shield`, `FileText`, `LayoutDashboard`
- `Plus`, `Edit`, `Trash2`, `MoreVertical`
- `Search`, `Filter`, `Eye`, `Calendar`, `Download`
- `Ban`, `CheckCircle`, `Lock`

## API Integration

### tRPC Admin Routes

- `admin.listUsers` - Get paginated users
- `admin.createUser` - Create new user
- `admin.updateUser` - Update user details
- `admin.assignRole` - Assign role to user (uses roleKey)
- `admin.revokeRole` - Remove role from user (uses roleKey)
- `admin.disableUser` - Disable user account
- `admin.enableUser` - Enable user account
- `admin.listRoles` - Get all roles
- `admin.createRole` - Create new role (requires key field)
- `admin.updateRole` - Update role (uses roleKey)
- `admin.deleteRole` - Delete role (uses roleKey)
- `admin.assignPermissionToRole` - Assign permission to role
- `admin.removePermissionFromRole` - Remove permission from role
- `admin.listPermissions` - Get all permissions
- `admin.getAuditLogs` - Get audit log entries

## Styling & Theme

- Uses CSS variables for theming (light/dark mode support)
- Consistent spacing with Tailwind utilities
- Professional color scheme with status colors
- Responsive design with mobile-first approach
- Accessible components with proper ARIA labels

## Best Practices

1. **Type Safety**: TypeScript types inferred from tRPC
2. **Error Handling**: Try/catch blocks with user feedback
3. **Loading States**: Skeleton loaders and pending states
4. **Confirmation Dialogs**: For destructive actions
5. **Search Debouncing**: Implement for better UX (TODO)
6. **Optimistic Updates**: Consider for better responsiveness (TODO)

## Future Enhancements

- [ ] Add bulk operations (assign roles to multiple users)
- [ ] Implement advanced filtering with date ranges
- [ ] Add CSV export for audit logs
- [ ] User detail page with full activity history
- [ ] Role templates for quick setup
- [ ] Permission presets (read-only, editor, admin)
- [ ] Real-time notifications for changes
- [ ] Advanced search with query builder

## Testing

Run the admin console:

```bash
pnpm --filter frontend dev
```

Navigate to `/admin` (requires `system:user.read` permission)

## Notes

- System roles cannot be edited or deleted
- Role keys cannot be changed after creation
- User emails cannot be changed after creation
- All operations are permission-gated
- Audit logs are automatically created for all changes
