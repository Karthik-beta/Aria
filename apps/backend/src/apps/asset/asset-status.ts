/**
 * Asset status engine: the single place that decides which `Asset.status` an
 * asset has. Pure TypeScript (no Prisma, no I/O) so every writer (submit,
 * depreciation posting, value adjustment, maintenance) and the unit tests can
 * share it.
 *
 * Ported from ERPNext (GPLv3), https://github.com/frappe/erpnext:
 * - `erpnext/assets/doctype/asset/asset.py`: `Asset.get_status`,
 *   `Asset.set_status` and `update_maintenance_status`
 * - `erpnext/assets/doctype/asset_maintenance/asset_maintenance.py`:
 *   `AssetMaintenance.after_delete`
 *
 * Only the rules are ported, not the Frappe document model. The statuses
 * `ISSUE`, `RECEIPT`, `CAPITALIZED` and `WORK_IN_PROGRESS` do not exist in the
 * `AssetStatus` enum yet; adding one makes the `Record<AssetStatus, ...>`
 * tables below fail type-checking until the engine decides how to treat it.
 *
 * @module AssetStatus
 */
import type { Asset } from "@aria/types";

const AMOUNT_SCALE = 6;

/** Rounds like the rest of the asset code: `Number(x.toFixed(6))`. */
const roundAmount = (value: number): number =>
	Number(value.toFixed(AMOUNT_SCALE));

/**
 * How the engine treats each status. A `Record` (not a list) so that adding an
 * enum value is a compile error here.
 *
 * - `sticky`: set by an explicit document action (create, cancel, sell, scrap);
 *   the engine never recomputes it.
 * - `depreciation`: derived from the depreciation state (`SUBMITTED`,
 *   `PARTIALLY_DEPRECIATED`, `FULLY_DEPRECIATED`).
 * - `overlay`: an operational state layered over the depreciation state by
 *   maintenance or repair (`IN_MAINTENANCE`, `OUT_OF_ORDER`). Depreciation
 *   keeps running underneath it.
 */
const STATUS_KIND: Record<
	Asset.AssetStatus,
	"sticky" | "depreciation" | "overlay"
> = {
	DRAFT: "sticky",
	CANCELLED: "sticky",
	SOLD: "sticky",
	SCRAPPED: "sticky",
	SUBMITTED: "depreciation",
	PARTIALLY_DEPRECIATED: "depreciation",
	FULLY_DEPRECIATED: "depreciation",
	IN_MAINTENANCE: "overlay",
	OUT_OF_ORDER: "overlay",
};

const statusesOfKind = (
	...kinds: Array<"sticky" | "depreciation" | "overlay">
): readonly Asset.AssetStatus[] =>
	(Object.keys(STATUS_KIND) as Asset.AssetStatus[]).filter((status) =>
		kinds.includes(STATUS_KIND[status]),
	);

/** Operational overlays that never stop depreciation (ERPNext keeps posting). */
export const ASSET_OPERATIONAL_STATUSES: readonly Asset.AssetStatus[] = [
	"IN_MAINTENANCE",
	"OUT_OF_ORDER",
];

/**
 * Statuses in which an asset still takes part in depreciation posting and
 * discovery. `FULLY_DEPRECIATED` is excluded because it has nothing left to post.
 */
export const ASSET_DEPRECIATING_STATUSES: readonly Asset.AssetStatus[] = [
	"SUBMITTED",
	"PARTIALLY_DEPRECIATED",
	"IN_MAINTENANCE",
	"OUT_OF_ORDER",
];

/**
 * Statuses the maintenance job may move between (ERPNext `update_maintenance_status`
 * only looks at submitted, not yet disposed assets).
 */
export const ASSET_MAINTENANCE_ELIGIBLE_STATUSES: readonly Asset.AssetStatus[] =
	statusesOfKind("depreciation", "overlay");

export const isOperationalAssetStatus = (status: Asset.AssetStatus): boolean =>
	STATUS_KIND[status] === "overlay";

export interface DeriveAssetStatusInput {
	currentStatus: Asset.AssetStatus;
	calculateDepreciation: boolean;
	isFullyDepreciated: boolean;
	netPurchaseAmount: number;
	/** Asset level carrying value; used when the asset has no default finance book. */
	valueAfterDepreciation: number;
	/** The company default finance book row (or the first book). */
	defaultBook?: {
		valueAfterDepreciation: number;
		expectedValueAfterUsefulLife: number;
	} | null;
}

/**
 * Port of ERPNext `Asset.get_status` for submitted assets.
 *
 * `DRAFT`, `CANCELLED`, `SOLD` and `SCRAPPED` are terminal and returned as is
 * (ERPNext lets `Scrapped` win over depreciation and keeps `Sold` after
 * `update_maintenance_status`). For every other status the depreciation state
 * decides, so `IN_MAINTENANCE` / `OUT_OF_ORDER` collapse back to their base.
 */
export const deriveAssetStatus = (
	input: DeriveAssetStatusInput,
): Asset.AssetStatus => {
	if (STATUS_KIND[input.currentStatus] === "sticky") {
		return input.currentStatus;
	}

	if (input.calculateDepreciation) {
		// ERPNext: expected value defaults to 0 and the carrying value to the
		// asset level one, then the default finance book row overrides both.
		const valueAfterDepreciation = roundAmount(
			input.defaultBook?.valueAfterDepreciation ?? input.valueAfterDepreciation,
		);
		const expectedValueAfterUsefulLife = roundAmount(
			input.defaultBook?.expectedValueAfterUsefulLife ?? 0,
		);
		if (valueAfterDepreciation <= expectedValueAfterUsefulLife) {
			return "FULLY_DEPRECIATED";
		}
		if (valueAfterDepreciation < roundAmount(input.netPurchaseAmount)) {
			return "PARTIALLY_DEPRECIATED";
		}
		return "SUBMITTED";
	}

	return input.isFullyDepreciated ? "FULLY_DEPRECIATED" : "SUBMITTED";
};

export interface DeriveOperationalStatusInput {
	/** The status from `deriveAssetStatus` (depreciation state, no overlay). */
	base: Asset.AssetStatus;
	hasPendingRepair: boolean;
	hasMaintenanceDueToday: boolean;
	maintenanceRequired: boolean;
}

/**
 * Port of ERPNext `update_maintenance_status` for one asset: a pending repair
 * makes it `OUT_OF_ORDER`, a maintenance task due today makes it
 * `IN_MAINTENANCE`, otherwise it falls back to the derived base status.
 * Assets that are sold, scrapped, draft or cancelled, or that do not require
 * maintenance, keep `base`.
 */
export const deriveOperationalStatus = (
	input: DeriveOperationalStatusInput,
): Asset.AssetStatus => {
	if (
		!input.maintenanceRequired ||
		!ASSET_MAINTENANCE_ELIGIBLE_STATUSES.includes(input.base)
	) {
		return input.base;
	}
	if (input.hasPendingRepair) return "OUT_OF_ORDER";
	if (input.hasMaintenanceDueToday) return "IN_MAINTENANCE";
	return input.base;
};
