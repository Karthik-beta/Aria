import { describe, expect, it } from "vitest";
import {
	buildMaintenanceLogListInput,
	canCancelLog,
	canCompleteLog,
	formatDate,
	formatLogStatus,
	formatMaintenanceType,
	formatPeriodicity,
	getLogStatusVariant,
	getRelativeAge,
	toCompleteMaintenanceLogInput,
} from "./asset-maintenance-log.utils";

describe("asset-maintenance-log.utils", () => {
	// ---------------------------------------------------------------------------
	// formatLogStatus
	// ---------------------------------------------------------------------------

	describe("formatLogStatus", () => {
		it.each([
			["PLANNED", "Planned"],
			["COMPLETED", "Completed"],
			["CANCELLED", "Cancelled"],
			["OVERDUE", "Overdue"],
		] as const)("formats %s to %s", (status, expected) => {
			expect(formatLogStatus(status)).toBe(expected);
		});
	});

	// ---------------------------------------------------------------------------
	// getLogStatusVariant
	// ---------------------------------------------------------------------------

	describe("getLogStatusVariant", () => {
		it("returns orange for PLANNED", () => {
			expect(getLogStatusVariant("PLANNED")).toBe("orange");
		});

		it("returns green for COMPLETED", () => {
			expect(getLogStatusVariant("COMPLETED")).toBe("green");
		});

		it("returns red for CANCELLED", () => {
			expect(getLogStatusVariant("CANCELLED")).toBe("red");
		});

		it("returns red for OVERDUE", () => {
			expect(getLogStatusVariant("OVERDUE")).toBe("red");
		});
	});

	// ---------------------------------------------------------------------------
	// canCompleteLog / canCancelLog
	// ---------------------------------------------------------------------------

	describe("canCompleteLog", () => {
		it("returns true for PLANNED", () => {
			expect(canCompleteLog("PLANNED")).toBe(true);
		});

		it("returns true for OVERDUE", () => {
			expect(canCompleteLog("OVERDUE")).toBe(true);
		});

		it("returns false for COMPLETED", () => {
			expect(canCompleteLog("COMPLETED")).toBe(false);
		});

		it("returns false for CANCELLED", () => {
			expect(canCompleteLog("CANCELLED")).toBe(false);
		});
	});

	describe("canCancelLog", () => {
		it("returns true for PLANNED", () => {
			expect(canCancelLog("PLANNED")).toBe(true);
		});

		it("returns true for OVERDUE", () => {
			expect(canCancelLog("OVERDUE")).toBe(true);
		});

		it("returns false for COMPLETED", () => {
			expect(canCancelLog("COMPLETED")).toBe(false);
		});

		it("returns false for CANCELLED", () => {
			expect(canCancelLog("CANCELLED")).toBe(false);
		});
	});

	// ---------------------------------------------------------------------------
	// formatDate
	// ---------------------------------------------------------------------------

	describe("formatDate", () => {
		it("returns '—' for null", () => {
			expect(formatDate(null)).toBe("—");
		});

		it("returns '—' for undefined", () => {
			expect(formatDate(undefined)).toBe("—");
		});

		it("formats a valid date as YYYY-MM-DD", () => {
			// en-CA locale returns YYYY-MM-DD
			const result = formatDate(new Date("2026-03-15T00:00:00Z"));
			expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});
	});

	// ---------------------------------------------------------------------------
	// getRelativeAge
	// ---------------------------------------------------------------------------

	describe("getRelativeAge", () => {
		it("returns 'Today' for a very recent date", () => {
			const now = new Date();
			expect(getRelativeAge(now)).toBe("Today");
		});

		it("returns days count for a date within a month", () => {
			const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
			expect(getRelativeAge(fiveDaysAgo)).toBe("5 d");
		});

		it("returns months count for a date within a year", () => {
			const twoMonthsAgo = new Date(Date.now() - 65 * 24 * 60 * 60 * 1000);
			expect(getRelativeAge(twoMonthsAgo)).toBe("2 m");
		});

		it("returns years for a very old date", () => {
			const threeYearsAgo = new Date(
				Date.now() - 3 * 365 * 24 * 60 * 60 * 1000,
			);
			expect(getRelativeAge(threeYearsAgo)).toBe("3 y");
		});
	});

	// ---------------------------------------------------------------------------
	// buildMaintenanceLogListInput
	// ---------------------------------------------------------------------------

	describe("buildMaintenanceLogListInput", () => {
		it("builds input with skip/take from page index and size", () => {
			const result = buildMaintenanceLogListInput({
				search: "",
				status: "",
				pageIndex: 2,
				pageSize: 20,
			});
			expect(result.skip).toBe(40);
			expect(result.take).toBe(20);
		});

		it("omits search when empty", () => {
			const result = buildMaintenanceLogListInput({
				search: "",
				status: "",
				pageIndex: 0,
				pageSize: 20,
			});
			expect(result.search).toBeUndefined();
		});

		it("includes search when provided", () => {
			const result = buildMaintenanceLogListInput({
				search: "pump",
				status: "",
				pageIndex: 0,
				pageSize: 20,
			});
			expect(result.search).toBe("pump");
		});

		it("includes status filter when set", () => {
			const result = buildMaintenanceLogListInput({
				search: "",
				status: "OVERDUE",
				pageIndex: 0,
				pageSize: 20,
			});
			expect(result.status).toBe("OVERDUE");
		});

		it("omits status when empty string", () => {
			const result = buildMaintenanceLogListInput({
				search: "",
				status: "",
				pageIndex: 0,
				pageSize: 20,
			});
			expect(result.status).toBeUndefined();
		});
	});

	// ---------------------------------------------------------------------------
	// toCompleteMaintenanceLogInput
	// ---------------------------------------------------------------------------

	describe("toCompleteMaintenanceLogInput", () => {
		it("returns correct payload for basic completion", () => {
			const result = toCompleteMaintenanceLogInput("log-001", {
				completionDate: "2026-03-15",
				actionsPerformed: "Replaced filter",
				hasCertificate: false,
				certificateAttachment: "",
			});

			expect(result.logId).toBe("log-001");
			expect(result.completionDate).toBe("2026-03-15");
			expect(result.actionsPerformed).toBe("Replaced filter");
			expect(result.hasCertificate).toBe(false);
			expect(result.certificateAttachment).toBeNull();
		});

		it("includes certificate attachment when hasCertificate is true", () => {
			const result = toCompleteMaintenanceLogInput("log-002", {
				completionDate: "2026-03-15",
				actionsPerformed: "",
				hasCertificate: true,
				certificateAttachment: "https://example.com/cert.pdf",
			});

			expect(result.hasCertificate).toBe(true);
			expect(result.certificateAttachment).toBe("https://example.com/cert.pdf");
		});

		it("sets certificateAttachment to null when hasCertificate is false even if value provided", () => {
			const result = toCompleteMaintenanceLogInput("log-003", {
				completionDate: "2026-03-15",
				actionsPerformed: "",
				hasCertificate: false,
				certificateAttachment: "some-path",
			});

			expect(result.certificateAttachment).toBeNull();
		});

		it("sets actionsPerformed to null when empty string", () => {
			const result = toCompleteMaintenanceLogInput("log-004", {
				completionDate: "2026-03-15",
				actionsPerformed: "",
				hasCertificate: false,
				certificateAttachment: "",
			});

			expect(result.actionsPerformed).toBeNull();
		});

		it("trims whitespace from actionsPerformed", () => {
			const result = toCompleteMaintenanceLogInput("log-005", {
				completionDate: "2026-03-15",
				actionsPerformed: "  Lubricated bearings  ",
				hasCertificate: false,
				certificateAttachment: "",
			});

			expect(result.actionsPerformed).toBe("Lubricated bearings");
		});
	});

	// ---------------------------------------------------------------------------
	// formatMaintenanceType
	// ---------------------------------------------------------------------------

	describe("formatMaintenanceType", () => {
		it("returns '—' for null", () => {
			expect(formatMaintenanceType(null)).toBe("—");
		});

		it("formats PREVENTIVE_MAINTENANCE", () => {
			expect(formatMaintenanceType("PREVENTIVE_MAINTENANCE")).toBe(
				"Preventive",
			);
		});

		it("formats CALIBRATION", () => {
			expect(formatMaintenanceType("CALIBRATION")).toBe("Calibration");
		});
	});

	// ---------------------------------------------------------------------------
	// formatPeriodicity
	// ---------------------------------------------------------------------------

	describe("formatPeriodicity", () => {
		it.each([
			["DAILY", "Daily"],
			["WEEKLY", "Weekly"],
			["MONTHLY", "Monthly"],
			["QUARTERLY", "Quarterly"],
			["HALF_YEARLY", "Half Yearly"],
			["YEARLY", "Yearly"],
			["TWO_YEARLY", "2 Yearly"],
			["THREE_YEARLY", "3 Yearly"],
		] as const)("formats %s to %s", (periodicity, expected) => {
			expect(formatPeriodicity(periodicity)).toBe(expected);
		});
	});
});
