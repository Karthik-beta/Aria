# Admin Console Guide

The Admin Console provides a professional interface for managing users via the better-auth admin plugin. All operations are role-gated and require admin privileges.

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
 - **Ban/Unban**: Disable/enable user account
- **Delete User**: Remove users with confirmation dialog

**Features:**

- Search by email or name
- Pagination controls
- Role badges showing assigned roles
- Status indicators (Active/Inactive)
- Dropdown actions menu for each user

## Component Structure

```
apps/frontend/src/app/admin/
├── layout.tsx          # Sidebar navigation layout
├── page.tsx            # Dashboard with section cards
├── users/
│   └── page.tsx        # User management
 ├── roles/          # (deprecated - roles managed via better-auth)
│   └── page.tsx        # Roles & permissions
 └── audit/          # (deprecated - audit via better-auth)
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

### better-auth Admin Plugin Routes

The frontend uses the better-auth admin plugin client (`authClient.admin`) which provides these operations:

- `listUsers` - Get paginated users with search and filtering
- `createUser` - Create new user (with email, password, name, role)
- `updateUser` - Update user details (name, display name, department)
- `setRole` - Assign role to user
- `banUser` / `unbanUser` - Disable/enable user account
- `removeUser` - Delete user account
- `revokeUserSessions` - Revoke all sessions for a user
- `impersonateUser` / `stopImpersonating` - Admin impersonation (if configured)

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

- [ ] Add bulk operations (enable/disable multiple users)
- [ ] Implement advanced filtering with date ranges
- [ ] User detail page with session management
- [ ] Export user data to CSV
- [ ] Real-time notifications for changes
- [ ] Advanced search with query builder

## Testing

Run the admin console:

```bash
bun --filter frontend dev
```

Navigate to `/admin` (requires admin or super_admin role)

## Notes

- User emails cannot be changed after creation (better-auth limitation)
- All operations are role-gated (require admin or super_admin role)
- Password reset emails are sent via Resend (if configured)
- Default admin user is created on startup via environment variables
