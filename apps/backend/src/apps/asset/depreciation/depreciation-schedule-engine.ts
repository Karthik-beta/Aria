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
	salvageValue?: number;
	openingBookedPeriods?: number;
	openingAccumulatedDepreciation?: number;
	ratePercent?: number;
	dailyProrata?: boolean;
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

const isEndOfMonth = (date: Date): boolean =>
	date.getUTCDate() === daysInMonth(date.getUTCFullYear(), date.getUTCMonth());

const differenceInDays = (later: Date, earlier: Date): number =>
	Math.round((later.getTime() - earlier.getTime()) / MILLISECONDS_PER_DAY);

const round = (value: number, precision: number): number =>
	Number(value.toFixed(precision));

const defaultFiscalYear = (date: string): FiscalYearRange => {
	const parsed = parseDate(date);
	const year = parsed.getUTCFullYear();
	return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
};

const getScheduleDate = (
	startDate: Date,
	periodIndex: number,
	frequencyMonths: number,
	preserveMonthEnd: boolean,
): Date => {
	const date = addMonths(startDate, periodIndex * frequencyMonths);
	return preserveMonthEnd ? endOfMonth(date) : date;
};

const validateInput = (input: DepreciationBookInput): void => {
	parseDate(input.availableForUseDate);
	parseDate(input.depreciationStartDate);
	if (!Number.isFinite(input.grossBookValue) || input.grossBookValue <= 0) {
		throw new Error("grossBookValue must be greater than zero");
	}
	if (!Number.isInteger(input.totalPeriods) || input.totalPeriods <= 0) {
		throw new Error("totalPeriods must be a positive integer");
	}
	if (!Number.isInteger(input.frequencyMonths) || input.frequencyMonths <= 0) {
		throw new Error("frequencyMonths must be a positive integer");
	}

	const salvageValue = input.salvageValue ?? 0;
	const openingAccumulated = input.openingAccumulatedDepreciation ?? 0;
	const openingPeriods = input.openingBookedPeriods ?? 0;
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
	if (input.method === "MANUAL" && !input.manualEntries?.length) {
		throw new Error("Manual depreciation requires at least one manual entry");
	}
};

const calculateRate = (
	input: DepreciationBookInput,
	openingBookValue: number,
): number | null => {
	const ratePrecision = input.ratePrecision ?? 2;
	if (input.method === "DOUBLE_DECLINING_BALANCE") {
		const usefulLifeYears = (input.totalPeriods * input.frequencyMonths) / 12;
		return round(200 / usefulLifeYears, ratePrecision);
	}
	if (input.method !== "WRITTEN_DOWN_VALUE") return null;
	if ((input.ratePercent ?? 0) > 0) {
		return input.ratePercent ?? null;
	}

	const pendingPeriods = input.totalPeriods - (input.openingBookedPeriods ?? 0);
	const pendingYears = (pendingPeriods * input.frequencyMonths) / 12;
	const ratio = (input.salvageValue ?? 0) / openingBookValue;
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

	return Object.freeze({
		financeBookId: input.financeBookId,
		method: input.method,
		ratePercent: null,
		entries: Object.freeze(entries),
	});
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
	const openingAccumulated = round(
		input.openingAccumulatedDepreciation ?? 0,
		precision,
	);
	const salvage = round(input.salvageValue ?? 0, precision);
	const startDate = parseDate(input.depreciationStartDate);
	const availableDate = parseDate(input.availableForUseDate);
	const preserveMonthEnd = isEndOfMonth(startDate);
	const remainingPeriods = input.totalPeriods - openingPeriods;
	const openingBookValue = round(
		input.grossBookValue - openingAccumulated,
		precision,
	);
	const ratePercent = calculateRate(input, openingBookValue);
	const usefulLifeEndBase = addMonths(
		availableDate,
		input.totalPeriods * input.frequencyMonths,
	);
	const usefulLifeEnd =
		availableDate.getUTCDate() === 1 && preserveMonthEnd
			? addDays(usefulLifeEndBase, -1)
			: usefulLifeEndBase;
	const lastNominalDate = getScheduleDate(
		startDate,
		remainingPeriods - 1,
		input.frequencyMonths,
		preserveMonthEnd,
	);
	const hasFinalPartialPeriod = usefulLifeEnd > lastNominalDate;
	const generatedPeriods = remainingPeriods + (hasFinalPartialPeriod ? 1 : 0);
	const depreciableValue = round(input.grossBookValue - salvage, precision);
	const shiftByIndex = new Map(
		(input.shiftAllocations ?? []).map((allocation) => [
			allocation.periodIndex,
			allocation,
		]),
	);
	const shiftFactorsSum = input.shiftAllocations?.length
		? Array.from(
				{ length: input.totalPeriods },
				(_, i) => shiftByIndex.get(i)?.factor ?? 1,
			).reduce((a, b) => a + b, 0)
		: input.totalPeriods;
	const fixedPeriodAmount = depreciableValue / shiftFactorsSum;
	const fiscalYearFor = input.getFiscalYear ?? defaultFiscalYear;
	const totalLifeDays = differenceInDays(usefulLifeEndBase, availableDate);

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
			: getScheduleDate(
					startDate,
					index,
					input.frequencyMonths,
					preserveMonthEnd,
				);
		const allocation = shiftByIndex.get(index);
		const fiscalYear = fiscalYearFor(formatDate(scheduleDate));
		parseDate(fiscalYear.startDate);
		parseDate(fiscalYear.endDate);
		if (activeFiscalYearStart !== fiscalYear.startDate) {
			activeFiscalYearStart = fiscalYear.startDate;
			fiscalYearAnnualAmount =
				input.method === "STRAIGHT_LINE"
					? depreciableValue /
						((input.totalPeriods * input.frequencyMonths) / 12)
					: carrying * ((ratePercent ?? 0) / 100);
			fiscalYearPeriodicAmount =
				(fiscalYearAnnualAmount * input.frequencyMonths) / 12;
		}

		let amount: number;
		if (isFinalPartial) {
			amount = carrying - salvage;
		} else if (input.dailyProrata) {
			const coverageStart = previousScheduleDate
				? addDays(previousScheduleDate, 1)
				: openingPeriods > 0
					? addDays(
							preserveMonthEnd
								? endOfMonth(addMonths(startDate, -input.frequencyMonths))
								: addMonths(startDate, -input.frequencyMonths),
							1,
						)
					: availableDate;
			const coveredDays = differenceInDays(scheduleDate, coverageStart) + 1;
			if (input.calculateUsingTotalDays && input.method === "STRAIGHT_LINE") {
				amount = (depreciableValue / totalLifeDays) * coveredDays;
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

			if (index === 0 && openingPeriods === 0) {
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

		amount = round(Math.min(amount, carrying - salvage), precision);
		if (amount <= 0) break;
		accumulated = round(accumulated + amount, precision);
		carrying = round(input.grossBookValue - accumulated, precision);
		if (carrying < salvage) {
			amount = round(amount + carrying - salvage, precision);
			accumulated = round(accumulated + carrying - salvage, precision);
			carrying = salvage;
		}
		entries.push({
			periodNumber: openingPeriods + index + 1,
			date: formatDate(scheduleDate),
			depreciationAmount: amount,
			accumulatedDepreciation: accumulated,
			bookValueAfterDepreciation: carrying,
			shift: allocation?.shift ?? null,
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

	return Object.freeze({
		financeBookId: input.financeBookId,
		method: input.method,
		ratePercent,
		entries: Object.freeze(entries),
	});
};

/** Generates independent schedules for every supplied finance book. */
export const buildDepreciationSchedules = (
	books: readonly DepreciationBookInput[],
): readonly DepreciationSchedule[] =>
	Object.freeze(books.map((book) => buildDepreciationSchedule(book)));
