# Asset Management Remediation Runbook

## 1. Purpose

This document converts the completed deep Asset Management audit into an executable remediation graph. The deep audit remains authoritative for discovery, evidence, severity, and the current merge verdict. This runbook is authoritative for execution order, bounded remediation-unit scope, validation gates, independent review, and verified closure.

The intended operator should be able to start a fresh GPT-5.6-luna(max) session with only:

1. the Aria repository;
2. the deep audit;
3. this runbook; and
4. one remediation-unit ID.

That session must be able to implement and test one bounded unit without re-auditing the entire branch or opportunistically changing adjacent behavior.

This is a planning artifact. It does not implement production fixes, change application behavior, change any file in a ui folder, or claim that the audited branch is safe to merge.

The central execution sequence is:

    confirmed root cause
        -> architectural prerequisite
        -> bounded remediation unit
        -> behavior-focused regression proof
        -> independent fresh-context review
        -> one atomic implementation commit
        -> wave integration gate
        -> VERIFIED_CLOSED

Severity does not override dependency order. A foundational medium-severity contract may be required before a blocker or high-severity fix can be implemented safely.

## 2. Current Branch State

| Item | Confirmed state |
|---|---|
| Planning branch | plan/asset-gap-remediation-runbook |
| Branch created from | audit/asset-gap-remediation-deep-review |
| Audit HEAD at planning start | b4f8e03c44b |
| Parent feature branch | feat/asset-gap-remediation |
| Parent branch point in audit | 9820df9eb4c02ceba47f62eb69882e6117a3f698 |
| Deep audit | docs/_branch-audits/asset-gap-remediation/deep-gap-investigation.md |
| Original gap analysis | docs/asset-management-gap-analysis.md |
| Planning output | docs/_branch-audits/asset-gap-remediation/remediation-runbook.md |
| Planning scope | documentation and planning only |
| Merge target | no merge during this task |

The audit checkout was clean before the planning branch was created. The audit commit contains the deep report only; it did not change application code, schema, an existing gap-analysis document, or a ui folder. This branch must remain equally narrow. Before commit, verify that the only changed path is the runbook, unless a separately justified planning-only companion is explicitly added.

Do not branch from master. Do not rewrite, rebase, squash, amend, or merge existing history. Future implementation sessions must branch from the remediation lineage selected by the maintainer and must not modify the audit report merely to make a unit appear closed.

## 3. Sources of Truth

| Concern | Source to inspect | Use |
|---|---|---|
| Audit discovery, evidence, finding IDs, severity | docs/_branch-audits/asset-gap-remediation/deep-gap-investigation.md | Primary finding record and evidence trail |
| Asset business rules, workflow, dates, depreciation, finance books, cancellation, reversal | .erpnext/erpnext/assets and the exact files named in the audit | Business-rule source of truth; inspect actual functions before implementation |
| Aria backend architecture and persistence | apps/backend/src/apps/asset, apps/backend/prisma/schema.prisma, migrations, tRPC context/router | Implementation boundary and current behavior |
| Aria shared contracts | packages/types/src/index.ts and generated API contracts | Request/response and enum source |
| Aria UI/UX | apps/frontend Asset routes, components, tests, and existing auth hooks | Product UI source of truth; do not copy ERPNext UI |
| Runtime and release behavior | package scripts, .github/workflows, Docker Compose, deployment docs | Repository-native validation and release evidence |
| This runbook | this file | Dependency order and execution protocol |

The relevant ERPNext references already verified in the audit include:

- .erpnext/erpnext/assets/doctype/asset/asset.py for submission, cancellation, available-for-use validation, and DDB/WDV rate derivation.
- .erpnext/erpnext/assets/doctype/asset_capitalization/asset_capitalization.py for target identity, company/item/type validation, as-of values, and reversal.
- .erpnext/erpnext/assets/doctype/asset/depreciation.py for disposal-date barrier reversal and restore behavior.
- .erpnext/erpnext/assets/doctype/asset_depreciation_schedule/depreciation_methods.py for straight-line, daily, shift, WDV, and DDB calculation semantics.
- .erpnext/erpnext/assets/doctype/asset_movement/asset_movement.py for movement validation, chronology, and state reconstruction.
- .erpnext/erpnext/assets/doctype/asset_repair/asset_repair.py for invoice validation and repair invariants.
- .erpnext/erpnext/assets/doctype/asset_maintenance/asset_maintenance.py for assignment requirements.
- .erpnext/erpnext/assets/report/fixed_asset_register/fixed_asset_register.py for exact company, date, fiscal, and finance-book report selection.

ERPNext is a business-rule reference, not an instruction to reproduce its internals or UI. Aria must preserve its own service boundaries, shared contracts, accounting boundary, and user experience.

## 4. Operating Rules

1. Do not implement production fixes as part of this planning task.
2. Do not modify application code, Prisma schema, migrations, tests, or any file inside a ui folder while producing this runbook.
3. Treat the organization trust boundary, date-only representation, finance-book selection, and lifecycle lineage as architectural contracts. Do not patch only the currently visible caller.
4. Use the smallest unit that is independently understandable, testable, reviewable, and revertible. Do not turn every finding into a separate task, and do not create a mega-unit spanning unrelated invariants.
5. A unit may close several findings when they share a root invariant. A finding may have a prerequisite unit and a primary closure unit; the matrix identifies the primary unit exactly once.
6. A future implementation session may inspect adjacent code, but it may implement only its assigned unit. Adjacent defects go into the review report or a follow-up note, not into the current diff.
7. Every BLOCKER and HIGH finding must have named behavior-focused regression tests. “Existing tests should cover it” is not sufficient without an exact test target and an explanation of the proven invariant.
8. Every implementation session stops without committing. A fresh independent session reviews the uncommitted diff. Only a PASS permits the implementation session or maintainer to create the atomic commit.
9. IMPLEMENTED is not resolved. A unit becomes VERIFIED_CLOSED only after independent review PASS and its wave-level integration gate.
10. Never suppress warnings, errors, types, failed tests, or migration failures. Do not add fake tests or weaken validation to obtain green output.
11. Preserve the scheduler/discovery-only and BullMQ/worker-execution-only split. Do not move accounting execution into a scheduler shortcut.
12. Do not claim statutory accounting equivalence where Aria does not have the required shared platform subsystems. Prove the Asset-domain subledger invariants that Aria actually owns.
13. Run the backend helper suites serially unless they are given isolated output directories. The audit observed concurrent helpers racing over apps/backend/.test-dist.
14. Use the exact repository-native commands listed in this runbook and re-check package scripts before using a command that may have changed.
15. Do not merge the planning branch during this task. Push it for review only after the runbook and Git-scope checks pass.

### Required future unit workflow

    Fresh Luna session
        -> read the assigned unit first
        -> read only its linked audit evidence and architecture references
        -> inspect .erpnext where the unit has business-rule dependencies
        -> use at most 2-3 bounded read-only sub-agents if useful
        -> main session is the sole production-code writer
        -> implement only the assigned unit
        -> add regression tests in the same diff
        -> run Level 1 focused validation
        -> run the unit's required broader validation
        -> inspect git diff, git status, and git diff --check
        -> stop without committing
        -> obtain fresh-context independent review
        -> correct and re-review if needed
        -> commit only after PASS

## 5. Finding Summary

The deep audit records 47 findings: 2 BLOCKER, 24 HIGH, 18 MEDIUM, and 3 LOW. The named Asset findings are AM-001 through AM-038. The audit also carries nine earlier hypotheses; the stale value-adjustment snapshot hypothesis was promoted to AM-026 and is not counted again.

### Severity and merge gate

| Severity | Findings | Initial merge classification |
|---|---|---|
| BLOCKER | AM-001, AM-012 | MUST FIX BEFORE MERGE |
| HIGH | AM-002 through AM-011; AM-013 through AM-026 | MUST FIX BEFORE MERGE |
| MEDIUM | AM-027 through AM-037; P-001, P-002, P-003, P-005, P-007, P-009, P-010 | SHOULD FIX BEFORE MERGE or explicitly defer with owner and evidence |
| LOW | AM-038; P-006, P-008 | SAFE TO DEFER only with documentation ownership and no stale release instruction |

### Earlier hypothesis IDs used by this runbook

| Runbook ID | Deep-audit hypothesis | Severity |
|---|---|---:|
| P-001 | Playwright Asset coverage is mostly smoke-level and does not prove authenticated persisted workflows | MEDIUM |
| P-002 | Location hierarchy permits cycles | MEDIUM |
| P-003 | Maintenance forms require raw CUIDs instead of domain selectors | MEDIUM |
| P-004 | Value-adjustment cancellation restores stale snapshots; promoted to AM-026 | PROMOTED |
| P-005 | WDV preview and persistence use inconsistent period conventions | MEDIUM |
| P-006 | Legacy maintenance documentation/routes are stale | LOW |
| P-007 | Demo load-twice, cleanup, reload, worker, and restart proof is incomplete | MEDIUM |
| P-008 | The gap-analysis report has stale counts and terminology | LOW |
| P-009 | Asset creation and finance-book/activity creation are not one transaction | MEDIUM |
| P-010 | Chronology guards are incomplete across cancellation, restore, and value aggregation | MEDIUM |

P-004 appears in the matrix only as the promoted AM-026 finding. This prevents double-counting while preserving the discovery history.

### Current confirmed blockers

- AM-001: organization membership is checked, but organization ownership is not propagated into Asset data access. Asset.company is free text, Company has no Organization relation, and direct ID access is global.
- AM-012: Asset realtime events are emitted globally with full Asset payloads and no organization topic/filter. Query predicates alone cannot close this leak.

The blockers share the foundational dependency R-001, the canonical ownership model, and R-002, trusted organization context propagation. AM-012 remains a separate unit because event fan-out, payload minimization, and subscription teardown are a distinct security boundary.

## 6. Root-Cause Grouping

| Root cause | Required invariant | Remediation units |
|---|---|---|
| Organization membership is not data ownership | Every Asset and related master/document lookup is scoped through the active organization and Company ownership relation | R-001, R-002, R-003 |
| Instant Date objects are used for date-only business fields | Contract values remain YYYY-MM-DD; conversion to UTC/query windows happens once; business-day jobs use APP_TIME_ZONE | R-004, R-019 |
| Root Asset fields and finance-book rows are mixed | Selected finance book and effective date are explicit; root fields are only a defined compatibility projection | R-005, R-006 |
| Depreciation engine and revision use different bases | Opening accumulation, booked periods, original life, salvage, shifts, precision, and rate source remain distinct numeric inputs | R-007, R-008, R-009 |
| Lifecycle transitions and reversals are not one guarded protocol | Lock, re-read, validate linked effects, post/reverse, update schedules and state, and write activity atomically | R-010, R-011, R-012, R-013, R-014 |
| Domain references and history are permissive | Invalid company/item/invoice/member references fail deterministically; history and deletion actors remain attributable | R-015, R-016, R-017 |
| Shared contracts and UI forms omit supported semantics | Asset type and all supported finance-book controls round-trip without silent defaulting; direct routes respect role UX | R-018, R-019, R-020 |
| Background readiness and demo proof cover discovery but not execution | CWIP health, failure retention, worker processing, and disposable load/reload/restart evidence are explicit | R-021, R-022 |
| Documentation and fixtures drift from executable contracts | Low-severity docs and fixtures are corrected or explicitly owned without presenting stale routes or claims as current | R-023 |

## 7. Dependency Graph

### Trust and canonical primitives

    R-001 Organization -> Company -> Asset ownership model
        |
        v
    R-002 Trusted organization context and service/query scoping
        |
        +----------------------> R-003 Organization-scoped realtime events
        |
        +----------------------> R-006 Exact, book/date-aware reports
        |
        +----------------------> R-020 Server-backed selectors and route gates

    R-004 Canonical date-only and business-timezone contract
        |
        +----------------------> R-005 Finance-book/as-of balance queries
        +----------------------> R-007 Depreciation basis and zero-value guards
        +----------------------> R-010 Lifecycle date/state validation
        +----------------------> R-019 Frontend date hydration and default preservation

### Finance and depreciation

    R-001 + R-004
        |
        v
    R-005 Independent finance-book state and root projection
        |
        +----------------------> R-006 Fixed Asset Register and report scope
        +----------------------> R-008 Revision rate/life/date semantics
        +----------------------> R-014 Value-adjustment chronology and rollback

    R-004
        |
        v
    R-007 Opening-basis, WDV, and non-finite schedule invariants
        |
        +----------------------> R-008 Revision semantics
        +----------------------> R-009 Shift, precision, and total-days options

### Lifecycle and reversibility

    R-005 + R-007 + R-009
        |
        v
    R-010 Locked submit/cancel state machine
        |
        +----------------------> R-013 Initial receipt movement
        +----------------------> R-014 Safe value-adjustment cancellation
        |
        v
    R-011 Capitalization target and source lineage
        |
        v
    R-012 Disposal barrier and restore reversal

    R-001 + R-004
        |
        +----------------------> R-015 Draft/reference validation transaction
        +----------------------> R-016 Repair invoice and maintenance assignment
        +----------------------> R-017 History retention and location topology

### Frontend and release proof

    R-009 + R-010 + R-011
        |
        v
    R-018 Asset-type and finance-book form round-trip
        |
        v
    R-019 Date-only form hydration and category-default protection

    R-002 + R-010
        |
        v
    R-020 Search/pagination, invalidation, and direct-route write gating

    R-010 + R-011 + R-012 + R-013 + deployment topology
        |
        v
    R-021 CWIP readiness, retry retention, and demo runtime proof
        |
        +----------------------> R-022 Authenticated persisted E2E and release evidence

    R-023 Fixture and documentation alignment may follow the relevant contract units.

## 8. Remediation Waves

### Wave 1 — trust boundary and canonical date primitives

Objective: establish the organization ownership boundary, carry trusted organization context, isolate realtime events, and make date-only/business-timezone semantics available before financial and lifecycle consumers are changed.

Units: R-001, R-002, R-003, R-004.

Prerequisites: the current audit branch and source-of-truth files only.

Parallel execution:

- R-001 is the first unit and is serial because it defines the migration and relation shape consumed by every later unit.
- R-004 may be implemented in parallel with R-001 only if the session owners agree on shared-contract ownership and do not edit the same files.
- R-002 follows R-001 and is serial with R-003 because the event topic must use the same trusted organization context.

Collision risks: schema.prisma and packages/types/src/index.ts are high-contention. asset.router.ts is high-contention between R-002 and R-003. Do not run R-002 and R-003 concurrently.

Wave validation: fresh and upgraded migration paths; two-organization Asset read/write/report denial tests; two-organization subscription privacy tests; date-only helper tests under UTC, Asia/Kolkata, and America/New_York; git diff --check.

Exit criteria:

- [ ] Company and every Asset ownership path has a documented, enforced organization boundary.
- [ ] Direct CUID, barcode, related-document, report, and selector lookups cannot cross organizations.
- [ ] Realtime topics filter by trusted organization and emit only invalidation-safe metadata.
- [ ] Date-only values do not shift at any tested timezone boundary.

### Wave 2 — finance-book and depreciation correctness

Objective: make book/date selection explicit, correct the opening depreciation basis and non-finite edge cases, preserve ERPNext-compatible revision semantics, and wire supported finance options without silent loss.

Units: R-005, R-006, R-007, R-008, R-009.

Prerequisites: Wave 1; R-001 and R-004 are mandatory.

Parallel execution:

- R-007 can proceed in parallel with R-005 after R-004 because the engine/test surface is separate from the ownership and balance-service surface.
- R-006 must follow R-005 and R-007 so report fixtures use the final book/date balance contract.
- R-008 must follow R-005, R-007, and R-009. It changes revision inputs and must not be based on a pre-option engine.

Collision risks: R-005/R-006 both touch Asset service/report selection; R-007/R-008/R-009 share depreciation engine and revision files. Keep the engine sequence serial: R-007, R-009, then R-008.

Wave validation: numeric ERPNext-derived fixtures; two independent finance books; opening SL, DDB, WDV, shift, precision, and total-days cases; persisted journal and root-projection assertions; exact-company and as-of report integration.

Exit criteria:

- [ ] Every workflow states its finance book and effective date or uses a documented default resolution.
- [ ] Root Asset values cannot be overwritten from a secondary book.
- [ ] Opening basis, WDV/DDB rate, revision cadence, shifts, precision, and total-days behavior are numerically proven.
- [ ] No NaN or Infinity can reach persistence, reports, or accounting lines.

### Wave 3 — lifecycle state, lineage, and history

Objective: make lifecycle documents transactional, protect capitalization targets, reverse exact disposal effects, create the initial receipt movement, validate domain references, and preserve audit/location history.

Units: R-010, R-011, R-012, R-013, R-014, R-015, R-016, R-017.

Prerequisites: Wave 1; R-005, R-007, and R-009 for finance-book and schedule behavior.

Parallel execution:

- R-015, R-016, and R-017 are conceptually separable but all are likely to touch AssetService and schema-adjacent code. Run them serially unless file ownership is explicitly disjoint.
- R-010 is the state-machine prerequisite and must precede R-011 through R-014.
- R-011 and R-012 must not run concurrently because both modify capitalization/disposal lineage and reversal guards in the same service.
- R-013 can begin after R-010, but its movement transaction must consume the final submit/cancel protocol.

Collision risks: asset.service.ts is HIGH for every unit in this wave. Prisma migration files are HIGH for R-011 and R-017. Use one reviewed commit per unit, never a shared live edit.

Wave validation: lock/failure-injection/concurrency integration; create-submit-cancel and create-capitalize-cancel scenarios; disposal mid-period restore; movement reconstruction; invalid reference rejection; deletion actor/history and location cycle/reference tests.

Exit criteria:

- [ ] Every transition locks, re-reads, validates linked effects, and commits state/schedule/accounting/activity atomically.
- [ ] Later events cannot be overwritten by stale snapshots or timestamp guesses.
- [ ] Composite target, source asset, movement, disposal, repair, maintenance, and deletion invariants are behavior-tested.
- [ ] History remains attributable and reconstructable.

### Wave 4 — frontend contracts and workflow parity

Objective: expose the supported Asset types and finance-book settings, preserve persisted values during hydration, and make selectors, cache invalidation, and direct-route authorization match server behavior.

Units: R-018, R-019, R-020.

Prerequisites: Wave 1; R-009 and R-010; R-011 where composite target conditions are rendered.

Parallel execution:

- R-018 and R-019 are serial because both are likely to edit the main Asset form route.
- R-020 can proceed in parallel with R-018 only with explicit file ownership for movement/repair/capitalization/value-adjustment dialogs and route guards.

Collision risks: apps/frontend/src/app/asset/(protected)/items/form/page.tsx is HIGH between R-018 and R-019. Shared Asset contracts are HIGH between R-018 and earlier backend units. No implementation session may modify any ui folder.

Wave validation: frontend Vitest targeted files; contract round-trip tests; role-matrix direct-route tests; large-dataset selector tests; authenticated browser persistence and invalidation checks.

Exit criteria:

- [ ] Asset type and every supported finance-book field survives create/edit round-trip.
- [ ] Category defaults never overwrite persisted values after asynchronous hydration.
- [ ] Date-only inputs preserve the selected calendar day.
- [ ] Read-only members see a gated direct form and still encounter authoritative server denial if they bypass the UI.
- [ ] Selectors search the server and lifecycle mutations invalidate all affected detail/schedule keys.

### Wave 5 — background processing, demo proof, release evidence, and hygiene

Objective: prove the full runtime graph, make CWIP failure visible and recoverable, exercise persisted authenticated workflows, and reconcile low-severity docs/fixtures without weakening the merge gate.

Units: R-021, R-022, R-023.

Prerequisites: Waves 1-4 for the full release gate. R-021 can add its health contract after the queue topology is confirmed, but final proof waits for lifecycle and finance fixes.

Parallel execution:

- R-021 is serial with final runtime validation because it changes readiness semantics.
- R-022 follows all user-facing workflow units and must run against a disposable, migrated, authenticated database.
- R-023 can proceed in parallel with R-022 if documentation does not claim behavior that R-022 is still measuring.

Collision risks: .github/workflows/ci.yml and health indicator files are HIGH for R-021. E2E fixture files are MEDIUM for R-022. Documentation and enum fixture files are LOW for R-023.

Wave validation: bun run validate; serial Asset backend tests; frontend tests; depreciation integration and migration compatibility; fresh/legacy migration; authenticated persisted E2E; exact /health/ready and /ready/ checks; demo load/process/reload/cleanup/load-twice/restart/idempotency; exact-SHA CI evidence.

Exit criteria:

- [ ] CWIP readiness reflects the actual worker/queue deployment contract.
- [ ] Exhausted failures remain visible and require bounded/manual retry.
- [ ] Demo proof executes production services in an isolated database and proves restart/idempotency.
- [ ] Browser tests prove persisted create -> submit -> process -> reload -> report behavior.
- [ ] Low-severity docs and fixtures are corrected or explicitly deferred with an owner.

## 9. Remediation Unit Summary

| Unit | Engineering outcome | Findings | Highest severity | Wave | Complexity | Prerequisites | Parallelization | Session |
|---|---|---|---:|---:|---|---|---|---|
| R-001 | Establish Organization -> Company -> Asset ownership | PARTIAL AM-001 | BLOCKER | 1 | LARGE | None | First; serial | /GOAL RECOMMENDED |
| R-002 | Propagate organization context through Asset access | AM-001 primary | BLOCKER | 1 | LARGE | R-001 | Serial after R-001 | /GOAL RECOMMENDED |
| R-003 | Isolate Asset realtime topics and payloads | AM-012 | BLOCKER | 1 | MEDIUM | R-001, R-002 | Serial after R-002 | /GOAL RECOMMENDED |
| R-004 | Canonicalize date-only and business-timezone handling | AM-010, AM-025, AM-032 | HIGH | 1 | LARGE | None | Parallel with R-001 only by file agreement | /GOAL RECOMMENDED |
| R-005 | Make finance-book state and root projection explicit | AM-008, AM-018 primary | HIGH | 2 | LARGE | R-001, R-004 | Serial in finance wave | /GOAL RECOMMENDED |
| R-006 | Correct Fixed Asset Register scope and as-of values | AM-017 | HIGH | 2 | LARGE | R-005, R-007 | After finance foundation | /GOAL RECOMMENDED |
| R-007 | Correct opening depreciation basis and finite WDV edge cases | AM-005, AM-023 | HIGH | 2 | LARGE | R-004 | Parallel with R-005 initially | /GOAL RECOMMENDED |
| R-008 | Preserve ERPNext-compatible revision life/rate/date basis | AM-006, AM-021, P-005 | HIGH | 2 | LARGE | R-005, R-007, R-009 | Serial after engine/options | /GOAL RECOMMENDED |
| R-009 | Persist and apply shift, precision, prorata, total-days options | AM-022, AM-036 | HIGH | 2 | LARGE | R-005, R-007 | Before R-008 | /GOAL RECOMMENDED |
| R-010 | Make submit/cancel a locked lifecycle state machine | AM-002, AM-003, AM-007, AM-014 | HIGH | 3 | LARGE | R-005, R-007, R-009 | Serial | /GOAL RECOMMENDED |
| R-011 | Protect capitalization targets and source lineage | AM-004, AM-009, AM-013 | HIGH | 3 | LARGE | R-010, R-014 | Serial | /GOAL RECOMMENDED |
| R-012 | Reverse disposal barrier effects safely on restore | AM-015 | HIGH | 3 | LARGE | R-010, R-011 | Serial | /GOAL RECOMMENDED |
| R-013 | Create an idempotent initial receipt movement | AM-016 | HIGH | 3 | MEDIUM | R-010 | Serial with AssetService work | NORMAL PROMPT |
| R-014 | Guard value-adjustment rollback with chronology/lineage | AM-026, P-010 | HIGH | 3 | LARGE | R-005, R-010 | Before R-011/R-012 | /GOAL RECOMMENDED |
| R-015 | Validate Asset drafts/references in one creation transaction | AM-027, P-009 | MEDIUM | 3 | MEDIUM | R-001, R-004 | Serial with R-016 | NORMAL PROMPT |
| R-016 | Enforce repair invoice and maintenance assignment invariants | AM-028, AM-029 | MEDIUM | 3 | LARGE | R-001, R-004 | Serial with R-015 | /GOAL RECOMMENDED |
| R-017 | Preserve audit history and location topology | AM-030, AM-031, P-002 | MEDIUM | 3 | MEDIUM | R-001 | Serial if schema changes | NORMAL PROMPT |
| R-018 | Round-trip Asset types and finance-book controls in forms | AM-019, AM-020 | HIGH | 4 | LARGE | R-009, R-010, R-011 | Serial before R-019 | /GOAL RECOMMENDED |
| R-019 | Prevent form hydration/date regressions | AM-011; PARTIAL AM-010 | HIGH | 4 | MEDIUM | R-004, R-018 | Serial after R-018 | NORMAL PROMPT |
| R-020 | Fix selectors, invalidation, and direct-route write gating | AM-034, AM-035, P-003 | MEDIUM | 4 | LARGE | R-002, R-010 | Parallel only with disjoint files | /GOAL RECOMMENDED |
| R-021 | Make CWIP readiness/retry/demo proof real | AM-024, AM-033, AM-037, P-007 | HIGH | 5 | LARGE | R-010, R-011, deployment topology | Serial with runtime gate | /GOAL RECOMMENDED |
| R-022 | Add authenticated persisted E2E and release evidence | P-001 | MEDIUM | 5 | LARGE | Waves 1-4, R-021 | Final workflow gate | /GOAL RECOMMENDED |
| R-023 | Align low-severity fixtures and documentation | AM-038, P-006, P-008 | LOW | 5 | SMALL | Relevant contract units | Safe to parallelize late | NORMAL PROMPT |

## 10. Detailed Remediation Units

### R-001 — Establish canonical Organization -> Company -> Asset ownership

**Findings closed:** PARTIAL: AM-001. R-002 is the primary closure unit; this unit establishes its required data boundary.

**Severity:** BLOCKER.

**Wave:** 1.

**Objective:** Make organization ownership a persisted, queryable domain invariant rather than only an authentication check. Every Asset must resolve through a Company owned by the active Organization, with a deliberate policy for Asset-related masters and documents that currently have global tables.

**Why this is a separate remediation unit:** The ownership relation and data migration are prerequisites for every predicate, report, event, and selector. Mixing schema/backfill design with all service call sites would create an unreviewable security commit and make rollback ambiguous.

**Current defect:** Organization and Member model membership only. Company has no Organization relation. Asset.company is a free-text string, and Location, AssetCategory, FinanceBook, maintenance, and accounting paths can be reached without an organization-owned relation. The current orgProcedure proves membership but cannot prove that a referenced Asset belongs to that organization.

**Required invariant:**

- A Company has exactly one owning Organization, unless an explicitly documented shared-master policy is approved.
- An Asset belongs to a Company through a stable relation, not a caller-provided company string.
- Any Asset-scoped master/document can be resolved to the same Organization before it is read or mutated.
- Existing rows are either deterministically mapped to one Organization or surfaced as migration failures; no silent cross-org assignment is allowed.

**ERPNext reference:** .erpnext/erpnext/assets/doctype/asset/asset.py and asset_capitalization.py treat Company as a document identity and validate company equality for linked Asset workflows. Preserve that company-boundary behavior while using Aria’s Organization model as the tenant boundary.

**Aria architectural references:** apps/backend/prisma/schema.prisma models Organization, Company, Asset, AssetCategory, Location, FinanceBook; apps/backend/src/trpc/trpc.ts OrgProtectedContext; apps/backend/src/apps/company/company.service.ts; apps/backend/src/apps/asset/asset.service.ts; apps/backend/prisma/migrations; existing company and demo seed scripts.

**Prerequisites:** None beyond the audit and current schema.

**Blocks:** R-002, R-003, R-005, R-006, R-015, R-016, R-017, R-020.

**Likely files affected:** Prisma schema and a new migration; Company and Asset type mappers; organization/company service contracts; deterministic data backfill or migration verification scripts; Asset fixtures and integration fixtures. Do not edit a ui folder.

**Implementation requirements:**

- Choose and document the canonical ownership path before editing callers.
- Add stable relations, composite indexes, and same-organization uniqueness where needed.
- Define how current Company names map to Organization records and how ambiguous/orphaned rows fail closed.
- Preserve super-admin behavior explicitly rather than bypassing data predicates for ordinary requests.
- Make the migration observable and rerunnable; do not rely on a one-time manual SQL session.

**Explicit non-goals:**

- Do not redesign all Inventory, CRM, or HRMS tenancy in this unit.
- Do not infer ownership from a user-supplied company name or Asset CUID.
- Do not use hidden organization filters without persisted ownership.
- Do not copy ERPNext table structure or UI.

**Migration impact:** REQUIRED. The migration must create ownership relations/indexes and establish a deterministic invariant for existing data. It must include an empty-database path, upgrade path, and a clear failure report for unmappable rows. Do not delete or rewrite existing production data without an approved backfill policy.

**Concurrency / transactional risks:** A backfill that updates Companies while Asset writes continue can create mixed ownership. Use a controlled migration boundary or an explicit dual-read/dual-write transition designed by the implementation agent and reviewed independently. Relation creation must not leave partially owned rows.

**Backward compatibility concerns:** Existing Asset API inputs may contain company strings. Keep compatibility adapters only at the boundary and resolve them to a Company owned by the active organization. Reject ambiguous names and cross-org IDs.

**Regression tests required:**

- Empty schema migration creates the ownership relations and indexes.
- Legacy fixture migration maps known Company/Asset rows and fails closed on an ambiguous Company.
- A Company in Organization A cannot be used to create or mutate an Asset in Organization B.
- A direct Asset CUID cannot be assigned to a different Company or Organization by a member.
- Related Category, Location, FinanceBook, and document references either prove same ownership or return a deterministic authorization/not-found error.

**Focused validation:** Run the repository’s migration compatibility script, the backend Asset suite serially, and the new real-PostgreSQL ownership integration tests. Verify migration status with the existing db:verify-migrations script.

**Broader validation:** Wave 1 gate; two-organization API and realtime tests; root typecheck and lint; fresh and upgraded migration paths.

**Acceptance criteria:**

- [ ] Company ownership is persisted and enforced.
- [ ] Asset ownership is relational and cannot be selected from a foreign organization.
- [ ] Existing rows have an auditable mapping or an explicit migration failure.
- [ ] The design supplies trusted organization identity to R-002 and R-003.
- [ ] No application or ui folder file was changed by the planning branch.

**Expected final commit:** fix(asset): establish organization-owned company boundary

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** SERIAL first unit. R-004 may be investigated separately, but no schema contract is shared without coordinator review.

### R-002 — Propagate trusted organization context through Asset access

**Findings closed:** AM-001 primary closure.

**Severity:** BLOCKER.

**Wave:** 1.

**Objective:** Ensure every Asset read, write, lifecycle action, report, related lookup, and background-facing service call is scoped by the active organization and same-owned Company relation.

**Why this is a separate remediation unit:** R-001 establishes ownership; this unit applies it across the large service/router surface. Realtime is deliberately separate in R-003 because subscriptions have a different fan-out and payload boundary.

**Current defect:** asset.router.ts creates orgProcedure and orgWriteProcedure but discards ctx.organization. AssetService methods accept only input and actor IDs. findAllAssets, findAssetById, barcode lookup, schedule lookup, dashboards, reports, and lifecycle paths use global ID/company filters. A member who knows an Asset CUID can cross the tenant boundary.

**Required invariant:** A trusted organization ID is present in every Asset service boundary. Every Prisma query that can expose or mutate Asset data includes an ownership predicate or reaches a relation that proves ownership. A foreign ID yields the same safe not-found/forbidden behavior selected by the API policy across reads and mutations.

**ERPNext reference:** Asset, movement, capitalization, repair, and register code validate Company on linked documents. Use that same-company invariant together with the Aria Organization context.

**Aria architectural references:** apps/backend/src/apps/asset/trpc/asset.router.ts; apps/backend/src/apps/asset/asset.service.ts; asset-accounting.service.ts; asset-stock-posting.service.ts; asset-dashboard.service.ts; fixed-asset-register-report.ts; depreciation discovery/barrier/lifecycle services; packages/types/src/index.ts; apps/backend/src/trpc/trpc.ts.

**Prerequisites:** R-001.

**Blocks:** R-003, R-006, R-015, R-020, and the cross-organization portions of R-021/R-022.

**Likely files affected:** Asset router/context adapters, service method signatures and query builders, report/dashboard services, lifecycle/depreciation entry points, related Asset document lookups, organization-scoped integration tests, generated contracts if procedure inputs/outputs change.

**Implementation requirements:**

- Pass organization context from the protected router to the service; never accept organization ID as an untrusted input field.
- Centralize or consistently apply Asset ownership predicates to direct ID, list, barcode, schedule, report, dashboard, and related-document queries.
- Enforce same-organization checks for Company, category, location, finance book, maintenance, movement, repair, capitalization, disposal, and accounting references.
- Scope background discovery and queue payloads if they can process organization-owned records.
- Preserve server-side role checks; this unit must not rely on frontend gating.

**Explicit non-goals:**

- Do not solve realtime subscription fan-out in this unit; R-003 owns it.
- Do not redesign authorization roles or make members into owners.
- Do not hide missing data by swallowing errors or returning fake empty records.

**Migration impact:** NONE beyond R-001’s required relations. If a query requires a new composite index, record it as REQUIRED in the implementation commit.

**Concurrency / transactional risks:** Ownership must be rechecked inside the same transaction as a mutation and before locking/posting. Do not resolve ownership in one query and mutate by global ID in a later transaction.

**Backward compatibility concerns:** Existing service callers and unit mocks will need the context parameter. Keep a narrow internal adapter only where a trusted system job has an explicit organization scope; do not make the parameter optional for user requests.

**Regression tests required:**

- Organization A can list/read/update/delete/submit its Asset.
- Organization A cannot list, direct-read, barcode-read, schedule-read, update, delete, submit, cancel, dispose, capitalize, or report Organization B’s Asset.
- Cross-org Company, category, location, finance-book, maintenance, movement, repair, capitalization, and disposal IDs are rejected.
- Dashboards and every Asset report contain only the active organization’s rows.
- A super-admin path is tested separately and remains explicit.

**Focused validation:** Run the serial backend Asset suite and the new real-PostgreSQL two-organization integration tests. Do not run the backend filtered helper concurrently with another filtered helper.

**Broader validation:** Wave 1 gate, targeted frontend query invalidation tests, and the later two-user authenticated browser/realtime gate.

**Acceptance criteria:**

- [ ] No user-facing Asset service method can execute without trusted organization scope.
- [ ] Direct CUID and barcode lookups cannot cross organizations.
- [ ] All Asset reports/dashboards and related document predicates are scoped.
- [ ] Cross-org tests cover allowed and denied behavior for reads and writes.
- [ ] R-003 can consume the same organization identity without re-deriving it.

**Expected final commit:** fix(asset): enforce organization-scoped Asset access

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** SERIAL after R-001; high collision risk in asset.router.ts and asset.service.ts.

### R-003 — Isolate Asset realtime topics and payloads by organization

**Findings closed:** AM-012.

**Severity:** BLOCKER.

**Wave:** 1.

**Objective:** Ensure an authenticated subscription receives only invalidation events for its active organization and never receives another organization’s full Asset data.

**Why this is a separate remediation unit:** EventEmitter listeners and tRPC subscriptions are a separate trust boundary from request/response query predicates. R-002 is necessary but cannot close event leakage by itself.

**Current defect:** Asset mutations emit global assetsChanged events. Subscriptions attach global listeners. Payloads may include category, location, activity, and finance-book data. There is no organization key, topic, or server-side filter.

**Required invariant:** Every Asset event has a trusted organization identity or an organization-specific topic. The subscription verifies the active organization before delivering it. Payloads contain minimal invalidation metadata such as event type and Asset ID; consumers refetch through R-002-scoped queries.

**ERPNext reference:** ERPNext permissions prevent a user from receiving another Company’s document. Aria must provide the equivalent event privacy at the subscription boundary.

**Aria architectural references:** apps/backend/src/apps/asset/trpc/asset.router.ts event types, EventEmitter2 emissions, onAssetsChanged subscription; apps/backend/src/apps/asset/asset.service.ts returned includes; frontend subscription consumers and query invalidation handlers.

**Prerequisites:** R-001 and R-002.

**Blocks:** Cross-org event portions of R-022 and final merge readiness.

**Likely files affected:** Asset router event types/emissions/subscriptions, event helper or topic naming, service return/payload mapping, frontend invalidation consumers, backend subscription/integration tests.

**Implementation requirements:**

- Derive organization identity from the server-side ownership context, not the event payload supplied by a client.
- Scope every Asset mutation event, including create/update/submit/cancel/delete/bulk-delete and lifecycle mutations that invalidate Asset views.
- Send the minimum payload required to invalidate caches; do not fan out full Asset records.
- Ensure unsubscribe/reconnect cleanup cannot retain a prior organization listener.
- Keep frontend refetches organization-scoped; events are not an authorization substitute.

**Explicit non-goals:**

- Do not use a client-side organization filter as the security control.
- Do not add a broad global event bus for convenience.
- Do not expose organization IDs or full domain records unnecessarily in browser payloads.

**Migration impact:** NONE.

**Concurrency / transactional risks:** Emit only after the owning transaction commits or use an outbox/transaction-safe publication strategy. Do not publish a mutation that later rolls back.

**Backward compatibility concerns:** Existing frontend event shapes may expect data. Update the shared contract and invalidation consumers together; retain no full-data compatibility branch that leaks records.

**Regression tests required:**

- Two authenticated subscriptions with different active organizations receive only their own Asset invalidation.
- An Organization B subscriber receives no event when Organization A creates, updates, submits, cancels, or deletes an Asset.
- Event payload contains no category/location/activity/finance-book record.
- Reconnect and unsubscribe remove the old listener and cannot receive stale-organization events.
- A same-organization mutation still invalidates the Asset list/detail/schedule queries.

**Focused validation:** Run targeted backend router/subscription tests and frontend subscription invalidation tests; add a real two-user integration test if the current harness supports WebSocket transport.

**Broader validation:** Wave 1 gate and the authenticated cross-org E2E/realtime gate.

**Acceptance criteria:**

- [ ] No global unfiltered Asset listener remains.
- [ ] Every Asset event is organization-scoped server-side.
- [ ] Full Asset payloads are not broadcast.
- [ ] Cross-org subscription denial is proven with two authenticated users.
- [ ] Reconnect and teardown preserve the organization invariant.

**Expected final commit:** fix(asset): isolate realtime Asset events by organization

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** MEDIUM.

**Parallelization:** SERIAL after R-002; high collision risk in asset.router.ts.

### R-004 — Canonicalize date-only values and business-timezone handling

**Findings closed:** AM-010, AM-025, AM-032.

**Severity:** HIGH.

**Wave:** 1.

**Objective:** Make Asset calendar dates stable as YYYY-MM-DD values at contracts and business-rule boundaries, convert them to UTC/query windows exactly once, and use APP_TIME_ZONE for scheduler and document-series business dates.

**Why this is a separate remediation unit:** Date representation is a cross-cutting primitive. Forms, reports, maintenance status, series allocation, lifecycle chronology, and depreciation must share one contract before individual callers are fixed.

**Current defect:** Asset forms use local-midnight Date and toISOString slicing; backend reports use local setHours around coerced dates; maintenance status uses server-local midnight while depreciation uses businessDate; series generation uses Date.getFullYear. Month-end and year-boundary dates can shift.

**Required invariant:** A selected 2026-08-10 remains 2026-08-10 under UTC, Asia/Kolkata, and America/New_York. Business-day scheduling and series year use the configured valid IANA APP_TIME_ZONE. Date-only comparisons use canonical calendar dates, not process-local instants.

**ERPNext reference:** asset.py validate_in_use_date, asset_maintenance.py due-date logic, and fixed_asset_register.py date/fiscal filtering use business document dates rather than accidental host-local instants.

**Aria architectural references:** apps/backend/src/apps/asset/depreciation/depreciation.config.ts businessDate, normalizeDateOnly, dateOnlyUtc; depreciation-scheduler.service.ts; AssetService series generation and reports; fixed-asset-register-report.ts; Asset frontend forms/dialogs and date helpers.

**Prerequisites:** None for the helper decision; R-001 is not a code dependency but ownership-aware reports must consume this contract.

**Blocks:** R-005, R-006, R-007, R-008, R-010, R-019.

**Likely files affected:** Shared date helper/type, packages/types date schemas if needed, depreciation.config.ts, scheduler, AssetService series/report windows, frontend Asset date utilities, focused tests.

**Implementation requirements:**

- Reuse and extend the existing validated IANA/businessDate helpers rather than creating a second date policy.
- Reject invalid calendar dates and invalid APP_TIME_ZONE values.
- Convert date-only values to Prisma UTC boundaries in one named adapter.
- Replace server-local maintenance midnight and series-year calculations.
- Define how timestamps such as submittedAt remain instants while purchaseDate, availableForUseDate, disposalDate, postingDate, adjustmentDate, and transactionDate remain date-only business fields.

**Explicit non-goals:**

- Do not change historical accounting dates without a data-migration decision.
- Do not move all audit timestamps to date-only values.
- Do not switch Next.js from Turbopack or investigate unrelated development panic behavior here.

**Migration impact:** LIKELY. Existing DateTime columns may remain physically stored at UTC midnight, but the implementation must audit existing values and document whether any non-midnight historical rows require normalization. No silent bulk rewrite.

**Concurrency / transactional risks:** Series allocation must calculate the business-year prefix inside the same transaction/counter boundary as allocation. Scheduler runs at a date boundary need deterministic injected now values.

**Backward compatibility concerns:** API consumers may currently send Date objects. Accept a narrowly validated boundary form during transition, normalize immediately, and keep response semantics documented.

**Regression tests required:**

- Round-trip 2026-08-10 and August 31 under TZ=UTC, TZ=Asia/Kolkata, and TZ=America/New_York.
- Maintenance due/overdue status at both sides of an Asia/Kolkata UTC boundary.
- Asset, disposal, adjustment, and movement series use the business year at a UTC/year boundary.
- Report from/to windows include the exact intended date and no adjacent date.
- Invalid date-only values and invalid IANA timezone fail deterministically.

**Focused validation:** Run depreciation.config.spec.ts, depreciation-scheduler.service.spec.ts, targeted Asset service/report tests, and the frontend date utility/form tests under the three TZ values.

**Broader validation:** Wave 1 date matrix, depreciation integration, report integration, and R-019 browser round-trip.

**Acceptance criteria:**

- [ ] No affected business date uses local-midnight conversion as its source of truth.
- [ ] Maintenance and series logic use APP_TIME_ZONE.
- [ ] Date-only contracts remain stable under all three required timezones.
- [ ] Timestamp fields remain distinct from date-only fields.
- [ ] The helper is reused rather than duplicated.

**Expected final commit:** fix(asset): canonicalize date-only business semantics

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** May be investigated in parallel with R-001, but coordinate shared contract ownership; implementation is a Wave 1 prerequisite.

### R-005 — Make finance-book state and root projection explicit

**Findings closed:** AM-008, AM-018 primary closure.

**Severity:** HIGH.

**Wave:** 2.

**Objective:** Keep each AssetFinanceBook independent and define exactly when, if ever, selected-book state is projected onto root Asset fields.

**Why this is a separate remediation unit:** Book ownership is a foundational data/transaction contract consumed by depreciation, reports, adjustments, disposal, capitalization, dashboards, and frontend round-trips. It must be agreed before those consumers are corrected.

**Current defect:** AssetFinanceBook stores book-specific values, but value adjustment and persistence can update root Asset values from a selected secondary book. getFixedAssetBalance sums submitted adjustments without financeBookId or adjustmentDate. Lifecycle workflows therefore mix books and future events.

**Required invariant:** Every book-sensitive operation has an explicit financeBookId or a documented Company default resolution. Root Asset values are a compatibility projection from the default book only and cannot be overwritten by a secondary-book operation. Balance queries are selected-book and as-of-date.

**ERPNext reference:** Asset finance-book rows, capitalization as-of values, and fixed asset register book selection in asset.py, asset_capitalization.py, and fixed_asset_register.py.

**Aria architectural references:** AssetFinanceBook and AssetValueAdjustment in schema.prisma; AssetService value-adjustment/disposal/capitalization paths; depreciation-persistence.service.ts; asset-value-adjustment.utils.ts; Company.defaultFinanceBookId.

**Prerequisites:** R-001 and R-004.

**Blocks:** R-006, R-008, R-010, R-011, R-014, R-018.

**Likely files affected:** schema constraints or projections, AssetService book selection/balance helpers, depreciation persistence, accounting context, shared input/output contracts, finance-book tests and migration if new lineage/state columns are required.

**Implementation requirements:**

- Centralize selected-book resolution and reject missing/ambiguous book context where the operation is inherently book-specific.
- Replace mixed root aggregation with a named book/date-aware balance service.
- Update root projection only from the Company default book and only inside the same transaction as the book mutation.
- Preserve book-specific opening values, posted cursor, schedule, adjustment, revaluation, and journal lineage.
- Make report and lifecycle callers consume the service rather than reimplementing sums.

**Explicit non-goals:**

- Do not claim statutory GL equivalence.
- Do not delete root compatibility fields before all consumers migrate.
- Do not choose a default book based on list order or the first database row.

**Migration impact:** LIKELY. If existing adjustments or schedules have null financeBookId, the migration must classify them against the documented default or quarantine them; it must not silently attach them to a random book.

**Concurrency / transactional risks:** Lock the Asset and affected AssetFinanceBook rows in stable order. A secondary-book update racing with default-book persistence must not produce a stale root projection.

**Backward compatibility concerns:** Existing report inputs without financeBookId need explicit default semantics or a validation error. Preserve old response fields as documented compatibility projections.

**Regression tests required:**

- Default and secondary books have different depreciation and carrying values; a secondary adjustment never changes root/default presentation.
- Future-dated adjustment is excluded from an earlier as-of balance.
- Secondary-book adjustment is excluded from default-book disposal/capitalization.
- Root projection updates only after a default-book operation and remains stable after secondary-book operations.
- Missing/null legacy book context fails or maps through a tested migration rule.

**Focused validation:** Run asset-value-adjustment.service.spec.ts, depreciation persistence/revision tests, and new real two-book integration tests.

**Broader validation:** Wave 2 report, depreciation, lifecycle, and migration gates.

**Acceptance criteria:**

- [ ] Book and as-of context is explicit for every affected workflow.
- [ ] Secondary-book work cannot overwrite root/default state.
- [ ] The central balance helper excludes future and other-book effects.
- [ ] Existing root fields have a documented projection policy.
- [ ] Numeric and persisted two-book tests pass.

**Expected final commit:** fix(asset): enforce finance-book state ownership

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** SERIAL in the finance wave; high collision risk in AssetService and schema.

### R-006 — Correct Fixed Asset Register scope and as-of values

**Findings closed:** AM-017.

**Severity:** HIGH.

**Wave:** 2.

**Objective:** Make the Fixed Asset Register exact-company, organization-scoped, finance-book-aware, and based on posted values as of the requested business date/fiscal scope.

**Why this is a separate remediation unit:** Report query and output semantics need their own contract and integration proof. Fixing a balance helper without proving the report’s filters would leave the merge blocker hidden behind mocked report tests.

**Current defect:** Report input has no finance-book field. fixed-asset-register-report.ts uses fuzzy company contains, loads all schedules, aggregates all posted entries/revaluations in a date window, and reads root Asset values at query time. Existing tests are mocked.

**Required invariant:** A report selects an exact Company owned by the active Organization, a selected/default FinanceBook, and a canonical date/fiscal range. It includes only eligible submitted rows and book/date-effective depreciation/revaluation data, with no cross-org or double-book aggregation.

**ERPNext reference:** .erpnext/erpnext/assets/report/fixed_asset_register/fixed_asset_register.py get_conditions, get_data, finance-book selection, and depreciation/revaluation maps.

**Aria architectural references:** fixed-asset-register-report.ts; packages/types report schemas around the audited lines; AssetService report entry point; report frontend route/utils; R-002 ownership predicates; R-005 balance service.

**Prerequisites:** R-005 and R-007; R-002 for organization scope.

**Blocks:** Report portions of R-020 and R-022.

**Likely files affected:** Report input/output contracts, fixed-asset-register-report.ts, AssetService report adapter, report frontend filters/table, integration fixtures and tests. Do not edit ui files.

**Implementation requirements:**

- Replace fuzzy Company matching with exact owned Company selection.
- Add selected FinanceBook/default behavior to the contract and response metadata.
- Use date-only as-of boundaries and selected-book entries.
- Define whether the report includes drafts, submitted, disposed, and canceled rows using the ERPNext-compatible policy and Aria statuses.
- Ensure report and dashboard invalidation do not expose cross-org rows.

**Explicit non-goals:**

- Do not call the report a statutory register until the shared accounting platform supports that claim.
- Do not solve every dashboard aggregation in this unit; update only shared report contracts and direct consumers required for correctness.
- Do not hide an ambiguous company with a substring fallback.

**Migration impact:** NONE unless R-005 introduces a required report index.

**Concurrency / transactional risks:** A report that triggers depreciation barrier work must use the same bounded as-of policy and not read a changing root projection across books. Prefer a consistent transaction/snapshot for persisted report rows.

**Backward compatibility concerns:** Existing clients without a FinanceBook filter need a documented default; preserve export columns while adding book/as-of metadata.

**Regression tests required:**

- Two organizations with similarly named Companies cannot cross into one report.
- Two FinanceBooks on one Asset produce separate register results and no double count.
- Exact company name is required; a substring does not include another Company.
- Future adjustment and future depreciation are absent from an earlier as-of report.
- Fiscal-year and date-range boundaries include only the requested business dates.

**Focused validation:** Run fixed-asset-register-report.spec.ts and new real database report integration tests; run frontend fixed-register tests for the changed contract.

**Broader validation:** Wave 2 gate, cross-org report tests, and final authenticated report flow.

**Acceptance criteria:**

- [ ] Report input has explicit exact company and finance-book semantics.
- [ ] Report data is selected-book and as-of-date correct.
- [ ] Mocked tests are supplemented by persisted fixtures.
- [ ] No cross-org or fuzzy-company result is possible.
- [ ] Export/display metadata identifies the scope used.

**Expected final commit:** fix(asset): scope fixed asset register by book and date

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** After R-005/R-007; keep serial with other report service changes.

### R-007 — Correct opening depreciation basis and finite WDV edge cases

**Findings closed:** AM-005, AM-023.

**Severity:** HIGH.

**Wave:** 2.

**Objective:** Make schedule generation use the remaining carrying basis after opening depreciation and produce a terminal, finite result when WDV carrying value reaches zero.

**Why this is a separate remediation unit:** The pure engine is a low-collision numerical boundary and must be correct before persistence, revision, reports, and lifecycle callers are changed.

**Current defect:** Ordinary SL uses grossBookValue - salvage over original periods even when opening accumulation/booked periods exist. A zero carrying-value WDV input can divide by zero and return NaN rate, amount, and book value.

**Required invariant:** For gross 1,000, salvage 100, opening accumulation 200, and one of three periods booked, remaining SL entries are 350 and 350. A fully depreciated WDV book produces either a valid empty/terminal schedule or a validated domain error, never non-finite numbers.

**ERPNext reference:** .erpnext/erpnext/assets/doctype/asset_depreciation_schedule/depreciation_methods.py straight-line pending-period basis; asset.py WDV rate behavior; the audit’s direct numeric probes.

**Aria architectural references:** apps/backend/src/apps/asset/depreciation/depreciation-schedule-engine.ts validateInput, calculateRate, buildDepreciationSchedule; depreciation schedule engine tests; lifecycle and persistence callers.

**Prerequisites:** R-004 for date-only inputs.

**Blocks:** R-006, R-008, R-009, R-010, R-021.

**Likely files affected:** depreciation-schedule-engine.ts and its tests; typed engine inputs/results; persistence boundary finite guards if required; no UI changes.

**Implementation requirements:**

- Separate original gross value, opening accumulation, opening booked periods, current carrying value, salvage, and pending periods.
- Calculate ordinary SL from remaining depreciable value over remaining periods, respecting the established cadence and precision options.
- Handle WDV zero book value before rate calculation.
- Add Number.isFinite guards before schedule result leaves the engine and before persistence.
- Preserve manual and existing supported methods unless a test demonstrates the shared invariant requires an adapter.

**Explicit non-goals:**

- Do not implement shift persistence or revision life semantics here; R-008 and R-009 consume this engine.
- Do not reject zero salvage or zero rate merely because it differs from an assumed policy; inspect ERPNext behavior first.
- Do not mask NaN by JSON serialization.

**Migration impact:** NONE.

**Concurrency / transactional risks:** Pure calculation has no database race. Persistence callers must still calculate from a locked book snapshot.

**Backward compatibility concerns:** Existing valid schedules must retain their values. Migrated empty schedules should be regenerated only under an explicit backfill rule; do not rewrite valid posted entries.

**Regression tests required:**

- Opening SL fixture with expected [350, 350].
- Zero-book WDV with zero salvage returns finite terminal state.
- Zero-book WDV with positive salvage follows the chosen ERPNext-aligned guard.
- Negative, over-accumulated, and non-finite inputs fail with deterministic errors.
- Final period never goes below salvage and sums to the expected remaining basis.

**Focused validation:** Run depreciation schedule engine unit tests and the depreciation unit target serially.

**Broader validation:** R-008/R-009 numeric fixtures, persisted schedule integration, and Wave 2 gate.

**Acceptance criteria:**

- [ ] Opening accumulation and booked periods affect the remaining SL basis.
- [ ] WDV zero-value behavior is finite and explicit.
- [ ] No non-finite value can reach a schedule result or persistence.
- [ ] Existing valid method fixtures remain green.
- [ ] Numeric expected values are documented in tests.

**Expected final commit:** fix(asset): correct remaining depreciation basis and finite guards

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** Can run in parallel with R-005 initially; serial with R-009 and R-008 in the engine surface.

### R-008 — Preserve ERPNext-compatible revision life, rate, and date basis

**Findings closed:** AM-006, AM-021, P-005.

**Severity:** HIGH.

**Wave:** 2.

**Objective:** Make depreciation revisions preserve original-life DDB behavior, derive WDV from current/book-specific values under the ERPNext rules, retain exact useful-life month deltas, and preserve schedule cadence/anchors.

**Why this is a separate remediation unit:** Revision creates immutable successor schedules and crosses numeric, date, book, and lineage boundaries. It cannot be safely folded into the base engine or value-adjustment caller.

**Current defect:** asset-depreciation-revision.service.ts rounds useful-life changes with Math.ceil, treats the successor as a fresh asset using remaining periods as total life, passes stored WDV rate through, and anchors dates at the adjustment date. Preview and persistence use inconsistent period conventions.

**Required invariant:** DDB rate uses original useful life, not only remaining periods. WDV derives from selected-book current value, salvage, pending periods, and exact life extension unless a valid manual rate is retained under the ERPNext rule. A two-month extension remains two months, month-end cadence stays stable, and successor entries preserve booked/opening state without double counting.

**ERPNext reference:** asset.py get_double_declining_balance_rate and get_written_down_value_rate; asset_depreciation_schedule.py rescheduling; depreciation_methods.py period and shift behavior.

**Aria architectural references:** asset-depreciation-revision.service.ts revise/loadLockedBooks; depreciation-schedule-engine.ts calculateRate/build; asset-value-adjustment.utils.ts preview; AssetDepreciationSchedule previousScheduleId/revisionNumber in schema.

**Prerequisites:** R-005, R-007, and R-009.

**Blocks:** R-010, R-011, R-012, R-018.

**Likely files affected:** revision service, engine input contract, schedule persistence, value-adjustment preview/persistence adapter, revision tests, migration only if original-life/cadence metadata is absent and cannot be derived safely.

**Implementation requirements:**

- Keep original useful life and booked/opening state distinct from remaining periods.
- Pass selected finance-book context and effective date consistently.
- Preserve schedule anchor/month-end/fiscal-year cadence according to ERPNext-compatible rules.
- Derive and persist the effective WDV rate when the rule requires recalculation.
- Use one period convention in preview, persistence, and worker execution.
- Keep predecessor schedule immutable and link the successor to the source adjustment/lineage.

**Explicit non-goals:**

- Do not rewrite valid posted history.
- Do not broaden revision behavior to unrelated Inventory depreciation.
- Do not retain a stale positive rate merely because it is already stored if ERPNext says to derive a new rate.

**Migration impact:** UNKNOWN until the implementation confirms whether original-life and lineage can be derived from current rows. If required, add a safe backfill with an explicit unresolved-row report; never guess.

**Concurrency / transactional risks:** Lock the Asset and all affected books/schedules. A concurrent revision or posting must fail/retry deterministically and cannot produce two active schedules for one book.

**Backward compatibility concerns:** Existing schedule revision chains and posted entries must remain readable. New metadata must be nullable only during a validated migration window, not an excuse to use mixed basis indefinitely.

**Regression tests required:**

- DDB asset with original life ten years and two booked years retains the ERPNext expected 20% basis, not a fresh 25% remaining-life basis.
- WDV revision recalculates from current book value/salvage/pending years.
- Two-month life extension remains two calendar months.
- Mid-month and month-end schedules preserve their expected cadence.
- Preview and persisted schedule use the same periods/rate/dates.
- Concurrent revision/posting leaves one active successor and consistent book cursor.

**Focused validation:** Run asset-depreciation-revision.service.spec.ts, schedule engine tests, and value-adjustment utility/service tests.

**Broader validation:** Real two-book persisted revision fixtures, journal reconciliation, and Wave 2/3 gates.

**Acceptance criteria:**

- [ ] DDB original-life and WDV current-value rules match verified ERPNext behavior.
- [ ] Exact month deltas are preserved.
- [ ] Preview, persistence, and worker use one period/date basis.
- [ ] Successor chains are immutable, linked, and single-active per book.
- [ ] Numeric expected values and dates are asserted.

**Expected final commit:** fix(asset): align depreciation revisions with original life and book state

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** SERIAL after R-007/R-009; high collision in engine and revision files.

### R-009 — Persist and apply shift, precision, prorata, and total-days options

**Findings closed:** AM-022, AM-036.

**Severity:** HIGH.

**Wave:** 2.

**Objective:** Ensure every supported finance-book depreciation option is either persisted and consumed through the production lifecycle or rejected as unsupported. A visible shiftBased, dailyProrataBased, rate, precision, or total-days option must never be silently ignored.

**Why this is a separate remediation unit:** The engine already has several optional inputs, while AssetFinanceBook stores only part of the configuration. The persistence/schema contract and the calculation contract must be aligned before revision or frontend round-trip work.

**Current defect:** The engine accepts shiftAllocations, calculateUsingTotalDays, precision, and ratePrecision, but lifecycle input does not load all of them. AssetFinanceBook stores shiftBased without normalized allocation rows. Production does not pass currency precision or total-days policy consistently, and accounting rounds at a different boundary.

**Required invariant:** A finance-book row has a complete, typed configuration. Generated schedule, preview, revision, worker posting, and Asset-domain accounting use the same options and precision. If a feature is not supported, the contract rejects it before persistence rather than presenting a flag that has no effect.

**ERPNext reference:** depreciation_methods.py straight-line daily/total-days and shift methods; asset.py finance-book settings and rate behavior.

**Aria architectural references:** schema.prisma AssetFinanceBook and AssetShiftFactor; depreciation-schedule-engine.ts optional inputs; asset-depreciation-lifecycle.service.ts schedule input; asset-depreciation-revision.service.ts; asset-value-adjustment.utils.ts; asset-accounting.service.ts; packages/types/src/index.ts finance-book schemas.

**Prerequisites:** R-005 and R-007.

**Blocks:** R-008, R-018, R-021 numeric/runtime proof.

**Likely files affected:** Prisma schema/migration for shift allocations or a validated equivalent; shared finance-book input/output types; lifecycle/revision/persistence services; engine options; accounting precision adapter; unit and integration tests. UI controls are consumed in R-018.

**Implementation requirements:**

- Decide whether shifts are named factor rows, period allocations, or another explicit persisted structure; do not overload a Boolean.
- Pass the same shift factors through schedule generation, revision, posting, and preview.
- Resolve currency precision and total-days policy from one explicit company/book configuration.
- Ensure rounding occurs at the documented finance/accounting boundary and totals reconcile.
- Validate factors, period indexes, precision, and total-days combinations.

**Explicit non-goals:**

- Do not add unsupported product options merely to mirror ERPNext labels.
- Do not implement frontend form controls in this backend contract unit; R-018 owns the UI round-trip.
- Do not change shared accounting statutory scope.

**Migration impact:** REQUIRED if shift allocation or precision configuration has no current persisted representation. Use additive migration plus explicit backfill/unsupported-state handling. Existing shiftBased=true rows must not silently continue as factor 1.

**Concurrency / transactional risks:** Schedule generation and posting must read a locked, immutable configuration snapshot. Changing a configuration after postings exist must use the revision workflow, not mutate historical rows.

**Backward compatibility concerns:** Existing books with shiftBased=true but no allocation need a fail-closed status or migration decision. Existing two-decimal schedules must remain auditable when precision policy changes.

**Regression tests required:**

- Eleven factor-1 monthly periods and one factor-2 period distribute the full depreciable value according to the expected factors.
- Shift allocations persist and round-trip through schedule, revision, and posting.
- Three/six-decimal currency fixtures reconcile preview, schedule, and accounting totals.
- Total-days SL differs only when the explicit policy is enabled and matches ERPNext-derived expected values.
- Unsupported or incomplete configuration fails before a schedule is persisted.

**Focused validation:** Run schedule-engine, revision, value-adjustment, and accounting unit tests; add persistence integration tests for AssetFinanceBook configuration.

**Broader validation:** Wave 2 numeric gate and R-018 frontend round-trip.

**Acceptance criteria:**

- [ ] Shift factors have a real persisted representation or are rejected.
- [ ] Precision and total-days policy have one source of truth.
- [ ] Preview, schedule, revision, worker, and accounting use the same options.
- [ ] Existing historical rows remain finite and auditable.
- [ ] Numeric totals reconcile across the supported precision range.

**Expected final commit:** fix(asset): persist finance-book depreciation options

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** SERIAL after R-007; high collision in schema, engine, and revision files.

### R-010 — Make submit and cancel a locked lifecycle state machine

**Findings closed:** AM-002, AM-003, AM-007, AM-014.

**Severity:** HIGH.

**Wave:** 3.

**Objective:** Make Asset submission and cancellation one guarded transaction that validates business prerequisites, locks the Asset/books, activates or closes schedules, writes state/activity, and rejects races or linked effects that cannot be safely reversed.

**Why this is a separate remediation unit:** Submission/cancellation is the lifecycle foundation consumed by capitalization, disposal, movement, and browser workflows. It needs one transaction protocol rather than isolated validation patches.

**Current defect:** submitAsset calls configureAssetBooks before its transaction, then reads/updates a draft without an Asset lock or conditional transition. cancelAsset checks only posted depreciation and can cancel an Asset with capitalization, disposal, repair, revaluation, movement, or other posted effects. Composite Asset submission is not blocked without active capitalization. availableForUseDate is optional and scheduling falls back to purchaseDate.

**Required invariant:** Under a stable lock order, a transition re-reads current status and effective dates, validates all linked documents/books, posts or reverses required effects, updates schedules/root projection/activity, and performs a conditional state transition atomically. Ordinary depreciable Assets require available-for-use date and no schedule begins before it. Composite Assets require active capitalization.

**ERPNext reference:** asset.py before_submit, on_submit, validate_in_use_date, on_cancel; asset_movement.py and capitalization validation for linked state.

**Aria architectural references:** asset-depreciation-lifecycle.service.ts submitAsset, cancelAsset, configureAssetBooks, calculateSchedule; AssetService lifecycle entry points; schema AssetStatus, schedules, movements, repairs, capitalizations, disposals, adjustments; existing advisory lock helpers.

**Prerequisites:** R-005, R-007, R-009, R-004, and R-001 for scoped lookups.

**Blocks:** R-011, R-012, R-013, R-014, R-021, R-022.

**Likely files affected:** lifecycle service, AssetService submit/cancel adapters, schedule persistence and lock helpers, Prisma migration only if state/version/lineage is required, lifecycle and integration tests.

**Implementation requirements:**

- Move book configuration and lifecycle effects into one transaction or an explicitly safe transaction protocol.
- Lock Asset, finance books, and linked documents in stable order; re-read status inside the transaction.
- Use conditional updates or version checks so lost transitions fail rather than last-write-win.
- Enforce composite capitalization and ordinary available-for-use rules before effects are committed.
- Enumerate linked posted effects and either reverse them through their owning workflow or block cancellation with an actionable error.
- Preserve activity actor attribution and schedule history.

**Explicit non-goals:**

- Do not implement exact disposal barrier reversal, capitalization target deletion, or value-adjustment rollback here; R-011, R-012, and R-014 own those details.
- Do not move accounting execution into the scheduler.
- Do not accept a race because the final status happens to look valid.

**Migration impact:** LIKELY if a version/transition or source-lineage column is required. Existing in-flight drafts/submitted Assets must be classified before the new guard is enabled.

**Concurrency / transactional risks:** High. Test concurrent submit/cancel, duplicate submit, failure after configuration, and retry. Avoid holding a database transaction across a blocking queue call; persist the source-of-truth state before enqueueing.

**Backward compatibility concerns:** Existing drafts missing available-for-use date or finance books may now fail submit. Provide an explicit remediation path, not a purchase-date fallback that keeps bad data hidden.

**Regression tests required:**

- Composite Asset without active capitalization cannot submit; valid capitalization allows it.
- Ordinary depreciable Asset without available-for-use date cannot submit; depreciation start before it fails.
- Concurrent submit/cancel produces one legal final state with matching schedule statuses.
- Failure after each submit phase rolls back books, schedules, status, and activity together.
- Cancel is blocked or reverses every linked posted effect according to R-011/R-012/R-014 contracts.
- Retrying a successful submit/cancel is idempotent.

**Focused validation:** Run asset-depreciation-lifecycle.service.spec.ts and asset-lifecycle-actions.spec.ts serially, then new real PostgreSQL transaction/concurrency specs.

**Broader validation:** Wave 3 gate, R-011/R-012/R-013 integration tests, and authenticated persisted E2E.

**Acceptance criteria:**

- [ ] Submit and cancel have one explicit lock/transaction protocol.
- [ ] Composite and available-for-use invariants are enforced.
- [ ] Lost transitions cannot overwrite a newer state.
- [ ] Failure injection leaves no orphan books/schedules/activity.
- [ ] Linked-effect handling is explicit and tested.

**Expected final commit:** fix(asset): make Asset lifecycle transitions atomic

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** SERIAL. This is the lifecycle foundation and touches high-contention services.

### R-011 — Protect capitalization targets and source lineage

**Findings closed:** AM-004, AM-009, AM-013.

**Severity:** HIGH.

**Wave:** 3.

**Objective:** Make capitalization target identity, source value, target lifecycle, and cancellation lineage explicit and irreversible only when the exact linked state is still present.

**Why this is a separate remediation unit:** Capitalization can create or consume multiple Assets and has distinct target deletion and reversal behavior. It must be reviewed independently from generic submit/cancel.

**Current defect:** Shared input permits NEW_ASSET with targetAssetId. Posting can create a server target instead of rejecting the contradictory request. Generated targets remain deletable as DRAFT, and ON DELETE SET NULL can make a submitted capitalization non-reversible. Later-depreciation checks use createdAt while the barrier can post at the capitalization date; source lineage is incomplete.

**Required invariant:** Existing targets are draft COMPOSITE_ASSET records with matching item/company/organization and valid status. NEW_ASSET requests cannot carry contradictory target IDs. A submitted capitalization protects its target and source linkage. All consumed values and generated depreciation/accounting effects carry source capitalization ID, finance book, and posting date so cancellation can reverse the exact eligible effects.

**ERPNext reference:** asset_capitalization.py validate_target_asset, set_asset_values, consumed asset posting and restore_consumed_asset_items.

**Aria architectural references:** AssetService createAssetCapitalization, submitAssetCapitalization, postAssetCapitalization, reverseAssetCapitalization; AssetCapitalization schema/migration including targetAssetId and createdTargetAsset; depreciation barrier/revision; Asset type contracts.

**Prerequisites:** R-010 and R-014; R-005/R-007 for book/date balances.

**Blocks:** R-012, R-018, R-021.

**Likely files affected:** capitalization schemas/contracts, AssetService capitalization methods, target deletion policy/FK migration, accounting/depreciation lineage fields, capitalization fixtures and integration/E2E tests.

**Implementation requirements:**

- Validate target type, item, company, organization, status, and source/target non-overlap before posting.
- Reject contradictory request combinations at schema and service boundaries.
- Protect a generated target referenced by a submitted capitalization or provide an immutable cancellation snapshot that can genuinely restore it.
- Record source capitalization ID on barrier depreciation, accounting, stock, and schedule changes.
- Use posting/effective date and lineage, not createdAt alone, for later-effect checks.
- Make cancellation a conditional reversal of exactly the source effects.

**Explicit non-goals:**

- Do not redesign all composite Asset UI in this unit; R-018 exposes it.
- Do not delete capitalization history to simplify cancellation.
- Do not weaken target validation to preserve an existing invalid demo fixture; R-021 updates demo data.

**Migration impact:** REQUIRED or LIKELY. Tightening ON DELETE SET NULL requires an orphan preflight. Add lineage columns/indexes and backfill only when source relationships are unambiguous.

**Concurrency / transactional risks:** Lock all source Assets and target Asset in stable order. Concurrent delete/cancel/post must leave either a protected submitted target or a clean rejected transition, never a null target with a posted document.

**Backward compatibility concerns:** Existing submitted capitalizations with missing target or lineage require a report and explicit remediation. Do not mark them reversible without proof.

**Regression tests required:**

- NEW_ASSET plus targetAssetId is rejected.
- Existing target must be draft composite with matching item/company/organization.
- Generated target cannot be deleted after capitalization submit; bulk delete is also blocked.
- Concurrent target delete and capitalization cancel cannot orphan the document.
- Capitalization cancellation reverses only its own book/date/lineage effects and restores sources/target when unchanged.
- Later depreciation at the capitalization posting date does not evade the guard.

**Focused validation:** Run asset-lifecycle-actions.spec.ts and capitalization service tests, then real PostgreSQL target/FK/concurrency integration tests.

**Broader validation:** Wave 3 gate, two-book reversal tests, and authenticated capitalization browser flow.

**Acceptance criteria:**

- [ ] Target combinations and linked identities are validated before posting.
- [ ] Submitted target linkage cannot be deleted or nulled.
- [ ] Every generated effect is attributable to the capitalization and book/date.
- [ ] Cancellation is conditional, exact, and tested after later events.
- [ ] Invalid legacy capitalizations are visible rather than silently treated as safe.

**Expected final commit:** fix(asset): protect capitalization targets and reversal lineage

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** SERIAL after R-010/R-014; high collision in AssetService and migrations.

### R-012 — Reverse disposal barrier effects safely on restore

**Findings closed:** AM-015.

**Severity:** HIGH.

**Wave:** 3.

**Objective:** Restore a sold/scrapped Asset by reversing the exact disposal-created depreciation and accounting effects for each finance book, while preserving original-schedule-date exceptions.

**Why this is a separate remediation unit:** Disposal restore has a specialized ERPNext rule and distinct financial risk. It cannot be proven by generic cancellation tests.

**Current defect:** Disposal posts through the disposal date and closes schedules. Restore reverses disposal accounting and reactivates schedules but does not identify/reverse the journal created specifically by the disposal-date barrier. Later-effect checks use createdAt.

**Required invariant:** A mid-period/future disposal barrier entry linked to the disposal is reversed on restore when ERPNext requires it. An entry occurring on the original schedule date remains according to the original-date exception. Reversal restores book values, schedule state, disposal status, and accounting balance without touching unrelated later entries.

**ERPNext reference:** .erpnext/erpnext/assets/doctype/asset/depreciation.py reverse_depreciation_entry_made_on_disposal, disposal_was_made_on_original_schedule_date, restore_asset, reset_depreciation_schedule.

**Aria architectural references:** AssetService dispose/restore methods around asset.service.ts disposal barrier and restore; DepreciationBarrierService; AssetDepreciationRevisionService; AssetDepreciationJournalEntry and schedule-entry schema; R-005 book balance and R-011 lineage.

**Prerequisites:** R-010, R-011, R-005, R-007, and R-014.

**Blocks:** R-021 and final lifecycle gate.

**Likely files affected:** disposal/restore service, depreciation barrier and journal lineage, schedule reactivation, accounting reversal, schema migration if source IDs are missing, multi-book integration tests.

**Implementation requirements:**

- Link barrier-generated depreciation to disposal ID and AssetFinanceBook.
- Identify original schedule date using date-only cadence, not createdAt.
- Reverse only eligible disposal-created entries and clear/reconnect schedule posting linkage safely.
- Reconcile book value, accumulated depreciation, root default projection, and journal totals.
- Block restore after later incompatible events using effective date/lineage/version.

**Explicit non-goals:**

- Do not reverse an unrelated posted depreciation entry.
- Do not treat a restored Asset as proof that all lifecycle cancellation is correct.
- Do not rewrite historical journal dates to make a comparison pass.

**Migration impact:** LIKELY/REQUIRED if disposal source IDs are absent on depreciation journal entries. Backfill only entries deterministically linked by existing disposal and date; quarantine ambiguity.

**Concurrency / transactional risks:** Lock Asset, disposal, book, schedules, and affected journals. Restore and a worker posting must serialize. Repeated restore must be rejected/idempotent.

**Backward compatibility concerns:** Existing disposals without barrier lineage need a safe “cannot automatically restore” error and operator path, not a broad timestamp guess.

**Regression tests required:**

- Mid-period disposal creates a linked barrier entry; restore reverses it exactly.
- Disposal on original schedule date does not reverse that original entry.
- Future disposal follows the ERPNext future-date rule.
- Two finance books restore independently with no cross-book reversal.
- Restore after later depreciation/accounting fails without changing state.
- Repeated restore and concurrent restore are safe.

**Focused validation:** Run depreciation barrier, Asset lifecycle, accounting, and restore tests; add real PostgreSQL multi-book integration.

**Broader validation:** Wave 3 gate and final persisted disposal/restore browser flow.

**Acceptance criteria:**

- [ ] Disposal barrier entries are linked by source and book.
- [ ] Original-date exception is tested.
- [ ] Restore reverses only eligible effects and reactivates the correct schedule.
- [ ] Later effects block stale restore.
- [ ] Ledger, book, and Asset values reconcile after restore.

**Expected final commit:** fix(asset): reverse disposal depreciation by source lineage

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** SERIAL after R-011; high collision in depreciation and AssetService.

### R-013 — Create an idempotent initial receipt movement on submit

**Findings closed:** AM-016.

**Severity:** HIGH.

**Wave:** 3.

**Objective:** Make Asset submission create a deterministic initial receipt movement when the Asset has location/custodian information, preserving the movement ledger and avoiding duplicate receipts on retry.

**Why this is a separate remediation unit:** Movement history is a distinct document workflow with chronology and state reconstruction. It should consume the finalized submit transaction rather than be hidden inside generic status code.

**Current defect:** submitAsset activates schedules, updates status, and writes activity, but movement creation is a separate API. A submitted Asset can show current location/custodian without a receipt representing acquisition/custody.

**Required invariant:** Submission creates one attributable initial receipt or an explicitly documented equivalent. The movement is linked to the Asset submission/idempotency key, uses the business transaction date, validates Company/Organization/location/custodian, and is included in cancellation/retry semantics.

**ERPNext reference:** asset.py on_submit make_asset_movement; asset_movement.py validation and latest location/custodian reconstruction.

**Aria architectural references:** AssetDepreciationLifecycleService.submitAsset; AssetService movement create/submit/cancel methods; AssetMovement/AssetMovementItem schema; location and employee/custodian contracts; R-002 scoping.

**Prerequisites:** R-010 and R-002.

**Blocks:** R-022 persisted lifecycle E2E.

**Likely files affected:** lifecycle service, movement creation helper, schema unique/idempotency field if needed, activity mapping, movement integration tests.

**Implementation requirements:**

- Define when receipt is required and how no-location/no-custodian Assets are represented.
- Create it in the same source-of-truth transaction or use a durable idempotency record.
- Preserve existing later movement chronology and cancellation reconstruction.
- Attribute the actor and source Asset submission.
- Ensure retries cannot create duplicate movement rows.

**Explicit non-goals:**

- Do not redesign transfer/issue workflows that already pass their own invariants.
- Do not fabricate a location or custodian when the draft has none.
- Do not use a frontend-only activity message as the movement ledger.

**Migration impact:** LIKELY if idempotency/source linkage is added. Existing submitted Assets without receipt remain historical gaps; do not invent dates without an approved backfill.

**Concurrency / transactional risks:** Concurrent submit requests must contend on the Asset lock and unique source key. Movement and status must not commit separately.

**Backward compatibility concerns:** Existing clients may expect submit to return an Asset only; preserve response shape while adding movement side effect and explicit error behavior.

**Regression tests required:**

- Submit with location/custodian creates one Receipt movement with correct actor/date/company.
- Submit without location/custodian follows the documented no-receipt policy.
- Duplicate submit/retry creates no second receipt.
- Movement report reconstructs initial custody/location.
- Cancellation reverses or blocks the initial receipt according to the state policy.

**Focused validation:** Run asset lifecycle and movement service tests, then a real database submit/movement integration test.

**Broader validation:** Wave 3 gate and authenticated create/submit/reload movement E2E.

**Acceptance criteria:**

- [ ] Initial custody history exists or a documented explicit equivalent exists.
- [ ] Receipt creation is idempotent and actor-attributed.
- [ ] Movement chronology remains valid.
- [ ] Submit failure cannot leave a receipt without the expected Asset state.
- [ ] Existing later movement behavior remains green.

**Expected final commit:** fix(asset): create idempotent initial receipt movement

**Suggested implementation-session mode:** NORMAL PROMPT.

**Expected complexity:** MEDIUM.

**Parallelization:** Serial with AssetService lifecycle work; do not edit it concurrently with R-010/R-011.

### R-014 — Guard value-adjustment rollback with chronology and lineage

**Findings closed:** AM-026, P-010.

**Severity:** HIGH.

**Wave:** 3.

**Objective:** Prevent cancellation of an old value adjustment from restoring stale root/book state over later repairs, capitalizations, disposals, accounting entries, or adjustments.

**Why this is a separate remediation unit:** Value-adjustment cancellation has a distinct snapshot/revision protocol and is the shared lineage prerequisite for capitalization/disposal reversal.

**Current defect:** Cancellation blocks only newer submitted adjustments, reverses its own revaluation/revision, then writes previousAssetValueAfterDepreciation, previousAssetStatus, and previousIsFullyDepreciated snapshots back to Asset. It does not check later repair, capitalization, disposal, or accounting effects. Other callers use createdAt instead of effective/posting date and source lineage.

**Required invariant:** A cancellation is allowed only when the adjustment is the latest compatible event for the selected book and its dependent state has not advanced. Otherwise it returns a conflict without overwriting later state. Any reversal uses exact source IDs, book, effective date, and schedule-chain/version guards.

**ERPNext reference:** asset_value_adjustment.py validation/cancellation and Asset finance-book state; capitalization/disposal source lineage rules.

**Aria architectural references:** AssetService create/submit/cancel value-adjustment methods; AssetValueAdjustment and AssetRevaluationEntry schema; AssetDepreciationRevisionService; AssetAccountingService; disposal/capitalization later-effect checks.

**Prerequisites:** R-005 and R-010; R-004 for effective date.

**Blocks:** R-011 and R-012.

**Likely files affected:** value-adjustment service/utils, revision lineage, accounting/revaluation source fields, schema migration if version/source linkage is missing, concurrency tests.

**Implementation requirements:**

- Track the selected book and event sequence/version.
- Compare effective/posting dates and source lineage, not only createdAt.
- Check later repairs, capitalizations, disposals, accounting entries, depreciation, and adjustments as applicable to the selected book.
- Reverse own revaluation/schedule/accounting rows exactly, then update compatible projection state.
- Return a conflict that leaves all rows unchanged when a later effect exists.

**Explicit non-goals:**

- Do not make every old adjustment cancellable by restoring snapshots.
- Do not delete later events or silently recalculate unrelated books.
- Do not solve all disposal/capitalization reversal details here; consume R-011/R-012 lineage.

**Migration impact:** LIKELY if event sequence/source linkage is added. Historical adjustments with ambiguous order need a report and conservative block.

**Concurrency / transactional risks:** High. Lock Asset, selected book, adjustment, schedule chain, and source accounting rows. Concurrent cancel and later lifecycle action must serialize or conflict.

**Backward compatibility concerns:** Existing adjustments with null financeBookId or missing source links require explicit default/migration handling. Do not infer a safe book from root Asset values.

**Regression tests required:**

- Adjustment cancellation with no later event restores only the selected book.
- Cancellation after repair, capitalization, disposal, later depreciation, accounting, or newer adjustment conflicts and leaves state unchanged.
- Concurrent cancellation and later event produces one legal result.
- Secondary-book cancellation never overwrites default root projection.
- Reversal entries are linked and idempotent.

**Focused validation:** Run asset-value-adjustment service/utils and revision tests, then real PostgreSQL later-event/concurrency integration tests.

**Broader validation:** Wave 2 two-book gate and Wave 3 lifecycle gate.

**Acceptance criteria:**

- [ ] Stale snapshot restoration is impossible.
- [ ] Chronology is effective-date/lineage based.
- [ ] Selected-book state is isolated.
- [ ] Conflicts are atomic and non-destructive.
- [ ] Exact reversal linkage and idempotency are proven.

**Expected final commit:** fix(asset): guard value adjustment cancellation by lineage

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** SERIAL before R-011/R-012; high collision in AssetService and revision code.

### R-015 — Validate Asset drafts and references in one creation transaction

**Findings closed:** AM-027, P-009.

**Severity:** MEDIUM.

**Wave:** 3.

**Objective:** Make Asset creation establish a coherent draft, finance-book, activity, and domain-reference state while defining which provisional draft fields are allowed.

**Why this is a separate remediation unit:** Creation-time reference validation and atomic initialization are upstream of submit but distinct from the submitted lifecycle state machine.

**Current defect:** createAsset writes raw company/item references and inserts the Asset, configures books, and creates activity in separate calls. A draft can persist nonexistent references or be left without expected books/activity after a failure.

**Required invariant:** A draft’s Company, Item, Category, Location, and finance-book references are valid within the active organization or explicitly marked provisional by policy. Asset row, initial book configuration, and creation activity commit atomically. Submit revalidates all required business fields.

**ERPNext reference:** asset.py set_missing_values, validate_in_use_date, and finance-book setup; capitalization/item validation.

**Aria architectural references:** AssetService.createAsset and validateDepreciationFields; packages/types createAssetSchema; AssetFinanceBook and AssetActivity schema; company/item/category services; R-001/R-002.

**Prerequisites:** R-001, R-002, and R-004.

**Blocks:** R-010 and R-022 create-flow proof.

**Likely files affected:** AssetService creation/configuration, shared schemas/types, transaction helper, Company/Inventory lookup adapters, fixtures/tests, possibly migration constraints.

**Implementation requirements:**

- Resolve Company and Item through trusted organization-owned records.
- Define whether drafts may carry incomplete available-for-use/depreciation fields; reject unsafe submit deterministically.
- Create Asset, books, and creation activity in one transaction or an equivalent atomic protocol.
- Validate category/location/finance book ownership and default compatibility.
- Preserve actor attribution.

**Explicit non-goals:**

- Do not make all draft fields mandatory when ERPNext permits a draft policy.
- Do not accept raw CUIDs as an authorization shortcut.
- Do not implement Purchase Invoice validation; R-016 owns repairs.

**Migration impact:** LIKELY if adding relations/constraints; use R-001 ownership backfill and do not delete invalid drafts automatically.

**Concurrency / transactional risks:** Series allocation and Asset/book creation need one transaction boundary. Duplicate creation retries must have a defined idempotency policy.

**Backward compatibility concerns:** Existing draft rows with invalid references need a visible remediation state. Existing clients may send company strings; resolve within organization and reject ambiguity.

**Regression tests required:**

- Invalid/nonexistent/foreign Company, Item, Category, Location, and FinanceBook fail.
- Asset, finance books, and activity roll back together on injected failure.
- Valid incomplete draft saves only when allowed by documented policy.
- Submit revalidates missing available-for-use/finance configuration.
- Organization A cannot create an Asset using Organization B’s reference.

**Focused validation:** Run Asset service unit tests and new real PostgreSQL creation transaction tests.

**Broader validation:** Wave 3 gate and browser create/edit flow.

**Acceptance criteria:**

- [ ] Draft reference policy is explicit.
- [ ] Creation initialization is atomic.
- [ ] Invalid/foreign references fail closed.
- [ ] Submit remains the authoritative completeness gate.
- [ ] Existing invalid drafts are visible and recoverable.

**Expected final commit:** fix(asset): validate Asset references atomically

**Suggested implementation-session mode:** NORMAL PROMPT.

**Expected complexity:** MEDIUM.

**Parallelization:** Serial with R-016 because both likely modify AssetService reference helpers.

### R-016 — Enforce repair invoice and maintenance assignment invariants

**Findings closed:** AM-028, AM-029.

**Severity:** MEDIUM.

**Wave:** 3.

**Objective:** Ensure repair costs reference valid submitted/unallocated purchasing records where that platform exists and every planned maintenance task has accountable assignment or an explicitly modeled unassigned state.

**Why this is a separate remediation unit:** Repair purchasing validation and maintenance assignment are different domain integrations but share the boundary rule that raw identifiers must not become posting-ready data.

**Current defect:** Repair validates Asset/company/status but accepts raw invoice identifiers/amounts without submitted/status/account/duplicate/available-amount checks. Maintenance assignTo is optional and tasks can persist without an accountable member.

**Required invariant:** A repair either links to a real supported Purchase Invoice with validated status/account/remaining amount or rejects unsupported invoice references. A planned maintenance task has a valid same-organization assignee, or the product explicitly models an unassigned queue with different operational behavior.

**ERPNext reference:** asset_repair.py validate_purchase_invoices, validate_duplicate_purchase_invoices, invoice status/account/available cost; asset_maintenance.py assignment validation and task/log synchronization.

**Aria architectural references:** AssetService repair methods around create/submit; maintenance creation/update methods; packages/types repair and maintenance schemas; purchase invoice/inventory contracts; maintenance team/member models.

**Prerequisites:** R-001/R-002 and R-004.

**Blocks:** R-020 selector/UI work and R-022 persisted workflow proof.

**Likely files affected:** repair/maintenance services and schemas, typed purchasing relation/adapter if available, frontend form contracts in non-ui paths, service tests and integration fixtures.

**Implementation requirements:**

- Validate invoice existence, submitted status, expense account, duplicate account/invoice pair, and unallocated cost when supported by the repository.
- If purchasing is not yet a shared platform, reject the reference with a clear unsupported integration error rather than accepting raw data.
- Require a valid assignee for planned tasks or introduce an explicit, tested unassigned state.
- Synchronize maintenance logs and assignment changes atomically.
- Scope all referenced records to the active organization.

**Explicit non-goals:**

- Do not invent a Purchase Invoice subsystem.
- Do not copy ERPNext task UI.
- Do not make assignment optional just to preserve an existing fixture.

**Migration impact:** LIKELY for typed invoice/member relations or explicit unassigned status. Existing raw values require validation/reporting before enforcement.

**Concurrency / transactional risks:** Two repairs must not consume the same invoice balance. Maintenance update/delete and log completion must lock Asset/maintenance rows.

**Backward compatibility concerns:** Existing repairs with raw/ineligible invoices need a visible blocked status. Existing unassigned tasks need migration owner or explicit unassigned policy.

**Regression tests required:**

- Draft/nonexistent invoice, wrong account, duplicate invoice/account, and over-allocation fail.
- Valid submitted invoice with available amount succeeds and consumes only the allowed amount.
- Maintenance without assignee fails or enters the explicitly modeled queue state.
- Assignment and maintenance log remain synchronized after edit/cancel.
- Foreign organization invoice/team/member references fail.

**Focused validation:** Run Asset maintenance/repair unit tests and new integration fixtures against the actual purchasing/member models where available.

**Broader validation:** Wave 3 and Wave 4 selector/browser gates.

**Acceptance criteria:**

- [ ] Raw invoice references cannot become posting-ready without validation.
- [ ] Duplicate and over-allocation cases are blocked.
- [ ] Planned maintenance accountability is explicit.
- [ ] Log synchronization and organization scope are tested.
- [ ] Unsupported platform boundaries fail clearly.

**Expected final commit:** fix(asset): validate repair invoices and maintenance ownership

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** Serial with R-015 and other AssetService reference changes.

### R-017 — Preserve audit history and location topology

**Findings closed:** AM-030, AM-031, P-002.

**Severity:** MEDIUM.

**Wave:** 3.

**Objective:** Keep Asset activity attributable and historical movement reconstructable while preventing invalid Location hierarchy or destructive master deletion.

**Why this is a separate remediation unit:** Retention, deletion actor, historical foreign keys, and hierarchy-cycle validation are master-data integrity concerns. They should not be mixed with financial/lifecycle posting.

**Current defect:** deleteAsset receives no actor, AssetActivity.userId is nullable, Asset -> Activity is ON DELETE CASCADE, and deletion leaves no deletion activity. Location deletion checks only current Asset assignments while historical movement FKs use ON DELETE SET NULL. updateLocation accepts a parent without descendant-cycle validation.

**Required invariant:** Eligible deletion is a deliberate policy (soft-delete/archive or retained history), always records the actor. Referenced Locations cannot erase the identity needed by historical movement reports. A Location cannot be its own descendant.

**ERPNext reference:** Asset activity/version retention and asset_movement.py historical source/target identity. ERPNext does not authorize destroying the historical boundary needed to explain custody.

**Aria architectural references:** AssetActivity and Location/AssetMovementItem schema; AssetService deleteAsset/deleteLocation/updateLocation; asset.router.ts delete actor propagation; location.service.ts; activity and movement reports.

**Prerequisites:** R-001/R-002 for ownership.

**Blocks:** R-022 audit/history E2E and final report confidence.

**Likely files affected:** schema deletion rules/migration, delete router/service signatures, location hierarchy validation, report mappers, tests and possibly admin-facing archive contract. Do not edit ui folders.

**Implementation requirements:**

- Pass authenticated actor to deletion and record an attributable event.
- Choose soft-delete/archive or retained activity policy and apply it consistently.
- Prevent deletion of a Location referenced by historical movement, or preserve a stable snapshot identity.
- Reject parent assignment that is self or a descendant; validate inside the transaction.
- Keep reports able to display historical location names/IDs after current master changes.

**Explicit non-goals:**

- Do not retain personally sensitive data beyond the approved audit policy.
- Do not make every Asset physically undeletable without a documented lifecycle policy.
- Do not fix unrelated hierarchy models.

**Migration impact:** REQUIRED or LIKELY if changing ON DELETE behavior, adding archivedAt, or retaining snapshots. Preflight existing referenced Locations and activities before applying constraints.

**Concurrency / transactional risks:** Deletion and movement submission can race. Lock the Location/Asset or use FK restriction so a historical reference cannot disappear between validation and delete.

**Backward compatibility concerns:** Existing reports may return null location endpoints after historical deletion. Preserve old rows and expose archived names through a tested mapper.

**Regression tests required:**

- Delete actor is recorded for eligible Asset deletion.
- Activity history survives the chosen deletion/archive policy.
- Location with historical movement reference cannot erase the endpoint.
- Location cycle and descendant-parent attempts fail.
- Historical movement report remains reconstructable after location archive.

**Focused validation:** Run location and Asset activity service tests plus real PostgreSQL FK/deletion integration tests.

**Broader validation:** Wave 3 report/history gate and authenticated activity browser flow.

**Acceptance criteria:**

- [ ] Deletion is attributable.
- [ ] Historical activity and movement identity are retained.
- [ ] Hierarchy cycles are rejected.
- [ ] Database deletion behavior matches the service policy.
- [ ] Existing current-location behavior remains valid.

**Expected final commit:** fix(asset): preserve Asset history and location integrity

**Suggested implementation-session mode:** NORMAL PROMPT.

**Expected complexity:** MEDIUM.

**Parallelization:** Serial if schema changes; otherwise can follow R-015/R-016 with disjoint service ownership.

### R-018 — Round-trip Asset types and finance-book controls in forms

**Findings closed:** AM-019, AM-020.

**Severity:** HIGH.

**Wave:** 4.

**Objective:** Make the main Asset form represent supported Asset types and preserve every supported finance-book depreciation control from form hydration through API, database, schedule, and reload.

**Why this is a separate remediation unit:** Shared contract loss and UI field omission is a distinct client/server boundary. It depends on backend options being real, but must be reviewed as a browser round-trip rather than a field-presence patch.

**Current defect:** createAssetSchema supports assetType but items/form/page.tsx has no field and omits it. Contracts include dailyProrataBased, shiftBased, and rateOfDepreciation, but edit hydration/payload/UI omit them. Existing frontend tests assert only fields that already exist.

**Required invariant:** A user can create/edit every supported Asset type and finance-book control permitted by backend policy. Values survive hydration, validation, payload, persistence, schedule generation, revision, and reload. Unsupported options are unavailable or rejected; no silent defaulting.

**ERPNext reference:** asset.py composite/component semantics and finance-book rows; depreciation_methods.py options. Use only business semantics, not ERPNext UI.

**Aria architectural references:** packages/types/src/index.ts Asset create/update and finance-book schemas; apps/frontend/src/app/asset/(protected)/items/form/page.tsx; form tests; backend mappers and R-009/R-010/R-011 contracts.

**Prerequisites:** R-009, R-010, R-011.

**Blocks:** R-019 and R-022.

**Likely files affected:** shared type schemas/mappers, main Asset form route/page tests, backend contract tests, possibly dedicated non-ui form helpers. Do not modify files inside any ui folder.

**Implementation requirements:**

- Add typed Asset type control with conditional validation for composite/component behavior.
- Preserve all finance-book fields in reset/hydration and submission payload.
- Render controls only for supported backend semantics and explain required inputs.
- Keep dirty-state logic from erasing persisted values when category defaults load asynchronously.
- Add round-trip assertions against a persisted test fixture, not only mocked field existence.

**Explicit non-goals:**

- Do not copy ERPNext form layout or labels without adapting to Aria UX.
- Do not weaken backend validation because a UI control is missing.
- Do not touch shared ui primitives.

**Migration impact:** NONE; backend/schema changes belong to prerequisite units.

**Concurrency / transactional risks:** Form save should use server conflict/errors from the lifecycle/book protocol. Do not resolve stale edit state by overwriting the latest book configuration.

**Backward compatibility concerns:** Existing assets missing optional fields must load with documented defaults that do not mark the form dirty or change persisted semantics.

**Regression tests required:**

- Create and edit Existing, Composite, and Composite Component where supported; invalid conditional combinations fail.
- Finance-book daily prorata, shift, rate, salvage, life, frequency, and total-days values survive load/save/reload.
- A category loaded after the Asset does not overwrite persisted book values.
- Form payload contains assetType and all supported finance-book fields.
- Read-only role sees no write affordance but server rejection remains authoritative.

**Focused validation:** Run the main Asset form Vitest suite, shared contract tests, and targeted backend contract/service tests.

**Broader validation:** Wave 4 frontend suite, persisted browser flow, and Wave 2 numeric gate.

**Acceptance criteria:**

- [ ] Asset type is represented and persisted.
- [ ] All supported finance-book settings round-trip.
- [ ] Unsupported settings cannot appear enabled and inert.
- [ ] Async category defaults preserve persisted values.
- [ ] No ui folder file changed.

**Expected final commit:** fix(asset): round-trip Asset type and finance-book controls

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** SERIAL before R-019; high collision in the main Asset form and shared contracts.

### R-019 — Prevent form hydration and date-only regressions

**Findings closed:** AM-011; PARTIAL: AM-010.

**Severity:** HIGH.

**Wave:** 4.

**Objective:** Ensure editing an Asset preserves persisted depreciation values and date-only calendar days regardless of asynchronous category loading or browser timezone.

**Why this is a separate remediation unit:** R-018 restores fields and Asset types; this unit protects hydration ordering, dirty state, and date serialization behavior in the same route.

**Current defect:** items/form/page.tsx resets persisted values and then a category effect applies defaults with shouldDirty true. Local-midnight Date and toISOString conversions can shift dates, including month-end.

**Required invariant:** Hydration is deterministic: persisted values win over category defaults, the form is not spuriously dirty, and a selected date is submitted as the same YYYY-MM-DD under required timezones.

**ERPNext reference:** available-for-use/depreciation start dates are business dates; Aria UI remains the UX source of truth.

**Aria architectural references:** items/form/page.tsx hydration/category effect/date fields; apps/frontend date picker helpers; packages/types date schemas; depreciation.config.ts canonical adapter; form tests.

**Prerequisites:** R-004 and R-018.

**Blocks:** R-022 browser workflow and final date gate.

**Likely files affected:** main Asset form route and tests, date-only helper usage, non-ui form utilities. Do not edit ui primitives.

**Implementation requirements:**

- Apply category defaults only to untouched/empty fields and never over persisted edit values.
- Keep reset and default application ordered and explicit.
- Serialize date-only form values without browser-local midnight conversion.
- Validate available-for-use/depreciation date relationships through the server contract.
- Cover month-end and timezone boundaries in browser/component tests.

**Explicit non-goals:**

- Do not redesign the date picker component.
- Do not duplicate the backend date policy.
- Do not use shouldDirty as a substitute for correct value provenance.

**Migration impact:** NONE.

**Concurrency / transactional risks:** Stale form edits must surface server conflicts rather than overwrite newer finance-book/lifecycle state.

**Backward compatibility concerns:** Existing users with dates stored at UTC midnight need stable display; do not shift historical dates during hydration.

**Regression tests required:**

- Async category arrival never changes persisted method/period/frequency/salvage/rate.
- Edit form is clean after hydration when no user change occurred.
- 2026-08-10 and 2026-08-31 survive create/edit/reload under UTC, Asia/Kolkata, and America/New_York.
- Invalid date ordering is shown consistently with backend error.
- A user-edit after defaults remains dirty and is submitted.

**Focused validation:** Run items/form/page.test.tsx and date utility tests under the required TZ values.

**Broader validation:** Wave 4 frontend suite and persisted Asset browser E2E.

**Acceptance criteria:**

- [ ] Persisted edit values cannot be overwritten by late category defaults.
- [ ] Date-only values do not shift.
- [ ] Dirty state reflects user changes only.
- [ ] Main form and backend agree on date validation.
- [ ] No shared ui file changed.

**Expected final commit:** fix(asset): preserve Asset form hydration and calendar dates

**Suggested implementation-session mode:** NORMAL PROMPT.

**Expected complexity:** MEDIUM.

**Parallelization:** SERIAL after R-018; same main form file.

### R-020 — Fix selectors, invalidation, and direct-route write gating

**Findings closed:** AM-034, AM-035, P-003.

**Severity:** MEDIUM.

**Wave:** 4.

**Objective:** Make Asset workflows discover all authorized records through server-backed search, refresh detail/schedule data after mutations, and gate direct form routes by role without weakening server authorization.

**Why this is a separate remediation unit:** Selector pagination, cache invalidation, and direct-route role UX are client workflow concerns that should consume the ownership and contract foundations without changing financial behavior.

**Current defect:** movement, repair, capitalization dialogs cap lists at 100 and value adjustment at 250. Detail invalidation misses separate schedule queries. Maintenance forms use raw Asset/team CUIDs. Direct Asset form routes do not consistently apply useAssetWriteAccess.

**Required invariant:** Selectors use organization-scoped server search/pagination; any valid authorized record is discoverable. After lifecycle mutation, Asset detail, schedule, list, report, and related keys are invalidated/refetched. Read-only members see gated direct routes while backend owner/admin checks remain authoritative.

**ERPNext reference:** Link fields search server-side; document forms reload linked schedule state after lifecycle changes. Do not copy ERPNext UI.

**Aria architectural references:** movement-dialog.tsx, repair-form.tsx, capitalization-form.tsx, value-adjustments/form/page.tsx, maintenance/form/page.tsx, items/[assetId]/page.tsx invalidation, use-asset-write-access.ts, Asset router list procedures.

**Prerequisites:** R-002 and R-010; R-018/R-019 for main form contract.

**Blocks:** R-022.

**Likely files affected:** Asset dialog/form routes and tests, query helpers/invalidation maps, list procedures if pagination/search input changes, direct route layouts/guards, E2E specs. Do not edit ui folder files.

**Implementation requirements:**

- Replace hard-coded first-page selectors with debounced server-backed search and bounded pagination.
- Include active organization in query/cache identity or clear all Asset caches on organization switch.
- Invalidate schedule/detail/report keys after disposal, revision, capitalization, repair, movement, and value adjustment.
- Gate direct write routes with role context while retaining server procedures.
- Use typed selectors for maintenance Asset/team/member fields instead of raw CUID text.

**Explicit non-goals:**

- Do not raise the limit from 100 to a larger arbitrary limit.
- Do not rely on stale list caches for authorization.
- Do not remove server-side owner/admin procedures.

**Migration impact:** NONE.

**Concurrency / transactional risks:** Cache invalidation should happen after mutation success and should not render a prior organization’s cache after switching organizations.

**Backward compatibility concerns:** Existing list query consumers may need pagination metadata. Preserve current first-page display while adding search and next-page behavior.

**Regression tests required:**

- Seed more than 100/250 Assets; search finds a record beyond the old cap.
- Foreign organization records never appear in selector results.
- Dispose/revise/capitalize/move/repair/value-adjust then reload detail and schedule; no stale schedule remains.
- Direct form route is gated for member and functional for owner/admin.
- Organization switch clears or partitions Asset caches.

**Focused validation:** Run movement-dialog, form, invalidation, and auth hook Vitest suites; run targeted Asset E2E specs with live server data.

**Broader validation:** Wave 4 browser gate and cross-org API/realtime tests.

**Acceptance criteria:**

- [ ] No fixed first-page cap hides valid authorized records.
- [ ] All affected query keys refresh after lifecycle changes.
- [ ] Direct routes use role-aware UX.
- [ ] Backend remains the authority and has regression coverage.
- [ ] Selector/cache behavior is organization-safe.

**Expected final commit:** fix(asset): make Asset selectors and route authorization complete

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** Can be parallel with R-018 only with disjoint files; do not overlap on shared contracts or items/page cache code.

### R-021 — Make CWIP readiness, failure retention, and demo proof real

**Findings closed:** AM-024, AM-033, AM-037, P-007.

**Severity:** HIGH.

**Wave:** 5.

**Objective:** Align health/release gates with the actual CWIP worker topology, retain terminal failures for operators, and make demo data prove production service execution rather than static row construction.

**Why this is a separate remediation unit:** Background topology and destructive demo evidence are operational concerns with their own runtime gates. They must not be hidden inside financial or lifecycle code commits.

**Current defect:** /health/ready and CI check depreciation producer/worker/events but not CWIP. CWIP discovery removes failed jobs and re-enqueues them. seed-asset-lifecycle.ts creates an invalid/default target and stops at discovery without running the CWIP worker.

**Required invariant:** The declared deployment is healthy only when all required CWIP and depreciation producers/workers/events are healthy. A terminal CWIP failure remains visible and needs bounded/manual retry. Demo fixtures use production-valid Asset types/links and explicit isolated commands prove load, worker processing, reload, cleanup, second load, and restart idempotency.

**ERPNext reference:** CWIP capitalization is a real posting transition; capitalization targets must be Composite Asset and valid under asset_capitalization.py.

**Aria architectural references:** health-indicator.service.ts, health.controller.ts, .github/workflows/ci.yml queue checks, cwip-capitalization-discovery.service.ts, cwip-capitalization.processor.ts, demo-data-runner.ts, seed-asset-lifecycle.ts, demo CLI/README, deployment Compose.

**Prerequisites:** R-010/R-011 and confirmed deployment topology. This unit owns the implementation contract; R-022 owns persisted browser/release evidence.

**Blocks:** R-022 and final release gate.

**Likely files affected:** health indicators/controller/tests, CI queue/readiness scripts, CWIP discovery/retry policy, demo seed/runner/tests/docs, Compose readiness configuration. Do not enable startup demo loading.

**Implementation requirements:**

- Add CWIP readiness/queue health or explicitly remove CWIP from the deployment contract with maintainer approval.
- Distinguish completed, retryable, and terminal failed BullMQ jobs; retain terminal evidence and provide manual retry semantics.
- Make demo capitalization use valid production target types/links and services where the demo claims runtime proof.
- Require explicit isolated mutation flags for destructive demo commands.
- Prove scheduler discovers only and worker executes only; do not process accounting in the scheduler.

**Explicit non-goals:**

- Do not add a Railway Cron Job or separate worker if the repository topology remains one persistent backend.
- Do not put demo loading in startup, pre-deploy, or health checks.
- Do not mark readiness healthy merely because discovery found zero work.

**Migration impact:** NONE unless job lineage/status persistence is added; additive persistence is LIKELY if BullMQ terminal failures need durable operator state.

**Concurrency / transactional risks:** Discovery and worker retries must be idempotent. A restart or duplicate discovery cannot create duplicate CWIP accounting. Health probes must not consume blocking queue-event connections.

**Backward compatibility concerns:** Existing failed jobs may be removed by old discovery; provide a migration/observability note and do not claim historical failure recovery.

**Regression tests required:**

- Readiness fails when CWIP worker/queue is unavailable and recovers after restart.
- Qualified CWIP discovers, enqueues, posts, and does not duplicate after retry/restart.
- Exhausted failure remains visible and is not silently re-enqueued forever.
- Demo target is Composite Asset and valid for production capitalization.
- Isolated demo load/process/reload/cleanup/second-load/restart preserves counts and zero duplicate journals.

**Focused validation:** Run CWIP discovery/processor/persistence tests, health tests, demo safety tests, and a disposable runtime integration test.

**Broader validation:** Wave 5 Compose smoke, exact readiness endpoints, queue status, demo CLI, and exact-SHA CI.

**Acceptance criteria:**

- [ ] Readiness covers the actual CWIP deployment contract.
- [ ] Terminal failure is visible and manually recoverable.
- [ ] Demo data uses valid production semantics.
- [ ] Demo proof executes worker/accounting paths in an isolated database.
- [ ] Restart/idempotency and duplicate-entry checks pass.

**Expected final commit:** fix(asset): certify CWIP readiness and retry behavior

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** SERIAL with runtime/release evidence; high collision in health and CI files.

### R-022 — Add authenticated persisted Asset E2E and release evidence

**Findings closed:** P-001.

**Severity:** MEDIUM, but a release gate for advertised Asset workflows.

**Wave:** 5.

**Objective:** Turn the existing route-oriented Playwright harness into a persisted, authenticated proof of critical Asset workflows, organization denial, restart/idempotency, and reports.

**Why this is a separate remediation unit:** Browser harness/release evidence is not production behavior. It provides independent proof after backend/frontend units are implemented and prevents mocked tests from being mistaken for release certification.

**Current defect:** Existing Asset E2E specs visit routes, open dialogs, and assert visibility. They do not prove create -> submit -> process -> reload -> report persistence, cross-org denial, two-user subscriptions, or worker/restart behavior.

**Required invariant:** A disposable authenticated browser run creates and persists valid Asset data, exercises a lifecycle action, waits for real backend/worker completion, reloads the page, and verifies schedule/report state. A second organization cannot see or mutate it. Tests use real services and no route mocks for closure paths.

**ERPNext reference:** Use the business workflow invariants from asset.py, capitalization, movement, depreciation, and register reports; do not copy ERPNext UI.

**Aria architectural references:** apps/frontend/e2e/fixtures.ts, helpers.ts, Asset specs, playwright.config.ts; backend demo/migration commands; tRPC auth/organization setup; R-001-R-021 acceptance criteria.

**Prerequisites:** Waves 1-4 and R-021 for final runtime proof.

**Blocks:** Final branch validation and merge-readiness audit.

**Likely files affected:** e2e fixtures/helpers/specs, CI workflow target selection, test data cleanup helpers, release evidence documentation. Do not edit ui files.

**Implementation requirements:**

- Create two authenticated users in two organizations with deterministic cleanup.
- Exercise create/edit/submit, schedule or worker processing, reload, report, and at least one reversal.
- Assert cross-org list/direct/read/write/report denial and realtime privacy where transport support exists.
- Capture screenshots/traces/logs only for failures or required evidence; do not make artifacts the security control.
- Integrate the persisted pack into the repository-native E2E/CI command without hiding unrelated failures.

**Explicit non-goals:**

- Do not replace unit/integration tests with E2E.
- Do not use mocked tRPC responses for closure evidence.
- Do not make production demo data a test fixture.

**Migration impact:** NONE.

**Concurrency / transactional risks:** Test workers may race if the fixture shares the database. Use isolated database/schema or unique run IDs and deterministic cleanup.

**Backward compatibility concerns:** Existing smoke E2E should remain useful; label route-smoke tests separately from persisted release tests.

**Regression tests required:** The unit itself is the persisted E2E pack: lifecycle, two-org isolation, selector over-cap, invalidation after mutation, role route gating, report reload, and restart/idempotency scenarios.

**Focused validation:** Run a targeted Asset persisted spec with the frontend Playwright server configuration.

**Broader validation:** Run bun run test:e2e and the CI-equivalent Compose/runtime gate on the exact candidate SHA.

**Acceptance criteria:**

- [ ] Real authenticated data persists through reload.
- [ ] Two organizations are isolated in browser/API/realtime paths.
- [ ] At least one worker-backed lifecycle is observed, not mocked.
- [ ] Failure artifacts are actionable.
- [ ] CI executes the pack and cannot pass by skipping it.

**Expected final commit:** test(asset-e2e): prove persisted authenticated Asset workflows

**Suggested implementation-session mode:** /GOAL RECOMMENDED.

**Expected complexity:** LARGE.

**Parallelization:** FINAL WORKFLOW GATE; serial after product units and R-021.

### R-023 — Align low-severity fixtures and documentation

**Findings closed:** AM-038, P-006, P-008.

**Severity:** LOW.

**Wave:** 5.

**Objective:** Remove enum literal drift and correct stale route/count/feature claims only after the executable contracts are final.

**Why this is a separate remediation unit:** These changes improve operator and test reliability but must not be used to mask unresolved product defects or contaminate higher-risk commits.

**Current defect:** A frontend dashboard fixture uses PREVENTIVE while the shared enum is PREVENTIVE_MAINTENANCE. Brochure/client-guide links use legacy paths, and the original gap-analysis document has stale page/commit counts and resolved claims.

**Required invariant:** Fixtures import shared enum/type values. Documentation identifies current canonical routes, current limitations, organization/company scope, demo isolation, and unresolved merge gates accurately.

**ERPNext reference:** None required for fixture correction. UI/documentation remains Aria-owned.

**Aria architectural references:** apps/frontend/src/app/asset/(protected)/dashboard/overview/page.test.tsx; docs/asset-management-gap-analysis.md; docs/asset-management-brochure-report.md; docs/asset-management-client-guide.md; current app-nav-data.ts and route tree.

**Prerequisites:** Relevant implementation units and R-022 evidence. Do not update claims before behavior is verified.

**Blocks:** None; it is not a reason to lower the merge gate.

**Likely files affected:** The named fixture and documentation files only. No application behavior or ui folder changes.

**Implementation requirements:**

- Replace literal enum drift with shared typed values.
- Update route/count terminology from the current repository, not historical assumptions.
- Remove any “resolved” or “statutory register” claim that contradicts the final merge matrix.
- Document explicit demo load flags and worker/runtime limits.

**Explicit non-goals:**

- Do not rewrite the deep audit.
- Do not claim a finding closed because a document says so.
- Do not update marketing language before R-006/R-021/R-022 evidence exists.

**Migration impact:** NONE.

**Concurrency / transactional risks:** None, provided no code behavior is changed.

**Backward compatibility concerns:** Documentation links may be external/bookmarked; use current redirect policy only when verified and distinguish legacy paths from canonical paths.

**Regression tests required:**

- The fixture type-checks against the shared enum.
- Repository search finds no stale current-route claims in the named documents.
- Documentation explicitly preserves unresolved merge gates and demo safety.

**Focused validation:** Run the affected frontend test, git diff --check, and targeted rg searches for the stale enum/routes/claims.

**Broader validation:** Final branch documentation review; no product finding is VERIFIED_CLOSED from this unit alone.

**Acceptance criteria:**

- [ ] Shared enum values replace literals.
- [ ] Stale paths/counts are corrected or explicitly labeled historical.
- [ ] Documentation does not claim unresolved behavior is fixed.
- [ ] No application or ui folder changed.

**Expected final commit:** docs(asset): align Asset fixtures and route guidance

**Suggested implementation-session mode:** NORMAL PROMPT.

**Expected complexity:** SMALL.

**Parallelization:** SAFE TO PARALLELIZE late, after relevant behavior and release evidence stabilize.

## 11. Shared-File Collision Matrix

The following matrix is an execution constraint, not merely a review note. Two units with HIGH collision risk must not be implemented in parallel, even if their finding IDs look independent.

| Shared surface | Units | Risk | Rule |
|---|---|---|---|
| apps/backend/prisma/schema.prisma and migrations | R-001, R-005, R-009, R-011, R-012, R-014, R-017 | HIGH | One schema owner at a time; each migration must include preflight, upgrade, empty-db, and rollback/forward-risk notes |
| apps/backend/src/apps/asset/asset.service.ts | R-002, R-005, R-006, R-010 through R-017 | HIGH | Serialize AssetService work; do not stage another unit’s partial edits |
| apps/backend/src/apps/asset/trpc/asset.router.ts | R-002, R-003, R-010, R-020 | HIGH | R-002 establishes context signatures before R-003 event changes; lifecycle router changes follow the same contract |
| packages/types/src/index.ts | R-001, R-002, R-004, R-005, R-006, R-009, R-018 | HIGH | Treat shared schemas as a contract migration; update all producers/consumers in one reviewed unit |
| depreciation.config.ts | R-004, R-007, R-008, R-009 | HIGH | Date helper first; then engine basis/options; then revision |
| depreciation-schedule-engine.ts | R-007, R-008, R-009 | HIGH | R-007 -> R-009 -> R-008; numeric fixtures travel with each change |
| asset-depreciation-lifecycle.service.ts | R-007, R-008, R-010, R-013 | HIGH | Lifecycle owner serializes engine input, transaction protocol, and receipt side effect |
| asset-depreciation-revision.service.ts | R-005, R-007, R-008, R-009, R-014 | HIGH | Book/date contract and engine options must settle before revision/rollback work |
| fixed-asset-register-report.ts and report contracts | R-004, R-005, R-006, R-020 | MEDIUM | R-004 date contract and R-005 balance contract precede report query edits |
| apps/frontend/.../items/form/page.tsx | R-018, R-019 | HIGH | Strictly serial; R-018 restores fields, R-019 hardens hydration/date behavior |
| frontend Asset dialogs/forms | R-018, R-019, R-020, R-022 | MEDIUM | Assign disjoint route files; no shared live edits; persisted E2E follows all form units |
| assetsChanged event contract and consumers | R-002, R-003, R-020, R-022 | HIGH | R-003 owns event payload; R-020/R-022 consume only the final metadata contract |
| health indicator, CI, Compose readiness | R-021, R-022 | HIGH | R-021 changes the contract; R-022 verifies it after the change |
| docs/_branch-audits/asset-gap-remediation | planning branch only | LOW | Only this runbook is intended to change; deep-gap-investigation.md remains untouched |
| any path containing /ui/ | all frontend units | PROHIBITED | No unit may modify or add a ui-folder file |

### Parallelization decision rules

- Safe parallel pairs: R-001 and R-004 may be investigated in parallel; R-005 and R-007 may be investigated in parallel after R-004; R-023 may be prepared late while product units are under review.
- Parallel only after prerequisite: R-003 after R-002, R-006 after R-005/R-007, R-018 after R-009/R-010/R-011, R-020 after R-002/R-010, and R-022 after R-021.
- Must remain serial: R-001 -> R-002 -> R-003; R-007 -> R-009 -> R-008; R-010 -> R-014 -> R-011 -> R-012; R-018 -> R-019.
- A unit is not parallel-safe merely because it touches a different finding ID. Shared service, schema, contract, or test-helper files determine the collision classification.

## 12. Findings-to-Remediation Matrix

Each finding appears exactly once as a primary mapping. Supporting units are named where a primary closure depends on a foundation. Initial tracking values are intentionally OPEN and uncommitted.

| Finding | Severity | Title | Primary unit | Wave | Merge gate | Prerequisites | Status | Implementation commit | Independent review | Wave verification | Notes |
|---|---:|---|---|---:|---|---|---|---|---|---|---|
| AM-001 | BLOCKER | Organization isolation is not enforced in Asset data access | R-002 | 1 | MUST FIX BEFORE MERGE | R-001 | OPEN | — | — | — | R-001 is the ownership-model prerequisite |
| AM-002 | HIGH | Asset cancellation ignores linked lifecycle effects | R-010 | 3 | MUST FIX BEFORE MERGE | R-005, R-007, R-009 | OPEN | — | — | — | Exact reversal details also use R-011/R-012/R-014 |
| AM-003 | HIGH | Composite Asset submission lacks capitalization prerequisite | R-010 | 3 | MUST FIX BEFORE MERGE | R-011 | OPEN | — | — | — | Submit barrier is in R-010; target validity in R-011 |
| AM-004 | HIGH | Capitalization cancellation uses timestamp instead of lineage | R-011 | 3 | MUST FIX BEFORE MERGE | R-014 | OPEN | — | — | — | Source barrier lineage and later-event guard |
| AM-005 | HIGH | Opening straight-line basis is incorrect | R-007 | 2 | MUST FIX BEFORE MERGE | R-004 | OPEN | — | — | — | Numeric 1000/100/200/3 fixture required |
| AM-006 | HIGH | WDV revision retains stale rate | R-008 | 2 | MUST FIX BEFORE MERGE | R-005, R-007, R-009 | OPEN | — | — | — | ERPNext current-value derivation |
| AM-007 | HIGH | Available-for-use date is optional/falls back to purchase date | R-010 | 3 | MUST FIX BEFORE MERGE | R-004 | OPEN | — | — | — | Ordinary Asset rule; explicit component exception |
| AM-008 | HIGH | Secondary-book adjustment can overwrite root/default state | R-005 | 2 | MUST FIX BEFORE MERGE | R-001, R-004 | OPEN | — | — | — | Root fields become defined default projection |
| AM-009 | HIGH | Contradictory capitalization target input is accepted | R-011 | 3 | MUST FIX BEFORE MERGE | R-010, R-014 | OPEN | — | — | — | Reject NEW_ASSET plus targetAssetId |
| AM-010 | HIGH | Date-only values shift across timezone/form/report paths | R-004 | 1 | MUST FIX BEFORE MERGE | None | OPEN | — | — | — | R-019 is a frontend adoption/support unit |
| AM-011 | HIGH | Async category defaults overwrite persisted edit values | R-019 | 4 | MUST FIX BEFORE MERGE | R-004, R-018 | OPEN | — | — | — | Hydration and dirty-state proof |
| AM-012 | BLOCKER | Realtime Asset events are organization-blind | R-003 | 1 | MUST FIX BEFORE MERGE | R-001, R-002 | OPEN | — | — | — | Separate event privacy boundary |
| AM-013 | HIGH | Submitted capitalization target can be deleted | R-011 | 3 | MUST FIX BEFORE MERGE | R-010, R-014 | OPEN | — | — | — | Restrictive policy or immutable cancellation proof |
| AM-014 | HIGH | Submit/cancel has split transaction and race window | R-010 | 3 | MUST FIX BEFORE MERGE | R-005, R-007, R-009 | OPEN | — | — | — | Failure injection and concurrent transition tests |
| AM-015 | HIGH | Disposal restore omits disposal-date depreciation reversal | R-012 | 3 | MUST FIX BEFORE MERGE | R-011, R-014 | OPEN | — | — | — | Original schedule-date exception required |
| AM-016 | HIGH | Submission does not create initial receipt movement | R-013 | 3 | MUST FIX BEFORE MERGE | R-010 | OPEN | — | — | — | Idempotent, actor-attributed receipt |
| AM-017 | HIGH | Fixed Asset Register lacks exact book/company/as-of scope | R-006 | 2 | MUST FIX BEFORE MERGE | R-002, R-005, R-007 | OPEN | — | — | — | Existing mocked tests are insufficient |
| AM-018 | HIGH | Carrying-value aggregation mixes books/future adjustments | R-005 | 2 | MUST FIX BEFORE MERGE | R-001, R-004 | OPEN | — | — | — | R-006 consumes the corrected balance service |
| AM-019 | HIGH | Main Asset form cannot represent Asset types | R-018 | 4 | MUST FIX BEFORE MERGE | R-009, R-010, R-011 | OPEN | — | — | — | UI source is Aria, not ERPNext |
| AM-020 | HIGH | Finance-book depreciation controls are dropped by form | R-018 | 4 | MUST FIX BEFORE MERGE | R-009 | OPEN | — | — | — | Contract, hydration, payload, persistence round-trip |
| AM-021 | HIGH | Depreciation revision changes life/rate/date basis | R-008 | 2 | MUST FIX BEFORE MERGE | R-005, R-007, R-009 | OPEN | — | — | — | Original-life DDB and exact-month extension |
| AM-022 | HIGH | Shift depreciation is not wired into lifecycle | R-009 | 2 | MUST FIX BEFORE MERGE | R-005, R-007 | OPEN | — | — | — | Persist factors or reject support |
| AM-023 | HIGH | Zero-carrying WDV can persist non-finite values | R-007 | 2 | MUST FIX BEFORE MERGE | R-004 | OPEN | — | — | — | Engine and persistence finite guards |
| AM-024 | HIGH | CWIP can be reported ready without a worker | R-021 | 5 | MUST FIX BEFORE MERGE | R-010, R-011 | OPEN | — | — | — | Readiness/release contract |
| AM-025 | HIGH | Maintenance status uses server-local midnight | R-004 | 1 | MUST FIX BEFORE MERGE | None | OPEN | — | — | — | Business timezone adoption |
| AM-026 (promoted P-004) | HIGH | Value-adjustment cancellation overwrites later state | R-014 | 3 | MUST FIX BEFORE MERGE | R-005, R-010 | OPEN | — | — | — | Promoted hypothesis; no duplicate primary row |
| AM-027 | MEDIUM | Draft Asset trusts raw company/item references | R-015 | 3 | SHOULD FIX BEFORE MERGE | R-001, R-002 | OPEN | — | — | — | Explicit draft policy and submit revalidation |
| AM-028 | MEDIUM | Repair invoices lack submitted/unallocated validation | R-016 | 3 | SHOULD FIX BEFORE MERGE | R-001, R-002 | OPEN | — | — | — | Reject unsupported purchasing references |
| AM-029 | MEDIUM | Maintenance assignment is optional | R-016 | 3 | SHOULD FIX BEFORE MERGE | R-001, R-002 | OPEN | — | — | — | Required assignee or explicit unassigned state |
| AM-030 | MEDIUM | Asset deletion removes audit history/no actor | R-017 | 3 | SHOULD FIX BEFORE MERGE | R-001, R-002 | OPEN | — | — | — | Retention policy must be explicit |
| AM-031 | MEDIUM | Location deletion nulls historical movement endpoints | R-017 | 3 | SHOULD FIX BEFORE MERGE | R-001, R-002 | OPEN | — | — | — | Restrict/archive or snapshot identity |
| AM-032 | MEDIUM | Document-series year uses server-local date | R-004 | 1 | SHOULD FIX BEFORE MERGE | None | OPEN | — | — | — | Implemented with required high date primitive |
| AM-033 | MEDIUM | Exhausted CWIP failures are silently re-eligible | R-021 | 5 | SHOULD FIX BEFORE RELEASE | R-010, R-011 | OPEN | — | — | — | R-021 remains required because AM-024 is high |
| AM-034 | MEDIUM | Selectors truncate records and schedules become stale | R-020 | 4 | SHOULD FIX BEFORE RELEASE | R-002, R-010 | OPEN | — | — | — | Large-dataset and invalidation proof |
| AM-035 | MEDIUM | Direct Asset form routes lack write gating | R-020 | 4 | SHOULD FIX BEFORE RELEASE | R-002 | OPEN | — | — | — | Backend authorization remains authoritative |
| AM-036 | MEDIUM | Precision and total-days options are inconsistent | R-009 | 2 | SHOULD FIX BEFORE RELEASE | R-005, R-007 | OPEN | — | — | — | Must be rejected or explicitly supported |
| AM-037 | MEDIUM | Demo capitalization is not production-valid and skips CWIP | R-021 | 5 | SHOULD FIX BEFORE RELEASE | R-010, R-011 | OPEN | — | — | — | R-021 is required for AM-024 |
| AM-038 | LOW | Asset test fixture enum drifts from shared contract | R-023 | 5 | SAFE TO DEFER | None | OPEN | — | — | — | Defer only with hygiene owner |
| P-001 | MEDIUM | Asset Playwright coverage is mostly smoke-level | R-022 | 5 | SHOULD FIX BEFORE RELEASE | Waves 1-4, R-021 | OPEN | — | — | — | Persisted E2E is a release gate |
| P-002 | MEDIUM | Location hierarchy permits cycles | R-017 | 3 | SHOULD FIX BEFORE MERGE | R-001 | OPEN | — | — | — | Same master-data integrity unit |
| P-003 | MEDIUM | Maintenance forms use raw CUIDs | R-020 | 4 | SHOULD FIX BEFORE RELEASE | R-002 | OPEN | — | — | — | Selector/UI portion |
| P-005 | MEDIUM | WDV preview/persistence period conventions differ | R-008 | 2 | MUST FIX BEFORE MERGE | R-005, R-007, R-009 | OPEN | — | — | — | Bundled with high revision basis |
| P-006 | LOW | Legacy maintenance documentation/routes are stale | R-023 | 5 | SAFE TO DEFER | R-022 evidence | OPEN | — | — | — | Do not present stale links as current |
| P-007 | MEDIUM | Demo load-twice/cleanup/reload/worker/restart proof incomplete | R-021 | 5 | SHOULD FIX BEFORE RELEASE | R-010, R-011 | OPEN | — | — | — | Bundled with high CWIP readiness |
| P-008 | LOW | Gap-analysis report has stale counts/terminology | R-023 | 5 | SAFE TO DEFER | Final route inventory | OPEN | — | — | — | Historical labels must be explicit |
| P-009 | MEDIUM | Asset/book/activity creation is not one transaction | R-015 | 3 | SHOULD FIX BEFORE MERGE | R-001, R-002 | OPEN | — | — | — | Atomic draft initialization |
| P-010 | MEDIUM | Chronology guards are incomplete | R-014 | 3 | MUST FIX BEFORE MERGE | R-005, R-010 | OPEN | — | — | — | Bundled with high stale-rollback risk |

No status in this matrix may be advanced by editing the matrix. Status changes require the evidence defined in Section 16.

## 13. Per-Unit Validation Strategy

Level 1 is run after every implementation unit and before independent review. The unit detail is the authoritative list of behavior tests; this table is the compact operator map.

| Unit | Focused validation | Required behavior proof |
|---|---|---|
| R-001 | Migration compatibility script; db:verify-migrations; new ownership integration | Deterministic Company/Asset/master ownership backfill and unmapped-row failure |
| R-002 | Serial backend Asset suite; two-org PostgreSQL integration | Cross-org list/direct/read/write/lifecycle/report denial |
| R-003 | Router/subscription tests; two authenticated subscribers | No cross-org event, no full payload, reconnect/teardown safe |
| R-004 | depreciation.config and scheduler tests under three TZ values; date form utilities | Calendar-day, month-end, maintenance boundary, and series-year stability |
| R-005 | Value-adjustment/persistence/revision tests; real two-book fixture | Secondary book cannot overwrite root; future/other-book effects excluded |
| R-006 | fixed-asset-register-report unit plus real report integration | Exact company, selected/default book, as-of/fiscal scope, no double count |
| R-007 | schedule-engine unit and depreciation unit target | Opening SL numeric fixture, zero WDV finite terminal state |
| R-008 | revision service, schedule engine, value-adjustment preview/persistence | Original-life DDB, current-value WDV, exact months, stable cadence |
| R-009 | engine/revision/accounting tests and persisted finance-book option fixture | Shift factors, precision, total-days, and unsupported-option rejection |
| R-010 | lifecycle unit/action tests and real transaction/concurrency specs | Composite/date gates, atomic submit/cancel, failure injection, idempotent retry |
| R-011 | capitalization service/FK tests and real target/concurrency integration | Target validation/protection, source lineage, exact cancellation |
| R-012 | depreciation barrier/restore tests and real multi-book integration | Disposal-date barrier reversal and original-date exception |
| R-013 | movement/lifecycle tests and persisted submit flow | One actor-attributed initial receipt, no duplicate on retry |
| R-014 | value-adjustment/revision tests and later-event concurrency integration | Stale rollback conflicts, selected-book exact reversal |
| R-015 | Asset service tests and creation transaction integration | Invalid references fail and Asset/books/activity commit atomically |
| R-016 | repair/maintenance tests and purchasing/member integration | Invoice status/amount/account and assignment invariants |
| R-017 | location/activity tests and FK/deletion integration | Actor retention, historical endpoint preservation, no cycles |
| R-018 | main form/contract tests plus persisted round-trip | Asset type and all finance-book controls survive reload |
| R-019 | form hydration/date tests under three TZ values | Category defaults cannot overwrite edit values; no date shift |
| R-020 | selector/invalidation/auth tests plus live browser workflow | Over-cap search, schedule refresh, direct-route role matrix |
| R-021 | CWIP/health/demo tests and disposable Compose runtime | Readiness, terminal failure, worker posting, demo idempotency |
| R-022 | targeted persisted Playwright pack | Authenticated create/submit/process/reload/report and two-org denial |
| R-023 | affected fixture test; targeted rg; git diff --check | Shared enum and documentation claims match final routes/evidence |

### Unit command catalogue

Use the command paths already present in the repository:

    bun --cwd apps/backend run test -- asset
    bun --cwd apps/backend run test:depreciation:unit
    bun --cwd apps/backend run test:depreciation:integration
    bun --cwd apps/backend run test:depreciation:migrations
    bun --cwd apps/backend run db:verify-migrations
    bun --cwd apps/backend run test:demo-safety
    bun --cwd apps/backend run depreciation:queue -- status
    bun --cwd apps/frontend run test
    bun --cwd apps/frontend run typecheck
    bun --cwd apps/frontend run test:e2e -- e2e/asset-lifecycle.spec.ts
    bun run validate:local
    bun run validate
    git diff --check

The backend Asset helper must run serially. The existing test:integration script currently aliases depreciation integration; if a new generic Asset integration target is added, update the package/turbo/CI wiring in the same unit that introduces the target.

## 14. Wave Validation Gates

Wave validation runs only after every unit in that wave has an independent review PASS. A unit remains IMPLEMENTED or REVIEW_PASSED until the wave gate succeeds.

### Wave 1 gate

    bun --cwd apps/backend run test -- asset
    bun --cwd apps/backend run test:depreciation:migrations
    bun --cwd apps/backend run db:verify-migrations
    TZ=UTC bun --cwd apps/backend run test -- asset
    TZ=Asia/Kolkata bun --cwd apps/backend run test -- asset
    TZ=America/New_York bun --cwd apps/backend run test -- asset

Add and run real two-organization API/report/event tests. A passing org middleware unit alone is not evidence of isolation.

### Wave 2 gate

    bun --cwd apps/backend run test -- asset
    bun --cwd apps/backend run test:depreciation:unit
    bun --cwd apps/backend run test:depreciation:integration
    bun --cwd apps/backend run test:depreciation:migrations
    bun --cwd apps/frontend run test
    bun --cwd apps/frontend run typecheck

Require the numeric fixtures in R-007 through R-009, real two-book persistence, exact report scope, and no non-finite values.

### Wave 3 gate

Run the serial Asset backend suite, real PostgreSQL transaction/concurrency tests, movement/repair/maintenance tests, and the capitalization/disposal/value-adjustment reversal pack. Verify persisted state after reload and check accounting totals/source IDs.

    bun --cwd apps/backend run test -- asset
    bun --cwd apps/backend run test:depreciation:integration
    bun --cwd apps/backend run db:verify-migrations

### Wave 4 gate

    bun --cwd apps/frontend run test
    bun --cwd apps/frontend run typecheck
    bun --cwd apps/frontend run test:e2e -- e2e/asset-lifecycle.spec.ts e2e/fixed-asset-register.spec.ts

Require live selector, invalidation, role-route, form round-trip, date, and no-ui-folder checks.

### Wave 5 gate

    bun run validate
    bun --cwd apps/backend run test:depreciation:migrations
    bun --cwd apps/backend run test:demo-safety
    bun run test:e2e

Then run the Compose production smoke/recovery flow, the isolated demo load/process/reload/cleanup/second-load/restart proof, and the exact SHA GitHub Actions gate. The public production-smoke workflow checks only exact backend/frontend readiness; attach the broader Asset evidence separately.

## 15. Final Branch Validation Gate

The final gate runs after all MUST-FIX units are REVIEW_PASSED and all SHOULD units are either REVIEW_PASSED or explicitly deferred with an owner, rationale, and date. It runs from a clean checkout at the exact candidate SHA.

### Static and package validation

    bun run validate
    bun run test:e2e
    git diff --check
    git status --short

bun run validate covers build, test, lint, and typecheck through Turborepo. It does not by itself prove migration compatibility, queue execution, demo safety, restart recovery, or authenticated persisted Asset workflows.

### Database and migration validation

    bun --cwd apps/backend run test:depreciation:migrations
    bun --cwd apps/backend run db:verify-migrations

Run both fresh and legacy migration paths in disposable databases. Do not point these commands at production or a user database.

### Asset and finance validation

- Serial backend Asset suite.
- Depreciation unit and integration suites.
- Real two-organization isolation.
- Real two-book/as-of report and journal fixtures.
- Numeric opening SL, DDB, WDV, shift, precision, total-days, and zero-value fixtures.
- Submit/cancel, capitalization, disposal/restore, movement, repair, maintenance, value-adjustment, and concurrency fixtures.

### Runtime and container validation

    docker compose -f docker-compose.production.yml config --quiet
    docker compose -f docker-compose.production.yml build --no-cache backend frontend
    docker compose -f docker-compose.production.yml up -d postgres redis migrate backend frontend

Require:

- migrate exits successfully;
- GET /health/ready returns exactly 200 and reports all required backend dependencies;
- GET /ready/ returns exactly 200 with the frontend service status;
- Redis stop makes backend readiness fail and restart restores it;
- backend restart rediscovery is idempotent;
- no duplicate depreciation or CWIP accounting rows are created.

Use the repository’s exact container command for queue status:

    docker compose -f docker-compose.production.yml exec -T backend bun --cwd=/app/apps/backend run depreciation:queue -- status

### Demo validation

Use only an explicitly isolated database and the repository’s destructive-operation flags:

    ARIA_ALLOW_DEMO_DATA_MUTATION=true ARIA_DEMO_DATABASE_ISOLATED=true bun --cwd apps/backend run demo:load:small

Record status, load, CWIP/depreciation processing, reload, cleanup, second load, restart, and duplicate-entry counts. Do not enable demo loading at startup, in a pre-deploy command, or in a scheduled job.

### Release evidence

The candidate SHA must have a real green GitHub Actions run/check suite. Local build, lint, unit, Compose, or E2E results cannot substitute for a failed or absent remote CI run. Record the exact SHA, workflow run, migration result, readiness responses, browser artifacts, database counts, and any deferred finding owner.

## 16. Status Tracking Rules

Use only these statuses:

| Status | Meaning | Required transition evidence |
|---|---|---|
| OPEN | No implementation started | Initial state |
| IN_PROGRESS | Assigned session is actively implementing | Unit owner and branch/diff identified |
| IMPLEMENTED | Implementation and tests exist; no independent review PASS yet | Level 1 focused validation passed and diff is available |
| REVIEW_FAILED | Fresh independent reviewer found unresolved defects | Review report lists actionable failures |
| REVIEW_PASSED | Fresh independent reviewer found no blocking defect | Reviewer explicitly outputs PASS against the assigned unit |
| VERIFIED_CLOSED | Review PASS plus wave-level integration gate passed | Wave evidence bundle and coordinator update |

Required state machine:

    OPEN -> IN_PROGRESS -> IMPLEMENTED -> REVIEW_PASSED -> VERIFIED_CLOSED
                                 \-> REVIEW_FAILED -> IN_PROGRESS

Rules:

- A green unit test cannot skip independent review.
- A reviewer PASS cannot skip the wave gate.
- A status table edit is not evidence.
- If a reviewer finds an adjacent defect, keep the unit bounded and record the new defect for a later unit or a runbook update.
- If a migration or runtime gate is not run, the relevant unit cannot be VERIFIED_CLOSED.
- A deferred finding remains OPEN or explicitly deferred in maintainer tracking; this runbook’s required statuses do not turn deferral into closure.

## 17. Git / Commit Strategy

### Implementation branch

Each future unit should be implemented on a bounded branch from the current remediation lineage. The branch name must use the repository’s professional prefixes and describe the work, for example:

    fix/asset-org-scoped-access
    fix/asset-depreciation-revision-basis
    test/asset-persisted-e2e

Do not use AI/product branding in branch names. Do not branch from master unless the maintainer has first merged the intended remediation lineage.

### Commit boundary

One reviewed remediation unit normally produces one final commit containing the implementation, regression tests, required migration, contract updates, and narrowly necessary documentation.

Preferred messages:

    fix(asset): enforce organization-scoped Asset access
    fix(asset): align depreciation revisions with original life
    test(asset-e2e): prove persisted authenticated Asset workflows
    docs(asset): align Asset fixtures and route guidance

The commit order is mandatory:

    IMPLEMENTED
        -> independent review PASS
        -> focused diff/status/diff-check inspection
        -> one atomic commit
        -> wave validation

Do not commit first-pass code. Do not amend a previous unit commit. Do not stage unrelated user changes. Before commit, run:

    git status
    git diff
    git diff --check

Verify that no application file, ui folder file, generated junk, credentials, or environment file was included unless the assigned unit explicitly requires a checked-in migration/contract/test/documentation artifact.

## 18. Implementation Session Template

Use this prompt for a fresh implementation session. Replace the placeholders and do not provide an adjacent unit.

    You are implementing remediation unit <R-ID>: <TITLE> in Aria.

    Read only these sections first:
    1. the assigned unit <R-ID> in remediation-runbook.md;
    2. the corresponding finding rows in deep-gap-investigation.md;
    3. the exact Aria paths and symbols listed by the unit.

    Then:
    - Inspect the current implementation and tests.
    - Inspect the relevant .erpnext functions before making any business-rule change.
    - Use at most 2-3 read-only sub-agents for bounded questions; do not delegate production writes.
    - Keep the main session as the sole production-code writer.
    - Implement only <R-ID>. Do not opportunistically fix adjacent units.
    - Do not modify any file inside a ui folder.
    - Add behavior-focused regression tests in the same diff.
    - Preserve scheduler discovery-only and worker execution-only boundaries.
    - Do not suppress errors, warnings, types, or failing tests.
    - Run Level 1 focused validation and the broader validation required by <R-ID>.
    - Run git status, git diff, and git diff --check.
    - STOP WITHOUT COMMITTING.

    Report:
    - exact files changed;
    - invariant implemented;
    - tests added and commands run;
    - output/results;
    - migration/runtime assumptions;
    - known gaps or adjacent findings discovered but not changed;
    - whether the work is IMPLEMENTED, not VERIFIED_CLOSED.

If an adjacent defect is required to make the assigned invariant safe, stop and explain the dependency before expanding scope. The coordinator may split or update the runbook; do not silently create a mega-commit.

## 19. Independent Review Session Template

Use a brand-new GPT-5.6-luna(max) session after the implementation session stops. The reviewer did not implement the change and must treat the diff as untrusted.

    You are independently reviewing remediation unit <R-ID>: <TITLE>.

    You did not implement this change. Assume it may contain subtle mistakes.

    Read:
    - the assigned remediation-unit section;
    - every corresponding audit finding and its evidence;
    - the complete uncommitted diff;
    - the relevant current Aria architecture;
    - the relevant .erpnext invariant;
    - all new and changed tests.

    Attempt to falsify completion:
    - search for missing call sites and unscoped direct-ID paths;
    - test the negative and cross-organization cases;
    - check transaction, lock, chronology, source-lineage, and retry behavior;
    - inspect numeric/date edge cases and persisted reload behavior;
    - check for stale root/secondary finance-book projection;
    - check for warnings/errors/type/test suppression;
    - check for unrelated modifications and any changed ui folder file;
    - compare the implementation to the stated non-goals and acceptance criteria.

    Do not modify code. Output exactly:
    PASS
    or
    FAIL

    For FAIL, list exact actionable defects, file/symbol locations, missing tests,
    and the smallest correction needed. Do not approve because the tests are green
    if the tests do not prove the assigned invariant.

A PASS means the unit is REVIEW_PASSED, not VERIFIED_CLOSED. A FAIL returns the unit to IN_PROGRESS after the coordinator decides the correction scope; then a fresh review is mandatory.

## 20. Final Merge-Readiness Audit

After all remediation waves, use a brand-new fresh-context session. Do not tell the auditor that the branch is fixed or safe.

Prompt:

    Determine independently whether this branch is now safe to merge into master.

    Use the original deep audit and remediation runbook as references, but do not
    assume any finding is closed merely because its status says so.

    Compare master with the final remediation HEAD. Inspect:
    - every BLOCKER and HIGH finding;
    - every SHOULD-FIX finding and its owner/deferral evidence;
    - organization/company/Asset ownership and all direct-ID predicates;
    - realtime event privacy and reconnect behavior;
    - date-only and APP_TIME_ZONE behavior;
    - finance-book/root projection/as-of reports;
    - depreciation numeric fixtures, revision basis, shifts, precision, and finite guards;
    - lifecycle transactions, locks, source lineage, reversals, and concurrency;
    - frontend contracts, hydration, selectors, invalidation, and role routes;
    - CWIP readiness, failure retention, demo load/process/restart;
    - persisted authenticated browser E2E;
    - migration compatibility, runtime readiness, exact-SHA CI, and unrelated diff scope.

    Search for regressions and new defects. Treat missing evidence as unproven,
    not as success.

    End with exactly:
    READY TO MERGE INTO MASTER: YES
    or
    READY TO MERGE INTO MASTER: NO

The final auditor must attach a finding-by-finding evidence table. Any NO result returns the relevant units to OPEN or IN_PROGRESS or leaves them explicitly deferred; it does not get resolved by editing this runbook.

## 21. Recommended Execution Order

Follow this sequence literally unless the coordinator records a dependency correction in the runbook.

1. Implement R-001 first. Establish Organization -> Company -> Asset/master ownership and migration evidence.
2. R-004 may be implemented in parallel with R-001 only with disjoint file ownership; otherwise run it immediately after R-001.
3. Implement R-002 after R-001. Propagate trusted organization context through every Asset query/mutation/report path.
4. Implement R-003 after R-002. Isolate event topics, minimize payloads, and prove two-organization subscription privacy.
5. Run the Wave 1 gate. Do not proceed on membership-only or mocked isolation evidence.
6. Implement R-005. Establish book/date state ownership and root default-book projection.
7. R-007 may be implemented in parallel with R-005 if the engine files are isolated; then run R-009 after the engine basis is stable.
8. Implement R-009. Persist/apply shift, precision, prorata, and total-days options or reject unsupported options.
9. Implement R-008. Correct revision life/rate/date basis and preview/persistence conventions.
10. Implement R-006 after R-005 and R-007. Correct Fixed Asset Register exact company, book, and as-of scope.
11. Run the Wave 2 gate with real two-book and numeric fixtures.
12. Implement R-010. Establish the locked transactional submit/cancel state machine and date/composite prerequisites.
13. Implement R-014 after R-010. Guard value-adjustment cancellation with effective-date/source lineage and later-event checks.
14. Implement R-011 after R-014. Protect capitalization targets and record exact source lineage.
15. Implement R-012 after R-011. Reverse disposal barrier effects by source/book and preserve original-date exceptions.
16. Implement R-013 after R-010, serial with AssetService lifecycle work, to create the initial receipt movement idempotently.
17. Implement R-015, R-016, and R-017 serially because they are likely to collide in AssetService/schema work. Their conceptual scopes are independent, but their files are not.
18. Run the Wave 3 gate with failure injection, real PostgreSQL concurrency, movement, repair, maintenance, capitalization, disposal, value-adjustment, and history checks.
19. Implement R-018. Round-trip Asset type and finance-book controls in the main form.
20. Implement R-019 immediately after R-018. Protect hydration/default ordering and date-only form behavior.
21. Implement R-020 after R-002/R-010. Server-search selectors, complete invalidation, direct-route role gating, and organization-safe cache behavior may use disjoint frontend files from R-018/R-019.
22. Run the Wave 4 gate with frontend tests and persisted browser workflows.
23. Implement R-021. Make CWIP readiness/retry/demo runtime proof match the actual deployment topology.
24. Implement R-022 last among product-facing units. Run authenticated persisted E2E, two-organization denial, worker-backed processing, reload/report, and restart/idempotency evidence.
25. Implement R-023 only after final routes/contracts/evidence stabilize. It may be parallelized late, but it cannot downgrade an unresolved finding.
26. Run the Wave 5 and final branch gates, including fresh/legacy migrations, serial backend tests, frontend tests, build/lint/typecheck, Compose health/recovery, isolated demo load/process/reload/cleanup/second-load/restart, exact readiness endpoints, and green GitHub Actions on the exact candidate SHA.
27. Request the fresh final merge-readiness audit. Only an independent READY TO MERGE INTO MASTER: YES permits the maintainer to merge the remediation lineage.

The two BLOCKER findings share R-001 and R-002 as foundational dependencies, but must remain separate commits: AM-001 closes data-access isolation; AM-012 closes realtime fan-out and payload privacy. R-001/R-002, R-004, R-005, R-007/R-009/R-008, and R-010/R-014/R-011/R-012 are the serial critical path. R-023 is the only deliberately late, low-risk parallel work.
