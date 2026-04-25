import { describe, expect, it } from "vitest";
import {
	formatDeliveryTripStatus,
	formatRelativeAge,
	getDeliveryTripStatusBadgeClass,
	toDateTimeLocalInputValue,
} from "./delivery-trip.utils";

describe("delivery-trip.utils", () => {
	it("formats delivery trip status labels", () => {
		expect(formatDeliveryTripStatus("DRAFT")).toBe("Draft");
		expect(formatDeliveryTripStatus("SCHEDULED")).toBe("Scheduled");
		expect(formatDeliveryTripStatus("IN_TRANSIT")).toBe("In Transit");
		expect(formatDeliveryTripStatus("COMPLETED")).toBe("Completed");
		expect(formatDeliveryTripStatus("CANCELLED")).toBe("Cancelled");
	});

	it("returns the correct badge class for each status", () => {
		expect(getDeliveryTripStatusBadgeClass("DRAFT")).toContain("bg-muted");
		expect(getDeliveryTripStatusBadgeClass("SCHEDULED")).toContain("bg-amber");
		expect(getDeliveryTripStatusBadgeClass("IN_TRANSIT")).toContain("bg-blue");
		expect(getDeliveryTripStatusBadgeClass("COMPLETED")).toContain(
			"bg-emerald",
		);
		expect(getDeliveryTripStatusBadgeClass("CANCELLED")).toContain(
			"destructive",
		);
	});

	it("formats datetime values for datetime-local input", () => {
		expect(
			toDateTimeLocalInputValue(new Date("2026-03-23T10:30:00.000Z")),
		).toBe("2026-03-23T10:30");
		expect(toDateTimeLocalInputValue("invalid")).toBe("");
		expect(toDateTimeLocalInputValue(null)).toBe("");
		expect(toDateTimeLocalInputValue(undefined)).toBe("");
	});

	it("formats relative age from Date", () => {
		const now = new Date();
		expect(formatRelativeAge(now)).toBe("Today");

		const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
		expect(formatRelativeAge(twoDaysAgo)).toBe("2 d");

		const twoMonthsAgo = new Date(now.getTime() - 62 * 24 * 60 * 60 * 1000);
		expect(formatRelativeAge(twoMonthsAgo)).toBe("2 m");

		const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
		expect(formatRelativeAge(twoYearsAgo)).toBe("2 y");
	});
});
