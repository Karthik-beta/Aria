import type { Asset } from "@aria/types";
import {
	addDateOnlyUtc,
	addMonthsDateOnly,
	dateOnlyFromPersistedDateTime,
	dateOnlyUtc,
	differenceInDateOnlyDays,
	endOfMonthDateOnly,
} from "./depreciation/depreciation.config";
import { createDepreciationCalendar } from "./depreciation/depreciation-calendar";
import {
	assertSupportedDepreciationOptions,
	buildDepreciationSchedule,
	type FiscalYearRange,
} from "./depreciation/depreciation-schedule-engine";

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
	/** Persisted date-only start used by the engine; omitted callers retain the legacy month-end default. */
	depreciationStartDate?: Date;
	dailyProrataBased?: boolean | null;
	shiftBased?: boolean | null;
	precision?: number;
	ratePrecision?: number;
	calculateUsingTotalDays?: boolean;
	shiftAllocations?: Asset.AssetShiftAllocation[];
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
	const year = date.getUTCFullYear();
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
};

const _getDaysBetween = (start: Date, end: Date): number => {
	const msPerDay = 24 * 60 * 60 * 1000;
	return Math.round((end.getTime() - start.getTime()) / msPerDay);
};

const getDefaultFiscalYearEndDate = (date: Date): Date => {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();
	if (month >= 3) {
		return new Date(Date.UTC(year + 1, 2, 31));
	}
	return new Date(Date.UTC(year, 2, 31));
};

const getDDBAnnualRate = (
	totalNumberOfDepreciations: number,
	frequencyOfDepreciation: number,
	ratePrecision: number,
): number => {
	const totalYears =
		(totalNumberOfDepreciations * frequencyOfDepreciation) / 12;
	if (totalYears <= 0) return 0;
	return Number((100 * (2.0 / totalYears)).toFixed(ratePrecision)) / 100;
};

const getWDVAnnualRate = (
	input: BuildDepreciationSchedulePreviewInput,
	currentAssetValue: number,
	pendingYears: number,
	ratePrecision: number,
): number => {
	if (input.rateOfDepreciation != null && input.rateOfDepreciation > 0) {
		return Number(input.rateOfDepreciation.toFixed(ratePrecision)) / 100;
	}

	const expectedSalvage = input.expectedValueAfterUsefulLife ?? 0;
	if (pendingYears <= 0 || currentAssetValue <= 0) {
		return 0;
	}
	const ratio = expectedSalvage / currentAssetValue;
	return (
		Number((100 * (1 - ratio ** (1.0 / pendingYears))).toFixed(ratePrecision)) /
		100
	);
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
	const precision = input.precision ?? CURRENCY_SCALE;
	const ratePrecision = input.ratePrecision ?? 2;
	if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
		throw new Error(
			"Depreciation preview precision must be an integer between zero and 6",
		);
	}
	if (
		!Number.isInteger(ratePrecision) ||
		ratePrecision < 0 ||
		ratePrecision > 6
	) {
		throw new Error(
			"Depreciation preview rate precision must be an integer between zero and 6",
		);
	}
	const roundPreview = (value: number): number =>
		Number(value.toFixed(precision));
	assertSupportedDepreciationOptions({
		method: input.depreciationMethod,
		totalPeriods: input.totalNumberOfDepreciations,
		dailyProrata: input.dailyProrataBased ?? false,
		shiftBased: input.shiftBased ?? false,
		calculateUsingTotalDays: input.calculateUsingTotalDays ?? false,
		shiftAllocations: input.shiftAllocations,
	});

	const bookedDepreciations = Math.min(
		Math.max(input.bookedDepreciations, 0),
		Math.max(input.totalNumberOfDepreciations - 1, 0),
	);

	let remainingDepreciations = Math.max(
		input.totalNumberOfDepreciations - bookedDepreciations,
		1,
	);

	const expectedSalvage = input.expectedValueAfterUsefulLife ?? 0;
	const shiftAllocations = input.shiftAllocations ?? [];
	const shiftByIndex = new Map(
		shiftAllocations.map((allocation) => [allocation.periodIndex, allocation]),
	);
	const shiftEnabled = input.shiftBased === true || shiftAllocations.length > 0;
	const adjustmentDateOnly = dateOnlyFromPersistedDateTime(
		input.adjustmentDate,
	);
	const adjustmentDate = dateOnlyUtc(adjustmentDateOnly);
	const depreciationStartDate = input.depreciationStartDate
		? dateOnlyFromPersistedDateTime(input.depreciationStartDate)
		: dateOnlyFromPersistedDateTime(endOfMonthDateOnly(adjustmentDateOnly));
	const calendar = createDepreciationCalendar({
		availableForUseDate: adjustmentDateOnly,
		depreciationStartDate,
		totalPeriods: input.totalNumberOfDepreciations,
		frequencyMonths: input.frequencyOfDepreciation,
	});
	let scheduleDate = dateOnlyUtc(calendar.scheduleDate(0));

	// Check pro-rata for new asset (row_idx === 0)
	const nominalPeriodCount =
		input.totalNumberOfDepreciations - bookedDepreciations;
	const hasProRata =
		bookedDepreciations === 0 &&
		dateOnlyUtc(calendar.usefulLifeEndDate) >
			dateOnlyUtc(calendar.scheduleDate(nominalPeriodCount - 1));
	let firstPeriodActualDays = 0;
	let firstPeriodStandardDays = 0;

	if (bookedDepreciations === 0) {
		const standardStartDate = addMonthsDateOnly(
			dateOnlyFromPersistedDateTime(scheduleDate),
			-input.frequencyOfDepreciation,
		);
		firstPeriodStandardDays = differenceInDateOnlyDays(
			dateOnlyFromPersistedDateTime(standardStartDate),
			dateOnlyFromPersistedDateTime(scheduleDate),
		);
		// Period starts from adjustmentDate (availableForUseDate equivalent for preview)
		firstPeriodActualDays =
			differenceInDateOnlyDays(
				dateOnlyFromPersistedDateTime(adjustmentDate),
				dateOnlyFromPersistedDateTime(scheduleDate),
			) + 1;
		if (hasProRata) remainingDepreciations += 1; // Extra period at the end
	}

	const depreciableValue = roundPreview(
		clampToZero(input.newAssetValue - expectedSalvage),
	);
	let remainingValue = roundPreview(clampToZero(input.newAssetValue));
	let pendingDepreciationAmount = depreciableValue;

	let accumulatedDepreciation = roundPreview(
		Math.max(
			input.openingAccumulatedDepreciation,
			input.purchaseAmount - input.currentAssetValue,
			0,
		),
	);
	if (
		input.depreciationMethod === "STRAIGHT_LINE" &&
		bookedDepreciations === 0 &&
		input.newAssetValue > 0
	) {
		const fiscalYearRanges = new Map<string, FiscalYearRange>();
		const fiscalYearDates = new Set<string>();
		for (let index = 0; index < nominalPeriodCount; index += 1) {
			fiscalYearDates.add(calendar.scheduleDate(index));
		}
		if (hasProRata) fiscalYearDates.add(calendar.usefulLifeEndDate);
		for (const date of fiscalYearDates) {
			const fiscalYearEndDate = input.getFiscalYearEndDate
				? await input.getFiscalYearEndDate(dateOnlyUtc(date))
				: null;
			if (fiscalYearEndDate) {
				const endDate = dateOnlyFromPersistedDateTime(fiscalYearEndDate);
				const startDate = dateOnlyFromPersistedDateTime(
					addDateOnlyUtc(
						dateOnlyFromPersistedDateTime(addMonthsDateOnly(endDate, -12)),
						1,
					),
				);
				fiscalYearRanges.set(date, { startDate, endDate });
			} else {
				const year = date.slice(0, 4);
				fiscalYearRanges.set(date, {
					startDate: `${year}-01-01`,
					endDate: `${year}-12-31`,
				});
			}
		}
		const schedule = buildDepreciationSchedule({
			financeBookId: null,
			method: input.depreciationMethod,
			grossBookValue: input.newAssetValue + accumulatedDepreciation,
			availableForUseDate: adjustmentDateOnly,
			depreciationStartDate,
			totalPeriods: input.totalNumberOfDepreciations,
			frequencyMonths: input.frequencyOfDepreciation,
			salvageValue: expectedSalvage,
			openingAccumulatedDepreciation: accumulatedDepreciation,
			dailyProrata: input.dailyProrataBased ?? false,
			shiftBased: input.shiftBased ?? false,
			calculateUsingTotalDays: input.calculateUsingTotalDays ?? false,
			precision,
			ratePrecision,
			shiftAllocations: shiftAllocations.map((allocation) => ({
				periodIndex: allocation.periodIndex,
				shift: allocation.shift,
				factor: allocation.factor,
			})),
			getFiscalYear: (date) =>
				fiscalYearRanges.get(date) ?? {
					startDate: `${date.slice(0, 4)}-01-01`,
					endDate: `${date.slice(0, 4)}-12-31`,
				},
		});
		return {
			depreciationMethod: input.depreciationMethod,
			totalNumberOfDepreciations: input.totalNumberOfDepreciations,
			frequencyOfDepreciation: input.frequencyOfDepreciation,
			dailyProrataBased: input.dailyProrataBased ?? null,
			shiftBased: input.shiftBased ?? null,
			precision,
			ratePrecision,
			calculateUsingTotalDays: input.calculateUsingTotalDays ?? false,
			rateOfDepreciation: input.rateOfDepreciation ?? null,
			expectedValueAfterUsefulLife: input.expectedValueAfterUsefulLife ?? null,
			bookedDepreciations,
			remainingDepreciations: schedule.entries.length,
			entries: schedule.entries.map((entry) => ({
				sequence: entry.periodNumber,
				scheduleDate: entry.date,
				depreciationAmount: entry.depreciationAmount,
				accumulatedDepreciationAmount: entry.accumulatedDepreciation,
				bookValueAfterDepreciation: entry.bookValueAfterDepreciation,
			})),
		};
	}
	const totalLifeEndDate = calendar.usefulLifeEndBaseDate;
	const totalLifeDays = differenceInDateOnlyDays(
		adjustmentDateOnly,
		totalLifeEndDate,
	);
	if (input.calculateUsingTotalDays && totalLifeDays <= 0) {
		throw new Error(
			"Depreciation preview total-life days must be greater than zero",
		);
	}
	const shiftFactorsSum = shiftEnabled
		? Array.from(
				{ length: input.totalNumberOfDepreciations - bookedDepreciations },
				(_, index) =>
					shiftByIndex.get(bookedDepreciations + index)?.factor ?? 1,
			).reduce((total, factor) => total + factor, 0)
		: 0;
	const fixedShiftAmount = shiftEnabled
		? depreciableValue / shiftFactorsSum
		: 0;

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
			ratePrecision,
		);
	} else if (isWDV) {
		annualRate = getWDVAnnualRate(
			input,
			input.newAssetValue,
			remainingDepreciations,
			ratePrecision,
		);
	}

	const entries: Asset.AssetDepreciationSchedulePreviewEntry[] = [];
	let carryingValueAtStartOfFY = remainingValue;
	let yearlyAmount = carryingValueAtStartOfFY * annualRate;
	let prevDepreciationAmount = 0;

	let previousScheduleDate = adjustmentDate;

	for (let sequence = 1; sequence <= remainingDepreciations; sequence += 1) {
		const isLastEntry = sequence === remainingDepreciations;
		scheduleDate = dateOnlyUtc(
			isLastEntry && hasProRata
				? calendar.usefulLifeEndDate
				: calendar.scheduleDate(sequence - 1),
		);
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

		const periodsLeft = remainingDepreciations - sequence + 1;

		const periodStartDate =
			sequence === 1
				? adjustmentDate
				: addDateOnlyUtc(
						dateOnlyFromPersistedDateTime(previousScheduleDate),
						1,
					);
		const periodEndDate = scheduleDate;
		const daysInPeriod =
			differenceInDateOnlyDays(
				dateOnlyFromPersistedDateTime(periodStartDate),
				dateOnlyFromPersistedDateTime(periodEndDate),
			) + 1;

		let depreciationAmount = 0;

		if (isLastEntry) {
			depreciationAmount = pendingDepreciationAmount;
		} else if (isSLM) {
			if (shiftEnabled) {
				const allocation = shiftByIndex.get(bookedDepreciations + sequence - 1);
				depreciationAmount = roundPreview(
					fixedShiftAmount * (allocation?.factor ?? 1),
				);
				if (sequence === 1 && hasProRata && firstPeriodStandardDays > 0) {
					depreciationAmount = roundPreview(
						(depreciationAmount * firstPeriodActualDays) /
							firstPeriodStandardDays,
					);
				}
			} else if (input.dailyProrataBased) {
				const standardPendingMonths =
					remainingDepreciations * input.frequencyOfDepreciation;
				const totalPendingYears = standardPendingMonths / 12;
				const yearlySLMAmount = depreciableValue / totalPendingYears;

				// Get fiscal year containing scheduleDate
				const fyEndDate = currentFiscalYearEndDate;
				const fyStartDate = addDateOnlyUtc(
					dateOnlyFromPersistedDateTime(
						addMonthsDateOnly(dateOnlyFromPersistedDateTime(fyEndDate), -12),
					),
					1,
				);
				const totalDaysInFY =
					differenceInDateOnlyDays(
						dateOnlyFromPersistedDateTime(fyStartDate),
						dateOnlyFromPersistedDateTime(fyEndDate),
					) + 1;

				const dailyDepr = input.calculateUsingTotalDays
					? depreciableValue / totalLifeDays
					: yearlySLMAmount / totalDaysInFY;
				depreciationAmount = roundPreview(dailyDepr * daysInPeriod);
			} else {
				depreciationAmount = roundPreview(
					pendingDepreciationAmount / periodsLeft,
				);
				// If first row and has pro-rata
				if (sequence === 1 && hasProRata && firstPeriodStandardDays > 0) {
					depreciationAmount = roundPreview(
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
				const fyStartDate = addDateOnlyUtc(
					dateOnlyFromPersistedDateTime(
						addMonthsDateOnly(dateOnlyFromPersistedDateTime(fyEndDate), -12),
					),
					1,
				);
				const totalDaysInFY =
					differenceInDateOnlyDays(
						dateOnlyFromPersistedDateTime(fyStartDate),
						dateOnlyFromPersistedDateTime(fyEndDate),
					) + 1;

				const dailyRate = yearlyAmount / totalDaysInFY;
				depreciationAmount = roundPreview(dailyRate * daysInPeriod);
			} else {
				depreciationAmount = roundPreview(prevDepreciationAmount);
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
				depreciationAmount = roundPreview(
					clampToZero(remainingValue - targetValue),
				);
				remainingValue = targetValue;
				pendingDepreciationAmount = targetValue;
			}
		} else {
			remainingValue = roundPreview(
				clampToZero(remainingValue - depreciationAmount),
			);
			pendingDepreciationAmount = roundPreview(
				clampToZero(pendingDepreciationAmount - depreciationAmount),
			);
		}

		accumulatedDepreciation = roundPreview(
			accumulatedDepreciation + depreciationAmount,
		);

		entries.push({
			sequence,
			scheduleDate: dateOnlyFromPersistedDateTime(scheduleDate),
			depreciationAmount,
			accumulatedDepreciationAmount: accumulatedDepreciation,
			bookValueAfterDepreciation: remainingValue,
		});

		previousScheduleDate = scheduleDate;
	}

	return {
		depreciationMethod: input.depreciationMethod,
		totalNumberOfDepreciations: input.totalNumberOfDepreciations,
		frequencyOfDepreciation: input.frequencyOfDepreciation,
		dailyProrataBased: input.dailyProrataBased ?? null,
		shiftBased: input.shiftBased ?? null,
		precision,
		ratePrecision,
		calculateUsingTotalDays: input.calculateUsingTotalDays ?? false,
		rateOfDepreciation: input.rateOfDepreciation ?? null,
		expectedValueAfterUsefulLife: input.expectedValueAfterUsefulLife ?? null,
		bookedDepreciations,
		remainingDepreciations,
		entries,
	};
};
