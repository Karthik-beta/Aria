// biome-ignore-all lint/suspicious/noConfusingVoidType: tRPC no-input procedure declarations intentionally use void in this shared contract surface.
import { Asset } from "@aria/types";
import type {
	TRPCBuiltRouter,
	TRPCDecorateCreateRouterOptions,
	TRPCMutationProcedure,
	TRPCQueryProcedure,
} from "@trpc/server";
import type { LegacyObservableSubscriptionProcedure } from "@trpc/server/unstable-core-do-not-import";
import type { accountRouter } from "../../../trpc/routers/account.router";

type AssetsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Asset.AssetItem | { id: string };
};

type LocationsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Asset.Location | { id: string };
};

type AssetCategoriesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Asset.AssetCategory | { id: string };
};

type AssetRouterInput = {
	// ── Asset CRUD ──────────────────────────────────────────────────────────
	listAssets: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					status?: Asset.AssetStatus | undefined;
					assetCategoryId?: string | undefined;
					locationId?: string | undefined;
					company?: string | undefined;
			  }
			| undefined;
		output: Asset.AssetListResult;
		meta: object;
	}>;
	getAssetById: TRPCQueryProcedure<{
		input: { id: string };
		output: Asset.AssetItem | null;
		meta: object;
	}>;
	createAsset: TRPCMutationProcedure<{
		input: {
			assetName: string;
			itemCode?: string | null | undefined;
			assetCategoryId?: string | null | undefined;
			company: string;
			locationId?: string | null | undefined;
			custodian?: string | null | undefined;
			department?: string | null | undefined;
			purchaseDate?: unknown;
			availableForUseDate?: unknown;
			netPurchaseAmount?: number | null | undefined;
			assetQuantity?: number | undefined;
			calculateDepreciation?: boolean | undefined;
			openingAccumulatedDepreciation?: number | null | undefined;
			openingNumberOfBookedDepreciations?: number | null | undefined;
			isFullyDepreciated?: boolean | undefined;
			maintenanceRequired?: boolean | undefined;
			assetOwner?: Asset.AssetOwner | undefined;
			assetOwnerCompany?: string | null | undefined;
			supplier?: string | null | undefined;
			customer?: string | null | undefined;
			policyNumber?: string | null | undefined;
			insurer?: string | null | undefined;
			insuredValue?: number | null | undefined;
			insuranceStartDate?: unknown;
			insuranceEndDate?: unknown;
			depreciationMethod?: Asset.DepreciationMethod | null | undefined;
			totalNumberOfDepreciations?: number | null | undefined;
			frequencyOfDepreciation?: number | null | undefined;
			purchaseReceipt?: string | null | undefined;
			purchaseInvoice?: string | null | undefined;
			status?: Asset.AssetStatus | undefined;
		};
		output: Asset.AssetItem;
		meta: object;
	}>;
	updateAsset: TRPCMutationProcedure<{
		input: {
			id: string;
			assetName?: string | undefined;
			itemCode?: string | null | undefined;
			assetCategoryId?: string | null | undefined;
			company?: string | undefined;
			locationId?: string | null | undefined;
			custodian?: string | null | undefined;
			department?: string | null | undefined;
			purchaseDate?: unknown;
			availableForUseDate?: unknown;
			disposalDate?: unknown;
			netPurchaseAmount?: number | null | undefined;
			assetQuantity?: number | undefined;
			calculateDepreciation?: boolean | undefined;
			openingAccumulatedDepreciation?: number | null | undefined;
			openingNumberOfBookedDepreciations?: number | null | undefined;
			isFullyDepreciated?: boolean | undefined;
			valueAfterDepreciation?: number | null | undefined;
			maintenanceRequired?: boolean | undefined;
			assetOwner?: Asset.AssetOwner | undefined;
			assetOwnerCompany?: string | null | undefined;
			supplier?: string | null | undefined;
			customer?: string | null | undefined;
			policyNumber?: string | null | undefined;
			insurer?: string | null | undefined;
			insuredValue?: number | null | undefined;
			insuranceStartDate?: unknown;
			insuranceEndDate?: unknown;
			depreciationMethod?: Asset.DepreciationMethod | null | undefined;
			totalNumberOfDepreciations?: number | null | undefined;
			frequencyOfDepreciation?: number | null | undefined;
			purchaseReceipt?: string | null | undefined;
			purchaseInvoice?: string | null | undefined;
			status?: Asset.AssetStatus | undefined;
		};
		output: Asset.AssetItem;
		meta: object;
	}>;
	deleteAsset: TRPCMutationProcedure<{
		input: { id: string };
		output: { success: boolean; id: string };
		meta: object;
	}>;
	deleteManyAssets: TRPCMutationProcedure<{
		input: { ids: string[] };
		output: { success: boolean; count: number; ids: string[] };
		meta: object;
	}>;

	// ── Location CRUD ────────────────────────────────────────────────────────
	listLocations: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					isGroup?: boolean | undefined;
			  }
			| undefined;
		output: Asset.LocationListResult;
		meta: object;
	}>;
	getLocationById: TRPCQueryProcedure<{
		input: { id: string };
		output: Asset.Location | null;
		meta: object;
	}>;
	createLocation: TRPCMutationProcedure<{
		input: {
			name: string;
			parentLocationId?: string | null | undefined;
			isGroup?: boolean | undefined;
		};
		output: Asset.Location;
		meta: object;
	}>;
	updateLocation: TRPCMutationProcedure<{
		input: {
			id: string;
			name?: string | undefined;
			parentLocationId?: string | null | undefined;
			isGroup?: boolean | undefined;
		};
		output: Asset.Location;
		meta: object;
	}>;
	deleteLocation: TRPCMutationProcedure<{
		input: { id: string };
		output: { success: boolean; id: string };
		meta: object;
	}>;

	// ── Asset Category CRUD ──────────────────────────────────────────────────
	listAssetCategories: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
			  }
			| undefined;
		output: Asset.AssetCategoryListResult;
		meta: object;
	}>;
	getAssetCategoryById: TRPCQueryProcedure<{
		input: { id: string };
		output: Asset.AssetCategory | null;
		meta: object;
	}>;
	createAssetCategory: TRPCMutationProcedure<{
		input: {
			name: string;
			depreciationMethod?: Asset.DepreciationMethod | null | undefined;
			totalNumberOfDepreciations?: number | null | undefined;
			frequencyOfDepreciation?: number | null | undefined;
			nonDepreciableCategory?: boolean | undefined;
			enableCwipAccounting?: boolean | undefined;
		};
		output: Asset.AssetCategory;
		meta: object;
	}>;
	updateAssetCategory: TRPCMutationProcedure<{
		input: {
			id: string;
			name?: string | undefined;
			depreciationMethod?: Asset.DepreciationMethod | null | undefined;
			totalNumberOfDepreciations?: number | null | undefined;
			frequencyOfDepreciation?: number | null | undefined;
			nonDepreciableCategory?: boolean | undefined;
			enableCwipAccounting?: boolean | undefined;
		};
		output: Asset.AssetCategory;
		meta: object;
	}>;
	deleteAssetCategory: TRPCMutationProcedure<{
		input: { id: string };
		output: { success: boolean; id: string };
		meta: object;
	}>;

	// ── Subscriptions ────────────────────────────────────────────────────────
	onAssetsChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: AssetsChangedEvent;
		meta: object;
	}>;
	onLocationsChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: LocationsChangedEvent;
		meta: object;
	}>;
	onAssetCategoriesChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: AssetCategoriesChangedEvent;
		meta: object;
	}>;
};

type AssetRouterRoot = (typeof accountRouter)["_def"]["_config"]["$types"];
type AssetRouterRecord = TRPCDecorateCreateRouterOptions<AssetRouterInput>;

export declare const assetRouter: TRPCBuiltRouter<
	AssetRouterRoot,
	AssetRouterRecord
>;
