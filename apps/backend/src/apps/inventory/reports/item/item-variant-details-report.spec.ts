import {
	buildItemVariantDetailsResult,
	type VariantAttributeSource,
	type VariantSource,
} from "./item-variant-details-report";

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeVariant(overrides: Partial<VariantSource> = {}): VariantSource {
	return {
		id: "clvar001",
		code: "TSHIRT-RED-S",
		name: "T-Shirt Red Small",
		quantity: 50,
		standardSellingRate: 799.0,
		...overrides,
	};
}

const EMPTY_MAP = new Map<string, number>();

// ---------------------------------------------------------------------------
// buildItemVariantDetailsResult – empty input
// ---------------------------------------------------------------------------

describe("buildItemVariantDetailsResult – empty input", () => {
	it("returns empty result when no variants provided", () => {
		const result = buildItemVariantDetailsResult([], [], EMPTY_MAP, EMPTY_MAP);
		expect(result.attributeNames).toEqual([]);
		expect(result.rows).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// buildItemVariantDetailsResult – output shape
// ---------------------------------------------------------------------------

describe("buildItemVariantDetailsResult – output shape", () => {
	it("maps all fields from a fully-populated variant", () => {
		const variants = [makeVariant()];
		const attrs: VariantAttributeSource[] = [
			{
				itemId: "clvar001",
				attributeName: "Color",
				attributeValue: "Red",
			},
			{
				itemId: "clvar001",
				attributeName: "Size",
				attributeValue: "Small",
			},
		];
		const buyingMap = new Map([["TSHIRT-RED-S", 450.0]]);
		const ordersMap = new Map([["TSHIRT-RED-S", 5]]);

		const result = buildItemVariantDetailsResult(
			variants,
			attrs,
			buyingMap,
			ordersMap,
		);

		expect(result.attributeNames).toEqual(["Color", "Size"]);
		expect(result.rows).toHaveLength(1);

		const row = result.rows[0];
		expect(row.id).toBe("clvar001");
		expect(row.variantCode).toBe("TSHIRT-RED-S");
		expect(row.variantName).toBe("T-Shirt Red Small");
		expect(row.attributes).toEqual({ Color: "Red", Size: "Small" });
		expect(row.avgBuyingPriceListRate).toBe(450.0);
		expect(row.avgSellingPriceListRate).toBe(799.0);
		expect(row.currentStock).toBe(50);
		expect(row.openOrders).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// buildItemVariantDetailsResult – attribute handling
// ---------------------------------------------------------------------------

describe("buildItemVariantDetailsResult – attribute handling", () => {
	it("returns attribute names in alphabetical order", () => {
		const variants = [makeVariant()];
		const attrs: VariantAttributeSource[] = [
			{ itemId: "clvar001", attributeName: "Size", attributeValue: "S" },
			{ itemId: "clvar001", attributeName: "Color", attributeValue: "Red" },
			{
				itemId: "clvar001",
				attributeName: "Material",
				attributeValue: "Cotton",
			},
		];

		const result = buildItemVariantDetailsResult(
			variants,
			attrs,
			EMPTY_MAP,
			EMPTY_MAP,
		);
		expect(result.attributeNames).toEqual(["Color", "Material", "Size"]);
	});

	it("handles variants with missing attribute values", () => {
		const variants = [
			makeVariant({ id: "v1", code: "V1" }),
			makeVariant({ id: "v2", code: "V2" }),
		];
		const attrs: VariantAttributeSource[] = [
			{ itemId: "v1", attributeName: "Color", attributeValue: "Red" },
			// v2 has no Color attribute
		];

		const result = buildItemVariantDetailsResult(
			variants,
			attrs,
			EMPTY_MAP,
			EMPTY_MAP,
		);

		expect(result.rows[0].attributes).toEqual({ Color: "Red" });
		expect(result.rows[1].attributes).toEqual({});
	});

	it("returns empty attributes for variant with no attribute rows", () => {
		const variants = [makeVariant()];
		const result = buildItemVariantDetailsResult(
			variants,
			[],
			EMPTY_MAP,
			EMPTY_MAP,
		);

		expect(result.attributeNames).toEqual([]);
		expect(result.rows[0].attributes).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// buildItemVariantDetailsResult – price defaults
// ---------------------------------------------------------------------------

describe("buildItemVariantDetailsResult – price defaults", () => {
	it("defaults avg buying price to 0 when no purchase data", () => {
		const result = buildItemVariantDetailsResult(
			[makeVariant()],
			[],
			EMPTY_MAP,
			EMPTY_MAP,
		);
		expect(result.rows[0].avgBuyingPriceListRate).toBe(0);
	});

	it("defaults avg selling price to 0 when standardSellingRate is null", () => {
		const result = buildItemVariantDetailsResult(
			[makeVariant({ standardSellingRate: null })],
			[],
			EMPTY_MAP,
			EMPTY_MAP,
		);
		expect(result.rows[0].avgSellingPriceListRate).toBe(0);
	});

	it("defaults open orders to 0 when no sales order data", () => {
		const result = buildItemVariantDetailsResult(
			[makeVariant()],
			[],
			EMPTY_MAP,
			EMPTY_MAP,
		);
		expect(result.rows[0].openOrders).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// buildItemVariantDetailsResult – sorting
// ---------------------------------------------------------------------------

describe("buildItemVariantDetailsResult – sorting", () => {
	it("sorts rows by variant code ascending", () => {
		const variants = [
			makeVariant({ id: "v3", code: "TSHIRT-RED-XL" }),
			makeVariant({ id: "v1", code: "TSHIRT-BLUE-S" }),
			makeVariant({ id: "v2", code: "TSHIRT-RED-M" }),
		];

		const result = buildItemVariantDetailsResult(
			variants,
			[],
			EMPTY_MAP,
			EMPTY_MAP,
		);

		expect(result.rows.map((r) => r.variantCode)).toEqual([
			"TSHIRT-BLUE-S",
			"TSHIRT-RED-M",
			"TSHIRT-RED-XL",
		]);
	});
});

// ---------------------------------------------------------------------------
// buildItemVariantDetailsResult – multiple variants
// ---------------------------------------------------------------------------

describe("buildItemVariantDetailsResult – multiple variants", () => {
	it("correctly maps attributes to the right variant rows", () => {
		const variants = [
			makeVariant({
				id: "v1",
				code: "TS-R-S",
				name: "T-Shirt Red Small",
				quantity: 10,
			}),
			makeVariant({
				id: "v2",
				code: "TS-B-L",
				name: "T-Shirt Blue Large",
				quantity: 20,
			}),
		];
		const attrs: VariantAttributeSource[] = [
			{ itemId: "v1", attributeName: "Color", attributeValue: "Red" },
			{ itemId: "v1", attributeName: "Size", attributeValue: "Small" },
			{ itemId: "v2", attributeName: "Color", attributeValue: "Blue" },
			{ itemId: "v2", attributeName: "Size", attributeValue: "Large" },
		];
		const buyingMap = new Map([
			["TS-R-S", 400],
			["TS-B-L", 420],
		]);
		const ordersMap = new Map([["TS-R-S", 3]]);

		const result = buildItemVariantDetailsResult(
			variants,
			attrs,
			buyingMap,
			ordersMap,
		);

		expect(result.attributeNames).toEqual(["Color", "Size"]);
		expect(result.rows).toHaveLength(2);

		// Sorted by code: TS-B-L comes first
		expect(result.rows[0].variantCode).toBe("TS-B-L");
		expect(result.rows[0].attributes).toEqual({
			Color: "Blue",
			Size: "Large",
		});
		expect(result.rows[0].avgBuyingPriceListRate).toBe(420);
		expect(result.rows[0].openOrders).toBe(0);

		expect(result.rows[1].variantCode).toBe("TS-R-S");
		expect(result.rows[1].attributes).toEqual({
			Color: "Red",
			Size: "Small",
		});
		expect(result.rows[1].avgBuyingPriceListRate).toBe(400);
		expect(result.rows[1].openOrders).toBe(3);
	});
});
