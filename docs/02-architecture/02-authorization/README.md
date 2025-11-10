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
- Session enrichment for client-side authorization

## Architecture

### Authorization Flow

The authorization flow is a server-side proxy pattern that securely fetches user authorization data while respecting Better Auth's httpOnly cookie security model.

1.  A React component calls the `useAuth` hook.
2.  The `useAuth` hook fetches the user's authorization data from a Next.js API route.
3.  The API route forwards the request to the backend tRPC router, including the httpOnly session cookie.
4.  The tRPC router authenticates the user, queries the database for roles and permissions, and returns the authorization data.
5.  The `useAuth` hook stores the authorization data in its state, making it available to the component.

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

The `session` object from better-auth is enriched with the user's roles, permissions, and app access information. This is done in `src/auth/auth.config.ts`.

### tRPC Endpoints

The `src/trpc/routers/admin.router.ts` file defines tRPC endpoints for managing users, roles, permissions, supervisors, and audit logs.

## Frontend Integration

### Client-Side Hooks

The `src/hooks/use-auth.ts` file provides a `useAuth` hook that gives components access to the user's authorization data.

### UI Components

The `src/components/auth/protected-content.tsx` file provides several components for controlling access to UI elements based on the user's roles and permissions:

- **`PermissionGate`**: Renders its children only if the user has a specific permission.
- **`RoleGate`**: Renders its children only if the user has a specific role.
- **`AppGate`**: Renders its children only if the user has access to a specific app.
- **`AuthGate`**: Renders its children only if the user is authenticated.

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
