# Deep Asset Management Gap Investigation

## Audit metadata

| Field | Value |
|---|---|
| Reviewed parent | `feat/asset-gap-remediation` |
| Parent/audit branch point | `9820df9eb4c02ceba47f62eb69882e6117a3f698` |
| Audit branch | `audit/asset-gap-remediation-deep-review` |
| Merge base with `master` | `224d77495c16204785c75fa3a6172f5df48193f0` |
| Review date | 2026-08-11 UTC |
| Primary sources | Aria source, Prisma schema/migrations, shared contracts, frontend routes, `.erpnext` source |
| Changes made during audit | This report only; no production code, schema, UI folder, or existing gap-analysis edits |

## 1. Executive Summary

### Verdict: do not merge into `master`

`feat/asset-gap-remediation` is not merge-ready. The branch has strong implementation breadth and its ordinary build, lint, typecheck, unit, migration-status, and depreciation-boot checks pass, but those checks do not establish the required trust boundary or financial/lifecycle parity.

The two hard blockers are:

1. **AM-001 — organization isolation is not enforced in Asset data access.** `orgProcedure()` proves membership but the Asset router discards `ctx.organization`; the Prisma Asset/Company model has no organization ownership path and service queries are global. A member who knows an Asset CUID can cross the intended tenant boundary.
2. **AM-012 — realtime Asset events are organization-blind.** `EventEmitterModule` listeners subscribe globally and mutation payloads contain full Asset data without an organization/topic filter. Fixing read predicates alone would not stop cross-organization event leakage.

There are also 24 active High findings covering cancellation/reversal integrity, depreciation calculations, finance-book ownership, reporting, lifecycle races, frontend contract loss, and background processing readiness. Passing tests mainly prove the implementation’s current assumptions; they do not cover the counterexamples below.

### Backend log diagnosis

The supplied log does **not** show a NestJS Asset backend failure:

- `AssetModule`, `HealthModule`, and `TrpcModule` initialize.
- `/health/ready` is mapped.
- Default-user/database setup completes.
- CWIP and depreciation discovery complete with zero eligible work at startup and reconciliation.
- The fatal messages are emitted by `frontend:dev`, not `backend:dev`, and are Turbopack panics.
- `/auth/sign-in/?callbackUrl=%2F` still returns HTTP 200 after each panic.

The panic file named in the log was unavailable during this audit. A read-only reproduction of standalone and root Turbopack development did not deterministically reproduce it. The evidence supports an intermittent development-tool/cache/resource incident, not a confirmed Asset route or backend defect. Keep Turbopack as the reproduction target; do not switch to webpack. Preserve `/tmp/next-panic-*.log` immediately if it recurs.

### Finding counts

Counts below include the 11 previous AM findings, the previous Medium/Low hypotheses, the promoted stale-snapshot issue, and new findings in this report.

| Severity | Count | Merge implication |
|---|---:|---|
| BLOCKER | 2 | Must fix before merge |
| HIGH | 24 | Must fix before merge |
| MEDIUM | 18 | Must fix or explicitly defer only after blockers/highs and targeted evidence |
| LOW | 3 | Documentation/test hygiene; may be deferred if the merge gate records ownership |

## 2. Scope and Architecture

### Git and cumulative branch scope

The audit branch was created directly from the current parent HEAD. The parent branch remains untouched. The cumulative branch contains 23 commits, 157 changed files, 20,518 insertions, and 1,808 deletions against merge base `master`; `git diff --check master...HEAD` passes and no changed path is inside a `/ui/` folder.

The branch history was reviewed from the initial gap report through contracts/schema, depreciation, lifecycle services, reports/schedulers, frontend routes, E2E harness, demo safety, authorization, and the final fixed-register test commit. The large diff is coherent in broad purpose, but later hardening commits did not establish organization ownership, canonical date contracts, or complete ERPNext lifecycle reversal semantics.

### Current Asset surface

The old “3 sub-modules / 10 pages” description is stale for the current branch. `apps/frontend/src/constants/app-nav-data.ts:284-380` currently exposes 14 functional navigation leaves:

| Navigation group | Current leaves |
|---|---|
| Assets | Asset, Location, Asset Category, Movements, Repairs, Capitalizations |
| Maintenance | Maintenance Team, Maintenance, Maintenance Log, Value Adjustment |
| Reports | Fixed Asset Register, Depreciation Ledger, Depreciations and Balances, Activity |

Dashboard, Users, profile, access-denied, detail pages, and create/edit routes are additional route surfaces. The route tree contains more than the historical ten list pages; this report audits the current tree rather than treating the old count as a scope limit.

### Backend/data flow

- `apps/backend/src/apps/asset/asset.module.ts` wires `AssetService`, `AssetAccountingService`, `AssetStockPostingService`, dashboard/report services, and depreciation processing.
- `asset.router.ts` exposes reads through `orgProcedure()` and writes through `orgProcedure(["owner", "admin"])`, but most service calls receive only input and actor ID.
- `AssetService` owns Asset CRUD, movement, repair, capitalization, disposal, value adjustment, locations, maintenance, dashboards, and reports.
- Depreciation is split between schedule generation, revision, persistence, discovery, scheduler, BullMQ processor, queue events, and CWIP discovery/execution.
- `AssetAccountingService` is a balanced Asset-domain subledger. It is not a replacement for a shared statutory GL, and the audit does not treat missing platform GL equivalence as an Asset defect.
- Prisma contains global `Location`, `AssetCategory`, `FinanceBook`, and `Company` records; `Asset.company` is a string, not an organization-owned relation.

### Trust boundaries

The intended request boundary is:

```text
session + active organization
        ↓
orgProcedure membership/role check
        ↓
Asset router
        ↓
Asset service predicates and same-organization relations
        ↓
Prisma transaction and organization-filtered reports/events
```

The current implementation stops after the procedure check. It does not carry the active organization through service predicates, relation validation, report queries, or event topics.

## 3. ERPNext Reference Mapping

The comparison uses the actual vendored source under `.erpnext`; UI differences are intentionally excluded.

| Aria area | ERPNext reference | Invariant used in this audit |
|---|---|---|
| Asset submission/cancellation | `.erpnext/erpnext/assets/doctype/asset/asset.py:246-278` | Composite assets need active capitalization; submission creates movement/GL/schedules; cancellation validates and reverses movement, depreciation, schedules, and GL. |
| Available-for-use | `asset.py:381-392` | Ordinary assets require available-for-use date; finance-book depreciation cannot start before it. Composite components are the explicit exception. |
| DDB/WDV rate | `asset.py:989-1039` | DDB uses original useful life; WDV derives from current carrying value, salvage, pending periods, and life extension unless a valid manual rate is retained under ERPNext rules. |
| Depreciation methods | `.erpnext/erpnext/assets/doctype/asset_depreciation_schedule/depreciation_methods.py:15-60` | Straight-line, daily/total-days, shift factors, WDV and DDB preserve the configured period basis and finance-book context. |
| Capitalization | `asset_capitalization.py:186-215,313-321,468-499,577-590` | Target identity/type/company must agree; source value is as-of capitalization date; consumed-asset depreciation/disposal is reversible on cancellation. |
| Disposal/restore | `.erpnext/erpnext/assets/doctype/asset/depreciation.py:451-570` | Restore reverses disposal-created depreciation when appropriate, resets schedules, cancels the disposal journal, and clears disposal date. |
| Movement | `asset_movement.py:33-80,130-170` | Company/status/location/custodian/date are validated; submit/cancel reconstructs latest movement state and records activity. |
| Repair | `asset_repair.py:61-173` | Asset status, invoice identity/status/account/available amount, dates, and cost are validated before posting. |
| Maintenance | `asset_maintenance.py:36-48` | Maintenance task assignment is required at draft validation and is synchronized to logs. |
| Fixed Asset Register | `fixed_asset_register.py:33-160,249-349` | Submitted assets are filtered by exact company/date/fiscal scope; depreciation and revaluation are selected by finance book and posting date. |

## 4. Verification of Previous Audit

### AM-001 through AM-011

| ID | Status | Severity | Independent result and evidence | Merge |
|---|---|---:|---|---|
| AM-001 | CONFIRMED | BLOCKER | `orgProcedure()` establishes membership at `apps/backend/src/trpc/trpc.ts:183-283`, but `asset.router.ts:50-122` drops organization context and `asset.service.ts:1180-1250` queries Assets by global filters/ID. `Organization` only owns auth membership (`schema.prisma:535-562`); Asset has free-text `company` and Company has no Organization relation. | YES |
| AM-002 | CONFIRMED | HIGH | `AssetDepreciationLifecycleService.cancelAsset()` (`asset-depreciation-lifecycle.service.ts:65-91`) checks only posted depreciation, then cancels open schedules and sets any Asset to `CANCELLED`. It does not validate/reverse disposal, capitalization, revaluation, repair, or other posted lifecycle effects. ERPNext `asset.py:267-278` performs a linked-state cancellation and reverses postings. | YES |
| AM-003 | CONFIRMED | HIGH | `submitAsset()` (`asset-depreciation-lifecycle.service.ts:27-63`) checks only DRAFT and finance-book count. It does not enforce COMPOSITE_ASSET capitalization. ERPNext `asset.py:246-250` rejects a composite Asset without active capitalization. | YES |
| AM-004 | CONFIRMED | HIGH | Capitalization cancellation uses `createdAt > submittedAt` when looking for later depreciation (`asset.service.ts:6862-6894`), while the depreciation barrier can create a posting at the capitalization date before `submittedAt`. There is no source-document lineage check. ERPNext capitalization cancellation restores consumed schedules and reverses disposal-created depreciation. | YES |
| AM-005 | CONFIRMED | HIGH | The schedule engine computes ordinary SL from `grossBookValue - salvage` over original periods (`depreciation-schedule-engine.ts:296-340`) even when opening accumulation/booked periods exist. A direct probe with gross 1,000, salvage 100, opening accumulation 200, 1/3 periods booked produces `[300,300,100]`; the remaining carrying value 800 less salvage 100 over two periods requires 350/350. | YES |
| AM-006 | CONFIRMED | HIGH | Revision passes the stored WDV rate through `asset-depreciation-revision.service.ts:189-205`; `calculateRate()` retains any positive rate (`depreciation-schedule-engine.ts:188-205`). ERPNext derives the revised WDV rate from current value, salvage, pending periods, and life (`asset.py:1014-1039`) under the relevant rules. | YES |
| AM-007 | CONFIRMED | HIGH | `validateDepreciationFields()` permits absent `availableForUseDate` (`asset.service.ts:727-800`), and lifecycle scheduling falls back to purchase date (`asset-depreciation-lifecycle.service.ts:296-306`). ERPNext `asset.py:381-392` requires the date for ordinary assets and rejects a depreciation start before it. | YES |
| AM-008 | CONFIRMED | HIGH | Value adjustment updates root `Asset.valueAfterDepreciation` and status from the selected book (`asset.service.ts:2538-2710`), while ordinary persistence updates root state only for the Company default finance book (`depreciation-persistence.service.ts:425-430`). A secondary-book adjustment can therefore overwrite the root/default presentation. | YES |
| AM-009 | CONFIRMED | HIGH | Shared input permits `NEW_ASSET` plus `targetAssetId` (`packages/types/src/index.ts:6329-6390`); capitalization creation accepts it and posting later creates/uses a server target (`asset.service.ts:6426-6517,6713-6719`) instead of rejecting the contradictory request. ERPNext validates target type, item, status, and company (`asset_capitalization.py:186-215`). | YES |
| AM-010 | CONFIRMED | HIGH | Asset forms and dialogs convert local-midnight dates through `toISOString().slice(0,10)` and use local `new Date("YYYY-MM-DDT00:00:00")`. A mechanical `TZ=Asia/Kolkata` probe shifts local 2026-08-10 to ISO 2026-08-09; the form’s month-end helper shifts August 31 to August 30. Backend reports/services also use local `setHours` around `z.coerce.date()`. | YES |
| AM-011 | CONFIRMED | HIGH | Edit hydration resets values at `items/form/page.tsx:389-479`, then the category effect at `:509-540` unconditionally applies defaults with `shouldDirty: true`. An asynchronously loaded category can overwrite persisted depreciation method, period, frequency, or salvage values. | YES |

### Previous Medium/Low hypotheses

| Previous hypothesis | Status | Disposition |
|---|---|---|
| Playwright coverage is mostly smoke-level | CONFIRMED, MEDIUM | Asset specs and the fixture mostly visit routes, open dialogs, and assert visibility. They do not prove authenticated create → submit → process → reload → report persistence. |
| Location hierarchy permits cycles | CONFIRMED, MEDIUM | Frontend excludes only the current row; `AssetService.updateLocation()` (`asset.service.ts:3005-3034`) accepts any parent without descendant/cycle validation. |
| Maintenance forms require raw CUIDs | CONFIRMED, MEDIUM | `maintenance/form/page.tsx:271-280,350-358` uses raw Asset/team IDs; shared task `assignTo` is free text (`packages/types/src/index.ts:6749-6762`). |
| Value-adjustment cancellation restores stale snapshots | CONFIRMED and promoted to **AM-026 HIGH** | Cancellation blocks only newer submitted adjustments (`asset.service.ts:2818-2829`) and then overwrites root status/value from snapshots (`:2850-2868`), without checking later repair, capitalization, disposal, or accounting effects. |
| WDV preview and persistence use inconsistent period conventions | CONFIRMED, MEDIUM | Preview `asset-value-adjustment.utils.ts:183-205,197-270` passes periods as years; persisted engine converts periods to `frequencyMonths / 12`. |
| Legacy maintenance documentation/routes are stale | PARTIALLY CONFIRMED, LOW | Runtime route redirects exist in `next.config.ts`, but brochure/client-guide links still use `/asset/asset-sub-module/...` (`docs/asset-management-brochure-report.md:121-182`, `docs/asset-management-client-guide.md:439-574`). |
| Demo load-twice/cleanup/reload/restart proof is incomplete | CONFIRMED, MEDIUM | Safety checks and static/unit seed tests pass, but no disposable-database load twice, cleanup recovery, worker processing, or restart-idempotency run was performed in this audit. |
| Gap-analysis report has stale counts/terminology | CONFIRMED, LOW | `docs/asset-management-gap-analysis.md:58-74` describes ten pre-branch pages and ten commits; current branch has 14 functional nav leaves and 23 commits. |
| Asset creation and finance-book/activity creation are not one transaction | CONFIRMED, MEDIUM | `asset.service.ts:1337-1387` inserts the Asset; `:1389-1392` configures books; `:1394-1400` creates activity in separate calls. Failure can leave a draft without its expected book/activity state. |
| Chronology guards are incomplete | CONFIRMED, MEDIUM | Some flows use operational/posting dates, but cancellation/restore checks use `createdAt` and value aggregation ignores adjustment date; see AM-004, AM-015, and AM-018. |

## 5. Newly Discovered Findings

The findings below are deduplicated. Each was independently checked against the current source; “confirmed” means the behavior is present in the audited HEAD, not that a production incident has already occurred.

### AM-012 — Organization-blind realtime Asset fan-out

| Field | Finding |
|---|---|
| Severity / status / merge | **BLOCKER / CONFIRMED / YES** |
| Areas | tRPC subscriptions, EventEmitter, dashboards, Asset payload privacy |
| Aria evidence | `app.module.ts:15-27` registers a global `EventEmitterModule.forRoot()`. `asset.router.ts:119-185` emits `assetsChanged` without organization identity; subscriptions at `:383-417` attach global listeners. The emitted Asset payload includes category/location/activity/finance-book data through `asset.service.ts:83-94`. |
| ERPNext/reference | ERPNext’s request permissions and document ownership prevent a user from receiving another company’s document. Aria’s organization middleware is the local trust-boundary reference, but it is not applied to event topics. |
| Current / expected | Any connected subscriber can receive a mutation event emitted by any organization. Event delivery must be scoped by organization and should send the minimum invalidation metadata, not a full cross-tenant Asset object. |
| Reproduction / impact | Connect two authenticated users with different active organizations, submit an Asset in Org A, and observe the Org B WebSocket subscription. Even if AM-001 query predicates are later fixed, the global listener receives the event. This is cross-tenant disclosure and stale-cache invalidation. |
| Root cause / remediation | Organization context is discarded before service/event calls and event payloads have no tenant key. Carry a trusted org ID through service methods, emit typed org-scoped topics, filter subscriptions server-side, and avoid full records in fan-out payloads. |
| Dependencies / tests | Depends on organization/company ownership (AM-001). Add two-organization subscription tests, payload-minimization tests, reconnect tests, and report/dashboard invalidation tests. |

### AM-013 — Submitted capitalization can lose its server-created target Asset

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | capitalization target lifecycle, deletion, referential integrity |
| Aria evidence | `postAssetCapitalization()` creates a target as DRAFT/COMPOSITE_ASSET (`asset.service.ts:6489-6517`) and persists `targetAssetId` on submission (`:6713-6719`). `deleteAsset()` blocks only status `SUBMITTED` (`:1765-1779`); the target remains DRAFT. The target FK is `ON DELETE SET NULL` (`20260809130000_add_asset_lifecycle_documents/migration.sql:350`). |
| ERPNext/reference | `asset_capitalization.py:186-215` requires a draft composite target with matching item/company and keeps the document linkage available for cancellation; a submitted document cannot silently lose its target. |
| Current / expected | A user can delete the DRAFT target after capitalization submission. The capitalization’s target becomes null, while cancellation requires a target (`asset.service.ts:6784-6814`), so a posted capitalization can become non-reversible. The target must be protected by lifecycle state/foreign-key policy or cancellation must have an immutable target snapshot. |
| Reproduction / impact | Post a `NEW_ASSET` capitalization, delete the generated DRAFT target, then cancel the capitalization. The FK nulls `targetAssetId`; cancellation cannot restore the target or reliably reverse the target value/accounting. |
| Root cause / remediation | Deletion policy considers only Asset status, not submitted document dependencies, and the FK is permissive. Reject deletion when any submitted capitalization references the target; use a restrictive FK or an explicit cancellation workflow. |
| Dependencies / tests | Requires lifecycle state rules from AM-002/003/009. Add post-capitalization delete, bulk-delete, cancel-after-delete, and concurrent delete/cancel integration tests. |

### AM-014 — Asset submit/cancel has a split transaction and race window

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | lifecycle state machine, finance-book setup, concurrency |
| Aria evidence | `submitAsset()` calls `configureAssetBooks(assetId)` before its transaction (`asset-depreciation-lifecycle.service.ts:27-30`), then reads DRAFT and updates it without an Asset row lock or conditional status transition (`:31-54`). `cancelAsset()` has no Asset lock or status predicate and unconditionally marks open schedules/Asset cancelled (`:65-83`). |
| ERPNext/reference | ERPNext document submission/cancellation is a single document transaction with state/link validation (`asset.py:246-278`); schedule and posting effects are not committed independently of the document transition. |
| Current / expected | Concurrent submit/cancel or a failure after book configuration can leave active schedules with a cancelled/draft Asset, or a submitted Asset with partially configured books. State transition, schedule status, and activity should commit atomically under an advisory/row lock with a conditional update. |
| Reproduction / impact | Start two requests concurrently: one submit and one cancel. Both can pass preconditions; the last unconditional update determines Asset status while schedule configuration/activation is performed by the other request. A thrown activity/update can also leave the pre-transaction book work. |
| Root cause / remediation | Configuration and lifecycle transition use separate transactions, and transition methods do not lock/recheck the Asset. Move all effects into one transaction, lock in stable order, use `updateMany(... status: expected)` and reject lost transitions. |
| Dependencies / tests | Coordinate with depreciation revision locks and AM-002. Add concurrent submit/cancel, failure injection after each phase, retry, and final-state/schedule-invariant tests. |

### AM-015 — Disposal restore omits ERPNext’s disposal-date depreciation reversal

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | disposal, restore, depreciation reversal, finance books |
| Aria evidence | Disposal posts through the disposal date and closes schedules (`asset.service.ts:4612-4804`). Restore reverses the disposal accounting entry and reactivates closed schedules (`:4862-4899`), but never identifies/reverses a journal created specifically by the disposal-date barrier. Its later-depreciation check uses `createdAt`, not posting/document lineage (`:4862-4884`). |
| ERPNext/reference | `.erpnext/erpnext/assets/depreciation.py:451-472,502-570` explicitly reverses disposal-created depreciation when it was not on the original schedule date, restores the schedule, and cancels the disposal journal. |
| Current / expected | Restoring a disposed asset can reactivate schedules while the disposal-date depreciation journal remains posted, overstating accumulated depreciation and understating value. Restore must reverse only the barrier-created entry when ERPNext’s original-date exception does not apply. |
| Reproduction / impact | Dispose mid-period so the barrier creates a disposal-date depreciation entry; restore before any later posting. Current restore reverses disposal accounting but leaves that depreciation entry. The Asset and finance-book ledger disagree. |
| Root cause / remediation | Depreciation barrier output is not linked to the disposal document, and restore only checks broad timestamps. Persist source/lineage IDs and reverse the exact eligible entries per finance book before reactivating schedules. |
| Dependencies / tests | Depends on AM-002/004 chronology and depreciation journal linkage. Add future/mid-period/original-schedule-date disposal fixtures, restore accounting assertions, and multi-book tests. |

### AM-016 — Asset submission does not create the initial receipt movement

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | asset acquisition, movement ledger, custody/location history |
| Aria evidence | `AssetDepreciationLifecycleService.submitAsset()` only activates schedules, updates Asset status, and creates an activity (`:47-61`). Movement creation/submission is a separate API (`asset.service.ts:4939-5252`); there is no receipt created as part of Asset submission. |
| ERPNext/reference | `asset.py:252-265` calls `make_asset_movement()` during submission. `asset_movement.py:33-80,156-170` validates and records location/custodian history. |
| Current / expected | A submitted Asset can have current location/custodian fields but no movement ledger entry representing acquisition/custody. Submission should create the initial receipt or an explicit equivalent with deterministic idempotency. |
| Reproduction / impact | Create a draft with location/custodian, submit it, and query Movements/Activity. No receipt movement exists; downstream audit/report consumers cannot reconstruct initial custody or distinguish acquisition from a later edit. |
| Root cause / remediation | Asset submission and movement histories are modeled as independent workflows. Add a transactional initial receipt with an idempotency key and preserve the established movement cancellation reconstruction. |
| Dependencies / tests | Depends on Asset/location/company ownership and actor attribution. Add submit-with/without-location fixtures, duplicate submit retry, movement report, and cancellation tests. |

### AM-017 — Fixed Asset Register is not finance-book or exact as-of scoped

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | statutory-facing report, finance books, date filters |
| Aria evidence | Input has no finance-book field (`packages/types/src/index.ts:7366-7381`). `fixed-asset-register-report.ts:28-84` filters Assets by fuzzy company `contains`, loads all depreciation schedules, and sums all posted entries/revaluations in the date window. It uses root Asset values at query time. |
| ERPNext/reference | `.erpnext/.../fixed_asset_register.py:33-160` requires exact company/submitted scope and `:249-349` selects depreciation/revaluation by selected/default finance book and posting date. |
| Current / expected | With two finance books, the same Asset can be counted with mixed schedules/books, and a company substring can include unintended companies. The report must accept a finance-book context, exact ownership, and a canonical as-of/posting-date basis. |
| Reproduction / impact | Configure default and secondary books with different depreciation, run the report for a company substring shared by two companies, and compare totals. Aria aggregates both books; the result can double-count or misstate NBV. |
| Root cause / remediation | Report contract predates/ignores multi-book ownership and uses root Asset snapshots rather than selected-book entries. Add finance-book selection/default semantics, exact Company relation, and date-only helpers. |
| Dependencies / tests | Depends on AM-001/008/018 and canonical dates (AM-010). Add two-book, exact-company, as-of, fiscal-year, and cross-organization report integration tests. |

### AM-018 — Lifecycle carrying-value aggregation mixes books and future adjustments

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | disposal, capitalization, accounting balances |
| Aria evidence | `getFixedAssetBalance()` (`asset.service.ts:687-699`) sums every submitted `AssetValueAdjustment` for an Asset, ignoring `financeBookId` and `adjustmentDate`. Disposal and capitalization consume it at `:4688-4695` and `:6607-6614`. |
| ERPNext/reference | Capitalization reads value after depreciation as-of posting date and finance book (`asset_capitalization.py:313-321`); fixed-register maps filter by finance book/posting date. |
| Current / expected | A future-dated or secondary-book adjustment changes the fixed-asset credit and accumulated-depreciation lines for an earlier/default-book disposal or capitalization. Balance calculations must be selected-book and as-of-date scoped. |
| Reproduction / impact | Submit a secondary-book adjustment or an adjustment dated after disposal, then post disposal/capitalization. The helper includes it even though it was not effective for that book/date, producing incorrect accounting lines. |
| Root cause / remediation | A single root-level aggregate is used in workflows with finance-book/date semantics. Replace it with a finance-book balance service that derives posted state as-of the document posting date and rejects ambiguous missing-book data. |
| Dependencies / tests | Depends on AM-008/017 and accounting entry lineage. Add future adjustment, secondary book, backdated document, and disposal/capitalization balance tests. |

### AM-019 — Main Asset form cannot represent Asset types

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | frontend/shared contract, composite lifecycle |
| Aria evidence | Shared create contract supports `assetType` (`packages/types/src/index.ts:6332-6338`), but `items/form/page.tsx:78-129` has no field/default and `:584-610` omits it. The backend default is `EXISTING_ASSET`. |
| ERPNext/reference | ERPNext `asset.py:246-265` gives `Composite Asset` and `Composite Component` distinct submit/movement/depreciation semantics. |
| Current / expected | The UI can only create the default Existing Asset, so composite/component workflows cannot be initiated or accurately edited from the main Asset route. The form must model supported types and their conditional validation. |
| Reproduction / impact | Open create Asset and attempt to create a composite/component; no control exists and payload defaults to Existing Asset. Capitalization tests can pass only through backend/demo paths not available to users. |
| Root cause / remediation | Frontend schema and payload were not updated when the shared contract gained `assetType`. Add typed selector, edit hydration, conditional available-for-use/target rules, and backend parity tests. |
| Dependencies / tests | Depends on AM-003/009 and initial movement semantics. Add component/composite browser and contract tests. |

### AM-020 — Per-finance-book depreciation controls are silently dropped by the form

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | frontend finance-book configuration, depreciation parity |
| Aria evidence | Contracts/schema include `dailyProrataBased`, `shiftBased`, and `rateOfDepreciation` (`packages/types/src/index.ts:5977-5995,6278-6298`). Edit hydration keeps only a subset (`items/form/page.tsx:460-476`), payload omits the fields (`:649-669`), and the finance-book UI renders no controls (`:1512-1638`). |
| ERPNext/reference | ERPNext Asset finance-book rows carry prorata, shift, rate, and schedule settings; `asset.py:1198-1211` and depreciation methods consume them. |
| Current / expected | Editing an Asset or creating a book through this form can erase or never submit supported settings. The UI must preserve all contract fields, expose only supported options, and make omission explicit rather than silently defaulting. |
| Reproduction / impact | Hydrate an Asset with a non-default book marked shift-based or manually rated, save it, and inspect the mutation payload/database. The settings are absent/defaulted. |
| Root cause / remediation | Form model predates per-book controls and has no round-trip contract test. Extend schema, reset mapping, controls, payload, and dirty-state logic. |
| Dependencies / tests | Depends on AM-006/021/022. Add round-trip form tests for every finance-book setting and persisted schedule assertions. |

### AM-021 — Depreciation revision changes the ERPNext life/rate/date basis

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | DDB/WDV revision, useful-life extension, schedule dates |
| Aria evidence | `asset-depreciation-revision.service.ts:158-175` rounds life deltas with `Math.ceil(deltaMonths / frequency)`, sets `totalPeriods` to revised periods, and `:189-219` passes `remainingPeriods` as the new schedule total and both dates as the effective adjustment date. The engine derives DDB as `200 / (totalPeriods * frequency / 12)` (`depreciation-schedule-engine.ts:188-205`). |
| ERPNext/reference | ERPNext DDB rate uses original total useful life (`asset.py:996-1012`); WDV derives pending years including exact life extension (`:1014-1039`). Schedule rescheduling preserves the finance-book cadence (`asset_depreciation_schedule.py:193-205`) rather than anchoring every successor to the adjustment date. |
| Current / expected | After two booked years of a ten-year DDB asset, Aria’s fresh remaining-period basis yields 25%; ERPNext’s original-life basis yields 20%. A two-month annual extension becomes a full year and a mid-month adjustment shifts month-end cadence. Preserve original life semantics, exact months, and established anchor. |
| Reproduction / impact | Revise a booked DDB asset after two years or add two months to an annual schedule; compare rate, pending dates, end date, and final residual. The successor over-depreciates or ends on the wrong cadence. |
| Root cause / remediation | Revision treats the successor as a new asset and collapses month deltas to whole periods. Store original life/cadence, pass booked/opening state separately, and derive rate/date using ERPNext-compatible inputs. |
| Dependencies / tests | Depends on AM-005/006/010 and per-book contract preservation. Add exact numerical fixtures for DDB, WDV, month-end, partial-life, and fiscal-year boundaries. |

### AM-022 — Shift-based depreciation is not wired into production lifecycle

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | shift-based depreciation, finance-book persistence |
| Aria evidence | The engine accepts `shiftAllocations` (`depreciation-schedule-engine.ts:296-309`), but lifecycle schedule input (`asset-depreciation-lifecycle.service.ts:296-321`) never loads or supplies allocations. `AssetFinanceBook` stores only `shiftBased` and no allocation rows (`schema.prisma:1817-1848`). |
| ERPNext/reference | ERPNext shift factors are applied by `depreciation_methods.py:47-60` from configured shift rows. |
| Current / expected | Marking a book `shiftBased` silently calculates every period with factor 1. Shift-based configuration must either be fully supported and persisted or rejected as unsupported; it must not appear enabled while being ignored. |
| Reproduction / impact | Create a shift-based book with two/triple-shift allocation intent and generate a schedule. Production receives the ordinary schedule and incorrect financial expense. |
| Root cause / remediation | Engine capability was added without a production data model and lifecycle wiring. Add normalized allocation data, validation, persistence, and worker/revision loading. |
| Dependencies / tests | Depends on AM-020/021. Add schedule, revision, posting, and frontend round-trip tests. |

### AM-023 — Zero carrying-value WDV can persist non-finite schedule values

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | WDV validation, schedule engine, persistence |
| Aria evidence | Engine input permits opening accumulation equal to depreciable value (`depreciation-schedule-engine.ts:168-175`). `calculateRate()` divides salvage by opening book value (`:198-205`). A direct probe with gross 1,000, salvage 0, opening accumulation 1,000, 11/12 periods booked returns `NaN` rate, amount, and book value; `JSON.stringify` masks them as null. |
| ERPNext/reference | ERPNext calculates a valid fully-depreciated state and should never write non-finite currency values; its WDV rate path is `asset.py:1014-1039`. |
| Current / expected | A zero carrying-value WDV schedule must be terminal/empty or explicitly validated; `NaN` must never reach Prisma Decimal, reports, or journal lines. |
| Reproduction / impact | Run the direct engine input above or create an opening asset whose accumulation equals cost and salvage is zero. Non-finite values can corrupt persistence or fail later in opaque ways. |
| Root cause / remediation | Zero-book-value handling is missing before the WDV ratio and the caller permits equality. Add a terminal schedule branch and explicit `Number.isFinite` guards at engine and persistence boundaries. |
| Dependencies / tests | Coordinate with AM-005/006 and opening-asset validation. Add zero-book, zero-salvage, zero-book-with-salvage, and persistence rejection tests. |

### AM-024 — CWIP can be reported ready without a CWIP worker

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | health/readiness, CI release gate, CWIP worker |
| Aria evidence | `/health/ready` checks Postgres, depreciation producer, depreciation worker, and depreciation queue events (`health-indicator.service.ts:23-62`, `health.controller.ts:31-40`). It does not inject/check `CwipCapitalizationProcessor` or a CWIP queue. CI checks only `depreciation:queue` (`.github/workflows/ci.yml:171-180`). |
| ERPNext/reference | ERPNext’s CWIP-to-fixed-asset flow is a posting operation, not merely discovery; Asset `asset.py:1073-1088` expects the posting step when the asset becomes available. |
| Current / expected | The supplied log proves CWIP discovery ran with zero work, not that CWIP execution is available. Readiness/release checks must include the CWIP producer/worker/queue or explicitly declare CWIP out of the deployment contract. |
| Reproduction / impact | Stop or misconfigure the CWIP worker while depreciation remains healthy; `/health/ready` can still return 200 and CI can pass while qualified CWIP jobs accumulate. |
| Root cause / remediation | Health indicators model only the original depreciation queue. Add bounded CWIP readiness/metrics and an operator-visible queue gate. |
| Dependencies / tests | Depends on the actual deployment topology. Add health failure/recovery, qualified CWIP enqueue/process, and CI queue-state tests. |

### AM-025 — Maintenance status uses server-local midnight instead of APP_TIME_ZONE

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES** |
| Areas | scheduler, maintenance due/overdue state, timezone |
| Aria evidence | Depreciation discovery correctly uses `businessDate(this.timeZone)` (`depreciation-scheduler.service.ts:169-175`), but `updateMaintenanceStatus()` uses `new Date(); setHours(0,0,0,0)` (`:189-229`). |
| ERPNext/reference | ERPNext compares maintenance due dates with its business date (`asset_maintenance.py:36-43`), not an unrelated server-local midnight. |
| Current / expected | At UTC 18:45 on a Bangalore deployment, business date is the next local day while `today` remains UTC’s current day. Planned tasks can be one day late or early. All Asset date-only jobs must use the configured IANA business timezone. |
| Reproduction / impact | Run scheduler around a UTC/local-day boundary under `APP_TIME_ZONE=Asia/Kolkata` and compare `nextDueDate` at midnight. Status transitions differ by server timezone. |
| Root cause / remediation | The scheduler uses two date helpers: timezone-aware depreciation and server-local maintenance. Centralize date-only business-day calculation. |
| Dependencies / tests | Depends on AM-010. Add UTC/Asia/Kolkata/America/New_York scheduler tests at both boundary directions. |

### AM-026 — Value-adjustment cancellation can overwrite later lifecycle state

| Field | Finding |
|---|---|
| Severity / status / merge | **HIGH / CONFIRMED / YES**; promoted from previous Medium hypothesis |
| Areas | revaluation reversal, snapshots, lifecycle ordering |
| Aria evidence | Cancellation only counts newer submitted adjustments (`asset.service.ts:2818-2829`), reverses its own revaluation/revision, then writes `previousAssetValueAfterDepreciation`, `previousAssetStatus`, and `previousIsFullyDepreciated` back to Asset (`:2850-2868`). It does not require no later repair, capitalization, disposal, or accounting event. |
| ERPNext/reference | ERPNext value-adjustment cancellation validates linked GL/schedule state and restores the selected finance-book state without overwriting later document effects (`asset_value_adjustment.py:44-57,86-157,181-203`). |
| Current / expected | A later lifecycle event can commit after the adjustment but before cancellation; cancellation then restores stale root snapshots. It must be blocked or reversed only when the adjustment is the latest compatible event. |
| Reproduction / impact | Submit adjustment, complete a repair or dispose/reopen-related accounting flow, then cancel the old adjustment. Root status/value can be reverted over the later event. |
| Root cause / remediation | Snapshot restoration is used as a general rollback without a document dependency/sequence check. Add event lineage and per-book/current-version guards. |
| Dependencies / tests | Depends on AM-002/004/018. Add cancellation-after-repair/capitalization/disposal/accounting and concurrent-cancel tests. |

### AM-027 — Draft Asset creation trusts raw company/item references and weak opening validation

| Field | Finding |
|---|---|
| Severity / status / merge | **MEDIUM / CONFIRMED / NO** |
| Areas | Asset creation, Company/Item integration, draft validation |
| Aria evidence | `createAsset()` writes `company` and `itemCode` directly (`asset.service.ts:1337-1387`) and accepts optional available-for-use/date/item references in the shared schema (`packages/types/src/index.ts:6332-6379`). Validation is mostly deferred to later lifecycle/accounting paths. |
| ERPNext/reference | ERPNext `asset.py:381-400` derives/validates item/category/finance-book details and enforces available-for-use semantics before submission. |
| Current / expected | A draft can persist an arbitrary company/item code or incomplete opening configuration. Drafts may be editable, but the system should identify invalid references and reject unsafe submit paths deterministically. |
| Reproduction / impact | Create a draft with a nonexistent item code or company string; inspect the persisted record and subsequent selector/report behavior. |
| Root cause / remediation | Company and item are string contracts without domain relations/lookup validation. Add typed relations or explicit validation at create/submit and document which draft fields may be provisional. |
| Dependencies / tests | Depends on AM-001 and platform Company/Item ownership. Add invalid-reference and submit-failure tests. |

### AM-028 — Repair purchase invoices are not validated against submitted/unallocated invoices

| Field | Finding |
|---|---|
| Severity / status / merge | **MEDIUM / CONFIRMED / NO** |
| Areas | repair costs, purchasing integration |
| Aria evidence | Repair inputs accept invoice identifiers/amounts and `asset.service.ts:5411-5582` validates the Asset/company/status but does not perform ERPNext-equivalent invoice status, account, duplicate, or unallocated-amount checks. |
| ERPNext/reference | `asset_repair.py:86-173` validates submitted Purchase Invoices, expense accounts, duplicates, and available repair cost. |
| Current / expected | A repair can carry a raw/non-submitted invoice reference or exceed available invoice cost. Validate against real Purchase Invoice records where that module is present, or state the intentional platform boundary and reject unsupported references. |
| Reproduction / impact | Create repair with a nonexistent/draft invoice or amount above the invoice balance; current draft path accepts data until later accounting. |
| Root cause / remediation | Asset repair stores invoice references as a separate subledger concern without a typed purchasing relation. |
| Dependencies / tests | Depends on inventory/purchasing ownership. Add duplicate, draft invoice, wrong account, and over-allocation tests. |

### AM-029 — Maintenance task assignment is optional in Aria

| Field | Finding |
|---|---|
| Severity / status / merge | **MEDIUM / CONFIRMED / NO** |
| Areas | maintenance workflow, task accountability |
| Aria evidence | `assignTo` is optional in `packages/types/src/index.ts:6749-6762`; maintenance creation accepts tasks in `asset.service.ts:3905-4081` without requiring an assignee. |
| ERPNext/reference | `asset_maintenance.py:36-48` rejects an unassigned task during draft validation and synchronizes assignment to maintenance logs. |
| Current / expected | A planned maintenance task can exist without an accountable member. Either require a member selector or explicitly implement an unassigned queue state with different operational rules. |
| Reproduction / impact | Create a maintenance record with an empty assignee; it persists and produces a planned log without owner. |
| Root cause / remediation | The contract treats assignment as display metadata rather than a workflow invariant. |
| Dependencies / tests | Depends on the authenticated user/member model. Add create/edit validation and log assignment tests. |

### AM-030 — Asset deletion removes audit history and has no deletion actor

| Field | Finding |
|---|---|
| Severity / status / merge | **MEDIUM / CONFIRMED / NO** |
| Areas | audit trail, deletion authorization, accountability |
| Aria evidence | `asset.router.ts:163-185` calls `deleteAsset()` without `ctx.user.id`. `AssetActivity.userId` is nullable and Asset → Activity is `ON DELETE CASCADE` (`schema.prisma:1650-1662`). `deleteAsset()` has no deletion activity. |
| ERPNext/reference | ERPNext document audit/version history is retained through cancellation/deletion rules; Asset activity records remain useful for accountability. |
| Current / expected | Deleting an eligible draft can permanently remove its activity history and cannot identify the actor. Prefer soft deletion/cancelled state or retained audit records and always attribute the actor. |
| Reproduction / impact | Create/edit a draft, delete it, then query activity. The Asset and cascaded activities are gone; no deletion actor exists. |
| Root cause / remediation | Database cascade and service API were designed for physical cleanup, not audit retention. |
| Dependencies / tests | Depends on retention policy. Add deletion/audit integration tests and owner/admin actor assertions. |

### AM-031 — Deleting a Location nulls historical movement endpoints

| Field | Finding |
|---|---|
| Severity / status / merge | **MEDIUM / CONFIRMED / NO** |
| Areas | location master, movement history, audit reports |
| Aria evidence | `deleteLocation()` checks only current Asset assignments (`asset.service.ts:3037-3049`). Movement source/target location FKs use `ON DELETE SET NULL` (`migration.sql:340-343`). |
| ERPNext/reference | Movement history retains the source/target location identity needed to reconstruct custody; master deletion is normally restricted or archived when referenced. |
| Current / expected | A location with historical movement references can be deleted and old reports lose the endpoint name. Reject/soft-delete referenced locations or snapshot display identity. |
| Reproduction / impact | Submit a movement using Location X, move the Asset elsewhere, delete X, and reopen the movement report. The historical source becomes null. |
| Root cause / remediation | Deletion guard considers only current relation, while historical relation is nullable. |
| Dependencies / tests | Depends on report retention rules. Add history-referenced deletion tests. |

### AM-032 — Document-series year is server-local rather than business-date based

| Field | Finding |
|---|---|
| Severity / status / merge | **MEDIUM / CONFIRMED / NO** |
| Areas | Asset/adjustment/disposal numbering, timezone |
| Aria evidence | `generateAssetSeries()` uses `date.getFullYear()` (`asset.service.ts:258-289`); similar methods use the same pattern. A UTC timestamp representing Bangalore’s next business date can receive the prior server-local year. |
| ERPNext/reference | ERPNext naming/fiscal conventions use the submitted document/business date and configured fiscal semantics, not an accidental process timezone. |
| Current / expected | Documents created around year boundaries can receive the wrong `AST-YYYY`/`AVA-YYYY` prefix. Use canonical date-only/business timezone or make the numbering policy explicit. |
| Reproduction / impact | Pass a date near midnight/year boundary under UTC and `Asia/Kolkata`; compare prefix. The date’s business year and process-local year can differ. |
| Root cause / remediation | Series allocation mixes instant `Date` objects with date-only numbering. |
| Dependencies / tests | Depends on AM-010 and document-series policy. Add timezone/year-boundary allocation tests. |

### AM-033 — Exhausted CWIP failures are removed and silently eligible for repeated retry

| Field | Finding |
|---|---|
| Severity / status / merge | **MEDIUM / CONFIRMED / NO** |
| Areas | CWIP reconciliation, operator visibility, retry semantics |
| Aria evidence | `cwip-capitalization-discovery.service.ts:149-160` removes both `completed` and `failed` BullMQ jobs. The unit suite explicitly proves exhausted failed jobs are removed so discovery can enqueue them again. |
| ERPNext/reference | ERPNext background posting failures remain visible as document validation/accounting errors requiring operator correction; retry must not erase the terminal signal. |
| Current / expected | A permanent account/configuration failure can be repeatedly re-enqueued without a durable terminal job or operator queue. Retain failure state with bounded/manual retry. |
| Reproduction / impact | Make a qualified CWIP job fail permanently, run reconciliation again, and observe the failed job removed and re-created. |
| Root cause / remediation | Discovery treats all terminal states as stale duplicates rather than distinguishing success from permanent failure. |
| Dependencies / tests | Depends on AM-024 and deployment observability. Add failed-job retention, manual retry, and metrics/alert tests. |

### AM-034 — Frontend Asset workflows truncate selectors and can show stale schedules

| Field | Finding |
|---|---|
| Severity / status / merge | **MEDIUM / CONFIRMED / NO** |
| Areas | movement/repair/capitalization/value-adjustment dialogs, cache invalidation |
| Aria evidence | `movement-dialog.tsx:69-73`, `repair-form.tsx:62-65`, and `capitalization-form.tsx:61-65` request only the first 100 Assets; `value-adjustments/form/page.tsx:101` uses a 250-row cap. Asset detail invalidation at `items/[assetId]/page.tsx:110-139,202` targets Asset/list queries but not the separate schedule query, so schedule data can remain stale after disposal/revision. |
| ERPNext/reference | Link fields search server-side and document forms reload linked schedule state after lifecycle changes. |
| Current / expected | Assets beyond the hard page size cannot be selected, and detail pages can show pre-mutation schedules until a full reload. Use server-backed search/pagination and invalidate schedule/detail keys after each lifecycle mutation. |
| Reproduction / impact | Seed more than the selector limit or revise/dispose from a detail page; the intended record/schedule is absent or stale. |
| Root cause / remediation | Convenience list queries are used as selectors and invalidation ownership is incomplete. |
| Dependencies / tests | Depends on organization-scoped search (AM-001). Add large-dataset selector and mutation/reload browser tests. |

### AM-035 — Direct Asset form routes lack frontend write gating

| Field | Finding |
|---|---|
| Severity / status / merge | **MEDIUM / CONFIRMED / NO** |
| Areas | frontend authorization UX, direct navigation |
| Aria evidence | Backend owner/admin procedures enforce writes, and list/detail pages use `useAssetWriteAccess` (for example `items/page.tsx:41-93` and `items/[assetId]/page.tsx:36-87`), but direct form routes such as `items/form/page.tsx` do not consistently prevent a member from opening/editing a write form before the server rejects it. |
| ERPNext/reference | ERPNext hides/blocks document actions based on permissions at the form boundary. |
| Current / expected | A read-only member can reach write UI and receive late RPC errors. Frontend should use the authenticated organization role to gate form actions, while backend remains authoritative. |
| Reproduction / impact | Navigate directly to `/asset/items/form` as a non-owner/admin member and attempt save; the UI presents a write path until the RPC failure. |
| Root cause / remediation | Authorization work focused on list/action affordances, not route-level form guards. |
| Dependencies / tests | Depends on org role context. Add direct-route role matrix tests; do not weaken server checks. |

### AM-036 — Currency precision and total-days options are not wired consistently

| Field | Finding |
|---|---|
| Severity / status / merge | **MEDIUM / CONFIRMED / NO** |
| Areas | depreciation precision/prorata, accounting boundary |
| Aria evidence | Engine defaults to two decimals (`depreciation-schedule-engine.ts:264`) and production does not pass currency precision; accounting subledger rounds at a different precision. Engine supports `calculateUsingTotalDays`, but production lifecycle does not supply it. |
| ERPNext/reference | ERPNext schedule calculations use configured field precision and Accounts Settings total-days behavior (`deppreciation_schedule_controller.py:80`, `depreciation_methods.py:33`). |
| Current / expected | Three/six-decimal currencies and total-days SL can differ between preview, schedule, and posted subledger. Configuration should be explicit and shared. |
| Reproduction / impact | Run a high-precision currency or total-days fixture through preview, schedule, and posting; compare rounding and period amounts. |
| Root cause / remediation | Engine options exist without a single finance/company configuration source. |
| Dependencies / tests | Depends on finance-book contract and accounting precision policy. Add precision and total-days parity fixtures. |

### AM-037 — Demo capitalization does not preserve production target invariants and does not execute CWIP

| Field | Finding |
|---|---|
| Severity / status / merge | **MEDIUM / CONFIRMED / NO** |
| Areas | demo seed, lifecycle proof, CWIP execution |
| Aria evidence | `seed-asset-lifecycle.ts:582-619` creates a target without `assetType` (Prisma default Existing Asset) then creates a `NEW_ASSET` capitalization with that target ID. The seed later verifies discovery (`:1024-1045`) but does not run the CWIP queue/worker. |
| ERPNext/reference | Capitalization target must be Composite Asset (`asset_capitalization.py:186-215`); CWIP posting is a real accounting operation, not just discoverability. |
| Current / expected | Demo data can encode a state production paths reject, and a green seed check is being used as evidence without worker posting. Demo fixtures must use production services or explicitly label static fixtures as non-runtime proof. |
| Reproduction / impact | Load the lifecycle seed, inspect target type and capitalization linkage, then inspect accounting/queue state; the data does not prove the production worker path. |
| Root cause / remediation | Seed code constructs database rows directly and stops at discovery to keep loading deterministic. |
| Dependencies / tests | Depends on AM-009/024 and safe isolated demo mutation workflow. Add disposable load/worker/restart assertions. |

### AM-038 — Asset test fixture enum drift

| Field | Finding |
|---|---|
| Severity / status / merge | **LOW / CONFIRMED / NO** |
| Areas | frontend test fixtures, shared enum contracts |
| Aria evidence | `apps/frontend/src/app/asset/(protected)/dashboard/overview/page.test.tsx:117,127` uses `"PREVENTIVE"` while the shared maintenance enum and other fixtures use `PREVENTIVE_MAINTENANCE`. Current tests do not exercise the mismatch through a typed server response. |
| Current / expected | Fixtures should import/use the shared enum so a renamed or narrowed contract fails at compile time. |
| Remediation / tests | Replace literals with shared enum values and add a fixture type check. |

## 6. Full ERPNext Parity Matrix

| Area | Workflow / invariant | ERPNext behavior | Aria behavior | Status | Severity | Remediation |
|---|---|---|---|---|---:|---|
| Asset creation | Item/company/category/date identity | Item/category and required dates are validated; finance books derive from master data. | Free-text company/item; optional available-for-use; partial validation. | Partial | M | Add ownership/lookup validation and explicit draft policy. |
| Asset submission | Composite prerequisite | Composite Asset requires active capitalization; initial movement/GL/schedules run on submit. | No composite barrier; schedules/activity only; no receipt movement. | Gap | H | AM-003, AM-016. |
| Asset cancellation | Reverse every linked effect | Validates linked state; cancels movement/schedule, deletes depreciation, reverses GL. | Only posted depreciation count is checked; unconditional cancellation. | Gap | H | AM-002, AM-014. |
| Available for use | Ordinary date required; depreciation start not earlier | Enforced except Composite Component. | Optional and purchase-date fallback. | Gap | H | AM-007, AM-010. |
| Composite capitalization | Target type/item/company/status; source value as-of posting | Fully validated and reversible. | Contradictory target accepted; target can be deleted; balance helper mixed scope. | Gap | H | AM-009, AM-013, AM-018. |
| Disposal | Barrier through disposal date; finance-book balance | Disposal-created depreciation is linked and restorable. | Barrier runs; balance is mixed; restore does not reverse barrier entry. | Gap | H | AM-015, AM-018. |
| Movement | Receipt/transfer/issue, company, state, chronology | Initial receipt on submit; latest movement reconstructs state. | Later movement logic is sound; initial receipt missing. | Partial | H | AM-016. |
| Repair | Invoice submitted/status/account/amount; asset state | All validated before posting. | Asset/company/status validated; invoice semantics are raw. | Partial | M | AM-028. |
| Maintenance | Assigned member and date/status | Assignment required; logs synchronized. | Assignment optional; scheduler uses local timezone. | Partial | H/M | AM-025, AM-029. |
| Straight-line | Opening basis, pending periods, prorata/precision | Remaining basis and configured precision/options. | Basic fixtures pass; opening SL basis and options diverge. | Gap | H/M | AM-005, AM-036. |
| DDB | Original useful life rate | `200 / original useful-life years`. | Revision passes remaining periods as total. | Gap | H | AM-021. |
| WDV | Current value/salvage/pending years; zero-value guard | Derives rate with finance-book context. | Stored rate can remain stale; zero book can produce NaN. | Gap | H | AM-006, AM-023. |
| Shift depreciation | Persisted shift factors | Shift factors affect schedule. | Flag exists; allocations not persisted/wired. | Gap | H | AM-022. |
| Finance books | Independent book state and default-book root semantics | Report/posting selects book explicitly/default. | Secondary adjustment can mutate root; reports aggregate books. | Gap | H | AM-008, AM-017, AM-020. |
| Value adjustment | Snapshot/revision cancellation only when safe | Later linked state prevents stale restoration. | Later lifecycle effects can be overwritten. | Gap | H | AM-026. |
| Fixed Asset Register | Exact company, submitted docs, book/date GL maps | Book/date-filtered register. | Fuzzy company, no book input, mixed schedules. | Gap | H | AM-017. |
| CWIP | Discovery plus real posting/worker readiness | Posting completes accounting transition. | Discovery/worker graph exists, but readiness and demo proof omit CWIP worker. | Partial | H/M | AM-024, AM-033, AM-037. |
| Audit activity | Actor and durable document history | Asset activity/version history remains attributable. | Delete cascades activity; delete route drops actor. | Partial | M | AM-030. |
| Location history | Referenced master identity remains reportable | Historical movement remains reconstructable. | Location deletion SET NULLs movement endpoints. | Gap | M | AM-031. |

## 7. Cross-Cutting Architectural Findings

### Organization isolation

Organization membership is implemented as an authorization gate, not as data ownership. The minimum safe model is `Organization → Company → Asset` (and the same path for categories, locations, finance books, maintenance, reports, accounting, events, and queues). Until that exists, every ID lookup is a potential confused-deputy path.

### Transaction boundaries and state machine

Asset domain documents have separate state transitions and downstream postings. The safe invariant is:

```text
lock document + asset(s)
  → re-read expected status and effective date
  → validate all linked documents/books
  → post/reverse accounting and stock
  → revise/close schedules
  → update root/book cursors
  → write attributed activity
  → conditional document transition
```

The current branch has good transaction/lock patterns in movement, repair, and disposal, but submission/configuration, cancellation, value-adjustment rollback, and timestamp lineage are not uniformly inside that invariant.

### Date-only representation

The repository has a good timezone-aware depreciation helper (`depreciation.config.ts:144-170`), but Asset forms, reports, scheduler maintenance, series naming, and some backend filters still use ordinary JavaScript Date/local-midnight conversions. Date-only values must be represented canonically (for example `YYYY-MM-DD` at the contract boundary), converted once for Prisma/query windows, and tested under UTC, Asia/Kolkata, and America/New_York.

### Finance-book ownership

The current root Asset fields are a compatibility projection. Book-specific values belong to `AssetFinanceBook`. Every adjustment, revision, disposal, capitalization, report, and dashboard aggregation must answer “which book, as of which date?” before touching root state.

### Reversibility and lineage

Reversal code based on `createdAt` or snapshots is insufficient when barrier postings and effective posting dates can differ. Documents need explicit source/lineage IDs for depreciation created by disposal/capitalization/repair and sequence/version guards for later effects.

### Background processing

Scheduler discovery should remain discovery-only and workers should remain execution-only. That separation is sound. Readiness, terminal failure retention, queue metrics, and demo verification must cover both depreciation and CWIP paths; a discovery log with `enqueued: 0` proves no work was found, not worker correctness.

### Accounting boundary

`AssetAccountingService` provides balanced, idempotent Asset-domain entries and is a useful subledger boundary. The merge gate should not demand statutory GL equivalence until the shared accounting platform exists, but every Asset-domain entry must still be book/date/company scoped and reversible.

## 8. Test Coverage Audit

### Current results obtained in this audit

| Layer | Result | What it proves | What it does not prove |
|---|---|---|---|
| Backend Asset unit | **253 passed / 30 files** via serial `bun ./scripts/run-unit-tests.ts asset` | Existing service/report/engine assumptions execute. | Organization isolation, most counterexamples above, real Prisma FK behavior, concurrent database races. |
| Backend health unit | **3 passed** | Readiness success/failure behavior for the modeled indicators. | CWIP readiness because no CWIP indicator exists. |
| Fixed register unit | **3 passed** | Mocked grouping/basic NBV arithmetic. | Two finance books, exact company, real postings, organization scope. |
| Depreciation integration | **1 passed** | PostgreSQL/Redis/queue/worker graph boots. | Financial parity fixtures and full lifecycle persistence. |
| Migration status | **48 migrations up to date** | Current local database is at migration head. | Upgrade from previous production head and empty-database compatibility. |
| Demo safety | Passed | Destructive demo operations fail closed without explicit flags/isolation. | Load twice, cleanup/reload, worker processing, restart/idempotency. |
| Frontend Vitest | **168 files / 1,443 tests passed** | UI utilities/components render under mocks. | Authenticated server persistence, organization isolation, full Asset mutation workflow. |
| Typecheck | Passed, all 7 workspace packages | Static contract compatibility. | Runtime data ownership and date semantics. |
| Lint | Passed, backend 244/frontend 706 files checked | Formatting/style correctness. | Business correctness. |
| Production build | Passed; Next.js 16.2 Turbopack build | Compile and route generation; 129 static pages generated. | Development-only intermittent Turbopack panic and runtime data behavior. |
| Authenticated E2E | Not run as a full data-backed gate | Existing harness can sign in/visit Asset routes. | Create → submit → queue → reload → report and cross-organization denial. |

The first attempt to run three backend filters concurrently exposed a test-runner hazard: all instances delete/recreate the shared `apps/backend/.test-dist` directory, producing an ENOENT. A required serial rerun passed. This is a test-tooling concurrency caveat, not a product finding, but CI/local instructions should not run that helper concurrently without isolated output directories.

### Required regression coverage by finding

No existing test proves AM-001/012 tenant isolation or event privacy. No existing test proves AM-002/013/014/015/026 linked-state reversal under concurrent or later events. Existing depreciation tests cover ordinary fixtures but not AM-005/006/021/022/023 opening/revision/shift/NaN cases. Existing frontend tests assert fields that exist, so they do not catch AM-019/020 omission. Existing report tests are mocked and do not catch AM-017/018.

## 9. Remediation Dependency Graph

```text
Organization → Company ownership model (AM-001)
        ↓
Typed org context in router/service/repository contracts
        ↓
Same-org relation checks + composite uniqueness/indexes
        ├──────────────→ organization-scoped reports/dashboards (AM-017/018)
        ├──────────────→ org-scoped realtime topics (AM-012)
        └──────────────→ cross-org integration/E2E tests

Canonical date-only contract (AM-010)
        ↓
Shared UTC/business-timezone helpers
        ├──────────────→ forms/dialogs and report windows
        ├──────────────→ scheduler maintenance/series naming (AM-025/032)
        └──────────────→ lifecycle posting/reversal chronology

Finance-book balance and lineage model (AM-008/018)
        ↓
Book/date-aware depreciation revision and journal source IDs
        ├──────────────→ disposal/capitalization restore (AM-004/015)
        ├──────────────→ value-adjustment cancellation (AM-026)
        └──────────────→ fixed register/report correctness (AM-017)

Lifecycle state/lock transaction protocol (AM-002/003/014)
        ↓
Target protection + initial movement + reversible document effects
        ↓
Database integration and concurrency tests

Shared finance-book contract/UI (AM-019/020/021/022/023)
        ↓
Parity fixtures for SL/DDB/WDV/shift/precision
        ↓
Posting, report, and browser persistence tests

CWIP health/retry contract (AM-024/033/037)
        ↓
Disposable demo load → worker process → reload/restart proof
```

Parallel work is safe only after the ownership/date contracts are agreed: UI form work can proceed in parallel with ERPNext numerical fixtures, while lifecycle reversal and reports must consume the same book/date/lineage model.

## 10. Recommended Implementation Waves

### Wave 1 — trust boundary and canonical primitives

- Address AM-001 and AM-012 first: Organization/Company ownership, org context propagation, predicates, relation checks, event topics, and tenant tests.
- Establish a canonical date-only type/helper and business-timezone policy for AM-010, AM-025, and AM-032.
- Decide retention/soft-delete policy for AM-030/031.
- Validation: Prisma migration on empty and upgraded databases; cross-org API/event tests; timezone unit tests.

### Wave 2 — financial/depreciation correctness

- Address AM-005/006/008/017/018/020/021/022/023/026/036.
- Separate original life, booked periods, carrying value, selected book, effective date, rate source, precision, and shift allocation inputs.
- Add source lineage for revision/disposal/capitalization entries and non-finite guards.
- Validation: ERPNext-derived numerical fixtures, two-book integration tests, precision tests, posted journal/reversal reconciliation.

### Wave 3 — lifecycle state and reversibility

- Address AM-002/003/004/013/014/015/016.
- Make submission/cancellation one locked transaction; protect submitted capitalization targets; create idempotent initial receipt movement; reverse exact barrier effects.
- Validation: status matrix, later-event guards, failure injection, concurrent requests, cancellation/retry tests.

### Wave 4 — frontend contract and workflow parity

- Address AM-019/020/029/034/035 plus AM-027/028 input UX.
- Round-trip all shared fields, add Asset-type conditional UI, server-backed selectors, assignment controls, direct-route write gating, and complete invalidation.
- Validation: component tests plus authenticated browser persistence tests against a seeded database; do not copy ERPNext UI.

### Wave 5 — background/demo/release proof

- Address AM-024/033/037, previous demo/E2E hypotheses, docs corrections, and fixture drift AM-038.
- Add CWIP readiness/retry visibility and run explicit isolated load/process/reload/restart cycles.
- Validation: full `bun run validate`, migration compatibility, authenticated E2E, queue recovery, demo idempotency, runtime readiness, and exact SHA CI.

## 11. Merge Gate

### MUST FIX before merge

- [ ] AM-001 organization/company ownership and all Asset/report/event predicates.
- [ ] AM-012 org-scoped realtime event fan-out.
- [ ] AM-002/003/004/013/014/015/026 lifecycle state, lineage, locks, target protection, and reversal correctness.
- [ ] AM-005/006/007/008/017/018/021/022/023 financial/depreciation/book/report correctness.
- [ ] AM-010 canonical date-only handling and AM-025 scheduler timezone correctness.
- [ ] AM-019/020 frontend round-trip of Asset type and finance-book settings.
- [ ] Regression tests for every BLOCKER/HIGH, including real database isolation and concurrent transitions.

### SHOULD FIX before release or explicitly record a dated owner

- [ ] AM-016 initial receipt movement and AM-027/028/029 domain-reference validation.
- [ ] AM-024/033 CWIP readiness, terminal failure retention, and worker proof.
- [ ] AM-030/031 audit/location retention policy.
- [ ] AM-034/035 selector, invalidation, and direct-route UX gates.
- [ ] Full demo load/process/reload/restart and authenticated E2E.

### OPTIONAL / can be deferred after ownership

- [ ] AM-032 series naming policy if the product explicitly accepts server-time numbering.
- [ ] AM-036 configurable precision/total-days if the supported finance policy explicitly excludes those options.
- [ ] AM-038 fixture cleanup and brochure/client-guide wording, provided stale links are not presented as current release instructions.
- [ ] Turbopack panic root-cause investigation, unless the panic becomes deterministic or affects production build/runtime.

## 12. Recommended Validation Matrix

Run after remediation from a clean worktree and exact candidate SHA:

| Concern | Repository-native validation |
|---|---|
| All packages | `bun run validate` |
| Backend Asset suites | `bun --cwd apps/backend run test` (serial helper); targeted new integration specs |
| Depreciation | `bun --cwd apps/backend run test:depreciation:unit`, `bun --cwd apps/backend run test:depreciation:integration` |
| Migration compatibility | `bun --cwd apps/backend run test:depreciation:migrations` and `bun --cwd apps/backend run db:verify-migrations` |
| Frontend | `bun --cwd apps/frontend run test`, `bun --cwd apps/frontend run typecheck` |
| Browser workflow | `bun run test:e2e` with seeded authenticated organization, create/submit/process/reload/report assertions |
| Tenant isolation | Two organizations, same roles, cross-org CUID reads/writes/reports/subscriptions must return forbidden/not-found and no event payload |
| Dates | Unit/integration matrix under `TZ=UTC`, `TZ=Asia/Kolkata`, `TZ=America/New_York`, plus `APP_TIME_ZONE` boundary tests |
| Depreciation fixtures | Opening SL, DDB/WDV revision, shift, zero book, precision, prorata, exact month-end, and two finance books |
| Lifecycle | Submit/cancel/dispose/restore/capitalize/repair/value-adjustment later-event and concurrent transition tests |
| Runtime | Backend `/health/ready` exact 200 only with Postgres, depreciation, CWIP, Redis producer/events/worker healthy; frontend `/ready/` exact 200 |
| Demo | `bun --cwd apps/backend run demo:load:small` only in an explicitly isolated database; run status, load, process, reload, cleanup, second load, restart and duplicate-journal checks |
| Release CI | Verify the exact GitHub Actions run/check suite for the candidate SHA is green before any Railway/production deployment. |

For the attached Turbopack incident, run standalone and root `bun run dev` under Turbopack, request `/auth/sign-in/?callbackUrl=%2F` and Asset routes concurrently, and archive the panic log if it recurs. A 200 response alone does not prove the panic is harmless; the panic artifact and repeatability are required for root-cause closure.

## 13. Documentation Corrections

Do not edit these documents as part of this audit. Correct them in the implementation/documentation wave:

- `docs/asset-management-gap-analysis.md:58-74` should describe the current 23-commit branch and current 14 functional nav leaves, or clearly label historical pre-branch scope.
- The same report’s “resolved” statements around multi-book adjustment, lifecycle completion, and CWIP should be revised to reference AM-008/017/018/024 and the remaining release gates.
- `docs/asset-management-brochure-report.md:48,121,135,150,180-182,227-235` uses four submodules and legacy `/asset/asset-sub-module/...` URLs. Replace with current canonical routes and do not claim statutory register completeness until AM-017 is fixed.
- `docs/asset-management-client-guide.md:42,439,574,928-945` describes stale route paths and says no asset register/barcode support even though current code exposes those surfaces. Reconcile limitations with the actual API/UI contract and clearly state the organization/company ownership limitation.
- Demo documentation should distinguish discovery-only verification from CWIP worker posting and state the required isolated mutation flags.

## 14. Final Recommendation

1. **Is the branch mergeable now?** No.
2. **Why?** The authorization boundary and realtime boundary are not tenant-safe; financial and lifecycle paths can produce incorrect books or irreversible states; frontend forms omit supported domain semantics; the release tests do not exercise these counterexamples.
3. **What blocks merge?** AM-001 and AM-012 are absolute blockers. AM-002 through AM-011 and AM-013 through AM-026 are high-severity correctness/reversal/financial findings that must be resolved before merge.
4. **Minimum safe sequence?** Establish Organization/Company ownership and date-only primitives, then implement book/date/lineage-aware depreciation/reporting, then lock/rework lifecycle reversals and target protection, then round-trip frontend contracts, then execute authenticated and isolated runtime/demo gates.
5. **What can be deferred?** Low documentation/fixture cleanup, optional precision/numbering policy decisions, and the currently non-deterministic development-only Turbopack panic investigation can follow only if they are explicitly owned and do not mask a production/runtime failure.

The audit branch contains only this report and is ready for a focused documentation commit. It must not be merged as evidence that the parent branch is production-ready; it is a remediation plan and merge-gate record.
