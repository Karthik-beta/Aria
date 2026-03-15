// biome-ignore-all lint/suspicious/noConfusingVoidType: tRPC no-input procedure declarations intentionally use void in this shared contract surface.
import { Inventory } from "@aria/types";
import type {
	TRPCBuiltRouter,
	TRPCDecorateCreateRouterOptions,
	TRPCMutationProcedure,
	TRPCQueryProcedure,
} from "@trpc/server";
import type { LegacyObservableSubscriptionProcedure } from "@trpc/server/unstable-core-do-not-import";
import type { accountRouter } from "../../../trpc/routers/account.router";

type ItemGroupsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.ItemGroup | { id: string };
};

type ItemsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.Item | { id: string };
};

type InventoryRouterInput = {
	listItems: TRPCQueryProcedure<{
		input: void;
		output: Inventory.Item[];
		meta: object;
	}>;
	listItemGroups: TRPCQueryProcedure<{
		input:
			| {
					search?: string | undefined;
			  }
			| undefined;
		output: Inventory.ItemGroup[];
		meta: object;
	}>;
	listUnitsOfMeasure: TRPCQueryProcedure<{
		input:
			| {
					search?: string | undefined;
			  }
			| undefined;
		output: Inventory.UnitOfMeasure[];
		meta: object;
	}>;
	listBundleItems: TRPCQueryProcedure<{
		input:
			| {
					search?: string | undefined;
			  }
			| undefined;
		output: Inventory.BundleSelectableItem[];
		meta: object;
	}>;
	listProductBundles: TRPCQueryProcedure<{
		input: void;
		output: Inventory.ProductBundle[];
		meta: object;
	}>;
	createProductBundle: TRPCMutationProcedure<{
		input: {
			parentItemId: string;
			description?: string | undefined;
			disabled?: boolean | undefined;
			bundleItems: {
				itemId: string;
				quantity: number;
				description?: string | undefined;
				unitOfMeasurementId?: string | undefined;
			}[];
		};
		output: Inventory.ProductBundle;
		meta: object;
	}>;
	updateProductBundle: TRPCMutationProcedure<{
		input: {
			id: string;
			parentItemId?: string | undefined;
			description?: string | undefined;
			disabled?: boolean | undefined;
			bundleItems?:
				| {
						id?: string | undefined;
						itemId: string;
						quantity: number;
						description?: string | undefined;
						unitOfMeasurementId?: string | undefined;
				  }[]
				| undefined;
		};
		output: Inventory.ProductBundle;
		meta: object;
	}>;
	deleteProductBundle: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	createItem: TRPCMutationProcedure<{
		input: {
			name: string;
			code: string;
			quantity?: number | undefined;
			description?: string | undefined;
			disabled?: boolean | undefined;
			maintainStock?: boolean | undefined;
			allowAlternateItem?: boolean | undefined;
			hasVariants?: boolean | undefined;
			openingStock?: number | undefined;
			valuationRate?: number | undefined;
			standardSellingRate?: number | undefined;
			isZeroRated?: boolean | undefined;
			isExempt?: boolean | undefined;
			isFixedAsset?: boolean | undefined;
			taxCode?: string | undefined;
			shelfLifeInDays?: number | undefined;
			warrantyPeriodInDays?: number | undefined;
			endOfLife?: unknown;
			weightPerUnit?: number | undefined;
			weightUom?: string | undefined;
			allowNegativeStock?: boolean | undefined;
			valuationMethod?: string | undefined;
			defaultMaterialRequestType?: string | undefined;
			hasBatchNo?: boolean | undefined;
			hasSerialNo?: boolean | undefined;
			barcodes?:
				| {
						barcode: string;
						barcodeType?: string | null | undefined;
						uom?: string | null | undefined;
				  }[]
				| undefined;
			reorderSettings?:
				| {
						warehouse: string;
						reorderLevel?: number | undefined;
						reorderQty?: number | undefined;
						materialRequestType?: string | null | undefined;
				  }[]
				| undefined;
			itemGroupId?: string | undefined;
			defaultUnitOfMeasureId?: string | undefined;
		};
		output: Inventory.Item;
		meta: object;
	}>;
	updateItem: TRPCMutationProcedure<{
		input: {
			id: string;
			name?: string | undefined;
			code?: string | undefined;
			quantity?: number | undefined;
			description?: string | undefined;
			disabled?: boolean | undefined;
			maintainStock?: boolean | undefined;
			allowAlternateItem?: boolean | undefined;
			hasVariants?: boolean | undefined;
			openingStock?: number | undefined;
			valuationRate?: number | undefined;
			standardSellingRate?: number | undefined;
			isZeroRated?: boolean | undefined;
			isExempt?: boolean | undefined;
			isFixedAsset?: boolean | undefined;
			taxCode?: string | undefined;
			shelfLifeInDays?: number | undefined;
			warrantyPeriodInDays?: number | undefined;
			endOfLife?: unknown;
			weightPerUnit?: number | undefined;
			weightUom?: string | undefined;
			allowNegativeStock?: boolean | undefined;
			valuationMethod?: string | undefined;
			defaultMaterialRequestType?: string | undefined;
			hasBatchNo?: boolean | undefined;
			hasSerialNo?: boolean | undefined;
			barcodes?:
				| {
						barcode: string;
						id?: string | undefined;
						barcodeType?: string | null | undefined;
						uom?: string | null | undefined;
				  }[]
				| undefined;
			reorderSettings?:
				| {
						warehouse: string;
						id?: string | undefined;
						reorderLevel?: number | undefined;
						reorderQty?: number | undefined;
						materialRequestType?: string | null | undefined;
				  }[]
				| undefined;
			itemGroupId?: string | undefined;
			defaultUnitOfMeasureId?: string | undefined;
		};
		output: Inventory.Item;
		meta: object;
	}>;
	deleteItem: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	deleteItems: TRPCMutationProcedure<{
		input: {
			ids: string[];
		};
		output: {
			success: boolean;
			count: number;
			ids: string[];
			missingIds: string[];
		};
		meta: object;
	}>;
	createItemGroup: TRPCMutationProcedure<{
		input: {
			groupName: string;
			parentId?: string | null | undefined;
			isGroup?: boolean | undefined;
			defaults?:
				| {
						company: string;
						defaultWarehouse?: string | null | undefined;
						defaultPriceList?: string | null | undefined;
				  }[]
				| undefined;
		};
		output: Inventory.ItemGroup;
		meta: object;
	}>;
	updateItemGroup: TRPCMutationProcedure<{
		input: {
			id: string;
			groupName?: string | undefined;
			parentId?: string | null | undefined;
			isGroup?: boolean | undefined;
			defaults?:
				| {
						company: string;
						id?: string | undefined;
						defaultWarehouse?: string | null | undefined;
						defaultPriceList?: string | null | undefined;
				  }[]
				| undefined;
		};
		output: Inventory.ItemGroup;
		meta: object;
	}>;
	deleteItemGroup: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	onItemGroupsChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: ItemGroupsChangedEvent;
		meta: object;
	}>;
	onItemCreated: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: Inventory.Item;
		meta: object;
	}>;
	onItemUpdated: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: Inventory.Item;
		meta: object;
	}>;
	onItemDeleted: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: {
			id: string;
		};
		meta: object;
	}>;
	onItemsChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: ItemsChangedEvent;
		meta: object;
	}>;
};

type InventoryRouterRoot = (typeof accountRouter)["_def"]["_config"]["$types"];
type InventoryRouterRecord =
	TRPCDecorateCreateRouterOptions<InventoryRouterInput>;

export declare const inventoryRouter: TRPCBuiltRouter<
	InventoryRouterRoot,
	InventoryRouterRecord
>;
