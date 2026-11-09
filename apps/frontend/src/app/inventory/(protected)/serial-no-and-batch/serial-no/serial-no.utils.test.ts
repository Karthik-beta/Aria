import { describe, expect, it } from "vitest";
import {
	buildSerialNoListInput,
	formatSerialNoStatus,
	toDateInputValue,
	toSerialNoMutationInput,
} from "./serial-no.utils";

describe("serial-no.utils", () => {
	it("builds bounded list input from filter state", () => {
		expect(
			buildSerialNoListInput({
				search: "  SN-001  ",
				itemId: "item-1",
				warehouseId: "warehouse-1",
				company: "  Aria Corp  ",
				status: "AVAILABLE",
				includeDisabled: true,
				pageIndex: 2,
				pageSize: 25,
				sortBy: "serialNo",
				sortDirection: "asc",
			}),
		).toEqual({
			skip: 50,
			take: 25,
			search: "SN-001",
			itemId: "item-1",
			warehouseId: "warehouse-1",
			company: "Aria Corp",
			status: "AVAILABLE",
			includeDisabled: true,
			sortBy: "serialNo",
			sortDirection: "asc",
		});
	});

	it("normalizes form values for API mutations", () => {
		expect(
			toSerialNoMutationInput({
				serialNo: " sn-1001 ",
				itemId: "item-1",
				company: " Aria Corp ",
				status: "AVAILABLE",
				currentWarehouseId: "warehouse-1",
				purchaseReceiptId: "",
				deliveryNoteId: "",
				stockEntryId: "stock-entry-1",
				pickListId: "",
				workOrder: " WO-1 ",
				purchaseDate: "2026-03-20",
				warrantyExpiryDate: "2027-03-20",
				serviceContractExpiryDate: "",
				maintenanceStatus: " Active ",
				notes: " Installed at site ",
				isDisabled: false,
			}),
		).toEqual({
			serialNo: "SN-1001",
			itemId: "item-1",
			company: "Aria Corp",
			status: "AVAILABLE",
			currentWarehouseId: "warehouse-1",
			purchaseReceiptId: null,
			deliveryNoteId: null,
			stockEntryId: "stock-entry-1",
			pickListId: null,
			workOrder: "WO-1",
			purchaseDate: new Date("2026-03-20T00:00:00.000Z"),
			warrantyExpiryDate: new Date("2027-03-20T00:00:00.000Z"),
			serviceContractExpiryDate: null,
			maintenanceStatus: "Active",
			notes: "Installed at site",
			isDisabled: false,
		});
	});

	it("formats dates and statuses for display", () => {
		expect(toDateInputValue(new Date("2026-03-25T12:00:00.000Z"))).toBe(
			"2026-03-25",
		);
		expect(formatSerialNoStatus("INSTALLED")).toBe("Installed");
	});
});
