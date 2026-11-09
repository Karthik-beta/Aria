/**
 * Unit tests for inventory-shared pure helpers and state-machine constants.
 *
 * @module inventory-shared.spec
 */

import type { Inventory } from "@aria/types";
import { BadRequestException } from "@nestjs/common";
import {
	addUtcDays,
	assertSerialNoStatusTransition,
	buildSerialNoTransactionLabel,
	computeBackoffMs,
	DEFAULT_STOCK_AGEING_BREAKS,
	diffUtcDays,
	formatBarcodes,
	formatItemGroupDefaults,
	formatProductBundleItems,
	formatReorderSettings,
	INSTALLATION_NOTE_ALLOWED_STATUS_TRANSITIONS,
	ITEM_MANUFACTURERS_DEFAULT_PER_ITEM_INDEX,
	isDefaultItemManufacturerConstraintViolation,
	normalizeOptionalText,
	normalizePostingTime,
	parseStockAgeingBucketRanges,
	removeUndefined,
	SERIAL_NO_ALLOWED_STATUS_TRANSITIONS,
	startOfUtcDay,
} from "./inventory-shared";

// ─── formatItemGroupDefaults ─────────────────────────────────────────────────

describe("formatItemGroupDefaults", () => {
	it("returns undefined when no defaults passed", () => {
		expect(formatItemGroupDefaults()).toBeUndefined();
		expect(formatItemGroupDefaults(undefined)).toBeUndefined();
	});

	it("maps company, defaultWarehouse, defaultPriceList", () => {
		const input: Inventory.ItemGroupDefault[] = [
			{
				id: "d-1",
				company: "ACME",
				defaultWarehouse: "WH-01",
				defaultPriceList: "Standard",
			},
			{
				company: "Beta",
				defaultWarehouse: null,
				defaultPriceList: null,
			},
		];
		expect(formatItemGroupDefaults(input)).toEqual([
			{
				company: "ACME",
				defaultWarehouse: "WH-01",
				defaultPriceList: "Standard",
			},
			{ company: "Beta", defaultWarehouse: null, defaultPriceList: null },
		]);
	});

	it("strips extra properties", () => {
		const input = [
			{
				id: "x",
				company: "C",
				defaultWarehouse: "W",
				defaultPriceList: "P",
				extra: true,
			} as unknown as Inventory.ItemGroupDefault,
		];
		const result = formatItemGroupDefaults(input) ?? [];
		expect(result).toHaveLength(1);
		expect(Object.keys(result[0])).toEqual([
			"company",
			"defaultWarehouse",
			"defaultPriceList",
		]);
	});
});

// ─── formatBarcodes ──────────────────────────────────────────────────────────

describe("formatBarcodes", () => {
	it("returns undefined when no input", () => {
		expect(formatBarcodes()).toBeUndefined();
		expect(formatBarcodes(undefined)).toBeUndefined();
		expect(formatBarcodes(null)).toBeUndefined();
	});

	it("maps barcode, barcodeType, uom", () => {
		const result = formatBarcodes([
			{ barcode: "BC1", barcodeType: "EAN", uom: "Nos" },
		]);
		expect(result).toEqual([
			{ barcode: "BC1", barcodeType: "EAN", uom: "Nos" },
		]);
	});
});

// ─── formatReorderSettings ───────────────────────────────────────────────────

describe("formatReorderSettings", () => {
	it("returns undefined for null/undefined", () => {
		expect(formatReorderSettings()).toBeUndefined();
		expect(formatReorderSettings(null)).toBeUndefined();
	});

	it("always includes warehouse", () => {
		const result =
			formatReorderSettings([
				{ warehouse: "WH-A", reorderLevel: null, reorderQty: null },
			]) ?? [];
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ warehouse: "WH-A" });
	});

	it("includes reorderLevel/reorderQty only when numeric", () => {
		const result =
			formatReorderSettings([
				{
					warehouse: "WH-B",
					reorderLevel: 10,
					reorderQty: 50,
					materialRequestType: "Purchase",
				},
			]) ?? [];
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			warehouse: "WH-B",
			reorderLevel: 10,
			reorderQty: 50,
			materialRequestType: "Purchase",
		});
	});

	it("includes materialRequestType when provided (even null)", () => {
		const result =
			formatReorderSettings([
				{
					warehouse: "WH-C",
					reorderLevel: null,
					reorderQty: null,
					materialRequestType: null,
				},
			]) ?? [];
		expect(result).toHaveLength(1);
		expect(result[0]).toHaveProperty("materialRequestType", null);
	});

	it("omits materialRequestType when undefined", () => {
		const result = formatReorderSettings([{ warehouse: "WH-D" }]) ?? [];
		expect(result).toHaveLength(1);
		expect(result[0]).not.toHaveProperty("materialRequestType");
	});

	it("treats zero as a valid number for reorderLevel/reorderQty", () => {
		const result =
			formatReorderSettings([
				{ warehouse: "WH-E", reorderLevel: 0, reorderQty: 0 },
			]) ?? [];
		expect(result).toHaveLength(1);
		expect(result[0].reorderLevel).toBe(0);
		expect(result[0].reorderQty).toBe(0);
	});
});

// ─── removeUndefined ─────────────────────────────────────────────────────────

describe("removeUndefined", () => {
	it("removes keys with undefined values", () => {
		expect(removeUndefined({ a: 1, b: undefined, c: "x" })).toEqual({
			a: 1,
			c: "x",
		});
	});

	it("keeps null and false", () => {
		expect(removeUndefined({ a: null, b: false, c: 0 })).toEqual({
			a: null,
			b: false,
			c: 0,
		});
	});

	it("returns empty object when all undefined", () => {
		expect(removeUndefined({ a: undefined })).toEqual({});
	});
});

// ─── UTC date helpers ────────────────────────────────────────────────────────

describe("startOfUtcDay", () => {
	it("zeroes out hours/minutes/seconds/ms", () => {
		const d = new Date("2024-06-15T14:30:45.123Z");
		const result = startOfUtcDay(d);
		expect(result.toISOString()).toBe("2024-06-15T00:00:00.000Z");
	});

	it("is idempotent", () => {
		const d = new Date("2024-01-01T00:00:00.000Z");
		expect(startOfUtcDay(d).getTime()).toBe(d.getTime());
	});
});

describe("addUtcDays", () => {
	it("adds positive days", () => {
		const d = new Date("2024-01-01T00:00:00.000Z");
		expect(addUtcDays(d, 5).toISOString()).toBe("2024-01-06T00:00:00.000Z");
	});

	it("subtracts with negative days", () => {
		const d = new Date("2024-01-10T00:00:00.000Z");
		expect(addUtcDays(d, -3).toISOString()).toBe("2024-01-07T00:00:00.000Z");
	});

	it("handles month overflow", () => {
		const d = new Date("2024-01-30T00:00:00.000Z");
		expect(addUtcDays(d, 3).toISOString()).toBe("2024-02-02T00:00:00.000Z");
	});
});

describe("diffUtcDays", () => {
	it("returns positive for later dates", () => {
		const from = new Date("2024-01-01T00:00:00.000Z");
		const to = new Date("2024-01-11T00:00:00.000Z");
		expect(diffUtcDays(from, to)).toBe(10);
	});

	it("returns negative when to < from", () => {
		const from = new Date("2024-01-11T00:00:00.000Z");
		const to = new Date("2024-01-01T00:00:00.000Z");
		expect(diffUtcDays(from, to)).toBe(-10);
	});

	it("returns 0 for same day regardless of time", () => {
		const from = new Date("2024-07-15T03:00:00.000Z");
		const to = new Date("2024-07-15T22:00:00.000Z");
		expect(diffUtcDays(from, to)).toBe(0);
	});
});

// ─── State machine maps ──────────────────────────────────────────────────────

describe("SERIAL_NO_ALLOWED_STATUS_TRANSITIONS", () => {
	const map = SERIAL_NO_ALLOWED_STATUS_TRANSITIONS;

	it("DRAFT can transition to AVAILABLE, SCRAPPED, DISPOSED", () => {
		expect(map.DRAFT).toEqual(["AVAILABLE", "SCRAPPED", "DISPOSED"]);
	});

	it("AVAILABLE allows DELIVERED, INSTALLED, RETURNED, SCRAPPED, DISPOSED", () => {
		expect(map.AVAILABLE).toEqual([
			"DELIVERED",
			"INSTALLED",
			"RETURNED",
			"SCRAPPED",
			"DISPOSED",
		]);
	});

	it("SCRAPPED and DISPOSED are terminal", () => {
		expect(map.SCRAPPED).toEqual([]);
		expect(map.DISPOSED).toEqual([]);
	});

	it("covers every SerialNoStatus key", () => {
		const expectedKeys: Inventory.SerialNoStatus[] = [
			"DRAFT",
			"AVAILABLE",
			"DELIVERED",
			"INSTALLED",
			"RETURNED",
			"SCRAPPED",
			"DISPOSED",
		];
		expect(Object.keys(map).sort()).toEqual(expectedKeys.sort());
	});
});

describe("INSTALLATION_NOTE_ALLOWED_STATUS_TRANSITIONS", () => {
	const map = INSTALLATION_NOTE_ALLOWED_STATUS_TRANSITIONS;

	it("DRAFT can transition to IN_PROGRESS, COMPLETED, CANCELLED", () => {
		expect(map.DRAFT).toEqual(["IN_PROGRESS", "COMPLETED", "CANCELLED"]);
	});

	it("IN_PROGRESS can transition to COMPLETED, CANCELLED", () => {
		expect(map.IN_PROGRESS).toEqual(["COMPLETED", "CANCELLED"]);
	});

	it("COMPLETED and CANCELLED are terminal", () => {
		expect(map.COMPLETED).toEqual([]);
		expect(map.CANCELLED).toEqual([]);
	});
});

// ─── assertSerialNoStatusTransition ──────────────────────────────────────────

describe("assertSerialNoStatusTransition", () => {
	it("is a no-op for same status", () => {
		expect(() =>
			assertSerialNoStatusTransition("AVAILABLE", "AVAILABLE"),
		).not.toThrow();
	});

	it("allows valid transitions", () => {
		expect(() =>
			assertSerialNoStatusTransition("DRAFT", "AVAILABLE"),
		).not.toThrow();
		expect(() =>
			assertSerialNoStatusTransition("AVAILABLE", "DELIVERED"),
		).not.toThrow();
		expect(() =>
			assertSerialNoStatusTransition("DELIVERED", "RETURNED"),
		).not.toThrow();
		expect(() =>
			assertSerialNoStatusTransition("RETURNED", "AVAILABLE"),
		).not.toThrow();
	});

	it("throws BadRequestException for invalid transitions", () => {
		expect(() =>
			assertSerialNoStatusTransition("SCRAPPED", "AVAILABLE"),
		).toThrow(BadRequestException);
		expect(() => assertSerialNoStatusTransition("DISPOSED", "DRAFT")).toThrow(
			BadRequestException,
		);
		expect(() => assertSerialNoStatusTransition("DRAFT", "DELIVERED")).toThrow(
			BadRequestException,
		);
	});

	it("includes from/to in error message", () => {
		expect(() =>
			assertSerialNoStatusTransition("SCRAPPED", "AVAILABLE"),
		).toThrow("Cannot change serial number status from SCRAPPED to AVAILABLE");
	});
});

// ─── parseStockAgeingBucketRanges ────────────────────────────────────────────

describe("parseStockAgeingBucketRanges", () => {
	it("uses defaults when no input", () => {
		const result = parseStockAgeingBucketRanges();
		expect(result).toEqual([
			{ minAge: 0, maxAge: 30 },
			{ minAge: 31, maxAge: 60 },
			{ minAge: 61, maxAge: 90 },
			{ minAge: 91, maxAge: null },
		]);
	});

	it("uses defaults for empty string", () => {
		expect(parseStockAgeingBucketRanges("")).toEqual(
			parseStockAgeingBucketRanges(),
		);
	});

	it("uses defaults for whitespace-only string", () => {
		expect(parseStockAgeingBucketRanges("   ")).toEqual(
			parseStockAgeingBucketRanges(),
		);
	});

	it("parses custom ranges", () => {
		const result = parseStockAgeingBucketRanges("15,45");
		expect(result).toEqual([
			{ minAge: 0, maxAge: 15 },
			{ minAge: 16, maxAge: 45 },
			{ minAge: 46, maxAge: null },
		]);
	});

	it("deduplicates and sorts", () => {
		const result = parseStockAgeingBucketRanges("60,30,60,90,30");
		expect(result).toEqual([
			{ minAge: 0, maxAge: 30 },
			{ minAge: 31, maxAge: 60 },
			{ minAge: 61, maxAge: 90 },
			{ minAge: 91, maxAge: null },
		]);
	});

	it("handles single value", () => {
		const result = parseStockAgeingBucketRanges("30");
		expect(result).toEqual([
			{ minAge: 0, maxAge: 30 },
			{ minAge: 31, maxAge: null },
		]);
	});

	it("throws BadRequestException for non-numeric input", () => {
		expect(() => parseStockAgeingBucketRanges("abc")).toThrow(
			BadRequestException,
		);
	});

	it("throws BadRequestException for negative values", () => {
		expect(() => parseStockAgeingBucketRanges("-10,30")).toThrow(
			BadRequestException,
		);
	});

	it("handles spaces between values", () => {
		const result = parseStockAgeingBucketRanges("  30 , 60 , 90  ");
		expect(result).toEqual(parseStockAgeingBucketRanges("30,60,90"));
	});

	it("DEFAULT_STOCK_AGEING_BREAKS is [30, 60, 90]", () => {
		expect([...DEFAULT_STOCK_AGEING_BREAKS]).toEqual([30, 60, 90]);
	});
});

// ─── normalizeOptionalText ───────────────────────────────────────────────────

describe("normalizeOptionalText", () => {
	it("returns undefined for undefined", () => {
		expect(normalizeOptionalText(undefined)).toBeUndefined();
	});

	it("returns null for null", () => {
		expect(normalizeOptionalText(null)).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(normalizeOptionalText("")).toBeNull();
	});

	it("returns null for whitespace-only string", () => {
		expect(normalizeOptionalText("   ")).toBeNull();
	});

	it("trims and returns non-empty string", () => {
		expect(normalizeOptionalText("  hello  ")).toBe("hello");
	});
});

// ─── formatProductBundleItems ────────────────────────────────────────────────

describe("formatProductBundleItems", () => {
	it("maps items with capital-U UnitOfMeasurementId", () => {
		const result = formatProductBundleItems([
			{
				itemId: "item-1",
				quantity: 5,
				description: "desc",
				unitOfMeasurementId: "uom-1",
			},
		]);
		expect(result).toEqual([
			{
				itemId: "item-1",
				quantity: 5,
				description: "desc",
				UnitOfMeasurementId: "uom-1",
			},
		]);
	});

	it("handles missing optional fields", () => {
		const result = formatProductBundleItems([
			{ itemId: "item-2", quantity: 1 },
		]);
		expect(result[0].description).toBeUndefined();
		expect(result[0].UnitOfMeasurementId).toBeUndefined();
	});
});

// ─── isDefaultItemManufacturerConstraintViolation ────────────────────────────

describe("isDefaultItemManufacturerConstraintViolation", () => {
	function makePrismaError(
		code: string,
		meta?: Record<string, unknown>,
		message = "",
	) {
		return {
			code,
			meta,
			message,
		} as unknown as import("../../../generated/prisma/client").Prisma.PrismaClientKnownRequestError;
	}

	it("returns false for non-P2002 codes", () => {
		expect(
			isDefaultItemManufacturerConstraintViolation(
				makePrismaError("P2000", { target: ["itemId"] }),
			),
		).toBe(false);
	});

	it('returns true for P2002 with target array containing "itemId"', () => {
		expect(
			isDefaultItemManufacturerConstraintViolation(
				makePrismaError("P2002", { target: ["itemId"] }),
			),
		).toBe(true);
	});

	it('returns true for P2002 with target string "itemId"', () => {
		expect(
			isDefaultItemManufacturerConstraintViolation(
				makePrismaError("P2002", { target: "itemId" }),
			),
		).toBe(true);
	});

	it("returns true for P2002 with index name in message", () => {
		expect(
			isDefaultItemManufacturerConstraintViolation(
				makePrismaError(
					"P2002",
					{},
					`Unique constraint failed on ${ITEM_MANUFACTURERS_DEFAULT_PER_ITEM_INDEX}`,
				),
			),
		).toBe(true);
	});

	it("returns false for P2002 with unrelated target", () => {
		expect(
			isDefaultItemManufacturerConstraintViolation(
				makePrismaError("P2002", { target: ["name"] }),
			),
		).toBe(false);
	});

	it("returns false for P2002 with array target length > 1", () => {
		expect(
			isDefaultItemManufacturerConstraintViolation(
				makePrismaError("P2002", { target: ["itemId", "name"] }),
			),
		).toBe(false);
	});
});

// ─── computeBackoffMs ────────────────────────────────────────────────────────

describe("computeBackoffMs", () => {
	it("returns value in range [base, base+49] for attempt 0", () => {
		// 50 * 2^0 = 50, jitter 0..49 → range [50, 99]
		for (let i = 0; i < 20; i++) {
			const ms = computeBackoffMs(0);
			expect(ms).toBeGreaterThanOrEqual(50);
			expect(ms).toBeLessThan(100);
		}
	});

	it("grows exponentially", () => {
		// attempt 0: 50*1 = 50..99
		// attempt 1: 50*2 = 100..149
		// attempt 2: 50*4 = 200..249
		// attempt 3: 50*8 = 400..449
		for (let i = 0; i < 20; i++) {
			const ms2 = computeBackoffMs(2);
			expect(ms2).toBeGreaterThanOrEqual(200);
			expect(ms2).toBeLessThan(250);
		}
	});

	it("returns reasonable values for higher attempts", () => {
		const ms5 = computeBackoffMs(5); // 50*32 = 1600..1649
		expect(ms5).toBeGreaterThanOrEqual(1600);
		expect(ms5).toBeLessThan(1650);
	});
});

// ─── buildSerialNoTransactionLabel ───────────────────────────────────────────

describe("buildSerialNoTransactionLabel", () => {
	it("returns Purchase Receipt label", () => {
		expect(
			buildSerialNoTransactionLabel({ purchaseReceiptSeries: "PR-001" }),
		).toBe("Purchase Receipt PR-001");
	});

	it("returns Delivery Note label", () => {
		expect(
			buildSerialNoTransactionLabel({ deliveryNoteSeries: "DN-001" }),
		).toBe("Delivery Note DN-001");
	});

	it("returns Stock Entry label", () => {
		expect(buildSerialNoTransactionLabel({ stockEntrySeries: "SE-001" })).toBe(
			"Stock Entry SE-001",
		);
	});

	it("returns Pick List label", () => {
		expect(buildSerialNoTransactionLabel({ pickListSeries: "PL-001" })).toBe(
			"Pick List PL-001",
		);
	});

	it("returns Installation Note label", () => {
		expect(
			buildSerialNoTransactionLabel({ installationNoteSeries: "IN-001" }),
		).toBe("Installation Note IN-001");
	});

	it("returns null when all series are absent", () => {
		expect(buildSerialNoTransactionLabel({})).toBeNull();
	});

	it("returns null when all series are null", () => {
		expect(
			buildSerialNoTransactionLabel({
				purchaseReceiptSeries: null,
				deliveryNoteSeries: null,
				stockEntrySeries: null,
				pickListSeries: null,
				installationNoteSeries: null,
			}),
		).toBeNull();
	});

	it("uses priority order (first non-null wins)", () => {
		expect(
			buildSerialNoTransactionLabel({
				purchaseReceiptSeries: "PR-X",
				deliveryNoteSeries: "DN-X",
			}),
		).toBe("Purchase Receipt PR-X");

		expect(
			buildSerialNoTransactionLabel({
				purchaseReceiptSeries: null,
				deliveryNoteSeries: "DN-X",
				stockEntrySeries: "SE-X",
			}),
		).toBe("Delivery Note DN-X");
	});
});

// ─── normalizePostingTime ────────────────────────────────────────────────────

describe("normalizePostingTime", () => {
	const refDate = new Date("2024-06-15T14:30:45.000Z");

	it("appends :00 to HH:MM format", () => {
		expect(normalizePostingTime("09:15", refDate)).toBe("09:15:00");
	});

	it("returns already-complete HH:MM:SS unchanged (trimmed)", () => {
		expect(normalizePostingTime("  09:15:30  ", refDate)).toBe("09:15:30");
	});

	it("falls back to date time when postingTime is null", () => {
		const result = normalizePostingTime(null, refDate);
		// toTimeString().slice(0,8) returns local time — just verify format
		expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
	});

	it("falls back to date time when postingTime is undefined", () => {
		const result = normalizePostingTime(undefined, refDate);
		expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
	});

	it("falls back to date time when postingTime is empty", () => {
		const result = normalizePostingTime("", refDate);
		expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
	});
});
