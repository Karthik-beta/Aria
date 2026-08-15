import type { DateOnly } from "@aria/types";
import {
	addDateOnly,
	addMonthsDateOnly,
	dateOnlyFromPersistedDateTime,
	differenceInDateOnlyDays,
	endOfMonthDateOnly,
	normalizeDateOnly,
} from "./depreciation.config";

/** The ERPNext default shift identity used when a final pro-rata row has no allocation row. */
export const DEFAULT_DEPRECIATION_SHIFT = "Single";

export interface DepreciationCalendarInput {
	availableForUseDate: DateOnly;
	depreciationStartDate: DateOnly;
	totalPeriods: number;
	frequencyMonths: number;
	/** Exact calendar-month extension applied after the configured useful life. */
	usefulLifeExtensionMonths?: number;
}

/** Whether a schedule's final cadence date uses an absolute or remaining offset. */
export type DepreciationSchedulePeriodMode = "absolute" | "remaining";

export interface DepreciationCalendar {
	preserveMonthEnd: boolean;
	usefulLifeEndBaseDate: DateOnly;
	usefulLifeEndDate: DateOnly;
	scheduleDate(periodIndex: number): DateOnly;
}

/**
 * The maximum number of schedule rows that can legitimately exist for one
 * finance book. `nominalPeriods` covers the configured life plus complete
 * cadence-sized extensions; ERPNext adds one more row when the exact useful
 * life ends after the last nominal schedule date.
 */
export interface DepreciationScheduleCapacity {
	nominalPeriods: number;
	extensionPeriods: number;
	hasFinalPartialPeriod: boolean;
	totalBookablePeriods: number;
	remainingNominalPeriods(periodsAlreadyBooked: number): number;
	remainingBookablePeriods(periodsAlreadyBooked: number): number;
	pendingMonths(periodsAlreadyBooked: number): number;
}

const addMonths = (value: DateOnly, months: number): DateOnly =>
	dateOnlyFromPersistedDateTime(addMonthsDateOnly(value, months));

const endOfMonth = (value: DateOnly): DateOnly =>
	dateOnlyFromPersistedDateTime(endOfMonthDateOnly(value));

/**
 * Creates the canonical date boundaries shared by persisted schedules and previews.
 * Every operation remains on normalized calendar dates and never consults the host
 * process timezone. Month-end preservation is anchored to the original start date.
 */
export const createDepreciationCalendar = (
	input: DepreciationCalendarInput,
): DepreciationCalendar => {
	const availableForUseDate = normalizeDateOnly(input.availableForUseDate);
	const depreciationStartDate = normalizeDateOnly(input.depreciationStartDate);
	if (!Number.isInteger(input.totalPeriods) || input.totalPeriods <= 0) {
		throw new Error("Depreciation calendar totalPeriods must be positive.");
	}
	if (!Number.isInteger(input.frequencyMonths) || input.frequencyMonths <= 0) {
		throw new Error("Depreciation calendar frequencyMonths must be positive.");
	}
	const usefulLifeExtensionMonths = input.usefulLifeExtensionMonths ?? 0;
	if (
		!Number.isInteger(usefulLifeExtensionMonths) ||
		usefulLifeExtensionMonths < 0
	) {
		throw new Error(
			"Depreciation calendar usefulLifeExtensionMonths must be a non-negative integer.",
		);
	}

	const preserveMonthEnd =
		endOfMonth(depreciationStartDate) === depreciationStartDate;
	const usefulLifeEndBase = addMonths(
		availableForUseDate,
		input.totalPeriods * input.frequencyMonths,
	);
	const usefulLifeEndBaseDate =
		availableForUseDate.slice(8) === "01" && preserveMonthEnd
			? addDateOnly(usefulLifeEndBase, -1)
			: usefulLifeEndBase;
	const usefulLifeEndDate = addMonths(
		usefulLifeEndBaseDate,
		usefulLifeExtensionMonths,
	);

	return {
		preserveMonthEnd,
		usefulLifeEndBaseDate: usefulLifeEndBase,
		usefulLifeEndDate,
		scheduleDate(periodIndex: number): DateOnly {
			if (!Number.isInteger(periodIndex) || periodIndex < 0) {
				throw new Error(
					"Depreciation calendar periodIndex must be a non-negative integer.",
				);
			}
			const nominalDate = addMonths(
				depreciationStartDate,
				periodIndex * input.frequencyMonths,
			);
			return preserveMonthEnd ? endOfMonth(nominalDate) : nominalDate;
		},
	};
};

/**
 * Resolves the date from which a book's useful life is measured.
 *
 * A target asset may have existed before a submitted capitalization created
 * the selected book. The capitalization date is therefore the book-specific
 * availability boundary, while ordinary assets retain their persisted asset
 * availability date. The later date wins if legacy data contains an earlier
 * capitalization timestamp.
 */
export const resolveEffectiveDepreciationAvailableForUseDate = (input: {
	assetAvailableForUseDate: DateOnly;
	capitalizationPostingDate?: DateOnly | null;
}): DateOnly => {
	const assetAvailableForUseDate = normalizeDateOnly(
		input.assetAvailableForUseDate,
	);
	if (!input.capitalizationPostingDate) return assetAvailableForUseDate;

	const capitalizationPostingDate = normalizeDateOnly(
		input.capitalizationPostingDate,
	);
	return capitalizationPostingDate > assetAvailableForUseDate
		? capitalizationPostingDate
		: assetAvailableForUseDate;
};

/**
 * Calculates schedule capacity once for every caller that validates or
 * advances a depreciation cursor. The pending-month fallback covers the
 * residual tail after all complete cadence rows have been booked; the normal
 * ERPNext month formula is retained whenever it is positive so existing
 * WDV/revision rates remain unchanged.
 */
export const getDepreciationScheduleCapacity = (
	input: DepreciationCalendarInput & {
		periodsAlreadyBooked?: number;
		periodMode?: DepreciationSchedulePeriodMode;
	},
): DepreciationScheduleCapacity => {
	const calendar = createDepreciationCalendar(input);
	const usefulLifeExtensionMonths = input.usefulLifeExtensionMonths ?? 0;
	const extensionPeriods = Math.floor(
		usefulLifeExtensionMonths / input.frequencyMonths,
	);
	const nominalPeriods = input.totalPeriods + extensionPeriods;
	const periodsAlreadyBooked = input.periodsAlreadyBooked ?? 0;
	const nominalPeriodsFromBookedOffset = Math.max(
		nominalPeriods - periodsAlreadyBooked,
		0,
	);
	const lastNominalDate = calendar.scheduleDate(
		input.periodMode === "remaining"
			? Math.max(nominalPeriodsFromBookedOffset - 1, 0)
			: nominalPeriods - 1,
	);
	const hasFinalPartialPeriod = calendar.usefulLifeEndDate > lastNominalDate;
	const totalBookablePeriods = nominalPeriods + (hasFinalPartialPeriod ? 1 : 0);

	const validateBookedPeriods = (periodsAlreadyBooked: number): void => {
		if (
			!Number.isInteger(periodsAlreadyBooked) ||
			periodsAlreadyBooked < 0 ||
			periodsAlreadyBooked > totalBookablePeriods
		) {
			throw new Error(
				"periodsAlreadyBooked exceeds the maximum bookable depreciation schedule periods",
			);
		}
	};

	return {
		nominalPeriods,
		extensionPeriods,
		hasFinalPartialPeriod,
		totalBookablePeriods,
		remainingNominalPeriods(periodsAlreadyBooked: number): number {
			validateBookedPeriods(periodsAlreadyBooked);
			return Math.max(nominalPeriods - periodsAlreadyBooked, 0);
		},
		remainingBookablePeriods(periodsAlreadyBooked: number): number {
			validateBookedPeriods(periodsAlreadyBooked);
			return totalBookablePeriods - periodsAlreadyBooked;
		},
		pendingMonths(periodsAlreadyBooked: number): number {
			validateBookedPeriods(periodsAlreadyBooked);
			const configuredPendingMonths =
				(input.totalPeriods - periodsAlreadyBooked) * input.frequencyMonths +
				usefulLifeExtensionMonths;
			if (configuredPendingMonths > 0) return configuredPendingMonths;
			if (
				!hasFinalPartialPeriod ||
				periodsAlreadyBooked >= totalBookablePeriods
			) {
				return 0;
			}

			const lastBookedDate =
				periodsAlreadyBooked > 0
					? calendar.scheduleDate(periodsAlreadyBooked - 1)
					: input.availableForUseDate;
			const residualDays = differenceInDateOnlyDays(
				lastBookedDate,
				calendar.usefulLifeEndDate,
			);
			return (residualDays * 12) / 365;
		},
	};
};
