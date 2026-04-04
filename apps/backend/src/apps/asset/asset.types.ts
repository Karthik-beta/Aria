import type { Asset } from "@aria/types";
import type { Prisma } from "../../generated/prisma/client";

/**
 * Prisma model type for Asset with all relations included.
 */
export type PrismaAsset = Prisma.AssetGetPayload<{
	include: {
		assetCategory: { select: { id: true; name: true } };
		location: { select: { id: true; name: true } };
		activities: { orderBy: { createdAt: "desc" } };
	};
}>;

/**
 * Prisma model type for Location (with optional parent name).
 */
export type PrismaLocation = Prisma.LocationGetPayload<{
	select: {
		id: true;
		name: true;
		parentLocationId: true;
		parentLocation: { select: { name: true } };
		isGroup: true;
		createdAt: true;
		updatedAt: true;
	};
}>;

/**
 * Prisma model type for AssetCategory (scalar fields only).
 */
export type PrismaAssetCategory = Prisma.AssetCategoryGetPayload<{
	select: {
		id: true;
		name: true;
		depreciationMethod: true;
		totalNumberOfDepreciations: true;
		frequencyOfDepreciation: true;
		nonDepreciableCategory: true;
		enableCwipAccounting: true;
		createdAt: true;
		updatedAt: true;
	};
}>;

/**
 * Maps a Prisma Location record to the Asset.Location domain type.
 */
export function toAssetLocation(loc: PrismaLocation): Asset.Location {
	return {
		id: loc.id,
		name: loc.name,
		parentLocationId: loc.parentLocationId ?? null,
		parentLocationName: loc.parentLocation?.name ?? null,
		isGroup: loc.isGroup,
		createdAt: loc.createdAt,
		updatedAt: loc.updatedAt,
	};
}

export function toAssetCategory(cat: PrismaAssetCategory): Asset.AssetCategory {
	return {
		id: cat.id,
		name: cat.name,
		depreciationMethod:
			(cat.depreciationMethod as Asset.DepreciationMethod | null) ?? null,
		totalNumberOfDepreciations: cat.totalNumberOfDepreciations ?? null,
		frequencyOfDepreciation: cat.frequencyOfDepreciation ?? null,
		nonDepreciableCategory: cat.nonDepreciableCategory,
		enableCwipAccounting: cat.enableCwipAccounting,
		createdAt: cat.createdAt,
		updatedAt: cat.updatedAt,
	};
}

/**
 * Maps a full Prisma Asset record (with relations) to the Asset.AssetItem domain type.
 */
export function toAsset(raw: PrismaAsset): Asset.AssetItem {
	return {
		id: raw.id,
		series: raw.series,
		assetName: raw.assetName,
		itemCode: raw.itemCode ?? null,
		assetCategoryId: raw.assetCategoryId ?? null,
		assetCategoryName: raw.assetCategory?.name ?? null,
		company: raw.company,
		locationId: raw.locationId ?? null,
		locationName: raw.location?.name ?? null,
		custodian: raw.custodian ?? null,
		department: raw.department ?? null,
		purchaseDate: raw.purchaseDate ?? null,
		availableForUseDate: raw.availableForUseDate ?? null,
		disposalDate: raw.disposalDate ?? null,
		netPurchaseAmount: raw.netPurchaseAmount
			? Number(raw.netPurchaseAmount)
			: null,
		assetQuantity: raw.assetQuantity,
		calculateDepreciation: raw.calculateDepreciation,
		openingAccumulatedDepreciation: raw.openingAccumulatedDepreciation
			? Number(raw.openingAccumulatedDepreciation)
			: null,
		openingNumberOfBookedDepreciations:
			raw.openingNumberOfBookedDepreciations ?? null,
		isFullyDepreciated: raw.isFullyDepreciated,
		valueAfterDepreciation: raw.valueAfterDepreciation
			? Number(raw.valueAfterDepreciation)
			: null,
		maintenanceRequired: raw.maintenanceRequired,
		assetOwner: raw.assetOwner as Asset.AssetOwner,
		assetOwnerCompany: raw.assetOwnerCompany ?? null,
		supplier: raw.supplier ?? null,
		customer: raw.customer ?? null,
		policyNumber: raw.policyNumber ?? null,
		insurer: raw.insurer ?? null,
		insuredValue: raw.insuredValue ? Number(raw.insuredValue) : null,
		insuranceStartDate: raw.insuranceStartDate ?? null,
		insuranceEndDate: raw.insuranceEndDate ?? null,
		depreciationMethod:
			(raw.depreciationMethod as Asset.DepreciationMethod | null) ?? null,
		totalNumberOfDepreciations: raw.totalNumberOfDepreciations ?? null,
		frequencyOfDepreciation: raw.frequencyOfDepreciation ?? null,
		purchaseReceipt: raw.purchaseReceipt ?? null,
		purchaseInvoice: raw.purchaseInvoice ?? null,
		status: raw.status as Asset.AssetStatus,
		activities: raw.activities.map((a) => ({
			id: a.id,
			assetId: a.assetId,
			activity: a.activity,
			createdAt: a.createdAt,
		})),
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}

/**
 * Prisma model type for AssetMaintenanceTeam with members relation included.
 */
export type PrismaMaintenanceTeam = Prisma.AssetMaintenanceTeamGetPayload<{
	include: { members: { orderBy: { createdAt: "asc" } } };
}>;

/**
 * Maps a Prisma AssetMaintenanceTeam record to the Asset.AssetMaintenanceTeam domain type.
 */
export function toMaintenanceTeam(
	raw: PrismaMaintenanceTeam,
): Asset.AssetMaintenanceTeam {
	return {
		id: raw.id,
		name: raw.name,
		maintenanceManager: raw.maintenanceManager ?? null,
		maintenanceManagerName: raw.maintenanceManagerName ?? null,
		company: raw.company,
		members: raw.members.map((m) => ({
			id: m.id,
			teamId: m.teamId,
			teamMember: m.teamMember,
			fullName: m.fullName,
			maintenanceRole: m.maintenanceRole,
			createdAt: m.createdAt,
			updatedAt: m.updatedAt,
		})),
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}
