import {
	callTrpc,
	createE2ECompany,
	createE2EFinanceBook,
	deleteE2ECompany,
	deleteE2EFinanceBook,
	type E2ECompany,
	type E2EFinanceBook,
	expect,
	test,
} from "./fixtures";

test.describe.configure({ mode: "serial", timeout: 300_000 });

type ReportAsset = {
	id: string;
	assetName: string;
	status: string;
};

type RegisterReport = {
	scope: {
		company: string;
		financeBook: string | null;
		asOfDate: string;
	};
	rows: Array<{ assetId: string; assetName: string; company: string }>;
};

test.describe("Fixed Asset Register Report E2E Workflow", () => {
	test("renders persisted company scope, metadata, table, and export controls", async ({
		page,
	}) => {
		const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const company: E2ECompany = await createE2ECompany(
			page,
			`Wave4 Register Company ${suffix}`,
		);
		const financeBook: E2EFinanceBook = await createE2EFinanceBook(
			page,
			`Wave4 Register Finance Book ${suffix}`,
		);
		let assetId: string | undefined;

		try {
			const created = await callTrpc<ReportAsset>(
				page,
				"asset.createAsset",
				{
					assetName: `Wave4 Register Asset ${suffix}`,
					assetType: "EXISTING_ASSET",
					companyId: company.id,
					purchaseDate: "2026-08-10",
					availableForUseDate: "2026-08-10",
					netPurchaseAmount: 2345.67,
					calculateDepreciation: true,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 12,
					frequencyOfDepreciation: 1,
					expectedValueAfterUsefulLife: 10,
					depreciationStartDate: "2026-08-31",
					financeBooks: [
						{
							financeBookId: financeBook.id,
							depreciationMethod: "STRAIGHT_LINE",
							totalNumberOfDepreciations: 12,
							frequencyOfDepreciation: 1,
							depreciationStartDate: "2026-08-31",
							expectedValueAfterUsefulLife: 10,
						},
					],
				},
				"mutation",
			);
			assetId = created.id;
			await callTrpc(page, "asset.submitAsset", { id: assetId }, "mutation");

			const report = await callTrpc<RegisterReport>(
				page,
				"asset.listFixedAssetRegisterReport",
				{
					companyId: company.id,
					financeBookId: financeBook.id,
					fromDate: "2026-08-01",
					toDate: "2026-08-31",
					groupBy: "ASSET_CATEGORY",
					status: "IN_LOCATION",
				},
			);
			expect(report.scope).toMatchObject({
				company: company.name,
				financeBook: financeBook.name,
				asOfDate: "2026-08-31",
			});
			expect(report.rows).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						assetId,
						assetName: `Wave4 Register Asset ${suffix}`,
						company: company.name,
					}),
				]),
			);

			await page.goto("/asset/reports/fixed-asset-register", {
				waitUntil: "networkidle",
			});
			await expect(
				page.getByRole("heading", { name: /fixed asset register/i }),
			).toBeVisible({ timeout: 90_000 });
			await expect(
				page.getByText("Filter Criteria", { exact: true }),
			).toBeVisible();
			await expect(page.locator("#company")).toBeVisible();
			await expect(
				page.getByLabel("Finance Book", { exact: true }),
			).toBeVisible();
			await expect(
				page.getByRole("button", { name: /export excel/i }),
			).toBeVisible();
			await page.locator("#fromDate").fill("2026-08-01");
			await page.locator("#toDate").fill("2026-08-31");

			const companyFilter = page.locator("#company");
			await companyFilter.click();
			const companySearch = page.getByPlaceholder("Search companies…");
			await expect(companySearch).toBeVisible({ timeout: 90_000 });
			await companySearch.fill(company.name);
			const companyOption = page.getByRole("option", {
				name: company.name,
				exact: true,
			});
			await expect(companyOption).toBeVisible({ timeout: 90_000 });
			await companyOption.click();
			await expect(companyFilter).toContainText(company.name, {
				timeout: 90_000,
			});
			await expect(companyFilter).toHaveAttribute("data-state", "closed");

			const financeBookFilter = page.locator("#financeBook");
			await financeBookFilter.click();
			const financeBookOption = page.getByRole("option", {
				name: financeBook.name,
				exact: true,
			});
			await expect(financeBookOption).toBeVisible({ timeout: 90_000 });
			await page.keyboard.type(financeBook.name);
			await page.keyboard.press("Enter");
			await expect(financeBookFilter).toContainText(financeBook.name, {
				timeout: 90_000,
			});
			await expect(financeBookFilter).toHaveAttribute("data-state", "closed");

			await expect(
				page.getByText(
					`Scope: ${company.name} · ${financeBook.name} · as of 2026-08-31`,
				),
			).toBeVisible({ timeout: 90_000 });
			await expect(
				page.getByRole("cell", { name: `Wave4 Register Asset ${suffix}` }),
			).toBeVisible({ timeout: 90_000 });
			await expect(
				page.getByText("Uncategorized", { exact: true }),
			).toBeVisible();
		} finally {
			let canDeleteReferences = true;
			if (assetId) {
				let current = await callTrpc<ReportAsset | null>(
					page,
					"asset.getAssetById",
					{ id: assetId },
				).catch(() => null);
				if (!current) {
					canDeleteReferences = false;
				}
				if (current?.status === "SUBMITTED") {
					current = await callTrpc<ReportAsset>(
						page,
						"asset.cancelAsset",
						{ id: assetId },
						"mutation",
					);
				}
				if (current?.status === "DRAFT") {
					const schedules = await callTrpc<{
						items: Array<{ id: string }>;
					}>(page, "asset.getAssetDepreciationSchedules", { assetId });
					if (schedules.items.length === 0) {
						await callTrpc(
							page,
							"asset.deleteAsset",
							{ id: assetId },
							"mutation",
						);
					} else {
						canDeleteReferences = false;
					}
				} else if (current) {
					canDeleteReferences = false;
				}
			}
			if (canDeleteReferences) {
				await deleteE2EFinanceBook(page, financeBook.id);
				await deleteE2ECompany(page, company.id);
			}
		}
	});
});
