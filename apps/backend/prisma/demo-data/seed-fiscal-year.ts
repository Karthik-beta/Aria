import { buildIndianFiscalYears } from "../../src/apps/asset/depreciation/demo-data.utils.js";
import type { PrismaService } from "../../src/shared/prisma.service.js";
import {
	DEMO_DEPRECIATION_ACCOUNTS,
	DEMO_FINANCE_BOOK_NAME,
} from "./asset-data.js";
import type { DemoConfig } from "./config.js";

export interface FiscalYearIds {
	fiscalYearIds: Map<string, string>;
	companyIds: Map<string, string>;
}

export async function seedFiscalYearData(
	prisma: PrismaService,
	config: DemoConfig,
): Promise<FiscalYearIds> {
	const ids: FiscalYearIds = {
		fiscalYearIds: new Map(),
		companyIds: new Map(),
	};

	const indianFiscalYears = buildIndianFiscalYears(config.dateRange.to);

	for (const fy of indianFiscalYears) {
		const existing = await prisma.fiscalYear.findUnique({
			where: { year: fy.year },
		});

		if (existing) {
			ids.fiscalYearIds.set(fy.year, existing.id);
		} else {
			const created = await prisma.fiscalYear.create({
				data: {
					year: fy.year,
					yearStartDate: fy.yearStartDate,
					yearEndDate: fy.yearEndDate,
					disabled: false,
					isShortYear: false,
				},
			});
			ids.fiscalYearIds.set(fy.year, created.id);
		}
	}

	const financeBook = await prisma.financeBook.upsert({
		where: { name: DEMO_FINANCE_BOOK_NAME },
		update: {},
		create: { name: DEMO_FINANCE_BOOK_NAME },
	});

	// Create the demo company using config values and cron posting defaults.
	const existingCompany = await prisma.company.findUnique({
		where: { name: config.company },
	});

	if (existingCompany) {
		ids.companyIds.set(config.company, existingCompany.id);
		await prisma.company.update({
			where: { id: existingCompany.id },
			data: {
				defaultFinanceBookId: financeBook.id,
				depreciationEntrySeries: "DEP-.YYYY.-",
				defaultCostCenter: "Bangalore Head Office - PTPL",
				accumulatedDepreciationAccount:
					DEMO_DEPRECIATION_ACCOUNTS.accumulatedDepreciation,
				depreciationExpenseAccount:
					DEMO_DEPRECIATION_ACCOUNTS.depreciationExpense,
			},
		});
	} else {
		const created = await prisma.company.create({
			data: {
				name: config.company,
				abbreviation: "PTPL",
				country: "India",
				currency: config.currency,
				taxId: "AABCP1234A",
				domain: "Manufacturing",
				isGroup: false,
				disabled: false,
				defaultFinanceBookId: financeBook.id,
				depreciationEntrySeries: "DEP-.YYYY.-",
				defaultCostCenter: "Bangalore Head Office - PTPL",
				accumulatedDepreciationAccount:
					DEMO_DEPRECIATION_ACCOUNTS.accumulatedDepreciation,
				depreciationExpenseAccount:
					DEMO_DEPRECIATION_ACCOUNTS.depreciationExpense,
			},
		});
		ids.companyIds.set(config.company, created.id);
	}

	const currentFiscalYear = buildIndianFiscalYears(config.dateRange.to)[3];
	const currentFYId = currentFiscalYear
		? ids.fiscalYearIds.get(currentFiscalYear.year)
		: undefined;
	const companyId = ids.companyIds.get(config.company);

	if (currentFYId && companyId) {
		const existingLink = await prisma.fiscalYearCompany.findFirst({
			where: {
				fiscalYearId: currentFYId,
				companyId: companyId,
			},
		});

		if (!existingLink) {
			await prisma.fiscalYearCompany.create({
				data: {
					fiscalYearId: currentFYId,
					companyId: companyId,
				},
			});
		}
	}

	return ids;
}
