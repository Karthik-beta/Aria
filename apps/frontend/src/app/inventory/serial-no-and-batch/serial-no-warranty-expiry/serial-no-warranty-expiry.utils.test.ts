import { describe, expect, it } from "vitest";
import {
	buildSerialNoWarrantyExpiryListInput,
	formatSerialNoWarrantyExpiryState,
	formatWarrantyCompactDate,
	formatWarrantyDaysUntilExpiry,
} from "./serial-no-warranty-expiry.utils";

describe("serial-no-warranty-expiry utils", () => {
	it("builds the bounded report input with trimmed filters", () => {
		const result = buildSerialNoWarrantyExpiryListInput({
			search: " SN-1001 ",
			itemId: "item-1",
			warehouseId: "",
			company: " Aria Corp ",
			status: "AVAILABLE",
			expiryState: "DUE_SOON",
			includeDisabled: false,
			expiryDateFrom: "2026-04-01",
			expiryDateTo: "2026-04-30",
			expiringWithinDays: "45",
			pageIndex: 2,
			pageSize: 20,
			sortBy: "warrantyExpiryDate",
			sortDirection: "asc",
		});

		expect(result).toEqual({
			skip: 40,
			take: 20,
			search: "SN-1001",
			itemId: "item-1",
			warehouseId: undefined,
			company: "Aria Corp",
			status: "AVAILABLE",
			expiryState: "DUE_SOON",
			includeDisabled: false,
			expiryDateFrom: new Date("2026-04-01T00:00:00.000Z"),
			expiryDateTo: new Date("2026-04-30T00:00:00.000Z"),
			expiringWithinDays: 45,
			sortBy: "warrantyExpiryDate",
			sortDirection: "asc",
		});
	});

	it("drops invalid optional filters when empty or all", () => {
		const result = buildSerialNoWarrantyExpiryListInput({
			search: "",
			itemId: "",
			warehouseId: "",
			company: "",
			status: "all",
			expiryState: "all",
			includeDisabled: true,
			expiryDateFrom: "",
			expiryDateTo: "",
			expiringWithinDays: "-1",
			pageIndex: 0,
			pageSize: 20,
			sortBy: "updatedAt",
			sortDirection: "desc",
		});

		expect(result.expiringWithinDays).toBeUndefined();
		expect(result.status).toBeUndefined();
		expect(result.expiryState).toBeUndefined();
		expect(result.search).toBeUndefined();
		expect(result.itemId).toBeUndefined();
		expect(result.warehouseId).toBeUndefined();
		expect(result.company).toBeUndefined();
		expect(result.expiryDateFrom).toBeUndefined();
		expect(result.expiryDateTo).toBeUndefined();
		expect(result.includeDisabled).toBe(true);
	});

	it("computes correct skip for pagination", () => {
		const result = buildSerialNoWarrantyExpiryListInput({
			search: "",
			itemId: "",
			warehouseId: "",
			company: "",
			status: "all",
			expiryState: "all",
			includeDisabled: false,
			expiryDateFrom: "",
			expiryDateTo: "",
			expiringWithinDays: "30",
			pageIndex: 3,
			pageSize: 20,
			sortBy: "serialNo",
			sortDirection: "asc",
		});

		expect(result.skip).toBe(60);
		expect(result.take).toBe(20);
		expect(result.expiringWithinDays).toBe(30);
	});

	it("formats expiry state labels", () => {
		expect(formatSerialNoWarrantyExpiryState("EXPIRED")).toBe("Expired");
		expect(formatSerialNoWarrantyExpiryState("DUE_SOON")).toBe("Due Soon");
		expect(formatSerialNoWarrantyExpiryState("ACTIVE")).toBe("Active");
	});

	it("formats ageing days values correctly", () => {
		expect(formatWarrantyDaysUntilExpiry(-3)).toBe("3 d overdue");
		expect(formatWarrantyDaysUntilExpiry(0)).toBe("Due today");
		expect(formatWarrantyDaysUntilExpiry(12)).toBe("12 d left");
	});

	it("formats compact UTC dates", () => {
		expect(
			formatWarrantyCompactDate(new Date("2026-04-15T00:00:00.000Z")),
		).toBe("15 Apr 2026");
		expect(formatWarrantyCompactDate(null)).toBe("Not set");
		expect(formatWarrantyCompactDate(undefined)).toBe("Not set");
	});

	it("uses non-negative skip bound", () => {
		const result = buildSerialNoWarrantyExpiryListInput({
			search: "",
			itemId: "",
			warehouseId: "",
			company: "",
			status: "all",
			expiryState: "all",
			includeDisabled: false,
			expiryDateFrom: "",
			expiryDateTo: "",
			expiringWithinDays: "30",
			pageIndex: -1,
			pageSize: 20,
			sortBy: "warrantyExpiryDate",
			sortDirection: "asc",
		});

		expect(result.skip).toBe(0);
	});
});
