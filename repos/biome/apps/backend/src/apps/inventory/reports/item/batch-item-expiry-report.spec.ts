import {
	type BatchItemExpirySourceBatch,
	buildBatchItemExpiryRows,
} from "./batch-item-expiry-report";

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

const TODAY = new Date("2025-06-15T00:00:00.000Z");

function makeBatch(
	overrides: Partial<BatchItemExpirySourceBatch> = {},
): BatchItemExpirySourceBatch {
	return {
		id: "batch-001",
		batchId: "BATCH-001",
		quantity: 50,
		expiryDate: new Date("2025-07-15T00:00:00.000Z"),
		createdAt: new Date("2025-01-10T00:00:00.000Z"),
		item: {
			code: "ITEM-001",
			name: "Widget Alpha",
			defaultUnitOfMeasure: { name: "Nos" },
		},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Basic output shape
// ---------------------------------------------------------------------------

describe("buildBatchItemExpiryRows – output shape", () => {
	it("maps all fields from the source batch", () => {
		const rows = buildBatchItemExpiryRows([makeBatch()], TODAY);

		expect(rows).toHaveLength(1);
		const row = rows[0];
		expect(row.id).toBe("batch-001");
		expect(row.itemCode).toBe("ITEM-001");
		expect(row.itemName).toBe("Widget Alpha");
		expect(row.batchNo).toBe("BATCH-001");
		expect(row.stockUom).toBe("Nos");
		expect(row.quantity).toBe(50);
		expect(row.expiresOn).toBe("2025-07-15");
	});

	it("returns empty array for empty input", () => {
		expect(buildBatchItemExpiryRows([], TODAY)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Expiry-in-days calculation
// ---------------------------------------------------------------------------

describe("buildBatchItemExpiryRows – expiryInDays", () => {
	it("calculates correct days when expiry is in the future", () => {
		// TODAY = 2025-06-15, expiry = 2025-07-15 → 30 days
		const rows = buildBatchItemExpiryRows([makeBatch()], TODAY);
		expect(rows[0].expiryInDays).toBe(30);
	});

	it("returns 0 when expiry date equals today (not yet expired)", () => {
		const batch = makeBatch({
			expiryDate: new Date("2025-06-15T00:00:00.000Z"),
		});
		const rows = buildBatchItemExpiryRows([batch], TODAY);
		expect(rows[0].expiryInDays).toBe(0);
	});

	it("returns 0 when batch has already expired (clamps negative to zero)", () => {
		const batch = makeBatch({
			expiryDate: new Date("2025-05-01T00:00:00.000Z"),
		});
		const rows = buildBatchItemExpiryRows([batch], TODAY);
		expect(rows[0].expiryInDays).toBe(0);
	});

	it("returns 1 for expiry tomorrow", () => {
		const batch = makeBatch({
			expiryDate: new Date("2025-06-16T00:00:00.000Z"),
		});
		const rows = buildBatchItemExpiryRows([batch], TODAY);
		expect(rows[0].expiryInDays).toBe(1);
	});

	it("returns null when there is no expiry date", () => {
		const batch = makeBatch({ expiryDate: null });
		const rows = buildBatchItemExpiryRows([batch], TODAY);
		expect(rows[0].expiryInDays).toBeNull();
		expect(rows[0].expiresOn).toBeNull();
	});

	it("returns null expiresOn when expiryDate is null", () => {
		const batch = makeBatch({ expiryDate: null });
		const rows = buildBatchItemExpiryRows([batch], TODAY);
		expect(rows[0].expiresOn).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Null / optional field handling
// ---------------------------------------------------------------------------

describe("buildBatchItemExpiryRows – null field handling", () => {
	it("returns null itemName when item has no name", () => {
		const batch = makeBatch({
			item: {
				code: "ITEM-002",
				name: null,
				defaultUnitOfMeasure: { name: "Kg" },
			},
		});
		const rows = buildBatchItemExpiryRows([batch], TODAY);
		expect(rows[0].itemName).toBeNull();
	});

	it("returns null stockUom when item has no default UOM", () => {
		const batch = makeBatch({
			item: {
				code: "ITEM-002",
				name: "Some Item",
				defaultUnitOfMeasure: null,
			},
		});
		const rows = buildBatchItemExpiryRows([batch], TODAY);
		expect(rows[0].stockUom).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Multiple rows
// ---------------------------------------------------------------------------

describe("buildBatchItemExpiryRows – multiple batches", () => {
	it("maps all batches in order", () => {
		const batch1 = makeBatch({ id: "b1", batchId: "BATCH-001" });
		const batch2 = makeBatch({
			id: "b2",
			batchId: "BATCH-002",
			expiryDate: new Date("2025-08-01T00:00:00.000Z"),
		});

		const rows = buildBatchItemExpiryRows([batch1, batch2], TODAY);

		expect(rows).toHaveLength(2);
		expect(rows[0].batchNo).toBe("BATCH-001");
		expect(rows[1].batchNo).toBe("BATCH-002");
		// batch2: 2025-08-01 - 2025-06-15 = 47 days
		expect(rows[1].expiryInDays).toBe(47);
	});
});

// ---------------------------------------------------------------------------
// Expiry date string format
// ---------------------------------------------------------------------------

describe("buildBatchItemExpiryRows – expiresOn format", () => {
	it("formats expiry date as YYYY-MM-DD ISO date string", () => {
		const batch = makeBatch({
			expiryDate: new Date("2025-12-31T00:00:00.000Z"),
		});
		const rows = buildBatchItemExpiryRows([batch], TODAY);
		expect(rows[0].expiresOn).toBe("2025-12-31");
	});

	it("handles end-of-month dates correctly", () => {
		const batch = makeBatch({
			expiryDate: new Date("2025-02-28T00:00:00.000Z"),
		});
		const rows = buildBatchItemExpiryRows([batch], TODAY);
		expect(rows[0].expiresOn).toBe("2025-02-28");
	});
});
