import { describe, expect, it } from "vitest";
import {
	buildSerialNoServiceContractExpiryListInput,
	formatCompactDate,
	formatDaysUntilExpiry,
	formatSerialNoServiceContractExpiryState,
} from "./serial-no-service-contract-expiry.utils";

describe("serial-no-service-contract-expiry utils", () => {
	it("builds the bounded report input with trimmed filters", () => {
		const result = buildSerialNoServiceContractExpiryListInput({
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
			sortBy: "serviceContractExpiryDate",
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
			sortBy: "serviceContractExpiryDate",
			sortDirection: "asc",
		});
	});

	it("drops invalid optional filters", () => {
		const result = buildSerialNoServiceContractExpiryListInput({
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
	});

	it("formats expiry labels and ageing values", () => {
		expect(formatSerialNoServiceContractExpiryState("EXPIRED")).toBe("Expired");
		expect(formatDaysUntilExpiry(-3)).toBe("3 d overdue");
		expect(formatDaysUntilExpiry(0)).toBe("Due today");
		expect(formatDaysUntilExpiry(12)).toBe("12 d left");
	});

	it("formats compact UTC dates", () => {
		expect(formatCompactDate(new Date("2026-04-15T00:00:00.000Z"))).toBe(
			"15 Apr 2026",
		);
		expect(formatCompactDate(null)).toBe("Not set");
	});
});
