# Authorization

This document provides a comprehensive overview of the Aria ERP authorization system, which uses a hybrid Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) model.

## Overview

The authorization system provides:

- Hierarchical roles with privilege levels
- Fine-grained permissions with wildcard support
- App-scoped access control
- Team-based authorization with manager hierarchies
- A supervisor model for delegated user creation
- Comprehensive audit logging
- Policy caching for performance
- Server-hydrated authorization snapshots for client-side UI gating

## Architecture

### Authorization Flow

Protected frontend layouts resolve authorization on the server and hydrate one snapshot into client components.

1. A protected layout calls `requireProtectedAuthState()` from `apps/frontend/src/lib/auth/server.ts`.
2. The server helper fetches the Better Auth session and, when a session exists, requests `authorization.getUserAuthorization` from the backend.
3. The backend authorization router resolves roles, permissions, app access, supervised apps, and active status from the database.
4. The layout wraps client components in `AuthStateProvider`.
5. `useAuth()` and `protected-content.tsx` read the hydrated state for UI gating only. The backend remains the source of truth.

### Service Layer

The backend's authorization logic is encapsulated in a set of services:

- **`PolicyService`**: The core RBAC+ABAC evaluation engine.
- **`RoleService`**: CRUD operations for roles.
- **`PermissionService`**: CRUD operations for permissions.
- **`ScopeService`**: Ownership, team membership, and supervisor checks.
- **`AuditService`**: Tamper-evident logging for all authorization changes.

## Database Schema

The authorization system adds several tables to the database:

- **`roles`**: Role definitions with hierarchy levels.
- **`permissions`**: Fine-grained permission definitions.
- **`role_permissions`**: A many-to-many mapping between roles and permissions.
- **`user_roles`**: User role assignments, with optional app scoping.
- **`apps`**: Application definitions.
- **`app_supervisors`**: Manager supervision per app.
- **`teams`**: Team definitions with managers.
- **`team_members`**: Team membership.
- **`audit_logs`**: Tamper-evident authorization change logging.

The `users` table is also extended with `isActive`, `displayName`, `department`, and `managerId` fields.

## Backend Implementation

### Session Enrichment

The Better Auth custom session plugin only enriches the session with password-state metadata (`mustChangePassword`, `passwordChangedAt`). Roles, permissions, app access, and supervisor scope are resolved separately through the authorization router and should not be assumed to live on the session payload.

### tRPC Endpoints

The `src/trpc/routers/admin.router.ts` file defines tRPC endpoints for managing users, roles, permissions, supervisors, and audit logs.

## Frontend Integration

### Client-Side Hooks

The `src/components/auth/auth-state-provider.tsx` file provides the server-resolved session and authorization state to client components.

The `src/hooks/use-auth.ts` file reads from that hydrated state and gives components access to role, permission, and app helpers.

### UI Components

The `src/components/auth/protected-content.tsx` file provides several components for controlling access to UI elements based on the hydrated auth snapshot:

- **`PermissionGate`**: Renders its children only if the user has a specific permission.
- **`RoleGate`**: Renders its children only if the user has a specific role.
- **`AppGate`**: Renders its children only if the user has access to a specific app.
- **`AuthGate`**: Renders its children only if the user is authenticated.

These gates are for UX only; server-side checks still enforce access.

### Server-Side App Access Gate

App-level access is enforced server-side via `requireAppAccess(appKey)` in `src/lib/auth/app-access.ts`. This function:

1. Calls `requireProtectedAuthState()` to fetch the authorization snapshot.
2. Calls `authorizationCanAccessApp(authorization, appKey)` to check if the user has access.
3. Redirects to `/{appKey}/access-denied` if access is denied.

The app layouts use a **route group** (`(protected)/`) to separate protected routes from the access-denied page:

```
app/<appKey>/
  layout.tsx               ← bare pass-through (no auth check)
  (protected)/             ← route group (not in URL)
    layout.tsx            ← requireAppAccess + sidebar/header shell
    dashboard/page.tsx     ← protected
    ...other protected routes
  access-denied/           ← OUTSIDE (protected); renders without app access
    page.tsx
```

**Why route groups?** Without them, `/{app}/access-denied` would be a child of `/{app}/layout.tsx`, which calls `requireAppAccess` first — causing an infinite redirect loop. Route groups create a separate layout subtree for access-denied pages.

The two-layer defense:
- **Server layer** (`requireAppAccess`): blocks unauthorized access before any render
- **Client layer** (`AppGate`): provides defense-in-depth for client-side navigation edge cases

## API Reference

### Permission Key Format

Permissions are defined with the following format:

```
system:<resource>.<action>
app:<appKey>:<resource>.<action>
entity:<appKey>:<entity>.<action>
```

Wildcard matching is supported.

## Security Considerations

- **Default Deny**: All routes require authentication unless explicitly marked as public.
- **Principle of Least Privilege**: Users start with minimal permissions.
- **Separation of Duties**: Different roles for system administrators, business administrators, and managers.
- **Audit Trail**: All authorization changes are logged.
- **Cache Security**: The policy cache expires after 60 seconds and is invalidated on authorization changes.
- **Session Security**: better-auth handles cookie security.
- **Input Validation**: Permission keys are validated with regex patterns.
