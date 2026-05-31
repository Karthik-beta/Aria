import type { Asset } from "@aria/types";

const CURRENCY_SCALE = 6;

const roundCurrency = (value: number): number =>
	Number(value.toFixed(CURRENCY_SCALE));

export interface AssetDepreciationLedgerAssetInput {
	id: string;
	series: string;
	assetName: string;
	company: string;
	purchaseDate: Date | null;
	netPurchaseAmount: number | null;
	status: Asset.AssetStatus;
	assetCategory: {
		id: string;
		name: string;
	} | null;
	adjustments: AssetDepreciationLedgerAdjustmentInput[];
}

export interface AssetDepreciationLedgerAdjustmentInput {
	id: string;
	series: string;
	adjustmentDate: Date;
	costCenter: string | null;
	revaluationEntrySeries: string | null;
	schedule: AssetDepreciationLedgerScheduleInput | null;
}

export interface AssetDepreciationLedgerScheduleInput {
	id: string;
	revisionNumber: number;
	startDate: Date;
	depreciationMethod: Asset.DepreciationMethod | null;
	openingAccumulatedDepreciation: number;
	entries: AssetDepreciationLedgerScheduleEntryInput[];
}

export interface AssetDepreciationLedgerScheduleEntryInput {
	id: string;
	sequence: number;
	scheduleDate: Date;
	depreciationAmount: number;
	accumulatedDepreciationAmount: number;
	bookValueAfterDepreciation: number;
}

export interface BuildAssetDepreciationLedgerResultInput {
	assets: AssetDepreciationLedgerAssetInput[];
	fromDate: Date;
	toDate: Date;
}

export function buildAssetDepreciationLedgerResult(
	input: BuildAssetDepreciationLedgerResultInput,
): Asset.AssetDepreciationLedgerResult {
	const rows: Asset.AssetDepreciationLedgerRow[] = [];
	const assetsWithRows = new Set<string>();
	const latestRowByAsset = new Map<string, Asset.AssetDepreciationLedgerRow>();

	for (const asset of input.assets) {
		const schedules = asset.adjustments
			.filter(
				(
					adjustment,
				): adjustment is AssetDepreciationLedgerAdjustmentInput & {
					schedule: AssetDepreciationLedgerScheduleInput;
				} => adjustment.schedule !== null,
			)
			.sort((left, right) => {
				const byStartDate =
					left.schedule.startDate.getTime() -
					right.schedule.startDate.getTime();
				if (byStartDate !== 0) {
					return byStartDate;
				}

				const byAdjustmentDate =
					left.adjustmentDate.getTime() - right.adjustmentDate.getTime();
				if (byAdjustmentDate !== 0) {
					return byAdjustmentDate;
				}

				return left.schedule.revisionNumber - right.schedule.revisionNumber;
			});

		for (
			let scheduleIndex = 0;
			scheduleIndex < schedules.length;
			scheduleIndex += 1
		) {
			const currentSchedule = schedules[scheduleIndex];
			const nextSchedule = schedules[scheduleIndex + 1];
			const nextStartDate = nextSchedule?.schedule.startDate ?? null;
			const entries = [...currentSchedule.schedule.entries].sort(
				(left, right) => {
					const bySequence = left.sequence - right.sequence;
					if (bySequence !== 0) {
						return bySequence;
					}

					return left.scheduleDate.getTime() - right.scheduleDate.getTime();
				},
			);

			for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
				const entry = entries[entryIndex];

				if (
					entry.scheduleDate.getTime() < input.fromDate.getTime() ||
					entry.scheduleDate.getTime() > input.toDate.getTime()
				) {
					continue;
				}

				if (
					nextStartDate &&
					entry.scheduleDate.getTime() >= nextStartDate.getTime()
				) {
					continue;
				}

				const previousEntry = entries[entryIndex - 1];
				const openingAccumulatedDepreciation = previousEntry
					? previousEntry.accumulatedDepreciationAmount
					: currentSchedule.schedule.openingAccumulatedDepreciation;

				const row: Asset.AssetDepreciationLedgerRow = {
					assetId: asset.id,
					assetSeries: asset.series,
					assetName: asset.assetName,
					assetCategoryId: asset.assetCategory?.id ?? null,
					assetCategoryName: asset.assetCategory?.name ?? null,
					company: asset.company,
					purchaseDate: asset.purchaseDate,
					purchaseAmount: asset.netPurchaseAmount,
					depreciationDate: entry.scheduleDate,
					openingAccumulatedDepreciation: roundCurrency(
						openingAccumulatedDepreciation,
					),
					depreciationAmount: roundCurrency(entry.depreciationAmount),
					accumulatedDepreciationAmount: roundCurrency(
						entry.accumulatedDepreciationAmount,
					),
					valueAfterDepreciation: roundCurrency(
						entry.bookValueAfterDepreciation,
					),
					adjustmentId: currentSchedule.id,
					adjustmentSeries: currentSchedule.series,
					adjustmentDate: currentSchedule.adjustmentDate,
					revaluationEntrySeries: currentSchedule.revaluationEntrySeries,
					scheduleId: currentSchedule.schedule.id,
					scheduleRevisionNumber: currentSchedule.schedule.revisionNumber,
					costCenter: currentSchedule.costCenter,
					depreciationMethod: currentSchedule.schedule.depreciationMethod,
					assetStatus: asset.status,
				};

				rows.push(row);
				assetsWithRows.add(asset.id);
				latestRowByAsset.set(asset.id, row);
			}
		}
	}

	rows.sort((left, right) => {
		const byDate =
			right.depreciationDate.getTime() - left.depreciationDate.getTime();
		if (byDate !== 0) {
			return byDate;
		}

		const byAsset = left.assetSeries.localeCompare(right.assetSeries);
		if (byAsset !== 0) {
			return byAsset;
		}

		return right.scheduleRevisionNumber - left.scheduleRevisionNumber;
	});

	const totalDepreciationAmount = roundCurrency(
		rows.reduce((sum, row) => sum + row.depreciationAmount, 0),
	);
	const closingValueTotal = roundCurrency(
		Array.from(latestRowByAsset.values()).reduce(
			(sum, row) => sum + row.valueAfterDepreciation,
			0,
		),
	);

	return {
		rows,
		summary: {
			matchedAssetCount: input.assets.length,
			assetsWithLedgerCount: assetsWithRows.size,
			assetsWithoutLedgerCount: Math.max(
				input.assets.length - assetsWithRows.size,
				0,
			),
			rowCount: rows.length,
			totalDepreciationAmount,
			closingValueTotal,
		},
	};
}
