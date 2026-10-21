/* eslint-disable */

import { AssetService } from "../asset.service";
import type { AssetCategoryService } from "../asset-category.service";
import type { AssetCoreService } from "../asset-core.service";
import type { AssetDashboardSubService } from "../asset-dashboard.service";
import type { AssetFinanceBookService } from "../asset-finance-book.service";
import type { AssetLocationService } from "../asset-location.service";
import type { AssetMaintenanceService } from "../asset-maintenance.service";
import type { AssetMaintenanceTeamService } from "../asset-maintenance-team.service";
import type { AssetReportsService } from "../asset-reports.service";
import type { AssetValueAdjustmentService } from "../asset-value-adjustment.service";

type SubServiceField =
	| "dashboard"
	| "core"
	| "valueAdjustment"
	| "reports"
	| "location"
	| "financeBook"
	| "category"
	| "maintenanceTeam"
	| "maintenance";

/** Public facade method, the sub-service it must delegate to, and its argument count. */
const DELEGATIONS: ReadonlyArray<[string, SubServiceField, number]> = [
	["getDashboardData", "dashboard", 0],
	["getDashboardOverviewData", "dashboard", 0],
	["getDashboardTopChartsData", "dashboard", 0],
	["getDashboardBottomChartsData", "dashboard", 0],
	["findAllAssets", "core", 1],
	["findAssetById", "core", 1],
	["findAssetByBarcode", "core", 1],
	["createAsset", "core", 1],
	["updateAsset", "core", 1],
	["submitAsset", "core", 1],
	["cancelAsset", "core", 1],
	["deleteAsset", "core", 1],
	["deleteManyAssets", "core", 1],
	["findAssetActivityReport", "reports", 1],
	["findAssetDepreciationLedger", "reports", 1],
	["findAssetDepreciationsAndBalances", "reports", 1],
	["findAllAssetValueAdjustments", "valueAdjustment", 1],
	["findAssetValueAdjustmentById", "valueAdjustment", 1],
	["previewAssetValueAdjustment", "valueAdjustment", 1],
	["createAssetValueAdjustment", "valueAdjustment", 1],
	["updateAssetValueAdjustment", "valueAdjustment", 1],
	["submitAssetValueAdjustment", "valueAdjustment", 1],
	["cancelAssetValueAdjustment", "valueAdjustment", 1],
	["deleteAssetValueAdjustment", "valueAdjustment", 1],
	["findAllLocations", "location", 1],
	["findAllEmployees", "location", 1],
	["findLocationById", "location", 1],
	["createLocation", "location", 1],
	["updateLocation", "location", 1],
	["deleteLocation", "location", 1],
	["findAllFinanceBooks", "financeBook", 1],
	["createFinanceBook", "financeBook", 1],
	["updateFinanceBook", "financeBook", 1],
	["deleteFinanceBook", "financeBook", 1],
	["findAllAssetCategories", "category", 1],
	["findAssetCategoryById", "category", 1],
	["createAssetCategory", "category", 1],
	["updateAssetCategory", "category", 1],
	["deleteAssetCategory", "category", 1],
	["findAllMaintenanceTeams", "maintenanceTeam", 1],
	["findMaintenanceTeamById", "maintenanceTeam", 1],
	["createMaintenanceTeam", "maintenanceTeam", 1],
	["updateMaintenanceTeam", "maintenanceTeam", 1],
	["deleteMaintenanceTeam", "maintenanceTeam", 1],
	["deleteManyMaintenanceTeams", "maintenanceTeam", 1],
	["calculateNextDueDate", "maintenance", 4],
	["findAllAssetMaintenances", "maintenance", 1],
	["findAssetMaintenanceById", "maintenance", 1],
	["findAssetMaintenanceByAssetId", "maintenance", 1],
	["findAssetMaintenanceLogs", "maintenance", 1],
	["findAllAssetMaintenanceLogs", "maintenance", 1],
	["cancelAssetMaintenanceLog", "maintenance", 1],
	["createAssetMaintenance", "maintenance", 1],
	["updateAssetMaintenance", "maintenance", 1],
	["deleteAssetMaintenance", "maintenance", 1],
	["deleteManyAssetMaintenances", "maintenance", 1],
	["completeAssetMaintenanceLog", "maintenance", 1],
];

function createFacade() {
	const fields: SubServiceField[] = [
		"dashboard",
		"core",
		"valueAdjustment",
		"reports",
		"location",
		"financeBook",
		"category",
		"maintenanceTeam",
		"maintenance",
	];
	const subServices = {} as Record<SubServiceField, Record<string, jest.Mock>>;
	for (const field of fields) {
		subServices[field] = {};
	}
	for (const [method, field] of DELEGATIONS) {
		subServices[field][method] = jest.fn();
	}
	const service = new AssetService(
		subServices.dashboard as unknown as AssetDashboardSubService,
		subServices.core as unknown as AssetCoreService,
		subServices.valueAdjustment as unknown as AssetValueAdjustmentService,
		subServices.reports as unknown as AssetReportsService,
		subServices.location as unknown as AssetLocationService,
		subServices.financeBook as unknown as AssetFinanceBookService,
		subServices.category as unknown as AssetCategoryService,
		subServices.maintenanceTeam as unknown as AssetMaintenanceTeamService,
		subServices.maintenance as unknown as AssetMaintenanceService,
	);
	return { service, subServices };
}

describe("AssetService > facade delegation", () => {
	it("covers every public method of the facade", () => {
		const { service } = createFacade();
		const publicMethods = Object.getOwnPropertyNames(
			Object.getPrototypeOf(service),
		)
			.filter((name) => name !== "constructor")
			.sort();

		expect(DELEGATIONS.map(([method]) => method).sort()).toEqual(publicMethods);
	});

	it.each(DELEGATIONS)(
		"%s delegates to the %s sub-service",
		async (method, field, argCount) => {
			const { service, subServices } = createFacade();
			const result = { method };
			subServices[field][method].mockReturnValue(result);
			const args = Array.from({ length: argCount }, (_, i) => ({
				arg: i,
			}));

			const actual = await (
				service as unknown as Record<string, (...a: unknown[]) => unknown>
			)[method](...args);

			expect(actual).toBe(result);
			expect(subServices[field][method]).toHaveBeenCalledTimes(1);
			expect(subServices[field][method]).toHaveBeenCalledWith(...args);
		},
	);
});
