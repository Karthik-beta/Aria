import {
	createDepreciationCalendar,
	DEFAULT_DEPRECIATION_SHIFT,
	getDepreciationScheduleCapacity,
} from "./depreciation-calendar";

/** Supported ERPNext depreciation calculation methods. */
export type DepreciationMethod =
	| "STRAIGHT_LINE"
	| "MANUAL"
	| "WRITTEN_DOWN_VALUE"
	| "DOUBLE_DECLINING_BALANCE";

/** A fiscal year containing the supplied date, expressed as ISO date strings. */
export interface FiscalYearRange {
	startDate: string;
	endDate: string;
}

/** A caller-authored row used by ERPNext's Manual depreciation method. */
export interface ManualDepreciationEntry {
	date: string;
	amount: number;
	shift?: string | null;
}

/** Optional shift assignment for a generated schedule period. */
export interface DepreciationShiftAllocation {
	periodIndex: number;
	shift: string;
	factor: number;
}

/**
 * Finance-book inputs required to generate an ERPNext-aligned schedule.
 *
 * Dates are date-only ISO strings so schedule generation is independent of the
 * host timezone. `grossBookValue` is the original value before opening
 * accumulated depreciation.
 */
export interface DepreciationBookInput {
	financeBookId: string | null;
	method: DepreciationMethod;
	grossBookValue: number;
	availableForUseDate: string;
	depreciationStartDate: string;
	totalPeriods: number;
	frequencyMonths: number;
	/** Exact calendar-month extension retained on an ERPNext revision. */
	usefulLifeExtensionMonths?: number;
	/**
	 * Number of periods already booked before this schedule's first generated
	 * row. This is distinct from openingBookedPeriods: revision schedules keep
	 * their original cadence and therefore need an absolute calendar offset.
	 */
	periodsAlreadyBooked?: number;
	/** Original configured life used for a declining-balance rate calculation. */
	rateBasisTotalPeriods?: number;
	/** Recalculate WDV from the selected book's current basis when required. */
	recalculateWrittenDownValueRate?: boolean;
	salvageValue?: number;
	openingBookedPeriods?: number;
	openingAccumulatedDepreciation?: number;
	ratePercent?: number;
	dailyProrata?: boolean;
	/** Explicitly selects ERPNext's persisted shift branch for this book. */
	shiftBased?: boolean;
	calculateUsingTotalDays?: boolean;
	precision?: number;
	ratePrecision?: number;
	manualEntries?: readonly ManualDepreciationEntry[];
	shiftAllocations?: readonly DepreciationShiftAllocation[];
	getFiscalYear?: (date: string) => FiscalYearRange;
}

/** A calculated depreciation period for one finance book. */
export interface DepreciationScheduleEntry {
	periodNumber: number;
	date: string;
	depreciationAmount: number;
	accumulatedDepreciation: number;
	bookValueAfterDepreciation: number;
	shift: string | null;
}

/** The immutable result of calculating one finance book. */
export interface DepreciationSchedule {
	financeBookId: string | null;
	method: DepreciationMethod;
	ratePercent: number | null;
	entries: readonly DepreciationScheduleEntry[];
}

/**
 * Raised when a finance-book depreciation configuration cannot produce a
 * finite, internally consistent schedule.
 */
export class DepreciationScheduleCalculationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DepreciationScheduleCalculationError";
	}
}

/** Rejects a numeric value before it can participate in depreciation math. */
export const assertFiniteDepreciationValue = (
	name: string,
	value: number,
): void => {
	if (!Number.isFinite(value)) {
		throw new DepreciationScheduleCalculationError(`${name} must be finite.`);
	}
};

/** Validates a persisted or caller-supplied depreciation rate before use. */
export const assertNonNegativeDepreciationRate = (value: number): void => {
	assertFiniteDepreciationValue("ratePercent", value);
	if (value < 0) {
		throw new DepreciationScheduleCalculationError(
			"ratePercent must be non-negative",
		);
	}
};

/**
 * Verifies the complete engine result before a caller can expose or persist it.
 * This is intentionally separate from input validation so callers that persist
 * a schedule can repeat the boundary check immediately before writing rows.
 */
export const assertFiniteDepreciationSchedule = (
	schedule: DepreciationSchedule,
): void => {
	if (schedule.ratePercent !== null) {
		assertFiniteDepreciationValue("ratePercent", schedule.ratePercent);
	}
	for (const [index, entry] of schedule.entries.entries()) {
		assertFiniteDepreciationValue(
			`entries[${index}].depreciationAmount`,
			entry.depreciationAmount,
		);
		assertFiniteDepreciationValue(
			`entries[${index}].accumulatedDepreciation`,
			entry.accumulatedDepreciation,
		);
		assertFiniteDepreciationValue(
			`entries[${index}].bookValueAfterDepreciation`,
			entry.bookValueAfterDepreciation,
		);
	}
};

const MILLISECONDS_PER_DAY = 86_400_000;

const parseDate = (value: string): Date => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new Error(`Invalid date-only value: ${value}`);
	}

	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
	if (formatDate(date) !== value) {
		throw new Error(`Invalid calendar date: ${value}`);
	}
	return date;
};

const formatDate = (date: Date): string =>
	`${date.getUTCFullYear().toString().padStart(4, "0")}-${(
		date.getUTCMonth() + 1
	)
		.toString()
		.padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;

const daysInMonth = (year: number, month: number): number =>
	new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const addMonths = (date: Date, months: number): Date => {
	const targetMonth = date.getUTCMonth() + months;
	const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
	const normalizedMonth = ((targetMonth % 12) + 12) % 12;
	return new Date(
		Date.UTC(
			targetYear,
			normalizedMonth,
			Math.min(date.getUTCDate(), daysInMonth(targetYear, normalizedMonth)),
		),
	);
};

const addDays = (date: Date, days: number): Date =>
	new Date(date.getTime() + days * MILLISECONDS_PER_DAY);

const endOfMonth = (date: Date): Date =>
	new Date(
		Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			daysInMonth(date.getUTCFullYear(), date.getUTCMonth()),
		),
	);

const differenceInDays = (later: Date, earlier: Date): number =>
	Math.round((later.getTime() - earlier.getTime()) / MILLISECONDS_PER_DAY);

const round = (value: number, precision: number): number => {
	assertFiniteDepreciationValue("calculation value", value);
	const rounded = Number(value.toFixed(precision));
	assertFiniteDepreciationValue("rounded calculation value", rounded);
	return rounded;
};

const defaultFiscalYear = (date: string): FiscalYearRange => {
	const parsed = parseDate(date);
	const year = parsed.getUTCFullYear();
	return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
};

/**
 * Mirrors ERPNext's pending-month calculation for an existing Asset. The
 * opening period count is a configured history count, while the date span from
 * available-for-use to the last booked period can be fractional; both inputs
 * are needed to preserve the final partial-period amount.
 */
const getPendingMonths = (
	input: DepreciationBookInput,
	startDate: Date,
	availableDate: Date,
): { pendingMonths: number; lastBookedDate: Date | null } => {
	const totalMonths =
		input.totalPeriods * input.frequencyMonths +
		(input.usefulLifeExtensionMonths ?? 0);
	const openingPeriods = input.openingBookedPeriods ?? 0;
	if (openingPeriods === 0) {
		return { pendingMonths: totalMonths, lastBookedDate: null };
	}

	const lastBookedDate = addMonths(startDate, -input.frequencyMonths);
	const computedAvailableDate = addDays(
		addMonths(startDate, -input.frequencyMonths * (1 + openingPeriods)),
		1,
	);
	const effectiveAvailableDate =
		computedAvailableDate < availableDate
			? availableDate
			: computedAvailableDate;
	const bookedMonths =
		(differenceInDays(lastBookedDate, effectiveAvailableDate) + 1) / (365 / 12);
	const pendingMonths = totalMonths - bookedMonths;
	assertFiniteDepreciationValue("pending months", pendingMonths);
	if (pendingMonths <= 0) {
		throw new DepreciationScheduleCalculationError(
			"pending months must be greater than zero",
		);
	}
	return { pendingMonths, lastBookedDate };
};

/**
 * Validates the persisted option combinations before a schedule is generated
 * or a category template is written. Missing shift rows are never interpreted
 * as an implicit operating shift when the shift branch is selected.
 */
export const assertSupportedDepreciationOptions = (input: {
	method: DepreciationMethod;
	totalPeriods: number;
	dailyProrata?: boolean;
	shiftBased?: boolean;
	calculateUsingTotalDays?: boolean;
	shiftAllocations?: readonly DepreciationShiftAllocation[];
}): void => {
	const allocations = input.shiftAllocations ?? [];
	if (
		input.calculateUsingTotalDays &&
		(input.method !== "STRAIGHT_LINE" || !input.dailyProrata)
	) {
		throw new DepreciationScheduleCalculationError(
			"calculateUsingTotalDays requires daily straight-line depreciation",
		);
	}
	if (
		input.shiftBased &&
		(input.method !== "STRAIGHT_LINE" ||
			allocations.length !== input.totalPeriods)
	) {
		throw new DepreciationScheduleCalculationError(
			"shiftBased straight-line depreciation requires one persisted shift allocation for every period",
		);
	}
	if (input.shiftBased === false && allocations.length > 0) {
		throw new DepreciationScheduleCalculationError(
			"shift allocations require shiftBased depreciation",
		);
	}
	if (allocations.length > 0 && input.method !== "STRAIGHT_LINE") {
		throw new DepreciationScheduleCalculationError(
			"shift allocations are supported only for straight-line depreciation",
		);
	}
	const allocationIndices = new Set<number>();
	for (const [index, allocation] of allocations.entries()) {
		if (
			!Number.isInteger(allocation.periodIndex) ||
			allocation.periodIndex < 0 ||
			allocation.periodIndex >= input.totalPeriods
		) {
			throw new DepreciationScheduleCalculationError(
				`shiftAllocations[${index}].periodIndex must be an integer in the configured depreciation periods`,
			);
		}
		if (allocationIndices.has(allocation.periodIndex)) {
			throw new DepreciationScheduleCalculationError(
				`shiftAllocations[${index}].periodIndex is duplicated`,
			);
		}
		allocationIndices.add(allocation.periodIndex);
		if (!allocation.shift.trim()) {
			throw new DepreciationScheduleCalculationError(
				`shiftAllocations[${index}].shift is required`,
			);
		}
		assertFiniteDepreciationValue(
			`shiftAllocations[${index}].factor`,
			allocation.factor,
		);
		if (allocation.factor <= 0) {
			throw new DepreciationScheduleCalculationError(
				`shiftAllocations[${index}].factor must be greater than zero`,
			);
		}
	}
};

const validateInput = (input: DepreciationBookInput): void => {
	parseDate(input.availableForUseDate);
	parseDate(input.depreciationStartDate);
	const salvageValue = input.salvageValue ?? 0;
	const openingAccumulated = input.openingAccumulatedDepreciation ?? 0;
	const openingPeriods = input.openingBookedPeriods ?? 0;
	const periodsAlreadyBooked = input.periodsAlreadyBooked;
	const usefulLifeExtensionMonths = input.usefulLifeExtensionMonths ?? 0;
	const rateBasisTotalPeriods =
		input.rateBasisTotalPeriods ?? input.totalPeriods;
	const precision = input.precision ?? 2;
	const ratePrecision = input.ratePrecision ?? 2;
	assertFiniteDepreciationValue("grossBookValue", input.grossBookValue);
	assertFiniteDepreciationValue("salvageValue", salvageValue);
	assertFiniteDepreciationValue(
		"openingAccumulatedDepreciation",
		openingAccumulated,
	);
	assertFiniteDepreciationValue("precision", precision);
	assertFiniteDepreciationValue("ratePrecision", ratePrecision);
	if (input.ratePercent !== null && input.ratePercent !== undefined) {
		assertNonNegativeDepreciationRate(input.ratePercent);
	}
	if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
		throw new DepreciationScheduleCalculationError(
			"precision must be an integer between zero and 6",
		);
	}
	if (
		!Number.isInteger(ratePrecision) ||
		ratePrecision < 0 ||
		ratePrecision > 6
	) {
		throw new DepreciationScheduleCalculationError(
			"ratePrecision must be an integer between zero and 6",
		);
	}
	if (input.grossBookValue <= 0) {
		throw new Error("grossBookValue must be greater than zero");
	}
	if (!Number.isInteger(input.totalPeriods) || input.totalPeriods <= 0) {
		throw new Error("totalPeriods must be a positive integer");
	}
	if (!Number.isInteger(input.frequencyMonths) || input.frequencyMonths <= 0) {
		throw new Error("frequencyMonths must be a positive integer");
	}
	if (
		!Number.isInteger(usefulLifeExtensionMonths) ||
		usefulLifeExtensionMonths < 0
	) {
		throw new DepreciationScheduleCalculationError(
			"usefulLifeExtensionMonths must be a non-negative integer",
		);
	}
	if (!Number.isInteger(rateBasisTotalPeriods) || rateBasisTotalPeriods <= 0) {
		throw new DepreciationScheduleCalculationError(
			"rateBasisTotalPeriods must be a positive integer",
		);
	}

	if (salvageValue < 0 || salvageValue > input.grossBookValue) {
		throw new Error("salvageValue must be between zero and grossBookValue");
	}
	if (
		openingAccumulated < 0 ||
		openingAccumulated > input.grossBookValue - salvageValue
	) {
		throw new Error(
			"opening accumulated depreciation exceeds depreciable value",
		);
	}
	if (
		!Number.isInteger(openingPeriods) ||
		openingPeriods < 0 ||
		openingPeriods >= input.totalPeriods
	) {
		throw new Error("openingBookedPeriods must be less than totalPeriods");
	}
	if (periodsAlreadyBooked !== undefined) {
		if (
			!Number.isInteger(periodsAlreadyBooked) ||
			periodsAlreadyBooked < 0 ||
			periodsAlreadyBooked >
				getDepreciationScheduleCapacity({
					availableForUseDate: input.availableForUseDate,
					depreciationStartDate: input.depreciationStartDate,
					totalPeriods: input.totalPeriods,
					frequencyMonths: input.frequencyMonths,
					usefulLifeExtensionMonths,
				}).totalBookablePeriods
		) {
			throw new DepreciationScheduleCalculationError(
				"periodsAlreadyBooked exceeds the maximum bookable depreciation schedule periods",
			);
		}
		if (openingPeriods !== 0) {
			throw new DepreciationScheduleCalculationError(
				"periodsAlreadyBooked cannot be combined with openingBookedPeriods",
			);
		}
	}
	if (input.method === "MANUAL" && !input.manualEntries?.length) {
		throw new Error("Manual depreciation requires at least one manual entry");
	}
	assertSupportedDepreciationOptions(input);
	for (const [index, manual] of (input.manualEntries ?? []).entries()) {
		assertFiniteDepreciationValue(
			`manualEntries[${index}].amount`,
			manual.amount,
		);
	}
};

const calculateRate = (
	input: DepreciationBookInput,
	openingBookValue: number,
	pendingMonths: number,
): number | null => {
	const ratePrecision = input.ratePrecision ?? 2;
	if (input.method === "DOUBLE_DECLINING_BALANCE") {
		const usefulLifeYears =
			((input.rateBasisTotalPeriods ?? input.totalPeriods) *
				input.frequencyMonths) /
			12;
		assertFiniteDepreciationValue("usefulLifeYears", usefulLifeYears);
		if (usefulLifeYears <= 0) {
			throw new DepreciationScheduleCalculationError(
				"usefulLifeYears must be greater than zero",
			);
		}
		return round(200 / usefulLifeYears, ratePrecision);
	}
	if (input.method !== "WRITTEN_DOWN_VALUE") return null;
	if (
		(input.ratePercent ?? 0) > 0 &&
		(!input.recalculateWrittenDownValueRate || (input.salvageValue ?? 0) === 0)
	) {
		return round(input.ratePercent ?? 0, ratePrecision);
	}
	if (openingBookValue === 0 && (input.salvageValue ?? 0) === 0) {
		return null;
	}

	const pendingYears = pendingMonths / 12;
	assertFiniteDepreciationValue("pendingYears", pendingYears);
	if (pendingYears <= 0) {
		throw new DepreciationScheduleCalculationError(
			"pendingYears must be greater than zero",
		);
	}
	const ratio = (input.salvageValue ?? 0) / openingBookValue;
	assertFiniteDepreciationValue("written-down-value salvage ratio", ratio);
	if (ratio < 0 || ratio > 1) {
		throw new DepreciationScheduleCalculationError(
			"written-down-value salvage ratio must be between zero and one",
		);
	}
	return round(100 * (1 - ratio ** (1 / pendingYears)), ratePrecision);
};

const buildManualSchedule = (
	input: DepreciationBookInput,
): DepreciationSchedule => {
	const precision = input.precision ?? 2;
	const salvage = input.salvageValue ?? 0;
	let accumulated = round(input.openingAccumulatedDepreciation ?? 0, precision);
	let carrying = round(input.grossBookValue - accumulated, precision);
	let previousDate: Date | null = null;
	const entries = (input.manualEntries ?? []).map((manual, index) => {
		const date = parseDate(manual.date);
		if (previousDate && date <= previousDate) {
			throw new Error("Manual depreciation dates must be strictly increasing");
		}
		if (!Number.isFinite(manual.amount) || manual.amount <= 0) {
			throw new Error("Manual depreciation amounts must be greater than zero");
		}
		previousDate = date;
		const amount = round(manual.amount, precision);
		if (round(carrying - amount, precision) < salvage) {
			throw new Error(
				"Manual depreciation cannot reduce book value below salvage value",
			);
		}
		accumulated = round(accumulated + amount, precision);
		carrying = round(input.grossBookValue - accumulated, precision);
		return {
			periodNumber: (input.openingBookedPeriods ?? 0) + index + 1,
			date: manual.date,
			depreciationAmount: amount,
			accumulatedDepreciation: accumulated,
			bookValueAfterDepreciation: carrying,
			shift: manual.shift ?? null,
		};
	});

	const schedule = Object.freeze({
		financeBookId: input.financeBookId,
		method: input.method,
		ratePercent: null,
		entries: Object.freeze(entries),
	});
	assertFiniteDepreciationSchedule(schedule);
	return schedule;
};

/**
 * Generates a deterministic schedule for one asset finance book.
 *
 * The implementation mirrors ERPNext's schedule controller: declining balance
 * uses an annual rate fixed within each fiscal year, first/last partial periods
 * are pro-rated, and the final amount is capped at salvage value.
 */
export const buildDepreciationSchedule = (
	input: DepreciationBookInput,
): DepreciationSchedule => {
	validateInput(input);
	if (input.method === "MANUAL") return buildManualSchedule(input);

	const precision = input.precision ?? 2;
	const openingPeriods = input.openingBookedPeriods ?? 0;
	const hasExplicitBookedOffset = input.periodsAlreadyBooked !== undefined;
	const periodsAlreadyBooked = input.periodsAlreadyBooked ?? openingPeriods;
	const openingAccumulated = round(
		input.openingAccumulatedDepreciation ?? 0,
		precision,
	);
	const salvage = round(input.salvageValue ?? 0, precision);
	const startDate = parseDate(input.depreciationStartDate);
	const availableDate = parseDate(input.availableForUseDate);
	const calendar = createDepreciationCalendar({
		availableForUseDate: input.availableForUseDate,
		depreciationStartDate: input.depreciationStartDate,
		totalPeriods: input.totalPeriods,
		frequencyMonths: input.frequencyMonths,
		usefulLifeExtensionMonths: input.usefulLifeExtensionMonths,
	});
	const preserveMonthEnd = calendar.preserveMonthEnd;
	const usefulLifeExtensionMonths = input.usefulLifeExtensionMonths ?? 0;
	const capacity = getDepreciationScheduleCapacity({
		availableForUseDate: input.availableForUseDate,
		depreciationStartDate: input.depreciationStartDate,
		totalPeriods: input.totalPeriods,
		frequencyMonths: input.frequencyMonths,
		usefulLifeExtensionMonths,
		periodsAlreadyBooked,
		periodMode: hasExplicitBookedOffset ? "absolute" : "remaining",
	});
	const remainingPeriods =
		capacity.remainingNominalPeriods(periodsAlreadyBooked);
	const pendingMonths = hasExplicitBookedOffset
		? capacity.pendingMonths(periodsAlreadyBooked)
		: getPendingMonths(input, startDate, availableDate).pendingMonths;
	const lastBookedDate = hasExplicitBookedOffset
		? periodsAlreadyBooked > 0
			? parseDate(calendar.scheduleDate(periodsAlreadyBooked - 1))
			: null
		: getPendingMonths(input, startDate, availableDate).lastBookedDate;
	const pendingPeriods = pendingMonths / input.frequencyMonths;
	assertFiniteDepreciationValue("pending periods", pendingPeriods);
	const openingBookValue = round(
		input.grossBookValue - openingAccumulated,
		precision,
	);
	if (openingBookValue < salvage) {
		throw new DepreciationScheduleCalculationError(
			"opening carrying value cannot be below salvage value",
		);
	}
	const ratePercent = calculateRate(input, openingBookValue, pendingMonths);
	const remainingDepreciableValue = round(
		openingBookValue - salvage,
		precision,
	);
	if (remainingDepreciableValue < 0) {
		throw new DepreciationScheduleCalculationError(
			"remaining depreciable value cannot be negative",
		);
	}
	if (remainingDepreciableValue === 0) {
		const ratePercent =
			pendingPeriods > 0
				? calculateRate(input, openingBookValue, pendingMonths)
				: null;
		const terminalSchedule = Object.freeze({
			financeBookId: input.financeBookId,
			method: input.method,
			ratePercent,
			entries: Object.freeze([] as DepreciationScheduleEntry[]),
		});
		assertFiniteDepreciationSchedule(terminalSchedule);
		return terminalSchedule;
	}
	if (pendingPeriods <= 0) {
		throw new DepreciationScheduleCalculationError(
			"pending periods must be greater than zero",
		);
	}
	const usefulLifeEnd = parseDate(calendar.usefulLifeEndDate);
	const hasFinalPartialPeriod =
		capacity.hasFinalPartialPeriod &&
		periodsAlreadyBooked < capacity.totalBookablePeriods;
	const generatedPeriods = remainingPeriods + (hasFinalPartialPeriod ? 1 : 0);
	const shiftByIndex = new Map(
		(input.shiftAllocations ?? []).map((allocation) => [
			allocation.periodIndex,
			allocation,
		]),
	);
	const shiftEnabled =
		input.shiftBased === true || Boolean(input.shiftAllocations?.length);
	const schedulePeriodOffset = hasExplicitBookedOffset
		? periodsAlreadyBooked
		: 0;
	const allocationPeriodOffset = hasExplicitBookedOffset
		? periodsAlreadyBooked
		: openingPeriods;
	const shiftFactorsSum = shiftEnabled
		? Array.from(
				{ length: Math.max(remainingPeriods, 1) },
				(_, i) => shiftByIndex.get(allocationPeriodOffset + i)?.factor ?? 1,
			).reduce((a, b) => a + b, 0)
		: Math.max(remainingPeriods, 1);
	assertFiniteDepreciationValue("shift factors sum", shiftFactorsSum);
	if (shiftFactorsSum <= 0) {
		throw new DepreciationScheduleCalculationError(
			"shift factors sum must be greater than zero",
		);
	}
	const fixedPeriodAmount =
		remainingDepreciableValue /
		(shiftEnabled ? shiftFactorsSum : pendingPeriods);
	assertFiniteDepreciationValue("fixed period amount", fixedPeriodAmount);
	const fiscalYearFor = input.getFiscalYear ?? defaultFiscalYear;
	const totalLifeDays = lastBookedDate
		? differenceInDays(usefulLifeEnd, lastBookedDate) - 1
		: differenceInDays(usefulLifeEnd, availableDate);
	assertFiniteDepreciationValue("total life days", totalLifeDays);
	if (totalLifeDays <= 0) {
		throw new DepreciationScheduleCalculationError(
			"total life days must be greater than zero",
		);
	}
	const pendingLifeYears = pendingMonths / 12;
	assertFiniteDepreciationValue("pending life years", pendingLifeYears);
	if (pendingLifeYears <= 0) {
		throw new DepreciationScheduleCalculationError(
			"pending life years must be greater than zero",
		);
	}

	let accumulated = openingAccumulated;
	let carrying = openingBookValue;
	let previousScheduleDate: Date | null = null;
	let activeFiscalYearStart: string | null = null;
	let fiscalYearPeriodicAmount = 0;
	let fiscalYearAnnualAmount = 0;
	const entries: DepreciationScheduleEntry[] = [];

	for (let index = 0; index < generatedPeriods; index += 1) {
		const isFinalPartial = index >= remainingPeriods;
		const scheduleDate = isFinalPartial
			? usefulLifeEnd
			: parseDate(calendar.scheduleDate(schedulePeriodOffset + index));
		const allocation = shiftByIndex.get(allocationPeriodOffset + index);
		const fiscalYear = fiscalYearFor(formatDate(scheduleDate));
		parseDate(fiscalYear.startDate);
		parseDate(fiscalYear.endDate);
		if (activeFiscalYearStart !== fiscalYear.startDate) {
			activeFiscalYearStart = fiscalYear.startDate;
			fiscalYearAnnualAmount =
				input.method === "STRAIGHT_LINE"
					? remainingDepreciableValue / pendingLifeYears
					: carrying * ((ratePercent ?? 0) / 100);
			fiscalYearPeriodicAmount =
				(fiscalYearAnnualAmount * input.frequencyMonths) / 12;
		}

		let amount: number;
		if (isFinalPartial) {
			amount = carrying - salvage;
		} else if (shiftEnabled) {
			const factor = allocation?.factor ?? 1;
			amount = fixedPeriodAmount * factor;

			if (index === 0 && periodsAlreadyBooked === 0) {
				const previousPeriodEnd = preserveMonthEnd
					? endOfMonth(addMonths(startDate, -input.frequencyMonths))
					: addMonths(startDate, -input.frequencyMonths);
				const fullPeriodStart = addDays(previousPeriodEnd, 1);
				if (availableDate > fullPeriodStart) {
					const usedDays = differenceInDays(scheduleDate, availableDate) + 1;
					const periodDays =
						differenceInDays(scheduleDate, fullPeriodStart) + 1;
					amount = (amount * usedDays) / periodDays;
				}
			}
		} else if (input.dailyProrata) {
			const coverageStart = previousScheduleDate
				? addDays(previousScheduleDate, 1)
				: periodsAlreadyBooked > 0
					? addDays(lastBookedDate ?? startDate, 1)
					: availableDate;
			const coveredDays = differenceInDays(scheduleDate, coverageStart) + 1;
			if (input.calculateUsingTotalDays && input.method === "STRAIGHT_LINE") {
				amount = (remainingDepreciableValue / totalLifeDays) * coveredDays;
			} else {
				const fiscalDays =
					differenceInDays(
						parseDate(fiscalYear.endDate),
						parseDate(fiscalYear.startDate),
					) + 1;
				amount = (fiscalYearAnnualAmount / fiscalDays) * coveredDays;
			}
		} else {
			const factor = allocation?.factor ?? 1;
			amount =
				input.method === "STRAIGHT_LINE"
					? fixedPeriodAmount * factor
					: fiscalYearPeriodicAmount;

			if (index === 0 && periodsAlreadyBooked === 0) {
				const previousPeriodEnd = preserveMonthEnd
					? endOfMonth(addMonths(startDate, -input.frequencyMonths))
					: addMonths(startDate, -input.frequencyMonths);
				const fullPeriodStart = addDays(previousPeriodEnd, 1);
				if (availableDate > fullPeriodStart) {
					const usedDays = differenceInDays(scheduleDate, availableDate) + 1;
					const periodDays =
						differenceInDays(scheduleDate, fullPeriodStart) + 1;
					amount = (amount * usedDays) / periodDays;
				}
			}
		}

		assertFiniteDepreciationValue("depreciation amount before cap", amount);
		const remainingBeforePeriod = carrying - salvage;
		assertFiniteDepreciationValue(
			"remaining depreciable value before period",
			remainingBeforePeriod,
		);
		amount = round(Math.min(amount, remainingBeforePeriod), precision);
		if (amount < 0) {
			throw new DepreciationScheduleCalculationError(
				"depreciation amount cannot be negative",
			);
		}
		if (amount === 0) break;
		accumulated = round(accumulated + amount, precision);
		carrying = round(input.grossBookValue - accumulated, precision);
		if (carrying < salvage) {
			amount = round(amount + carrying - salvage, precision);
			accumulated = round(accumulated + carrying - salvage, precision);
			carrying = salvage;
		}
		entries.push({
			periodNumber: periodsAlreadyBooked + index + 1,
			date: formatDate(scheduleDate),
			depreciationAmount: amount,
			accumulatedDepreciation: accumulated,
			bookValueAfterDepreciation: carrying,
			shift:
				allocation?.shift ?? (shiftEnabled ? DEFAULT_DEPRECIATION_SHIFT : null),
		});
		previousScheduleDate = scheduleDate;
		if (carrying <= salvage) break;
	}

	if (entries.length > 0 && carrying > salvage) {
		const last = entries[entries.length - 1];
		if (last) {
			const adjustment = round(carrying - salvage, precision);
			last.depreciationAmount = round(
				last.depreciationAmount + adjustment,
				precision,
			);
			last.accumulatedDepreciation = round(
				last.accumulatedDepreciation + adjustment,
				precision,
			);
			last.bookValueAfterDepreciation = salvage;
		}
	}

	const schedule = Object.freeze({
		financeBookId: input.financeBookId,
		method: input.method,
		ratePercent,
		entries: Object.freeze(entries),
	});
	assertFiniteDepreciationSchedule(schedule);
	return schedule;
};

/** Generates independent schedules for every supplied finance book. */
export const buildDepreciationSchedules = (
	books: readonly DepreciationBookInput[],
): readonly DepreciationSchedule[] =>
	Object.freeze(books.map((book) => buildDepreciationSchedule(book)));
