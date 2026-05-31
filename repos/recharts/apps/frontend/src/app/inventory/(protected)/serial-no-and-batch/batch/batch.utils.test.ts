import { describe, expect, it } from "vitest";
import {
	buildBatchListInput,
	formatBatchStatus,
	toBatchMutationInput,
} from "./batch.utils";

describe("batch.utils", () => {
	it("builds bounded batch list input", () => {
		expect(
			buildBatchListInput({
				search: "  batch-1 ",
				itemId: "item-1",
				warehouseId: "",
				company: " Aria Corp ",
				status: "ACTIVE",
				includeDisabled: false,
				pageIndex: 2,
				pageSize: 25,
				sortBy: "updatedAt",
				sortDirection: "desc",
			}),
		).toEqual({
			skip: 50,
			take: 25,
			search: "batch-1",
			itemId: "item-1",
			warehouseId: undefined,
			company: "Aria Corp",
			status: "ACTIVE",
			includeDisabled: false,
			sortBy: "updatedAt",
			sortDirection: "desc",
		});
	});

	it("maps form values to batch mutation payload", () => {
		expect(
			toBatchMutationInput({
				batchId: " batch-1001 ",
				itemId: "item-1",
				company: " Aria Corp ",
				currentWarehouseId: "",
				purchaseReceiptId: "",
				deliveryNoteId: "",
				stockEntryId: "",
				useBatchWiseValuation: true,
				manufacturingDate: "2026-03-25",
				expiryDate: "2026-12-31",
				description: " Lot 01 ",
				quantity: 5,
				isDisabled: false,
			}),
		).toMatchObject({
			batchId: "BATCH-1001",
			itemId: "item-1",
			company: "Aria Corp",
			currentWarehouseId: null,
			useBatchWiseValuation: true,
			description: "Lot 01",
			quantity: 5,
			isDisabled: false,
		});
	});

	it("formats batch statuses for display", () => {
		expect(formatBatchStatus("ACTIVE")).toBe("Active");
		expect(formatBatchStatus("EXPIRED")).toBe("Expired");
	});
});
