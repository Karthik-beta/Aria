import { describe, expect, it } from "vitest";
import {
	buildInstallationNoteFromDeliveryNote,
	buildInstallationNoteListInput,
	formatInstallationNoteStatus,
	toInstallationNoteMutationInput,
} from "./installation-note.utils";

describe("installation-note.utils", () => {
	it("builds bounded installation note list input", () => {
		expect(
			buildInstallationNoteListInput({
				search: "  acme ",
				status: "all",
				company: "  Aria Corp ",
				deliveryNoteId: "",
				pageIndex: 2,
				pageSize: 25,
				sortBy: "installationDate",
				sortDirection: "asc",
			}),
		).toEqual({
			skip: 50,
			take: 25,
			search: "acme",
			status: undefined,
			company: "Aria Corp",
			deliveryNoteId: undefined,
			sortBy: "installationDate",
			sortDirection: "asc",
		});
	});

	it("maps form values to installation note mutation input", () => {
		const result = toInstallationNoteMutationInput({
			seriesPattern: " MAT-INS-.YYYY.- ",
			installationDate: "2026-03-26",
			installationTime: "10:30",
			customer: " Acme Industries ",
			customerName: " Acme Industries ",
			customerAddress: "",
			contactPerson: " John ",
			territory: " All Territories ",
			customerGroup: "",
			company: " Aria Corp ",
			status: "DRAFT",
			deliveryNoteId: "",
			remarks: " Ready to install ",
			items: [
				{
					itemId: "clitem000000000000001",
					serialNoId: "clserial0000000000001",
					description: " Rack unit ",
					installedQty: 1,
				},
			],
		});

		expect(result).toMatchObject({
			seriesPattern: "MAT-INS-.YYYY.-",
			installationTime: "10:30",
			customer: "Acme Industries",
			customerName: "Acme Industries",
			contactPerson: "John",
			territory: "All Territories",
			company: "Aria Corp",
			deliveryNoteId: null,
			remarks: "Ready to install",
			items: [
				{
					itemId: "clitem000000000000001",
					serialNoId: "clserial0000000000001",
					description: "Rack unit",
					installedQty: 1,
				},
			],
		});
		expect(result.installationDate).toBeInstanceOf(Date);
	});

	it("maps a delivery note and delivered serials to form rows", () => {
		const deliveryNote = {
			id: "cldeliverynote0001",
			series: "MAT-DN-2026-00001",
			postingDate: new Date("2026-03-20"),
			customer: "Acme Industries",
			company: "Aria Corp",
			status: "DRAFT",
			isReturn: false,
			currency: null,
			priceList: null,
			sourceWarehouse: null,
			totalQuantity: 1,
			totalAmount: 0,
			grandTotal: 0,
			roundingAdjustment: 0,
			roundedTotal: 0,
			additionalDiscountOn: null,
			additionalDiscountPercent: null,
			additionalDiscountAmount: null,
			shippingAddress: null,
			dispatchAddress: null,
			companyAddress: null,
			companyContact: null,
			companyTRN: null,
			terms: null,
			termsContent: null,
			transporter: null,
			driverName: null,
			driver: null,
			transportReceiptDate: null,
			transportReceiptNo: null,
			vehicleNo: null,
			customerPoNo: null,
			customerPoDate: null,
			salesPartner: null,
			commissionRate: null,
			letterHead: null,
			printHeading: null,
			printWithoutAmount: false,
			groupSameItems: false,
			permitNumber: null,
			vatEmirate: null,
			project: null,
			items: [
				{
					id: "row-1",
					deliveryNoteId: "cldeliverynote0001",
					itemCode: "LAP-001",
					itemName: "Laptop",
					description: "Onsite setup",
					quantity: 1,
					uom: "Nos",
					rate: 0,
					amount: 0,
					warehouse: "Stores - GH",
				},
			],
			createdAt: new Date("2026-03-20"),
			updatedAt: new Date("2026-03-21"),
		};
		const serialNos = [
			{
				id: "clserial0001",
				serialNo: "SN-1001",
				itemId: "clitem000000000000001",
				itemCode: "LAP-001",
				itemName: "Laptop",
				company: "Aria Corp",
				status: "DELIVERED",
				currentWarehouseId: null,
				currentWarehouseName: null,
				purchaseReceiptId: null,
				purchaseReceiptSeries: null,
				deliveryNoteId: "cldeliverynote0001",
				deliveryNoteSeries: "MAT-DN-2026-00001",
				stockEntryId: null,
				stockEntrySeries: null,
				pickListId: null,
				pickListSeries: null,
				workOrder: null,
				purchaseDate: null,
				warrantyExpiryDate: null,
				serviceContractExpiryDate: null,
				maintenanceStatus: null,
				notes: null,
				isDisabled: false,
				createdAt: new Date("2026-03-20"),
				updatedAt: new Date("2026-03-21"),
				history: [],
			},
		];
		const result = buildInstallationNoteFromDeliveryNote({
			deliveryNote,
			serialNos,
		});

		expect(result).toEqual({
			customer: "Acme Industries",
			customerName: "Acme Industries",
			company: "Aria Corp",
			deliveryNoteId: "cldeliverynote0001",
			items: [
				{
					itemId: "clitem000000000000001",
					serialNoId: "clserial0001",
					description: "Onsite setup",
					installedQty: 1,
				},
			],
		});
	});

	it("formats the in-progress status label", () => {
		expect(formatInstallationNoteStatus("IN_PROGRESS")).toBe("In Progress");
	});
});
