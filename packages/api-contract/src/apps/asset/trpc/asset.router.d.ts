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

type AssetValueAdjustmentsChangedEvent = {
	type: "created" | "updated" | "submitted" | "cancelled" | "deleted";
	data: Asset.AssetValueAdjustmentItem | { id: string };
};

type AssetRouterInput = {
	// ── Finance Books ────────────────────────────────────────────────────────
	listFinanceBooks: TRPCQueryProcedure<{
		input: { skip?: number; take?: number; search?: string } | undefined;
		output: Asset.FinanceBookListResult;
		meta: object;
	}>;
	createFinanceBook: TRPCMutationProcedure<{
		input: { name: string };
		output: Asset.FinanceBook;
		meta: object;
	}>;
	updateFinanceBook: TRPCMutationProcedure<{
		input: { id: string; name: string };
		output: Asset.FinanceBook;
		meta: object;
	}>;
	deleteFinanceBook: TRPCMutationProcedure<{
		input: { id: string };
		output: { success: true; id: string };
		meta: object;
	}>;

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
	getAssetDepreciationSchedules: TRPCQueryProcedure<{
		input: { assetId: string };
		output: Asset.AssetDepreciationScheduleListResult;
		meta: object;
	}>;
	getAssetByBarcode: TRPCQueryProcedure<{
		input: { barcode: string };
		output: Asset.AssetItem;
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
	submitAsset: TRPCMutationProcedure<{
		input: { id: string };
		output: Asset.AssetItem;
		meta: object;
	}>;
	cancelAsset: TRPCMutationProcedure<{
		input: { id: string };
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
	listAssetValueAdjustments: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					status?: Asset.AssetValueAdjustmentStatus | undefined;
					assetId?: string | undefined;
					company?: string | undefined;
					direction?: Asset.AssetValueAdjustmentDirection | undefined;
			  }
			| undefined;
		output: Asset.AssetValueAdjustmentListResult;
		meta: object;
	}>;
	listAssetDepreciationLedger: TRPCQueryProcedure<{
		input: {
			fromDate: unknown;
			toDate: unknown;
			company?: string | undefined;
			asset?: string | undefined;
			assetCategory?: string | undefined;
			costCenter?: string | undefined;
		};
		output: Asset.AssetDepreciationLedgerResult;
		meta: object;
	}>;
	listAssetActivityReport: TRPCQueryProcedure<{
		input: {
			fromDate: unknown;
			toDate: unknown;
			company?: string | undefined;
			asset?: string | undefined;
			assetCategory?: string | undefined;
			activity?: string | undefined;
		};
		output: Asset.AssetActivityReportResult;
		meta: object;
	}>;
	listAssetDepreciationsAndBalances: TRPCQueryProcedure<{
		input: {
			fromDate: unknown;
			toDate: unknown;
			company?: string | undefined;
			groupBy: Asset.AssetDepreciationsAndBalancesGroupBy;
			asset?: string | undefined;
			assetCategory?: string | undefined;
		};
		output: Asset.AssetDepreciationsAndBalancesResult;
		meta: object;
	}>;
	getAssetValueAdjustmentById: TRPCQueryProcedure<{
		input: { id: string };
		output: Asset.AssetValueAdjustmentItem | null;
		meta: object;
	}>;
	previewAssetValueAdjustment: TRPCQueryProcedure<{
		input: {
			assetId: string;
			financeBookId?: string | null | undefined;
			adjustmentDate: unknown;
			newAssetValue: number;
		};
		output: Asset.AssetValueAdjustmentPreview;
		meta: object;
	}>;
	createAssetValueAdjustment: TRPCMutationProcedure<{
		input: {
			assetId: string;
			financeBookId?: string | null | undefined;
			adjustmentDate: unknown;
			newAssetValue: number;
			differenceAccount: string;
			costCenter?: string | null | undefined;
			notes?: string | null | undefined;
		};
		output: Asset.AssetValueAdjustmentItem;
		meta: object;
	}>;
	updateAssetValueAdjustment: TRPCMutationProcedure<{
		input: {
			id: string;
			assetId?: string | undefined;
			financeBookId?: string | null | undefined;
			adjustmentDate?: unknown;
			newAssetValue?: number | undefined;
			differenceAccount?: string | undefined;
			costCenter?: string | null | undefined;
			notes?: string | null | undefined;
		};
		output: Asset.AssetValueAdjustmentItem;
		meta: object;
	}>;
	submitAssetValueAdjustment: TRPCMutationProcedure<{
		input: { id: string };
		output: Asset.AssetValueAdjustmentItem;
		meta: object;
	}>;
	cancelAssetValueAdjustment: TRPCMutationProcedure<{
		input: { id: string };
		output: Asset.AssetValueAdjustmentItem;
		meta: object;
	}>;
	deleteAssetValueAdjustment: TRPCMutationProcedure<{
		input: { id: string };
		output: { success: boolean; id: string };
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

	// ── Dashboard ────────────────────────────────────────────────────────────
	getDashboardData: TRPCQueryProcedure<{
		input: void;
		output: Asset.AssetDashboardData;
		meta: object;
	}>;
	getDashboardOverviewData: TRPCQueryProcedure<{
		input: void;
		output: Asset.AssetDashboardOverviewData;
		meta: object;
	}>;
	getDashboardTopChartsData: TRPCQueryProcedure<{
		input: void;
		output: Asset.AssetDashboardTopChartsData;
		meta: object;
	}>;
	getDashboardBottomChartsData: TRPCQueryProcedure<{
		input: void;
		output: Asset.AssetDashboardBottomChartsData;
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
	onAssetValueAdjustmentsChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: AssetValueAdjustmentsChangedEvent;
		meta: object;
	}>;

	// ── Asset Maintenance Team CRUD ──────────────────────────────────────────
	listMaintenanceTeams: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					company?: string | undefined;
			  }
			| undefined;
		output: Asset.AssetMaintenanceTeamListResult;
		meta: object;
	}>;
	getMaintenanceTeamById: TRPCQueryProcedure<{
		input: { id: string };
		output: Asset.AssetMaintenanceTeam | null;
		meta: object;
	}>;
	createMaintenanceTeam: TRPCMutationProcedure<{
		input: {
			name: string;
			maintenanceManager?: string | null | undefined;
			maintenanceManagerName?: string | null | undefined;
			company: string;
			members: Array<{
				teamMember: string;
				fullName: string;
				maintenanceRole: string;
			}>;
		};
		output: Asset.AssetMaintenanceTeam;
		meta: object;
	}>;
	updateMaintenanceTeam: TRPCMutationProcedure<{
		input: {
			id: string;
			name?: string | undefined;
			maintenanceManager?: string | null | undefined;
			maintenanceManagerName?: string | null | undefined;
			company?: string | undefined;
			members?:
				| Array<{
						id?: string | undefined;
						teamMember: string;
						fullName: string;
						maintenanceRole: string;
				  }>
				| undefined;
		};
		output: Asset.AssetMaintenanceTeam;
		meta: object;
	}>;
	deleteMaintenanceTeam: TRPCMutationProcedure<{
		input: { id: string };
		output: { success: boolean; id: string };
		meta: object;
	}>;
	deleteManyMaintenanceTeams: TRPCMutationProcedure<{
		input: { ids: string[] };
		output: { success: boolean; count: number; ids: string[] };
		meta: object;
	}>;
	onMaintenanceTeamsChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: {
			type: "created" | "updated" | "deleted";
			data: Asset.AssetMaintenanceTeam | { id: string };
		};
		meta: object;
	}>;

	// ── Asset Maintenance CRUD ───────────────────────────────────────────────
	listAssetMaintenances: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					company?: string | undefined;
					maintenanceTeamId?: string | undefined;
					status?: Asset.AssetMaintenanceStatus | undefined;
			  }
			| undefined;
		output: Asset.AssetMaintenanceListResult;
		meta: object;
	}>;
	getAssetMaintenanceById: TRPCQueryProcedure<{
		input: { id: string };
		output: Asset.AssetMaintenanceRecord | null;
		meta: object;
	}>;
	getAssetMaintenanceByAssetId: TRPCQueryProcedure<{
		input: { assetId: string };
		output: Asset.AssetMaintenanceRecord | null;
		meta: object;
	}>;
	getAssetMaintenanceLogs: TRPCQueryProcedure<{
		input: { maintenanceId: string };
		output: Asset.AssetMaintenanceLogItem[];
		meta: object;
	}>;
	listAssetMaintenanceLogs: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					maintenanceId?: string | undefined;
					status?: Asset.AssetMaintenanceLogStatus | undefined;
					search?: string | undefined;
			  }
			| undefined;
		output: Asset.AssetMaintenanceLogListResult;
		meta: object;
	}>;
	cancelAssetMaintenanceLog: TRPCMutationProcedure<{
		input: { logId: string };
		output: Asset.AssetMaintenanceLogItem;
		meta: object;
	}>;
	createAssetMaintenance: TRPCMutationProcedure<{
		input: {
			assetId: string;
			company: string;
			maintenanceTeamId: string;
			maintenanceManager?: string | null | undefined;
			maintenanceManagerName?: string | null | undefined;
			tasks: Array<{
				maintenanceTask: string;
				maintenanceType?: Asset.AssetMaintenanceTaskType | null | undefined;
				maintenanceStatus?: Asset.AssetMaintenanceStatus | undefined;
				startDate: unknown;
				periodicity: Asset.AssetMaintenancePeriodicity;
				endDate?: unknown;
				certificateRequired?: boolean | undefined;
				assignTo?: string | null | undefined;
				assignToName?: string | null | undefined;
				nextDueDate?: unknown;
				lastCompletionDate?: unknown;
				description?: string | null | undefined;
			}>;
		};
		output: Asset.AssetMaintenanceRecord;
		meta: object;
	}>;
	updateAssetMaintenance: TRPCMutationProcedure<{
		input: {
			id: string;
			company?: string | undefined;
			maintenanceTeamId?: string | undefined;
			maintenanceManager?: string | null | undefined;
			maintenanceManagerName?: string | null | undefined;
			tasks?:
				| Array<{
						id?: string | undefined;
						maintenanceTask: string;
						maintenanceType?: Asset.AssetMaintenanceTaskType | null | undefined;
						maintenanceStatus?: Asset.AssetMaintenanceStatus | undefined;
						startDate: unknown;
						periodicity: Asset.AssetMaintenancePeriodicity;
						endDate?: unknown;
						certificateRequired?: boolean | undefined;
						assignTo?: string | null | undefined;
						assignToName?: string | null | undefined;
						nextDueDate?: unknown;
						lastCompletionDate?: unknown;
						description?: string | null | undefined;
				  }>
				| undefined;
		};
		output: Asset.AssetMaintenanceRecord;
		meta: object;
	}>;
	deleteAssetMaintenance: TRPCMutationProcedure<{
		input: { id: string };
		output: { success: boolean; id: string };
		meta: object;
	}>;
	deleteManyAssetMaintenances: TRPCMutationProcedure<{
		input: { ids: string[] };
		output: { success: boolean; count: number; ids: string[] };
		meta: object;
	}>;
	completeAssetMaintenanceLog: TRPCMutationProcedure<{
		input: {
			logId: string;
			completionDate: unknown;
			actionsPerformed?: string | null | undefined;
			hasCertificate?: boolean | undefined;
			certificateAttachment?: string | null | undefined;
		};
		output: Asset.AssetMaintenanceLogItem;
		meta: object;
	}>;
	onAssetMaintenancesChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: {
			type: "created" | "updated" | "deleted" | "log_completed";
			data: Asset.AssetMaintenanceRecord | { id: string };
		};
		meta: object;
	}>;
	exportAssetDepreciationsAndBalancesExcel: TRPCMutationProcedure<{
		input: unknown;
		output: unknown;
		meta: object;
	}>;
	exportAssetDepreciationLedgerExcel: TRPCMutationProcedure<{
		input: unknown;
		output: unknown;
		meta: object;
	}>;
	exportAssetActivityExcel: TRPCMutationProcedure<{
		input: unknown;
		output: unknown;
		meta: object;
	}>;
	listFixedAssetRegisterReport: TRPCQueryProcedure<{
		input: {
			fromDate: unknown;
			toDate: unknown;
			groupBy: "ASSET_CATEGORY" | "LOCATION";
			company?: string | undefined;
			assetCategory?: string | undefined;
			location?: string | undefined;
		};
		output: Asset.FixedAssetRegisterReportResult;
		meta: object;
	}>;
	exportFixedAssetRegisterExcel: TRPCMutationProcedure<{
		input: {
			fromDate: unknown;
			toDate: unknown;
			groupBy: "ASSET_CATEGORY" | "LOCATION";
			company?: string | undefined;
			assetCategory?: string | undefined;
			location?: string | undefined;
		};
		output: string;
		meta: object;
	}>;

	// ── Asset Disposal ───────────────────────────────────────────────
	scrapAsset: TRPCMutationProcedure<{
		input: {
			assetId: string;
			disposalDate: unknown;
			notes?: string | null | undefined;
			userId?: string | null | undefined;
		};
		output: Asset.AssetDisposal;
		meta: object;
	}>;
	sellAsset: TRPCMutationProcedure<{
		input: {
			assetId: string;
			disposalDate: unknown;
			salesAmount: number;
			notes?: string | null | undefined;
			userId?: string | null | undefined;
		};
		output: Asset.AssetDisposal;
		meta: object;
	}>;
	restoreAsset: TRPCMutationProcedure<{
		input: { assetId: string };
		output: Asset.AssetItem;
		meta: object;
	}>;
	getAssetDisposalById: TRPCQueryProcedure<{
		input: { id: string };
		output: Asset.AssetDisposal | null;
		meta: object;
	}>;
	listAssetDisposals: TRPCQueryProcedure<{
		input: unknown;
		output: Asset.AssetDisposalListResult;
		meta: object;
	}>;

	// ── Asset Movement ───────────────────────────────────────────────
	createAssetMovement: TRPCMutationProcedure<{
		input: {
			company: string;
			transactionDate: unknown;
			purpose: Asset.AssetMovementPurpose;
			notes?: string | null | undefined;
			items: {
				assetId: string;
				sourceLocationId?: string | null | undefined;
				targetLocationId?: string | null | undefined;
				fromEmployee?: string | null | undefined;
				toEmployee?: string | null | undefined;
			}[];
		};
		output: Asset.AssetMovement;
		meta: object;
	}>;
	submitAssetMovement: TRPCMutationProcedure<{
		input: { id: string };
		output: Asset.AssetMovement;
		meta: object;
	}>;
	cancelAssetMovement: TRPCMutationProcedure<{
		input: { id: string };
		output: Asset.AssetMovement;
		meta: object;
	}>;
	getAssetMovementById: TRPCQueryProcedure<{
		input: { id: string };
		output: Asset.AssetMovement | null;
		meta: object;
	}>;
	listAssetMovements: TRPCQueryProcedure<{
		input: unknown;
		output: Asset.AssetMovementListResult;
		meta: object;
	}>;

	// ── Asset Repair ─────────────────────────────────────────────────
	createAssetRepair: TRPCMutationProcedure<{
		input: {
			assetId: string;
			company: string;
			failureDate: unknown;
			completionDate?: unknown;
			capitalizeRepairCost?: boolean | undefined;
			increaseInAssetLife?: number | undefined;
			description?: string | null | undefined;
			consumedItems?:
				| {
						itemCode: string;
						quantity?: number | undefined;
						valuationRate?: number | undefined;
						assetId?: string | null | undefined;
						warehouse?: string | null | undefined;
				  }[]
				| undefined;
			purchaseInvoices?:
				| {
						purchaseInvoice: string;
						amount: number;
						expenseAccount?: string | null | undefined;
				  }[]
				| undefined;
		};
		output: Asset.AssetRepair;
		meta: object;
	}>;
	submitAssetRepair: TRPCMutationProcedure<{
		input: { id: string };
		output: Asset.AssetRepair;
		meta: object;
	}>;
	cancelAssetRepair: TRPCMutationProcedure<{
		input: { id: string };
		output: Asset.AssetRepair;
		meta: object;
	}>;
	getAssetRepairById: TRPCQueryProcedure<{
		input: { id: string };
		output: Asset.AssetRepair | null;
		meta: object;
	}>;
	listAssetRepairs: TRPCQueryProcedure<{
		input: unknown;
		output: Asset.AssetRepairListResult;
		meta: object;
	}>;

	// ── Asset Capitalization ─────────────────────────────────────────
	createAssetCapitalization: TRPCMutationProcedure<{
		input: {
			company: string;
			postingDate: unknown;
			targetType: Asset.AssetCapitalizationTargetType;
			targetAssetId?: string | null | undefined;
			targetAssetName?: string | null | undefined;
			targetAssetCategory?: string | null | undefined;
			notes?: string | null | undefined;
			stockItems?:
				| {
						itemCode: string;
						stockQty?: number | undefined;
						valuationRate?: number | undefined;
						warehouse?: string | null | undefined;
				  }[]
				| undefined;
			assetItems?:
				| {
						assetId: string;
						assetValue: number;
				  }[]
				| undefined;
			serviceItems?:
				| {
						expenseAccount: string;
						amount: number;
						itemCode?: string | null | undefined;
				  }[]
				| undefined;
		};
		output: Asset.AssetCapitalization;
		meta: object;
	}>;
	submitAssetCapitalization: TRPCMutationProcedure<{
		input: { id: string };
		output: Asset.AssetCapitalization;
		meta: object;
	}>;
	cancelAssetCapitalization: TRPCMutationProcedure<{
		input: { id: string };
		output: Asset.AssetCapitalization;
		meta: object;
	}>;
	getAssetCapitalizationById: TRPCQueryProcedure<{
		input: { id: string };
		output: Asset.AssetCapitalization | null;
		meta: object;
	}>;
	listAssetCapitalizations: TRPCQueryProcedure<{
		input: unknown;
		output: Asset.AssetCapitalizationListResult;
		meta: object;
	}>;
	listAssetCapitalizations: TRPCQueryProcedure<{
		input: unknown;
		output: Asset.AssetCapitalizationListResult;
		meta: object;
	}>;
};

type AssetRouterRoot = (typeof accountRouter)["_def"]["_config"]["$types"];
type AssetRouterRecord = TRPCDecorateCreateRouterOptions<AssetRouterInput>;

export declare const assetRouter: TRPCBuiltRouter<
	AssetRouterRoot,
	AssetRouterRecord
>;
