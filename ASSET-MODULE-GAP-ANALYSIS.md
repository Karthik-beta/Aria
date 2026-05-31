# Asset Management — Complete Gap Analysis

> Comprehensive comparison between ERPNext's Asset Management module (the source of truth for business logic) and Aria's current Asset Management implementation.

---

## Table of Contents

1. [Scope and Methodology](#1-scope-and-methodology)
2. [ERPNext Asset Module — Complete Inventory](#2-erpnext-asset-module--complete-inventory)
3. [Aria Asset Module — Current State](#3-aria-asset-module--current-state)
4. [Gap-by-Gap Analysis](#4-gap-by-gap-analysis)
5. [Missing Doctypes / Prisma Models](#5-missing-doctypes--prisma-models)
6. [Missing Reports](#6-missing-reports)
7. [Missing Workflows and Business Logic](#7-missing-workflows-and-business-logic)
8. [Missing Scheduled Jobs](#8-missing-scheduled-jobs)
9. [Missing Frontend Pages](#9-missing-frontend-pages)
10. [Missing Tests](#10-missing-tests)
11. [Missing Setup / Configuration](#11-missing-setup--configuration)
12. [Phase-by-Phase Implementation Plan](#12-phase-by-phase-implementation-plan)
13. [Open Questions for Product Owner](#13-open-questions-for-product-owner)

---

## 1. Scope and Methodology

This document was produced by a complete end-to-end review of both the ERPNext reference implementation (located at `.erpnext/erpnext/assets/`) and Aria's current Asset Management module (located at `apps/backend/src/apps/asset/` and `apps/frontend/src/app/asset/`).

### Research Method

1. **ERPNext code exploration** — Read all Python controllers, JS client files, report definitions, dashboard definitions, doctype JSON schemas, test files, and hooks for scheduled jobs under `.erpnext/erpnext/assets/`.
2. **Aria code exploration** — Read all NestJS services, tRPC routers, Prisma models, Next.js pages, components, Zod schemas, and test files under `apps/backend/src/apps/asset/` and `apps/frontend/src/app/asset/`.
3. **Inventory Management pattern study** — Studied how Aria's Inventory module handles similar patterns (submit/cancel workflows, status management, tRPC routers, form/list pages) to understand local conventions.
4. **Cross-referencing** — For every ERPNext feature, determined whether an equivalent exists in Aria, and if not, why.

---

## 2. ERPNext Asset Module — Complete Inventory

### 2.1 Directory Structure

```
.erpnext/erpnext/assets/
├── __init__.py
├── dashboard_fixtures.py
├── assets_dashboard/asset/asset.json
├── dashboard_chart/
│   ├── asset_value_analytics/
│   ├── category_wise_asset_value/
│   └── location_wise_asset_value/
├── doctype/
│   ├── asset/
│   │   ├── asset.json           (Doctype schema — 200+ fields)
│   │   ├── asset.py             (Controller — 1522 lines)
│   │   ├── asset.js             (Client — 981 lines)
│   │   ├── asset_list.js
│   │   ├── asset_dashboard.py
│   │   ├── depreciation.py      (Depreciation engine — 839 lines)
│   │   └── test_asset.py
│   ├── asset_activity/
│   ├── asset_capitalization/
│   │   ├── asset_capitalization.py      (876 lines)
│   │   ├── asset_capitalization.js
│   │   └── test_asset_capitalization.py
│   ├── asset_capitalization_asset_item/
│   ├── asset_capitalization_service_item/
│   ├── asset_capitalization_stock_item/
│   ├── asset_category/
│   │   ├── asset_category.py
│   │   └── test_asset_category.py
│   ├── asset_category_account/
│   ├── asset_depreciation_schedule/
│   │   ├── asset_depreciation_schedule.py
│   │   ├── deppreciation_schedule_controller.py
│   │   ├── depreciation_methods.py
│   │   └── test_asset_depreciation_schedule.py
│   ├── asset_finance_book/
│   ├── asset_maintenance/
│   │   ├── asset_maintenance.py
│   │   └── test_asset_maintenance.py
│   ├── asset_maintenance_log/
│   │   ├── asset_maintenance_log.py
│   │   ├── asset_maintenance_log_calendar.js
│   │   ├── asset_maintenance_log_list.js
│   │   └── test_asset_maintenance_log.py
│   ├── asset_maintenance_task/
│   ├── asset_maintenance_team/
│   │   └── test_asset_maintenance_team.py
│   ├── asset_movement/
│   │   ├── asset_movement.py
│   │   └── test_asset_movement.py
│   ├── asset_repair/
│   │   ├── asset_repair.py      (619 lines)
│   │   ├── asset_repair.js
│   │   └── test_asset_repair.py
│   ├── asset_repair_consumed_item/
│   ├── asset_repair_purchase_invoice/
│   ├── asset_shift_allocation/
│   │   └── test_asset_shift_allocation.py
│   ├── asset_shift_factor/
│   │   └── test_asset_shift_factor.py
│   ├── asset_value_adjustment/
│   │   ├── asset_value_adjustment.py
│   │   └── test_asset_value_adjustment.py
│   ├── depreciation_schedule/
│   ├── linked_location/
│   ├── location/
│   │   ├── location.py
│   │   ├── location.js
│   │   ├── location_tree.js
│   │   └── test_location.py
│   └── maintenance_team_member/
├── module_onboarding/asset_onboarding/asset_onboarding.json
├── number_card/
│   ├── asset_value/
│   ├── new_assets_(this_year)/
│   └── total_assets/
├── onboarding_step/
│   ├── create_asset_category/
│   ├── create_asset_item/
│   ├── create_asset_location/
│   ├── create_existing_asset/
│   ├── learn_asset/
│   └── view_balance_sheet/
├── report/
│   ├── asset_activity/
│   ├── asset_maintenance/
│   └── fixed_asset_register/
│       ├── fixed_asset_register.json
│       ├── fixed_asset_register.js
│       └── fixed_asset_register.py
└── workspace/assets/assets.json
```

### 2.2 All Doctypes (25 Total)

| # | DocType | Type | Submittable | Description |
|---|---|---|---|---|
| 1 | **Asset** | Primary | Yes | Core asset record. Status lifecycle: Draft → Submitted → Partially Depreciated → Fully Depreciated → Sold/Scrapped |
| 2 | **Asset Category** | Primary | No | Classification. Holds default depreciation parameters and GL account mappings per company |
| 3 | **Asset Depreciation Schedule** | Primary | Yes | One per asset per finance book. Computed schedule rows with dates, amounts, accumulated values |
| 4 | **Asset Capitalization** | Primary | Yes | Creates composite assets from consumed stock items, other assets, and service items |
| 5 | **Asset Movement** | Primary | Yes | Tracks physical movement: Transfer (location change), Issue (to employee), Receipt (from purchase), Transfer+Issue |
| 6 | **Asset Repair** | Primary | Yes | Tracks repairs. Can capitalize repair cost into asset value. Consumes stock items. Links purchase invoices |
| 7 | **Asset Value Adjustment** | Primary | Yes | Revalues asset up/down. Creates journal entry. Reschedules depreciation |
| 8 | **Asset Maintenance** | Primary | No | Preventive maintenance schedule for an asset. Tasks with periodicity |
| 9 | **Asset Maintenance Log** | Primary | No | Logs completion of individual maintenance tasks. Status: Planned → Overdue → Completed/Cancelled. Has calendar view |
| 10 | **Asset Maintenance Team** | Primary | No | Team of maintenance personnel |
| 11 | **Asset Activity** | Primary | No | Audit log. Auto-created on all major actions (create, submit, cancel, scrap, restore, transfer, repair, capitalize, adjust) |
| 12 | **Location** | Primary (NestedSet) | No | Hierarchical physical location tree with GeoJSON support |
| 13 | **Asset Shift Factor** | Primary | No | Defines shift multipliers (Single=1, Double=1.5, Triple=2) for shift-based depreciation |
| 14 | **Asset Shift Allocation** | Primary | Yes | Allocates asset to shifts over a date range |
| 15 | **Asset Finance Book** | Child | — | Depreciation parameters per finance book: method, frequency, total depreciations, salvage value, rate, daily prorata, shift-based flag |
| 16 | **Asset Category Account** | Child | — | GL account mappings per company: Fixed Asset, Accumulated Depreciation, Depreciation Expense, CWIP |
| 17 | **Depreciation Schedule** | Child | — | Individual depreciation line items: schedule_date, depreciation_amount, accumulated_depreciation_amount, journal_entry, shift |
| 18 | **Asset Movement Item** | Child | — | Individual asset line in a movement: asset, source/target location, from/to employee |
| 19 | **Asset Maintenance Task** | Child | — | Individual maintenance task: type, periodicity, assign_to, start/end dates, next_due_date, maintenance_status |
| 20 | **Maintenance Team Member** | Child | — | Team member: team_member (Link to User), full_name, phone, email |
| 21 | **Asset Capitalization Asset Item** | Child | — | Consumed assets in capitalization |
| 22 | **Asset Capitalization Stock Item** | Child | — | Consumed stock items |
| 23 | **Asset Capitalization Service Item** | Child | — | Consumed service items |
| 24 | **Asset Repair Consumed Item** | Child | — | Stock items consumed during repair |
| 25 | **Asset Repair Purchase Invoice** | Child | — | Purchase invoices linked to repair cost |

### 2.3 All Reports (5 Total)

| # | Report | Type | Module | Description |
|---|---|---|---|---|
| 1 | **Fixed Asset Register** | Script Report | Assets | Comprehensive register showing asset value, depreciation, current value. Supports grouping by Category or Location. Includes bar chart. Filters: company, status, category, cost center, date range, finance book |
| 2 | **Asset Depreciation Ledger** | Script Report | Accounts | Ledger of all depreciation entries posted against assets via GL Entry. Shows: Asset, Depreciation Date, Purchase Amount, Opening Accumulated Depreciation, Depreciation Amount, Accumulated Depreciation, Value After Depreciation, JE reference, Category, Cost Center, Status |
| 3 | **Asset Depreciations and Balances** | Script Report | Accounts | Period-based summary with two grouping modes (Category or Asset). Computes: opening/closing values, new purchases, sold/scrapped/capitalized values, revaluation delta, depreciation during period, depreciation eliminated by disposal, accumulated depreciation, net asset value |
| 4 | **Asset Activity** | Report Builder | Assets | Chronological history of all logged asset activities |
| 5 | **Asset Maintenance** | Report Builder | Assets | All maintenance records with tasks, assignees, due dates, and completion status |

### 2.4 All Dashboard Components

| Type | Name | Description |
|---|---|---|
| Number Card | Total Assets | Count of all Asset documents |
| Number Card | New Assets (This Year) | Count of assets created this year |
| Number Card | Asset Value | Sum of `value_after_depreciation` |
| Chart | Asset Value Analytics | Stacked bar chart (Asset Value vs Depreciated Amount) over monthly periods |
| Chart | Category-wise Asset Value | Donut chart of value distribution across categories |
| Chart | Location-wise Asset Value | Donut chart of value distribution across locations |

### 2.5 All Scheduled Jobs (4 Total)

| Job | Schedule | File | Description |
|---|---|---|---|
| Auto-Post Depreciation Entries | Daily | `depreciation.py:post_depreciation_entries()` | Automatically posts depreciation journal entries for all assets with due schedules |
| Update Asset Maintenance Status | Daily | `asset.py:update_maintenance_status()` | Sets status to "Out of Order" (pending repairs) or "In Maintenance" (due tasks) |
| CWIP GL Entry Posting | Daily | `asset.py:make_post_gl_entry()` | For CWIP-enabled categories, posts GL entries when `available_for_use_date` is reached |
| Update Maintenance Log Status | Daily | `asset_maintenance_log.py:update_asset_maintenance_log_status()` | Sets overdue maintenance logs to "Overdue" status |

### 2.6 All Onboarding Steps (6 Steps)

1. Learn Asset — Introduction to the Asset module
2. Create Asset Category — Set up asset classification
3. Create Asset Item — Create a fixed asset item in inventory
4. Create Asset Location — Set up physical locations
5. Create Existing Asset — Create your first asset
6. View Balance Sheet — See asset accounts in the balance sheet

### 2.7 Key Python Controllers (by Line Count)

| File | Lines | Description |
|---|---|---|
| `asset.py` | 1522 | Main asset controller: validation, submit/cancel, GL entries, split, sales invoice creation, depreciation rate calculation |
| `depreciation.py` | 839 | Depreciation entry posting, scrap/restore logic, disposal GL entries, journal entry creation, error notification |
| `asset_capitalization.py` | 876 | Composite asset creation: consumed stock/assets/services, GL entries, target asset updates |
| `asset_repair.py` | 619 | Repair tracking, stock consumption, cost capitalization, GL entries, depreciation rescheduling |
| `asset_depreciation_schedule.py` | ~400 | Schedule lifecycle: create, submit (Draft→Active), cancel, reschedule |
| `deppreciation_schedule_controller.py` | ~350 | Schedule computation: Straight Line, WDV, DDB, daily prorata, shift-based |
| `depreciation_methods.py` | ~200 | `StraightLineMethod` and `WDVMethod` classes |
| `asset_value_adjustment.py` | ~200 | Revaluation with journal entry, asset value update, depreciation rescheduling |
| `asset_movement.py` | ~200 | Validates locations/employees, updates asset location and custodian on submit/cancel |
| `asset_category.py` | ~150 | Validates finance books, account types, account currency, CWIP accounts, depreciation accounts |

### 2.8 Complete Asset Status Lifecycle (ERPNext)

```
Draft (docstatus=0, asset_type!="Composite Asset")
  │
  ├─► Work In Progress (docstatus=0, asset_type="Composite Asset")
  │
  ▼
Submitted (docstatus=1)
  │
  ├─► Partially Depreciated (value_after_depreciation < net_purchase_amount)
  │     │
  │     └─► Fully Depreciated (value_after_depreciation <= expected_value_after_useful_life)
  │
  ├─► In Maintenance (active maintenance task with today's due date)
  │
  ├─► Out of Order (pending Asset Repair)
  │
  ├─► Scrapped (journal_entry_for_scrap set)
  │     │
  │     └─► [Restore] → back to Submitted/Partially/Fully Depreciated
  │
  ├─► Sold (via Sales Invoice)
  │
  ├─► Capitalized (consumed by Asset Capitalization)
  │
  ├─► Issue (issued to employee via Asset Movement)
  │
  ├─► Receipt (received at location via Asset Movement)
  │
  └─► Cancelled (docstatus=2)
```

### 2.9 GL Entry Summary

| Event | Debit Account | Credit Account |
|---|---|---|
| Asset Submit (CWIP enabled) | Fixed Asset Account | CWIP Account |
| Depreciation Entry | Depreciation Expense Account | Accumulated Depreciation Account |
| Asset Scrap (disposal) | Accumulated Depreciation + Loss Account | Fixed Asset Account |
| Asset Value Increase | Fixed Asset Account | Revaluation Account |
| Asset Value Decrease | Revaluation Account | Fixed Asset Account |
| Asset Repair Capitalization | Fixed Asset Account | Expense Account(s) |
| Asset Capitalization | Target Fixed Asset/CWIP Account | Inventory + Expense Accounts |

---

## 3. Aria Asset Module — Current State

### 3.1 Prisma Models (13 Total)

```
models in schema.prisma:
├── Location                        (hierarchical: parentLocationId, isGroup)
├── AssetCategory                   (flat list, carries depreciation defaults)
├── Asset                           (core entity, 40+ fields)
├── AssetActivity                   (append-only activity log)
├── AssetValueAdjustment            (revaluation document, AVA-YYYY-NNNNN)
├── AssetRevaluationEntry           (journal entry, JE-AVA-YYYY-NNNNN)
├── AssetRevaluationEntryLine       (debit/credit lines)
├── AssetDepreciationSchedule       (depreciation schedule per adjustment)
├── AssetDepreciationScheduleEntry  (per-period entries: sequence, date, amount, accumulated, book value)
├── AssetMaintenanceTeam            (team definition)
├── AssetMaintenanceTeamMember      (team member with role)
├── AssetMaintenance                (one per asset, links to team, contains tasks)
├── AssetMaintenanceTask            (individual tasks with periodicity, type, status)
└── AssetMaintenanceLog             (log entries: completion/cancellation with certificate)
```

### 3.2 Enums (12 Total)

| Enum | Values |
|---|---|
| AssetStatus | DRAFT, SUBMITTED, CANCELLED, PARTIALLY_DEPRECIATED, FULLY_DEPRECIATED, SOLD, SCRAPPED, IN_MAINTENANCE, OUT_OF_ORDER |
| AssetOwner | COMPANY, SUPPLIER, CUSTOMER |
| DepreciationMethod | STRAIGHT_LINE, DOUBLE_DECLINING_BALANCE, WRITTEN_DOWN_VALUE, MANUAL |
| AssetMaintenanceStatus | PLANNED, OVERDUE, CANCELLED |
| AssetMaintenanceLogStatus | PLANNED, COMPLETED, CANCELLED, OVERDUE |
| AssetMaintenanceTaskType | PREVENTIVE_MAINTENANCE, CALIBRATION |
| AssetMaintenancePeriodicity | DAILY, WEEKLY, MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY, TWO_YEARLY, THREE_YEARLY |
| AssetValueAdjustmentStatus | DRAFT, SUBMITTED, CANCELLED |
| AssetValueAdjustmentDirection | INCREASE, DECREASE |
| AssetRevaluationEntryStatus | POSTED, REVERSED |
| AssetRevaluationLineType | DEBIT, CREDIT |
| AssetDepreciationScheduleStatus | ACTIVE, CANCELLED |

### 3.3 Frontend Routes

```
/asset                                    → redirect to /asset/dashboard/overview
/asset/access-denied/                     → access denied page
/asset/dashboard/overview/                → KPIs, charts, realtime (COMPLETE)
/asset/dashboard/profile/                 → user profile
/asset/asset-sub-module/asset/            → asset list + CRUD + realtime (COMPLETE)
/asset/asset-sub-module/asset/form/       → create/edit form with Zod validation (COMPLETE)
/asset/asset-sub-module/asset/[assetId]/  → detail page (COMPLETE but missing tabs)
/asset/asset-sub-module/asset-category/   → category list + CRUD (COMPLETE)
/asset/asset-sub-module/asset-category/form/ → category form (COMPLETE)
/asset/asset-sub-module/location/         → location list + CRUD (COMPLETE)
/asset/asset-sub-module/location/form/    → location form (COMPLETE)
/asset/asset-maintenance/maintenance/     → maintenance records list (COMPLETE)
/asset/asset-maintenance/maintenance-team/ → team list (COMPLETE)
/asset/asset-maintenance/log/             → log list with complete/cancel (COMPLETE)
/asset/asset-maintenance/value-adjustment/ → adjustment list + submit/cancel (COMPLETE)
/asset/asset-maintenance/value-adjustment/form/ → adjustment form with preview (COMPLETE)
/asset/asset-maintenance/form/            → maintenance create/edit form (COMPLETE)
/asset/reports/activity/                  → activity report + export (COMPLETE)
/asset/reports/depreciation-ledger/       → depreciation ledger + export (COMPLETE)
/asset/reports/depreciations-balances/    → depreciations & balances + export (COMPLETE)
/asset/users/                             → user management
```

### 3.4 Backend Services

| File | Lines | Purpose |
|---|---|---|
| `asset.service.ts` | ~3212 | All CRUD + business logic for Assets, Locations, Categories, Value Adjustments, Maintenance Teams, Maintenance Records, Logs. Also generates document series |
| `asset-dashboard.service.ts` | ~600 | Dashboard KPIs, charts, aggregated queries |
| `asset-value-adjustment.utils.ts` | ~408 | Depreciation schedule preview, revaluation entry line building, fixed account derivation |
| `asset-activity-report.ts` | ~200 | Activity report builder |
| `asset-depreciation-ledger-report.ts` | ~250 | Depreciation ledger report builder |
| `asset-depreciations-and-balances-report.ts` | ~546 | Depreciations & balances report builder |
| `asset.types.ts` | ~400 | Prisma-to-domain mapper types and functions |
| `trpc/asset.router.ts` | ~682 | tRPC router: queries, mutations, subscriptions, Excel exports |

### 3.5 Shared Types (`packages/types/src/index.ts`)

All asset types live in the `Asset` namespace (lines 5823-7090):
- All Zod validation schemas for CRUD inputs
- All report input/output interfaces
- All dashboard data interfaces
- All enum definitions

### 3.6 Frontend Test Files (25 Total)

```
apps/frontend/src/app/asset/(protected)/
├── dashboard/overview/
│   └── page.test.tsx
├── asset-sub-module/asset/form/
│   └── page.test.tsx
├── asset-sub-module/asset-category/
│   └── page.test.tsx
├── asset-sub-module/asset-category/form/
│   └── page.test.tsx
├── asset-sub-module/location/
│   └── page.test.tsx
├── asset-sub-module/location/form/
│   └── page.test.tsx
├── asset-maintenance/maintenance/
│   └── page.test.tsx
├── asset-maintenance/maintenance-team/
│   └── page.test.tsx
├── asset-maintenance/maintenance-team/form/
│   └── page.test.tsx
├── asset-maintenance/log/
│   └── page.test.tsx
├── asset-maintenance/value-adjustment/
│   └── page.test.tsx
├── asset-maintenance/value-adjustment/form/
│   └── page.test.tsx
├── asset-maintenance/form/
│   └── page.test.tsx
├── reports/activity/
│   ├── page.test.tsx
│   └── activity.utils.test.ts
├── reports/depreciation-ledger/
│   ├── page.test.tsx
│   └── depreciation-ledger.utils.test.ts
└── reports/depreciations-balances/
    ├── page.test.tsx
    └── depreciations-balances.utils.test.ts
```

**Missing frontend tests:**
- `asset/page.test.tsx` (asset list page)
- `asset/[assetId]/page.test.tsx` (asset detail page)
- `dashboard/overview/dashboard.utils.test.ts` (dashboard utility functions — the `.test.ts` exists but is only 26 lines)

### 3.7 Backend Test Files (8 Total)

```
apps/backend/src/apps/asset/__tests__/
├── asset-activity-report.spec.ts
├── asset-activity.service.spec.ts
├── asset-category.service.spec.ts
├── asset-depreciation-ledger-report.spec.ts
├── asset-depreciations-and-balances-report.spec.ts
├── asset-maintenance.service.spec.ts
├── asset-value-adjustment.service.spec.ts
├── asset-value-adjustment.utils.test.ts
├── location.service.spec.ts
└── maintenance-team.service.spec.ts
```

**Missing backend tests:**
- No `asset.service.spec.ts` (core Asset CRUD: create, update, delete, findAll, findById, series generation, depreciation field inheritance, status guards)
- No `asset-dashboard.service.spec.ts` (dashboard queries)
- No `asset-router.spec.ts` or integration tests for tRPC procedures

---

## 4. Gap-by-Gap Analysis

### GAP 1: Asset Submit/Cancel Workflow (HIGH)

**ERPNext Behavior:**
- `asset.py:on_submit()` (line 252-265):
  1. Validates `available_for_use_date` is set
  2. Creates initial Asset Movement (Receipt) with location and custodian
  3. If CWIP accounting enabled, creates GL entries: Debit Fixed Asset Account, Credit CWIP Account
  4. Converts Draft depreciation schedules to Active
  5. Sets status to "Submitted"
  6. Logs "Asset submitted" activity
- `asset.py:on_cancel()`:
  1. Cancels all linked depreciation entries
  2. Cancels linked Asset Movement
  3. Sets status to "Cancelled"

**Aria Current State:**
- `createAsset` defaults status to `DRAFT` (line 806 of `asset.service.ts`)
- `updateAsset` allows setting any status directly with no validation (line 1074)
- `deleteAsset` checks for SUBMITTED status and blocks deletion (line 1093)
- **No `submitAsset` endpoint exists**
- **No `cancelAsset` endpoint exists**
- `AssetValueAdjustment` has explicit `submit`/`cancel` with full validation, but the core Asset entity lacks this discipline

**Impact:** Assets cannot be properly activated. Status transitions are unguarded. No validation of required fields at submit time.

---

### GAP 2: Asset Disposal / Scrap / Sale Workflow (HIGH)

**ERPNext Behavior:**
- `depreciation.py:scrap_asset()` (line 363):
  1. Validates asset is Submitted, not already Sold/Scrapped/Capitalized
  2. Validates scrap date
  3. Depreciates asset up to scrap date (reschedules, posts entries)
  4. Creates Journal Entry (voucher_type="Asset Disposal"):
     ```
     Credit: Fixed Asset Account (net_purchase_amount)
     Debit:  Accumulated Depreciation Account
     Debit:  Loss on Disposal Account (if loss)
     Credit: Gain on Disposal Account (if gain)
     ```
  5. Sets `disposal_date` and `journal_entry_for_scrap`
  6. Status changes to "Scrapped"
  7. Logs "Asset scrapped" activity
- `depreciation.py:restore_asset()` (line 452):
  1. Reverses the depreciation entry made on disposal date
  2. Resets depreciation schedule (regenerates without disposal date)
  3. Cancels the scrap journal entry
  4. Clears `disposal_date` and `journal_entry_for_scrap`
  5. Recalculates status
  6. Logs "Asset restored" activity
- **Sell Asset** via Sales Invoice: `get_gl_entries_on_asset_disposal()` creates disposal entries on Sales Invoice submit

**Aria Current State:**
- `SOLD` and `SCRAPPED` statuses exist in the `AssetStatus` enum
- `disposalDate` field exists on the Asset model (line 1586 in `schema.prisma`)
- **No `scrapAsset` endpoint**
- **No `sellAsset` endpoint**
- **No `restoreAsset` endpoint**
- `updateAsset` can manually set `disposalDate` and `status`, but this bypasses all workflow validation
- The `buildAssetDepreciationsAndBalancesResult` in `asset-depreciations-and-balances-report.ts` does handle disposal date truncation at report time, but schedule entries themselves are not clipped

**Impact:** No way to formally dispose of assets. Status changes are manual and unguarded. No disposal journal entries. No restore capability.

---

### GAP 3: Asset Movement / Transfer Tracking (HIGH)

**ERPNext Behavior:**
- `asset_movement.py` (Document, submittable):
  - **Purposes:** Receipt, Transfer, Issue, Transfer and Issue
  - **Asset Movement Item** child table: asset, source_location, target_location, from_employee, to_employee
  - `validate()` ensures chronological transaction dates
  - `on_submit()` updates asset `location` and `custodian` fields
  - `on_cancel()` reverts location and custodian to previous values
  - Creates Asset Activity log entries
  - Document series: separate from Asset series

**Aria Current State:**
- Location can be changed via `updateAsset` (direct field update)
- `AssetActivity` log records generic "Asset updated" on any update
- **No `AssetMovement` model**
- **No transfer document**
- **No audit trail of from/to location or from/to custodian**
- **No Asset Movement list page or form page**

**Impact:** No formal tracking of asset transfers. Location history is lost. No transfer approval or documentation.

---

### GAP 4: Scheduled Depreciation Posting (HIGH)

**ERPNext Behavior:**
- `depreciation.py:post_depreciation_entries()` (line 37):
  - Called by daily scheduler job (`hooks.py` line 492)
  - Checks `Accounts Settings.book_asset_depreciation_entry_automatically`
  - Queries all Active depreciation schedules with unposted entries where `schedule_date <= today()`
  - Creates Journal Entry for each due depreciation:
    ```
    Debit:  Depreciation Expense Account
    Credit: Accumulated Depreciation Account
    ```
  - Links journal entry to schedule row
  - Handles frozen accounting periods
  - Error notification to accounts managers on failure

**Aria Current State:**
- `AssetDepreciationSchedule` and `AssetDepreciationScheduleEntry` models exist
- Schedules are created when a Value Adjustment is submitted (lines 1840-1880 of `asset.service.ts`)
- Schedule entries have `depreciationAmount`, `accumulatedDepreciation`, `bookValueAfterDepreciation` fields
- **No `journalEntryId` or posting status on schedule entries**
- **No scheduled job infrastructure**
- **No `postDepreciationEntries` endpoint**
- Depreciation is entirely manual (via Value Adjustments)

**Impact:** Depreciation is never automatically posted. Schedule entries remain projections. Users must manually create value adjustments to book depreciation.

---

### GAP 5: Asset Repair Tracking (HIGH)

**ERPNext Behavior:**
- `asset_repair.py` (Document, submittable, 619 lines):
  - Tracks failure date, completion date, downtime
  - **Consumes stock items** (creates Stock Entry — Material Issue)
  - **Links purchase invoices** for repair cost
  - **Can capitalize repair cost** into asset value:
    - Increases `additional_asset_cost` and `total_asset_cost` on Asset
    - Can increase asset life (`increase_in_asset_life` on finance book)
    - Reschedules depreciation
    - Creates GL entries to capitalize cost
  - Status: Draft → Submitted → Completed/Cancelled
  - Creates Asset Activity log

**Aria Current State:**
- **No Asset Repair model**
- **No Asset Repair Consumed Item model**
- **No Asset Repair Purchase Invoice model**
- Maintenance module exists (preventive) but no repair module (corrective)

**Impact:** No way to track asset failures, repairs, or capitalize repair costs into asset value.

---

### GAP 6: Asset Capitalization (Composite Assets) (HIGH)

**ERPNext Behavior:**
- `asset_capitalization.py` (Document, submittable, 876 lines):
  - Creates composite assets from:
    - **Stock items** (consumed from warehouse — creates Stock Ledger Entries)
    - **Other assets** (consumed existing assets — sets status to "Capitalized")
    - **Service items** (external services)
  - Target asset's `net_purchase_amount` increases by total value
  - Creates GL entries:
    ```
    Debit:  Target Fixed Asset Account or CWIP Account
    Credit: Inventory/Expense accounts (for consumed items)
    ```
  - On cancel: restores consumed assets, reverses all entries
  - Status: Draft → Submitted → Cancelled

**Aria Current State:**
- **No Asset Capitalization model**
- **No Asset Capitalization Asset Item model**
- **No Asset Capitalization Stock Item model**
- **No Asset Capitalization Service Item model**
- No concept of "composite asset" or "asset type"

**Impact:** Cannot create composite assets from existing stock or assets.

---

### GAP 7: Fixed Asset Register Report (HIGH)

**ERPNext Behavior:**
- `fixed_asset_register.py` (Script Report):
  - Columns: Asset ID, Asset Name, Asset Category, Status, Purchase Date, Available For Use Date, Net Purchase Amount, Asset Value (computed), Opening Accumulated Depreciation, Depreciated Amount, Cost Center, Department, Vendor Name, Location, Company
  - Supports **grouping by Asset Category or Location**
  - Includes **stacked bar chart** (Asset Value vs Depreciated Amount over monthly periods)
  - Filters: company, status (In Location / Disposed), asset category, cost center, existing assets only, finance book, date range / fiscal year
  - Asset Value calculation: `net_purchase_amount - opening_accumulated_depreciation - depreciation_amount + revaluation_amount`

**Aria Current State:**
- Activity Report exists (Asset Activity)
- Depreciation Ledger Report exists
- Depreciations & Balances Report exists
- **No Fixed Asset Register Report**

**Impact:** No comprehensive register view of all assets with current values. No grouping by category/location. No chart visualization.

---

### GAP 8: No Backend Tests for Core Asset CRUD (HIGH)

**ERPNext Tests:**
- `test_asset.py` — Comprehensive tests for asset creation, submit, cancel, depreciation, scrap, restore, split, capitalization

**Aria Tests:**
- `asset-value-adjustment.service.spec.ts` — covers value adjustment only
- `location.service.spec.ts` — covers Location CRUD
- `asset-category.service.spec.ts` — covers AssetCategory CRUD
- `asset-maintenance.service.spec.ts` — covers maintenance CRUD
- `maintenance-team.service.spec.ts` — covers maintenance team CRUD
- `asset-activity.service.spec.ts` — covers activity report
- `asset-depreciation-ledger-report.spec.ts` — covers ledger report
- `asset-depreciations-and-balances-report.spec.ts` — covers balances report
- **MISSING: `asset.service.spec.ts`** — No tests for `findAllAssets`, `findAssetById`, `createAsset`, `updateAsset`, `deleteAsset`, `deleteManyAssets`, series generation, depreciation field inheritance from category, status guards

**Impact:** The most critical entity in the module has zero dedicated service-level unit test coverage.

---

### GAP 9: Finance Books (MEDIUM)

**ERPNext Behavior:**
- `asset_finance_book.py` (Child table on Asset and Asset Category):
  - Each asset can have **multiple finance books** with different depreciation parameters
  - Fields: `finance_book`, `depreciation_method`, `total_number_of_depreciations`, `frequency_of_depreciation`, `depreciation_start_date`, `rate_of_depreciation`, `value_after_depreciation`, `expected_value_after_useful_life`, `daily_prorata_based`, `shift_based`, `increase_in_asset_life`
  - Each finance book gets its own `Asset Depreciation Schedule`
  - `get_default_finance_book_idx()` returns company default or first book

**Aria Current State:**
- Asset has a single set of depreciation fields: `depreciationMethod`, `totalNumberOfDepreciations`, `frequencyOfDepreciation`, `depreciationStartDate`, `expectedValueAfterUsefulLife`
- Asset Category has similar single-set defaults
- **No Finance Book concept**
- **No multiple depreciation schedules per asset**

**Impact:** Cannot track depreciation under multiple accounting standards or for different stakeholders (e.g., tax vs GAAP).

---

### GAP 10: CWIP Accounting (Capital Work in Progress) (MEDIUM)

**ERPNext Behavior:**
- `AssetCategory` has `enable_cwip_accounting` flag
- `Asset Category Account` child table has `capital_work_in_progress_account` field
- On Asset submit: if CWIP enabled, creates GL entries:
  ```
  Debit: Fixed Asset Account
  Credit: Capital Work in Progress Account
  ```
- Daily scheduler job (`make_post_gl_entry`): For CWIP-enabled categories, auto-posts GL entries when `available_for_use_date` is reached (transitions CWIP to Fixed Asset)

**Aria Current State:**
- `AssetCategory` model has `enableCwipAccounting Boolean @default(false)` (schema.prisma line 1563)
- The frontend category form exposes this toggle
- **No business logic uses this flag**
- `createAsset` and `submitAssetValueAdjustment` do not check or act on CWIP accounting
- No CWIP account is derived or stored
- No journal entries are posted to a CWIP account

**Impact:** CWIP toggle is a dead UI control. No actual CWIP accounting workflow.

---

### GAP 11: Asset Detail Page Missing Tabs (MEDIUM)

**ERPNext Behavior:**
- Asset detail page (form view) has:
  - Depreciation Schedule datatable (shows all schedule rows with dates, amounts, JE references)
  - Asset Movement history (linked sidebar via `asset_dashboard.py`)
  - Value Adjustment history
  - Maintenance schedule/tasks
  - Accounting Ledger link
  - Action buttons: Create Value Adjustment, Create Repair, Create Depreciation Entry, Maintain, Capitalize, Split, Transfer, Scrap, Sell, Restore

**Aria Current State:**
- Asset detail page (`[assetId]/page.tsx`, 373 lines) shows:
  - Basic Information card
  - Purchase & Valuation card
  - Ownership & Insurance card
  - Activity Log card
- **No Depreciation Schedule tab**
- **No Value Adjustment history tab**
- **No Maintenance schedule/tasks tab**
- **No Asset Movement history**
- **No action buttons for lifecycle operations**

**Impact:** Users cannot see the depreciation schedule or related documents from the asset detail view.

---

### GAP 12: Asset Split (MEDIUM)

**ERPNext Behavior:**
- `asset.py:split_asset()`:
  - Splits one asset into two based on quantity
  - Proportionally allocates all financial values (purchase amount, accumulated depreciation, value after depreciation)
  - Creates new depreciation schedules for both parts
  - References original journal entries

**Aria Current State:**
- **No asset split functionality**

**Impact:** Cannot split assets (e.g., splitting a bulk purchase into individual trackable assets).

---

### GAP 13: Shift-Based Depreciation (MEDIUM)

**ERPNext Behavior:**
- `asset_shift_factor.py` — Defines shift multipliers (e.g., Single=1, Double=1.5, Triple=2)
- `asset_shift_allocation.py` — Allocates an asset to specific shifts over a date range
- `asset_finance_book.py` — `shift_based` flag on finance book
- Depreciation methods support shift-based calculation:
  - `get_shift_depr_amount()` in `depreciation_methods.py`
  - Schedule rows include `shift` field

**Aria Current State:**
- `AssetCategory` model has `shiftBased Boolean @default(false)` (schema.prisma line 1560)
- The frontend category form exposes this toggle
- **No Shift Factor model**
- **No Shift Allocation model**
- Depreciation calculation in `asset-value-adjustment.utils.ts` does not support shift-based depreciation

**Impact:** Shift-based depreciation toggle is a dead UI control. No actual shift-based calculation.

---

### GAP 14: Barcode / QR Code Support (MEDIUM)

**ERPNext Behavior:**
- No native barcode support for assets in ERPNext either
- However, the Item doctype (which assets link to via `item_code`) has barcode support
- Common need in asset management for physical tracking

**Aria Current State:**
- Asset model has no `barcode` field
- `InventoryItem` model has `ItemBarcode` with `barcode`, `barcodeType`, `uom` fields
- No linkage between ItemBarcode and Asset

**Impact:** No physical identification mechanism for assets beyond the auto-generated series number.

---

### GAP 15: Bulk Delete for Locations and Categories (MEDIUM)

**ERPNext Behavior:**
- All doctypes support standard bulk operations via Frappe framework

**Aria Current State:**
- `deleteManyAssets` exists (tRPC endpoint + frontend bulk action)
- `deleteManyMaintenanceTeams` exists
- **No `deleteManyLocations`**
- **No `deleteManyAssetCategories`**
- Frontend Location page and Asset Category page only expose single-item delete via dropdown menu

**Impact:** Inconsistent UX — some entities support bulk delete, others don't.

---

### GAP 16: No Frontend Tests for Asset List and Detail (MEDIUM)

**Aria Current State:**
- `asset/form/page.test.tsx` exists (414 lines)
- **No `asset/page.test.tsx`** (asset list page)
- **No `asset/[assetId]/page.test.tsx`** (asset detail page)
- Dashboard `overview/dashboard.utils.test.ts` exists but is only 26 lines (very minimal)

**Impact:** No automated testing for the two most-viewed asset pages.

---

### GAP 17: Module Onboarding Wizard (MEDIUM)

**ERPNext Behavior:**
- `module_onboarding/asset_onboarding/asset_onboarding.json` defines 6 guided steps:
  1. Learn Asset — Introduction
  2. Create Asset Category
  3. Create Asset Item
  4. Create Asset Location
  5. Create Existing Asset
  6. View Balance Sheet

**Aria Current State:**
- No onboarding wizard
- No guided setup steps
- Users must discover the setup flow independently

**Impact:** Higher learning curve for new users. No structured path from zero to functional asset tracking.

---

### GAP 18: Duplicate Value-Adjustment Redirect Route (LOW)

**Aria Current State:**
- `/asset/value-adjustment/page.tsx` — 5-line redirect to `/asset/asset-maintenance/value-adjustment`
- `/asset/asset-maintenance/value-adjustment/page.tsx` — full implementation (766 lines)
- The redirect is a legacy compatibility shim with no functional purpose

**Impact:** Minor code cleanliness issue.

---

### GAP 19: No Asset Import Capability (LOW)

**Aria Current State:**
- Asset list page has `enableImport={false}` (line 620 of `asset/page.tsx`)
- No CSV/Excel import for bulk asset creation

**Impact:** Cannot import existing asset registers from spreadsheets.

---

### GAP 20: No Duplicate Name/ItemCode Validation (LOW)

**Aria Current State:**
- `createAsset` does not check for duplicate `assetName` or `itemCode`
- `series` is unique (auto-generated), but assets with the same name or item code can be created freely

**Note:** This may be intentional (multiple assets of the same type), but should be documented as a design decision.

---

### GAP 21: No Asset Repair Integration with Maintenance (LOW)

**ERPNext Behavior:**
- `asset.py:update_maintenance_status()` (daily scheduler):
  - Sets asset status to "Out of Order" if there are pending Asset Repairs
  - Sets status to "In Maintenance" if there is a maintenance task due today
  - Otherwise resets to default status
- Asset Maintenance and Asset Repair are separate but interrelated modules

**Aria Current State:**
- Maintenance module exists (preventive)
- Repair module does not exist (corrective)
- `IN_MAINTENANCE` and `OUT_OF_ORDER` statuses exist in the enum but are only set manually

**Impact:** Asset status is not automatically updated based on maintenance/repair conditions.

---

### GAP 22: Asset Category Account Mapping (MEDIUM)

**ERPNext Behavior:**
- `asset_category_account.py` (Child table on Asset Category):
  - Maps per company:
    - Fixed Asset Account (`account_type: "Fixed Asset"`)
    - Accumulated Depreciation Account (`account_type: "Accumulated Depreciation"`)
    - Depreciation Expense Account (`account_type: "Depreciation"`)
    - Capital Work in Progress Account (`account_type: "Capital Work in Progress"`)
  - Used for all GL entries related to assets
- Company-level defaults as fallback:
  - `Company.accumulated_depreciation_account`
  - `Company.depreciation_expense_account`
  - `Company.capital_work_in_progress_account`
  - `Company.disposal_account`

**Aria Current State:**
- **No Asset Category Account mapping**
- **No chart of accounts integration**
- **No disposal account on Company**
- GL entries for value adjustments use a `differenceAccount` string (free text) and derive `fixedAssetAccount` as `"{CategoryName} Fixed Asset"`

**Impact:** No proper accounting integration. GL account derivation is hardcoded and fragile.

---

### GAP 23: No Realtime Subscription for Asset Maintenance Logs (LOW)

**Aria Current State:**
- `onAssetsChanged` — asset CRUD
- `onLocationsChanged` — location CRUD
- `onAssetCategoriesChanged` — category CRUD
- `onAssetValueAdjustmentsChanged` — adjustment lifecycle
- `onMaintenanceTeamsChanged` — team CRUD
- `onAssetMaintenancesChanged` — maintenance CRUD + `log_completed`
- **No `onAssetMaintenanceLogsChanged`**
- Log page subscribes to `onAssetMaintenancesChanged` (functional but not clean separation)

**Impact:** Log list updates are bundled under maintenance events. Minor architecture concern.

---

### GAP 24: Document Series Counter Auto-Seeding (LOW)

**ERPNext Behavior:**
- Uses Frappe's built-in naming series system
- Series are defined in Naming Series doctype
- Multiple series per document type

**Aria Current State:**
- `DocumentSeriesCounter` model with `INSERT ... ON CONFLICT DO UPDATE` upsert pattern
- `generateAssetSeries()` scans existing assets to seed counter on first use
- Self-bootstrapping — no manual pre-seeding required
- This is actually **well implemented** and may be superior to ERPNext's approach

**Note:** Not a gap — this is an area where Aria's implementation is clean and functional.

---

### GAP 25: Asset Type Concept (LOW)

**ERPNext Behavior:**
- `Asset.asset_type` field: `""` | `"Existing Asset"` | `"Composite Asset"` | `"Composite Component"`
- Existing Asset: normal asset created from purchase
- Composite Asset: created via Asset Capitalization
- Composite Component: consumed in Asset Capitalization
- Work In Progress status for Composite Assets before submit

**Aria Current State:**
- No `assetType` field on Asset model
- No concept of composite assets or components
- All assets are treated as standard existing assets

**Impact:** Cannot distinguish between different asset creation origins.

---

### GAP 26: Calendar View for Maintenance Logs (LOW)

**ERPNext Behavior:**
- `asset_maintenance_log_calendar.js` — Calendar view showing maintenance tasks by due date
- Visual representation of maintenance schedule

**Aria Current State:**
- Maintenance log list page (`log/page.tsx`) shows table view only
- No calendar view

**Impact:** No visual maintenance schedule overview.

---

### GAP 27: Asset Item Link to Inventory (MEDIUM)

**ERPNext Behavior:**
- `Asset.item_code` is a Link to Item doctype
- Item must have `is_fixed_asset=1` and `is_stock_item=0`
- Asset Category is fetched from Item
- Creates a strong link between inventory items and fixed assets

**Aria Current State:**
- `Asset.itemCode` is a free-text string (`VarChar(100)`)
- No foreign key to `InventoryItem`
- `InventoryItem.isFixedAsset` boolean exists (schema.prisma line 67) but is not enforced
- No validation that item code exists or is a fixed asset

**Impact:** Weak link between inventory and assets. No referential integrity.

---

### GAP 28: Company Master Data Management (MEDIUM)

**ERPNext Behavior:**
- Company is a full doctype with UI for create/edit/list
- Fields: name, abbreviation, country, currency, default accounts, fiscal year settings
- Used as a Link field on all transaction documents

**Aria Current State:**
- `Company` model exists in Prisma schema (line 1916)
- `CompanyService` is read-only (`getCompany`, `getCompanyByName`)
- **No Company creation form in UI**
- **No Company CRUD API** (no tRPC router for Company mutations)
- Asset `company` field is a free-text string, not a FK to Company
- Company is only created via demo seed script (`seed-fiscal-year.ts`)

**Impact:** Company records are backend-only. No UI for managing companies. No referential integrity on asset company field.

---

### GAP 29: Fiscal Year Management (MEDIUM)

**ERPNext Behavior:**
- Fiscal Year is a full doctype with UI for create/edit/list
- Supports short years, disabled years
- Linked to companies via Fiscal Year Company join table
- Used for period-based reporting and depreciation calculations

**Aria Current State:**
- `FiscalYear` model exists in Prisma schema (line 1928)
- `FiscalYearCompany` join table exists (line 1943)
- **No Fiscal Year creation form in UI**
- **No Fiscal Year CRUD API**
- Fiscal years are only created via demo seed script
- `FiscalYearService` (`shared/fiscal-year/fiscal-year.service.ts`) is read-only

**Impact:** Fiscal years are backend-only. No UI for managing fiscal years.

---

### GAP 30: No Disposal/Write-off Account Configuration (MEDIUM)

**ERPNext Behavior:**
- `Company.disposal_account` — Gain/Loss on Asset Disposal
- `Company.depreciation_cost_center` — Default cost center for depreciation entries
- `Company.series_for_depreciation_entry` — Series for auto-generated depreciation journal entries

**Aria Current State:**
- No disposal account field on Company
- No depreciation cost center field on Company
- No series configuration for depreciation entries
- Disposal JE series is hardcoded as `JE-AVA-YYYY-NNNNN`

**Impact:** No configurable disposal account. Disposal entries always use the same hardcoded series.

---

## 5. Missing Doctypes / Prisma Models

| # | Missing Model | ERPNext Equivalent | Severity |
|---|---|---|---|
| 1 | **AssetMovement** | `asset_movement` | HIGH |
| 2 | **AssetMovementItem** | `asset_movement_item` | HIGH |
| 3 | **AssetRepair** | `asset_repair` | HIGH |
| 4 | **AssetRepairConsumedItem** | `asset_repair_consumed_item` | HIGH |
| 5 | **AssetRepairPurchaseInvoice** | `asset_repair_purchase_invoice` | HIGH |
| 6 | **AssetCapitalization** | `asset_capitalization` | HIGH |
| 7 | **AssetCapitalizationAssetItem** | `asset_capitalization_asset_item` | HIGH |
| 8 | **AssetCapitalizationStockItem** | `asset_capitalization_stock_item` | HIGH |
| 9 | **AssetCapitalizationServiceItem** | `asset_capitalization_service_item` | HIGH |
| 10 | **AssetFinanceBook** | `asset_finance_book` | MEDIUM |
| 11 | **AssetCategoryAccount** | `asset_category_account` | MEDIUM |
| 12 | **AssetShiftFactor** | `asset_shift_factor` | MEDIUM |
| 13 | **AssetShiftAllocation** | `asset_shift_allocation` | MEDIUM |

---

## 6. Missing Reports

| # | Missing Report | ERPNext Equivalent | Severity |
|---|---|---|---|
| 1 | **Fixed Asset Register** | `report/fixed_asset_register/` | HIGH |

Aria has 3 of 5 ERPNext reports:
- ✅ Asset Activity Report
- ✅ Asset Depreciation Ledger
- ✅ Asset Depreciations and Balances
- ❌ Fixed Asset Register (missing)
- ❌ Asset Maintenance Report (ERPNext has Report Builder; Aria has list page but no formal report)

---

## 7. Missing Workflows and Business Logic

| # | Missing Workflow | ERPNext File | Severity |
|---|---|---|---|
| 1 | **Asset Submit** | `asset.py:on_submit()` | HIGH |
| 2 | **Asset Cancel** | `asset.py:on_cancel()` | HIGH |
| 3 | **Asset Scrap** | `depreciation.py:scrap_asset()` | HIGH |
| 4 | **Asset Restore (from Scrap)** | `depreciation.py:restore_asset()` | HIGH |
| 5 | **Asset Sell (via Sales Invoice)** | `asset.py:get_gl_entries_on_asset_disposal()` | HIGH |
| 6 | **Asset Transfer** | `asset_movement.py` | HIGH |
| 7 | **Asset Issue (to employee)** | `asset_movement.py` | HIGH |
| 8 | **Asset Receipt** | `asset_movement.py` | HIGH |
| 9 | **Scheduled Depreciation Posting** | `depreciation.py:post_depreciation_entries()` | HIGH |
| 10 | **Asset Repair** | `asset_repair.py` | HIGH |
| 11 | **Asset Capitalization** | `asset_capitalization.py` | HIGH |
| 12 | **CWIP GL Posting** | `asset.py:make_post_gl_entry()` | MEDIUM |
| 13 | **Asset Split** | `asset.py:split_asset()` | MEDIUM |
| 14 | **Shift-Based Depreciation** | `depreciation_methods.py:get_shift_depr_amount()` | MEDIUM |
| 15 | **Auto-Update Maintenance Status** | `asset.py:update_maintenance_status()` | MEDIUM |
| 16 | **Calendar View for Maintenance** | `asset_maintenance_log_calendar.js` | LOW |
| 17 | **Module Onboarding** | `module_onboarding/asset_onboarding/` | MEDIUM |

---

## 8. Missing Scheduled Jobs

| # | Missing Job | ERPNext Schedule | Severity |
|---|---|---|---|
| 1 | **Auto-Post Depreciation Entries** | Daily | HIGH |
| 2 | **Update Asset Maintenance Status** | Daily | MEDIUM |
| 3 | **CWIP GL Entry Posting** | Daily | MEDIUM |
| 4 | **Update Maintenance Log Status** | Daily | LOW |

**Note:** Aria currently has no background job infrastructure at all. The Inventory module also has no scheduled jobs. Adding a scheduler would be a cross-cutting infrastructure change.

---

## 9. Missing Frontend Pages

| # | Missing Page | ERPNext Equivalent | Severity |
|---|---|---|---|
| 1 | **Asset Movement List** | `asset_movement` list view | HIGH |
| 2 | **Asset Movement Form** | `asset_movement` form view | HIGH |
| 3 | **Asset Repair List** | `asset_repair` list view | HIGH |
| 4 | **Asset Repair Form** | `asset_repair` form view | HIGH |
| 5 | **Asset Capitalization List** | `asset_capitalization` list view | HIGH |
| 6 | **Asset Capitalization Form** | `asset_capitalization` form view | HIGH |
| 7 | **Fixed Asset Register Report** | `report/fixed_asset_register/` | HIGH |
| 8 | **Asset Onboarding Wizard** | `module_onboarding/asset_onboarding/` | MEDIUM |
| 9 | **Maintenance Calendar View** | `asset_maintenance_log_calendar.js` | LOW |
| 10 | **Company Management** | `Company` doctype list/form | MEDIUM |
| 11 | **Fiscal Year Management** | `Fiscal Year` doctype list/form | MEDIUM |

---

## 10. Missing Tests

### Backend Tests

| # | Missing Test File | What It Should Cover | Severity |
|---|---|---|---|
| 1 | `asset.service.spec.ts` | `findAllAssets`, `findAssetById`, `createAsset`, `updateAsset`, `deleteAsset`, `deleteManyAssets`, series generation, depreciation field inheritance, status guards | HIGH |
| 2 | `asset-dashboard.service.spec.ts` | All dashboard KPI queries, chart data queries | MEDIUM |
| 3 | `asset-router.spec.ts` | Integration tests for all tRPC procedures | MEDIUM |

### Frontend Tests

| # | Missing Test File | What It Should Cover | Severity |
|---|---|---|---|
| 1 | `asset/page.test.tsx` | Asset list page rendering, filtering, sorting, delete, submit/cancel actions | MEDIUM |
| 2 | `asset/[assetId]/page.test.tsx` | Asset detail page rendering, tab switching, action buttons, related data | MEDIUM |
| 3 | `dashboard/overview/page.test.tsx` | Dashboard rendering, chart loading, KPI cards, alert panels | LOW |

---

## 11. Missing Setup / Configuration

| # | Missing Feature | Description | Severity |
|---|---|---|---|
| 1 | **Company Creation UI** | No form/page to create companies. Only seed script. | MEDIUM |
| 2 | **Fiscal Year Creation UI** | No form/page to create fiscal years. Only seed script. | MEDIUM |
| 3 | **Asset Category Account Mapping** | No GL account mapping per category per company. | MEDIUM |
| 4 | **Chart of Accounts Integration** | No account doctype. No account_type fields. | MEDIUM |
| 5 | **Disposal Account on Company** | No configurable disposal account. | LOW |
| 6 | **Depreciation Cost Center on Company** | No default cost center for depreciation. | LOW |
| 7 | **Series Configuration** | No configurable naming series per document type. | LOW |
| 8 | **Module Onboarding** | No guided setup wizard. | MEDIUM |
| 9 | **Asset Import** | No CSV/Excel import for bulk asset creation. | LOW |
| 10 | **Barcode Support** | No barcode/QR code field on Asset. | MEDIUM |

---

## 12. Phase-by-Phase Implementation Plan

### Phase A: Asset Lifecycle Workflows (Highest Priority)

This is the most critical gap. Assets have statuses but no proper workflow.

**Backend:**
1. Add `submitAsset` tRPC endpoint:
   - Validate asset is DRAFT
   - Validate required fields (`availableForUseDate`, `location`, `assetCategory`)
   - Set status to SUBMITTED
   - Create initial AssetActivity log "Asset submitted"
   - Activate depreciation schedules (if any)
2. Add `cancelAsset` tRPC endpoint:
   - Validate asset is SUBMITTED (not SOLD/SCRAPPED)
   - Check no depreciation entries are posted
   - Set status to CANCELLED
   - Create AssetActivity log "Asset cancelled"
3. Add `scrapAsset` tRPC endpoint:
   - Validate asset is SUBMITTED/PARTIALLY_DEPRECIATED
   - Validate scrap date
   - Set `disposalDate` and status to SCRAPPED
   - Create AssetActivity log "Asset scrapped"
   - (No GL entries until accounting module exists)
4. Add `sellAsset` tRPC endpoint:
   - Similar to scrap but status = SOLD
   - Create AssetActivity log "Asset sold"
5. Add `restoreAsset` tRPC endpoint:
   - Validate asset is SOLD/SCRAPPED
   - Clear `disposalDate`
   - Recalculate status based on depreciation
   - Create AssetActivity log "Asset restored"

**Frontend:**
1. Update asset list page:
   - Add Submit/Cancel/Scrap/Sell to dropdown actions (conditional on status)
   - Add AlertModal confirmations for each action
2. Update asset form page:
   - Add Submit/Cancel/Scrap/Sell/Restore buttons in header (conditional on status)
   - Set readonly mode for SUBMITTED/CANCELLED assets
3. Update asset detail page:
   - Add action buttons for lifecycle operations

### Phase B: Asset Movement Tracking

**Backend:**
1. Add `AssetMovement` Prisma model:
   - `id`, `series`, `purpose` (RECEIPT, TRANSFER, ISSUE, TRANSFER_AND_ISSUE)
   - `transactionDate`, `company`
   - One-to-many `AssetMovementItem[]`
2. Add `AssetMovementItem` Prisma model:
   - `assetId`, `sourceLocationId`, `targetLocationId`, `fromEmployee`, `toEmployee`
3. Add CRUD endpoints in tRPC router
4. On submit: update asset `location` and `custodian`, create AssetActivity log

**Frontend:**
1. Create `/asset/asset-movement/` list page
2. Create `/asset/asset-movement/form/` form page
3. Add "Transfer" button on asset detail page

### Phase C: Fixed Asset Register Report

**Backend:**
1. Create `asset-register-report.ts` report builder
2. Add `listAssetRegisterReport` tRPC query
3. Add `exportAssetRegisterExcel` tRPC mutation
4. Grouping by Asset Category or Location
5. Compute asset value: `netPurchaseAmount - openingAccumulatedDepreciation - depreciationAmount + revaluationAmount`

**Frontend:**
1. Create `/asset/reports/asset-register/` page
2. Filters: company, status, category, location, date range
3. Add to sidebar navigation

### Phase D: Asset Repair Tracking

**Backend:**
1. Add `AssetRepair` Prisma model:
   - `assetId`, `failureDate`, `completionDate`, `downtime`, `repairCost`
   - `capitalizeRepairCost` boolean, `increaseInAssetLife`
   - One-to-many `AssetRepairConsumedItem[]`
2. Add `AssetRepairConsumedItem` model:
   - `itemCode`, `warehouse`, `consumedQuantity`, `valuationRate`
3. Add CRUD endpoints
4. On submit (if capitalize): update asset value, reschedule depreciation

**Frontend:**
1. Create `/asset/asset-repair/` list page
2. Create `/asset/asset-repair/form/` form page
3. Add "Repair" button on asset detail page

### Phase E: Asset Capitalization

**Backend:**
1. Add `AssetCapitalization` Prisma model:
   - `targetAssetId`, `status` (DRAFT, SUBMITTED, CANCELLED)
   - Child tables for consumed assets, stock items, service items
2. Add child models:
   - `AssetCapitalizationAssetItem`
   - `AssetCapitalizationStockItem`
   - `AssetCapitalizationServiceItem`
3. On submit: update target asset value, set consumed assets to "Capitalized" status

**Frontend:**
1. Create `/asset/asset-capitalization/` list page
2. Create `/asset/asset-capitalization/form/` form page

### Phase F: Depreciation Schedule Tab on Detail Page

**Frontend:**
1. Add tabs to asset detail page: "Details" | "Depreciation Schedule" | "Value Adjustments" | "Activity"
2. Depreciation Schedule tab: table of `AssetDepreciationScheduleEntry` rows
3. Value Adjustments tab: list of `AssetValueAdjustment` records for this asset

### Phase G: Backend Tests for Asset CRUD

**Backend:**
1. Create `__tests__/asset.service.spec.ts`:
   - Test `createAsset` with and without category
   - Test series generation
   - Test depreciation field inheritance from category
   - Test `updateAsset` with category change
   - Test `deleteAsset` status guards
   - Test `deleteManyAssets`
   - Test `findAllAssets` with filters

### Phase H: Frontend Tests for Asset List/Detail

**Frontend:**
1. Create `asset/page.test.tsx`:
   - Table rendering, filtering, sorting
   - Submit/Cancel/Scrap/Sell dropdown actions
   - Bulk delete
2. Create `asset/[assetId]/page.test.tsx`:
   - Detail page rendering
   - Tab switching
   - Action buttons

### Phase I: Scheduled Depreciation Posting (Infrastructure Change)

**Backend:**
1. Add `postDepreciationEntries` endpoint (manual trigger)
2. Add `journalEntryId` field to `AssetDepreciationScheduleEntry`
3. Add posting status to schedule entries
4. Consider adding a cron/scheduler framework (e.g., `@nestjs/schedule`)

### Phase J: Module Onboarding

**Frontend:**
1. Create onboarding page: `/asset/onboarding/`
2. Steps: Create Company → Create Location → Create Asset Category → Create Asset → View Dashboard
3. Add "Get Started" button to dashboard when no assets exist

### Phase K: Shift-Based Depreciation

**Backend:**
1. Add `AssetShiftFactor` model (name, factor)
2. Add `AssetShiftAllocation` model (asset, shiftFactor, fromDate, toDate)
3. Update depreciation calculation to support shift-based amounts

### Phase L: Company & Fiscal Year Management UI

**Backend:**
1. Add Company CRUD tRPC endpoints
2. Add FiscalYear CRUD tRPC endpoints
3. Add FiscalYearCompany link endpoints

**Frontend:**
1. Create admin pages for Company and Fiscal Year management
2. Or add to existing admin section

---

## 13. Open Questions for Product Owner

1. **Scope priority**: Phases A-L above are ordered by impact. Should all be implemented, or focus on specific phases? Phase A alone is substantial.

2. **Asset Movement types**: ERPNext supports 4 types (Receipt, Transfer, Issue, Transfer+Issue). Should all be implemented, or start with Transfer only?

3. **GL/Accounting integration**: ERPNext creates journal entries on many workflows (submit, scrap, depreciation, repair). Aria has no chart-of-accounts module. Should disposal/depreciation workflows:
   - Skip GL entries entirely (status + activity log only)?
   - Create simplified `JournalEntry` records without account validation?
   - Wait for an accounting module?

4. **Scheduled jobs**: Aria has no background job infrastructure. Should we:
   - Skip auto-posting for now (manual value adjustments only)?
   - Add `@nestjs/schedule` for cron jobs?
   - Add a manual "Post Depreciation" button on the dashboard?

5. **Asset Capitalization**: This requires consuming stock items (creating stock entries). Is stock integration needed, or can it be simplified?

6. **Asset Repair**: Should repairs consume stock items (requiring inventory integration), or track costs only?

7. **Finance Books**: Supporting multiple depreciation books per asset is a significant schema change. Is single-book sufficient for now?

8. **Company/Fiscal Year UI**: Should Company and Fiscal Year management pages be added to the asset module, or to a separate admin/settings module?

9. **Barcode support**: Should Asset get a barcode field linked to ItemBarcode, or a standalone barcode field?

10. **Fixed Asset Register Report**: Should this be grouped by Category, Location, or both? Should it include a chart?

---

## Appendix A: Complete File Path Reference

### ERPNext Asset Module Files

```
.erpnext/erpnext/assets/
├── __init__.py
├── dashboard_fixtures.py
├── assets_dashboard/asset/asset.json
├── dashboard_chart/asset_value_analytics/asset_value_analytics.json
├── dashboard_chart/category_wise_asset_value/category_wise_asset_value.json
├── dashboard_chart/location_wise_asset_value/location_wise_asset_value.json
├── doctype/
│   ├── asset/asset.json, asset.py, asset.js, asset_list.js, asset_dashboard.py, depreciation.py, test_asset.py
│   ├── asset_activity/asset_activity.json, asset_activity.py, test_asset_activity.py
│   ├── asset_capitalization/asset_capitalization.json, asset_capitalization.py, asset_capitalization.js, test_asset_capitalization.py
│   ├── asset_capitalization_asset_item/asset_capitalization_asset_item.json
│   ├── asset_capitalization_service_item/asset_capitalization_service_item.json
│   ├── asset_capitalization_stock_item/asset_capitalization_stock_item.json
│   ├── asset_category/asset_category.json, asset_category.py, asset_category.js, test_asset_category.py
│   ├── asset_category_account/asset_category_account.json
│   ├── asset_depreciation_schedule/asset_depreciation_schedule.json, asset_depreciation_schedule.py, deppreciation_schedule_controller.py, depreciation_methods.py, asset_depreciation_schedule.js, test_asset_depreciation_schedule.py
│   ├── asset_finance_book/asset_finance_book.json, asset_finance_book.py
│   ├── asset_maintenance/asset_maintenance.json, asset_maintenance.py, asset_maintenance.js, test_asset_maintenance.py
│   ├── asset_maintenance_log/asset_maintenance_log.json, asset_maintenance_log.py, asset_maintenance_log.js, asset_maintenance_log_calendar.js, asset_maintenance_log_list.js, test_asset_maintenance_log.py
│   ├── asset_maintenance_task/asset_maintenance_task.json
│   ├── asset_maintenance_team/asset_maintenance_team.json, asset_maintenance_team.py, test_asset_maintenance_team.py
│   ├── asset_movement/asset_movement.json, asset_movement.py, asset_movement.js, test_asset_movement.py
│   ├── asset_repair/asset_repair.json, asset_repair.py, asset_repair.js, asset_repair_list.js, test_asset_repair.py
│   ├── asset_repair_consumed_item/asset_repair_consumed_item.json
│   ├── asset_repair_purchase_invoice/asset_repair_purchase_invoice.json
│   ├── asset_shift_allocation/asset_shift_allocation.json, asset_shift_allocation.py, test_asset_shift_allocation.py
│   ├── asset_shift_factor/asset_shift_factor.json, asset_shift_factor.py, test_asset_shift_factor.py
│   ├── asset_value_adjustment/asset_value_adjustment.json, asset_value_adjustment.py, asset_value_adjustment.js, test_asset_value_adjustment.py
│   ├── depreciation_schedule/depreciation_schedule.json, depreciation_schedule.py
│   ├── linked_location/linked_location.json
│   ├── location/location.json, location.py, location.js, location_tree.js, test_location.py
│   └── maintenance_team_member/maintenance_team_member.json, maintenance_team_member.js
├── module_onboarding/asset_onboarding/asset_onboarding.json
├── number_card/asset_value/asset_value.json
├── number_card/new_assets_(this_year)/new_assets_(this_year).json
├── number_card/total_assets/total_assets.json
├── onboarding_step/create_asset_category/create_asset_category.json
├── onboarding_step/create_asset_item/create_asset_item.json
├── onboarding_step/create_asset_location/create_asset_location.json
├── onboarding_step/create_existing_asset/create_existing_asset.json
├── onboarding_step/learn_asset/learn_asset.json
├── onboarding_step/view_balance_sheet/view_balance_sheet.json
├── report/asset_activity/asset_activity.json
├── report/asset_maintenance/asset_maintenance.json
└── report/fixed_asset_register/fixed_asset_register.json, fixed_asset_register.py, fixed_asset_register.js
```

### Aria Asset Module Files

```
apps/backend/src/apps/asset/
├── __tests__/
│   ├── asset-activity-report.spec.ts
│   ├── asset-activity.service.spec.ts
│   ├── asset-category.service.spec.ts
│   ├── asset-depreciation-ledger-report.spec.ts
│   ├── asset-depreciations-and-balances-report.spec.ts
│   ├── asset-maintenance.service.spec.ts
│   ├── asset-value-adjustment.service.spec.ts
│   ├── asset-value-adjustment.utils.test.ts
│   ├── location.service.spec.ts
│   └── maintenance-team.service.spec.ts
├── asset-activity-report.ts
├── asset-dashboard.service.ts
├── asset-depreciation-ledger-report.ts
├── asset-depreciations-and-balances-report.ts
├── asset-value-adjustment.utils.ts
├── asset.module.ts
├── asset.service.ts
├── asset.types.ts
└── trpc/asset.router.ts

apps/frontend/src/app/asset/
├── page.tsx
├── error.tsx
├── access-denied/page.tsx
├── (protected)/
│   ├── layout.tsx
│   ├── dashboard/
│   │   └── overview/
│   │       ├── page.tsx
│   │       ├── overview-client.tsx
│   │       ├── charts-top.tsx
│   │       ├── charts-bottom.tsx
│   │       ├── charts-shared.tsx
│   │       ├── charts-island.tsx
│   │       ├── charts-island.lazy.tsx
│   │       ├── dashboard.utils.ts
│   │       ├── dashboard.utils.test.ts
│   │       └── page.test.tsx
│   ├── asset-sub-module/
│   │   ├── asset/
│   │   │   ├── page.tsx
│   │   │   ├── form/page.tsx
│   │   │   ├── form/page.test.tsx
│   │   │   └── [assetId]/page.tsx
│   │   ├── asset-category/
│   │   │   ├── page.tsx
│   │   │   ├── page.test.tsx
│   │   │   ├── asset-category.schema.ts
│   │   │   ├── asset-category.utils.ts
│   │   │   ├── asset-category.utils.test.ts
│   │   │   ├── form/page.tsx
│   │   │   ├── form/page.test.tsx
│   │   │   └── [categoryId]/page.tsx
│   │   └── location/
│   │       ├── page.tsx
│   │       ├── page.test.tsx
│   │       ├── location.schema.ts
│   │       ├── location.utils.ts
│   │       ├── location.utils.test.ts
│   │       ├── form/page.tsx
│   │       └── form/page.test.tsx
│   ├── asset-maintenance/
│   │   ├── maintenance/
│   │   │   ├── page.tsx
│   │   │   ├── page.test.tsx
│   │   │   ├── asset-maintenance.schema.ts
│   │   │   ├── asset-maintenance.utils.ts
│   │   │   └── asset-maintenance.utils.test.ts
│   │   ├── maintenance-team/
│   │   │   ├── page.tsx
│   │   │   ├── page.test.tsx
│   │   │   ├── maintenance-team.schema.ts
│   │   │   ├── maintenance-team.utils.ts
│   │   │   ├── maintenance-team.utils.test.ts
│   │   │   ├── form/page.tsx
│   │   │   └── form/page.test.tsx
│   │   ├── log/
│   │   │   ├── page.tsx
│   │   │   ├── page.test.tsx
│   │   │   ├── asset-maintenance-log.schema.ts
│   │   │   ├── asset-maintenance-log.utils.ts
│   │   │   └── asset-maintenance-log.utils.test.ts
│   │   ├── value-adjustment/
│   │   │   ├── page.tsx
│   │   │   ├── page.test.tsx
│   │   │   ├── value-adjustment.schema.ts
│   │   │   ├── value-adjustment.utils.ts
│   │   │   ├── value-adjustment.utils.test.ts
│   │   │   ├── form/page.tsx
│   │   │   └── form/page.test.tsx
│   │   └── form/page.tsx
│   ├── reports/
│   │   ├── activity/
│   │   │   ├── page.tsx
│   │   │   ├── page.test.tsx
│   │   │   ├── activity.utils.ts
│   │   │   └── activity.utils.test.ts
│   │   ├── depreciation-ledger/
│   │   │   ├── page.tsx
│   │   │   ├── page.test.tsx
│   │   │   ├── depreciation-ledger.utils.ts
│   │   │   └── depreciation-ledger.utils.test.ts
│   │   └── depreciations-balances/
│   │       ├── page.tsx
│   │       ├── page.test.tsx
│   │       ├── depreciations-balances.utils.ts
│   │       └── depreciations-balances.utils.test.ts
│   ├── users/page.tsx
│   └── value-adjustment/page.tsx (redirect only)
```

---

*Document generated: 2026-05-28*
