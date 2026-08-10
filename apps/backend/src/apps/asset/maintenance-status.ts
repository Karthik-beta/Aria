/**
 * Centralized precedence for maintenance-driven Asset status transitions.
 *
 * Repairs take precedence over scheduled maintenance. Once both kinds of
 * work are closed, the asset returns to the operational/depreciation status
 * that was in effect before maintenance began.
 */
export type RestorableAssetStatus =
	| "SUBMITTED"
	| "PARTIALLY_DEPRECIATED"
	| "FULLY_DEPRECIATED";

export type MaintenanceStatusContext = {
	hasOpenRepair: boolean;
	hasDueMaintenance: boolean;
	restoredStatus: RestorableAssetStatus;
};

export function resolveMaintenanceAssetStatus({
	hasOpenRepair,
	hasDueMaintenance,
	restoredStatus,
}: MaintenanceStatusContext):
	| RestorableAssetStatus
	| "IN_MAINTENANCE"
	| "OUT_OF_ORDER" {
	if (hasOpenRepair) return "OUT_OF_ORDER";
	if (hasDueMaintenance) return "IN_MAINTENANCE";
	return restoredStatus;
}

/**
 * Derives the non-maintenance status when a scheduler must restore an asset
 * that was previously marked IN_MAINTENANCE or OUT_OF_ORDER.
 */
export function inferRestoredAssetStatus(input: {
	isFullyDepreciated: boolean;
	valueAfterDepreciation: unknown;
	netPurchaseAmount?: unknown;
	hasPostedDepreciation: boolean;
}): RestorableAssetStatus {
	if (
		input.isFullyDepreciated ||
		(input.valueAfterDepreciation != null &&
			Number(input.valueAfterDepreciation) <= 0)
	) {
		return "FULLY_DEPRECIATED";
	}
	const carryingValue = Number(input.valueAfterDepreciation);
	const originalValue = Number(input.netPurchaseAmount);
	return input.hasPostedDepreciation ||
		(Number.isFinite(originalValue) && carryingValue < originalValue)
		? "PARTIALLY_DEPRECIATED"
		: "SUBMITTED";
}
