import {
	ASSET_CATEGORIES,
	ASSET_REGISTER,
	DEMO_ASSET_LIFECYCLE_ACCOUNTS,
} from "./asset-data.js";
import { ITEMS } from "./data.js";
import { buildDisposalAccountingLines } from "./seed-asset-lifecycle.js";

function totals(lines: ReturnType<typeof buildDisposalAccountingLines>): {
	debit: number;
	credit: number;
} {
	return lines.reduce(
		(total, line) => ({
			debit: total.debit + line.debitAmount,
			credit: total.credit + line.creditAmount,
		}),
		{ debit: 0, credit: 0 },
	);
}

describe("asset lifecycle demo data", () => {
	it("keeps lifecycle assets unique and linked to real demo categories", () => {
		const keys = ASSET_REGISTER.map((asset) => asset.key);
		expect(new Set(keys).size).toBe(keys.length);

		const categories = new Set(
			ASSET_CATEGORIES.map((category) => category.name),
		);
		for (const asset of ASSET_REGISTER) {
			expect(categories.has(asset.assetCategory)).toBe(true);
		}

		for (const key of [
			"peenya-control-panel-subassembly-01",
			"whitefield-camera-module-subassembly-01",
			"peenya-cwip-power-monitoring-panel-01",
			"whitefield-cwip-reliability-rig-01",
		]) {
			expect(keys).toContain(key);
		}
	});

	it("provides a non-stock fixed-asset item for composite targets", () => {
		const target = ITEMS.find((item) => item.code === "FA-COMPOSITE-TEST-CELL");
		expect(target).toMatchObject({
			maintainStock: false,
			isFixedAsset: true,
		});
	});

	it("keeps both CWIP examples discoverable by configuration", () => {
		const category = ASSET_CATEGORIES.find(
			(candidate) => candidate.name === "Capital Projects & Composite Assets",
		);
		expect(category).toMatchObject({
			nonDepreciableCategory: true,
			enableCwipAccounting: true,
		});

		const cwipAssets = ASSET_REGISTER.filter(
			(asset) => asset.assetCategory === "Capital Projects & Composite Assets",
		);
		expect(cwipAssets).toHaveLength(2);
		expect(
			cwipAssets.every(
				(asset) =>
					asset.status === "SUBMITTED" &&
					asset.calculateDepreciation === false &&
					asset.netPurchaseAmount > 0,
			),
		).toBe(true);
	});

	it("builds balanced sale and scrap subledger lines", () => {
		const common = {
			fixedAssetAccount: "Test Equipment Fixed Asset",
			accumulatedDepreciationAccount: "Accumulated Depreciation - PTPL",
			gainLossAccount: DEMO_ASSET_LIFECYCLE_ACCOUNTS.assetDisposalGainLoss,
			fixedAssetBalance: 240000,
			carryingValue: 210000,
			costCenter: "Bangalore Head Office - PTPL",
		};
		const saleLines = buildDisposalAccountingLines({
			...common,
			proceedsAccount: DEMO_ASSET_LIFECYCLE_ACCOUNTS.assetSaleProceeds,
			proceeds: 215000,
		});
		const scrapLines = buildDisposalAccountingLines({
			...common,
			proceeds: 0,
		});

		const saleTotals = totals(saleLines);
		const scrapTotals = totals(scrapLines);
		expect(saleTotals.debit).toBe(saleTotals.credit);
		expect(scrapTotals.debit).toBe(scrapTotals.credit);
		expect(
			[...saleLines, ...scrapLines].every(
				(line) => line.debitAmount > 0 !== line.creditAmount > 0,
			),
		).toBe(true);
	});
});
