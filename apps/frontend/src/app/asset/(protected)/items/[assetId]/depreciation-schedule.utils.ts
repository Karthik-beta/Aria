import type { Asset } from "@aria/types";

type DateLike = Date | string;

type DepreciationScheduleEntryInput = Omit<
	Asset.AssetDepreciationScheduleEntry,
	"scheduleDate" | "postedAt" | "createdAt" | "updatedAt"
> & {
	scheduleDate: DateLike;
	postedAt: DateLike | null;
	createdAt: DateLike;
	updatedAt: DateLike;
};

export type DepreciationScheduleInput = Omit<
	Asset.AssetDepreciationSchedule,
	"startDate" | "createdAt" | "updatedAt" | "entries"
> & {
	startDate: DateLike;
	createdAt: DateLike;
	updatedAt: DateLike;
	entries: DepreciationScheduleEntryInput[];
};

function toValidDate(value: unknown): Date | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	if (typeof value !== "string" && typeof value !== "number") {
		return null;
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Normalize dates returned by the JSON tRPC transformer before rendering.
 *
 * The API contract uses Date values, while a JSON transport can deliver date
 * fields as strings. Invalid schedules/entries are omitted so the detail page
 * never renders an invalid date or throws while formatting a schedule.
 */
export function normalizeDepreciationSchedules(
	value: readonly DepreciationScheduleInput[] | null | undefined,
): Asset.AssetDepreciationSchedule[] {
	if (!value) return [];

	return value.flatMap((schedule) => {
		const startDate = toValidDate(schedule.startDate);
		const createdAt = toValidDate(schedule.createdAt);
		const updatedAt = toValidDate(schedule.updatedAt);
		if (!startDate || !createdAt || !updatedAt) return [];

		const entries = schedule.entries.flatMap((entry) => {
			const scheduleDate = toValidDate(entry.scheduleDate);
			const entryCreatedAt = toValidDate(entry.createdAt);
			const entryUpdatedAt = toValidDate(entry.updatedAt);
			if (!scheduleDate || !entryCreatedAt || !entryUpdatedAt) return [];
			const postedAt =
				entry.postedAt == null ? null : toValidDate(entry.postedAt);

			return [
				{
					...entry,
					scheduleDate,
					postedAt,
					createdAt: entryCreatedAt,
					updatedAt: entryUpdatedAt,
				},
			];
		});

		return [
			{
				...schedule,
				startDate,
				createdAt,
				updatedAt,
				entries,
			},
		];
	});
}
