import type { Asset } from "@aria/types";
import {
	addDateOnlyUtc,
	addMonthsDateOnly,
	dateOnlyFromPersistedDateTime,
	dateOnlyUtc,
	endOfMonthDateOnly,
} from "./depreciation/depreciation.config";
import {
	createDepreciationCalendar,
	resolveEffectiveDepreciationAvailableForUseDate,
} from "./depreciation/depreciation-calendar";
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
	/** Original asset availability date used to preserve the useful-life boundary. */
	availableForUseDate?: Date;
	/** Submitted capitalization date for a target asset's selected book, if any. */
	capitalizationPostingDate?: Date;
	/** Exact cumulative useful-life extension in calendar months. */
	usefulLifeExtensionMonths?: number;
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

const buildFiscalYearResolver = async (
	input: BuildDepreciationSchedulePreviewInput,
	calendar: ReturnType<typeof createDepreciationCalendar>,
	firstPeriodIndex: number,
	totalPeriods: number,
): Promise<((date: string) => FiscalYearRange) | undefined> => {
	if (!input.getFiscalYearEndDate) return undefined;

	const defaultFiscalYear = (date: string): FiscalYearRange => {
		const year = date.slice(0, 4);
		return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
	};
	const dates = new Set<string>();
	const extensionPeriods = Math.floor(
		(input.usefulLifeExtensionMonths ?? 0) /
			(input.frequencyOfDepreciation ?? 1),
	);
	const schedulePeriods = totalPeriods + extensionPeriods;
	for (
		let periodIndex = firstPeriodIndex;
		periodIndex < schedulePeriods;
		periodIndex += 1
	) {
		dates.add(calendar.scheduleDate(periodIndex));
	}
	dates.add(calendar.usefulLifeEndDate);

	const fiscalYearRanges = new Map<string, FiscalYearRange>();
	for (const date of dates) {
		const fiscalYearEndDate = await input.getFiscalYearEndDate(
			dateOnlyUtc(date),
		);
		if (!fiscalYearEndDate) {
			fiscalYearRanges.set(date, defaultFiscalYear(date));
			continue;
		}
		const endDate = dateOnlyFromPersistedDateTime(fiscalYearEndDate);
		const startDate = dateOnlyFromPersistedDateTime(
			addDateOnlyUtc(
				dateOnlyFromPersistedDateTime(addMonthsDateOnly(endDate, -12)),
				1,
			),
		);
		fiscalYearRanges.set(date, { startDate, endDate });
	}
	return (date) => fiscalYearRanges.get(date) ?? defaultFiscalYear(date);
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

	const totalPeriods = input.totalNumberOfDepreciations;
	const frequencyMonths = input.frequencyOfDepreciation;
	const usefulLifeExtensionMonths = input.usefulLifeExtensionMonths ?? 0;
	const bookedDepreciations = input.bookedDepreciations;
	if (!Number.isInteger(bookedDepreciations) || bookedDepreciations < 0) {
		throw new Error("bookedDepreciations must be a non-negative integer");
	}
	if (bookedDepreciations > totalPeriods && usefulLifeExtensionMonths === 0) {
		return null;
	}
	if (bookedDepreciations === totalPeriods && usefulLifeExtensionMonths === 0) {
		return null;
	}

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

	const adjustmentDate = dateOnlyFromPersistedDateTime(input.adjustmentDate);
	const assetAvailableForUseDate = input.availableForUseDate
		? dateOnlyFromPersistedDateTime(input.availableForUseDate)
		: adjustmentDate;
	const availableForUseDate = resolveEffectiveDepreciationAvailableForUseDate({
		assetAvailableForUseDate,
		capitalizationPostingDate: input.capitalizationPostingDate
			? dateOnlyFromPersistedDateTime(input.capitalizationPostingDate)
			: null,
	});
	const depreciationStartDate = input.depreciationStartDate
		? dateOnlyFromPersistedDateTime(input.depreciationStartDate)
		: dateOnlyFromPersistedDateTime(endOfMonthDateOnly(adjustmentDate));
	const calendar = createDepreciationCalendar({
		availableForUseDate,
		depreciationStartDate,
		totalPeriods,
		frequencyMonths,
		usefulLifeExtensionMonths,
	});
	const accumulatedDepreciation = Number(
		Math.max(
			input.openingAccumulatedDepreciation,
			input.purchaseAmount - input.currentAssetValue,
			0,
		).toFixed(precision),
	);
	const engineMethod =
		input.depreciationMethod === "MANUAL"
			? "STRAIGHT_LINE"
			: input.depreciationMethod;
	assertSupportedDepreciationOptions({
		method: engineMethod,
		totalPeriods,
		dailyProrata: input.dailyProrataBased ?? false,
		shiftBased: input.shiftBased ?? false,
		calculateUsingTotalDays: input.calculateUsingTotalDays ?? false,
		shiftAllocations: input.shiftAllocations,
	});
	const getFiscalYear = await buildFiscalYearResolver(
		input,
		calendar,
		bookedDepreciations,
		totalPeriods,
	);
	const schedule = buildDepreciationSchedule({
		financeBookId: null,
		method: engineMethod,
		grossBookValue: input.newAssetValue + accumulatedDepreciation,
		availableForUseDate,
		depreciationStartDate,
		totalPeriods,
		frequencyMonths,
		usefulLifeExtensionMonths,
		periodsAlreadyBooked: bookedDepreciations,
		rateBasisTotalPeriods: totalPeriods,
		recalculateWrittenDownValueRate:
			input.depreciationMethod === "WRITTEN_DOWN_VALUE",
		salvageValue: input.expectedValueAfterUsefulLife ?? 0,
		openingAccumulatedDepreciation: accumulatedDepreciation,
		ratePercent: input.rateOfDepreciation ?? undefined,
		dailyProrata: input.dailyProrataBased ?? false,
		shiftBased: input.shiftBased ?? false,
		calculateUsingTotalDays: input.calculateUsingTotalDays ?? false,
		precision,
		ratePrecision,
		shiftAllocations: (input.shiftAllocations ?? []).map((allocation) => ({
			periodIndex: allocation.periodIndex,
			shift: allocation.shift,
			factor: allocation.factor,
		})),
		...(getFiscalYear ? { getFiscalYear } : {}),
	});

	return {
		depreciationMethod: input.depreciationMethod,
		totalNumberOfDepreciations: totalPeriods,
		frequencyOfDepreciation: frequencyMonths,
		dailyProrataBased: input.dailyProrataBased ?? null,
		shiftBased: input.shiftBased ?? null,
		precision,
		ratePrecision,
		calculateUsingTotalDays: input.calculateUsingTotalDays ?? false,
		rateOfDepreciation: schedule.ratePercent,
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
};
