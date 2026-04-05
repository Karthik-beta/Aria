import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
	ASSET_CATEGORIES,
	ASSET_LOCATIONS,
	ASSET_MAINTENANCE_TEAMS,
	ASSET_REGISTER,
	type AssetCategoryDef,
	type AssetLocationDef,
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
	prisma: PrismaClient,
	config: DemoConfig,
	ids: MasterIds,
): Promise<void> {
	const categoryDefaults = getCategoryDefaultsByName();
	const assetSeriesCounters = new Map<number, number>();

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
				nonDepreciableCategory: category.nonDepreciableCategory ?? false,
				enableCwipAccounting: category.enableCwipAccounting ?? false,
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

		const year = purchaseDate.getFullYear();
		const assetSeriesCounter = (assetSeriesCounters.get(year) ?? 0) + 1;
		assetSeriesCounters.set(year, assetSeriesCounter);

		const assetSeries = `AST-${year}-${String(assetSeriesCounter).padStart(5, "0")}`;
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
				depreciationMethod:
					assetDef.depreciationMethod ?? category.depreciationMethod,
				totalNumberOfDepreciations:
					assetDef.totalNumberOfDepreciations ??
					category.totalNumberOfDepreciations,
				frequencyOfDepreciation:
					assetDef.frequencyOfDepreciation ?? category.frequencyOfDepreciation,
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
	}
}
