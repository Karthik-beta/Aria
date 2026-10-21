const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("en-IN", {
	year: "numeric",
	month: "short",
	day: "2-digit",
	timeZone: "UTC",
});

/**
 * Formats a date-only business value (for example a report date or a stored
 * schedule date) as "30 Apr 2026". Date-only values are held as UTC instants,
 * so they are rendered in UTC to show the same calendar day in every viewer
 * timezone. Do not use this for real timestamps; those should stay local.
 */
export function formatDateOnly(
	value: Date | string | null | undefined,
): string {
	if (!value) {
		return "-";
	}

	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}

	return DATE_ONLY_FORMATTER.format(date);
}
