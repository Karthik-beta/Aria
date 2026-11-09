# Assets

Fixed-asset management: the asset register, depreciation, value adjustments, maintenance and reports. `asset.service.ts` holds the asset lifecycle rules, and the depreciation engine builds each asset's schedule.

## What it covers

| Area | Aria entities (Prisma) |
|---|---|
| Register | Asset, AssetCategory (with accounts and finance books), Location, AssetActivity |
| Depreciation | AssetDepreciationSchedule (with entries), FinanceBook, AssetFinanceBook, AssetShiftFactor, AssetDepreciationJournalEntry |
| Value changes | AssetValueAdjustment, AssetRevaluationEntry |
| Maintenance | AssetMaintenance, AssetMaintenanceTask, AssetMaintenanceTeam, AssetMaintenanceLog |

**Depreciation methods:** straight line, double declining balance and written-down value, tested against expected schedules. Scheduled postings run through a BullMQ queue (`apps/backend/src/apps/asset/depreciation/`).

**Reports:** Asset Activity, Depreciation Ledger, Depreciations and Balances, plus an asset dashboard.

**UI:** `/asset`: assets, categories, locations, maintenance, value adjustments, reports and dashboard.

## Further reading

- [Feature coverage](Asset-Management-Coverage): what is implemented and what is still planned
- [Asset management client guide](https://github.com/Karthik-beta/Aria/blob/main/docs/asset-management-client-guide.md)
- [Depreciation production runbook](https://github.com/Karthik-beta/Aria/blob/main/docs/05-deployment/depreciation-production-runbook.md)
