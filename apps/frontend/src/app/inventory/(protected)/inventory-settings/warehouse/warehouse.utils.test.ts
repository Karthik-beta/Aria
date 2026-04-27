import { describe, expect, it } from "vitest";
import {
	buildWarehouseListInput,
	getWarehouseStatusLabel,
	toWarehouseMutationInput,
} from "./warehouse.utils";

describe("warehouse.utils", () => {
	it("builds bounded list input from filter state", () => {
		expect(
			buildWarehouseListInput({
				search: "  Main  ",
				company: "  Aria Corp  ",
				status: "disabled",
				group: "group",
				pageIndex: 2,
				pageSize: 20,
			}),
		).toEqual({
			skip: 40,
			take: 20,
			search: "Main",
			company: "Aria Corp",
			disabled: true,
			isGroupWarehouse: true,
		});
	});

	it("normalizes warehouse form values for API mutations", () => {
		expect(
			toWarehouseMutationInput({
				name: " Main Warehouse ",
				disabled: false,
				isGroupWarehouse: true,
				parentWarehouseId: "",
				company: " Aria Corp ",
				isRejectedWarehouse: false,
				phoneNo: "  ",
				mobileNo: "9999",
				addressLine1: " Line 1 ",
				addressLine2: "",
				city: " Dubai ",
				state: "",
				pin: " 12345 ",
				warehouseType: " Transit ",
				defaultInTransitWarehouseId: "clh123warehouse",
			}),
		).toEqual({
			name: "Main Warehouse",
			disabled: false,
			isGroupWarehouse: true,
			parentWarehouseId: null,
			company: "Aria Corp",
			isRejectedWarehouse: false,
			phoneNo: null,
			mobileNo: "9999",
			addressLine1: "Line 1",
			addressLine2: null,
			city: "Dubai",
			state: null,
			pin: "12345",
			warehouseType: "Transit",
			defaultInTransitWarehouseId: "clh123warehouse",
		});
	});

	it("maps disabled state to status labels", () => {
		expect(getWarehouseStatusLabel(false)).toBe("Enabled");
		expect(getWarehouseStatusLabel(true)).toBe("Disabled");
	});
});
