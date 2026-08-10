import {
	inferRestoredAssetStatus,
	resolveMaintenanceAssetStatus,
} from "../maintenance-status";

describe("maintenance status precedence", () => {
	it("always prioritizes an open repair over scheduled maintenance", () => {
		expect(
			resolveMaintenanceAssetStatus({
				hasOpenRepair: true,
				hasDueMaintenance: true,
				restoredStatus: "PARTIALLY_DEPRECIATED",
			}),
		).toBe("OUT_OF_ORDER");
	});

	it("marks an asset in maintenance when no repair is open", () => {
		expect(
			resolveMaintenanceAssetStatus({
				hasOpenRepair: false,
				hasDueMaintenance: true,
				restoredStatus: "SUBMITTED",
			}),
		).toBe("IN_MAINTENANCE");
	});

	it("restores the prior operational status when all work is closed", () => {
		expect(
			resolveMaintenanceAssetStatus({
				hasOpenRepair: false,
				hasDueMaintenance: false,
				restoredStatus: "FULLY_DEPRECIATED",
			}),
		).toBe("FULLY_DEPRECIATED");
	});

	it("infers full depreciation from a zero carrying value", () => {
		expect(
			inferRestoredAssetStatus({
				isFullyDepreciated: false,
				valueAfterDepreciation: "0.000000",
				hasPostedDepreciation: true,
			}),
		).toBe("FULLY_DEPRECIATED");
	});

	it("infers partial depreciation from posted entries", () => {
		expect(
			inferRestoredAssetStatus({
				isFullyDepreciated: false,
				valueAfterDepreciation: 500,
				hasPostedDepreciation: true,
			}),
		).toBe("PARTIALLY_DEPRECIATED");
	});

	it("infers opening partial depreciation without a posted journal yet", () => {
		expect(
			inferRestoredAssetStatus({
				isFullyDepreciated: false,
				valueAfterDepreciation: 500,
				netPurchaseAmount: 1000,
				hasPostedDepreciation: false,
			}),
		).toBe("PARTIALLY_DEPRECIATED");
	});
});
