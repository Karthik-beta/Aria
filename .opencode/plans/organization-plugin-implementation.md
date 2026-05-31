# Plan: Better Auth Organization Plugin Implementation

**Date:** 2026-05-08  
**Status:** Planning  
**Reference:** https://better-auth.com/docs/plugins/organization

---

## Objective

Implement the Better Auth organization plugin to enable app-scoped user access and permissions management across the Aria ERP monorepo. Each app (HRMS, CRM, Asset, Inventory) maps to a Better Auth Organization, allowing app-specific admins to manage their own users without custom authorization code.

## Key Decisions (Confirmed)

| Decision | Choice |
|---|---|
| Teams | Not in scope — base org only |
| Admin plugin coexistence | Keep existing admin plugin for global Super Admin CRUD; org plugin handles per-app membership |
| Invitation strategy | Server-side `auth.api.addMember()` only (no email invitations for on-prem) |
| Super Admin org membership | Auto-add Super Admin as `owner` in `afterCreateOrganization` hook |
| Custom implementation | **Not allowed** — all auth/authorization MUST use Better Auth stack |

## Architecture Model

```
┌──────────────────────────────────────────────────────────────────┐
│  Better Auth                                                      │
│  ┌─────────────────────┐  ┌────────────────────────────────────┐ │
│  │ Admin Plugin        │  │ Organization Plugin                │ │
│  │ (global user CRUD)  │  │ (per-app org memberships & roles)  │ │
│  │                     │  │                                    │ │
│  │ Roles:              │  │ Organizations:                     │ │
│  │ - super_admin       │  │ - aria-hrms    (slug: hrms)        │ │
│  │ - admin (global)    │  │ - aria-crm     (slug: crm)         │ │
│  │ - user (default)    │  │ - aria-asset   (slug: asset)       │ │
│  │                     │  │ - aria-inventory (slug: inventory) │ │
│  │                     │  │ - aria-admin   (slug: admin)       │ │
│  │                     │  │                                    │ │
│  │                     │  │ Org Roles:                         │ │
│  │                     │  │ - owner (auto: Super Admin)         │ │
│  │                     │  │ - admin (App-Specific Admin)        │ │
│  │                     │  │ - member (regular app user)         │ │
│  └─────────────────────┘  └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Hierarchy mapping:**
- **Super Admin** → Global `super_admin` role (admin plugin) + `owner` in all orgs (org plugin)
- **App-Specific Admin** → Global `user` role (admin plugin) + `admin` role in specific org (org plugin)
- **Regular User** → Global `user` role (admin plugin) + `member` role in specific org (org plugin)

## Phases

### Phase 1: Database Migration & Schema

#### 1.1 Add organization plugin tables to Prisma schema

File: `apps/backend/prisma/schema.prisma`

Following the [official schema docs](https://better-auth.com/docs/plugins/organization#schema):

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  logo      String?
  metadata  String?
  createdAt DateTime @default(now())

  members     Member[]
  invitations Invitation[]

  @@map("organizations")
}

model Member {
  id             String       @id @default(cuid())
  organizationId String
  userId         String
  role           String
  createdAt      DateTime     @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
  @@map("members")
}

model Invitation {
  id             String       @id @default(cuid())
  email          String
  organizationId String
  inviterId      String
  role           String?
  status         String       @default("pending")
  expiresAt      DateTime
  createdAt      DateTime     @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([email, organizationId])
  @@map("invitations")
}
```

**Session model additions** (existing `Session` model in schema.prisma):

```prisma
model Session {
  // ... existing fields ...
  activeOrganizationId String?   // ADD
  activeTeamId         String?   // ADD (future use)

  @@index([activeOrganizationId])  // ADD
}
```

#### 1.2 Run migration

```bash
bun --filter backend prisma db push
# OR
bun --filter backend prisma migrate dev --name add-organization-tables
```

#### 1.3 No changes to `packages/types` needed in Phase 1

Organization plugin types come directly from better-auth. Only add shared types in Phase 4 when frontend consumes them.

---

### Phase 2: Backend Auth Configuration

#### 2.1 Create permissions module

**New file:** `apps/backend/src/auth/permissions.ts`

Define org-level access control using `createAccessControl` from `better-auth/plugins/access`:

```typescript
import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

const statement = {
  ...defaultStatements,
  // App-specific resources can be added here in future
} as const;

export const ac = createAccessControl(statement);

export const orgOwner = ac.newRole({
  ...ownerAc.statements,
});

export const orgAdmin = ac.newRole({
  ...adminAc.statements,
});

export const orgMember = ac.newRole({
  ...memberAc.statements,
});
```

#### 2.2 Add organization plugin to auth config

**File:** `apps/backend/src/auth/auth.config.ts`

Key changes:
1. Import `organization` from `better-auth/plugins`
2. Add `organization()` plugin with config
3. Add super admin auto-membership hook
4. Restrict org creation to super admins only
5. Keep existing `admin()`, `username()`, `customSession()` plugins intact

```typescript
import { organization } from "better-auth/plugins";
import { ac, orgOwner, orgAdmin, orgMember } from "./permissions";

// Inside plugins array, ADD after admin plugin:
organization({
  ac,
  roles: {
    owner: orgOwner,
    admin: orgAdmin,
    member: orgMember,
  },
  allowUserToCreateOrganization: async (user) => {
    // Only super_admin can create app organizations
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    return dbUser?.role === "super_admin";
  },
  organizationHooks: {
    afterCreateOrganization: async ({ organization, member, user }) => {
      // Auto-add super_admin as owner
      const superAdmins = await prisma.user.findMany({
        where: { role: "super_admin" },
        select: { id: true },
      });
      for (const sa of superAdmins) {
        if (sa.id !== user.id) {
          await auth.api.addMember({
            body: {
              userId: sa.id,
              role: "owner",
              organizationId: organization.id,
            },
          });
        }
      }
    },
  },
}),
```

#### 2.3 Update `customSession` plugin to include organization info

In `auth.config.ts`, enrich the custom session with the active organization ID:

```typescript
customSession(async ({ user, session }) => {
  const [passwordState, activeOrg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { mustChangePassword: true, passwordChangedAt: true },
    }),
    prisma.session.findUnique({
      where: { id: session.id },
      select: { activeOrganizationId: true },
    }),
  ]);

  return {
    user: {
      ...user,
      mustChangePassword: passwordState?.mustChangePassword ?? false,
      passwordChangedAt: passwordState?.passwordChangedAt ?? null,
    },
    session: {
      ...session,
      activeOrganizationId: activeOrg?.activeOrganizationId ?? null,
    },
  };
}),
```

#### 2.4 Update default admin user creation

**File:** `apps/backend/src/auth/auth.service.ts`

After creating the default super admin, also create the 5 app organizations and add the super admin as owner to each:

```typescript
// After setting super_admin role, create default organizations:
const apps = [
  { name: "Aria HRMS", slug: "hrms" },
  { name: "Aria CRM", slug: "crm" },
  { name: "Aria Asset", slug: "asset" },
  { name: "Aria Inventory", slug: "inventory" },
  { name: "Aria Admin", slug: "admin" },
];

for (const app of apps) {
  const existing = await prisma.organization.findUnique({
    where: { slug: app.slug },
  });
  if (!existing) {
    await auth.api.createOrganization({
      body: { name: app.name, slug: app.slug, userId: createdUser.id },
    });
  }
}
```

#### 2.5 No changes needed in other backend modules

The tRPC `isAuthenticated` middleware continues to work. Organization-scoped authorization (Phase 4+) will layer on top.

---

### Phase 3: Frontend Auth Client & Types

#### 3.1 Add `organizationClient` plugin

**File:** `apps/frontend/src/lib/auth/client.ts`

```typescript
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    usernameClient(),
    customSessionClient(),
    adminClient(),
    organizationClient(),  // ADD
  ],
  fetchOptions: {
    credentials: "include",
  },
});
```

Export the organization-specific hooks/methods:

```typescript
export const {
  signIn, signOut, signUp, useSession,
  useListOrganizations,       // ADD
  useActiveOrganization,       // ADD
  organization,                // ADD
} = authClient;
```

#### 3.2 Update auth types

**File:** `apps/frontend/src/lib/auth/types.ts`

Add organization types:

```typescript
export interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string | Date;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  user?: AuthSessionUser;
  createdAt: string | Date;
}
```

Add `activeOrganizationId` to session types:

```typescript
export interface AuthSessionRecord {
  // ... existing fields ...
  activeOrganizationId?: string | null;  // ADD
}
```

#### 3.3 Update auth state provider

**File:** `apps/frontend/src/components/auth/auth-state-provider.tsx`

Add `activeOrganization` and `memberRole` to `AuthState`:

```typescript
export interface AuthState {
  session: AuthSessionData | null;
  role: string | null;
  isActive: boolean;
  activeOrganization: OrganizationData | null;   // ADD
  memberRole: string | null;                       // ADD
}
```

#### 3.4 Update server auth helpers

**File:** `apps/frontend/src/lib/auth/server.ts`

Enhance `getAuthorizationData()` and `requireProtectedAuthState()` to include organization context. The server layout can fetch the active organization and member role from the backend session.

#### 3.5 Update `useAuth` hook

**File:** `apps/frontend/src/hooks/use-auth.ts`

Add organization-related return values:
- `activeOrganization` — the currently selected organization
- `memberRole` — user's role in the active organization
- `isOrgAdmin(orgSlug)` — check if user is admin in a specific org slug
- `hasOrgPermission(resource, action)` — check org-scoped permissions

---

### Phase 4: UI — Super Admin Console

#### 4.1 Organization Management Dashboard

**New/modified page:** `apps/frontend/src/app/admin/organizations/page.tsx`

- List all organizations (HRMS, CRM, Asset, Inventory, Admin)
- Create new organization (super admin only)
- View organization details (name, slug, member count)
- Delete organization (with confirmation dialog, super admin only)

**Existing pages to update:**
- `apps/frontend/src/app/admin/page.tsx` — Add organization stats cards
- `apps/frontend/src/app/admin/users/page.tsx` — Add organization membership management

#### 4.2 Member Management UI

**New page:** `apps/frontend/src/app/admin/organizations/[slug]/page.tsx`

- List members of selected organization
- Add member to organization (via server-side `auth.api.addMember`)
- Remove member from organization
- Change member role (owner/admin/member)
- Show member's global role alongside org role

#### 4.3 Navigation updates

**File:** App sidebar component

Add organization switcher dropdown that calls `authClient.organization.setActive()` and `useActiveOrganization()`.

---

### Phase 5: App-Scoped Access Control

#### 5.1 Organization-aware layout guards

**Modified files:**
- `apps/frontend/src/app/asset/(protected)/layout.tsx`
- `apps/frontend/src/app/crm/(protected)/layout.tsx`
- `apps/frontend/src/app/hrms/(protected)/layout.tsx`
- `apps/frontend/src/app/inventory/(protected)/layout.tsx`

Each protected layout should:
1. Call `requireProtectedAuthState()` (existing)
2. Check if user has active membership in the corresponding organization
3. Redirect to `/<app>/access-denied` if not a member

#### 5.2 App-specific admin user management

**New pages** (one per app):
- `apps/frontend/src/app/hrms/(protected)/users/page.tsx`
- `apps/frontend/src/app/crm/(protected)/users/page.tsx`
- `apps/frontend/src/app/asset/(protected)/users/page.tsx`
- `apps/frontend/src/app/inventory/(protected)/users/page.tsx`

Each shows:
- Members of that app's organization (filtered by org slug)
- Add/remove member controls (visible only to org admin/owner)
- Role change controls (visible only to org admin/owner)

#### 5.3 Organization-scoped permission checks

**New component:** `apps/frontend/src/components/auth/organization-gate.tsx`

```tsx
<OrganizationGate orgSlug="inventory" requiredRole="admin">
  {/* Only rendered if user is admin of inventory org */}
</OrganizationGate>
```

Implements:
- Client-side: checks active organization and member role
- Server-side: redirects if insufficient permissions

---

### Phase 6: tRPC Middleware

#### 6.1 Organization-scoped tRPC middleware

**File:** `apps/backend/src/trpc/trpc.context.ts`

Add organization context to tRPC procedures:

```typescript
// New middleware: requireOrganizationMember(orgSlug, requiredRole?)
// Checks activeOrganizationId from session and resolves role
```

This layers on top of the existing `isAuthenticated` middleware.

#### 6.2 Apply to domain routers

After Phase 6.1, apply organization-scoped middleware to inventory, asset, CRM, HRMS routers incrementally as each app matures.

---

### Phase 7: Documentation & Testing

#### 7.1 Update Architecture Docs

**Files to update:**
- `docs/02-architecture/01-authentication/README.md` — Add organization plugin section
- `docs/02-architecture/02-authorization/README.md` — Replace flat role model with org-scoped model

#### 7.2 Tests

- **Unit tests:** New permission utilities in `apps/backend/src/auth/__tests__/`
- **Integration tests:** Organization CRUD via `auth.api.*` endpoints
- **E2E tests:** Super admin creates org → adds app admin → app admin manages members

---

## File Change Summary

### Backend (`apps/backend`)

| File | Action | Phase |
|---|---|---|
| `prisma/schema.prisma` | Add Organization, Member, Invitation models + Session fields | 1 |
| `src/auth/auth.config.ts` | Add organization() plugin, hooks, access control | 2 |
| `src/auth/permissions.ts` | **New** — Org access control definitions | 2 |
| `src/auth/auth.service.ts` | Create default organizations on startup | 2 |
| `src/trpc/trpc.context.ts` | Add organization middleware | 6 |

### Frontend (`apps/frontend`)

| File | Action | Phase |
|---|---|---|
| `src/lib/auth/client.ts` | Add organizationClient, export org hooks | 3 |
| `src/lib/auth/types.ts` | Add OrganizationData, OrganizationMember types | 3 |
| `src/lib/auth/server.ts` | Enhance with organization context | 3 |
| `src/components/auth/auth-state-provider.tsx` | Add org state to provider | 3 |
| `src/hooks/use-auth.ts` | Add org-related helpers | 3 |
| `src/components/auth/organization-gate.tsx` | **New** — Org-scoped UI gate | 5 |
| `src/app/admin/organizations/page.tsx` | **New** — Org management dashboard | 4 |
| `src/app/admin/organizations/[slug]/page.tsx` | **New** — Org member management | 4 |
| `src/app/admin/page.tsx` | Add org stats cards | 4 |
| `src/app/admin/users/page.tsx` | Add organization assignment controls | 4 |
| `src/app/*/(protected)/users/page.tsx` | **New** (4 files) — App-specific user mgmt | 5 |
| `src/app/*/(protected)/layout.tsx` | Add org membership checks (4 files) | 5 |
| Sidebar component | Add organization switcher | 4 |

### Documentation

| File | Action | Phase |
|---|---|---|
| `docs/02-architecture/01-authentication/README.md` | Add organization plugin | 7 |
| `docs/02-architecture/02-authorization/README.md` | Update for org-scoped model | 7 |

---

## Out of Scope

- **Teams** (sub-groups within organizations) — deferred
- **Email invitations** — server-side add only for on-prem
- **Dynamic roles** (organizationRole table) — deferred until needed
- **Organization-scoped data isolation** for existing domain entities (inventory items, assets, etc.) — Phase 6 lays foundation with middleware but full entity-level filtering is deferred

## Rollback Strategy

1. Keep the existing admin plugin-based flat role model fully functional
2. Add organization plugin as an additive layer
3. If issues arise, the org plugin config can be removed from the plugins array and the migration reversed with `prisma migrate reset` (dev) or a rollback migration (prod)
4. Frontend gates fall back gracefully — if `activeOrganization` is null, all apps remain accessible (backward compatible)
