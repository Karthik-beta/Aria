# Asset Management: ERPNext Parity

How far Aria's Asset Management module has got in porting ERPNext's **Assets** module, and what is left. This page reflects the code on `master` as of **21 October 2026**, updated after role-based access landed (ERPNext reference: the local `.erpnext/` checkout). For what the module does today, see [Assets](Assets). For the porting process, see [ERPNext Porting](ERPNext-Porting).

## Summary

| Area | Done | Notes |
|---|---|---|
| Masters (category, location, finance book) | ~85% | Location has no tree queries or geo fields |
| Asset register and lifecycle | ~45% | Create, submit and cancel only. No sell, scrap, split or transfer |
| Depreciation | ~85% | Every method except shift-based. Daily posting runs on BullMQ |
| Value adjustment | 100% | Posts revaluation entries and builds a new schedule revision |
| Maintenance | ~90% | No asset status change and no overdue job |
| Movement, repair, capitalization | 0% | No models, services or UI |
| Reports and dashboard | ~70% | 3 of 5 reports. Dashboard and number cards are live |
| Integrations (buying, selling, stock, GL) | ~5% | Purchase links are free text. No general ledger |
| Security (role-based access) | 100% | Writes need the org owner or admin role, in both the API and the UI |

**Overall: about 55% of ERPNext's Assets feature set.** The register, depreciation, value adjustment and maintenance are at or near parity. Asset transactions (movement, repair, capitalization, disposal) and every cross-module integration are still missing.

Percentages are judgement calls, not line counts. Each area is weighted by the share of ERPNext's doctypes, operations and reports it covers.

## Doctype by doctype

| ERPNext doctype | Aria | Status | Gaps |
|---|---|---|---|
| Asset | `Asset` | 🟡 Partial | Submit and cancel only. See [Asset lifecycle](#asset-lifecycle) |
| Asset Category (+ Account) | `AssetCategory`, `AssetCategoryAccount`, `AssetCategoryFinanceBook` | ✅ Done | CWIP flag and account are stored but never used |
| Location | `Location` | 🟡 Partial | Has a parent and an `isGroup` flag, but no tree API, area or geo fields |
| Asset Activity | `AssetActivity` | ✅ Done | |
| Asset Depreciation Schedule (+ Depreciation Schedule) | `AssetDepreciationSchedule`, `AssetDepreciationScheduleEntry` | ✅ Done | Keeps revisions |
| Asset Finance Book | `AssetFinanceBook` | ✅ Done | |
| Finance Book (Accounts) | `FinanceBook` | ✅ Done | Managed under `/admin/finance-book` |
| Asset Shift Factor | `AssetShiftFactor` | 🟠 Schema only | Nothing reads or writes the table, and it has no UI |
| Asset Shift Allocation | none | ❌ Missing | The engine accepts shift allocations, but nothing supplies them |
| Asset Value Adjustment | `AssetValueAdjustment`, `AssetRevaluationEntry` | ✅ Done | Supports preview, submit and cancel |
| Asset Maintenance (+ Task) | `AssetMaintenance`, `AssetMaintenanceTask` | ✅ Done | Tasks are edited inside the maintenance form |
| Asset Maintenance Team (+ Member) | `AssetMaintenanceTeam`, `AssetMaintenanceTeamMember` | ✅ Done | |
| Asset Maintenance Log | `AssetMaintenanceLog` | ✅ Done | Logs can be completed or cancelled. No scheduled status update |
| Asset Movement (+ Item) | none | ❌ Missing | Location and custodian can only be changed by editing the asset |
| Asset Repair (+ Consumed Item, Purchase Invoice) | none | ❌ Missing | |
| Asset Capitalization (+ Asset, Stock and Service Items) | none | ❌ Missing | No CWIP flow and no composite assets |

## Asset lifecycle

| ERPNext operation | Status | Notes |
|---|---|---|
| Submit / cancel | ✅ | Cancel is blocked once depreciation has been posted, and there is no procedure to reverse posted depreciation. No amend flow |
| Naming series | ✅ | `AST-YYYY-NNNNN` from `DocumentSeriesCounter` |
| Status: Draft, Submitted, Cancelled, Partially Depreciated, Fully Depreciated | ✅ | |
| Status: Sold, Scrapped, In Maintenance, Out of Order | 🟠 | In the enum, but no code sets them. Maintenance never changes the asset's status |
| Status: Issue, Receipt, Capitalized, Work In Progress | ❌ | Not in the enum |
| Scrap / restore asset | ❌ | |
| Sell asset (disposal, gain or loss) | ❌ | `disposalDate` is stored but unused |
| Split asset | ❌ | |
| Transfer, issue or receive (Asset Movement) | ❌ | |
| Create maintenance, repair, capitalization or value adjustment from an asset | 🟡 | Only maintenance and value adjustment exist, as separate pages. The asset page has no action buttons for them |

## Depreciation

| Feature | Status |
|---|---|
| Straight Line, Double Declining Balance, Written Down Value, Manual | ✅ Ported with ERPNext's test fixtures (`depreciation-schedule-engine.spec.ts`) |
| Daily pro-rata, opening accumulated depreciation, available-for-use date | ✅ |
| Shift-based depreciation | ❌ Needs Shift Allocation and wiring for Shift Factor |
| Automatic daily posting (`post_depreciation_entries`) | ✅ Daily cron plus BullMQ queue, with barrier and reconciliation |
| Posting into a general ledger (`make_depreciation_entry`) | 🟡 Posts to Aria's own `AssetDepreciationJournalEntry` tables. Accounts are plain strings because there is no chart of accounts or GL yet |
| Respecting a frozen-accounts date | ✅ |
| Rescheduling after a value adjustment | ✅ |

## Reports, dashboard and scheduled jobs

| ERPNext | Aria |
|---|---|
| Asset Activity report | ✅ `/asset/reports/activity`, with Excel export |
| Asset Depreciation Ledger | ✅ `/asset/reports/depreciation-ledger`, with Excel export |
| Asset Depreciations and Balances | ✅ `/asset/reports/depreciations-balances`, with Excel export |
| Fixed Asset Register | ❌ The asset list is the nearest equivalent |
| Asset Maintenance report | ❌ Only the operational log list |
| Number cards and charts (Asset Value, New Assets, Total Assets, value by category, location and month) | ✅ Live dashboard at `/asset/dashboard/overview` |
| Scheduled job: post depreciation entries | ✅ |
| Scheduled job: update asset maintenance status | ❌ |
| Scheduled job: update maintenance log status (overdue) | ❌ |
| Scheduled job: post deferred CWIP GL entries (`make_post_gl_entry`) | ❌ Needs CWIP and a GL |
| Onboarding steps and workspace | ❌ |

## Cross-module integrations

None of these exist yet. Most depend on an Accounts module (see [Modules](Modules)).

| ERPNext integration | Status |
|---|---|
| Purchase Receipt / Purchase Invoice: auto-create assets for `is_fixed_asset` items | ❌ `Asset.purchaseReceipt` and `purchaseInvoice` are free text with no foreign key. Items have no fixed-asset flag |
| Capital Work in Progress (CWIP) and asset received but not billed | ❌ |
| Sales Invoice: dispose of an asset and book the gain or loss | ❌ |
| Journal Entry and general ledger | ❌ Depreciation and revaluation go to tables used only by the asset module |
| Stock Entry: repair consumables and capitalization stock items | ❌ |
| Landed Cost Voucher on asset items | ❌ |
| Accounting Period lock | 🟡 The company's `accountsFrozenThrough` date only |

## Platform and quality gaps

- ✅ **Role-based access** (done in #123). Asset writes use `managerProcedure` (org `owner` or `admin`, or a global `super_admin`), and the UI hides write controls through `useCanManageAssets()`. Members can still view, export and complete maintenance logs.
- ✅ **Broken dashboard links** (fixed in #123).
- ✅ **Navigation.** Finance Book is in the asset sidebar under Assets (`/asset/asset-sub-module/finance-book`). Every member can read it; owners, admins and super admins can add, rename and delete. The admin console entry remains.
- ✅ **Service size** (fixed in #138). `asset.service.ts` is now a thin facade over focused sub-services (`AssetCoreService`, `AssetValueAdjustmentService`, `AssetReportsService`, `AssetLocationService`, `AssetFinanceBookService`, `AssetCategoryService`, `AssetMaintenanceTeamService`, `AssetMaintenanceService`), all under `apps/backend/src/apps/asset/` and registered in `AssetModule`. New features add their own service instead of growing the facade.
- **Tests.**
  - Backend: 21 spec files. Report specs have 1 or 2 cases each, and finance-book CRUD and depreciation persistence have no direct tests.
  - Frontend: 26 Vitest files and 6 Playwright specs, but no e2e coverage of the asset form, location, category or maintenance flows.

## Roadmap

The remaining gaps are planned as eight milestones of self-contained issues, written so automated coding agents can work them in parallel. Each issue ends with a footer listing what blocks it and what it blocks. Issues labelled `agent-ready` have no open blockers. Issues labelled `blocked` are waiting on another open issue.

| Milestone | Issues | Starts after |
|---|---|---|
| [M1: Foundations and hardening](https://github.com/Karthik-beta/Aria/milestone/1) | #137 vendor ERPNext source · #138 split `asset.service.ts` · #139 reverse posted depreciation · #140 status engine · #141 location tree · #142 backend test gaps · #143 timezone bug · #144 e2e coverage · #145 Finance Book nav and maintenance redirect · #146 automatic `agent-ready` labels | Nothing. #138 unblocks most later work |
| [M2: Asset Movement](https://github.com/Karthik-beta/Aria/milestone/2) | #147 backend · #148 UI | #138 |
| [M3: Disposal](https://github.com/Karthik-beta/Aria/milestone/3) | #149 scrap and restore · #150 sell · #151 split · #152 UI | #138, #139, #140 |
| [M4: Reports and scheduled jobs](https://github.com/Karthik-beta/Aria/milestone/4) | #153 Fixed Asset Register · #154 Asset Maintenance report · #155 maintenance jobs | #138 (#155 also needs #140) |
| [M5: Asset Repair](https://github.com/Karthik-beta/Aria/milestone/5) | #156 backend · #157 UI | #138, #140 |
| [M6: Shift-based depreciation](https://github.com/Karthik-beta/Aria/milestone/6) | #158 Shift Factor · #159 Shift Allocation and engine · #160 UI | #138 |
| [M7: General ledger foundation](https://github.com/Karthik-beta/Aria/milestone/7) | #161 ADR · #162 chart of accounts · #163 journal and GL posting · #164 move asset postings to the GL · #165 accounts UI | #161 can start now. #164 also needs #149 and #150 |
| [M8: Purchase integration, CWIP and capitalization](https://github.com/Karthik-beta/Aria/milestone/8) | #166 assets from Purchase Receipts · #167 CWIP · #168 Asset Capitalization | #138, then M7 |

Purchase Invoice and Sales Invoice don't exist in Aria yet, so the integrations that need them are out of scope until those documents are built. Update this page when an issue closes a gap.
