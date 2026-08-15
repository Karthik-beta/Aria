import type { DateOnly } from "@aria/types";
import {
	addDateOnly,
	addMonthsDateOnly,
	dateOnlyFromPersistedDateTime,
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
}

export interface DepreciationCalendar {
	preserveMonthEnd: boolean;
	usefulLifeEndBaseDate: DateOnly;
	usefulLifeEndDate: DateOnly;
	scheduleDate(periodIndex: number): DateOnly;
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

	const preserveMonthEnd =
		endOfMonth(depreciationStartDate) === depreciationStartDate;
	const usefulLifeEndBase = addMonths(
		availableForUseDate,
		input.totalPeriods * input.frequencyMonths,
	);
	const usefulLifeEndDate =
		availableForUseDate.slice(8) === "01" && preserveMonthEnd
			? addDateOnly(usefulLifeEndBase, -1)
			: usefulLifeEndBase;

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
