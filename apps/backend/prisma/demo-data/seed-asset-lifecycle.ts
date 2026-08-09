import type { Prisma } from "../../src/generated/prisma/client.js";
import type { PrismaService } from "../../src/shared/prisma.service.js";
import {
	DEMO_ASSET_LIFECYCLE_ACCOUNTS,
	DEMO_DEPRECIATION_ACCOUNTS,
} from "./asset-data.js";
import type { DemoConfig } from "./config.js";
import { ITEMS } from "./data.js";
import type { MasterIds } from "./seed-master.js";

const DEMO_COST_CENTER = "Bangalore Head Office - PTPL";
const TARGET_FIXED_ASSET_ITEM = "FA-COMPOSITE-TEST-CELL";

export interface LifecycleAccountingLine {
	account: string;
	debitAmount: number;
	creditAmount: number;
	costCenter: string | null;
}

function roundAmount(value: number): number {
	return Number(value.toFixed(6));
}

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

function seriesYear(date: Date): number {
	return date.getFullYear();
}

function requiredId(
	values: Map<string, string>,
	key: string,
	description: string,
): string {
	const id = values.get(key);
	if (!id) {
		throw new Error(
			`${description} "${key}" was not created during demo seeding`,
		);
	}
	return id;
}

function itemDefinition(itemCode: string) {
	const item = ITEMS.find((candidate) => candidate.code === itemCode);
	if (!item) {
		throw new Error(`Inventory item ${itemCode} is missing from demo data`);
	}
	return item;
}

function assertBalancedAccountingLines(
	lines: readonly LifecycleAccountingLine[],
): void {
	if (lines.length < 2) {
		throw new Error("Asset lifecycle accounting requires at least two lines");
	}
	for (const line of lines) {
		if (!line.account.trim()) {
			throw new Error("Asset lifecycle accounting lines require an account");
		}
		if (line.debitAmount > 0 === line.creditAmount > 0) {
			throw new Error(
				`Accounting line ${line.account} must contain one debit or credit`,
			);
		}
	}
	const debits = roundAmount(
		lines.reduce((total, line) => total + line.debitAmount, 0),
	);
	const credits = roundAmount(
		lines.reduce((total, line) => total + line.creditAmount, 0),
	);
	if (debits <= 0 || debits !== credits) {
		throw new Error(
			`Asset lifecycle accounting is not balanced (${debits} debit, ${credits} credit)`,
		);
	}
}

export function buildDisposalAccountingLines(input: {
	fixedAssetAccount: string;
	accumulatedDepreciationAccount: string;
	proceedsAccount?: string | null;
	gainLossAccount: string;
	fixedAssetBalance: number;
	carryingValue: number;
	proceeds: number;
	costCenter?: string | null;
}): LifecycleAccountingLine[] {
	const fixedAssetBalance = roundAmount(input.fixedAssetBalance);
	const carryingValue = roundAmount(input.carryingValue);
	const proceeds = roundAmount(input.proceeds);
	const accumulatedDepreciation = roundAmount(
		fixedAssetBalance - carryingValue,
	);
	const gainLoss = roundAmount(proceeds - carryingValue);
	if (
		fixedAssetBalance <= 0 ||
		carryingValue < 0 ||
		accumulatedDepreciation < 0
	) {
		throw new Error(
			"Disposal values are inconsistent with the fixed-asset balance",
		);
	}
	if (proceeds > 0 && !input.proceedsAccount?.trim()) {
		throw new Error("A proceeds account is required for an asset sale");
	}

	const costCenter = input.costCenter?.trim() || null;
	const lines: LifecycleAccountingLine[] = [
		{
			account: input.fixedAssetAccount,
			debitAmount: 0,
			creditAmount: fixedAssetBalance,
			costCenter,
		},
		...(accumulatedDepreciation > 0
			? [
					{
						account: input.accumulatedDepreciationAccount,
						debitAmount: accumulatedDepreciation,
						creditAmount: 0,
						costCenter,
					},
				]
			: []),
		...(proceeds > 0
			? [
					{
						account: input.proceedsAccount as string,
						debitAmount: proceeds,
						creditAmount: 0,
						costCenter,
					},
				]
			: []),
		...(gainLoss !== 0
			? [
					{
						account: input.gainLossAccount,
						debitAmount: gainLoss < 0 ? -gainLoss : 0,
						creditAmount: gainLoss > 0 ? gainLoss : 0,
						costCenter,
					},
				]
			: []),
	];
	assertBalancedAccountingLines(lines);
	return lines;
}

async function createAccountingEntry(
	tx: Prisma.TransactionClient,
	input: {
		series: string;
		company: string;
		assetId: string;
		sourceType: "CAPITALIZATION" | "CWIP_CAPITALIZATION" | "DISPOSAL";
		sourceId: string;
		postingDate: Date;
		remarks: string;
		status?: "POSTED" | "REVERSED";
		reversedAt?: Date | null;
		lines: readonly LifecycleAccountingLine[];
	},
) {
	assertBalancedAccountingLines(input.lines);
	return tx.assetAccountingEntry.create({
		data: {
			series: input.series,
			company: input.company,
			assetId: input.assetId,
			sourceType: input.sourceType,
			sourceId: input.sourceId,
			postingDate: input.postingDate,
			remarks: input.remarks,
			status: input.status ?? "POSTED",
			reversedAt: input.reversedAt ?? null,
			createdAt: input.postingDate,
			updatedAt: input.reversedAt ?? input.postingDate,
			lines: {
				create: input.lines.map((line, index) => ({
					lineType: line.debitAmount > 0 ? "DEBIT" : "CREDIT",
					account: line.account,
					debitAmount: line.debitAmount.toFixed(6),
					creditAmount: line.creditAmount.toFixed(6),
					costCenter: line.costCenter,
					createdAt: new Date(input.postingDate.getTime() + index * 60_000),
					updatedAt: new Date(input.postingDate.getTime() + index * 60_000),
				})),
			},
		},
	});
}

async function createMaterialIssue(
	tx: Prisma.TransactionClient,
	input: {
		series: string;
		company: string;
		postingDate: Date;
		sourceLabel: string;
		lines: Array<{
			itemCode: string;
			warehouse: string;
			quantity: number;
		}>;
	},
) {
	return tx.stockEntry.create({
		data: {
			series: input.series,
			stockEntryType: "MATERIAL_ISSUE",
			postingDate: input.postingDate,
			company: input.company,
			status: "SUBMITTED",
			defaultSourceWarehouse: input.lines[0]?.warehouse ?? null,
			remarks: input.sourceLabel,
			createdAt: input.postingDate,
			updatedAt: input.postingDate,
			items: {
				create: input.lines.map((line) => {
					const item = itemDefinition(line.itemCode);
					if (!item.maintainStock) {
						throw new Error(`${item.code} cannot be used in a material issue`);
					}
					return {
						sourceWarehouse: line.warehouse,
						itemCode: item.code,
						itemName: item.name,
						qty: line.quantity,
						basicRate: item.valuationRate,
						basicAmount: roundAmount(line.quantity * item.valuationRate),
						unitOfMeasure: item.uom,
					};
				}),
			},
		},
	});
}

async function categoryAccountingContext(
	tx: Prisma.TransactionClient,
	assetCategoryId: string | null,
	company: string,
) {
	if (!assetCategoryId) {
		throw new Error("Lifecycle demo asset requires an asset category");
	}
	const context = await tx.assetCategoryAccount.findFirst({
		where: { assetCategoryId, company: { name: company } },
		select: {
			fixedAssetAccount: true,
			accumulatedDepreciationAccount: true,
			capitalWorkInProgressAccount: true,
		},
	});
	if (!context?.fixedAssetAccount) {
		throw new Error(`Fixed asset account is missing for company ${company}`);
	}
	return context;
}

async function seedMovements(
	tx: Prisma.TransactionClient,
	config: DemoConfig,
	ids: MasterIds,
): Promise<void> {
	const submittedDate = resolveRelativeDate(config, 142, 11, 0);
	const submittedAssetId = requiredId(
		ids.assetIds,
		"hyd-calibration-trolley-01",
		"Asset",
	);
	const submittedAsset = await tx.asset.findUniqueOrThrow({
		where: { id: submittedAssetId },
		select: { locationId: true, custodian: true },
	});
	const submittedTargetId = requiredId(
		ids.assetLocationIds,
		"Whitefield Reliability Lab",
		"Asset location",
	);
	const submittedMovement = await tx.assetMovement.create({
		data: {
			series: `MOV-PTPL-${seriesYear(submittedDate)}-00001`,
			company: config.company,
			transactionDate: submittedDate,
			purpose: "TRANSFER",
			status: "SUBMITTED",
			notes:
				"Field calibration trolley transferred to Whitefield for traceable annual certification.",
			submittedAt: new Date(submittedDate.getTime() + 30 * 60_000),
			createdAt: new Date(submittedDate.getTime() - 24 * 60 * 60_000),
			updatedAt: new Date(submittedDate.getTime() + 30 * 60_000),
			items: {
				create: {
					assetId: submittedAssetId,
					sourceLocationId: submittedAsset.locationId,
					targetLocationId: submittedTargetId,
					fromEmployee: submittedAsset.custodian,
					toEmployee: "Arun Prasad",
				},
			},
		},
	});
	await tx.asset.update({
		where: { id: submittedAssetId },
		data: { locationId: submittedTargetId, custodian: "Arun Prasad" },
	});
	await tx.assetActivity.create({
		data: {
			assetId: submittedAssetId,
			activity: `Asset movement ${submittedMovement.series} submitted to Whitefield Reliability Lab.`,
			createdAt: submittedMovement.submittedAt ?? submittedDate,
		},
	});

	const pendingDate = resolveRelativeDate(config, 176, 15, 0);
	const pendingAssetId = requiredId(
		ids.assetIds,
		"peenya-ups-160kva-01",
		"Asset",
	);
	const pendingAsset = await tx.asset.findUniqueOrThrow({
		where: { id: pendingAssetId },
		select: { locationId: true, custodian: true },
	});
	await tx.assetMovement.create({
		data: {
			series: `MOV-PTPL-${seriesYear(pendingDate)}-00002`,
			company: config.company,
			transactionDate: pendingDate,
			purpose: "TRANSFER",
			status: "DRAFT",
			notes:
				"Pending submission: relocate the UPS panel to the Peenya main electrical store during busbar maintenance.",
			createdAt: pendingDate,
			updatedAt: pendingDate,
			items: {
				create: {
					assetId: pendingAssetId,
					sourceLocationId: pendingAsset.locationId,
					targetLocationId: requiredId(
						ids.assetLocationIds,
						"Peenya Main Warehouse",
						"Asset location",
					),
					fromEmployee: pendingAsset.custodian,
					toEmployee: "Naveen Kumar",
				},
			},
		},
	});
}

async function seedRepairs(
	tx: Prisma.TransactionClient,
	config: DemoConfig,
	ids: MasterIds,
): Promise<void> {
	const completedAssetId = requiredId(
		ids.assetIds,
		"peenya-generator-panel-01",
		"Asset",
	);
	const completedAsset = await tx.asset.findUniqueOrThrow({
		where: { id: completedAssetId },
		select: {
			status: true,
			netPurchaseAmount: true,
			valueAfterDepreciation: true,
			totalNumberOfDepreciations: true,
		},
	});
	const failureDate = resolveRelativeDate(config, 118, 8, 30);
	const completionDate = resolveRelativeDate(config, 126, 16, 15);
	const temperatureSensor = itemDefinition("SEN-TEMP-02");
	const controlWire = itemDefinition("RAW-WIRE-22AWG");
	const repairCost = roundAmount(
		2 * temperatureSensor.valuationRate + 3 * controlWire.valuationRate,
	);
	const completedRepair = await tx.assetRepair.create({
		data: {
			series: `REP-PTPL-${seriesYear(failureDate)}-00001`,
			assetId: completedAssetId,
			company: config.company,
			failureDate,
			completionDate,
			repairStatus: "COMPLETED",
			repairCost,
			capitalizeRepairCost: false,
			increaseInAssetLife: 0,
			description:
				"Replaced failed temperature probes and renewed control wiring after the quarterly DG auto-start drill.",
			submittedAt: completionDate,
			previousAssetStatus: completedAsset.status,
			previousNetPurchaseAmount: completedAsset.netPurchaseAmount,
			previousValueAfterDepreciation: completedAsset.valueAfterDepreciation,
			previousTotalDepreciations: completedAsset.totalNumberOfDepreciations,
			createdAt: failureDate,
			updatedAt: completionDate,
			consumedItems: {
				create: [
					{
						itemCode: temperatureSensor.code,
						warehouse: "Peenya Main Warehouse",
						expenseAccount: DEMO_ASSET_LIFECYCLE_ACCOUNTS.repairsAndMaintenance,
						quantity: 2,
						valuationRate: temperatureSensor.valuationRate,
						totalAmount: roundAmount(2 * temperatureSensor.valuationRate),
					},
					{
						itemCode: controlWire.code,
						warehouse: "Peenya Main Warehouse",
						expenseAccount: DEMO_ASSET_LIFECYCLE_ACCOUNTS.repairsAndMaintenance,
						quantity: 3,
						valuationRate: controlWire.valuationRate,
						totalAmount: roundAmount(3 * controlWire.valuationRate),
					},
				],
			},
		},
	});
	const repairStockEntry = await createMaterialIssue(tx, {
		series: `MAT-STE-PTPL-${seriesYear(completionDate)}-00001`,
		company: config.company,
		postingDate: completionDate,
		sourceLabel: `ASSET_REPAIR ${completedRepair.id}`,
		lines: [
			{
				itemCode: temperatureSensor.code,
				warehouse: "Peenya Main Warehouse",
				quantity: 2,
			},
			{
				itemCode: controlWire.code,
				warehouse: "Peenya Main Warehouse",
				quantity: 3,
			},
		],
	});
	await tx.assetRepair.update({
		where: { id: completedRepair.id },
		data: { stockEntryId: repairStockEntry.id },
	});
	await tx.assetActivity.create({
		data: {
			assetId: completedAssetId,
			activity: `Asset repair ${completedRepair.series} completed with material issue ${repairStockEntry.series}.`,
			createdAt: completionDate,
		},
	});

	const pendingAssetId = requiredId(
		ids.assetIds,
		"whitefield-env-chamber-01",
		"Asset",
	);
	const pendingAsset = await tx.asset.findUniqueOrThrow({
		where: { id: pendingAssetId },
		select: { status: true },
	});
	const pendingFailureDate = resolveRelativeDate(config, 172, 9, 20);
	const pendingRepair = await tx.assetRepair.create({
		data: {
			series: `REP-PTPL-${seriesYear(pendingFailureDate)}-00002`,
			assetId: pendingAssetId,
			company: config.company,
			failureDate: pendingFailureDate,
			repairStatus: "PENDING",
			repairCost: temperatureSensor.valuationRate,
			capitalizeRepairCost: false,
			increaseInAssetLife: 0,
			description:
				"Temperature-control probe drift is under diagnosis; replacement stock is reserved but not yet issued.",
			previousAssetStatus: pendingAsset.status,
			createdAt: pendingFailureDate,
			updatedAt: pendingFailureDate,
			consumedItems: {
				create: {
					itemCode: temperatureSensor.code,
					warehouse: "Whitefield QC Hold Area",
					expenseAccount: DEMO_ASSET_LIFECYCLE_ACCOUNTS.repairsAndMaintenance,
					quantity: 1,
					valuationRate: temperatureSensor.valuationRate,
					totalAmount: temperatureSensor.valuationRate,
				},
			},
		},
	});
	await tx.asset.update({
		where: { id: pendingAssetId },
		data: { status: "OUT_OF_ORDER" },
	});
	await tx.assetActivity.create({
		data: {
			assetId: pendingAssetId,
			activity: `Asset marked out of order for pending repair ${pendingRepair.series}.`,
			createdAt: pendingFailureDate,
		},
	});
}

async function seedCapitalizations(
	tx: Prisma.TransactionClient,
	config: DemoConfig,
	ids: MasterIds,
): Promise<void> {
	const draftDate = resolveRelativeDate(config, 176, 12, 0);
	const draftSourceId = requiredId(
		ids.assetIds,
		"whitefield-camera-module-subassembly-01",
		"Asset",
	);
	const draftSource = await tx.asset.findUniqueOrThrow({
		where: { id: draftSourceId },
		select: { valueAfterDepreciation: true },
	});
	await tx.assetCapitalization.create({
		data: {
			series: `CAP-PTPL-${seriesYear(draftDate)}-00001`,
			company: config.company,
			postingDate: draftDate,
			targetType: "NEW_ASSET",
			targetAssetName: "Whitefield Composite AOI Inspection Bench",
			targetAssetCategory: "Test & Calibration Instruments",
			targetItemCode: TARGET_FIXED_ASSET_ITEM,
			status: "DRAFT",
			totalStockValue: 0,
			totalAssetValue: draftSource.valueAfterDepreciation,
			totalServiceValue: 0,
			totalValue: draftSource.valueAfterDepreciation,
			notes:
				"Awaiting approval: the source vision module remains operational and no target asset or voucher has been posted.",
			createdAt: draftDate,
			updatedAt: draftDate,
			assetItems: {
				create: {
					assetId: draftSourceId,
					assetValue: draftSource.valueAfterDepreciation,
				},
			},
		},
	});

	const postingDate = resolveRelativeDate(config, 152, 14, 0);
	const sourceAssetId = requiredId(
		ids.assetIds,
		"peenya-control-panel-subassembly-01",
		"Asset",
	);
	const source = await tx.asset.findUniqueOrThrow({
		where: { id: sourceAssetId },
		select: {
			series: true,
			status: true,
			disposalDate: true,
			assetCategoryId: true,
			netPurchaseAmount: true,
			valueAfterDepreciation: true,
		},
	});
	const targetCategoryId = requiredId(
		ids.assetCategoryIds,
		"Test & Calibration Instruments",
		"Asset category",
	);
	const target = await tx.asset.create({
		data: {
			series: `AST-PTPL-CAP-${seriesYear(postingDate)}-00001`,
			assetName: "Peenya Composite Functional Test Cell",
			itemCode: TARGET_FIXED_ASSET_ITEM,
			barcode: `BAR-AST-PTPL-CAP-${seriesYear(postingDate)}-00001`,
			assetCategoryId: targetCategoryId,
			company: config.company,
			locationId: requiredId(
				ids.assetLocationIds,
				"Peenya Production Floor",
				"Asset location",
			),
			custodian: "Harsha Rao",
			department: "Manufacturing Engineering",
			purchaseDate: postingDate,
			availableForUseDate: postingDate,
			netPurchaseAmount: 0,
			valueAfterDepreciation: 0,
			calculateDepreciation: false,
			status: "DRAFT",
			createdAt: postingDate,
			updatedAt: postingDate,
		},
	});
	const powerSupply = itemDefinition("PWR-SMPS-12V5A");
	const stockValue = roundAmount(2 * powerSupply.valuationRate);
	const serviceValue = 15000;
	const sourceValue = roundAmount(Number(source.valueAfterDepreciation));
	const totalValue = roundAmount(sourceValue + stockValue + serviceValue);
	const capitalization = await tx.assetCapitalization.create({
		data: {
			series: `CAP-PTPL-${seriesYear(postingDate)}-00002`,
			company: config.company,
			postingDate,
			targetType: "NEW_ASSET",
			targetAssetId: target.id,
			targetAssetName: target.assetName,
			targetAssetCategory: "Test & Calibration Instruments",
			targetItemCode: TARGET_FIXED_ASSET_ITEM,
			status: "SUBMITTED",
			totalStockValue: stockValue,
			totalAssetValue: sourceValue,
			totalServiceValue: serviceValue,
			totalValue,
			notes:
				"Control-panel subassembly, regulated power supplies, and integration labour capitalized into a composite functional test cell.",
			submittedAt: new Date(postingDate.getTime() + 45 * 60_000),
			createdTargetAsset: true,
			targetPreviousNetPurchaseAmount: 0,
			targetPreviousValueAfterDepreciation: 0,
			targetPreviousStatus: "DRAFT",
			createdAt: new Date(postingDate.getTime() - 24 * 60 * 60_000),
			updatedAt: new Date(postingDate.getTime() + 45 * 60_000),
			stockItems: {
				create: {
					itemCode: powerSupply.code,
					warehouse: "Peenya Main Warehouse",
					expenseAccount: DEMO_ASSET_LIFECYCLE_ACCOUNTS.storesConsumption,
					stockQty: 2,
					valuationRate: powerSupply.valuationRate,
					amount: stockValue,
				},
			},
			assetItems: {
				create: {
					assetId: sourceAssetId,
					assetValue: sourceValue,
					previousStatus: source.status,
					previousDisposalDate: source.disposalDate,
				},
			},
			serviceItems: {
				create: {
					itemCode: null,
					expenseAccount:
						DEMO_ASSET_LIFECYCLE_ACCOUNTS.externalEngineeringServices,
					amount: serviceValue,
				},
			},
		},
	});
	const stockEntry = await createMaterialIssue(tx, {
		series: `MAT-STE-PTPL-${seriesYear(postingDate)}-00002`,
		company: config.company,
		postingDate,
		sourceLabel: `ASSET_CAPITALIZATION ${capitalization.id}`,
		lines: [
			{
				itemCode: powerSupply.code,
				warehouse: "Peenya Main Warehouse",
				quantity: 2,
			},
		],
	});
	const [sourceContext, targetContext] = await Promise.all([
		categoryAccountingContext(tx, source.assetCategoryId, config.company),
		categoryAccountingContext(tx, targetCategoryId, config.company),
	]);
	const sourceFixedBalance = roundAmount(Number(source.netPurchaseAmount));
	const sourceAccumulatedDepreciation = roundAmount(
		sourceFixedBalance - sourceValue,
	);
	const accountingLines: LifecycleAccountingLine[] = [
		{
			account: targetContext.fixedAssetAccount,
			debitAmount: totalValue,
			creditAmount: 0,
			costCenter: DEMO_COST_CENTER,
		},
		{
			account: sourceContext.fixedAssetAccount,
			debitAmount: 0,
			creditAmount: sourceFixedBalance,
			costCenter: DEMO_COST_CENTER,
		},
		...(sourceAccumulatedDepreciation > 0
			? [
					{
						account:
							sourceContext.accumulatedDepreciationAccount ??
							DEMO_DEPRECIATION_ACCOUNTS.accumulatedDepreciation,
						debitAmount: sourceAccumulatedDepreciation,
						creditAmount: 0,
						costCenter: DEMO_COST_CENTER,
					},
				]
			: []),
		{
			account: DEMO_ASSET_LIFECYCLE_ACCOUNTS.storesConsumption,
			debitAmount: 0,
			creditAmount: stockValue,
			costCenter: DEMO_COST_CENTER,
		},
		{
			account: DEMO_ASSET_LIFECYCLE_ACCOUNTS.externalEngineeringServices,
			debitAmount: 0,
			creditAmount: serviceValue,
			costCenter: DEMO_COST_CENTER,
		},
	];
	const accountingEntry = await createAccountingEntry(tx, {
		series: `AAE-PTPL-${seriesYear(postingDate)}-00001`,
		company: config.company,
		assetId: target.id,
		sourceType: "CAPITALIZATION",
		sourceId: capitalization.id,
		postingDate,
		remarks: `Capitalization ${capitalization.series} into ${target.series}`,
		lines: accountingLines,
	});
	await tx.assetCapitalization.update({
		where: { id: capitalization.id },
		data: {
			stockEntryId: stockEntry.id,
			accountingEntryId: accountingEntry.id,
		},
	});
	await tx.asset.update({
		where: { id: target.id },
		data: {
			netPurchaseAmount: totalValue,
			valueAfterDepreciation: totalValue,
			updatedAt: capitalization.submittedAt ?? postingDate,
		},
	});
	await tx.asset.update({
		where: { id: sourceAssetId },
		data: {
			status: "CAPITALIZED",
			disposalDate: postingDate,
			updatedAt: capitalization.submittedAt ?? postingDate,
		},
	});
	await tx.assetActivity.createMany({
		data: [
			{
				assetId: target.id,
				activity: `Capitalized value ${totalValue} via ${capitalization.series} and accounting entry ${accountingEntry.series}.`,
				createdAt: capitalization.submittedAt ?? postingDate,
			},
			{
				assetId: sourceAssetId,
				activity: `Asset consumed in capitalization ${capitalization.series}.`,
				createdAt: capitalization.submittedAt ?? postingDate,
			},
		],
	});
}

async function seedDisposals(
	tx: Prisma.TransactionClient,
	config: DemoConfig,
	ids: MasterIds,
): Promise<void> {
	const saleAssetId = requiredId(
		ids.assetIds,
		"ecity-demo-lora-rig-01",
		"Asset",
	);
	const saleAsset = await tx.asset.findUniqueOrThrow({
		where: { id: saleAssetId },
		select: {
			series: true,
			assetCategoryId: true,
			netPurchaseAmount: true,
			valueAfterDepreciation: true,
			isFullyDepreciated: true,
			disposalDate: true,
		},
	});
	const saleDate =
		saleAsset.disposalDate ?? resolveRelativeDate(config, 164, 17, 0);
	const saleContext = await categoryAccountingContext(
		tx,
		saleAsset.assetCategoryId,
		config.company,
	);
	const saleProceeds = 215000;
	const saleCarryingValue = roundAmount(
		Number(saleAsset.valueAfterDepreciation),
	);
	const saleFixedBalance = roundAmount(Number(saleAsset.netPurchaseAmount));
	const postedDisposal = await tx.assetDisposal.create({
		data: {
			series: `DISP-PTPL-${seriesYear(saleDate)}-00001`,
			assetId: saleAssetId,
			company: config.company,
			disposalDate: saleDate,
			disposalType: "SELL",
			salesAmount: saleProceeds,
			gainLossAmount: roundAmount(saleProceeds - saleCarryingValue),
			fixedAssetAccount: saleContext.fixedAssetAccount,
			accumulatedDepreciationAccount:
				saleContext.accumulatedDepreciationAccount,
			proceedsAccount: DEMO_ASSET_LIFECYCLE_ACCOUNTS.assetSaleProceeds,
			gainLossAccount: DEMO_ASSET_LIFECYCLE_ACCOUNTS.assetDisposalGainLoss,
			costCenter: DEMO_COST_CENTER,
			previousAssetStatus:
				saleCarryingValue < saleFixedBalance
					? "PARTIALLY_DEPRECIATED"
					: "SUBMITTED",
			previousIsFullyDepreciated: saleAsset.isFullyDepreciated,
			status: "POSTED",
			notes:
				"Demo rig sold after pilot conversion; proceeds and disposal gain or loss are posted to the Asset subledger.",
			createdAt: saleDate,
			updatedAt: saleDate,
		},
	});
	const saleEntry = await createAccountingEntry(tx, {
		series: `AAE-PTPL-${seriesYear(saleDate)}-00002`,
		company: config.company,
		assetId: saleAssetId,
		sourceType: "DISPOSAL",
		sourceId: postedDisposal.id,
		postingDate: saleDate,
		remarks: `Asset ${saleAsset.series} sold via ${postedDisposal.series}`,
		lines: buildDisposalAccountingLines({
			fixedAssetAccount: saleContext.fixedAssetAccount,
			accumulatedDepreciationAccount:
				saleContext.accumulatedDepreciationAccount ??
				DEMO_DEPRECIATION_ACCOUNTS.accumulatedDepreciation,
			proceedsAccount: DEMO_ASSET_LIFECYCLE_ACCOUNTS.assetSaleProceeds,
			gainLossAccount: DEMO_ASSET_LIFECYCLE_ACCOUNTS.assetDisposalGainLoss,
			fixedAssetBalance: saleFixedBalance,
			carryingValue: saleCarryingValue,
			proceeds: saleProceeds,
			costCenter: DEMO_COST_CENTER,
		}),
	});
	await tx.assetDisposal.update({
		where: { id: postedDisposal.id },
		data: { accountingEntryId: saleEntry.id },
	});

	const restoredAssetId = requiredId(
		ids.assetIds,
		"whitefield-reference-multimeter-01",
		"Asset",
	);
	const restoredAsset = await tx.asset.findUniqueOrThrow({
		where: { id: restoredAssetId },
		select: {
			series: true,
			status: true,
			assetCategoryId: true,
			netPurchaseAmount: true,
			valueAfterDepreciation: true,
			isFullyDepreciated: true,
		},
	});
	const cancelledDisposalDate = resolveRelativeDate(config, 174, 10, 0);
	const restoredAt = resolveRelativeDate(config, 175, 9, 30);
	const restoredContext = await categoryAccountingContext(
		tx,
		restoredAsset.assetCategoryId,
		config.company,
	);
	const restoredFixedBalance = roundAmount(
		Number(restoredAsset.netPurchaseAmount),
	);
	const restoredCarryingValue = roundAmount(
		Number(restoredAsset.valueAfterDepreciation),
	);
	const cancelledDisposal = await tx.assetDisposal.create({
		data: {
			series: `DISP-PTPL-${seriesYear(cancelledDisposalDate)}-00002`,
			assetId: restoredAssetId,
			company: config.company,
			disposalDate: cancelledDisposalDate,
			disposalType: "SCRAP",
			salesAmount: 0,
			gainLossAmount: -restoredCarryingValue,
			fixedAssetAccount: restoredContext.fixedAssetAccount,
			accumulatedDepreciationAccount:
				restoredContext.accumulatedDepreciationAccount,
			gainLossAccount: DEMO_ASSET_LIFECYCLE_ACCOUNTS.assetDisposalGainLoss,
			costCenter: DEMO_COST_CENTER,
			previousAssetStatus: restoredAsset.status,
			previousIsFullyDepreciated: restoredAsset.isFullyDepreciated,
			status: "CANCELLED",
			notes:
				"Erroneous scrap authorization reversed after the traceable reference bench was physically verified.",
			createdAt: cancelledDisposalDate,
			updatedAt: restoredAt,
		},
	});
	const cancelledEntry = await createAccountingEntry(tx, {
		series: `AAE-PTPL-${seriesYear(cancelledDisposalDate)}-00003`,
		company: config.company,
		assetId: restoredAssetId,
		sourceType: "DISPOSAL",
		sourceId: cancelledDisposal.id,
		postingDate: cancelledDisposalDate,
		remarks: `Reversed scrap disposal ${cancelledDisposal.series} for ${restoredAsset.series}`,
		status: "REVERSED",
		reversedAt: restoredAt,
		lines: buildDisposalAccountingLines({
			fixedAssetAccount: restoredContext.fixedAssetAccount,
			accumulatedDepreciationAccount:
				restoredContext.accumulatedDepreciationAccount ??
				DEMO_DEPRECIATION_ACCOUNTS.accumulatedDepreciation,
			gainLossAccount: DEMO_ASSET_LIFECYCLE_ACCOUNTS.assetDisposalGainLoss,
			fixedAssetBalance: restoredFixedBalance,
			carryingValue: restoredCarryingValue,
			proceeds: 0,
			costCenter: DEMO_COST_CENTER,
		}),
	});
	await tx.assetDisposal.update({
		where: { id: cancelledDisposal.id },
		data: { accountingEntryId: cancelledEntry.id },
	});
	await tx.assetActivity.create({
		data: {
			assetId: restoredAssetId,
			activity: `Disposal ${cancelledDisposal.series} reversed; asset restored to ${restoredAsset.status}.`,
			createdAt: restoredAt,
		},
	});
}

async function seedCwipExamples(
	tx: Prisma.TransactionClient,
	config: DemoConfig,
	ids: MasterIds,
): Promise<void> {
	const bookedAssetId = requiredId(
		ids.assetIds,
		"peenya-cwip-power-monitoring-panel-01",
		"Asset",
	);
	const bookedAsset = await tx.asset.findUniqueOrThrow({
		where: { id: bookedAssetId },
		select: {
			series: true,
			status: true,
			assetCategoryId: true,
			availableForUseDate: true,
			netPurchaseAmount: true,
			cwipAccountingEntryId: true,
		},
	});
	if (
		bookedAsset.status !== "SUBMITTED" ||
		!bookedAsset.availableForUseDate ||
		bookedAsset.cwipAccountingEntryId
	) {
		throw new Error("Booked CWIP demo asset is not in a postable state");
	}
	const bookedContext = await categoryAccountingContext(
		tx,
		bookedAsset.assetCategoryId,
		config.company,
	);
	if (!bookedContext.capitalWorkInProgressAccount) {
		throw new Error("Booked CWIP demo asset has no configured CWIP account");
	}
	const bookedAmount = roundAmount(Number(bookedAsset.netPurchaseAmount));
	const cwipEntry = await createAccountingEntry(tx, {
		series: `AAE-PTPL-${seriesYear(bookedAsset.availableForUseDate)}-00004`,
		company: config.company,
		assetId: bookedAssetId,
		sourceType: "CWIP_CAPITALIZATION",
		sourceId: bookedAssetId,
		postingDate: bookedAsset.availableForUseDate,
		remarks: `CWIP capitalization for ${bookedAsset.series}`,
		lines: [
			{
				account: bookedContext.fixedAssetAccount,
				debitAmount: bookedAmount,
				creditAmount: 0,
				costCenter: DEMO_COST_CENTER,
			},
			{
				account: bookedContext.capitalWorkInProgressAccount,
				debitAmount: 0,
				creditAmount: bookedAmount,
				costCenter: DEMO_COST_CENTER,
			},
		],
	});
	const bookedAt = new Date(
		bookedAsset.availableForUseDate.getTime() + 60 * 60_000,
	);
	await tx.asset.update({
		where: { id: bookedAssetId },
		data: {
			cwipAccountingEntryId: cwipEntry.id,
			cwipBookedAt: bookedAt,
			updatedAt: bookedAt,
		},
	});
	await tx.assetActivity.create({
		data: {
			assetId: bookedAssetId,
			activity: `CWIP transferred to fixed assets through accounting entry ${cwipEntry.series}.`,
			createdAt: bookedAt,
		},
	});

	const qualifiedAssetId = requiredId(
		ids.assetIds,
		"whitefield-cwip-reliability-rig-01",
		"Asset",
	);
	const qualifiedAsset = await tx.asset.findUniqueOrThrow({
		where: { id: qualifiedAssetId },
		select: {
			status: true,
			availableForUseDate: true,
			netPurchaseAmount: true,
			cwipAccountingEntryId: true,
		},
	});
	if (
		qualifiedAsset.status !== "SUBMITTED" ||
		!qualifiedAsset.availableForUseDate ||
		Number(qualifiedAsset.netPurchaseAmount) <= 0 ||
		qualifiedAsset.cwipAccountingEntryId
	) {
		throw new Error("Qualified CWIP demo asset is not queue-discoverable");
	}
}

/**
 * Seeds deterministic lifecycle documents after due depreciation has posted.
 * No queue or external purchase-invoice workflow is invoked by this loader.
 */
export async function seedAssetLifecycleTransactions(
	prisma: PrismaService,
	config: DemoConfig,
	ids: MasterIds,
): Promise<void> {
	await prisma.$transaction(
		async (tx) => {
			await seedMovements(tx, config, ids);
			await seedRepairs(tx, config, ids);
			await seedCapitalizations(tx, config, ids);
			await seedDisposals(tx, config, ids);
			await seedCwipExamples(tx, config, ids);
		},
		{ maxWait: 10_000, timeout: 30_000 },
	);
}
