# Authorization Specification — Aria ERP

Version: 1.0
Status: Draft
Owner: Platform Team
Target Release: Q4 FY25

Overview
- Goal: Add robust, standards-aligned authorization (RBAC + ABAC) on top of existing better-auth authentication.
- Scope: Backend (NestJS + Prisma), Frontend (Next.js + shadcn/ui), DevOps (env, migration, seeding), and Governance (process, audit, and testing).
- Out of scope: SSO/OIDC providers, fine-grained document-level encryption, and external policy engines (OPA/Cedar) for this phase.

Guiding Principles
- Use only official better-auth capabilities and documented integration points.
- Principle of least privilege by default; explicit elevation only via roles/permissions.
- Separation of duties between System Administrator and business Admin roles.
- App-scoped supervision: Managers/Supervisors are scoped per app.
- Auditable actions with tamper-evident logs for user/role/permission changes.

Role Model (Required)
- System Administrator (Super Admin)
  - Access: Full system administration without business data constraints.
  - Responsibilities: System configuration, integrations, security posture, user lifecycle (global), and all data/settings.
- Administrator (Admin)
  - Access: Administrative control within designated application domains (e.g., CRM) but not underlying infrastructure.
  - Responsibilities: Manage users, roles, and business configs per app.
- Manager / Supervisor
  - Access: Read/Write within their team’s scope and app; hierarchical visibility to reports.
  - Responsibilities: Approvals, team reports, assignments; app-scoped user creation limited to that app.
- User / Employee (Standard User)
  - Access: Own data access; CRUD restricted to records they own/are assigned.
  - Responsibilities: Operate on job-relevant records (leads, tickets, timesheets, etc.).
- Viewer (Read-Only)
  - Access: Read-only access; no create/update/delete.
  - Responsibilities: Executive/finance-style read access across permitted scopes.

Authorization Model
- RBAC baseline with app-scoped roles; optional ABAC filters for team/ownership constraints.
- Multi-tenant aware (future-proofing), but single-tenant by default in this phase.
- Permission taxonomy
  - System: system:*
  - App: app:{appKey}:*
  - Entity: entity:{appKey}:{entity}:{action}
  - Examples: system:user.manage, app:crm:config.update, entity:crm:lead.read, entity:hr:leave.approve
- Scope hierarchy
  - System → App → Entity → Record (ownership/team). Lower scopes cannot override higher-level explicit denies.
- Ownership & team scoping
  - Record ownership via created_by/owner_id
  - Team linkage via team_id/manager_id mappings

Data Model (Prisma)
- Tables (new)
  - roles (id, key, name, description, level, is_system, created_at, updated_at)
  - permissions (id, key, name, description, created_at, updated_at)
  - role_permissions (role_id, permission_id) PK(role_id, permission_id)
  - user_roles (user_id, role_id, app_key NULLABLE for system-global vs app-scoped, assigned_by, created_at)
  - apps (app_key PK, name, description, is_active)
  - app_supervisors (id, app_key FK→apps, supervisor_user_id FK→users, created_by, created_at)
  - teams (id, app_key, name, manager_user_id, created_at)
  - team_members (team_id, user_id, created_at)
- Extensions (existing users)
  - users: add is_active (bool), display_name, and optional department, manager_id
- Indices/Constraints
  - UNIQUE(roles.key), UNIQUE(permissions.key)
  - UNIQUE(user_roles.user_id, role_id, app_key)
  - FOREIGN KEYS across all relations with ON DELETE RESTRICT for security

Role Definitions (initial seed)
- super_admin
  - Grants: system:* (full), app:*:*, entity:*:*:*
- admin
  - Grants: app:{appKey}:*, entity:{appKey}:*:* within assigned app(s)
- manager
  - Grants: entity:{appKey}:*:* within team scope
  - Special: can create users limited to appKey they supervise
- user
  - Grants: entity:{appKey}:*:read, entity:{appKey}:*:create/update limited to ownership
- viewer
  - Grants: entity:{appKey}:*:read only

Policy Evaluation
- Source of truth
  - better-auth session.user contains user id and attached role keys and app scopes (via session enrichment).
  - DB-driven policy resolution on each request; cache with short TTL (e.g., 60s) keyed by session id + version.
- Check order
  1) Account active (users.is_active)
  2) System-wide denies (future use)
  3) Role -> permissions resolution (RBAC)
  4) Scope guards (app_key match, team ownership, record ownership)
  5) Field-level filters (optional; out of scope for v1)
- App-scoped Supervisor Creation Rule
  - Only users with manager role and matching app_supervisors entry for the target app can create users.

Backend Architecture (NestJS)
- Modules
  - AuthorizationModule: services (PolicyService, RoleService, PermissionService, ScopeService), guards, and decorators
  - UserAdminModule: admin endpoints for user lifecycle
- Guards & Decorators
  - @RequirePermissions(...keys) — entity/app/system permissions
  - @RequireRole(...roles) — specific roles
  - @AppScope(appKey) — enforce endpoint app context
  - Guards chain: AuthGuard (better-auth) → ActiveUserGuard → AppScopeGuard → RolePermissionGuard → OwnershipGuard
- Services
  - PolicyService
    - resolveUserPolicy(userId, appKey): roles, permissions, scopes
    - can(userId, permissionKey, ctx) returns boolean + reason
  - RoleService / PermissionService
    - CRUD for roles/permissions; seed and sync helpers
  - ScopeService
    - ownership/team checks; supervisor capability checks
- TRPC/HTTP Endpoints (examples)
  - POST /admin/users (Create user; constraints: manager+supervisor of app)
  - PATCH /admin/users/:id (Edit; admin or manager-in-scope)
  - POST /admin/users/:id/disable (Disable; admin in app or super_admin)
  - DELETE /admin/users/:id (Delete; admin in app or super_admin)
  - GET /admin/roles, GET /admin/permissions
  - POST /admin/roles, POST /admin/permissions (System/Admin only)
  - POST /apps/:appKey/supervisors — manage supervisor assignments (super_admin, admin(app))

Session Enrichment (better-auth)
- On sign-in, enrich session with:
  - user: { id, username, email, displayName, isActive }
  - roles: [roleKey]
  - apps: { [appKey]: { roles: [roleKey], teams: [teamId] } }
- Use official better-auth session extensions pattern (documented hooks) to attach custom claims to session data and keep cookies httpOnly.

Frontend Requirements (Next.js + shadcn)
- Admin Dashboard (new)
  - Users Management
    - List, search, filter by app, team, role, status
    - Create (scoped by app; only for managers supervising that app), Edit, Disable/Enable, Delete
    - Assign roles per app; view audit trail for changes
  - Roles & Permissions
    - View default roles; create custom roles (admin+)
    - Assign permissions to roles (with presets per app)
  - Supervisors
    - Assign/unassign app supervisors; visible badge on manager profiles
- UI/UX
  - Use existing theme, typography, spacing
  - Components: DataTable, Dialog, Drawer, Form, Badge, Tabs, Breadcrumb, AlertDialog, DropdownMenu, Toast
  - Accessibility: keyboard navigation, ARIA roles, focus states
- Client AuthZ
  - Hide/disable actions based on session-enriched roles/permissions
  - Optimistic UI with server reconciliation; do not trust client for enforcement

Audit & Logging
- Audit events
  - user.created, user.updated, user.disabled, user.deleted
  - role.assigned, role.revoked, supervisor.assigned, supervisor.revoked
- Storage
  - audit_logs (id, actor_user_id, action, subject_type, subject_id, app_key, metadata JSONB, created_at)
- Practices
  - Write once, append-only; no updates to audit rows
  - Correlate request id and session id

Security & Compliance
- Cookie & session: continue better-auth secure cookie guidance (SameSite=None, Secure in production)
- Authorization decisions server-side only
- Default deny for unrecognized permissions
- Rate-limit sensitive endpoints; CSRF protection on state-changing requests
- Secrets managed via env and never logged; rotate on compromise

Migrations & Seeding
- Add Prisma schema for new tables and fields
- Seed script to create roles, permissions, default supervisors (optional), and map super_admin to DEFAULT_ADMIN user
- Idempotent seeding; safe re-run in CI/CD

DevOps & Configuration
- Env additions
  - AUTH_CACHE_TTL=60
  - AUTH_DEFAULT_ROLES=super_admin,admin,manager,user,viewer
- Docker
  - Include migrations and seed step in entrypoint
  - Health checks for authz readiness

Testing Strategy
- Unit tests
  - PolicyService.can() permutation matrix across roles, apps, teams, ownership
- Integration tests
  - End-to-end user creation by manager with correct app supervision
  - Admin disable/delete workflows; audit trail verification
- UI tests (Playwright)
  - Role-gated control visibility; disable state for unauthorized actions

Risks & Mitigations
- Policy drift: centralize keys; generate types from permission registry
- Performance: cache policy resolution with TTL; index foreign keys
- Over-privilege: default deny; continuous review of grants

Deliverables
- Backend AuthorizationModule with guards, services, prisma migrations, seeds
- Frontend Admin Dashboard with user/role/supervisor management using shadcn components
- Documentation: AUTHORIZATION.md (this spec), API reference for admin endpoints, runbooks

References (official)
- better-auth — adapters/prisma, plugins/username, session, and official NestJS integration docs
- NestJS — Guards, Custom Decorators, Modules best practices
- Prisma — Relational schema, migrations, seed workflows
