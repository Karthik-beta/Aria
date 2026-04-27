import { describe, expect, it } from "vitest";
import {
	formatPickListPurpose,
	formatPickListStatus,
	formatRelativeAge,
	getPickListStatusBadgeClass,
	toDateInputValue,
} from "./pick-list.utils";

describe("pick-list.utils", () => {
	it("formats pick list status labels", () => {
		expect(formatPickListStatus("DRAFT")).toBe("Draft");
		expect(formatPickListStatus("OPEN")).toBe("Open");
		expect(formatPickListStatus("COMPLETED")).toBe("Completed");
		expect(formatPickListStatus("CANCELLED")).toBe("Cancelled");
	});

	it("returns the correct badge class for each status", () => {
		expect(getPickListStatusBadgeClass("DRAFT")).toContain("bg-muted");
		expect(getPickListStatusBadgeClass("OPEN")).toContain("bg-amber");
		expect(getPickListStatusBadgeClass("COMPLETED")).toContain("bg-emerald");
		expect(getPickListStatusBadgeClass("CANCELLED")).toContain("destructive");
	});

	it("formats pick list purpose labels", () => {
		expect(formatPickListPurpose("MATERIAL_TRANSFER_FOR_MANUFACTURE")).toBe(
			"Material Transfer for Manufacture",
		);
		expect(formatPickListPurpose("DELIVERY")).toBe("Delivery");
		expect(formatPickListPurpose("MATERIAL_TRANSFER")).toBe(
			"Material Transfer",
		);
	});

	it("formats date values for date input", () => {
		expect(toDateInputValue(new Date("2026-03-23T10:00:00.000Z"))).toBe(
			"2026-03-23",
		);
		expect(toDateInputValue("invalid")).toBe("");
		expect(toDateInputValue(null)).toBe("");
		expect(toDateInputValue(undefined)).toBe("");
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
