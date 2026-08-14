import {
	businessDate,
	dateOnlyFromPersistedDateTime,
	dateOnlyUtc,
	parseDateOnly,
} from "@aria/types";

/** Values returned by DateTime-backed Asset endpoints or canonical date inputs. */
export type AssetDateValue = Date | string | null | undefined;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts an Asset date-only response value at the persistence boundary.
 *
 * Date-only form state remains a canonical string. A `Date` or timestamp string
 * is accepted here only because existing DateTime-backed responses still need
 * hydration; it is interpreted with the explicitly named persisted-date-time
 * adapter rather than entering business logic as an instant.
 */
export function normalizeAssetDateValue(value: AssetDateValue): string {
	if (value == null || value === "") {
		throw new Error("Asset date-only value is required.");
	}
	if (value instanceof Date) {
		return dateOnlyFromPersistedDateTime(value);
	}
	if (DATE_ONLY_PATTERN.test(value)) {
		return parseDateOnly(value);
	}
	const instant = new Date(value);
	if (Number.isNaN(instant.getTime())) {
		throw new Error(`Invalid Asset date-only value: ${value}`);
	}
	return dateOnlyFromPersistedDateTime(instant);
}

/** Returns the stable value required by an HTML date input. */
export function dateInputValue(value: AssetDateValue): string {
	return value == null || value === "" ? "" : normalizeAssetDateValue(value);
}

/**
 * Returns the build-time business timezone derived from backend APP_TIME_ZONE.
 * A missing or invalid value is a configuration error, never a reason to
 * guess UTC in an Asset business-date decision.
 */
export function assetBusinessTimeZone(): string {
	const timeZone = process.env.NEXT_PUBLIC_APP_TIME_ZONE?.trim();
	if (!timeZone) {
		throw new Error(
			"APP_TIME_ZONE is required for Asset business-date decisions.",
		);
	}
	try {
		new Intl.DateTimeFormat("en", { timeZone }).format();
	} catch {
		throw new Error(`APP_TIME_ZONE is not a valid IANA timezone: ${timeZone}`);
	}
	return timeZone;
}

/** Returns today's calendar value in the authoritative application timezone. */
export function todayDateInputValue(now = new Date()): string {
	return businessDate(assetBusinessTimeZone(), now);
}

/** Formats a date-only value through UTC midnight so display does not drift by host timezone. */
export function formatAssetDate(
	value: AssetDateValue,
	locale = "en-IN",
): string {
	return dateOnlyUtc(normalizeAssetDateValue(value)).toLocaleDateString(
		locale,
		{
			year: "numeric",
			month: locale === "en-CA" ? "2-digit" : "short",
			day: "2-digit",
			timeZone: "UTC",
		},
	);
}
