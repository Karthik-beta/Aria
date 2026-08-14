import type { Asset, DateOnly } from "@aria/types";
import { addDateOnly } from "@aria/types";

const CURRENCY_SCALE = 6;

const roundCurrency = (value: number): number =>
	Number(value.toFixed(CURRENCY_SCALE));

const addCurrency = (current: number, delta: number): number =>
	roundCurrency(current + delta);

const isInDateRange = (
	value: DateOnly,
	fromDate: DateOnly,
	endExclusive: DateOnly,
): boolean => value >= fromDate && value < endExclusive;

export interface AssetDepreciationsAndBalancesAssetInput {
	id: string;
	series: string;
	assetName: string;
	company: string;
	purchaseDate: DateOnly;
	disposalDate: DateOnly | null;
	netPurchaseAmount: number;
	openingAccumulatedDepreciation: number;
	status: Asset.AssetStatus;
	assetCategory: {
		id: string;
		name: string;
	} | null;
	adjustments: AssetDepreciationsAndBalancesAdjustmentInput[];
}

export interface AssetDepreciationsAndBalancesAdjustmentInput {
	id: string;
	adjustmentDate: DateOnly;
	differenceAmount: number;
	schedule: AssetDepreciationsAndBalancesScheduleInput | null;
}

export interface AssetDepreciationsAndBalancesScheduleInput {
	id: string;
	revisionNumber: number;
	startDate: DateOnly;
	openingAccumulatedDepreciation: number;
	entries: AssetDepreciationsAndBalancesScheduleEntryInput[];
}

export interface AssetDepreciationsAndBalancesScheduleEntryInput {
	id: string;
	sequence: number;
	scheduleDate: DateOnly;
	depreciationAmount: number;
	accumulatedDepreciationAmount: number;
	bookValueAfterDepreciation: number;
}

export interface BuildAssetDepreciationsAndBalancesResultInput {
	assets: AssetDepreciationsAndBalancesAssetInput[];
	fromDate: DateOnly;
	/** Exclusive calendar-date boundary for the inclusive report range. */
	endExclusive: DateOnly;
	groupBy: Asset.AssetDepreciationsAndBalancesGroupBy;
}

type ScheduleAdjustment = AssetDepreciationsAndBalancesAdjustmentInput & {
	schedule: AssetDepreciationsAndBalancesScheduleInput;
};

type AssetBalanceMetrics = Pick<
	Asset.AssetDepreciationsAndBalancesRow,
	| "valueAsOnFromDate"
	| "valueOfNewPurchase"
	| "valueOfSoldAsset"
	| "valueOfScrappedAsset"
	| "valueOfCapitalizedAsset"
	| "valueAdjustmentDuringPeriod"
	| "valueAsOnToDate"
	| "accumulatedDepreciationAsOnFromDate"
	| "depreciationAmountDuringPeriod"
	| "depreciationEliminatedDuringPeriod"
	| "accumulatedDepreciationAsOnToDate"
	| "depreciationEliminatedViaReversal"
	| "netAssetValueAsOnFromDate"
	| "netAssetValueAsOnToDate"
>;

const compareScheduleAdjustments = (
	left: ScheduleAdjustment,
	right: ScheduleAdjustment,
): number => {
	const byStartDate = left.schedule.startDate.localeCompare(
		right.schedule.startDate,
	);
	if (byStartDate !== 0) {
		return byStartDate;
	}

	const byAdjustmentDate = left.adjustmentDate.localeCompare(
		right.adjustmentDate,
	);
	if (byAdjustmentDate !== 0) {
		return byAdjustmentDate;
	}

	return left.schedule.revisionNumber - right.schedule.revisionNumber;
};

const compareScheduleEntries = (
	left: AssetDepreciationsAndBalancesScheduleEntryInput,
	right: AssetDepreciationsAndBalancesScheduleEntryInput,
): number => {
	const bySequence = left.sequence - right.sequence;
	if (bySequence !== 0) {
		return bySequence;
	}

	return left.scheduleDate.localeCompare(right.scheduleDate);
};

function getScheduleAdjustments(
	asset: AssetDepreciationsAndBalancesAssetInput,
): ScheduleAdjustment[] {
	return asset.adjustments
		.filter(
			(
				adjustment,
			): adjustment is AssetDepreciationsAndBalancesAdjustmentInput & {
				schedule: AssetDepreciationsAndBalancesScheduleInput;
			} => adjustment.schedule !== null,
		)
		.sort(compareScheduleAdjustments);
}

function getAccumulatedDepreciation(
	asset: AssetDepreciationsAndBalancesAssetInput,
	asOfDate: DateOnly,
	inclusive: boolean,
): number {
	const isIncluded = (value: DateOnly): boolean =>
		inclusive ? value <= asOfDate : value < asOfDate;

	if (!isIncluded(asset.purchaseDate)) {
		return 0;
	}

	const schedules = getScheduleAdjustments(asset).filter((adjustment) =>
		isIncluded(adjustment.schedule.startDate),
	);

	if (schedules.length === 0) {
		return roundCurrency(asset.openingAccumulatedDepreciation);
	}

	const currentSchedule = schedules[schedules.length - 1].schedule;
	const matchingEntries = [...currentSchedule.entries]
		.sort(compareScheduleEntries)
		.filter((entry) => isIncluded(entry.scheduleDate));

	if (matchingEntries.length === 0) {
		return roundCurrency(currentSchedule.openingAccumulatedDepreciation);
	}

	return roundCurrency(
		matchingEntries[matchingEntries.length - 1].accumulatedDepreciationAmount,
	);
}

function getAccumulatedDepreciationAsOf(
	asset: AssetDepreciationsAndBalancesAssetInput,
	asOfDate: DateOnly,
): number {
	return getAccumulatedDepreciation(asset, asOfDate, true);
}

function getAccumulatedDepreciationBefore(
	asset: AssetDepreciationsAndBalancesAssetInput,
	boundaryDate: DateOnly,
): number {
	return getAccumulatedDepreciation(asset, boundaryDate, false);
}

function getDepreciationAmountDuringPeriod(
	asset: AssetDepreciationsAndBalancesAssetInput,
	fromDate: DateOnly,
	endExclusive: DateOnly,
): number {
	const effectiveEndExclusive =
		asset.disposalDate && asset.disposalDate < endExclusive
			? addDateOnly(asset.disposalDate, 1)
			: endExclusive;

	if (effectiveEndExclusive <= fromDate) {
		return 0;
	}

	let depreciationAmount = 0;
	const schedules = getScheduleAdjustments(asset);

	for (
		let scheduleIndex = 0;
		scheduleIndex < schedules.length;
		scheduleIndex += 1
	) {
		const currentSchedule = schedules[scheduleIndex];
		const nextSchedule = schedules[scheduleIndex + 1];
		const nextStartDate = nextSchedule?.schedule.startDate ?? null;

		for (const entry of [...currentSchedule.schedule.entries].sort(
			compareScheduleEntries,
		)) {
			if (!isInDateRange(entry.scheduleDate, fromDate, effectiveEndExclusive)) {
				continue;
			}

			if (nextStartDate && entry.scheduleDate >= nextStartDate) {
				continue;
			}

			depreciationAmount = addCurrency(
				depreciationAmount,
				entry.depreciationAmount,
			);
		}
	}

	return depreciationAmount;
}

function getValueAdjustments(
	asset: AssetDepreciationsAndBalancesAssetInput,
	fromDate: DateOnly,
	endExclusive: DateOnly,
): {
	adjustmentBeforeFromDate: number;
	adjustmentDuringPeriod: number;
} {
	let adjustmentBeforeFromDate = 0;
	let adjustmentTillToDate = 0;

	for (const adjustment of [...asset.adjustments].sort((left, right) => {
		const byAdjustmentDate = left.adjustmentDate.localeCompare(
			right.adjustmentDate,
		);
		if (byAdjustmentDate !== 0) {
			return byAdjustmentDate;
		}

		return left.id.localeCompare(right.id);
	})) {
		if (asset.disposalDate && adjustment.adjustmentDate > asset.disposalDate) {
			continue;
		}

		if (adjustment.adjustmentDate < fromDate) {
			adjustmentBeforeFromDate = addCurrency(
				adjustmentBeforeFromDate,
				adjustment.differenceAmount,
			);
		}

		if (adjustment.adjustmentDate < endExclusive) {
			adjustmentTillToDate = addCurrency(
				adjustmentTillToDate,
				adjustment.differenceAmount,
			);
		}
	}

	return {
		adjustmentBeforeFromDate,
		adjustmentDuringPeriod: roundCurrency(
			adjustmentTillToDate - adjustmentBeforeFromDate,
		),
	};
}

function hasReportPresence(
	asset: AssetDepreciationsAndBalancesAssetInput,
	fromDate: DateOnly,
	endExclusive: DateOnly,
): boolean {
	if (asset.status === "DRAFT" || asset.status === "CANCELLED") {
		return false;
	}

	const activeAtPeriodStart =
		asset.purchaseDate < fromDate &&
		(!asset.disposalDate || asset.disposalDate >= fromDate);
	const purchasedDuringPeriod = isInDateRange(
		asset.purchaseDate,
		fromDate,
		endExclusive,
	);
	const disposedDuringPeriod =
		asset.disposalDate !== null &&
		isInDateRange(asset.disposalDate, fromDate, endExclusive);

	return activeAtPeriodStart || purchasedDuringPeriod || disposedDuringPeriod;
}

function buildAssetBalanceMetrics(
	asset: AssetDepreciationsAndBalancesAssetInput,
	fromDate: DateOnly,
	endExclusive: DateOnly,
): AssetBalanceMetrics | null {
	if (!hasReportPresence(asset, fromDate, endExclusive)) {
		return null;
	}

	const purchaseAmount = roundCurrency(asset.netPurchaseAmount);
	const activeAtPeriodStart =
		asset.purchaseDate < fromDate &&
		(!asset.disposalDate || asset.disposalDate >= fromDate);
	const purchasedDuringPeriod = isInDateRange(
		asset.purchaseDate,
		fromDate,
		endExclusive,
	);
	const disposedDuringPeriod =
		asset.disposalDate !== null &&
		isInDateRange(asset.disposalDate, fromDate, endExclusive);
	const soldDuringPeriod = disposedDuringPeriod && asset.status === "SOLD";
	const scrappedDuringPeriod =
		disposedDuringPeriod && asset.status === "SCRAPPED";
	const { adjustmentBeforeFromDate, adjustmentDuringPeriod } =
		getValueAdjustments(asset, fromDate, endExclusive);

	const valueAsOnFromDate = activeAtPeriodStart
		? roundCurrency(purchaseAmount + adjustmentBeforeFromDate)
		: 0;
	const valueOfNewPurchase = purchasedDuringPeriod ? purchaseAmount : 0;
	const valueOfSoldAsset = soldDuringPeriod ? purchaseAmount : 0;
	const valueOfScrappedAsset = scrappedDuringPeriod ? purchaseAmount : 0;
	const valueOfCapitalizedAsset = 0;
	const accumulatedDepreciationAsOnFromDate = activeAtPeriodStart
		? getAccumulatedDepreciationBefore(asset, fromDate)
		: 0;
	const depreciationAmountDuringPeriod = getDepreciationAmountDuringPeriod(
		asset,
		fromDate,
		endExclusive,
	);
	const depreciationEliminatedDuringPeriod =
		disposedDuringPeriod && asset.disposalDate
			? getAccumulatedDepreciationAsOf(asset, asset.disposalDate)
			: 0;
	const depreciationEliminatedViaReversal = 0;
	const valueAsOnToDate = roundCurrency(
		valueAsOnFromDate +
			valueOfNewPurchase -
			valueOfSoldAsset -
			valueOfScrappedAsset -
			valueOfCapitalizedAsset +
			adjustmentDuringPeriod,
	);
	const accumulatedDepreciationAsOnToDate = roundCurrency(
		accumulatedDepreciationAsOnFromDate +
			depreciationAmountDuringPeriod -
			depreciationEliminatedDuringPeriod -
			depreciationEliminatedViaReversal,
	);

	return {
		valueAsOnFromDate,
		valueOfNewPurchase,
		valueOfSoldAsset,
		valueOfScrappedAsset,
		valueOfCapitalizedAsset,
		valueAdjustmentDuringPeriod: adjustmentDuringPeriod,
		valueAsOnToDate,
		accumulatedDepreciationAsOnFromDate,
		depreciationAmountDuringPeriod,
		depreciationEliminatedDuringPeriod,
		accumulatedDepreciationAsOnToDate,
		depreciationEliminatedViaReversal,
		netAssetValueAsOnFromDate: roundCurrency(
			valueAsOnFromDate - accumulatedDepreciationAsOnFromDate,
		),
		netAssetValueAsOnToDate: roundCurrency(
			valueAsOnToDate - accumulatedDepreciationAsOnToDate,
		),
	};
}

function createRow(
	asset: AssetDepreciationsAndBalancesAssetInput,
	groupBy: Asset.AssetDepreciationsAndBalancesGroupBy,
): Asset.AssetDepreciationsAndBalancesRow {
	if (groupBy === "ASSET") {
		return {
			groupingKey: asset.id,
			groupingLabel: asset.series,
			company: asset.company,
			assetCount: 0,
			assetId: asset.id,
			assetSeries: asset.series,
			assetName: asset.assetName,
			assetCategoryId: asset.assetCategory?.id ?? null,
			assetCategoryName: asset.assetCategory?.name ?? null,
			valueAsOnFromDate: 0,
			valueOfNewPurchase: 0,
			valueOfSoldAsset: 0,
			valueOfScrappedAsset: 0,
			valueOfCapitalizedAsset: 0,
			valueAdjustmentDuringPeriod: 0,
			valueAsOnToDate: 0,
			accumulatedDepreciationAsOnFromDate: 0,
			depreciationAmountDuringPeriod: 0,
			depreciationEliminatedDuringPeriod: 0,
			accumulatedDepreciationAsOnToDate: 0,
			depreciationEliminatedViaReversal: 0,
			netAssetValueAsOnFromDate: 0,
			netAssetValueAsOnToDate: 0,
		};
	}

	return {
		groupingKey: `${asset.company}::${asset.assetCategory?.id ?? "uncategorized"}`,
		groupingLabel: asset.assetCategory?.name ?? "Uncategorized",
		company: asset.company,
		assetCount: 0,
		assetId: null,
		assetSeries: null,
		assetName: null,
		assetCategoryId: asset.assetCategory?.id ?? null,
		assetCategoryName: asset.assetCategory?.name ?? null,
		valueAsOnFromDate: 0,
		valueOfNewPurchase: 0,
		valueOfSoldAsset: 0,
		valueOfScrappedAsset: 0,
		valueOfCapitalizedAsset: 0,
		valueAdjustmentDuringPeriod: 0,
		valueAsOnToDate: 0,
		accumulatedDepreciationAsOnFromDate: 0,
		depreciationAmountDuringPeriod: 0,
		depreciationEliminatedDuringPeriod: 0,
		accumulatedDepreciationAsOnToDate: 0,
		depreciationEliminatedViaReversal: 0,
		netAssetValueAsOnFromDate: 0,
		netAssetValueAsOnToDate: 0,
	};
}

export function buildAssetDepreciationsAndBalancesResult(
	input: BuildAssetDepreciationsAndBalancesResultInput,
): Asset.AssetDepreciationsAndBalancesResult {
	const rowsByGroup = new Map<string, Asset.AssetDepreciationsAndBalancesRow>();
	let matchedAssetCount = 0;

	for (const asset of input.assets) {
		const metrics = buildAssetBalanceMetrics(
			asset,
			input.fromDate,
			input.endExclusive,
		);
		if (!metrics) {
			continue;
		}

		matchedAssetCount += 1;
		const groupKey =
			input.groupBy === "ASSET"
				? asset.id
				: `${asset.company}::${asset.assetCategory?.id ?? "uncategorized"}`;
		const currentRow =
			rowsByGroup.get(groupKey) ?? createRow(asset, input.groupBy);

		currentRow.assetCount += 1;
		currentRow.valueAsOnFromDate = addCurrency(
			currentRow.valueAsOnFromDate,
			metrics.valueAsOnFromDate,
		);
		currentRow.valueOfNewPurchase = addCurrency(
			currentRow.valueOfNewPurchase,
			metrics.valueOfNewPurchase,
		);
		currentRow.valueOfSoldAsset = addCurrency(
			currentRow.valueOfSoldAsset,
			metrics.valueOfSoldAsset,
		);
		currentRow.valueOfScrappedAsset = addCurrency(
			currentRow.valueOfScrappedAsset,
			metrics.valueOfScrappedAsset,
		);
		currentRow.valueOfCapitalizedAsset = addCurrency(
			currentRow.valueOfCapitalizedAsset,
			metrics.valueOfCapitalizedAsset,
		);
		currentRow.valueAdjustmentDuringPeriod = addCurrency(
			currentRow.valueAdjustmentDuringPeriod,
			metrics.valueAdjustmentDuringPeriod,
		);
		currentRow.valueAsOnToDate = addCurrency(
			currentRow.valueAsOnToDate,
			metrics.valueAsOnToDate,
		);
		currentRow.accumulatedDepreciationAsOnFromDate = addCurrency(
			currentRow.accumulatedDepreciationAsOnFromDate,
			metrics.accumulatedDepreciationAsOnFromDate,
		);
		currentRow.depreciationAmountDuringPeriod = addCurrency(
			currentRow.depreciationAmountDuringPeriod,
			metrics.depreciationAmountDuringPeriod,
		);
		currentRow.depreciationEliminatedDuringPeriod = addCurrency(
			currentRow.depreciationEliminatedDuringPeriod,
			metrics.depreciationEliminatedDuringPeriod,
		);
		currentRow.accumulatedDepreciationAsOnToDate = addCurrency(
			currentRow.accumulatedDepreciationAsOnToDate,
			metrics.accumulatedDepreciationAsOnToDate,
		);
		currentRow.depreciationEliminatedViaReversal = addCurrency(
			currentRow.depreciationEliminatedViaReversal,
			metrics.depreciationEliminatedViaReversal,
		);
		currentRow.netAssetValueAsOnFromDate = addCurrency(
			currentRow.netAssetValueAsOnFromDate,
			metrics.netAssetValueAsOnFromDate,
		);
		currentRow.netAssetValueAsOnToDate = addCurrency(
			currentRow.netAssetValueAsOnToDate,
			metrics.netAssetValueAsOnToDate,
		);

		rowsByGroup.set(groupKey, currentRow);
	}

	const rows = Array.from(rowsByGroup.values()).sort((left, right) =>
		left.groupingLabel.localeCompare(right.groupingLabel),
	);

	return {
		rows,
		summary: {
			matchedAssetCount,
			rowCount: rows.length,
			totalValueAsOnFromDate: roundCurrency(
				rows.reduce((sum, row) => sum + row.valueAsOnFromDate, 0),
			),
			totalValueAsOnToDate: roundCurrency(
				rows.reduce((sum, row) => sum + row.valueAsOnToDate, 0),
			),
			totalNetAssetValueAsOnFromDate: roundCurrency(
				rows.reduce((sum, row) => sum + row.netAssetValueAsOnFromDate, 0),
			),
			totalNetAssetValueAsOnToDate: roundCurrency(
				rows.reduce((sum, row) => sum + row.netAssetValueAsOnToDate, 0),
			),
			totalDepreciationAmountDuringPeriod: roundCurrency(
				rows.reduce((sum, row) => sum + row.depreciationAmountDuringPeriod, 0),
			),
			totalValueAdjustmentDuringPeriod: roundCurrency(
				rows.reduce((sum, row) => sum + row.valueAdjustmentDuringPeriod, 0),
			),
		},
	};
}
