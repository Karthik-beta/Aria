# Authorization

## Overview

Aria uses a **flat role model** provided by better-auth's admin plugin. There are no permission strings, no per-app access maps, and no team hierarchies. Every user has exactly one role stored in the `users.role` field.

**Roles:**
- `super_admin` — Full system access; default admin created on first startup
- `admin` — Administrative control per app domain
- `manager` — Manager-level access within scope
- `user` — Standard employee access
- `viewer` — Read-only access

## Architecture

### Authorization Flow

Protected frontend layouts resolve auth on the server and hydrate a single snapshot into client components:

1. A protected layout calls `requireProtectedAuthState()` from `apps/frontend/src/lib/auth/server.ts`
2. The server helper fetches the better-auth session and returns `{ session, role, isActive }` directly — no separate authorization tRPC call
3. The layout wraps client components in `AuthStateProvider`
4. `useAuth()` and `protected-content.tsx` read the hydrated state for UI gating only. The backend tRPC `isAuthenticated` middleware remains the source of truth for API access.

### Session Enrichment

The better-auth custom session plugin enriches the session with `mustChangePassword` and `passwordChangedAt`. The user's role comes from the `users.role` field resolved by better-auth's admin plugin — not from a separate authorization fetch.

## Database Schema

The authorization system extends the users table with a single `role` field. No separate tables for roles, permissions, user_roles, apps, app_supervisors, teams, team_members, or audit_logs exist.

```
users
  id            UUID (PK)
  email         string (unique)
  username      string (unique, optional)
  name          string
  role          string  ← flat role: super_admin | admin | manager | user | viewer
  isActive      boolean
  banned        boolean
  banReason     string?
  banExpires    DateTime?
  ...
```

## Frontend Integration

### Client-Side Hook

`src/hooks/use-auth.ts` reads from the server-hydrated auth context:

```typescript
const { isAuthenticated, isActive, user, role, hasRole, hasAnyRole, isLoading } = useAuth();

// hasRole("admin")         → true if role === "admin"
// hasAnyRole("admin", "super_admin")  → true if role is in the given list
```

### UI Gates (`src/components/auth/protected-content.tsx`)

Only two gates remain:

- **`RoleGate`** — Renders children only when the user's role matches. Accepts `role` (string or string[]), `requireAll` (boolean, default false), and optional `fallback`.
- **`AuthGate`** — Renders children only when the user is authenticated and active.

No `PermissionGate` or `AppGate` exists. All authenticated users can access all apps.

### Server-Side Auth

`requireProtectedAuthState()` in `src/lib/auth/server.ts` returns:

```typescript
{ session: AuthSessionData | null, role: string | null, isActive: boolean }
```

No per-app or per-entity server-side gate is applied. tRPC procedures rely on `isAuthenticated` middleware.

## Security Considerations

- **Default Deny** — All tRPC procedures require authentication unless explicitly marked public
- **Role Hierarchy** — better-auth admin plugin enforces role resolution from the users table
- **Session Security** — better-auth handles cookie security, secure flags, and session expiry
- **No Client-Side Enforcement** — UI gates are UX-only; backend tRPC middleware is the enforcement point