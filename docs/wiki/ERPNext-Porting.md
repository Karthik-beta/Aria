# ERPNext Porting

Aria's core business features are ported from [ERPNext](https://github.com/frappe/erpnext), the open-source ERP built by Frappe Technologies on the Frappe framework. ERPNext is the **source of truth for business rules**: how a depreciation schedule is calculated, which fields a Delivery Note carries, how a report aggregates stock. Aria re-implements those rules in TypeScript; it does not run Frappe or share ERPNext's database.

## Credit and licensing

- ERPNext is © Frappe Technologies and licensed under the [GNU GPL v3](https://github.com/frappe/erpnext/blob/develop/license.txt).
- Aria is licensed under the [GNU AGPL v3 or later](https://github.com/Karthik-beta/Aria/blob/master/LICENSE). GPLv3 section 13 allows GPLv3 work to be combined with AGPLv3 work, and AGPL keeps the source available to users of hosted instances.
- Keep the credit visible: when a service, engine or test is a port, say so in its header comment and link the ERPNext source or documentation page.

## How a DocType maps to Aria

| ERPNext | Aria |
|---|---|
| DocType JSON (fields, child tables) | Prisma model plus `*Item` child models in `apps/backend/prisma/schema.prisma` |
| Field validation | Zod schema in `@aria/types` |
| Python controller (`validate`, `on_submit`, `on_cancel`) | Service in `apps/backend/src/apps/<domain>/` |
| Whitelisted methods and list/report APIs | tRPC procedures in `apps/backend/src/trpc/routers/` |
| Desk form and list views | Next.js pages under `apps/frontend/src/app/<module>/` |
| Script and query reports | Report builders in the module's `reports/` folder |
| Naming series | Shared `DocumentSeriesCounter` |
| Scheduled jobs | BullMQ queues |
| Python unit tests | Vitest specs, ideally reusing ERPNext's fixtures and expected values |

## Porting a feature

1. **Open an issue** with the `erpnext-port` label and the module label. Link the ERPNext DocType, controller and docs page, and note the ERPNext version (for example `v15.123.1`) you are reading.
2. **Read upstream at a pinned version.** Run `./scripts/vendor-repos.sh` to get the git-ignored, sparse `.erpnext/` checkout; see [VENDORED_REPOS.md](../../VENDORED_REPOS.md). The pinned commit is `ERPNEXT_REF` in `scripts/vendor-repos.sh` (also recorded in `VENDORED_REPOS.md`).
3. **Port the rules, not the framework.** Carry over validations, calculations and state transitions. Replace Frappe-specific mechanisms (hooks, `frappe.db` calls, permission queries) with Aria's services, Prisma and RBAC.
4. **Port the tests.** Reproduce ERPNext's test cases and expected numbers so parity is checked, not assumed. The depreciation engine's spec does this for straight-line, double-declining and WDV schedules.
5. **Record deliberate differences** in the PR description and the module's gap analysis. Set the issue's **ERPNext Parity** field on the [project board](Project-Board) to `At parity`, `Partial` or `Diverged by design`.

## Keeping up with upstream

The **ERPNext Upstream Watch** workflow runs every Monday and opens an `upstream-sync` issue listing ERPNext releases published that week, with a checklist of the modules Aria ports. Review the release notes, open `erpnext-port` issues for fixes worth carrying over, then close the digest.
