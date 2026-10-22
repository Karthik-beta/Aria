/**
 * Asset Value Adjustment helpers — static query shapes and pure helpers
 * used by the value adjustment preview and persistence flow.
 *
 * @module AssetValueAdjustmentHelpers
 */
import type { Asset } from "@aria/types";
import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import { getOpeningAssetValue, roundCurrency } from "./asset-service.shared";

export const assetAdjustmentInclude = {
	asset: {
		select: {
			id: true,
			series: true,
			assetName: true,
			assetCategory: { select: { name: true } },
		},
	},
	revaluationEntry: {
		include: {
			lines: { orderBy: { createdAt: "asc" as const } },
		},
	},
	depreciationSchedule: {
		include: {
			entries: { orderBy: { sequence: "asc" as const } },
		},
	},
} as const;

export const assetAdjustmentContextSelect = {
	id: true,
	series: true,
	assetName: true,
	company: true,
	status: true,
	purchaseDate: true,
	availableForUseDate: true,
	netPurchaseAmount: true,
	openingAccumulatedDepreciation: true,
	openingNumberOfBookedDepreciations: true,
	isFullyDepreciated: true,
	valueAfterDepreciation: true,
	calculateDepreciation: true,
	depreciationMethod: true,
	totalNumberOfDepreciations: true,
	frequencyOfDepreciation: true,
	assetCategory: {
		select: {
			id: true,
			name: true,
			depreciationMethod: true,
			totalNumberOfDepreciations: true,
			frequencyOfDepreciation: true,
			dailyProrataBased: true,
			shiftBased: true,
			rateOfDepreciation: true,
			expectedValueAfterUsefulLife: true,
			nonDepreciableCategory: true,
		},
	},
	depreciationSchedules: {
		where: { status: "ACTIVE" as const },
		orderBy: { revisionNumber: "desc" as const },
		take: 1,
		select: { id: true, revisionNumber: true, assetFinanceBookId: true },
	},
	financeBooks: {
		orderBy: { createdAt: "asc" as const },
		take: 1,
		select: { id: true },
	},
} as const;

export function resolveCurrentAssetValue(asset: {
	valueAfterDepreciation: Prisma.Decimal | null;
	netPurchaseAmount: Prisma.Decimal | null;
	openingAccumulatedDepreciation: Prisma.Decimal | null;
}): number {
	const explicitValue = Number(asset.valueAfterDepreciation ?? 0);
	if (explicitValue > 0) {
		return roundCurrency(explicitValue);
	}

	return getOpeningAssetValue(
		asset.netPurchaseAmount ? Number(asset.netPurchaseAmount) : 0,
		asset.openingAccumulatedDepreciation
			? Number(asset.openingAccumulatedDepreciation)
			: 0,
	);
}

export function resolveDepreciationConfig(asset: {
	calculateDepreciation: boolean;
	depreciationMethod: Asset.DepreciationMethod | null;
	totalNumberOfDepreciations: number | null;
	frequencyOfDepreciation: number | null;
	assetCategory?: {
		depreciationMethod: Asset.DepreciationMethod | null;
		totalNumberOfDepreciations: number | null;
		frequencyOfDepreciation: number | null;
		dailyProrataBased: boolean | null;
		shiftBased: boolean | null;
		rateOfDepreciation: number | null;
		expectedValueAfterUsefulLife: Prisma.Decimal | null;
		nonDepreciableCategory?: boolean;
	} | null;
}) {
	if (
		!asset.calculateDepreciation ||
		asset.assetCategory?.nonDepreciableCategory
	) {
		return {
			depreciationMethod: null,
			totalNumberOfDepreciations: null,
			frequencyOfDepreciation: null,
			dailyProrataBased: null,
			shiftBased: null,
			rateOfDepreciation: null,
			expectedValueAfterUsefulLife: null,
		};
	}

	return {
		depreciationMethod:
			asset.depreciationMethod ??
			asset.assetCategory?.depreciationMethod ??
			null,
		totalNumberOfDepreciations:
			asset.totalNumberOfDepreciations ??
			asset.assetCategory?.totalNumberOfDepreciations ??
			null,
		frequencyOfDepreciation:
			asset.frequencyOfDepreciation ??
			asset.assetCategory?.frequencyOfDepreciation ??
			null,
		dailyProrataBased: asset.assetCategory?.dailyProrataBased ?? null,
		shiftBased: asset.assetCategory?.shiftBased ?? null,
		rateOfDepreciation: asset.assetCategory?.rateOfDepreciation ?? null,
		expectedValueAfterUsefulLife: asset.assetCategory
			?.expectedValueAfterUsefulLife
			? Number(asset.assetCategory.expectedValueAfterUsefulLife)
			: null,
	};
}

export function assertAssetValueAdjustmentPreviewIsValid(
	preview: Asset.AssetValueAdjustmentPreview,
): void {
	if (preview.validationMessages.length > 0) {
		throw new BadRequestException(preview.validationMessages[0]);
	}
}
