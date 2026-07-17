import { resolveDemoDepreciationStartDate } from "../../src/apps/asset/depreciation/demo-data.utils.js";
import { buildDepreciationSchedule } from "../../src/apps/asset/depreciation/depreciation-schedule-engine.js";
import type { PrismaService } from "../../src/shared/prisma.service.js";
import {
	ASSET_CATEGORIES,
	ASSET_LOCATIONS,
	ASSET_MAINTENANCE_TEAMS,
	ASSET_REGISTER,
	type AssetCategoryDef,
	type AssetLocationDef,
	DEMO_DEPRECIATION_ACCOUNTS,
	DEMO_FINANCE_BOOK_NAME,
} from "./asset-data.js";
import type { DemoConfig } from "./config.js";
import { CUSTOMERS, SUPPLIERS } from "./data.js";
import type { MasterIds } from "./seed-master.js";

function resolveRelativeDate(
	config: DemoConfig,
	offsetDays: number,
	hour = 10,
	minute = 0,
): Date {
	const date = new Date(config.dateRange.from);
	date.setDate(date.getDate() + offsetDays);
	date.setHours(hour, minute, 0, 0);
	return date;
}

function getCategoryDefaultsByName(): Map<string, AssetCategoryDef> {
	return new Map(ASSET_CATEGORIES.map((category) => [category.name, category]));
}

function getOpeningAssetValue(
	netPurchaseAmount: number,
	openingAccumulatedDepreciation: number,
): number {
	return Math.max(netPurchaseAmount - openingAccumulatedDepreciation, 0);
}

function buildAssetDocumentCode(
	prefix: string,
	purchaseDate: Date,
	index: number,
): string {
	return `${prefix}-${purchaseDate.getFullYear()}-${String(index + 1).padStart(4, "0")}`;
}

export async function seedAssetMasterData(
	prisma: PrismaService,
	config: DemoConfig,
	ids: MasterIds,
): Promise<void> {
	const categoryDefaults = getCategoryDefaultsByName();
	const assetSeriesCounters = new Map<number, number>();
	const [financeBook, company] = await Promise.all([
		prisma.financeBook.findUniqueOrThrow({
			where: { name: DEMO_FINANCE_BOOK_NAME },
		}),
		prisma.company.findUniqueOrThrow({ where: { name: config.company } }),
	]);

	async function getNextAssetSeries(year: number): Promise<string> {
		if (!assetSeriesCounters.has(year)) {
			const prefix = `AST-${year}-`;
			const last = await prisma.asset.findFirst({
				where: { series: { startsWith: prefix } },
				orderBy: { series: "desc" },
				select: { series: true },
			});
			let seed = 0;
			if (last?.series) {
				const num = Number.parseInt(last.series.slice(prefix.length), 10);
				if (Number.isFinite(num)) seed = num;
			}
			assetSeriesCounters.set(year, seed);
		}
		const next = (assetSeriesCounters.get(year) ?? 0) + 1;
		assetSeriesCounters.set(year, next);
		return `AST-${year}-${String(next).padStart(5, "0")}`;
	}

	async function createLocations(
		locations: AssetLocationDef[],
		parentLocationId: string | null,
	): Promise<void> {
		for (const location of locations) {
			const created = await prisma.location.create({
				data: {
					name: location.name,
					parentLocationId,
					isGroup: location.isGroup,
				},
			});
			ids.assetLocationIds.set(location.name, created.id);

			if (location.children) {
				await createLocations(location.children, created.id);
			}
		}
	}

	await createLocations(ASSET_LOCATIONS, null);

	for (const category of ASSET_CATEGORIES) {
		const created = await prisma.assetCategory.create({
			data: {
				name: category.name,
				depreciationMethod: category.depreciationMethod,
				totalNumberOfDepreciations: category.totalNumberOfDepreciations,
				frequencyOfDepreciation: category.frequencyOfDepreciation,
				dailyProrataBased: category.dailyProrataBased ?? false,
				shiftBased: category.shiftBased ?? false,
				rateOfDepreciation: category.rateOfDepreciation ?? null,
				expectedValueAfterUsefulLife:
					category.expectedValueAfterUsefulLife?.toString() ?? null,
				nonDepreciableCategory: category.nonDepreciableCategory ?? false,
				enableCwipAccounting: category.enableCwipAccounting ?? false,
				financeBookDefaults:
					category.nonDepreciableCategory || !category.depreciationMethod
						? undefined
						: {
								create: {
									financeBookId: financeBook.id,
									depreciationMethod: category.depreciationMethod,
									totalNumberOfDepreciations:
										category.totalNumberOfDepreciations ?? 1,
									frequencyOfDepreciation:
										category.frequencyOfDepreciation ?? 1,
									dailyProrataBased: category.dailyProrataBased ?? false,
									shiftBased: category.shiftBased ?? false,
									rateOfDepreciation: category.rateOfDepreciation ?? null,
									expectedValueAfterUsefulLife:
										category.expectedValueAfterUsefulLife?.toString() ?? null,
								},
							},
				accounts: {
					create: {
						companyId: company.id,
						fixedAssetAccount: `${category.name} Fixed Asset`,
						accumulatedDepreciationAccount:
							DEMO_DEPRECIATION_ACCOUNTS.accumulatedDepreciation,
						depreciationExpenseAccount:
							DEMO_DEPRECIATION_ACCOUNTS.depreciationExpense,
						capitalWorkInProgressAccount:
							DEMO_DEPRECIATION_ACCOUNTS.capitalWorkInProgress,
					},
				},
			},
		});
		ids.assetCategoryIds.set(category.name, created.id);
	}

	for (const team of ASSET_MAINTENANCE_TEAMS) {
		const created = await prisma.assetMaintenanceTeam.create({
			data: {
				name: team.name,
				maintenanceManager: team.maintenanceManager,
				maintenanceManagerName: team.maintenanceManagerName,
				company: config.company,
				members: {
					create: team.members.map((member) => ({
						teamMember: member.teamMember,
						fullName: member.fullName,
						maintenanceRole: member.maintenanceRole,
					})),
				},
			},
		});
		ids.assetMaintenanceTeamIds.set(team.key, created.id);
	}

	for (const [index, assetDef] of ASSET_REGISTER.entries()) {
		const category = categoryDefaults.get(assetDef.assetCategory);
		if (!category) {
			throw new Error(
				`Asset category "${assetDef.assetCategory}" is not defined in asset-data.ts`,
			);
		}

		if (assetDef.location && !ids.assetLocationIds.has(assetDef.location)) {
			throw new Error(
				`Asset location "${assetDef.location}" is not defined in asset-data.ts`,
			);
		}

		if (assetDef.supplier && !SUPPLIERS.includes(assetDef.supplier)) {
			throw new Error(
				`Asset supplier "${assetDef.supplier}" is not part of the inventory demo supplier universe`,
			);
		}

		if (assetDef.customer && !CUSTOMERS.includes(assetDef.customer)) {
			throw new Error(
				`Asset customer "${assetDef.customer}" is not part of the inventory demo customer universe`,
			);
		}

		if (
			(assetDef.status === "SOLD" || assetDef.status === "SCRAPPED") &&
			assetDef.disposalOffsetDays === undefined
		) {
			throw new Error(
				`Asset ${assetDef.key} requires a disposalOffsetDays value for status ${assetDef.status}`,
			);
		}

		const purchaseDate = resolveRelativeDate(
			config,
			assetDef.purchaseOffsetDays,
			10,
			15,
		);
		const availableForUseDate =
			assetDef.availableForUseOffsetDays === undefined ||
			assetDef.availableForUseOffsetDays === null
				? null
				: resolveRelativeDate(
						config,
						assetDef.availableForUseOffsetDays,
						11,
						0,
					);
		const disposalDate =
			assetDef.disposalOffsetDays === undefined ||
			assetDef.disposalOffsetDays === null
				? null
				: resolveRelativeDate(config, assetDef.disposalOffsetDays, 17, 0);
		const insuranceStartDate =
			assetDef.insuranceStartOffsetDays === undefined ||
			assetDef.insuranceStartOffsetDays === null
				? null
				: resolveRelativeDate(config, assetDef.insuranceStartOffsetDays, 9, 30);
		const insuranceEndDate =
			assetDef.insuranceEndOffsetDays === undefined ||
			assetDef.insuranceEndOffsetDays === null
				? null
				: resolveRelativeDate(config, assetDef.insuranceEndOffsetDays, 18, 0);

		const assetSeries = await getNextAssetSeries(purchaseDate.getFullYear());
		const openingAccumulatedDepreciation =
			assetDef.openingAccumulatedDepreciation ?? 0;
		const derivedOpeningValue = getOpeningAssetValue(
			assetDef.netPurchaseAmount,
			openingAccumulatedDepreciation,
		);
		const valueAfterDepreciation =
			assetDef.valueAfterDepreciation ?? derivedOpeningValue;
		const calculateDepreciation =
			assetDef.calculateDepreciation ?? !category.nonDepreciableCategory;
		const assetOwner = assetDef.assetOwner ?? "COMPANY";
		const depreciationMethod =
			assetDef.depreciationMethod ?? category.depreciationMethod;
		const totalNumberOfDepreciations =
			assetDef.totalNumberOfDepreciations ??
			category.totalNumberOfDepreciations;
		const frequencyOfDepreciation =
			assetDef.frequencyOfDepreciation ?? category.frequencyOfDepreciation;
		const depreciationStartDate =
			calculateDepreciation && availableForUseDate && frequencyOfDepreciation
				? resolveDemoDepreciationStartDate(
						config.dateRange.to,
						availableForUseDate,
						assetDef.openingNumberOfBookedDepreciations ?? 0,
						frequencyOfDepreciation,
					)
				: null;

		if (assetDef.isFullyDepreciated === true && valueAfterDepreciation > 0) {
			throw new Error(
				`Asset ${assetDef.key} cannot be fully depreciated with a positive carrying value`,
			);
		}

		const asset = await prisma.asset.create({
			data: {
				series: assetSeries,
				assetName: assetDef.assetName,
				itemCode: assetDef.itemCode,
				barcode: `BAR-${assetSeries}`,
				assetCategoryId:
					ids.assetCategoryIds.get(assetDef.assetCategory) ?? null,
				company: config.company,
				locationId: assetDef.location
					? (ids.assetLocationIds.get(assetDef.location) ?? null)
					: null,
				custodian: assetDef.custodian ?? null,
				department: assetDef.department ?? null,
				purchaseDate,
				availableForUseDate,
				disposalDate,
				netPurchaseAmount: assetDef.netPurchaseAmount.toString(),
				assetQuantity: assetDef.assetQuantity ?? 1,
				calculateDepreciation,
				openingAccumulatedDepreciation:
					openingAccumulatedDepreciation.toString(),
				openingNumberOfBookedDepreciations:
					assetDef.openingNumberOfBookedDepreciations ?? 0,
				isFullyDepreciated:
					assetDef.isFullyDepreciated ?? valueAfterDepreciation <= 0,
				valueAfterDepreciation: valueAfterDepreciation.toString(),
				maintenanceRequired: assetDef.maintenanceRequired ?? false,
				assetOwner,
				assetOwnerCompany:
					assetDef.assetOwnerCompany ??
					(assetOwner === "COMPANY" ? config.company : null),
				supplier: assetDef.supplier ?? null,
				customer: assetDef.customer ?? null,
				policyNumber:
					assetDef.policyNumber ??
					(assetDef.insurer
						? buildAssetDocumentCode("FA-POL", purchaseDate, index)
						: null),
				insurer: assetDef.insurer ?? null,
				insuredValue: assetDef.insuredValue?.toString() ?? null,
				insuranceStartDate,
				insuranceEndDate,
				depreciationMethod,
				totalNumberOfDepreciations,
				frequencyOfDepreciation,
				expectedValueAfterUsefulLife:
					category.expectedValueAfterUsefulLife?.toString() ?? null,
				depreciationStartDate,
				purchaseReceipt:
					assetDef.purchaseReceipt ??
					buildAssetDocumentCode("FA-GRN", purchaseDate, index),
				purchaseInvoice:
					assetDef.purchaseInvoice ??
					buildAssetDocumentCode("FA-PINV", purchaseDate, index),
				status: assetDef.status,
				createdAt: purchaseDate,
				updatedAt: disposalDate ?? availableForUseDate ?? purchaseDate,
			},
		});

		ids.assetIds.set(assetDef.key, asset.id);

		if (
			calculateDepreciation &&
			depreciationMethod &&
			totalNumberOfDepreciations &&
			frequencyOfDepreciation &&
			depreciationStartDate &&
			availableForUseDate
		) {
			const openingBooked = assetDef.openingNumberOfBookedDepreciations ?? 0;
			const fullyDepreciated =
				assetDef.isFullyDepreciated === true ||
				openingBooked >= totalNumberOfDepreciations;
			const assetBook = await prisma.assetFinanceBook.create({
				data: {
					assetId: asset.id,
					financeBookId: financeBook.id,
					depreciationMethod,
					totalNumberOfDepreciations,
					frequencyOfDepreciation,
					dailyProrataBased: category.dailyProrataBased ?? false,
					shiftBased: category.shiftBased ?? false,
					rateOfDepreciation: category.rateOfDepreciation?.toString() ?? null,
					expectedValueAfterUsefulLife: (
						category.expectedValueAfterUsefulLife ?? 0
					).toString(),
					depreciationStartDate,
					openingAccumulatedDepreciation:
						openingAccumulatedDepreciation.toString(),
					openingNumberOfBookedDepreciations: openingBooked,
					valueAfterDepreciation: derivedOpeningValue.toString(),
					totalNumberOfBookedDepreciations: openingBooked,
					postingStatus: fullyDepreciated
						? "FULLY_DEPRECIATED"
						: openingBooked > 0
							? "PARTIALLY_DEPRECIATED"
							: "PENDING",
				},
			});
			if (fullyDepreciated) continue;

			const schedule = buildDepreciationSchedule({
				financeBookId: financeBook.id,
				method: depreciationMethod,
				grossBookValue: assetDef.netPurchaseAmount,
				availableForUseDate: availableForUseDate.toISOString().slice(0, 10),
				depreciationStartDate: depreciationStartDate.toISOString().slice(0, 10),
				totalPeriods: totalNumberOfDepreciations,
				frequencyMonths: frequencyOfDepreciation,
				salvageValue: category.expectedValueAfterUsefulLife ?? 0,
				openingBookedPeriods: openingBooked,
				openingAccumulatedDepreciation,
				ratePercent: category.rateOfDepreciation ?? undefined,
				dailyProrata: category.dailyProrataBased ?? false,
			});
			await prisma.assetDepreciationSchedule.create({
				data: {
					assetId: asset.id,
					assetFinanceBookId: assetBook.id,
					revisionNumber: 1,
					status: ["SOLD", "SCRAPPED", "FULLY_DEPRECIATED"].includes(
						assetDef.status,
					)
						? "CANCELLED"
						: "ACTIVE",
					startDate: depreciationStartDate,
					depreciationMethod,
					totalNumberOfDepreciations,
					frequencyOfDepreciation,
					dailyProrataBased: category.dailyProrataBased ?? false,
					shiftBased: category.shiftBased ?? false,
					rateOfDepreciation: category.rateOfDepreciation ?? null,
					expectedValueAfterUsefulLife:
						category.expectedValueAfterUsefulLife?.toString() ?? null,
					bookedDepreciations: openingBooked,
					remainingDepreciations: schedule.entries.length,
					openingAccumulatedDepreciation:
						openingAccumulatedDepreciation.toString(),
					baseAssetValue: assetDef.netPurchaseAmount.toString(),
					notes: "Indian Companies Act demo depreciation schedule",
					entries: {
						create: schedule.entries.map((entry) => ({
							sequence: entry.periodNumber,
							scheduleDate: new Date(`${entry.date}T00:00:00.000Z`),
							depreciationAmount: entry.depreciationAmount.toString(),
							accumulatedDepreciationAmount:
								entry.accumulatedDepreciation.toString(),
							bookValueAfterDepreciation:
								entry.bookValueAfterDepreciation.toString(),
						})),
					},
				},
			});
		}
	}
}
