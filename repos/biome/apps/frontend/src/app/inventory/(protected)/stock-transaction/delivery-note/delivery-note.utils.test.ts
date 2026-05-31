import { describe, expect, it } from "vitest";
import {
	DELIVERY_NOTE_STATUS_OPTIONS,
	formatDeliveryNoteStatus,
	formatRelativeAge,
	getDeliveryNoteStatusBadgeClass,
	toDateInputValue,
} from "./delivery-note.utils";

describe("delivery-note.utils", () => {
	it("formatDeliveryNoteStatus returns human-readable labels", () => {
		expect(formatDeliveryNoteStatus("DRAFT")).toBe("Draft");
		expect(formatDeliveryNoteStatus("TO_BILL")).toBe("To Bill");
		expect(formatDeliveryNoteStatus("COMPLETED")).toBe("Completed");
		expect(formatDeliveryNoteStatus("RETURN_ISSUED")).toBe("Return Issued");
		expect(formatDeliveryNoteStatus("CANCELLED")).toBe("Cancelled");
		expect(formatDeliveryNoteStatus("CLOSED")).toBe("Closed");
	});

	it("getDeliveryNoteStatusBadgeClass returns a non-empty class string for every status", () => {
		for (const opt of DELIVERY_NOTE_STATUS_OPTIONS) {
			const cls = getDeliveryNoteStatusBadgeClass(opt.value);
			expect(cls).toBeTruthy();
			expect(typeof cls).toBe("string");
		}
	});

	it("DELIVERY_NOTE_STATUS_OPTIONS covers all six statuses", () => {
		expect(DELIVERY_NOTE_STATUS_OPTIONS).toHaveLength(6);
		const values = DELIVERY_NOTE_STATUS_OPTIONS.map((o) => o.value);
		expect(values).toEqual(
			expect.arrayContaining([
				"DRAFT",
				"TO_BILL",
				"COMPLETED",
				"RETURN_ISSUED",
				"CANCELLED",
				"CLOSED",
			]),
		);
	});

	it("formatRelativeAge returns 'Today' for a date that is today", () => {
		expect(formatRelativeAge(new Date())).toBe("Today");
	});

	it("toDateInputValue handles Date objects, strings, and falsy values", () => {
		expect(toDateInputValue(new Date("2026-03-15T00:00:00Z"))).toBe(
			"2026-03-15",
		);
		expect(toDateInputValue("2026-03-15T00:00:00Z")).toBe("2026-03-15");
		expect(toDateInputValue(null)).toBe("");
		expect(toDateInputValue(undefined)).toBe("");
		expect(toDateInputValue("not-a-date")).toBe("");
	});
});
