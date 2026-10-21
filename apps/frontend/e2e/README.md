# Frontend E2E (Playwright)

The specs run against the real backend and a real Postgres database, except the
older asset report/dashboard specs, which mock tRPC.

## Prerequisites

- Postgres and Redis running, migrations applied:
  `cd apps/backend && bun run db:migrate:deploy`
- `DATABASE_URL` and `REDIS_URL` exported for the backend, for example
  `postgresql://postgres:postgres@localhost:5432/aria?schema=public` and
  `redis://localhost:6379`.
- Workspace packages built: `bun x turbo run build --filter='backend^...' --filter='frontend^...'`
- A Chromium for Playwright (`bun x playwright install chromium`).

`playwright.config.ts` builds and starts the backend (port 3001) and the
frontend dev server (port 3000), and reuses servers that already run when not
in CI.

## Running

```bash
bun --filter frontend test:e2e                      # everything
bun --filter frontend test:e2e -- asset-            # the asset specs
bun --filter frontend test:e2e -- --workers=1 asset-
```

## Auth projects

| Project | What it does |
|---|---|
| `setup` (`auth.setup.ts`) | Signs in as the seeded super admin, creates the `asset` organization if missing, makes it active, saves `playwright/.auth/admin.json`. |
| `setup-member` (`member.setup.ts`) | Creates the member user, invites it to the organization with the `member` role, accepts the invitation, sets the organization active, saves `playwright/.auth/member.json`. Idempotent. |
| `chromium` | All specs except `*member-readonly*`, as the super admin. |
| `chromium-member` | `asset-member-readonly.spec.ts`, as the member. |

The organization slug is `asset` because the asset workspace only admits
non-super-admins who belong to the organization with that slug.

## Environment variables (all optional)

| Variable | Default |
|---|---|
| `E2E_BACKEND_URL` | `http://localhost:3001` |
| `E2E_ADMIN_USERNAME` / `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | `e2eadmin` / `e2e-admin@aria.test` / `E2e-Admin-Pass-123` |
| `E2E_MEMBER_NAME` / `E2E_MEMBER_EMAIL` / `E2E_MEMBER_PASSWORD` | `E2E Member` / `e2e-member@aria.test` / `E2e-Member-Pass-123` |
| `E2E_ORGANIZATION_NAME` / `E2E_ORGANIZATION_SLUG` | `Asset` / `asset` |
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3000` |

## Writing real-backend asset specs

- Use `asset-fixtures.ts` to create prerequisite data through the tRPC HTTP
  endpoints, name everything with `runId()` / `uniqueName()`, and call
  `cleanupRun(api, RUN)` in `afterAll`.
- Use `asset-ui.ts` for row, toast and delete-dialog helpers, and wait on the
  mutation with `submitAndWait` instead of timers.
