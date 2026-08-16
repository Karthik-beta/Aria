import { describe, expect, it } from "vitest";
import {
	buildFixedAssetRegisterInput,
	selectFixedAssetRegisterCompany,
} from "./fixed-asset-register.utils";

describe("fixed-asset-register.utils", () => {
	it("builds an exact Company and default-book report input", () => {
		const result = buildFixedAssetRegisterInput({
			companyId: "company-r006",
			financeBookId: "",
			status: "IN_LOCATION",
			fromDate: "2026-01-01",
			toDate: "2026-03-31",
			groupBy: "ASSET_CATEGORY",
			assetCategory: "  Machinery  ",
			location: "",
		});

		expect(result).toEqual({
			companyId: "company-r006",
			financeBookId: undefined,
			status: "IN_LOCATION",
			fromDate: "2026-01-01",
			toDate: "2026-03-31",
			groupBy: "ASSET_CATEGORY",
			assetCategory: "Machinery",
			location: undefined,
		});
	});

	it("preserves an explicit finance-book selection", () => {
		const result = buildFixedAssetRegisterInput({
			companyId: "company-r006",
			financeBookId: "book-r006-secondary",
			status: "DISPOSED",
			fromDate: "2026-01-01",
			toDate: "2026-04-30",
			groupBy: "LOCATION",
			assetCategory: "",
			location: "Plant A",
		});

		expect(result).toMatchObject({
			companyId: "company-r006",
			financeBookId: "book-r006-secondary",
			status: "DISPOSED",
			groupBy: "LOCATION",
			location: "Plant A",
		});
	});

	it("clears an explicit book when the Company changes", () => {
		const result = selectFixedAssetRegisterCompany(
			{
				companyId: "company-r006-a",
				financeBookId: "book-r006-secondary",
				status: "IN_LOCATION",
				fromDate: "2026-01-01",
				toDate: "2026-03-31",
				groupBy: "ASSET_CATEGORY",
				assetCategory: "",
				location: "",
			},
			"company-r006-b",
		);

		expect(result).toMatchObject({
			companyId: "company-r006-b",
			financeBookId: "",
		});
	});
});
