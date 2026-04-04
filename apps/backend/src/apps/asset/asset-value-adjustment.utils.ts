import type { Asset } from "@aria/types";

const CURRENCY_SCALE = 6;
const OPERATIONAL_ASSET_STATUSES = new Set<Asset.AssetStatus>([
	"IN_MAINTENANCE",
	"OUT_OF_ORDER",
]);

const roundCurrency = (value: number): number =>
	Number(value.toFixed(CURRENCY_SCALE));

const clampToZero = (value: number): number => (value < 0 ? 0 : value);

const endOfMonth = (date: Date): Date => {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	next.setMonth(next.getMonth() + 1, 0);
	return next;
};

const addMonths = (date: Date, months: number): Date => {
	const next = new Date(date);
	next.setMonth(next.getMonth() + months);
	return next;
};

export interface BuildDepreciationSchedulePreviewInput {
	adjustmentDate: Date;
	currentAssetValue: number;
	newAssetValue: number;
	purchaseAmount: number;
	openingAccumulatedDepreciation: number;
	bookedDepreciations: number;
	depreciationMethod: Asset.DepreciationMethod | null;
	totalNumberOfDepreciations: number | null;
	frequencyOfDepreciation: number | null;
}

export interface BuildRevaluationEntryLineInput {
	differenceAmount: number;
	fixedAssetAccount: string;
	differenceAccount: string;
	costCenter: string | null;
}

export const deriveFixedAssetAccount = (
	assetCategoryName: string | null | undefined,
): string =>
	assetCategoryName ? `${assetCategoryName} Fixed Asset` : "Fixed Asset";

export const getAssetValueAdjustmentDirection = (
	differenceAmount: number,
): Asset.AssetValueAdjustmentDirection =>
	differenceAmount >= 0 ? "INCREASE" : "DECREASE";

export const getAssetValueAdjustmentResultState = (
	currentStatus: Asset.AssetStatus,
	newAssetValue: number,
): {
	status: Asset.AssetStatus;
	isFullyDepreciated: boolean;
} => {
	const isFullyDepreciated = newAssetValue <= 0;

	if (OPERATIONAL_ASSET_STATUSES.has(currentStatus)) {
		return {
			status: currentStatus,
			isFullyDepreciated,
		};
	}

	if (
		currentStatus === "SUBMITTED" ||
		currentStatus === "PARTIALLY_DEPRECIATED" ||
		currentStatus === "FULLY_DEPRECIATED"
	) {
		return {
			status: isFullyDepreciated
				? "FULLY_DEPRECIATED"
				: "PARTIALLY_DEPRECIATED",
			isFullyDepreciated,
		};
	}

	return {
		status: currentStatus,
		isFullyDepreciated,
	};
};

export const buildRevaluationEntryLines = (
	input: BuildRevaluationEntryLineInput,
): Array<{
	lineType: Asset.AssetRevaluationLineType;
	account: string;
	debitAmount: number;
	creditAmount: number;
	costCenter: string | null;
}> => {
	const amount = roundCurrency(Math.abs(input.differenceAmount));

	if (input.differenceAmount > 0) {
		return [
			{
				lineType: "DEBIT",
				account: input.fixedAssetAccount,
				debitAmount: amount,
				creditAmount: 0,
				costCenter: input.costCenter,
			},
			{
				lineType: "CREDIT",
				account: input.differenceAccount,
				debitAmount: 0,
				creditAmount: amount,
				costCenter: input.costCenter,
			},
		];
	}

	return [
		{
			lineType: "DEBIT",
			account: input.differenceAccount,
			debitAmount: amount,
			creditAmount: 0,
			costCenter: input.costCenter,
		},
		{
			lineType: "CREDIT",
			account: input.fixedAssetAccount,
			debitAmount: 0,
			creditAmount: amount,
			costCenter: input.costCenter,
		},
	];
};

const getPeriodicRate = (
	method: Asset.DepreciationMethod,
	totalNumberOfDepreciations: number,
): number | null => {
	if (totalNumberOfDepreciations <= 0) {
		return null;
	}

	switch (method) {
		case "DOUBLE_DECLINING_BALANCE":
			return Math.min(2 / totalNumberOfDepreciations, 1);
		case "WRITTEN_DOWN_VALUE":
			return Math.min(1 / totalNumberOfDepreciations, 1);
		default:
			return null;
	}
};

export const buildDepreciationSchedulePreview = (
	input: BuildDepreciationSchedulePreviewInput,
): Asset.AssetDepreciationSchedulePreview | null => {
	if (
		!input.depreciationMethod ||
		!input.totalNumberOfDepreciations ||
		!input.frequencyOfDepreciation ||
		input.totalNumberOfDepreciations <= 0 ||
		input.frequencyOfDepreciation <= 0
	) {
		return null;
	}

	const bookedDepreciations = Math.min(
		Math.max(input.bookedDepreciations, 0),
		Math.max(input.totalNumberOfDepreciations - 1, 0),
	);
	const remainingDepreciations = Math.max(
		input.totalNumberOfDepreciations - bookedDepreciations,
		1,
	);
	let remainingValue = roundCurrency(clampToZero(input.newAssetValue));
	let accumulatedDepreciation = roundCurrency(
		Math.max(
			input.openingAccumulatedDepreciation,
			input.purchaseAmount - input.currentAssetValue,
			0,
		),
	);
	let scheduleDate = endOfMonth(input.adjustmentDate);
	const periodicRate = getPeriodicRate(
		input.depreciationMethod,
		input.totalNumberOfDepreciations,
	);

	const entries: Asset.AssetDepreciationSchedulePreviewEntry[] = [];

	for (let sequence = 1; sequence <= remainingDepreciations; sequence += 1) {
		const periodsLeft = remainingDepreciations - sequence + 1;
		let depreciationAmount = 0;

		if (sequence === remainingDepreciations) {
			depreciationAmount = remainingValue;
		} else if (periodicRate !== null) {
			depreciationAmount = roundCurrency(remainingValue * periodicRate);
			if (depreciationAmount <= 0) {
				depreciationAmount = roundCurrency(remainingValue / periodsLeft);
			}
		} else {
			depreciationAmount = roundCurrency(remainingValue / periodsLeft);
		}

		depreciationAmount = Math.min(depreciationAmount, remainingValue);
		remainingValue = roundCurrency(
			clampToZero(remainingValue - depreciationAmount),
		);
		accumulatedDepreciation = roundCurrency(
			accumulatedDepreciation + depreciationAmount,
		);

		entries.push({
			sequence,
			scheduleDate: new Date(scheduleDate),
			depreciationAmount,
			accumulatedDepreciationAmount: accumulatedDepreciation,
			bookValueAfterDepreciation: remainingValue,
		});

		scheduleDate = addMonths(scheduleDate, input.frequencyOfDepreciation);
	}

	return {
		depreciationMethod: input.depreciationMethod,
		totalNumberOfDepreciations: input.totalNumberOfDepreciations,
		frequencyOfDepreciation: input.frequencyOfDepreciation,
		bookedDepreciations,
		remainingDepreciations,
		entries,
	};
};
