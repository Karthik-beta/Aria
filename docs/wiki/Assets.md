# Assets

Fixed-asset management ported from ERPNext's **Assets** module. `asset.service.ts` follows ERPNext's Asset business logic, and the depreciation engine mirrors ERPNext's schedule controller.

## What it covers

| Area | Aria entities (Prisma) | ERPNext DocTypes |
|---|---|---|
| Register | Asset, AssetCategory (with accounts and finance books), Location, AssetActivity | Asset, Asset Category, Location, Asset Activity |
| Depreciation | AssetDepreciationSchedule (with entries), FinanceBook, AssetFinanceBook, AssetShiftFactor, AssetDepreciationJournalEntry | Asset Depreciation Schedule, Finance Book, Asset Shift Factor, Journal Entry |
| Value changes | AssetValueAdjustment, AssetRevaluationEntry | Asset Value Adjustment |
| Maintenance | AssetMaintenance, AssetMaintenanceTask, AssetMaintenanceTeam, AssetMaintenanceLog | Asset Maintenance, Asset Maintenance Team, Asset Maintenance Log |

**Depreciation methods:** straight line, double declining balance and written-down value, tested against fixtures ported from ERPNext. Scheduled postings run through a BullMQ queue (`apps/backend/src/apps/asset/depreciation/`).

**Reports:** Asset Activity, Depreciation Ledger, Depreciations and Balances, plus an asset dashboard.

**UI:** `/asset`: assets, categories, locations, maintenance, value adjustments, reports and dashboard.

## Further reading

- [Asset Management: ERPNext Parity](Asset-Management-Parity): what is done and what is still missing compared with ERPNext
- [ASSET-MODULE-GAP-ANALYSIS.md](https://github.com/Karthik-beta/Aria/blob/master/ASSET-MODULE-GAP-ANALYSIS.md): the original, more detailed gap analysis (May 2026)
- [Asset management client guide](https://github.com/Karthik-beta/Aria/blob/master/docs/asset-management-client-guide.md)
- [Depreciation production runbook](https://github.com/Karthik-beta/Aria/blob/master/docs/05-deployment/depreciation-production-runbook.md)
