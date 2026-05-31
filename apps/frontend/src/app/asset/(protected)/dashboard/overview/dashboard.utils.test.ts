import { describe, expect, it } from "vitest";
import {
	formatAdjustmentStatus,
	formatAssetStatus,
	formatCompactCurrency,
	formatMonth,
	formatRelativeDate,
	formatShortDate,
	getActiveAssetsInsight,
	getAssetValueInsight,
	getInsuranceUrgency,
	getMaintenanceDueInsight,
	getMaintenanceUrgency,
	getPendingAdjustmentsInsight,
} from "./dashboard.utils";

// ── formatCompactCurrency ─────────────────────────────────────────────

describe("formatCompactCurrency", () => {
	it("formats crores", () => {
		expect(formatCompactCurrency(15_000_000)).toBe("₹1.5Cr");
	});

	it("formats lakhs", () => {
		expect(formatCompactCurrency(250_000)).toBe("₹2.5L");
	});

	it("formats thousands", () => {
		expect(formatCompactCurrency(3_000)).toBe("₹3.0K");
	});

	it("formats values below 1000 directly", () => {
		expect(formatCompactCurrency(500)).toBe("₹500");
	});

	it("formats zero", () => {
		expect(formatCompactCurrency(0)).toBe("₹0");
	});
});

// ── formatAssetStatus ─────────────────────────────────────────────────

describe("formatAssetStatus", () => {
	it("formats known statuses", () => {
		expect(formatAssetStatus("SUBMITTED")).toBe("Submitted");
		expect(formatAssetStatus("PARTIALLY_DEPRECIATED")).toBe(
			"Partially Depreciated",
		);
		expect(formatAssetStatus("IN_MAINTENANCE")).toBe("In Maintenance");
	});

	it("falls back to underscored format for unknown status", () => {
		expect(formatAssetStatus("SOME_UNKNOWN")).toBe("SOME UNKNOWN");
	});
});

// ── formatAdjustmentStatus ────────────────────────────────────────────

describe("formatAdjustmentStatus", () => {
	it("formats known statuses", () => {
		expect(formatAdjustmentStatus("DRAFT")).toBe("Draft");
		expect(formatAdjustmentStatus("SUBMITTED")).toBe("Submitted");
		expect(formatAdjustmentStatus("CANCELLED")).toBe("Cancelled");
	});

	it("returns raw value for unknown statuses", () => {
		expect(formatAdjustmentStatus("UNKNOWN")).toBe("UNKNOWN");
	});
});

// ── formatMonth ───────────────────────────────────────────────────────

describe("formatMonth", () => {
	it("formats YYYY-MM to abbreviated month and year", () => {
		const result = formatMonth("2025-01");
		expect(result).toMatch(/Jan/);
		expect(result).toMatch(/25/);
	});
});

// ── formatRelativeDate ───────────────────────────────────────────────

describe("formatRelativeDate", () => {
	it("uses the supplied reference time for relative labels", () => {
		const referenceTime = Date.parse("2026-04-10T12:00:00.000Z");

		expect(formatRelativeDate("2026-04-10T11:30:00.000Z", referenceTime)).toBe(
			"30m ago",
		);
	});

	it("formats older dates with a stable UTC calendar day", () => {
		const referenceTime = Date.parse("2026-04-10T12:00:00.000Z");

		expect(formatRelativeDate("2026-03-29T23:30:00.000Z", referenceTime)).toBe(
			"29 Mar",
		);
	});
});

// ── formatShortDate ──────────────────────────────────────────────────

describe("formatShortDate", () => {
	it("formats chart dates with a stable UTC calendar day", () => {
		expect(formatShortDate("2026-03-29T23:30:00.000Z")).toBe("29 Mar");
	});
});

// ── getMaintenanceUrgency ─────────────────────────────────────────────

describe("getMaintenanceUrgency", () => {
	it("returns Overdue for negative days", () => {
		const result = getMaintenanceUrgency(-5);
		expect(result.label).toBe("Overdue");
		expect(result.className).toContain("red");
	});

	it("returns Overdue for zero days", () => {
		expect(getMaintenanceUrgency(0).label).toBe("Overdue");
	});

	it("returns Urgent for 1-7 days", () => {
		expect(getMaintenanceUrgency(3).label).toBe("Urgent");
		expect(getMaintenanceUrgency(7).label).toBe("Urgent");
	});

	it("returns Soon for 8-30 days", () => {
		expect(getMaintenanceUrgency(15).label).toBe("Soon");
		expect(getMaintenanceUrgency(30).label).toBe("Soon");
	});

	it("returns Upcoming for 31-60 days", () => {
		expect(getMaintenanceUrgency(45).label).toBe("Upcoming");
	});

	it("returns Planned for >60 days", () => {
		expect(getMaintenanceUrgency(90).label).toBe("Planned");
		expect(getMaintenanceUrgency(90).className).toContain("green");
	});
});

// ── getInsuranceUrgency ───────────────────────────────────────────────

describe("getInsuranceUrgency", () => {
	it("returns Expired for negative days", () => {
		expect(getInsuranceUrgency(-1).label).toBe("Expired");
	});

	it("returns Expired for zero days", () => {
		expect(getInsuranceUrgency(0).label).toBe("Expired");
	});

	it("returns Critical for 1-7 days", () => {
		expect(getInsuranceUrgency(5).label).toBe("Critical");
	});

	it("returns Warning for 8-30 days", () => {
		expect(getInsuranceUrgency(20).label).toBe("Warning");
	});

	it("returns Upcoming for 31-60 days", () => {
		expect(getInsuranceUrgency(45).label).toBe("Upcoming");
	});

	it("returns OK for >60 days", () => {
		expect(getInsuranceUrgency(90).label).toBe("OK");
		expect(getInsuranceUrgency(90).className).toContain("green");
	});
});

// ── getAssetValueInsight ──────────────────────────────────────────────

describe("getAssetValueInsight", () => {
	it("returns no-assets message when purchase value is 0", () => {
		const result = getAssetValueInsight(0, 0);
		expect(result.text).toBe("No assets registered yet");
		expect(result.subtext).toBe("Add assets to begin tracking value");
	});

	it("computes retention percentage", () => {
		const result = getAssetValueInsight(800_000, 1_000_000);
		expect(result.text).toBe("80% value retained");
		expect(result.subtext).toBe("Purchase cost ₹10.0L");
	});

	it("shows 100% when fully retained", () => {
		const result = getAssetValueInsight(500_000, 500_000);
		expect(result.text).toBe("100% value retained");
	});
});

// ── getActiveAssetsInsight ────────────────────────────────────────────

describe("getActiveAssetsInsight", () => {
	it("returns no-assets message when total is 0", () => {
		const result = getActiveAssetsInsight(0, 0, 0);
		expect(result.text).toBe("No assets in registry");
		expect(result.subtext).toBe("Create assets to begin tracking");
	});

	it("computes operational percentage", () => {
		const result = getActiveAssetsInsight(8, 10, 3);
		expect(result.text).toBe("80% operational");
		expect(result.subtext).toBe("Across 3 locations");
	});

	it("uses singular location label", () => {
		const result = getActiveAssetsInsight(5, 5, 1);
		expect(result.subtext).toBe("Across 1 location");
	});
});

// ── getMaintenanceDueInsight ──────────────────────────────────────────

describe("getMaintenanceDueInsight", () => {
	it("returns all-clear when count is 0", () => {
		const result = getMaintenanceDueInsight(0);
		expect(result.text).toBe("All maintenance up to date");
		expect(result.colorClass).toBe("text-green-600 dark:text-green-400");
	});

	it("returns tasks due message with singular", () => {
		const result = getMaintenanceDueInsight(1);
		expect(result.text).toBe("1 task due now");
		expect(result.colorClass).toBe("text-destructive");
	});

	it("returns tasks due message with plural", () => {
		const result = getMaintenanceDueInsight(5);
		expect(result.text).toBe("5 tasks due now");
	});
});

// ── getPendingAdjustmentsInsight ──────────────────────────────────────

describe("getPendingAdjustmentsInsight", () => {
	it("returns no-pending when count is 0", () => {
		const result = getPendingAdjustmentsInsight(0);
		expect(result.text).toBe("No pending adjustments");
		expect(result.colorClass).toBe("text-green-600 dark:text-green-400");
	});

	it("returns drafts awaiting review with singular", () => {
		const result = getPendingAdjustmentsInsight(1);
		expect(result.text).toBe("1 draft awaiting review");
	});

	it("returns drafts awaiting review with plural", () => {
		const result = getPendingAdjustmentsInsight(3);
		expect(result.text).toBe("3 drafts awaiting review");
	});
});
