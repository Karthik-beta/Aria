# Aria Asset Management — Product Report

> **Prepared for:** Sales & Marketing  
> **Product:** Aria ERP — Asset Management Module  
> **Date:** May 2026  
> **Purpose:** Detailed feature reference to support brochure and marketing collateral creation

---

## Contents

1. [Executive Summary](#1-executive-summary)
2. [Module Architecture](#2-module-architecture)
3. [Feature Walkthrough — Page by Page](#3-feature-walkthrough--page-by-page)
   - [3.1 Dashboard Overview](#31-dashboard-overview)
   - [3.2 Asset Registry](#32-asset-registry)
   - [3.3 Asset Categories](#33-asset-categories)
   - [3.4 Locations](#34-locations)
   - [3.5 Asset Maintenance](#35-asset-maintenance)
   - [3.6 Maintenance Teams](#36-maintenance-teams)
   - [3.7 Value Adjustments (Revaluation)](#37-value-adjustments-revaluation)
   - [3.8 Reports](#38-reports)
4. [Key Capabilities](#4-key-capabilities)
5. [Technical Highlights](#5-technical-highlights)
6. [Domain Model Reference](#6-domain-model-reference)
7. [Appendix: Screen Inventory](#appendix-screen-inventory)

---

## 1. Executive Summary

The Aria **Asset Management** module provides complete **fixed-asset lifecycle tracking** — from acquisition and capitalisation through depreciation, maintenance, and eventual disposal. It is designed for organisations that need to maintain an accurate asset register, automate depreciation calculations, schedule preventive maintenance, perform revaluations, and generate statutory reports.

**Key value propositions:**

- **Single source of truth** for all fixed assets across locations, departments, and companies
- **Four depreciation methods** (Straight Line, Double Declining Balance, Written Down Value, Manual) with automatic schedule generation
- **Preventive maintenance management** with configurable periodicity from daily to 3-yearly, team assignment, and automatic next-due-date calculation
- **Full revaluation workflow** — draft, preview with live journal entry and depreciation schedule preview, submit with atomic transaction safety, and cancel with full reversal
- **Real-time dashboard** with KPIs, charts, maintenance due alerts, and insurance expiry tracking
- **Three specialized reports** (Activity Log, Depreciation Ledger, Depreciations & Balances) — all exportable to Excel
- **Type-safe, real-time architecture** — tRPC-driven API with WebSocket subscriptions for live updates across all screens

---

## 2. Module Architecture

The Asset Management module is organized into **four logical sub-modules**, each with dedicated screens:

| Sub-Module | Purpose | Key Screens |
|---|---|---|
| **Asset Master Data** | Registry of what assets exist, where they are, and how they are categorized | Asset List, Asset Detail, Asset Form; Category List/Form; Location List/Form |
| **Asset Maintenance** | Preventive maintenance scheduling, team management, and execution logging | Maintenance List, Maintenance Form, Maintenance Team, Maintenance Log |
| **Value Adjustments** | Asset revaluation (increase/decrease carrying value) with automatic depreciation rescheduling | Adjustment List, Adjustment Form with live preview |
| **Reports & Analytics** | Dashboard overview and three detailed exportable reports | Dashboard, Activity Report, Depreciation Ledger, Depreciations & Balances |

---

## 3. Feature Walkthrough — Page by Page

### 3.1 Dashboard Overview

**URL:** `/asset/dashboard/overview`

The landing page for asset management. A real-time command centre providing a bird's-eye view of the entire asset portfolio.

#### 3.1.1 KPI Cards (top row)

Four at-a-glance metric cards:

| KPI | What It Shows | Insight |
|---|---|---|
| **Total Asset Value** | Sum of current carrying values (`valueAfterDepreciation`) across all non-disposed assets | Retention percentage vs. original purchase cost |
| **Active Assets** | Count of assets in operational statuses (Submitted, Partially Depreciated, In Maintenance, Out of Order) | Operational percentage across location count |
| **Maintenance Due** | Count of overdue/planned maintenance tasks with next-due-date ≤ today | Red "Attention" badge when tasks are due; green "All Clear" when none |
| **Pending Adjustments** | Count of draft value adjustments awaiting review | "Drafts" badge; green "No pending adjustments" when zero |

Each KPI card shows a formatted value, an insight line with icon, a contextual subtext, and an action badge (e.g., total depreciation amount, "All Clear" status).

**Data freshness:** Overview data is fetched from the server and automatically invalidated via **real-time WebSocket subscriptions** whenever assets, adjustments, or maintenance records change. A debounced refresh (200ms) prevents excessive re-renders.

#### 3.1.2 Charts

**Status Distribution (Donut Chart)** — Top-right panel
- Shows the breakdown of all assets by lifecycle status (Draft, Submitted, Partially Depreciated, Fully Depreciated, Sold, Scrapped, In Maintenance, Out of Order)
- Interactive donut with colour-coded segments; center label shows total asset count
- Legend footer with per-status colour dots and counts

**Depreciation Trend (Area Chart)** — Top-left panel
- Monthly depreciation amounts derived from active depreciation schedule entries
- Time-series area chart with gradient fill
- Hole state when no depreciation data exists yet

**Value by Category (Horizontal Bar Chart)** — Lower-left panel
- Compares current value vs. purchase value across asset categories (top 10)
- Visual depreciation impact per category group

**Asset Value by Location (Vertical Bar Chart)** — Lower-right panel
- Distribution of asset value across physical locations (top 10)
- Summary footer showing total assets per location

All charts are lazy-loaded (code-split) for fast initial page render.

#### 3.1.3 Alert Panels

| Panel | What It Shows | Urgency Levels |
|---|---|---|
| **Maintenance Due List** | Top 15 tasks with next-due-date ≤ 90 days | Overdue (red), Urgent ≤7d (red), Soon ≤30d (amber), Upcoming ≤60d (yellow), Planned >60d (green) |
| **Insurance Expiry Tracker** | Top 15 insured assets with policy expiry ≤ 90 days | Expired (red), Critical ≤7d (red), Warning ≤30d (amber), Upcoming ≤60d (yellow), OK >60d (green) |
| **Recent Activity Feed** | Last 10 asset lifecycle events (created, submitted, transferred, scrapped, valuation adjusted, etc.) | Relative timestamps ("2h ago", "3d ago", "12 May") |
| **Adjustment Summary** | Value adjustments grouped by status (Draft/Submitted/Cancelled) with horizontal bar chart | Percentage bars with status-specific colours |

---

### 3.2 Asset Registry

The asset registry is the core master-data module. It provides full CRUD (Create, Read, Update, Delete) with enterprise-grade data-table capabilities.

#### 3.2.1 Asset List Page

**URL:** `/asset/asset-sub-module/asset`

- **Enterprise data grid** with virtual scrolling, column resizing, column reordering, server-side pagination (25 per page), and multi-column sorting
- **Column set:** Select (checkbox), Series (monospace), Asset Name (link to detail), Status (colour-coded badge: Draft/Submitted/Partially Depreciated/Fully Depreciated/Sold/Scrapped/In Maintenance/Out of Order), Category, Location, Age (relative time)
- **Global search** across asset names and series
- **Export** to CSV, Excel, JSON, or PDF
- **Bulk delete** with confirmation dialog
- **Inline single-delete** via row action dropdown (View Details, Edit Asset, Delete Asset)
- **Quick-create dialog** — a modal that creates an asset with just 4 fields (Name, Company, Category, Location) plus a "Edit Full Form" button that navigates to the full form with values pre-filled
- **Real-time updates** via WebSocket subscription — the list auto-refreshes when any asset is created, updated, or deleted from another user's session
- **Error handling** with retry, toast notifications, and graceful degradation if the real-time connection drops

#### 3.2.2 Asset Detail Page

**URL:** `/asset/asset-sub-module/asset/[assetId]`

A read-focused detail view with four information cards:

| Card | Fields |
|---|---|
| **Basic Information** | Asset Name, Series (monospace), Item Code, Category, Company, Location (with map pin icon), Custodian, Department, Asset Quantity |
| **Purchase & Valuation** | Purchase Date, Available For Use Date, Net Purchase Amount (INR formatted), Calculate Depreciation (Yes/No), Depreciation Method, Fully Depreciated flag, Maintenance Required flag |
| **Ownership & Insurance** | Asset Owner (Company/Supplier/Customer), Owner Company, Supplier, Insurer, Policy Number, Insured Value, Insurance Start Date, Insurance End Date |
| **Activity Log** | Timeline of all lifecycle events with relative timestamps (e.g., "Asset created", "Asset submitted", "Asset scrapped") |

Actions: Edit (navigates to form), Delete (with confirmation), Back to list.

#### 3.2.3 Asset Form (Create / Edit)

**URL:** `/asset/asset-sub-module/asset/form?id=(optional)`

Three form sections:

**Section 1 — Basic Information:**
- Asset Name (required), Company (required), Item Code, Asset Category (searchable combobox), Location (searchable combobox), Custodian, Department, Quantity, Status dropdown (Draft/Submitted/In Maintenance/Out of Order/Sold/Scrapped/Cancelled)

**Section 2 — Purchase & Valuation:**
- Purchase Date (date picker), Available For Use Date (date picker), Net Purchase Amount, Asset Owner (Company/Supplier/Customer dropdown)

**Section 3 — Options:**
- **Calculate Depreciation** checkbox — when enabled, reveals a "Depreciation Details" sub-section:
  - Depreciation Method dropdown (Straight Line / Double Declining Balance / Written Down Value / Manual)
  - Total Number of Depreciations (integer)
  - Frequency of Depreciation in Months (integer)
  - Expected Value After Useful Life (decimal)
  - Depreciation Start Date (date picker)
  - When a category is selected, depreciation defaults **auto-populate** from the category (method, number of depreciations, frequency, salvage value)
- **Fully Depreciated** checkbox
- **Maintenance Required** checkbox

**Validation:** Zod schema validation on the client side, with Zod-based DTO validation on the backend. Errors surfaced via toast notifications.

**Series generation:** On creation, the backend auto-generates a series number in the format `AST-YYYY-NNNNN` (e.g., `AST-2026-00042`) using atomic database counters to guarantee uniqueness.

---

### 3.3 Asset Categories

**URLs:**
- List: `/asset/asset-sub-module/asset-category`
- Form: `/asset/asset-sub-module/asset-category/form?id=(optional)`
- Detail: `/asset/asset-sub-module/asset-category/[categoryId]`

Asset categories define **depreciation defaults** that are inherited by assets. Each category has:

| Field | Description |
|---|---|
| **Name** | Unique category identifier (e.g., "Office Equipment", "Vehicles", "IT Hardware") |
| **Non-Depreciable Category** | Checkbox — skips depreciation entirely (e.g., land) |
| **Enable CWIP Accounting** | Capital Work In Progress accounting toggle |
| **Depreciation Method** | Straight Line / Double Declining Balance / Written Down Value / Manual |
| **Total Number of Depreciations** | Total periods over the asset's useful life |
| **Frequency of Depreciation** | Months between each depreciation entry (e.g., 12 = annual) |
| **Daily Prorata Based** | Prorate first/last period based on days |
| **Shift Based** | Depreciation varies by shift allocation |
| **Rate of Depreciation** | Custom rate for WDV method |
| **Expected Value After Useful Life** | Salvage/residual value |

**Validation:** When the category is depreciable, the method, total number of depreciations, and frequency are mandatory. Non-depreciable categories skip this validation.

**Guard:** Categories in use by assets cannot be deleted.

---

### 3.4 Locations

**URLs:**
- List: `/asset/asset-sub-module/location`
- Form: `/asset/asset-sub-module/location/form?id=(optional)`

Physical locations where assets reside. Supports a **hierarchical tree structure** — locations can have parent locations (e.g., "Bangalore" → "Koramangala Office" → "Floor 2").

| Field | Description |
|---|---|
| **Name** | Unique location name |
| **Parent Location** | Optional parent for tree hierarchy |
| **Is Group** | Flag indicating this is a grouping node, not a leaf location |

**Guard:** Locations with assigned assets cannot be deleted.

---

### 3.5 Asset Maintenance

#### 3.5.1 Maintenance List Page

**URL:** `/asset/asset-maintenance`

Displays all maintenance records with columns: Asset (link to form), Company, Maintenance Team, Tasks Count (blue badge), Overall Status (Planned/Overdue/Cancelled — computed from task statuses).

Features: Search filter, delete, edit, real-time subscription updates.

#### 3.5.2 Maintenance Form (Create / Edit)

**URL:** `/asset/asset-maintenance/form?id=(optional)`

**Constraint:** One maintenance record per asset (unique assetId).

Three sections:

**Asset Information:**
- Asset ID & Company (both required)

**Maintenance Team:**
- Maintenance Team ID (required), Maintenance Manager (optional email/username), Manager Display Name

**Maintenance Tasks (dynamic inline table):**
- Each task row includes:

| Field | Options |
|---|---|
| **Task Name** | Free text (required) |
| **Type** | None / Preventive Maintenance / Calibration |
| **Periodicity** | Daily / Weekly / Monthly / Quarterly / Half-Yearly / Yearly / 2-Yearly / 3-Yearly |
| **Start Date** | Date picker (required) |
| **End Date** | Optional date picker |
| **Certificate Required** | Checkbox |

- Tasks can be added/removed dynamically (minimum 1 required)
- On create, the backend auto-generates initial maintenance logs for each task and calculates the `nextDueDate`
- "Not Saved" badge appears when the form is dirty

#### 3.5.3 Maintenance Log

**URL:** `/asset/asset-maintenance/log`

Tracks execution of maintenance tasks. Supports:
- **Complete** action — marks the log complete, auto-calculates the next due date from the last completion date and periodicity, creates the next open log entry
- **Cancel** action — cancels the log and its parent task
- Statuses: Planned, Completed, Cancelled, Overdue

#### 3.5.4 Maintenance Teams

**URLs:**
- List: `/asset/asset-maintenance/maintenance-team`
- Form: `/asset/asset-maintenance/maintenance-team/form?id=(optional)`

Teams with nested members. Each member has: team member ID, full name, and maintenance role. Teams can have multiple members and a designated maintenance manager.

---

### 3.7 Value Adjustments (Revaluation)

#### 3.7.1 Adjustment List Page

**URL:** `/asset/asset-maintenance/value-adjustment`

Columns: Adjustment Series (link), Asset (name + series), Company, Adjustment Date, Carrying Value (current → new), Difference Amount, Direction (Increase/Decrease badge), Status (Draft/Submitted/Cancelled badge), Revaluation Entry Journal Number, Age.

Actions vary by status:
- **Draft:** Edit Draft, Submit Adjustment, Delete Draft
- **Submitted:** View Adjustment, Cancel Adjustment (with confirmation)
- **Cancelled:** View only (read-only)

Real-time subscription updates the list when adjustments change state.

#### 3.7.2 Adjustment Form (with Live Preview)

**URL:** `/asset/asset-maintenance/value-adjustment/form?id=(optional)`

**Form Fields:**

| Field | Description |
|---|---|
| **Asset** | Dropdown filtered to valid assets (excludes Draft/Cancelled/Sold/Scrapped; preserves preselected or existing asset) |
| **Adjustment Date** | Date picker |
| **New Asset Value** | The target carrying value (numeric) |
| **Difference Account** | GL account where the revaluation difference is posted (e.g., "Asset Revaluation Reserve") |
| **Cost Center** | Optional |
| **Notes** | Optional (up to 5,000 characters) |

**Live Preview Panel** — updates in real time as the user types:

1. **Preview Stat Cards** (4 cards):
   - Current Carrying Value (with asset name)
   - Difference amount (with direction: Increase/Decrease)
   - Company (with asset category name)
   - Fixed Asset Account (with resulting asset status after the adjustment)

2. **Validation Messages** — amber alert box listing warnings (e.g., "New value matches current value — no adjustment needed")

3. **Revaluation Entry Preview** — a journal entry table showing debits and credits:
   - **Increase:** Debit Fixed Asset Account, Credit Difference Account
   - **Decrease:** Debit Difference Account, Credit Fixed Asset Account

4. **Depreciation Schedule Preview** — when the adjusted value changes, shows the new schedule:
   - Method, Frequency, Remaining Periods, Base Value
   - Full scrollable table: Sequence #, Date, Depreciation Amount, Accumulated Depreciation, Book Value After Depreciation

**Actions:**
- **Save Draft** — creates or updates the adjustment in DRAFT status
- **Save & Submit** (or Create & Submit) — saves and immediately submits, which atomically:
  1. Cancels the prior depreciation schedule (if any)
  2. Creates a numbered revaluation journal entry (series `JE-AVA-YYYY-NNNNN`) with debit/credit lines
  3. Generates a new depreciation schedule based on the new carrying value
  4. Updates the asset's `valueAfterDepreciation`, status, and `isFullyDepreciated` flag
  5. Logs an activity entry
- **Cancel Adjustment** (submitted records only) — reverses the revaluation entry, cancels the schedule, restores the previous asset state

**Adjustment series:** Auto-generated as `AVA-YYYY-NNNNN` (e.g., `AVA-2026-00015`).

**Read-only mode:** Submitted and Cancelled adjustments display the stored revaluation entry and final depreciation schedule (non-editable).

---

### 3.8 Reports

All three reports support date-range filtering, multi-field filters, and Excel export. They use the `EXPORT_MAX_ROWS` limit (10,000 rows) to control export size.

#### 3.8.1 Asset Activity Report

**URL:** `/asset/reports/activity`

An **append-only audit trail** of every lifecycle event recorded against assets.

**Filters:** Company, From Date, To Date, Asset (name search), Asset Category, Activity (text contains)

**Summary cards:** Total Activities, Distinct Assets, First Recorded Event, Latest Recorded Event

**Table columns:** Recorded At (datetime), Asset (name + series), Asset Category, Company, Current Status (badge), Activity (full description)

#### 3.8.2 Asset Depreciation Ledger

**URL:** `/asset/reports/depreciation-ledger`

A **schedule-backed depreciation history** report showing each depreciation period entry with full revision context.

**Filters:** Company, From Date, To Date, Asset, Asset Category, Cost Center

**Summary cards:** Matched Assets (split: with/without ledger rows), Ledger Entries, Total Depreciation In Range, Closing Book Value

**Warning:** Amber banner when some matched assets have no schedule-backed ledger rows in the date range.

**Table columns:** Depreciation Date, Asset (name + series), Asset Category, Company, **Revision Source** (schedule revision number, adjustment series, adjustment date, revaluation entry series), Cost Center, Purchase Amount, Opening Accumulated Depreciation, Depreciation Amount (this period), Accumulated Depreciation, Value After Depreciation, Depreciation Method, Current Status (badge), Purchase Date

#### 3.8.3 Asset Depreciations and Balances

**URL:** `/asset/reports/depreciations-balances`

A **financial-period movement report** showing opening/closing balances and all movements in between — ideal for month-end, quarter-end, or year-end reporting.

**Filters:** Company, From Date, To Date, **Group By** (Asset Category or Asset — changes the grouping and filter options dynamically)

**Summary cards:** Matched Assets, Grouped Rows, Period Depreciation, Revaluation Delta, Closing Net Asset Value

**Table columns** (context-aware — depends on group-by mode):

| Column Group | Columns |
|---|---|
| **Opening** | Value as on [from-date], Accumulated Depreciation as on [from-date], Net Asset Value as on [from-date] |
| **Inflows** | Value of New Purchase, Value of Capitalized Asset (conditional — shown when data exists) |
| **Outflows** | Value of Sold Asset, Value of Scrapped Asset |
| **Revaluation** | Revaluation Delta (colour-coded: green for positive, red for negative) |
| **Closing** | Value as on [to-date], Accumulated Depreciation as on [to-date], Net Asset Value as on [to-date] |
| **Depreciation Movement** | Depreciation During Period, Depreciation Eliminated by Disposal, Depreciation Eliminated via Reversal (conditional) |

Columns that have zero values across all rows are automatically hidden (e.g., Capitalized Asset and Reversal columns).

---

## 4. Key Capabilities

### 4.1 Depreciation Engine

| Method | Description | Variants |
|---|---|---|
| **Straight Line (SL)** | Equal depreciation per period. `(PurchaseValue - SalvageValue) ÷ TotalPeriods` | Daily prorata for first/last period, shift-based allocation |
| **Double Declining Balance (DDB)** | 200% of straight-line rate applied to book value each period | Fiscal-year-aware recalculation |
| **Written Down Value (WDV)** | Custom rate based on `1 - (Salvage/Purchase)^(1/N)`. Book value decreases each period | Fiscal-year transitions |
| **Manual** | Empty schedule — depreciation entries entered manually | N/A |

**Schedule lifecycle:**
1. `Draft` → created during adjustment preview
2. `Active` → replaces previous schedule on adjustment submission (previous version is cancelled)
3. `Cancelled` → when an adjustment is reversed

**Schedule revision tracking:** Each schedule links to its predecessor via `previousScheduleId`, creating a full audit chain. The depreciation ledger report uses the effective revision for each date in the requested range.

### 4.2 Preventive Maintenance

- **8 periodicity options** from daily to 3-yearly
- **Auto-scheduling** of next due dates on task completion
- **Overdue detection** with dashboard alerts
- **Certificate tracking** (flag + attachment per task)
- **Team-based assignment** with roles

### 4.3 Asset Revaluation

- **Preview before commit** — see the journal entry and new depreciation schedule before submitting
- **Atomic submission** — cancels old schedule, creates journal entry, generates new schedule, and updates the asset in a single database transaction
- **Full reversal** — cancel restores the previous carrying value, reverses the journal entry, and cancels the derived schedule
- **Dual direction support** — increase or decrease the carrying value
- **Status-aware** — adjusts the asset's lifecycle status based on the new value (e.g., becomes Fully Depreciated if value drops to salvage)

### 4.4 Insurance Tracking

- Per-asset insurance fields: insurer name, policy number, insured value, start/end dates
- **Dashboard expiry tracking** — policies expiring within 90 days flagged with urgency levels
- Five urgency tiers: Expired, Critical (≤7d), Warning (≤30d), Upcoming (≤60d), OK (>60d)

### 4.5 Document Series

Auto-generated, gapless series numbers via atomic database counters:
- Assets: `AST-YYYY-NNNNN` (e.g., `AST-2026-00042`)
- Value Adjustments: `AVA-YYYY-NNNNN` (e.g., `AVA-2026-00015`)
- Revaluation Journal Entries: `JE-AVA-YYYY-NNNNN`

### 4.6 Real-Time Updates

All major list screens use WebSocket-based tRPC subscriptions. When a user creates, updates, or deletes a record, all other connected clients see the change immediately — no manual refresh needed. Subscriptions exist for: Assets, Locations, Categories, Value Adjustments, Maintenance Teams, and Maintenance Records.

### 4.7 Exports

Every table and report supports **Excel export** via server-side buffer generation, and **CSV/JSON/PDF** exports via client-side conversion. Row limit: 10,000. Exports include all visible columns in the current sort order.

### 4.8 Access Control

The entire asset module is guarded by `AppAccessBoundary` (with `appKey="asset"`), backed by the Aria RBAC/ABAC authorization system.

---

## 5. Technical Highlights

| Aspect | Implementation |
|---|---|
| **API Protocol** | tRPC — end-to-end type-safe RPC with Zod validation on both sides |
| **Real-Time** | WebSocket subscriptions (tRPC observables) with `EventEmitter`-based pub/sub on the server |
| **Database** | PostgreSQL via Prisma ORM (v7 with `PrismaPg` adapter) |
| **Transactions** | Atomic `prisma.$transaction()` for critical operations (adjustment submit/cancel, maintenance team updates, log completions) |
| **Precision** | All monetary values stored as `Decimal(18,6)` → converted to `number` (6 decimal places) |
| **Caching** | React Query with stale-while-revalidate; optimistic UI updates via mutation `onMutate` handlers |
| **Validation** | Zod schemas shared between frontend and backend via `@aria/types` package |
| **Charts** | Recharts library with custom colour scales, lazy-loaded chart islands |
| **Table** | Shared `AdvancedDataTable` component (TanStack React Table) — virtualization, column management, bulk actions, export |
| **Error Handling** | Structured error types with user-friendly toast messages, retry mechanisms, and error boundaries |

---

## 6. Domain Model Reference

### 6.1 Asset Statuses

| Status | Meaning |
|---|---|
| `DRAFT` | Not yet submitted; editable |
| `SUBMITTED` | Active in the asset register |
| `PARTIALLY_DEPRECIATED` | Some depreciation booked, more to go |
| `FULLY_DEPRECIATED` | Carrying value ≤ salvage value |
| `SOLD` | Disposed via sale |
| `SCRAPPED` | Disposed via scrapping |
| `IN_MAINTENANCE` | Under maintenance |
| `OUT_OF_ORDER` | Non-operational |
| `CANCELLED` | Record cancelled |

### 6.2 Adjustment Statuses

| Status | Meaning |
|---|---|
| `DRAFT` | Editable, not yet applied |
| `SUBMITTED` | Applied — journal entry posted, schedule updated |
| `CANCELLED` | Reversed — previous state restored |

### 6.3 Maintenance Task Periodicity

`DAILY` → `WEEKLY` → `MONTHLY` → `QUARTERLY` → `HALF_YEARLY` → `YEARLY` → `TWO_YEARLY` → `THREE_YEARLY`

### 6.4 Maintenance Task Types

- `PREVENTIVE_MAINTENANCE`
- `CALIBRATION`

---

## Appendix: Screen Inventory

| # | Screen | URL Pattern | Type |
|---|---|---|---|
| 1 | Dashboard Overview | `/asset/dashboard/overview` | Dashboard |
| 2 | Asset List | `/asset/asset-sub-module/asset` | List + CRUD |
| 3 | Asset Detail | `/asset/asset-sub-module/asset/[assetId]` | Detail |
| 4 | Asset Form | `/asset/asset-sub-module/asset/form?id=` | Create/Edit |
| 5 | Asset Category List | `/asset/asset-sub-module/asset-category` | List + CRUD |
| 6 | Asset Category Detail | `/asset/asset-sub-module/asset-category/[categoryId]` | Detail |
| 7 | Asset Category Form | `/asset/asset-sub-module/asset-category/form?id=` | Create/Edit |
| 8 | Location List | `/asset/asset-sub-module/location` | List + CRUD |
| 9 | Location Form | `/asset/asset-sub-module/location/form?id=` | Create/Edit |
| 10 | Maintenance List | `/asset/asset-maintenance` | List + CRUD |
| 11 | Maintenance Form | `/asset/asset-maintenance/form?id=` | Create/Edit |
| 12 | Maintenance Log | `/asset/asset-maintenance/log` | List + Actions |
| 13 | Maintenance Team List | `/asset/asset-maintenance/maintenance-team` | List + CRUD |
| 14 | Maintenance Team Form | `/asset/asset-maintenance/maintenance-team/form?id=` | Create/Edit |
| 15 | Value Adjustment List | `/asset/asset-maintenance/value-adjustment` | List + CRUD |
| 16 | Value Adjustment Form | `/asset/asset-maintenance/value-adjustment/form?id=` | Create/Edit + Preview |
| 17 | Activity Report | `/asset/reports/activity` | Report |
| 18 | Depreciation Ledger | `/asset/reports/depreciation-ledger` | Report |
| 19 | Depreciations & Balances | `/asset/reports/depreciations-balances` | Report |
| 20 | Access Denied | `/asset/access-denied` | Error |

**Total screens:** 20 distinct pages

**Unified data layer:** All screens communicate through a single `@aria/api-contract` tRPC router with 40+ documented procedures covering CRUD, reporting, dashboard queries, real-time subscriptions, and Excel exports.
