import { describe, expect, it } from "vitest";
import {
	buildSerialNoStatusListInput,
	formatDaysInCurrentStatus,
	groupSerialNoStatusRows,
} from "./serial-no-status.utils";

describe("serial-no-status utils", () => {
	it("builds bounded list input and trims optional fields", () => {
		expect(
			buildSerialNoStatusListInput({
				search: "  SN-001  ",
				itemId: "item-1",
				warehouseId: "",
				company: "  Aria Corp ",
				status: "AVAILABLE",
				includeDisabled: true,
				sortBy: "status",
				sortDirection: "asc",
			}),
		).toEqual({
			skip: 0,
			take: 250,
			search: "SN-001",
			itemId: "item-1",
			warehouseId: undefined,
			company: "Aria Corp",
			status: "AVAILABLE",
			includeDisabled: true,
			sortBy: "status",
			sortDirection: "asc",
		});
	});

	it("groups rows and derives disabled and average ageing metrics", () => {
		const result = groupSerialNoStatusRows(
			[
				{
					id: "1",
					serialNo: "SN-1",
					itemId: "item-1",
					itemCode: "ITEM-1",
					itemName: "Item 1",
					company: "Aria Corp",
					status: "AVAILABLE",
					currentWarehouseId: "warehouse-1",
					currentWarehouseName: "Stores",
					purchaseReceiptId: null,
					purchaseReceiptSeries: null,
					deliveryNoteId: null,
					deliveryNoteSeries: null,
					stockEntryId: null,
					stockEntrySeries: null,
					pickListId: null,
					pickListSeries: null,
					workOrder: null,
					purchaseDate: null,
					warrantyExpiryDate: null,
					serviceContractExpiryDate: null,
					lastStatusChangedAt: new Date("2026-03-20T00:00:00.000Z"),
					daysInCurrentStatus: 4,
					maintenanceStatus: null,
					notes: null,
					isDisabled: false,
					createdAt: new Date("2026-03-20T00:00:00.000Z"),
					updatedAt: new Date("2026-03-21T00:00:00.000Z"),
				},
				{
					id: "2",
					serialNo: "SN-2",
					itemId: "item-2",
					itemCode: "ITEM-2",
					itemName: "Item 2",
					company: "Aria Corp",
					status: "AVAILABLE",
					currentWarehouseId: "warehouse-2",
					currentWarehouseName: "Stores",
					purchaseReceiptId: null,
					purchaseReceiptSeries: null,
					deliveryNoteId: null,
					deliveryNoteSeries: null,
					stockEntryId: null,
					stockEntrySeries: null,
					pickListId: null,
					pickListSeries: null,
					workOrder: null,
					purchaseDate: null,
					warrantyExpiryDate: null,
					serviceContractExpiryDate: null,
					lastStatusChangedAt: new Date("2026-03-15T00:00:00.000Z"),
					daysInCurrentStatus: 6,
					maintenanceStatus: null,
					notes: null,
					isDisabled: true,
					createdAt: new Date("2026-03-10T00:00:00.000Z"),
					updatedAt: new Date("2026-03-16T00:00:00.000Z"),
				},
			],
			"status",
		);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			groupValue: "AVAILABLE",
			count: 2,
			disabledCount: 1,
		});
		expect(result[0]?.averageDaysInCurrentStatus).toBe(5);
	});

	it("formats status ageing labels", () => {
		expect(formatDaysInCurrentStatus(0)).toBe("Today");
		expect(formatDaysInCurrentStatus(7)).toBe("7 d");
	});
});
