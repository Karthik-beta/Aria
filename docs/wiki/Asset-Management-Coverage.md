# Asset Management: Feature Coverage

What the Asset Management module implements today and what is still planned. This page reflects the code on `main` as of **21 October 2026**. For what the module does day to day, see [Assets](Assets).

Statuses describe what the code does now: **Done**, **Partial** (exists, with gaps), **Schema only** (table or enum exists, nothing uses it), or **Planned** (not built yet).

## Summary

| Area | Status | Notes |
|---|---|---|
| Masters (category, location, finance book) | Mostly done | Location has no tree queries or geo fields |
| Asset register and lifecycle | Partial | Create, submit and cancel only. No sell, scrap, split or transfer |
| Depreciation | Mostly done | Every method except shift-based. Daily posting runs on BullMQ |
| Value adjustment | Done | Posts revaluation entries and builds a new schedule revision |
| Maintenance | Mostly done | No asset status change and no overdue job |
| Movement, repair, capitalization | Planned | No models, services or UI |
| Reports and dashboard | Partial | Three reports are built. Dashboard and number cards are live |
| Integrations (buying, selling, stock, GL) | Minimal | Purchase links are free text. No general ledger |
| Security (role-based access) | Done | Writes need the org owner or admin role, in both the API and the UI |

## Entities

| Entity | Aria models | Status | Gaps |
|---|---|---|---|
| Asset | `Asset` | Partial | Submit and cancel only. See [Asset lifecycle](#asset-lifecycle) |
| Asset category | `AssetCategory`, `AssetCategoryAccount`, `AssetCategoryFinanceBook` | Done | CWIP flag and account are stored but never used |
| Location | `Location` | Partial | Has a parent and an `isGroup` flag, but no tree API, area or geo fields |
| Asset activity | `AssetActivity` | Done | |
| Depreciation schedule | `AssetDepreciationSchedule`, `AssetDepreciationScheduleEntry` | Done | Keeps revisions |
| Asset finance book | `AssetFinanceBook` | Done | |
| Finance book | `FinanceBook` | Done | Managed under `/admin/finance-book` |
| Asset shift factor | `AssetShiftFactor` | Schema only | Nothing reads or writes the table, and it has no UI |
| Asset shift allocation | none | Planned | The engine accepts shift allocations, but nothing supplies them |
| Asset value adjustment | `AssetValueAdjustment`, `AssetRevaluationEntry` | Done | Supports preview, submit and cancel |
| Asset maintenance | `AssetMaintenance`, `AssetMaintenanceTask` | Done | Tasks are edited inside the maintenance form |
| Asset maintenance team | `AssetMaintenanceTeam`, `AssetMaintenanceTeamMember` | Done | |
| Asset maintenance log | `AssetMaintenanceLog` | Done | Logs can be completed or cancelled. No scheduled status update |
| Asset movement | none | Planned | Location and custodian can only be changed by editing the asset |
| Asset repair | none | Planned | |
| Asset capitalization | none | Planned | No CWIP flow and no composite assets |

## Asset lifecycle

| Operation | Status | Notes |
|---|---|---|
| Submit / cancel | Partial | Cancel is blocked once depreciation has been posted, and there is no procedure to reverse posted depreciation. No amend flow |
| Naming series | Done | `AST-YYYY-NNNNN` from `DocumentSeriesCounter` |
| Status: Draft, Submitted, Cancelled, Partially Depreciated, Fully Depreciated | Done | |
| Status: Sold, Scrapped, In Maintenance, Out of Order | Schema only | In the enum, but no code sets them. Maintenance never changes the asset's status |
| Status: Issue, Receipt, Capitalized, Work In Progress | Planned | Not in the enum |
| Scrap / restore asset | Planned | |
| Sell asset (disposal, gain or loss) | Planned | `disposalDate` is stored but unused |
| Split asset | Planned | |
| Transfer, issue or receive (asset movement) | Planned | |
| Create maintenance, repair, capitalization or value adjustment from an asset | Partial | Maintenance and value adjustment exist as separate pages. The asset page has no action buttons for them |

## Depreciation

| Feature | Status |
|---|---|
| Straight line, double declining balance, written down value, manual | Done. Tested against expected schedules in `depreciation-schedule-engine.spec.ts` |
| Daily pro-rata, opening accumulated depreciation, available-for-use date | Done |
| Shift-based depreciation | Planned. Needs shift allocation and wiring for shift factor |
| Automatic daily posting | Done. Daily cron plus BullMQ queue, with barrier and reconciliation |
| Posting into a general ledger | Partial. Posts to Aria's own `AssetDepreciationJournalEntry` tables. Accounts are plain strings because there is no chart of accounts or GL yet |
| Respecting a frozen-accounts date | Done |
| Rescheduling after a value adjustment | Done |

## Reports, dashboard and scheduled jobs

| Item | Status |
|---|---|
| Asset activity report | Done. `/asset/reports/activity`, with Excel export |
| Asset depreciation ledger | Done. `/asset/reports/depreciation-ledger`, with Excel export |
| Asset depreciations and balances | Done. `/asset/reports/depreciations-balances`, with Excel export |
| Fixed asset register | Planned. The asset list is the nearest equivalent |
| Asset maintenance report | Planned. Only the operational log list exists |
| Number cards and charts (asset value, new assets, total assets, value by category, location and month) | Done. Live dashboard at `/asset/dashboard/overview` |
| Scheduled job: post depreciation entries | Done |
| Scheduled job: update asset maintenance status | Planned |
| Scheduled job: update maintenance log status (overdue) | Planned |
| Scheduled job: post deferred CWIP GL entries | Planned. Needs CWIP and a GL |
| Onboarding steps and workspace | Planned |

## Cross-module integrations

None of these exist yet. Most depend on an Accounts module (see [Modules](Modules)).

| Integration | Status |
|---|---|
| Purchase receipt / purchase invoice: create assets automatically for fixed-asset items | Planned. `Asset.purchaseReceipt` and `purchaseInvoice` are free text with no foreign key. Items have no fixed-asset flag |
| Capital work in progress (CWIP) and asset received but not billed | Planned |
| Sales invoice: dispose of an asset and book the gain or loss | Planned |
| Journal entry and general ledger | Planned. Depreciation and revaluation go to tables used only by the asset module |
| Stock entry: repair consumables and capitalization stock items | Planned |
| Landed cost voucher on asset items | Planned |
| Accounting period lock | Partial. Only the company's `accountsFrozenThrough` date |

## Platform and quality gaps

- **Done:** role-based access (#123). Asset writes use `managerProcedure` (org `owner` or `admin`, or a global `super_admin`), and the UI hides write controls through `useCanManageAssets()`. Members can still view, export and complete maintenance logs.
- **Done:** broken dashboard links (fixed in #123).
- **Navigation.** Finance Book is reachable only from the admin console, not the asset sidebar.
- **Service size.** `asset.service.ts` is about 3,700 lines and covers assets, locations, categories, maintenance, value adjustments and reports. Only the depreciation code has been split out.
- **Tests.**
  - Backend: 21 spec files. Report specs have 1 or 2 cases each, and finance-book CRUD and depreciation persistence have no direct tests.
  - Frontend: 26 Vitest files and 6 Playwright specs, but no e2e coverage of the asset form, location, category or maintenance flows.

## Roadmap

The remaining work is split into eight milestones of self-contained issues, written so automated coding agents can work them in parallel. Each issue ends with a footer listing what blocks it and what it blocks. Issues labelled `agent-ready` have no open blockers. Issues labelled `blocked` are waiting on another open issue.

| Milestone | Issues | Starts after |
|---|---|---|
| [M1: Foundations and hardening](https://github.com/Karthik-beta/Aria/milestone/1) | #137 vendored reference source · #138 split `asset.service.ts` · #139 reverse posted depreciation · #140 status engine · #141 location tree · #142 backend test gaps · #143 timezone bug · #144 e2e coverage · #145 Finance Book nav and maintenance redirect · #146 automatic `agent-ready` labels | Nothing. #138 unblocks most later work |
| [M2: Asset Movement](https://github.com/Karthik-beta/Aria/milestone/2) | #147 backend · #148 UI | #138 |
| [M3: Disposal](https://github.com/Karthik-beta/Aria/milestone/3) | #149 scrap and restore · #150 sell · #151 split · #152 UI | #138, #139, #140 |
| [M4: Reports and scheduled jobs](https://github.com/Karthik-beta/Aria/milestone/4) | #153 Fixed Asset Register · #154 Asset Maintenance report · #155 maintenance jobs | #138 (#155 also needs #140) |
| [M5: Asset Repair](https://github.com/Karthik-beta/Aria/milestone/5) | #156 backend · #157 UI | #138, #140 |
| [M6: Shift-based depreciation](https://github.com/Karthik-beta/Aria/milestone/6) | #158 Shift Factor · #159 Shift Allocation and engine · #160 UI | #138 |
| [M7: General ledger foundation](https://github.com/Karthik-beta/Aria/milestone/7) | #161 ADR · #162 chart of accounts · #163 journal and GL posting · #164 move asset postings to the GL · #165 accounts UI | #161 can start now. #164 also needs #149 and #150 |
| [M8: Purchase integration, CWIP and capitalization](https://github.com/Karthik-beta/Aria/milestone/8) | #166 assets from Purchase Receipts · #167 CWIP · #168 Asset Capitalization | #138, then M7 |

Purchase Invoice and Sales Invoice don't exist in Aria yet, so the integrations that need them are out of scope until those documents are built. Update this page when an issue closes a gap.
