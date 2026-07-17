export interface IndianFiscalYearDef {
	year: string;
	yearStartDate: Date;
	yearEndDate: Date;
}

/** Builds Indian April-to-March fiscal years around the supplied as-of date. */
export function buildIndianFiscalYears(asOf: Date): IndianFiscalYearDef[] {
	const asOfYear = asOf.getUTCFullYear();
	const currentStartYear = asOf.getUTCMonth() >= 3 ? asOfYear : asOfYear - 1;
	return [-3, -2, -1, 0, 1].map((offset) => {
		const startYear = currentStartYear + offset;
		return {
			year: `${startYear}-${String(startYear + 1).slice(-2)}`,
			yearStartDate: new Date(Date.UTC(startYear, 3, 1)),
			yearEndDate: new Date(Date.UTC(startYear + 1, 2, 31)),
		};
	});
}

function endOfUtcMonth(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

/** Resolves the first unbooked date so cron never reposts opening depreciation. */
export function resolveDemoDepreciationStartDate(
	asOf: Date,
	availableForUseDate: Date,
	openingBookedPeriods: number,
	frequencyMonths: number,
): Date {
	if (openingBookedPeriods === 0) return endOfUtcMonth(availableForUseDate);

	let nextDate = endOfUtcMonth(asOf);
	while (nextDate <= asOf) {
		nextDate = new Date(
			Date.UTC(
				nextDate.getUTCFullYear(),
				nextDate.getUTCMonth() + frequencyMonths + 1,
				0,
			),
		);
	}
	return nextDate;
}
