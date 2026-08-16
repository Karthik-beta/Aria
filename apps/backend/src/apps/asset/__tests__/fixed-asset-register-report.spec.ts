import { describe, expect, it, mock } from "bun:test";
import type { Asset } from "@aria/types";
import { PrismaService } from "../../../shared/prisma.service";
import { FixedAssetRegisterReportService } from "../fixed-asset-register-report";
import { buildFixedAssetRegisterExcel } from "../trpc/asset.router";

const ORGANIZATION_ID = "org-r006";
const COMPANY_ID = "company-r006";
const DEFAULT_FINANCE_BOOK_ID = "book-r006-default";
const SECONDARY_FINANCE_BOOK_ID = "book-r006-secondary";
const DEFAULT_ASSET_FINANCE_BOOK_ID = "asset-book-r006-default";
const SECONDARY_ASSET_FINANCE_BOOK_ID = "asset-book-r006-secondary";

const persistedDate = (value: string): Date =>
	new Date(`${value}T00:00:00.000Z`);

const makeAsset = () => ({
	id: "asset-r006",
	series: "AST-R006-00001",
	assetName: "R-006 test asset",
	companyId: COMPANY_ID,
	purchaseDate: persistedDate("2026-01-10"),
	availableForUseDate: persistedDate("2026-01-15"),
	netPurchaseAmount: 100_000,
	openingAccumulatedDepreciation: 5_000,
	calculateDepreciation: true,
	status: "SUBMITTED",
	assetCategory: { id: "category-r006", name: "Machinery" },
	location: { id: "location-r006", name: "Plant A" },
	company: {
		id: COMPANY_ID,
		name: "ACME Corporation",
		organizationId: ORGANIZATION_ID,
		defaultFinanceBookId: DEFAULT_FINANCE_BOOK_ID,
	},
	financeBooks: [
		{
			id: DEFAULT_ASSET_FINANCE_BOOK_ID,
			financeBookId: DEFAULT_FINANCE_BOOK_ID,
			openingAccumulatedDepreciation: 5_000,
			financeBook: { name: "Corporate Book" },
		},
		{
			id: SECONDARY_ASSET_FINANCE_BOOK_ID,
			financeBookId: SECONDARY_FINANCE_BOOK_ID,
			openingAccumulatedDepreciation: 10_000,
			financeBook: { name: "Tax Book" },
		},
	],
	valueAdjustments: [
		{
			id: "adjustment-default",
			financeBookId: DEFAULT_FINANCE_BOOK_ID,
			adjustmentDate: persistedDate("2026-02-01"),
			differenceAmount: 2_000,
		},
		{
			id: "adjustment-secondary",
			financeBookId: SECONDARY_FINANCE_BOOK_ID,
			adjustmentDate: persistedDate("2026-02-02"),
			differenceAmount: -1_000,
		},
		{
			id: "adjustment-future",
			financeBookId: DEFAULT_FINANCE_BOOK_ID,
			adjustmentDate: persistedDate("2026-04-01"),
			differenceAmount: 999_999,
		},
	],
	depreciationJournalEntries: [
		{
			id: "journal-default-jan",
			assetFinanceBookId: DEFAULT_ASSET_FINANCE_BOOK_ID,
			postingDate: persistedDate("2026-01-31"),
			depreciationAmount: 1_000,
		},
		{
			id: "journal-default-mar",
			assetFinanceBookId: DEFAULT_ASSET_FINANCE_BOOK_ID,
			postingDate: persistedDate("2026-03-31"),
			depreciationAmount: 2_000,
		},
		{
			id: "journal-default-future",
			assetFinanceBookId: DEFAULT_ASSET_FINANCE_BOOK_ID,
			postingDate: persistedDate("2026-04-01"),
			depreciationAmount: 999_999,
		},
		{
			id: "journal-secondary-jan",
			assetFinanceBookId: SECONDARY_ASSET_FINANCE_BOOK_ID,
			postingDate: persistedDate("2026-01-31"),
			depreciationAmount: 700,
		},
	],
	capitalizationsAsTarget: [],
	capitalizationsAsSource: [],
	disposals: [],
});

function createHarness() {
	const assets = [makeAsset()];
	const companyFindFirst = mock(
		async (
			_args: unknown,
		): Promise<{
			id: string;
			name: string;
			disabled: boolean;
			defaultFinanceBookId: string;
		} | null> => ({
			id: COMPANY_ID,
			name: "ACME Corporation",
			disabled: false,
			defaultFinanceBookId: DEFAULT_FINANCE_BOOK_ID,
		}),
	);
	const financeBookFindUnique = mock(
		async (args: { where: { id: string } }) => {
			const books = new Map([
				[
					DEFAULT_FINANCE_BOOK_ID,
					{ id: DEFAULT_FINANCE_BOOK_ID, name: "Corporate Book" },
				],
				[
					SECONDARY_FINANCE_BOOK_ID,
					{ id: SECONDARY_FINANCE_BOOK_ID, name: "Tax Book" },
				],
			]);
			return books.get(args.where.id) ?? null;
		},
	);
	const financeBookFindFirst = mock(
		async (args: { where: { AND?: Array<{ id?: string }> } }) => {
			const requestedId = args.where.AND?.find((condition) => condition.id)?.id;
			const books = new Map([
				[
					DEFAULT_FINANCE_BOOK_ID,
					{ id: DEFAULT_FINANCE_BOOK_ID, name: "Corporate Book" },
				],
				[
					SECONDARY_FINANCE_BOOK_ID,
					{ id: SECONDARY_FINANCE_BOOK_ID, name: "Tax Book" },
				],
			]);
			return requestedId ? (books.get(requestedId) ?? null) : null;
		},
	);
	const assetFindMany = mock(async (_args: unknown) => assets);
	const transaction = mock(
		async (callback: (client: unknown) => Promise<unknown>) =>
			callback({
				company: { findFirst: companyFindFirst },
				financeBook: {
					findUnique: financeBookFindUnique,
					findFirst: financeBookFindFirst,
				},
				asset: { findMany: assetFindMany },
			}),
	);
	const prisma = { $transaction: transaction } as unknown as PrismaService;

	return {
		assetFindMany,
		companyFindFirst,
		financeBookFindFirst,
		prisma,
		service: new FixedAssetRegisterReportService(prisma),
	};
}

const baseInput = {
	companyId: COMPANY_ID,
	fromDate: "2026-01-01",
	groupBy: "ASSET_CATEGORY" as const,
};

describe("FixedAssetRegisterReportService", () => {
	it("emits PrismaService as its Nest dependency token", () => {
		const metadata = Reflect.getMetadata(
			"design:paramtypes",
			FixedAssetRegisterReportService,
		) as unknown[] | undefined;

		expect(metadata?.[0]).toBe(PrismaService);
	});

	it("uses exact company scope and cumulative selected-book values at the as-of boundary", async () => {
		const harness = createHarness();
		const result = await harness.service.generateReport(
			{ ...baseInput, toDate: "2026-03-31", assetCategory: "Machinery" },
			ORGANIZATION_ID,
		);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]).toMatchObject({
			companyId: COMPANY_ID,
			company: "ACME Corporation",
			openingAccumulatedDepreciation: 5_000,
			depreciatedAmount: 3_000,
			accumulatedDepreciation: 8_000,
			revaluationAmount: 2_000,
			netBookValue: 94_000,
		});
		expect(result.summary).toMatchObject({
			totalAssets: 1,
			totalPurchaseAmount: 100_000,
			totalAccumulatedDepreciation: 8_000,
			totalNetBookValue: 94_000,
		});
		expect(result.scope).toMatchObject({
			organizationId: ORGANIZATION_ID,
			companyId: COMPANY_ID,
			financeBookId: DEFAULT_FINANCE_BOOK_ID,
			financeBook: "Corporate Book",
			financeBookSelection: "COMPANY_DEFAULT",
			asOfDate: "2026-03-31",
		});

		const january = result.chartPoints.find(
			(point) => point.month === "2026-01",
		);
		expect(january).toMatchObject({
			assetValue: 94_000,
			depreciatedAmount: 3_000,
		});

		const companyQuery = harness.companyFindFirst.mock.calls[0]?.[0] as
			| { where?: unknown }
			| undefined;
		expect(companyQuery).toMatchObject({
			where: { id: COMPANY_ID, organizationId: ORGANIZATION_ID },
		});
		const assetQuery = harness.assetFindMany.mock.calls[0]?.[0] as
			| { where?: unknown }
			| undefined;
		expect(JSON.stringify(assetQuery?.where)).not.toContain("contains");
		expect(assetQuery?.where).toMatchObject({
			AND: [
				expect.anything(),
				expect.objectContaining({
					companyId: COMPANY_ID,
					assetCategory: {
						is: { name: { equals: "Machinery", mode: "insensitive" } },
					},
				}),
			],
		});
	});

	it("excludes future posted depreciation and revaluation before the requested date", async () => {
		const harness = createHarness();
		const result = await harness.service.generateReport(
			{ ...baseInput, toDate: "2026-02-28" },
			ORGANIZATION_ID,
		);

		expect(result.rows[0]).toMatchObject({
			depreciatedAmount: 1_000,
			accumulatedDepreciation: 6_000,
			revaluationAmount: 2_000,
			netBookValue: 96_000,
		});
	});

	it("uses the explicitly selected book without double counting the Company default book", async () => {
		const harness = createHarness();
		const result = await harness.service.generateReport(
			{
				...baseInput,
				financeBookId: SECONDARY_FINANCE_BOOK_ID,
				toDate: "2026-03-31",
			},
			ORGANIZATION_ID,
		);

		expect(result.rows[0]).toMatchObject({
			openingAccumulatedDepreciation: 10_000,
			depreciatedAmount: 700,
			accumulatedDepreciation: 10_700,
			revaluationAmount: -1_000,
			netBookValue: 88_300,
		});
		expect(result.scope.financeBookSelection).toBe("EXPLICIT");
		expect(result.scope.financeBookId).toBe(SECONDARY_FINANCE_BOOK_ID);
	});

	it("fails closed when the exact Company is not owned by the active organization", async () => {
		const harness = createHarness();
		harness.companyFindFirst.mockImplementationOnce(async () => null);

		await expect(
			harness.service.generateReport(
				{ ...baseInput, toDate: "2026-03-31" },
				ORGANIZATION_ID,
			),
		).rejects.toThrow(/not available in the active organization/);
		expect(harness.assetFindMany).not.toHaveBeenCalled();
	});

	it("keeps trusted Organization scope in the generated workbook metadata", () => {
		const input = {
			companyId: COMPANY_ID,
			financeBookId: SECONDARY_FINANCE_BOOK_ID,
			fromDate: "2026-01-01",
			toDate: "2026-03-31",
			groupBy: "LOCATION" as const,
			assetCategory: "Machinery",
			location: "Plant A",
			assetId: "asset-r006",
			status: "DISPOSED" as const,
		};
		const result: Asset.FixedAssetRegisterReportResult = {
			rows: [
				{
					groupingKey: "location-r006",
					groupingLabel: "Plant A",
					assetId: "asset-r006",
					assetSeries: "AST-R006-00001",
					assetName: "R-006 test asset",
					assetCategoryId: "category-r006",
					assetCategoryName: "Machinery",
					locationId: "location-r006",
					locationName: "Plant A",
					companyId: COMPANY_ID,
					company: "ACME Corporation",
					purchaseDate: "2026-01-10",
					availableForUseDate: "2026-01-15",
					status: "SOLD",
					netPurchaseAmount: 100_000,
					openingAccumulatedDepreciation: 5_000,
					depreciatedAmount: 3_000,
					accumulatedDepreciation: 8_000,
					revaluationAmount: 2_000,
					netBookValue: 94_000,
				},
			],
			chartPoints: [],
			summary: {
				totalAssets: 1,
				totalPurchaseAmount: 100_000,
				totalDepreciatedAmount: 3_000,
				totalAccumulatedDepreciation: 8_000,
				totalRevaluationAmount: 2_000,
				totalNetBookValue: 94_000,
			},
			scope: {
				organizationId: ORGANIZATION_ID,
				companyId: COMPANY_ID,
				company: "ACME Corporation",
				financeBookId: SECONDARY_FINANCE_BOOK_ID,
				financeBook: "Tax Book",
				financeBookSelection: "EXPLICIT",
				fromDate: "2026-01-01",
				toDate: "2026-03-31",
				asOfDate: "2026-03-31",
				status: "DISPOSED",
			},
		};

		const base64 = buildFixedAssetRegisterExcel(input, result, {
			id: ORGANIZATION_ID,
			name: "R-006 Organization",
		});
		const XLSX = require("xlsx") as typeof import("xlsx");
		const workbook = XLSX.read(Buffer.from(base64, "base64"), {
			type: "buffer",
		});
		const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Report, {
			header: 1,
			raw: false,
		}) as unknown[][];
		const metadata = String(rows[2]?.[0] ?? "");

		expect(metadata).toContain("Organization: R-006 Organization");
		expect(metadata).toContain(`Organization ID: ${ORGANIZATION_ID}`);
		expect(metadata).toContain(`Company ID: ${COMPANY_ID}`);
		expect(metadata).toContain(`Finance Book: Tax Book`);
		expect(metadata).toContain(`Finance Book ID: ${SECONDARY_FINANCE_BOOK_ID}`);
		expect(metadata).toContain("Status: DISPOSED");
		expect(metadata).toContain("From: 2026-01-01");
		expect(metadata).toContain("To: 2026-03-31");
		expect(metadata).toContain("As Of: 2026-03-31");
		expect(metadata).toContain("Category: Machinery");
		expect(metadata).toContain("Location: Plant A");
		expect(metadata).toContain("Asset ID: asset-r006");
		expect(rows[5]?.[1]).toBe("AST-R006-00001");
	});
});
