# Asset Management Gap Remediation: Independent Audit and Readiness Plan

> Branch: `feat/asset-gap-remediation`
>
> Comparison base: `master`
>
> Business-logic reference: `.erpnext/erpnext/assets`
>
> UI/UX reference: established Aria application patterns
>
> Audit date: 2026-08-09

## Executive verdict

The branch is **not merge-ready at the audit baseline**. It contains useful schema,
route, calculation, report, and workflow scaffolding, but several committed claims
are not supported by the implementation:

- the Prisma schema additions have no deployable migration;
- disposal, repair, capitalization, and CWIP operations change document or asset
  status without the stock, finance-book, schedule, or accounting effects claimed
  by the UI and prior report;
- movement submission and cancellation do not preserve ERPNext's chronological and
  current-state invariants;
- the Fixed Asset Register counts projected schedule rows as posted depreciation;
- the WDV change imposes a 5% salvage floor that does not exist in ERPNext;
- the new screens cannot collect the data required by their backend contracts, and
  two completed-looking components are not connected to any route;
- the new workflows have no deterministic demo coverage and their Playwright specs
  are page-opening smoke checks rather than lifecycle tests.

The remediation must keep an important architectural boundary explicit: Aria does
not currently contain a shared chart-of-accounts or general-ledger subsystem.
`Account` is an authentication-provider model, while existing depreciation and
revaluation postings use asset-domain journal tables with string account labels.
This branch can therefore implement balanced, reversible **asset accounting
subledger entries** and submitted stock documents, but it must not describe those
records as a statutory general ledger or claim ERPNext-wide accounting parity.

## Audit scope and branch inventory

The audit reviewed the ten pre-branch Asset Management feature pages across all
three navigation groups:

| Navigation group | Pre-branch pages reviewed |
| --- | --- |
| Assets | Assets, Asset Categories, Asset Locations |
| Maintenance | Asset Maintenance, Maintenance Teams, Maintenance Logs, Asset Value Adjustments |
| Reports | Depreciation Ledger, Depreciation and Balances, Asset Activity |

The branch adds four operational surfaces: Asset Movements, Asset Repairs, Asset
Capitalizations, and Fixed Asset Register. Current navigation therefore exposes 14
index/report features. The protected route tree contains 25 `page.tsx` components
when forms, details, redirects, dashboard, profile, and users are included.

The branch was audited as ten commits over `master`, including the prior report,
schema/types, depreciation math, lifecycle backend, schedulers/report, frontend,
E2E smoke tests, canonical route moves, and formatting. The baseline diff contains
91 changed paths and no Prisma migration.

## Verification of the previous report

### Verified findings

| Previous finding | Verification |
| --- | --- |
| Movement, repair, capitalization, and Fixed Asset Register were absent before this branch. | Verified from `master` and the branch commit history. The branch now adds models/routes, but the workflows remain partial as detailed below. |
| Shift-based straight-line depreciation omitted normalization by the sum of shift factors. | Verified against `.erpnext/erpnext/assets/doctype/asset_depreciation_schedule/depreciation_methods.py`. The branch's denominator fix in `depreciation-schedule-engine.ts` is correct for the non-daily path and has a focused unit fixture. |
| Document-series allocation required an atomic increment. | Verified. The branch's transaction-scoped counter update is a sound correction. |
| Asset value adjustments required a purchase-date guard. | Verified against ERPNext. The branch has added the guard; the old report is stale where it still calls the check missing. |
| Asset lifecycle activity needs actor attribution. | Verified as an audit requirement, but the public contracts currently accept a spoofable `userId`; the authenticated actor must be derived server-side. |

### Incorrect findings

| Previous claim | Evidence and correction |
| --- | --- |
| ERPNext requires a positive WDV salvage value or applies a 5% floor. | Incorrect. `.erpnext/erpnext/assets/doctype/asset/asset.py:1014-1039` derives the rate from the supplied value; zero salvage produces a 100% rate. The new floor in `depreciation-schedule-engine.ts` and `asset-value-adjustment.utils.ts` must be removed. |
| The Fixed Asset Register and three scheduled jobs remain missing. | Stale. They exist on the branch, but the register and CWIP implementation are not accounting-correct. |
| Disposal, repair, and capitalization now post GL and stock entries. | Incorrect. `asset.service.ts` only records lifecycle/status/value changes. No shared GL exists, no asset subledger entry is created, and no submitted material-issue stock document is linked. |
| The new E2E files exercise complete workflows. | Incorrect. They open routes/dialogs and make visibility assertions without creating, submitting, cancelling, or verifying persisted effects. |
| Every public method/export requires new TSDoc and all UI side effects require custom hooks. | Not an established Aria requirement. Apply existing local patterns and useful documentation; do not introduce ceremony unrelated to correctness. |

### Partially correct findings

| Finding | Current assessment |
| --- | --- |
| Movement, repair, capitalization, and disposal were missing. | The branch adds models, contracts, service methods, and some screens. It does not yet implement the required invariants or accounting/stock/schedule effects. |
| Asset Activity was partial. | New actions add activity records, but actor trust, organization/company scope, and full lifecycle coverage remain incomplete. |
| Depreciation and Balances used incomplete data. | Some branch changes improve values, but report correctness still depends on posted-entry filtering and honest asset-subledger semantics. |
| Maintenance/CWIP scheduled work was missing. | Maintenance status and log status jobs exist. The repair state machine makes the first unreachable, while CWIP directly mutates assets without qualified discovery, a queue worker, accounting entry, or idempotency marker. |

## Independent findings

Severity uses P0 for deployment/data-integrity blockers, P1 for materially incorrect
financial or workflow behavior, and P2 for important completeness and operability
issues.

### P0 — Schema changes cannot be deployed

- **Aria evidence:** `apps/backend/prisma/schema.prisma` adds
  `AssetActivity.userId` plus movement, repair, capitalization, and disposal models,
  relations, and enums. `git diff master...HEAD` contains no file under
  `apps/backend/prisma/migrations`.
- **Current behavior:** Prisma client generation succeeds against the schema, but
  `prisma migrate deploy` cannot create any new table or column in an existing
  environment. Runtime lifecycle calls will fail on a deployed database.
- **Expected behavior:** every schema change has a reviewed forward migration that
  applies cleanly to an existing Aria database.
- **Implementation impact:** add one focused migration for the branch's net schema
  delta, including foreign keys, indexes, uniqueness, enum values, and any new
  subledger/linkage fields required by the completed workflows.
- **Required tests:** Prisma schema validation, clean-database migration, migration
  from the previous migration head, and deterministic demo load/cleanup after
  migration.

### P0 — Accounting-labelled lifecycle operations are status-only mutations

- **Aria evidence:** `asset.service.ts` scrap/sell creates `AssetDisposal` and changes
  status; repair changes top-level asset amounts; capitalization changes an existing
  target and marks sources `SCRAPPED`; `NEW_ASSET` creates no target. None creates a
  balanced accounting entry, submitted stock issue, or complete schedule revision.
- **ERPNext references:**
  `asset/depreciation.py:363-459`, `asset_repair/asset_repair.py:199-434`, and
  `asset_capitalization/asset_capitalization.py:178-620`.
- **Current behavior:** a successful response can imply disposal, repair
  capitalization, or composite-asset capitalization even though the financial and
  inventory state is incomplete. Cancellation subtracts current values or restores
  local rows rather than reversing the exact posted transaction.
- **Expected behavior:** each submit is atomic, balanced, idempotent, linked to its
  stock and asset-subledger vouchers, and revises all affected finance-book
  schedules while preserving posted history. Cancellation reverses the same
  vouchers and creates a schedule revision; it never performs an unqualified
  arithmetic rollback.
- **Implementation impact:** add an asset-domain accounting entry/line model and
  service, a transaction-aware submitted material-issue primitive, voucher links,
  source uniqueness, `CAPITALIZED` asset status, and schedule-revision operations.
  Do not call these records general-ledger entries.
- **Required tests:** balanced lines, duplicate submission, mid-transaction failure,
  stock linkage, schedule history, cancellation/retry, zero/negative/empty sources,
  source-company mismatch, and concurrent submission.

### P1 — WDV base schedules and revaluation previews diverge from ERPNext

- **Aria evidence:** `depreciation-schedule-engine.ts:204-206` and
  `asset-value-adjustment.utils.ts:189-197` force a 5% floor for rate derivation,
  while the terminal schedule still uses the actual salvage value.
- **ERPNext reference:** `asset/asset.py:1014-1039`.
- **Current behavior:** a zero-salvage asset gets a rate derived toward 5% but a
  schedule expected to depreciate toward zero. The rate and terminal value are
  internally inconsistent.
- **Expected behavior:** use the supplied salvage value. A valid zero value derives
  100% WDV exactly as ERPNext does.
- **Recommended fix:** remove the invented floor from both production paths and
  share one rate helper to prevent preview/schedule drift.
- **Required tests:** zero salvage, zero explicit rate, non-zero salvage, invalid
  negative values, base schedule, and value-adjustment revision.

### P1 — Movement does not enforce current state, chronology, or safe rollback

- **Aria evidence:** movement contracts make source/target fields optional;
  `createAssetMovement` only checks broad asset status; submit applies target values;
  cancel blindly reapplies stored source values.
- **ERPNext reference:**
  `asset_movement/asset_movement.py:47-162`.
- **Current behavior:** clients can submit the wrong company/source/custodian,
  identical locations, missing purpose-specific values, or an out-of-order date.
  Cancelling an older A-to-B movement after a B-to-C movement can incorrectly move
  the asset back to A.
- **Expected behavior:** derive source state from the locked asset, validate required
  targets by purpose, validate company and chronology, reject duplicates, and on
  cancellation reconstruct state from the latest remaining submitted movement.
- **Implementation impact:** server-derived source fields, per-asset transaction
  locks/conditional updates, `@@unique([movementId, assetId])`, purpose refinements,
  and a UI that captures date and all supported purposes.
- **Required tests:** receipt, issue, transfer, transfer-and-issue, stale source,
  same-location rejection, cross-company rejection, out-of-order date, two-movement
  rollback, duplicate submit, and concurrent submit.

### P1 — Repair lifecycle and maintenance status are disconnected

- **Aria evidence:** repairs are created `DRAFT` and submit directly to `COMPLETED`;
  the scheduler searches only for `PENDING` repairs. No normal action creates the
  state that should mark an asset out of order.
- **ERPNext reference:** `asset_repair/asset_repair.py:175-184`.
- **Current behavior:** the Out-of-Order maintenance path is unreachable. The repair
  screen cannot capture consumed items, purchase invoices, completion date, or the
  capitalization choice.
- **Expected behavior:** explicit draft-to-pending-to-completed/cancelled transitions,
  asset status derived from open repairs/maintenance work, full cost inputs, and
  atomic stock/accounting/schedule effects when completed.
- **Required tests:** transition matrix, pending status discovery, completion status
  restoration, overlapping maintenance, consumed stock, invoice cost, capitalized
  and expensed repair, cancellation, and access control.

### P1 — Capitalization is structurally incomplete

- **Aria evidence:** the form always requests `NEW_ASSET` with empty stock, asset,
  and service arrays. Backend submission only updates an already-existing target;
  the new-target path is a no-op and source assets become `SCRAPPED`.
- **ERPNext reference:**
  `asset_capitalization/asset_capitalization.py:178-620`.
- **Current behavior:** an empty document can be created, no new target is produced,
  stock is not issued, service/source costs are not posted, and source lifecycle is
  misrepresented as scrapping.
- **Expected behavior:** require at least one valid source, support new/existing target
  modes, post source depreciation through the transaction date, issue stock, create
  the target atomically, mark source assets `CAPITALIZED`, and retain prior state for
  reversal.
- **Required tests:** each source type, mixed sources, empty/duplicate sources,
  source/target company mismatch, new and existing target, transaction rollback,
  source depreciation, submit idempotency, and cancellation.

### P1 — Disposal and restoration do not close or reverse accounting state

- **Aria evidence:** the disposal methods update status and local disposal rows only;
  the added dialog is not imported by the asset detail route.
- **ERPNext references:** `asset/depreciation.py:363-459` and
  `asset/asset.py:1096-1126`.
- **Current behavior:** projected schedules stay open, due depreciation is not posted
  through the disposal date, no balanced disposal entry exists, and restore cannot
  reverse the original financial effect.
- **Expected behavior:** lock the asset, post or reject outstanding depreciation by
  policy, close future schedules, create a balanced asset-subledger disposal/sale
  entry, and reverse the exact vouchers on restore. A sale is not a Sales Invoice;
  invoicing remains outside this branch until Aria has an AP/AR ledger.
- **Required tests:** scrap and sale at gain/loss/zero, date boundaries, outstanding
  depreciation, repeat/restore, schedule closure/revision, and UI permissions.

### P1 — Fixed Asset Register reports projections as booked depreciation

- **Aria evidence:** `fixed-asset-register-report.ts` selects active schedule entries
  through `toDate` without requiring `postingId`, `postedAt`, or a posted journal.
  `fromDate` affects chart buckets but not the table's accounting population.
- **ERPNext reference:**
  `report/fixed_asset_register/fixed_asset_register.py:249-330`, which derives
  period values from posted GL entries constrained by the requested range.
- **Current behavior:** future/projected schedule rows understate net book value and
  the UI mixes as-at and date-range semantics.
- **Expected behavior:** expose explicit date-range semantics, split opening and
  in-period posted depreciation, exclude drafts/cancelled assets and unposted rows,
  and apply the same boundaries to table, groups, and chart.
- **Required tests:** opening balances, in-period postings, projected rows, cancelled
  postings, assets acquired after the end date, boundary dates, grouping totals, and
  exported values.

### P1 — Value adjustment updates one schedule but not its finance book

- **Aria evidence:** the adjustment context implicitly selects a finance book;
  submission replaces one schedule and updates only top-level
  `Asset.valueAfterDepreciation`.
- **ERPNext reference:**
  `asset_value_adjustment/asset_value_adjustment.py:187-208`.
- **Current behavior:** multi-book assets can have a revised schedule whose parent
  finance-book carrying value and proportional salvage remain stale.
- **Expected behavior:** adjustment explicitly identifies the finance book, updates
  that book's value and proportional salvage atomically, chains the replacement
  schedule, and mirrors only the default book on the top-level asset.
- **Required tests:** default and non-default books, proportional salvage, posted
  history, revision chain, cancellation, and concurrent adjustments.

### P1 — CWIP scheduler performs an unqualified direct mutation

- **Aria evidence:** `postCwipCapitalizationGlEntries` selects due `DRAFT` assets and
  changes them to `SUBMITTED`; it creates no voucher or booked marker.
- **ERPNext reference:** `asset/asset.py:923-970,1073-1088`.
- **Current behavior:** there is no CWIP-category/account qualification, balanced
  posting, idempotency, or retry recovery. The scheduler executes an accounting
  mutation directly, unlike Aria's established depreciation discovery-to-BullMQ
  worker boundary.
- **Expected behavior:** the scheduler only discovers qualified submitted,
  CWIP-enabled, unbooked assets and enqueues deterministic jobs. A worker owns the
  locked, idempotent subledger posting and booked marker.
- **Required tests:** discovery filters, deterministic job IDs, duplicate ticks,
  worker retry after failure, balanced posting, and already-booked assets.

### P1 — Actor, company, and authorization invariants are client-controlled

- **Aria evidence:** `orgProcedure()` verifies membership but lifecycle service calls
  do not receive organization context, financial writes have no explicit role gate,
  records are looked up by IDs without consistent same-company checks, and public
  contracts accept `userId`. New forms hardcode `company: "Aria ERP"` despite the
  repository's Pivotr demo company.
- **Current behavior:** a member can spoof activity attribution and may combine
  records from different companies if IDs are known.
- **Expected behavior:** derive actor from `ctx.user.id`, derive/validate approved
  company context, require the established financial-write role, and assert that
  every asset, location, warehouse, invoice, source, and target belongs to the same
  company before mutation.
- **Implementation impact:** remove actor IDs from public inputs, pass trusted context
  from the router, add same-company service guards, and hide actions the member
  cannot invoke. Organization-owned Company is a broader ERP architecture gap and
  must not be faked only for Asset Management.
- **Required tests:** actor spoof attempt, non-member, insufficient role,
  cross-company references, and permitted member paths.

### P2 — Frontend workflows are incomplete or unreachable

- **Aria evidence:** movement omits date/source state and one purpose; repair and
  capitalization omit their line editors; all three hardcode company; disposal and
  `depreciation-schedule-tab.tsx` are dead code. The schedule tab reconstructs only a
  client-side straight-line schedule and cannot represent WDV, shifts, revisions, or
  posting state. New mutations lack consistent error handling and form validation.
- **Current behavior:** users cannot create accounting-complete documents and can be
  shown success for backend-incomplete operations.
- **Expected behavior:** server-backed selectors and schedules, frontend Zod
  validation matching shared contracts, meaningful pending/error states, accessible
  controls, role-gated actions, and no unsupported claims.
- **Required tests:** component-level invalid/valid submissions and route-level
  create/submit/cancel flows backed by deterministic API state.

### P2 — Canonical route moves leave broken links and no compatibility path

- **Aria evidence:** legacy route files were moved without redirects; dashboard links
  still reference removed asset paths, including singular `/asset/value-adjustment`.
  Asset documentation also contains legacy URLs.
- **Current behavior:** saved links and three dashboard actions can return 404.
- **Expected behavior:** all first-party links use canonical routes and intentional
  permanent redirects preserve the former public URLs.
- **Required tests:** navigation tests for every dashboard/sidebar target and redirect
  tests for each moved legacy route.

### P2 — Demo data and tests do not prove the new behavior

- **Aria evidence:** the demo loader and cleanup contain no movement, repair,
  capitalization, or disposal records. New E2E specs only open pages/dialogs and do
  not provision authenticated organization state.
- **Current behavior:** new pages are empty after demo load; cleanup will become
  foreign-key unsafe once lifecycle examples exist; tests cannot detect the core
  financial and rollback defects above.
- **Expected behavior:** deterministic Pivotr/Bengaluru/INR lifecycle scenarios are
  created through production services or equivalent validated seed paths, cleanup
  deletes them in dependency order, and tests assert persisted domain effects.
- **Required tests:** load twice, cleanup/load recovery, stable counts/series, seeded
  movement and cancellation history, pending/completed repair, capitalization,
  disposal/restore, and posted-versus-projected report values.

## Verified-correct branch changes to preserve

- Atomic document-series counter increments are transaction-scoped.
- Shift-factor normalization is correct for the implemented non-daily straight-line
  calculation.
- Asset value-adjustment dates are checked against purchase date.
- Existing depreciation scheduling remains discovery-only, while its BullMQ worker
  owns execution.
- Canonical route source files and all 14 current navigation entries exist.
- The protected Asset layout still applies authentication and `OrganizationGate`.
- Shared contracts and tRPC inference compile without frontend TypeScript errors at
  the audit baseline.

## Executable remediation plan

The following phases are dependency ordered. Tasks listed together are safe to run
in parallel when they touch disjoint files; integration decisions and final review
remain with the primary implementer.

### Phase A — Schema and trusted transaction foundations (sequential)

1. **Finalize lifecycle persistence.** Add the asset accounting entry/line models,
   voucher/source uniqueness, stock-entry links, source prior-state fields,
   finance-book identifiers, movement item uniqueness, CWIP booked marker, and
   `CAPITALIZED` status in `schema.prisma` and shared types.
   - Outcome: the schema can represent every exact submit/reverse relationship.
   - Tests: Prisma validation and constraint-focused service tests.
2. **Create the net forward migration.** Generate SQL from the previous migration
   head, review destructive operations, and apply it to both empty and upgraded test
   databases.
   - Outcome: `prisma migrate deploy` creates the complete branch schema.
   - Tests: clean/upgraded migration plus demo cleanup/load.
3. **Establish trusted mutation context.** Remove client-supplied actor IDs, pass the
   authenticated actor from tRPC, enforce financial-write roles, and centralize
   same-company checks.
   - Outcome: lifecycle attribution and record scope are server-controlled.
   - Tests: actor, role, and cross-company negative cases.

### Phase B — Depreciation, revaluation, and report correctness (parallel after A1)

1. Remove the WDV floor and use one ERPNext-aligned rate helper in schedule and
   revaluation paths.
2. Add a transaction-aware finance-book schedule revision operation that preserves
   posted history and chains replacements.
3. Make value adjustment select and update the intended finance book, including
   proportional salvage and default-book mirroring.
4. Rebuild Fixed Asset Register calculations around posted entries with explicit
   opening/in-period date-range semantics and matching export/chart totals.
   - Tests: the edge cases specified in the four corresponding findings.

### Phase C — Lifecycle services (movement can run parallel; accounting flows sequential)

1. **Movement:** implement source derivation, purpose/date/company validation,
   per-asset locking, conditional state changes, and latest-history cancellation.
2. **Asset accounting subledger:** implement balanced posting and exact reversal with
   deterministic series/source identity. Keep the name and documentation honest.
3. **Submitted stock posting:** implement a transaction-aware material-issue path,
   validate warehouse/item/company data, link the document, and make reports ignore
   cancelled/draft entries.
4. **Repair:** add pending/completed transitions and compose stock, subledger, asset,
   finance-book, and schedule effects in one transaction.
5. **Capitalization:** validate sources/target, create a new target when requested,
   post due source depreciation, consume stock/assets/services, use `CAPITALIZED`,
   and retain exact reversal state.
6. **Disposal/restore:** close/revise schedules and post/reverse balanced subledger
   entries without claiming Sales Invoice support.
   - Tests: unit and database integration tests for valid, invalid, concurrent,
     failure, retry, cancellation, and reversal paths.

### Phase D — Scheduler/worker boundary (after C2)

1. Convert CWIP scheduling to qualified discovery only, with deterministic BullMQ
   job identity.
2. Add an idempotent worker that locks the asset, creates the CWIP subledger entry,
   and persists its booked marker atomically.
3. Align maintenance status discovery with the real repair state machine and ensure
   status restoration considers other open maintenance work.
   - Tests: discovery filters, duplicate ticks, retries, restart recovery, and
     scheduler/worker separation.

### Phase E — Frontend integration (parallel by workflow after C contracts stabilize)

1. Replace hardcoded company values with approved context and add shared-schema form
   validation, pending/error states, accessibility, and permissions.
2. Complete movement date/purpose/source presentation and submit/cancel behavior.
3. Complete repair consumed-item/invoice/capitalization/completion inputs.
4. Complete capitalization target modes and stock/asset/service line editors.
5. Wire disposal/restore actions and render the server-backed depreciation schedule
   on asset detail; delete the inaccurate client reconstruction.
6. Correct dashboard links and add compatibility redirects for all route moves.
   - Tests: meaningful component tests and authenticated, data-backed lifecycle E2E.

No file under a `ui` directory may be edited in this phase; use existing primitives
as they are.

### Phase F — Demo, documentation, and integration verification (sequential)

1. Add deterministic Pivotr/Bengaluru/INR examples covering submitted and reversible
   movement, pending/completed repair, source/target capitalization, scrap/sale or
   restore, CWIP discovery, and posted/projected register data.
2. Update cleanup ordering, count/status reporting, and idempotent reload coverage.
3. Replace smoke E2E expectations with authenticated seeded workflows and persisted
   effect assertions; retain unit/API tests for failure and concurrency paths.
4. Update user-facing Asset documentation and this report to describe final behavior,
   supported accounting boundaries, and any genuinely broader deferred subsystem.
5. Review the complete `master...HEAD` diff for dead code, stale claims, TODOs,
   suppressions, warnings, contract/schema drift, and unrelated edits.
6. Run focused checks after each phase, then run the exact final gate:
   `bun run validate`. Completion requires exit code 0.

## Broader dependencies that this branch must describe, not fake

The following are not present elsewhere in Aria and cannot be made ERPNext-equivalent
by adding Asset-only names or placeholder rows:

- a company-owned chart of accounts with account validation;
- a shared journal/general ledger, posting rules, trial balance, and statutory
  reversal model;
- Sales Invoice/AP/AR generation and settlement for asset sales;
- inventory valuation, perpetual-inventory accounting, reservations, and serial or
  batch enforcement;
- an organization-to-company ownership model consistently applied across every ERP
  module.

The branch remains responsible for correct, balanced, reversible Asset-domain
records and stock documents. UI, API, tests, and documentation must use that precise
terminology and must not imply the broader subsystems already exist.
