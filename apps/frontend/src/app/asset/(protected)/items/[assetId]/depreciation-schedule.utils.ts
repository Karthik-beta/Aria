import type { Asset } from "@aria/types";
import { dateInputValue } from "@/lib/asset-date-only";

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
 * Date-only schedule fields remain canonical strings; true timestamps are
 * hydrated as Date values for the existing detail-page rendering paths.
 */
export function normalizeDepreciationSchedules(
	value: readonly DepreciationScheduleInput[] | null | undefined,
): Asset.AssetDepreciationSchedule[] {
	if (!value) return [];

	return value.flatMap((schedule) => {
		let startDate: string;
		try {
			startDate = dateInputValue(schedule.startDate);
		} catch {
			return [];
		}
		const createdAt = toValidDate(schedule.createdAt);
		const updatedAt = toValidDate(schedule.updatedAt);
		if (!startDate || !createdAt || !updatedAt) return [];

		const entries = schedule.entries.flatMap((entry) => {
			let scheduleDate: string;
			try {
				scheduleDate = dateInputValue(entry.scheduleDate);
			} catch {
				return [];
			}
			const entryCreatedAt = toValidDate(entry.createdAt);
			const entryUpdatedAt = toValidDate(entry.updatedAt);
			if (!entryCreatedAt || !entryUpdatedAt) return [];
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
