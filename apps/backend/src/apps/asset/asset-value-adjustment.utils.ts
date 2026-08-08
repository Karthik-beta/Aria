import type { Asset } from "@aria/types";
import { addDays, addMonths, differenceInDays, endOfMonth } from "date-fns";

const CURRENCY_SCALE = 6;
const OPERATIONAL_ASSET_STATUSES = new Set<Asset.AssetStatus>([
	"IN_MAINTENANCE",
	"OUT_OF_ORDER",
]);

const roundCurrency = (value: number): number =>
	Number(value.toFixed(CURRENCY_SCALE));

const clampToZero = (value: number): number => (value < 0 ? 0 : value);

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
	getFiscalYearEndDate?: (date: Date) => Promise<Date | null>;
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

const getDefaultFiscalYearEndDate = (date: Date): Date => {
	const year = date.getFullYear();
	const month = date.getMonth();
	if (month >= 3) {
		return new Date(year + 1, 2, 31);
	}
	return new Date(year, 2, 31);
};

const getDDBAnnualRate = (
	totalNumberOfDepreciations: number,
	frequencyOfDepreciation: number,
): number => {
	const totalYears =
		(totalNumberOfDepreciations * frequencyOfDepreciation) / 12;
	if (totalYears <= 0) return 0;
	return 2.0 / totalYears;
};

const getWDVAnnualRate = (
	input: BuildDepreciationSchedulePreviewInput,
	currentAssetValue: number,
	pendingYears: number,
): number => {
	if (input.rateOfDepreciation != null && input.rateOfDepreciation > 0) {
		return input.rateOfDepreciation / 100;
	}

	const salvageFloor = currentAssetValue * 0.05;
	const effectiveSalvage = Math.max(
		input.expectedValueAfterUsefulLife ?? 0,
		salvageFloor,
	);
	if (pendingYears <= 0 || currentAssetValue <= 0 || effectiveSalvage <= 0) {
		return 0;
	}
	const ratio = effectiveSalvage / currentAssetValue;
	if (ratio <= 0) return 0;
	return 1 - ratio ** (1.0 / pendingYears);
};

export const buildDepreciationSchedulePreview = async (
	input: BuildDepreciationSchedulePreviewInput,
): Promise<Asset.AssetDepreciationSchedulePreview | null> => {
	if (
		!input.depreciationMethod ||
		!input.totalNumberOfDepreciations ||
		!input.frequencyOfDepreciation ||
		input.totalNumberOfDepreciations <= 0 ||
		input.frequencyOfDepreciation <= 0
	) {
		return null;
	}

	const isManual = input.depreciationMethod === "MANUAL";
	const isSLM = input.depreciationMethod === "STRAIGHT_LINE" || isManual;
	const isWDV = input.depreciationMethod === "WRITTEN_DOWN_VALUE";
	const isDDB = input.depreciationMethod === "DOUBLE_DECLINING_BALANCE";

	const bookedDepreciations = Math.min(
		Math.max(input.bookedDepreciations, 0),
		Math.max(input.totalNumberOfDepreciations - 1, 0),
	);

	let remainingDepreciations = Math.max(
		input.totalNumberOfDepreciations - bookedDepreciations,
		1,
	);

	const expectedSalvage = input.expectedValueAfterUsefulLife ?? 0;
	let scheduleDate = endOfMonth(input.adjustmentDate);

	// Check pro-rata for new asset (row_idx === 0)
	let hasProRata = false;
	let firstPeriodActualDays = 0;
	let firstPeriodStandardDays = 0;

	if (bookedDepreciations === 0) {
		const standardStartDate = addMonths(
			scheduleDate,
			-input.frequencyOfDepreciation,
		);
		firstPeriodStandardDays = differenceInDays(scheduleDate, standardStartDate);
		// Period starts from adjustmentDate (availableForUseDate equivalent for preview)
		firstPeriodActualDays =
			differenceInDays(scheduleDate, input.adjustmentDate) + 1;
		if (firstPeriodActualDays < firstPeriodStandardDays) {
			hasProRata = true;
			remainingDepreciations += 1; // Extra period at the end
		}
	}

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

	let currentFiscalYearEndDate: Date;
	if (input.getFiscalYearEndDate) {
		currentFiscalYearEndDate =
			(await input.getFiscalYearEndDate(scheduleDate)) ??
			getDefaultFiscalYearEndDate(scheduleDate);
	} else {
		currentFiscalYearEndDate = getDefaultFiscalYearEndDate(scheduleDate);
	}

	// Constants for Declining Balance rate
	let annualRate = 0;
	if (isDDB) {
		annualRate = getDDBAnnualRate(
			input.totalNumberOfDepreciations,
			input.frequencyOfDepreciation,
		);
	} else if (isWDV) {
		annualRate = getWDVAnnualRate(
			input,
			input.newAssetValue,
			remainingDepreciations,
		);
	}

	const entries: Asset.AssetDepreciationSchedulePreviewEntry[] = [];
	let carryingValueAtStartOfFY = remainingValue;
	let yearlyAmount = carryingValueAtStartOfFY * annualRate;
	let prevDepreciationAmount = 0;

	let previousScheduleDate = input.adjustmentDate;

	for (let sequence = 1; sequence <= remainingDepreciations; sequence += 1) {
		// Check if fiscal year changed
		let fyChanged = false;
		if (
			sequence > 1 &&
			currentFiscalYearEndDate &&
			scheduleDate > currentFiscalYearEndDate
		) {
			if (input.getFiscalYearEndDate) {
				currentFiscalYearEndDate =
					(await input.getFiscalYearEndDate(scheduleDate)) ??
					getDefaultFiscalYearEndDate(scheduleDate);
			} else {
				currentFiscalYearEndDate = getDefaultFiscalYearEndDate(scheduleDate);
			}
			fyChanged = true;
		}

		const isLastEntry = sequence === remainingDepreciations;
		const periodsLeft = remainingDepreciations - sequence + 1;

		const periodStartDate =
			sequence === 1 ? input.adjustmentDate : addDays(previousScheduleDate, 1);
		const periodEndDate = scheduleDate;
		const daysInPeriod = differenceInDays(periodEndDate, periodStartDate) + 1;

		let depreciationAmount = 0;

		if (isLastEntry) {
			depreciationAmount = pendingDepreciationAmount;
		} else if (isSLM) {
			if (input.dailyProrataBased) {
				const standardPendingMonths =
					remainingDepreciations * input.frequencyOfDepreciation;
				const totalPendingYears = standardPendingMonths / 12;
				const yearlySLMAmount = depreciableValue / totalPendingYears;

				// Get fiscal year containing scheduleDate
				const fyEndDate = currentFiscalYearEndDate;
				const fyStartDate = addDays(addMonths(fyEndDate, -12), 1);
				const totalDaysInFY = differenceInDays(fyEndDate, fyStartDate) + 1;

				const dailyDepr = yearlySLMAmount / totalDaysInFY;
				depreciationAmount = roundCurrency(dailyDepr * daysInPeriod);
			} else {
				depreciationAmount = roundCurrency(
					pendingDepreciationAmount / periodsLeft,
				);
				// If first row and has pro-rata
				if (sequence === 1 && hasProRata && firstPeriodStandardDays > 0) {
					depreciationAmount = roundCurrency(
						(depreciationAmount * firstPeriodActualDays) /
							firstPeriodStandardDays,
					);
				}
			}
		} else if (isWDV || isDDB) {
			if (sequence === 1 || fyChanged) {
				carryingValueAtStartOfFY = remainingValue;
				yearlyAmount = carryingValueAtStartOfFY * annualRate;

				// Re-calculate standard period depreciation amount for non-daily WDV/DDB
				if (!input.dailyProrataBased) {
					prevDepreciationAmount =
						(yearlyAmount * input.frequencyOfDepreciation) / 12;
				}
			}

			if (input.dailyProrataBased) {
				const fyEndDate = currentFiscalYearEndDate;
				const fyStartDate = addDays(addMonths(fyEndDate, -12), 1);
				const totalDaysInFY = differenceInDays(fyEndDate, fyStartDate) + 1;

				const dailyRate = yearlyAmount / totalDaysInFY;
				depreciationAmount = roundCurrency(dailyRate * daysInPeriod);
			} else {
				depreciationAmount = roundCurrency(prevDepreciationAmount);
			}
		}

		if (depreciationAmount <= 0 && !isLastEntry) {
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

		previousScheduleDate = scheduleDate;
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
