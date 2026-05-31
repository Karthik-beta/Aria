/**
 * Inventory service — thin façade that delegates to domain sub-services.
 *
 * This file is the single entry-point consumed by the tRPC router, the
 * startup service, and the NestJS module. All business logic lives in the
 * sub-service files under `./services/`.
 *
 * @module InventoryService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock | ERPNext Stock Module}
 */
import type { Inventory } from "@aria/types";
import { Injectable } from "@nestjs/common";
import type { z } from "zod";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import { BatchSubService } from "./services/batch.service";
import { DashboardSubService } from "./services/dashboard.service";
import { DeliverySubService } from "./services/delivery.service";
import { InstallationNoteSubService } from "./services/installation-note.service";
import { ItemCatalogSubService } from "./services/item-catalog.service";
import { PurchaseReceiptSubService } from "./services/purchase-receipt.service";
import { QualityInspectionSubService } from "./services/quality-inspection.service";
import { ReportSubService } from "./services/report.service";
import { SerialNoSubService } from "./services/serial-no.service";
import { SettingsSubService } from "./services/settings.service";
import { StockTransactionSubService } from "./services/stock-transaction.service";
import { UomSubService } from "./services/uom.service";
import { WarehouseSubService } from "./services/warehouse.service";
import type { UomSeedEntry } from "./uom-seed";

@Injectable()
export class InventoryService {
	private readonly warehouse: WarehouseSubService;
	private readonly batch: BatchSubService;
	private readonly dashboard: DashboardSubService;
	private readonly serialNo: SerialNoSubService;
	private readonly installationNote: InstallationNoteSubService;
	private readonly settings: SettingsSubService;
	private readonly uom: UomSubService;
	private readonly items: ItemCatalogSubService;
	private readonly stockTx: StockTransactionSubService;
	private readonly delivery: DeliverySubService;
	private readonly purchaseReceipt: PurchaseReceiptSubService;
	private readonly qi: QualityInspectionSubService;
	private readonly reports: ReportSubService;

	constructor(readonly prisma: PrismaService) {
		this.warehouse = new WarehouseSubService(prisma);
		this.batch = new BatchSubService(prisma);
		this.dashboard = new DashboardSubService(prisma);
		this.serialNo = new SerialNoSubService(prisma);
		this.installationNote = new InstallationNoteSubService(prisma);
		this.settings = new SettingsSubService(prisma);
		this.uom = new UomSubService(prisma);
		this.items = new ItemCatalogSubService(prisma);
		this.stockTx = new StockTransactionSubService(prisma);
		this.delivery = new DeliverySubService(prisma);
		this.purchaseReceipt = new PurchaseReceiptSubService(prisma);
		this.qi = new QualityInspectionSubService(prisma);
		this.reports = new ReportSubService(prisma);
	}

	async findAll(): Promise<Inventory.Item[]> {
		return await this.items.findAll();
	}

	async findPagedItems(
		params?: Inventory.ListItemsInput,
	): Promise<Inventory.ItemCatalogueListResult> {
		return await this.items.findPagedItems(params);
	}

	async findAllItemGroups(search?: string): Promise<Inventory.ItemGroup[]> {
		return await this.items.findAllItemGroups(search);
	}

	async findAllUnitsOfMeasure(
		search?: string,
	): Promise<Inventory.UnitOfMeasure[]> {
		return await this.uom.findAllUnitsOfMeasure(search);
	}

	async findWarehouses(
		params?: Inventory.ListWarehousesInput,
	): Promise<Inventory.WarehouseListResult> {
		return await this.warehouse.findWarehouses(params);
	}

	async findWarehouseById(id: string): Promise<Inventory.Warehouse | null> {
		return await this.warehouse.findWarehouseById(id);
	}

	async findBatches(
		params?: Inventory.ListBatchesInput,
	): Promise<Inventory.BatchListResult> {
		return await this.batch.findBatches(params);
	}

	async findBatchById(id: string): Promise<Inventory.Batch | null> {
		return await this.batch.findBatchById(id);
	}

	async createBatch(
		data: z.infer<typeof Inventory.createBatchSchema>,
	): Promise<Inventory.Batch> {
		return await this.batch.createBatch(data);
	}

	async updateBatch(
		data: z.infer<typeof Inventory.updateBatchSchema>,
	): Promise<Inventory.Batch> {
		return await this.batch.updateBatch(data);
	}

	async deleteBatch(id: string): Promise<{ success: boolean; id: string }> {
		return await this.batch.deleteBatch(id);
	}

	async findSerialNos(
		params?: Inventory.ListSerialNosInput,
	): Promise<Inventory.SerialNoListResult> {
		return await this.serialNo.findSerialNos(params);
	}

	async findSerialNoStatus(
		params?: Inventory.ListSerialNoStatusInput,
	): Promise<Inventory.SerialNoStatusListResult> {
		return await this.serialNo.findSerialNoStatus(params);
	}

	async findSerialNoServiceContractExpiry(
		params?: Inventory.ListSerialNoServiceContractExpiryInput,
	): Promise<Inventory.SerialNoServiceContractExpiryListResult> {
		return await this.serialNo.findSerialNoServiceContractExpiry(params);
	}

	async findSerialNoWarrantyExpiry(
		params?: Inventory.ListSerialNoWarrantyExpiryInput,
	): Promise<Inventory.SerialNoWarrantyExpiryListResult> {
		return await this.serialNo.findSerialNoWarrantyExpiry(params);
	}

	async findSerialNoById(id: string): Promise<Inventory.SerialNo | null> {
		return await this.serialNo.findSerialNoById(id);
	}

	async createSerialNo(
		data: z.infer<typeof Inventory.createSerialNoSchema>,
	): Promise<Inventory.SerialNo> {
		return await this.serialNo.createSerialNo(data);
	}

	async updateSerialNo(
		data: z.infer<typeof Inventory.updateSerialNoSchema>,
	): Promise<Inventory.SerialNo> {
		return await this.serialNo.updateSerialNo(data);
	}

	async deleteSerialNo(id: string): Promise<{ success: boolean; id: string }> {
		return await this.serialNo.deleteSerialNo(id);
	}

	async createWarehouse(
		data: z.infer<typeof Inventory.createWarehouseSchema>,
	): Promise<Inventory.Warehouse> {
		return await this.warehouse.createWarehouse(data);
	}

	async updateWarehouse(
		data: z.infer<typeof Inventory.updateWarehouseSchema>,
	): Promise<Inventory.Warehouse> {
		return await this.warehouse.updateWarehouse(data);
	}

	async deleteWarehouse(id: string): Promise<{ success: boolean; id: string }> {
		return await this.warehouse.deleteWarehouse(id);
	}

	async findItemVariantSettings(): Promise<Inventory.ItemVariantSettings> {
		return await this.settings.findItemVariantSettings();
	}

	async updateItemVariantSettings(
		data: z.infer<typeof Inventory.updateItemVariantSettingsSchema>,
	): Promise<Inventory.ItemVariantSettings> {
		return await this.settings.updateItemVariantSettings(data);
	}

	async findStockSettings(): Promise<Inventory.StockSettings> {
		return await this.settings.findStockSettings();
	}

	async updateStockSettings(
		data: z.infer<typeof Inventory.updateStockSettingsSchema>,
	): Promise<Inventory.StockSettings> {
		return await this.settings.updateStockSettings(data);
	}

	async preloadStandardUnitsOfMeasure(
		seedEntries?: UomSeedEntry[],
	): Promise<{ total: number; inserted: number }> {
		return await this.uom.preloadStandardUnitsOfMeasure(seedEntries);
	}

	async findUnitOfMeasureById(
		id: string,
	): Promise<Inventory.UnitOfMeasure | null> {
		return await this.uom.findUnitOfMeasureById(id);
	}

	async createUnitOfMeasure(
		data: z.infer<typeof Inventory.createUnitOfMeasureSchema>,
	): Promise<Inventory.UnitOfMeasure> {
		return await this.uom.createUnitOfMeasure(data);
	}

	async updateUnitOfMeasure(
		data: z.infer<typeof Inventory.updateUnitOfMeasureSchema>,
	): Promise<Inventory.UnitOfMeasure> {
		return await this.uom.updateUnitOfMeasure(data);
	}

	async deleteUnitOfMeasure(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.uom.deleteUnitOfMeasure(id);
	}

	async findAllBrands(search?: string): Promise<Inventory.Brand[]> {
		return await this.items.findAllBrands(search);
	}

	async findBrandById(id: string): Promise<Inventory.Brand | null> {
		return await this.items.findBrandById(id);
	}

	async createBrand(
		data: z.infer<typeof Inventory.createBrandSchema>,
	): Promise<Inventory.Brand> {
		return await this.items.createBrand(data);
	}

	async updateBrand(
		data: z.infer<typeof Inventory.updateBrandSchema>,
	): Promise<Inventory.Brand> {
		return await this.items.updateBrand(data);
	}

	async deleteBrand(id: string): Promise<{ success: boolean; id: string }> {
		return await this.items.deleteBrand(id);
	}

	async findAllItemAttributes(
		search?: string,
	): Promise<Inventory.ItemAttribute[]> {
		return await this.items.findAllItemAttributes(search);
	}

	async findItemAttributeById(id: string): Promise<Inventory.ItemAttribute> {
		return await this.items.findItemAttributeById(id);
	}

	async createItemAttribute(
		data: z.infer<typeof Inventory.createItemAttributeSchema>,
	): Promise<Inventory.ItemAttribute> {
		return await this.items.createItemAttribute(data);
	}

	async updateItemAttribute(
		data: z.infer<typeof Inventory.updateItemAttributeSchema>,
	): Promise<Inventory.ItemAttribute> {
		return await this.items.updateItemAttribute(data);
	}

	async deleteItemAttribute(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.items.deleteItemAttribute(id);
	}

	async findAllItemsForBundleSelection(
		search?: string,
	): Promise<Inventory.BundleSelectableItem[]> {
		return await this.items.findAllItemsForBundleSelection(search);
	}

	async findAllProductBundles(): Promise<Inventory.ProductBundle[]> {
		return await this.items.findAllProductBundles();
	}

	async findProductBundleById(
		id: string,
	): Promise<Inventory.ProductBundle | null> {
		return await this.items.findProductBundleById(id);
	}

	async createProductBundle(
		data: z.infer<typeof Inventory.createProductBundleSchema>,
	): Promise<Inventory.ProductBundle> {
		return await this.items.createProductBundle(data);
	}

	async updateProductBundle(
		data: z.infer<typeof Inventory.updateProductBundleSchema>,
	): Promise<Inventory.ProductBundle> {
		return await this.items.updateProductBundle(data);
	}

	async deleteProductBundle(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.items.deleteProductBundle(id);
	}

	async findAllShippingRules(): Promise<Inventory.ShippingRule[]> {
		return await this.items.findAllShippingRules();
	}

	async findShippingRuleById(
		id: string,
	): Promise<Inventory.ShippingRule | null> {
		return await this.items.findShippingRuleById(id);
	}

	async createShippingRule(
		data: z.infer<typeof Inventory.createShippingRuleSchema>,
	): Promise<Inventory.ShippingRule> {
		return await this.items.createShippingRule(data);
	}

	async updateShippingRule(
		data: z.infer<typeof Inventory.updateShippingRuleSchema>,
	): Promise<Inventory.ShippingRule> {
		return await this.items.updateShippingRule(data);
	}

	async deleteShippingRule(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.items.deleteShippingRule(id);
	}

	async findAllItemManufacturers(): Promise<Inventory.ItemManufacturer[]> {
		return await this.items.findAllItemManufacturers();
	}

	async findItemManufacturerById(
		id: string,
	): Promise<Inventory.ItemManufacturer | null> {
		return await this.items.findItemManufacturerById(id);
	}

	async createItemManufacturer(
		data: z.infer<typeof Inventory.createItemManufacturerSchema>,
	): Promise<Inventory.ItemManufacturer> {
		return await this.items.createItemManufacturer(data);
	}

	async updateItemManufacturer(
		data: z.infer<typeof Inventory.updateItemManufacturerSchema>,
	): Promise<Inventory.ItemManufacturer> {
		return await this.items.updateItemManufacturer(data);
	}

	async deleteItemManufacturer(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.items.deleteItemManufacturer(id);
	}

	async findAllItemAlternatives(): Promise<Inventory.ItemAlternative[]> {
		return await this.items.findAllItemAlternatives();
	}

	async findItemAlternativeById(
		id: string,
	): Promise<Inventory.ItemAlternative | null> {
		return await this.items.findItemAlternativeById(id);
	}

	async createItemAlternative(
		data: z.infer<typeof Inventory.createItemAlternativeSchema>,
	): Promise<Inventory.ItemAlternative> {
		return await this.items.createItemAlternative(data);
	}

	async updateItemAlternative(
		data: z.infer<typeof Inventory.updateItemAlternativeSchema>,
	): Promise<Inventory.ItemAlternative> {
		return await this.items.updateItemAlternative(data);
	}

	async deleteItemAlternative(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.items.deleteItemAlternative(id);
	}

	async createGroup(
		data: Inventory.CreateGroupInput,
	): Promise<Inventory.ItemGroup> {
		return await this.items.createGroup(data);
	}

	async updateGroup(
		data: Inventory.UpdateGroupInput,
	): Promise<Inventory.ItemGroup> {
		return await this.items.updateGroup(data);
	}

	async deleteGroup(id: string): Promise<{ success: boolean; id: string }> {
		return await this.items.deleteGroup(id);
	}

	async create(
		data: z.infer<typeof Inventory.createSchema>,
	): Promise<Inventory.Item> {
		return await this.items.create(data);
	}

	async update(
		data: z.infer<typeof Inventory.updateSchema>,
	): Promise<Inventory.Item> {
		return await this.items.update(data);
	}

	async delete(id: string): Promise<Inventory.Item> {
		return await this.items.delete(id);
	}

	async deleteMany(ids: string[]): Promise<{
		success: boolean;
		count: number;
		ids: string[];
		missingIds: string[];
	}> {
		return await this.items.deleteMany(ids);
	}

	async findAllMaterialRequests(params?: {
		skip?: number;
		take?: number;
		search?: string;
		status?: Inventory.MaterialRequestStatus;
		purpose?: Inventory.MaterialRequestPurpose;
	}): Promise<Inventory.MaterialRequest[]> {
		return await this.stockTx.findAllMaterialRequests(params);
	}

	async findMaterialRequestById(
		id: string,
	): Promise<Inventory.MaterialRequest | null> {
		return await this.stockTx.findMaterialRequestById(id);
	}

	async createMaterialRequest(
		data: Inventory.CreateMaterialRequestInput,
	): Promise<Inventory.MaterialRequest> {
		return await this.stockTx.createMaterialRequest(data);
	}

	async updateMaterialRequest(
		data: Inventory.UpdateMaterialRequestInput,
	): Promise<Inventory.MaterialRequest> {
		return await this.stockTx.updateMaterialRequest(data);
	}

	async deleteMaterialRequest(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.stockTx.deleteMaterialRequest(id);
	}

	async deleteManyMaterialRequests(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		return await this.stockTx.deleteManyMaterialRequests(ids);
	}

	async findAllStockEntries(params?: {
		skip?: number;
		take?: number;
		search?: string;
		status?: Inventory.StockEntryStatus;
		stockEntryType?: Inventory.StockEntryType;
	}): Promise<Inventory.StockEntry[]> {
		return await this.stockTx.findAllStockEntries(params);
	}

	async findStockEntryById(id: string): Promise<Inventory.StockEntry | null> {
		return await this.stockTx.findStockEntryById(id);
	}

	async createStockEntry(
		data: Inventory.CreateStockEntryInput,
	): Promise<Inventory.StockEntry> {
		return await this.stockTx.createStockEntry(data);
	}

	async updateStockEntry(
		data: Inventory.UpdateStockEntryInput,
	): Promise<Inventory.StockEntry> {
		return await this.stockTx.updateStockEntry(data);
	}

	async deleteStockEntry(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.stockTx.deleteStockEntry(id);
	}

	async deleteManyStockEntries(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		return await this.stockTx.deleteManyStockEntries(ids);
	}

	async findInstallationNotes(
		params?: Inventory.ListInstallationNotesInput,
	): Promise<Inventory.InstallationNoteListResult> {
		return await this.installationNote.findInstallationNotes(params);
	}

	async findInstallationNoteById(
		id: string,
	): Promise<Inventory.InstallationNote | null> {
		return await this.installationNote.findInstallationNoteById(id);
	}

	async createInstallationNote(
		data: Inventory.CreateInstallationNoteInput,
	): Promise<Inventory.InstallationNote> {
		return await this.installationNote.createInstallationNote(data);
	}

	async updateInstallationNote(
		data: Inventory.UpdateInstallationNoteInput,
	): Promise<Inventory.InstallationNote> {
		return await this.installationNote.updateInstallationNote(data);
	}

	async deleteInstallationNote(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.installationNote.deleteInstallationNote(id);
	}

	async findDeliveryNoteTrends(
		params: Inventory.ListDeliveryNoteTrendsInput,
	): Promise<Inventory.DeliveryNoteTrendsResult> {
		return await this.delivery.findDeliveryNoteTrends(params);
	}

	async findAllDeliveryNotes(params?: {
		skip?: number;
		take?: number;
		search?: string;
		status?: Inventory.DeliveryNoteStatus;
	}): Promise<Inventory.DeliveryNote[]> {
		return await this.delivery.findAllDeliveryNotes(params);
	}

	async findDeliveryNoteById(
		id: string,
	): Promise<Inventory.DeliveryNote | null> {
		return await this.delivery.findDeliveryNoteById(id);
	}

	async createDeliveryNote(
		data: Inventory.CreateDeliveryNoteInput,
	): Promise<Inventory.DeliveryNote> {
		return await this.delivery.createDeliveryNote(data);
	}

	async updateDeliveryNote(
		data: Inventory.UpdateDeliveryNoteInput,
	): Promise<Inventory.DeliveryNote> {
		return await this.delivery.updateDeliveryNote(data);
	}

	async deleteDeliveryNote(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.delivery.deleteDeliveryNote(id);
	}

	async deleteManyDeliveryNotes(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		return await this.delivery.deleteManyDeliveryNotes(ids);
	}

	async findStockLedger(params?: Inventory.ListStockLedgerInput) {
		return await this.reports.findStockLedger(params);
	}

	async findWarehouseWiseStockBalance(
		params?: Inventory.ListWarehouseWiseStockBalanceInput,
	) {
		return await this.reports.findWarehouseWiseStockBalance(params);
	}

	async findStockBalance(params?: Inventory.ListStockBalanceInput) {
		return await this.reports.findStockBalance(params);
	}

	async getQuickStockBalance(
		params: Inventory.QuickStockBalanceInput,
	): Promise<Inventory.QuickStockBalanceResult> {
		return await this.reports.getQuickStockBalance(params);
	}

	async findStockProjectedQty(params?: Inventory.ListStockProjectedQtyInput) {
		return await this.reports.findStockProjectedQty(params);
	}

	async findItemShortageReport(
		params?: Inventory.ListItemShortageInput,
	): Promise<Inventory.ItemShortageRow[]> {
		return await this.reports.findItemShortageReport(params);
	}

	async findRequestedItemsToBeTransferred(
		params?: Inventory.ListRequestedItemsToBeTransferredInput,
	): Promise<Inventory.RequestedItemsToBeTransferredResult> {
		return await this.reports.findRequestedItemsToBeTransferred(params);
	}

	async findBatchWiseBalanceHistory(
		params: Inventory.ListBatchWiseBalanceInput,
	): Promise<Inventory.BatchWiseBalanceRow[]> {
		return await this.reports.findBatchWiseBalanceHistory(params);
	}

	async findBatchItemExpiry(
		params: Inventory.ListBatchItemExpiryInput,
	): Promise<Inventory.BatchItemExpiryRow[]> {
		return await this.reports.findBatchItemExpiry(params);
	}

	async findItemPrices(
		params?: Inventory.ListItemPricesInput,
	): Promise<Inventory.ItemPricesRow[]> {
		return await this.reports.findItemPrices(params);
	}

	async findStockSummary(params?: Inventory.ListStockSummaryInput) {
		return await this.reports.findStockSummary(params);
	}

	async findItemPriceStock(params?: Inventory.ListItemPriceStockInput) {
		return await this.reports.findItemPriceStock(params);
	}

	async findStockAgeing(params?: Inventory.ListStockAgeingInput) {
		return await this.reports.findStockAgeing(params);
	}

	async findStockAnalytics(
		params: Inventory.ListStockAnalyticsInput,
	): Promise<Inventory.StockAnalyticsResult> {
		return await this.reports.findStockAnalytics(params);
	}

	async findPurchaseReceiptTrends(
		params: Inventory.ListPurchaseReceiptTrendsInput,
	): Promise<Inventory.PurchaseReceiptTrendsResult> {
		return await this.purchaseReceipt.findPurchaseReceiptTrends(params);
	}

	async findSalesOrderAnalysis(
		params: Inventory.ListSalesOrderAnalysisInput,
	): Promise<Inventory.SalesOrderAnalysisResult> {
		return await this.purchaseReceipt.findSalesOrderAnalysis(params);
	}

	async findPurchaseOrderAnalysis(
		params: Inventory.ListPurchaseOrderAnalysisInput,
	): Promise<Inventory.PurchaseOrderAnalysisResult> {
		return await this.purchaseReceipt.findPurchaseOrderAnalysis(params);
	}

	async findAllPurchaseReceipts(params?: {
		skip?: number;
		take?: number;
		search?: string;
		status?: Inventory.PurchaseReceiptStatus;
	}): Promise<Inventory.PurchaseReceipt[]> {
		return await this.purchaseReceipt.findAllPurchaseReceipts(params);
	}

	async findPurchaseReceiptById(
		id: string,
	): Promise<Inventory.PurchaseReceipt | null> {
		return await this.purchaseReceipt.findPurchaseReceiptById(id);
	}

	async createPurchaseReceipt(
		data: Inventory.CreatePurchaseReceiptInput,
	): Promise<Inventory.PurchaseReceipt> {
		return await this.purchaseReceipt.createPurchaseReceipt(data);
	}

	async updatePurchaseReceipt(
		data: Inventory.UpdatePurchaseReceiptInput,
	): Promise<Inventory.PurchaseReceipt> {
		return await this.purchaseReceipt.updatePurchaseReceipt(data);
	}

	async deletePurchaseReceipt(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.purchaseReceipt.deletePurchaseReceipt(id);
	}

	async deleteManyPurchaseReceipts(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		return await this.purchaseReceipt.deleteManyPurchaseReceipts(ids);
	}

	async findAllPickLists(params?: {
		skip?: number;
		take?: number;
		search?: string;
		status?: Inventory.PickListStatus;
	}): Promise<Inventory.PickList[]> {
		return await this.delivery.findAllPickLists(params);
	}

	async findPickListById(id: string): Promise<Inventory.PickList | null> {
		return await this.delivery.findPickListById(id);
	}

	async createPickList(
		data: Inventory.CreatePickListInput,
	): Promise<Inventory.PickList> {
		return await this.delivery.createPickList(data);
	}

	async updatePickList(
		data: Inventory.UpdatePickListInput,
	): Promise<Inventory.PickList> {
		return await this.delivery.updatePickList(data);
	}

	async deletePickList(id: string): Promise<{ success: boolean; id: string }> {
		return await this.delivery.deletePickList(id);
	}

	async deleteManyPickLists(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		return await this.delivery.deleteManyPickLists(ids);
	}

	async findAllDeliveryTrips(params?: {
		skip?: number;
		take?: number;
		search?: string;
		status?: Inventory.DeliveryTripStatus;
	}): Promise<Inventory.DeliveryTrip[]> {
		return await this.delivery.findAllDeliveryTrips(params);
	}

	async findDeliveryTripById(
		id: string,
	): Promise<Inventory.DeliveryTrip | null> {
		return await this.delivery.findDeliveryTripById(id);
	}

	async createDeliveryTrip(
		data: Inventory.CreateDeliveryTripInput,
	): Promise<Inventory.DeliveryTrip> {
		return await this.delivery.createDeliveryTrip(data);
	}

	async updateDeliveryTrip(
		data: Inventory.UpdateDeliveryTripInput,
	): Promise<Inventory.DeliveryTrip> {
		return await this.delivery.updateDeliveryTrip(data);
	}

	async deleteDeliveryTrip(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.delivery.deleteDeliveryTrip(id);
	}

	async deleteManyDeliveryTrips(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		return await this.delivery.deleteManyDeliveryTrips(ids);
	}

	async getRecommendedCaseNo(deliveryNoteId: string): Promise<number> {
		return await this.delivery.getRecommendedCaseNo(deliveryNoteId);
	}

	async findAllPackingSlips(params?: {
		deliveryNoteId?: string;
		status?: Inventory.PackingSlipStatus;
		search?: string;
		skip?: number;
		take?: number;
	}): Promise<Inventory.PackingSlip[]> {
		return await this.delivery.findAllPackingSlips(params);
	}

	async findPackingSlipById(id: string): Promise<Inventory.PackingSlip | null> {
		return await this.delivery.findPackingSlipById(id);
	}

	async createPackingSlip(
		data: Inventory.CreatePackingSlipInput,
	): Promise<Inventory.PackingSlip> {
		return await this.delivery.createPackingSlip(data);
	}

	async updatePackingSlip(
		data: Inventory.UpdatePackingSlipInput,
	): Promise<Inventory.PackingSlip> {
		return await this.delivery.updatePackingSlip(data);
	}

	async submitPackingSlip(id: string): Promise<Inventory.PackingSlip> {
		return await this.delivery.submitPackingSlip(id);
	}

	async cancelPackingSlip(id: string): Promise<Inventory.PackingSlip> {
		return await this.delivery.cancelPackingSlip(id);
	}

	async deletePackingSlip(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.delivery.deletePackingSlip(id);
	}

	async deleteManyPackingSlips(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		return await this.delivery.deleteManyPackingSlips(ids);
	}

	async findAllQiParameterGroups(): Promise<Inventory.QiParameterGroup[]> {
		return await this.qi.findAllQiParameterGroups();
	}

	async createQiParameterGroup(data: {
		name: string;
	}): Promise<Inventory.QiParameterGroup> {
		return await this.qi.createQiParameterGroup(data);
	}

	async updateQiParameterGroup(data: {
		id: string;
		name: string;
	}): Promise<Inventory.QiParameterGroup> {
		return await this.qi.updateQiParameterGroup(data);
	}

	async deleteQiParameterGroup(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.qi.deleteQiParameterGroup(id);
	}

	async findAllQiParameters(params?: {
		search?: string;
		groupId?: string;
	}): Promise<Inventory.QiParameter[]> {
		return await this.qi.findAllQiParameters(params);
	}

	async findQiParameterById(id: string): Promise<Inventory.QiParameter | null> {
		return await this.qi.findQiParameterById(id);
	}

	async createQiParameter(data: {
		parameter: string;
		description?: string | null;
		groupId?: string | null;
	}): Promise<Inventory.QiParameter> {
		return await this.qi.createQiParameter(data);
	}

	async updateQiParameter(data: {
		id: string;
		parameter?: string;
		description?: string | null;
		groupId?: string | null;
	}): Promise<Inventory.QiParameter> {
		return await this.qi.updateQiParameter(data);
	}

	async deleteQiParameter(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.qi.deleteQiParameter(id);
	}

	async findAllQiTemplates(params?: {
		search?: string;
		skip?: number;
		take?: number;
	}): Promise<Inventory.QiTemplate[]> {
		return await this.qi.findAllQiTemplates(params);
	}

	async findQiTemplateById(id: string): Promise<Inventory.QiTemplate | null> {
		return await this.qi.findQiTemplateById(id);
	}

	async createQiTemplate(data: {
		name: string;
		items: Array<{
			parameterId: string;
			sortOrder?: number;
			numeric?: boolean;
			formulaBased?: boolean;
			value?: string | null;
			minValue?: number | null;
			maxValue?: number | null;
			acceptanceFormula?: string | null;
		}>;
	}): Promise<Inventory.QiTemplate> {
		return await this.qi.createQiTemplate(data);
	}

	async updateQiTemplate(data: {
		id: string;
		name?: string;
		items?: Array<{
			id?: string;
			parameterId: string;
			sortOrder?: number;
			numeric?: boolean;
			formulaBased?: boolean;
			value?: string | null;
			minValue?: number | null;
			maxValue?: number | null;
			acceptanceFormula?: string | null;
		}>;
	}): Promise<Inventory.QiTemplate> {
		return await this.qi.updateQiTemplate(data);
	}

	async deleteQiTemplate(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return await this.qi.deleteQiTemplate(id);
	}

	async deleteManyQiTemplates(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		return await this.qi.deleteManyQiTemplates(ids);
	}

	async findItemwiseRecommendedReorderLevel(
		params: Inventory.ListItemwiseRecommendedReorderLevelInput,
	): Promise<Inventory.ItemwiseRecommendedReorderLevelRow[]> {
		return await this.reports.findItemwiseRecommendedReorderLevel(params);
	}

	async findItemVariantDetails(
		params: Inventory.ListItemVariantDetailsInput,
	): Promise<Inventory.ItemVariantDetailsResult> {
		return await this.reports.findItemVariantDetails(params);
	}

	async findSubcontractedRawMaterials(
		params: Inventory.ListSubcontractedRawMaterialsInput,
	): Promise<Inventory.SubcontractedRawMaterialsResult> {
		return await this.reports.findSubcontractedRawMaterials(params);
	}

	async findSubcontractedItemToBeReceived(
		params: Inventory.ListSubcontractedItemToBeReceivedInput,
	): Promise<Inventory.SubcontractedItemToBeReceivedResult> {
		return await this.reports.findSubcontractedItemToBeReceived(params);
	}

	async getDashboardData(): Promise<Inventory.DashboardData> {
		return await this.dashboard.getDashboardData();
	}

	async getDashboardOverviewData(): Promise<Inventory.DashboardOverviewData> {
		return await this.dashboard.getDashboardOverviewData();
	}

	async getDashboardTopChartsData(): Promise<Inventory.DashboardTopChartsData> {
		return await this.dashboard.getDashboardTopChartsData();
	}

	async getDashboardBottomChartsData(): Promise<Inventory.DashboardBottomChartsData> {
		return await this.dashboard.getDashboardBottomChartsData();
	}
}
