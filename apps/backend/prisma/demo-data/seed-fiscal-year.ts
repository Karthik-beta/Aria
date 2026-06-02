import type { PrismaService } from "../../src/shared/prisma.service.js";
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

	// Indian Fiscal Years: April 1 - March 31
	// For demo, we seed past, current, and next FY
	const indianFiscalYears = [
		{ year: "2022-23", yearStartDate: "2022-04-01", yearEndDate: "2023-03-31" },
		{ year: "2023-24", yearStartDate: "2023-04-01", yearEndDate: "2024-03-31" },
		{ year: "2024-25", yearStartDate: "2024-04-01", yearEndDate: "2025-03-31" },
		{ year: "2025-26", yearStartDate: "2025-04-01", yearEndDate: "2026-03-31" },
		{ year: "2026-27", yearStartDate: "2026-04-01", yearEndDate: "2027-03-31" },
	];

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
					yearStartDate: new Date(fy.yearStartDate),
					yearEndDate: new Date(fy.yearEndDate),
					disabled: false,
					isShortYear: false,
				},
			});
			ids.fiscalYearIds.set(fy.year, created.id);
		}
	}

	// Create the demo company using config values
	const existingCompany = await prisma.company.findUnique({
		where: { name: config.company },
	});

	if (existingCompany) {
		ids.companyIds.set(config.company, existingCompany.id);
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
			},
		});
		ids.companyIds.set(config.company, created.id);
	}

	// Link current FY (2025-26) to the company
	const currentFYId = ids.fiscalYearIds.get("2025-26");
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
