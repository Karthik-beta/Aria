# Authorization

## Overview

Aria uses **Better Auth's admin plugin** for global role-based user management and **Better Auth's organization plugin** for app-scoped membership and permissions. No custom authorization logic is implemented — all access control is delegated to Better Auth's official plugins.

**Global Roles (admin plugin):**
- `super_admin` — Full system access; default admin created on first startup
- `admin` — Administrative control globally
- `user` — Standard user (default)

**Organization Roles (org plugin):**
- `owner` — Full control over the organization
- `admin` — Administrative control within the organization
- `member` — Standard member access

**App ↔ Organization mapping:**
- HRMS → org slug `hrms`
- CRM → org slug `crm`
- Asset → org slug `asset`
- Inventory → org slug `inventory`
- Admin Console → org slug `admin`

## Architecture

### Authorization Flow

Protected frontend layouts resolve auth on the server and hydrate a single snapshot into client components:

1. A protected layout calls `requireProtectedAuthState()` from `apps/frontend/src/lib/auth/server.ts`
2. The server helper fetches the better-auth session and returns `{ session, role, isActive, activeOrganization, memberRole }` — no separate authorization tRPC call
3. The layout wraps client components in `AuthStateProvider`
4. `OrganizationGate` optionally wraps children to enforce org membership at the UI level
5. `useAuth()` and `protected-content.tsx` read the hydrated state for UI gating only. The backend tRPC `isAuthenticated` middleware and `orgProcedure()` middleware remain the source of truth for API access.

### Session Enrichment

The better-auth custom session plugin enriches the session with `mustChangePassword`, `passwordChangedAt`, and `activeOrganizationId`. The user's role comes from the `users.role` field resolved by better-auth's admin plugin. Organization membership is managed by the organization plugin's `members` table.

## Database Schema

The authorization system uses:
- `users.role` — flat global role (admin plugin)
- `organizations` — app workspaces
- `members` — user membership in organizations with role
- `sessions.activeOrganizationId` — currently active org

No custom tables for roles, permissions, or user_roles exist — everything is handled by Better Auth's official plugins.

## Organization-scoped tRPC Middleware

Backend procedures can require organization membership using `orgProcedure()`:

```typescript
// Requires any membership in the inventory org
const inventoryProcedure = orgProcedure("inventory");

// Requires admin or owner role in inventory org
const inventoryAdminProcedure = orgProcedure("inventory", ["admin", "owner"]);
```

The middleware looks up the organization by slug, verifies the user is a member, and optionally checks the member role. It throws `TRPCError(FORBIDDEN)` if checks fail.

## Frontend Integration

### Client-Side Hook

`src/hooks/use-auth.ts` reads from the server-hydrated auth context:

```typescript
const {
  isAuthenticated, isActive, user, role,
  hasRole, hasAnyRole, isLoading,
  activeOrganization, memberRole,
  isOrgAdmin, isOrgOwner, hasOrgAccess,
} = useAuth();
```

### UI Gates

- **`RoleGate`** — Renders children only when user's global role matches
- **`AuthGate`** — Renders children only when authenticated and active
- **`OrganizationGate`** — Renders children only when user is a member of the specified organization (by slug)

### OrganizationGate Usage

```tsx
<OrganizationGate orgSlug="inventory" requiredRole="admin">
  <AdminPanel />
</OrganizationGate>
```

## Security Considerations

- **Default Deny** — All tRPC procedures require authentication unless explicitly marked public
- **Organization Isolation** — `orgProcedure()` enforces membership and role checks at the API level
- **No Client-Side Enforcement** — UI gates are UX-only; backend tRPC middleware is the enforcement point
- **Super Admin Exemption** — Super admins retain global access via the admin plugin; org plugins handles per-app scoping