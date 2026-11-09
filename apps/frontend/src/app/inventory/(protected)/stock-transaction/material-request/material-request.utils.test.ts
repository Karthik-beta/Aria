import { describe, expect, it } from "vitest";
import {
	formatMaterialRequestPurpose,
	formatMaterialRequestStatus,
	formatRelativeAge,
	getMaterialRequestStatusBadgeClass,
	toDateInputValue,
} from "./material-request.utils";

describe("material-request.utils", () => {
	it("formats material request status labels", () => {
		expect(formatMaterialRequestStatus("DRAFT")).toBe("Draft");
		expect(formatMaterialRequestStatus("PENDING")).toBe("Pending");
		expect(formatMaterialRequestStatus("APPROVED")).toBe("Approved");
		expect(formatMaterialRequestStatus("ORDERED")).toBe("Ordered");
		expect(formatMaterialRequestStatus("PARTIALLY_ORDERED")).toBe(
			"Partially Ordered",
		);
		expect(formatMaterialRequestStatus("PARTIALLY_RECEIVED")).toBe(
			"Partially Received",
		);
		expect(formatMaterialRequestStatus("RECEIVED")).toBe("Received");
		expect(formatMaterialRequestStatus("CANCELLED")).toBe("Cancelled");
	});

	it("returns the correct badge class for each status", () => {
		expect(getMaterialRequestStatusBadgeClass("DRAFT")).toContain("bg-zinc");
		expect(getMaterialRequestStatusBadgeClass("PENDING")).toContain(
			"bg-orange",
		);
		expect(getMaterialRequestStatusBadgeClass("APPROVED")).toContain("bg-blue");
		expect(getMaterialRequestStatusBadgeClass("ORDERED")).toContain("bg-sky");
		expect(getMaterialRequestStatusBadgeClass("PARTIALLY_ORDERED")).toContain(
			"bg-yellow",
		);
		expect(getMaterialRequestStatusBadgeClass("PARTIALLY_RECEIVED")).toContain(
			"bg-yellow",
		);
		expect(getMaterialRequestStatusBadgeClass("RECEIVED")).toContain(
			"bg-green",
		);
		expect(getMaterialRequestStatusBadgeClass("CANCELLED")).toContain("bg-red");
	});

	it("formats material request purpose labels", () => {
		expect(formatMaterialRequestPurpose("PURCHASE")).toBe("Purchase");
		expect(formatMaterialRequestPurpose("MANUFACTURE")).toBe("Manufacture");
		expect(formatMaterialRequestPurpose("MATERIAL_TRANSFER")).toBe(
			"Material Transfer",
		);
		expect(formatMaterialRequestPurpose("MATERIAL_ISSUE")).toBe(
			"Material Issue",
		);
		expect(formatMaterialRequestPurpose("CUSTOMER_PROVIDED")).toBe(
			"Customer Provided",
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
