import { describe, expect, it } from "bun:test";
import type { Asset } from "@aria/types";
import {
	ASSET_DEPRECIATING_STATUSES,
	ASSET_MAINTENANCE_ELIGIBLE_STATUSES,
	ASSET_OPERATIONAL_STATUSES,
	type DeriveAssetStatusInput,
	type DeriveOperationalStatusInput,
	deriveAssetStatus,
	deriveOperationalStatus,
	isOperationalAssetStatus,
} from "../asset-status";

type Status = Asset.AssetStatus;

const sorted = (values: readonly string[]): string[] => [...values].sort();

const ALL_STATUSES: Status[] = [
	"DRAFT",
	"SUBMITTED",
	"CANCELLED",
	"PARTIALLY_DEPRECIATED",
	"FULLY_DEPRECIATED",
	"SOLD",
	"SCRAPPED",
	"IN_MAINTENANCE",
	"OUT_OF_ORDER",
];

const depreciating = (
	overrides: Partial<DeriveAssetStatusInput> = {},
): DeriveAssetStatusInput => ({
	currentStatus: "SUBMITTED",
	calculateDepreciation: true,
	isFullyDepreciated: false,
	netPurchaseAmount: 100_000,
	valueAfterDepreciation: 100_000,
	defaultBook: {
		valueAfterDepreciation: 100_000,
		expectedValueAfterUsefulLife: 10_000,
	},
	...overrides,
});

const nonDepreciating = (
	overrides: Partial<DeriveAssetStatusInput> = {},
): DeriveAssetStatusInput => ({
	currentStatus: "SUBMITTED",
	calculateDepreciation: false,
	isFullyDepreciated: false,
	netPurchaseAmount: 100_000,
	valueAfterDepreciation: 100_000,
	defaultBook: null,
	...overrides,
});

describe("deriveAssetStatus (ERPNext Asset.get_status)", () => {
	describe("terminal statuses are sticky", () => {
		const cases: Array<[Status, Partial<DeriveAssetStatusInput>]> = [
			["DRAFT", {}],
			["CANCELLED", {}],
			["SOLD", {}],
			["SCRAPPED", {}],
			["SOLD", { isFullyDepreciated: true, calculateDepreciation: false }],
			[
				"SCRAPPED",
				{
					defaultBook: {
						valueAfterDepreciation: 0,
						expectedValueAfterUsefulLife: 0,
					},
				},
			],
			["DRAFT", { isFullyDepreciated: true, calculateDepreciation: false }],
			[
				"CANCELLED",
				{
					defaultBook: {
						valueAfterDepreciation: 50_000,
						expectedValueAfterUsefulLife: 10_000,
					},
				},
			],
		];
		it.each(cases)(
			"%s stays %s regardless of depreciation state",
			(status, overrides) => {
				expect(
					deriveAssetStatus(
						depreciating({ currentStatus: status, ...overrides }),
					),
				).toBe(status);
			},
		);
	});

	describe("non-depreciating assets", () => {
		it("a submitted asset flagged fully depreciated is Fully Depreciated (test_is_fully_depreciated_asset_status)", () => {
			expect(
				deriveAssetStatus(nonDepreciating({ isFullyDepreciated: true })),
			).toBe("FULLY_DEPRECIATED");
		});

		it("is Submitted when not fully depreciated, whatever the carrying value", () => {
			expect(deriveAssetStatus(nonDepreciating())).toBe("SUBMITTED");
			expect(
				deriveAssetStatus(nonDepreciating({ valueAfterDepreciation: 40_000 })),
			).toBe("SUBMITTED");
		});
	});

	describe("depreciating assets use the default finance book", () => {
		it("is Submitted when untouched", () => {
			expect(deriveAssetStatus(depreciating())).toBe("SUBMITTED");
		});

		it("is Partially Depreciated when the book value is below the purchase amount", () => {
			expect(
				deriveAssetStatus(
					depreciating({
						defaultBook: {
							valueAfterDepreciation: 90_000,
							expectedValueAfterUsefulLife: 10_000,
						},
					}),
				),
			).toBe("PARTIALLY_DEPRECIATED");
		});

		it("is Partially Depreciated with opening accumulated depreciation", () => {
			// net purchase 100,000 less 25,000 opening accumulated depreciation.
			expect(
				deriveAssetStatus(
					depreciating({
						valueAfterDepreciation: 75_000,
						defaultBook: {
							valueAfterDepreciation: 75_000,
							expectedValueAfterUsefulLife: 10_000,
						},
					}),
				),
			).toBe("PARTIALLY_DEPRECIATED");
		});

		it("is Fully Depreciated when the book value equals the expected value after useful life", () => {
			expect(
				deriveAssetStatus(
					depreciating({
						defaultBook: {
							valueAfterDepreciation: 10_000,
							expectedValueAfterUsefulLife: 10_000,
						},
					}),
				),
			).toBe("FULLY_DEPRECIATED");
		});

		it("is Fully Depreciated when the book value is below the expected value", () => {
			expect(
				deriveAssetStatus(
					depreciating({
						defaultBook: {
							valueAfterDepreciation: 5_000,
							expectedValueAfterUsefulLife: 10_000,
						},
					}),
				),
			).toBe("FULLY_DEPRECIATED");
		});

		it("is Fully Depreciated when opening depreciation already reaches the salvage value", () => {
			expect(
				deriveAssetStatus(
					depreciating({
						valueAfterDepreciation: 0,
						defaultBook: {
							valueAfterDepreciation: 0,
							expectedValueAfterUsefulLife: 0,
						},
					}),
				),
			).toBe("FULLY_DEPRECIATED");
		});

		it("compares at six decimals so float noise does not flip the status", () => {
			expect(
				deriveAssetStatus(
					depreciating({
						defaultBook: {
							valueAfterDepreciation: 100_000.000_000_4,
							expectedValueAfterUsefulLife: 10_000,
						},
					}),
				),
			).toBe("SUBMITTED");
			expect(
				deriveAssetStatus(
					depreciating({
						defaultBook: {
							valueAfterDepreciation: 10_000.000_000_4,
							expectedValueAfterUsefulLife: 10_000,
						},
					}),
				),
			).toBe("FULLY_DEPRECIATED");
		});

		it("falls back to the asset level value (salvage 0) when there is no default book", () => {
			expect(
				deriveAssetStatus(
					depreciating({ defaultBook: null, valueAfterDepreciation: 60_000 }),
				),
			).toBe("PARTIALLY_DEPRECIATED");
			expect(
				deriveAssetStatus(
					depreciating({ defaultBook: undefined, valueAfterDepreciation: 0 }),
				),
			).toBe("FULLY_DEPRECIATED");
		});
	});

	describe("depreciation-family and overlay statuses are recomputed", () => {
		const recomputed: Status[] = [
			"SUBMITTED",
			"PARTIALLY_DEPRECIATED",
			"FULLY_DEPRECIATED",
			"IN_MAINTENANCE",
			"OUT_OF_ORDER",
		];
		it.each(recomputed)(
			"%s is replaced by the derived base status",
			(status) => {
				expect(
					deriveAssetStatus(
						depreciating({
							currentStatus: status,
							defaultBook: {
								valueAfterDepreciation: 90_000,
								expectedValueAfterUsefulLife: 10_000,
							},
						}),
					),
				).toBe("PARTIALLY_DEPRECIATED");
			},
		);
	});
});

describe("deriveOperationalStatus (ERPNext update_maintenance_status)", () => {
	const input = (
		overrides: Partial<DeriveOperationalStatusInput> = {},
	): DeriveOperationalStatusInput => ({
		base: "SUBMITTED",
		hasPendingRepair: false,
		hasMaintenanceDueToday: false,
		maintenanceRequired: true,
		...overrides,
	});

	it("moves to In Maintenance when a task is due today", () => {
		expect(
			deriveOperationalStatus(input({ hasMaintenanceDueToday: true })),
		).toBe("IN_MAINTENANCE");
	});

	it("reverts to the base status the day after (no task due)", () => {
		expect(deriveOperationalStatus(input())).toBe("SUBMITTED");
		expect(
			deriveOperationalStatus(input({ base: "PARTIALLY_DEPRECIATED" })),
		).toBe("PARTIALLY_DEPRECIATED");
	});

	it("keeps a Sold asset Sold (test_asset_with_maintenance_required_status_after_sale)", () => {
		expect(
			deriveOperationalStatus(
				input({ base: "SOLD", hasMaintenanceDueToday: true }),
			),
		).toBe("SOLD");
		expect(
			deriveOperationalStatus(input({ base: "SOLD", hasPendingRepair: true })),
		).toBe("SOLD");
	});

	it.each<Status>(["DRAFT", "CANCELLED", "SOLD", "SCRAPPED"])(
		"never touches a %s asset",
		(base) => {
			expect(
				deriveOperationalStatus(
					input({
						base,
						hasMaintenanceDueToday: true,
						hasPendingRepair: true,
					}),
				),
			).toBe(base);
		},
	);

	it("lets a pending repair win over a due task", () => {
		expect(
			deriveOperationalStatus(
				input({ hasPendingRepair: true, hasMaintenanceDueToday: true }),
			),
		).toBe("OUT_OF_ORDER");
		expect(deriveOperationalStatus(input({ hasPendingRepair: true }))).toBe(
			"OUT_OF_ORDER",
		);
	});

	it("applies to fully depreciated assets and back", () => {
		expect(
			deriveOperationalStatus(
				input({ base: "FULLY_DEPRECIATED", hasMaintenanceDueToday: true }),
			),
		).toBe("IN_MAINTENANCE");
		expect(deriveOperationalStatus(input({ base: "FULLY_DEPRECIATED" }))).toBe(
			"FULLY_DEPRECIATED",
		);
	});

	it("leaves assets without maintenanceRequired on their base status", () => {
		expect(
			deriveOperationalStatus(
				input({
					maintenanceRequired: false,
					hasMaintenanceDueToday: true,
					hasPendingRepair: true,
				}),
			),
		).toBe("SUBMITTED");
	});
});

describe("status constants", () => {
	it("keeps depreciating assets posting while in maintenance or out of order", () => {
		expect(sorted(ASSET_DEPRECIATING_STATUSES)).toEqual(
			[
				"IN_MAINTENANCE",
				"OUT_OF_ORDER",
				"PARTIALLY_DEPRECIATED",
				"SUBMITTED",
			].sort(),
		);
	});

	it("never lets terminal statuses depreciate or be moved by maintenance", () => {
		for (const status of ["DRAFT", "CANCELLED", "SOLD", "SCRAPPED"] as const) {
			expect(ASSET_DEPRECIATING_STATUSES).not.toContain(status);
			expect(ASSET_MAINTENANCE_ELIGIBLE_STATUSES).not.toContain(status);
		}
	});

	it("exposes the overlay statuses as operational", () => {
		expect([...ASSET_OPERATIONAL_STATUSES]).toEqual([
			"IN_MAINTENANCE",
			"OUT_OF_ORDER",
		]);
		expect(ALL_STATUSES.filter(isOperationalAssetStatus)).toEqual([
			"IN_MAINTENANCE",
			"OUT_OF_ORDER",
		]);
	});

	it("covers every maintenance-eligible status", () => {
		expect(sorted(ASSET_MAINTENANCE_ELIGIBLE_STATUSES)).toEqual(
			[
				"FULLY_DEPRECIATED",
				"IN_MAINTENANCE",
				"OUT_OF_ORDER",
				"PARTIALLY_DEPRECIATED",
				"SUBMITTED",
			].sort(),
		);
	});
});
