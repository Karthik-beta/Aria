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

const addYears = (date: Date, years: number): Date => {
	const next = new Date(date);
	next.setFullYear(next.getFullYear() + years);
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
	dailyProrataBased?: boolean | null;
	shiftBased?: boolean | null;
	rateOfDepreciation?: number | null;
	expectedValueAfterUsefulLife?: number | null;
	companyId?: string;
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

const _getPeriodicRate = (
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

const _getTotalDaysInYear = (date: Date): number => {
	const year = date.getFullYear();
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
};

const _getDaysBetween = (start: Date, end: Date): number => {
	const msPerDay = 24 * 60 * 60 * 1000;
	return Math.round((end.getTime() - start.getTime()) / msPerDay);
};

const calculateWDVSlopeRate = (
	expectedValue: number,
	currentValue: number,
	pendingYears: number,
): number => {
	if (pendingYears <= 0 || currentValue <= 0) return 0;
	const ratio = expectedValue / currentValue;
	if (ratio <= 0) return 0;
	return 100 * (1 - ratio ** (1.0 / pendingYears));
};

const getDDBAnnualRate = (
	totalNumberOfDepreciations: number,
	frequencyOfDepreciation: number,
): number => {
	const totalYears =
		(totalNumberOfDepreciations * frequencyOfDepreciation) / 12;
	if (totalYears <= 0) return 0;
	return (200 / totalYears) * (frequencyOfDepreciation / 12);
};

const getWDVAnnualRate = (
	input: BuildDepreciationSchedulePreviewInput,
	depreciableValue: number,
	remainingDepreciations: number,
): number => {
	if (input.rateOfDepreciation != null && input.rateOfDepreciation > 0) {
		return input.rateOfDepreciation / 100;
	}

	const expectedValue = input.expectedValueAfterUsefulLife ?? 0;
	const pendingYears =
		(remainingDepreciations * (input.frequencyOfDepreciation ?? 12)) / 12;
	return (
		calculateWDVSlopeRate(expectedValue, depreciableValue, pendingYears) / 100
	);
};

const getDefaultIndiaFiscalYearEnd = (date: Date): Date => {
	const month = date.getMonth();
	const year = date.getFullYear();
	let fyStartYear: number;
	if (month >= 3) {
		fyStartYear = year;
	} else {
		fyStartYear = year - 1;
	}
	return new Date(fyStartYear + 1, 2, 31);
};

interface FiscalYearContext {
	currentFiscalYearEndDate: Date | null;
}

const detectFiscalYearChange = (
	scheduleDate: Date,
	ctx: FiscalYearContext,
): boolean => {
	if (!ctx.currentFiscalYearEndDate) {
		ctx.currentFiscalYearEndDate = getDefaultIndiaFiscalYearEnd(scheduleDate);
		return true;
	}

	if (scheduleDate > ctx.currentFiscalYearEndDate) {
		ctx.currentFiscalYearEndDate = addYears(ctx.currentFiscalYearEndDate, 1);
		return true;
	}

	return false;
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

	if (input.depreciationMethod === "MANUAL") {
		const bookedDepreciations = Math.min(
			Math.max(input.bookedDepreciations, 0),
			Math.max(input.totalNumberOfDepreciations - 1, 0),
		);
		const remainingDepreciations = Math.max(
			input.totalNumberOfDepreciations - bookedDepreciations,
			1,
		);
		return {
			depreciationMethod: input.depreciationMethod,
			totalNumberOfDepreciations: input.totalNumberOfDepreciations,
			frequencyOfDepreciation: input.frequencyOfDepreciation,
			dailyProrataBased: input.dailyProrataBased ?? null,
			shiftBased: input.shiftBased ?? null,
			rateOfDepreciation: input.rateOfDepreciation ?? null,
			expectedValueAfterUsefulLife: input.expectedValueAfterUsefulLife ?? null,
			bookedDepreciations,
			remainingDepreciations,
			entries: [],
		};
	}

	const bookedDepreciations = Math.min(
		Math.max(input.bookedDepreciations, 0),
		Math.max(input.totalNumberOfDepreciations - 1, 0),
	);
	const remainingDepreciations = Math.max(
		input.totalNumberOfDepreciations - bookedDepreciations,
		1,
	);

	const expectedSalvage = input.expectedValueAfterUsefulLife ?? 0;
	const depreciableValue = roundCurrency(
		clampToZero(input.newAssetValue - expectedSalvage),
	);
	let remainingValue = roundCurrency(clampToZero(input.newAssetValue));
	let pendingDepreciationAmount = depreciableValue;

	let accumulatedDepreciation = roundCurrency(
		Math.max(
			input.openingAccumulatedDepreciation,
			input.purchaseAmount - input.currentAssetValue,
			0,
		),
	);
	let scheduleDate = endOfMonth(input.adjustmentDate);

	const fyContext: FiscalYearContext = {
		currentFiscalYearEndDate: null,
	};

	const entries: Asset.AssetDepreciationSchedulePreviewEntry[] = [];

	for (let sequence = 1; sequence <= remainingDepreciations; sequence += 1) {
		const periodsLeft = remainingDepreciations - sequence + 1;
		let depreciationAmount = 0;

		const isLastEntry = sequence === remainingDepreciations;

		if (isLastEntry) {
			depreciationAmount = pendingDepreciationAmount;
		} else if (input.depreciationMethod === "STRAIGHT_LINE") {
			depreciationAmount = roundCurrency(
				pendingDepreciationAmount / periodsLeft,
			);
		} else if (
			input.depreciationMethod === "DOUBLE_DECLINING_BALANCE" ||
			input.depreciationMethod === "WRITTEN_DOWN_VALUE"
		) {
			const isDDB = input.depreciationMethod === "DOUBLE_DECLINING_BALANCE";
			const annualRate = isDDB
				? getDDBAnnualRate(
						input.totalNumberOfDepreciations,
						input.frequencyOfDepreciation,
					)
				: getWDVAnnualRate(input, pendingDepreciationAmount, periodsLeft);
			const periodRate = (annualRate * input.frequencyOfDepreciation) / 12;
			depreciationAmount = roundCurrency(
				pendingDepreciationAmount * periodRate,
			);

			if (depreciationAmount <= 0) {
				break;
			}

			const fyChanged = detectFiscalYearChange(scheduleDate, fyContext);
			if (fyChanged && remainingValue > 0) {
				pendingDepreciationAmount = remainingValue;
			}
		}

		if (depreciationAmount <= 0) {
			break;
		}

		depreciationAmount = Math.min(
			depreciationAmount,
			pendingDepreciationAmount,
		);

		if (isLastEntry && input.expectedValueAfterUsefulLife != null) {
			const targetValue = input.expectedValueAfterUsefulLife;
			if (Math.abs(remainingValue - targetValue) > 0.001) {
				depreciationAmount = roundCurrency(
					clampToZero(remainingValue - targetValue),
				);
				remainingValue = targetValue;
				pendingDepreciationAmount = targetValue;
			}
		} else {
			remainingValue = roundCurrency(
				clampToZero(remainingValue - depreciationAmount),
			);
			pendingDepreciationAmount = roundCurrency(
				clampToZero(pendingDepreciationAmount - depreciationAmount),
			);
		}

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
		dailyProrataBased: input.dailyProrataBased ?? null,
		shiftBased: input.shiftBased ?? null,
		rateOfDepreciation: input.rateOfDepreciation ?? null,
		expectedValueAfterUsefulLife: input.expectedValueAfterUsefulLife ?? null,
		bookedDepreciations,
		remainingDepreciations,
		entries,
	};
};
