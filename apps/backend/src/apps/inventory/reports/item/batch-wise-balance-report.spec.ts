import {
	type BatchWiseBalanceSourceBatch,
	buildBatchWiseBalanceRows,
} from "./batch-wise-balance-report";

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

const BASE_DATE = new Date("2025-01-15T00:00:00.000Z");
const FROM_DATE = new Date("2025-01-01T00:00:00.000Z");
const TO_DATE = new Date("2025-01-31T23:59:59.999Z");

function makeBatch(
	overrides: Partial<BatchWiseBalanceSourceBatch> = {},
): BatchWiseBalanceSourceBatch {
	return {
		id: "batch-001",
		batchId: "BATCH-001",
		company: "Acme Ltd",
		quantity: 100,
		manufacturingDate: null,
		expiryDate: null,
		item: {
			code: "ITEM-001",
			name: "Widget Alpha",
			description: "Precision Widget",
			valuationRate: 10,
			defaultUnitOfMeasure: { name: "Nos" },
		},
		currentWarehouse: { name: "Stores - A" },
		purchaseReceipt: { postingDate: BASE_DATE },
		stockEntry: null,
		...overrides,
	};
}

const OPTIONS = { fromDate: FROM_DATE, toDate: TO_DATE };

// ---------------------------------------------------------------------------
// Opening vs In Qty classification
// ---------------------------------------------------------------------------

describe("buildBatchWiseBalanceRows – opening vs in classification", () => {
	it("classifies batch received before fromDate as opening qty", () => {
		const batch = makeBatch({
			purchaseReceipt: {
				postingDate: new Date("2024-12-31T00:00:00.000Z"),
			},
		});
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows).toHaveLength(1);
		expect(rows[0].openingQty).toBe(100);
		expect(rows[0].inQty).toBe(0);
		expect(rows[0].balanceQty).toBe(100);
	});

	it("classifies batch received within the period as in qty", () => {
		const batch = makeBatch({
			purchaseReceipt: {
				postingDate: new Date("2025-01-15T00:00:00.000Z"),
			},
		});
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows).toHaveLength(1);
		expect(rows[0].openingQty).toBe(0);
		expect(rows[0].inQty).toBe(100);
		expect(rows[0].balanceQty).toBe(100);
	});

	it("classifies batch received exactly on fromDate as in qty", () => {
		const batch = makeBatch({
			purchaseReceipt: { postingDate: FROM_DATE },
		});
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows[0].inQty).toBe(100);
		expect(rows[0].openingQty).toBe(0);
	});

	it("classifies batch received exactly on toDate as in qty", () => {
		const batch = makeBatch({
			purchaseReceipt: { postingDate: TO_DATE },
		});
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows[0].inQty).toBe(100);
	});

	it("treats batch with no receipt date as opening", () => {
		const batch = makeBatch({
			purchaseReceipt: null,
			stockEntry: null,
		});
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows[0].openingQty).toBe(100);
		expect(rows[0].inQty).toBe(0);
	});

	it("uses stockEntry.postingDate when purchaseReceipt is null", () => {
		const batch = makeBatch({
			purchaseReceipt: null,
			stockEntry: { postingDate: new Date("2025-01-10T00:00:00.000Z") },
		});
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows[0].inQty).toBe(100);
		expect(rows[0].openingQty).toBe(0);
	});

	it("prefers purchaseReceipt over stockEntry for date", () => {
		const batch = makeBatch({
			purchaseReceipt: {
				postingDate: new Date("2024-12-01T00:00:00.000Z"),
			},
			stockEntry: {
				postingDate: new Date("2025-01-10T00:00:00.000Z"),
			},
		});
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		// purchaseReceipt date (Dec 2024) < fromDate → opening
		expect(rows[0].openingQty).toBe(100);
		expect(rows[0].inQty).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Exclusion of batches outside the window
// ---------------------------------------------------------------------------

describe("buildBatchWiseBalanceRows – date window exclusion", () => {
	it("excludes batches received strictly after toDate", () => {
		const batch = makeBatch({
			purchaseReceipt: {
				postingDate: new Date("2025-02-01T00:00:00.000Z"),
			},
		});
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows).toHaveLength(0);
	});

	it("includes multiple batches falling on both sides of fromDate", () => {
		const before = makeBatch({
			id: "b1",
			batchId: "BATCH-BEFORE",
			purchaseReceipt: {
				postingDate: new Date("2024-12-31T00:00:00.000Z"),
			},
		});
		const within = makeBatch({
			id: "b2",
			batchId: "BATCH-WITHIN",
			purchaseReceipt: {
				postingDate: new Date("2025-01-15T00:00:00.000Z"),
			},
		});
		const after = makeBatch({
			id: "b3",
			batchId: "BATCH-AFTER",
			purchaseReceipt: {
				postingDate: new Date("2025-02-15T00:00:00.000Z"),
			},
		});
		const rows = buildBatchWiseBalanceRows([before, within, after], OPTIONS);
		expect(rows).toHaveLength(2);
		const batchNos = rows.map((r) => r.batchNo);
		expect(batchNos).toContain("BATCH-BEFORE");
		expect(batchNos).toContain("BATCH-WITHIN");
		expect(batchNos).not.toContain("BATCH-AFTER");
	});
});

// ---------------------------------------------------------------------------
// Zero-quantity row filtering
// ---------------------------------------------------------------------------

describe("buildBatchWiseBalanceRows – zero quantity filtering", () => {
	it("omits rows where balanceQty is zero (fully consumed batch)", () => {
		const batch = makeBatch({ quantity: 0 });
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows).toHaveLength(0);
	});

	it("includes rows with positive quantity", () => {
		const batch = makeBatch({ quantity: 1 });
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Computed fields
// ---------------------------------------------------------------------------

describe("buildBatchWiseBalanceRows – computed fields", () => {
	it("always sets outQty to 0", () => {
		const rows = buildBatchWiseBalanceRows([makeBatch()], OPTIONS);
		expect(rows[0].outQty).toBe(0);
	});

	it("computes balanceValue as balanceQty × valuationRate", () => {
		const batch = makeBatch({ quantity: 50 });
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows[0].balanceValue).toBe(50 * 10);
	});

	it("uses 0 as valuationRate when item.valuationRate is null", () => {
		const batch = makeBatch({
			item: {
				code: "ITEM-001",
				name: "Widget",
				description: null,
				valuationRate: null,
				defaultUnitOfMeasure: null,
			},
		});
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows[0].valuationRate).toBe(0);
		expect(rows[0].balanceValue).toBe(0);
	});

	it("serializes manufacturingDate to ISO string", () => {
		const mfgDate = new Date("2024-06-01T00:00:00.000Z");
		const batch = makeBatch({ manufacturingDate: mfgDate });
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows[0].manufacturingDate).toBe(mfgDate.toISOString());
	});

	it("serializes expiryDate to ISO string", () => {
		const expDate = new Date("2026-12-31T00:00:00.000Z");
		const batch = makeBatch({ expiryDate: expDate });
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows[0].expiryDate).toBe(expDate.toISOString());
	});

	it("returns null for manufacturingDate when not set", () => {
		const batch = makeBatch({ manufacturingDate: null });
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows[0].manufacturingDate).toBeNull();
	});

	it("returns null for expiryDate when not set", () => {
		const batch = makeBatch({ expiryDate: null });
		const rows = buildBatchWiseBalanceRows([batch], OPTIONS);
		expect(rows[0].expiryDate).toBeNull();
	});

	it("carries through all row fields correctly", () => {
		const row = buildBatchWiseBalanceRows([makeBatch()], OPTIONS)[0];
		expect(row.id).toBe("batch-001");
		expect(row.company).toBe("Acme Ltd");
		expect(row.itemCode).toBe("ITEM-001");
		expect(row.itemName).toBe("Widget Alpha");
		expect(row.description).toBe("Precision Widget");
		expect(row.warehouse).toBe("Stores - A");
		expect(row.batchNo).toBe("BATCH-001");
		expect(row.unitOfMeasure).toBe("Nos");
	});
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe("buildBatchWiseBalanceRows – sort order", () => {
	it("sorts by itemCode then warehouse then batchNo", () => {
		const batches: BatchWiseBalanceSourceBatch[] = [
			makeBatch({
				id: "b1",
				batchId: "BATCH-Z",
				item: {
					code: "ITEM-B",
					name: null,
					description: null,
					valuationRate: 1,
					defaultUnitOfMeasure: null,
				},
				currentWarehouse: { name: "Warehouse-A" },
			}),
			makeBatch({
				id: "b2",
				batchId: "BATCH-A",
				item: {
					code: "ITEM-A",
					name: null,
					description: null,
					valuationRate: 1,
					defaultUnitOfMeasure: null,
				},
				currentWarehouse: { name: "Warehouse-B" },
			}),
			makeBatch({
				id: "b3",
				batchId: "BATCH-B",
				item: {
					code: "ITEM-A",
					name: null,
					description: null,
					valuationRate: 1,
					defaultUnitOfMeasure: null,
				},
				currentWarehouse: { name: "Warehouse-A" },
			}),
		];
		const rows = buildBatchWiseBalanceRows(batches, OPTIONS);
		expect(rows.map((r) => r.batchNo)).toEqual([
			"BATCH-B",
			"BATCH-A",
			"BATCH-Z",
		]);
	});

	it("returns an empty array for empty input", () => {
		expect(buildBatchWiseBalanceRows([], OPTIONS)).toEqual([]);
	});
});
