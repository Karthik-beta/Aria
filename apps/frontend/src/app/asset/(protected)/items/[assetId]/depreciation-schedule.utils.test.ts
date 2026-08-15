import { describe, expect, it } from "vitest";
import { normalizeDepreciationSchedules } from "./depreciation-schedule.utils";

const schedule = {
	id: "schedule-1",
	adjustmentId: null,
	assetId: "asset-1",
	assetFinanceBookId: "book-1",
	previousScheduleId: null,
	revisionNumber: 1,
	status: "ACTIVE" as const,
	startDate: "2026-01-01T00:00:00.000Z",
	depreciationMethod: "STRAIGHT_LINE" as const,
	totalNumberOfDepreciations: 12,
	frequencyOfDepreciation: 1,
	dailyProrataBased: false,
	shiftBased: false,
	precision: 2,
	ratePrecision: 2,
	calculateUsingTotalDays: false,
	bookedDepreciations: 0,
	remainingDepreciations: 12,
	openingAccumulatedDepreciation: 0,
	baseAssetValue: 1200,
	notes: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	entries: [
		{
			id: "entry-1",
			sequence: 1,
			scheduleDate: "2026-02-01T00:00:00.000Z",
			depreciationAmount: 100,
			accumulatedDepreciationAmount: 100,
			bookValueAfterDepreciation: 1100,
			shift: null,
			postingId: null,
			postedAt: null,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
		},
	],
};

describe("normalizeDepreciationSchedules", () => {
	it("normalizes schedule and entry date strings", () => {
		const [normalized] = normalizeDepreciationSchedules([schedule]);

		expect(normalized?.startDate).toBe("2026-01-01");
		expect(normalized?.createdAt).toBeInstanceOf(Date);
		expect(normalized?.entries[0]?.scheduleDate).toBe("2026-02-01");
	});

	it("handles an empty or missing schedule collection", () => {
		expect(normalizeDepreciationSchedules([])).toEqual([]);
		expect(normalizeDepreciationSchedules(undefined)).toEqual([]);
	});

	it("preserves null postedAt values and normalizes posted dates", () => {
		const [normalized] = normalizeDepreciationSchedules([
			schedule,
			{
				...schedule,
				id: "schedule-2",
				entries: [
					{
						...schedule.entries[0],
						id: "entry-2",
						postedAt: "2026-02-02T00:00:00.000Z",
					},
				],
			},
		]);
		const second = normalizeDepreciationSchedules([
			{
				...schedule,
				id: "schedule-2",
				entries: [
					{
						...schedule.entries[0],
						id: "entry-2",
						postedAt: "2026-02-02T00:00:00.000Z",
					},
				],
			},
		])[0];

		expect(normalized?.entries[0]?.postedAt).toBeNull();
		expect(second?.entries[0]?.postedAt).toBeInstanceOf(Date);
	});

	it("drops schedules and entries with invalid or missing dates", () => {
		const [normalized] = normalizeDepreciationSchedules([
			{
				...schedule,
				startDate: "not-a-date",
			},
			schedule,
			{
				...schedule,
				id: "schedule-3",
				entries: [{ ...schedule.entries[0], scheduleDate: "invalid" }],
			},
		]);

		expect(normalized?.id).toBe("schedule-1");
		const withInvalidEntry = normalizeDepreciationSchedules([
			{
				...schedule,
				id: "schedule-3",
				entries: [{ ...schedule.entries[0], scheduleDate: "invalid" }],
			},
		])[0];
		expect(withInvalidEntry?.entries).toEqual([]);
	});
});
