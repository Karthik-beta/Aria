import { describe, expect, test } from "bun:test";
import { Inventory } from "./index";

// ---------------------------------------------------------------------------
// Batch Status Schema
// ---------------------------------------------------------------------------
describe("Inventory.batchStatusSchema", () => {
	const schema = Inventory.batchStatusSchema;

	test("accepts valid statuses", () => {
		for (const status of ["ACTIVE", "EMPTY", "EXPIRED", "DISABLED"] as const) {
			expect(schema.parse(status)).toBe(status);
		}
	});

	test("rejects invalid status", () => {
		expect(() => schema.parse("UNKNOWN")).toThrow();
	});
});

// ---------------------------------------------------------------------------
// Batch Sort By Schema
// ---------------------------------------------------------------------------
describe("Inventory.batchSortBySchema", () => {
	const schema = Inventory.batchSortBySchema;

	test("accepts all valid sort fields", () => {
		const fields = [
			"updatedAt",
			"createdAt",
			"batchId",
			"itemCode",
			"warehouse",
			"expiryDate",
			"quantity",
			"company",
		] as const;
		for (const field of fields) {
			expect(schema.parse(field)).toBe(field);
		}
	});

	test("rejects an invalid sort field", () => {
		expect(() => schema.parse("notAField")).toThrow();
	});
});

// ---------------------------------------------------------------------------
// Create Batch Schema
// ---------------------------------------------------------------------------
describe("Inventory.createBatchSchema", () => {
	const schema = Inventory.createBatchSchema;

	const validInput = {
		batchId: "BATCH-001",
		itemId: "cm1234567890123456789012",
		company: "Pivotr Electronics",
	};

	test("accepts minimal valid input", () => {
		const result = schema.parse(validInput);
		expect(result.batchId).toBe("BATCH-001");
		expect(result.quantity).toBe(0); // default
		expect(result.isDisabled).toBe(false); // default
	});

	test("rejects empty batchId", () => {
		expect(() => schema.parse({ ...validInput, batchId: "" })).toThrow();
	});

	test("rejects missing itemId", () => {
		expect(() =>
			schema.parse({ batchId: "BATCH-001", company: "Test" }),
		).toThrow();
	});

	test("rejects negative quantity", () => {
		expect(() => schema.parse({ ...validInput, quantity: -1 })).toThrow();
	});

	test("rejects expiry date before manufacturing date", () => {
		const result = schema.safeParse({
			...validInput,
			manufacturingDate: new Date("2025-06-01"),
			expiryDate: new Date("2025-01-01"),
		});
		expect(result.success).toBe(false);
	});

	test("requires warehouse when quantity > 0", () => {
		const result = schema.safeParse({
			...validInput,
			quantity: 10,
			currentWarehouseId: null,
		});
		expect(result.success).toBe(false);
	});

	test("accepts quantity > 0 with warehouse", () => {
		const result = schema.safeParse({
			...validInput,
			quantity: 10,
			currentWarehouseId: "cm1234567890123456789999",
		});
		expect(result.success).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Update Batch Schema
// ---------------------------------------------------------------------------
describe("Inventory.updateBatchSchema", () => {
	const schema = Inventory.updateBatchSchema;

	test("accepts update with only id", () => {
		const result = schema.parse({ id: "cm1234567890123456789012" });
		expect(result.id).toBe("cm1234567890123456789012");
	});

	test("rejects update without id", () => {
		expect(() => schema.parse({ batchId: "BATCH-001" })).toThrow();
	});

	test("rejects invalid id format", () => {
		expect(() => schema.parse({ id: "not-a-cuid" })).toThrow();
	});
});

// ---------------------------------------------------------------------------
// Serial No Status Schema
// ---------------------------------------------------------------------------
describe("Inventory.serialNoStatusSchema", () => {
	const schema = Inventory.serialNoStatusSchema;

	test("accepts all valid statuses", () => {
		const statuses = [
			"DRAFT",
			"AVAILABLE",
			"DELIVERED",
			"INSTALLED",
			"RETURNED",
			"SCRAPPED",
			"DISPOSED",
		] as const;
		for (const status of statuses) {
			expect(schema.parse(status)).toBe(status);
		}
	});

	test("rejects invalid status", () => {
		expect(() => schema.parse("PENDING")).toThrow();
	});
});

// ---------------------------------------------------------------------------
// Serial No Sort By Schema
// ---------------------------------------------------------------------------
describe("Inventory.serialNoSortBySchema", () => {
	test("accepts valid sort fields", () => {
		const fields = [
			"updatedAt",
			"createdAt",
			"serialNo",
			"itemCode",
			"warehouse",
			"status",
			"company",
		] as const;
		for (const field of fields) {
			expect(Inventory.serialNoSortBySchema.parse(field)).toBe(field);
		}
	});
});

// ---------------------------------------------------------------------------
// List Batches Schema
// ---------------------------------------------------------------------------
describe("Inventory.listBatchesSchema", () => {
	const schema = Inventory.listBatchesSchema;

	test("accepts undefined (all optional)", () => {
		const result = schema.parse(undefined);
		expect(result).toBeUndefined();
	});

	test("accepts valid pagination params", () => {
		const result = schema.parse({ skip: 0, take: 10 });
		expect(result?.skip).toBe(0);
		expect(result?.take).toBe(10);
	});

	test("rejects take > 250", () => {
		expect(() => schema.parse({ take: 300 })).toThrow();
	});

	test("rejects negative skip", () => {
		expect(() => schema.parse({ skip: -1 })).toThrow();
	});
});

// ---------------------------------------------------------------------------
// Warranty / Service Contract Expiry Schemas
// ---------------------------------------------------------------------------
describe("Inventory.serialNoWarrantyExpiryStateSchema", () => {
	test("accepts EXPIRED, DUE_SOON, ACTIVE", () => {
		for (const state of ["EXPIRED", "DUE_SOON", "ACTIVE"] as const) {
			expect(Inventory.serialNoWarrantyExpiryStateSchema.parse(state)).toBe(
				state,
			);
		}
	});
});

describe("Inventory.serialNoServiceContractExpirySortBySchema", () => {
	test("accepts all valid sort fields", () => {
		const fields = [
			"serviceContractExpiryDate",
			"updatedAt",
			"serialNo",
			"itemCode",
			"warehouse",
			"status",
			"company",
		] as const;
		for (const field of fields) {
			expect(
				Inventory.serialNoServiceContractExpirySortBySchema.parse(field),
			).toBe(field);
		}
	});

	test("rejects invalid sort field", () => {
		expect(() =>
			Inventory.serialNoServiceContractExpirySortBySchema.parse("bogus"),
		).toThrow();
	});
});

describe("Inventory.serialNoWarrantyExpiryStateSchema", () => {
	test("accepts EXPIRED, DUE_SOON, ACTIVE", () => {
		for (const state of ["EXPIRED", "DUE_SOON", "ACTIVE"] as const) {
			expect(Inventory.serialNoWarrantyExpiryStateSchema.parse(state)).toBe(
				state,
			);
		}
	});
});

describe("Inventory.serialNoWarrantyExpirySortBySchema", () => {
	test("accepts all valid sort fields", () => {
		const fields = [
			"warrantyExpiryDate",
			"updatedAt",
			"serialNo",
			"itemCode",
			"warehouse",
			"status",
			"company",
		] as const;
		for (const field of fields) {
			expect(Inventory.serialNoWarrantyExpirySortBySchema.parse(field)).toBe(
				field,
			);
		}
	});

	test("rejects invalid sort field", () => {
		expect(() =>
			Inventory.serialNoWarrantyExpirySortBySchema.parse("bogus"),
		).toThrow();
	});
});

describe("Inventory.serialNoStatusSortBySchema", () => {
	test("accepts all valid sort fields", () => {
		const fields = [
			"updatedAt",
			"createdAt",
			"serialNo",
			"itemCode",
			"warehouse",
			"status",
			"company",
		] as const;
		for (const field of fields) {
			expect(Inventory.serialNoStatusSortBySchema.parse(field)).toBe(field);
		}
	});

	test("rejects invalid sort field", () => {
		expect(() => Inventory.serialNoStatusSortBySchema.parse("bogus")).toThrow();
	});
});

// ---------------------------------------------------------------------------
// Create Serial No Schema
// ---------------------------------------------------------------------------
describe("Inventory.createSerialNoSchema", () => {
	const schema = Inventory.createSerialNoSchema;

	const validInput = {
		serialNo: "SN-001",
		itemId: "cm1234567890123456789012",
		company: "Pivotr Electronics",
	};

	test("accepts minimal valid input", () => {
		const result = schema.parse(validInput);
		expect(result.serialNo).toBe("SN-001");
		expect(result.status).toBe("DRAFT"); // default
		expect(result.isDisabled).toBe(false); // default
	});

	test("uppercases serial number", () => {
		const result = schema.parse({ ...validInput, serialNo: "sn-lower" });
		expect(result.serialNo).toBe("SN-LOWER");
	});

	test("rejects empty serial number", () => {
		expect(() => schema.parse({ ...validInput, serialNo: "" })).toThrow();
	});

	test("rejects missing itemId", () => {
		expect(() =>
			schema.parse({ serialNo: "SN-001", company: "Test" }),
		).toThrow();
	});

	test("rejects warranty expiry before purchase date", () => {
		const result = schema.safeParse({
			...validInput,
			purchaseDate: new Date("2025-06-01"),
			warrantyExpiryDate: new Date("2025-01-01"),
		});
		expect(result.success).toBe(false);
	});

	test("rejects service contract expiry before purchase date", () => {
		const result = schema.safeParse({
			...validInput,
			purchaseDate: new Date("2025-06-01"),
			serviceContractExpiryDate: new Date("2025-01-01"),
		});
		expect(result.success).toBe(false);
	});

	test("accepts warranty and service contract after purchase date", () => {
		const result = schema.safeParse({
			...validInput,
			purchaseDate: new Date("2025-01-01"),
			warrantyExpiryDate: new Date("2026-01-01"),
			serviceContractExpiryDate: new Date("2026-06-01"),
		});
		expect(result.success).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Update Serial No Schema
// ---------------------------------------------------------------------------
describe("Inventory.updateSerialNoSchema", () => {
	const schema = Inventory.updateSerialNoSchema;

	test("accepts update with only id", () => {
		const result = schema.parse({ id: "cm1234567890123456789012" });
		expect(result.id).toBe("cm1234567890123456789012");
	});

	test("rejects update without id", () => {
		expect(() => schema.parse({ serialNo: "SN-001" })).toThrow();
	});

	test("rejects invalid id format", () => {
		expect(() => schema.parse({ id: "not-a-cuid" })).toThrow();
	});

	test("accepts partial update with status change", () => {
		const result = schema.parse({
			id: "cm1234567890123456789012",
			status: "DELIVERED",
		});
		expect(result.status).toBe("DELIVERED");
	});

	test("rejects warranty expiry before purchase date on update", () => {
		const result = schema.safeParse({
			id: "cm1234567890123456789012",
			purchaseDate: new Date("2025-06-01"),
			warrantyExpiryDate: new Date("2025-01-01"),
		});
		expect(result.success).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// List Serial Nos Schema
// ---------------------------------------------------------------------------
describe("Inventory.listSerialNosSchema", () => {
	const schema = Inventory.listSerialNosSchema;

	test("accepts undefined (all optional)", () => {
		const result = schema.parse(undefined);
		expect(result).toBeUndefined();
	});

	test("accepts valid pagination with filters", () => {
		const result = schema.parse({
			skip: 0,
			take: 25,
			status: "AVAILABLE",
			sortBy: "serialNo",
			sortDirection: "asc",
		});
		expect(result?.take).toBe(25);
		expect(result?.status).toBe("AVAILABLE");
	});

	test("rejects take > 250", () => {
		expect(() => schema.parse({ take: 300 })).toThrow();
	});

	test("rejects negative skip", () => {
		expect(() => schema.parse({ skip: -1 })).toThrow();
	});

	test("trims search string", () => {
		const result = schema.parse({ search: "  SN-001  " });
		expect(result?.search).toBe("SN-001");
	});
});
