/**
 * Dashboard sub-service — aggregated metrics for the inventory dashboard.
 *
 * Runs efficient Prisma queries to gather KPIs, trends, and operational
 * indicators in a single request. All computations run server-side to
 * minimise round-trips and keep the frontend thin.
 *
 * @module DashboardSubService
 */
import type { Inventory } from "@aria/types";
import type { PrismaService } from "../../../shared/prisma.service";
import { buildCommittedStockSnapshot } from "./stock-snapshot";

interface DashboardStockItem {
	code: string;
	name: string;
	safetyStock: number | null;
	valuationRate: number | null;
	itemGroup: { groupName: string } | null;
}

export class DashboardSubService {
	constructor(private readonly prisma: PrismaService) {}

	async getDashboardData(): Promise<Inventory.DashboardData> {
		const now = new Date();
		const thirtyDaysAgo = new Date(now);
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const ninetyDaysFromNow = new Date(now);
		ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

		const stockItems = await this.getStockItems();
		const trackedItemCodes = stockItems.map((item) => item.code);

		const [
			totalItems,
			activeWarehouses,
			pendingMaterialRequests,
			stockSnapshot,
			stockMovements,
			warehouseStock,
			recentActivity,
			batchExpiry,
			deliveryStatus,
			topMovingItems,
			stockEntryTypeBreakdown,
		] = await Promise.all([
			this.prisma.inventoryItem.count({
				where: { disabled: false },
			}),
			this.prisma.warehouse.count({
				where: { disabled: false, isGroupWarehouse: false },
			}),
			this.prisma.materialRequest.count({
				where: { status: { in: ["PENDING", "APPROVED", "PARTIALLY_ORDERED"] } },
			}),
			buildCommittedStockSnapshot(this.prisma, {
				itemCodes: trackedItemCodes,
			}),
			this.getStockMovements(thirtyDaysAgo, now),
			this.getWarehouseStock(),
			this.getRecentActivity(),
			this.getBatchExpiry(now, ninetyDaysFromNow),
			this.getDeliveryStatus(),
			this.getTopMovingItems(thirtyDaysAgo, now),
			this.getStockEntryTypeBreakdown(),
		]);
		const { kpis, itemGroupDistribution, lowStockItems } =
			this.buildStockInsights({
				totalItems,
				activeWarehouses,
				pendingMaterialRequests,
				stockItems,
				stockSnapshot,
			});

		return {
			kpis,
			stockMovements,
			warehouseStock,
			itemGroupDistribution,
			recentActivity,
			lowStockItems,
			batchExpiry,
			deliveryStatus,
			topMovingItems,
			stockEntryTypeBreakdown,
		};
	}

	private async getStockItems(): Promise<DashboardStockItem[]> {
		return this.prisma.inventoryItem.findMany({
			where: { disabled: false, maintainStock: true },
			select: {
				code: true,
				name: true,
				safetyStock: true,
				valuationRate: true,
				itemGroup: { select: { groupName: true } },
			},
		});
	}

	private buildStockInsights({
		totalItems,
		activeWarehouses,
		pendingMaterialRequests,
		stockItems,
		stockSnapshot,
	}: {
		totalItems: number;
		activeWarehouses: number;
		pendingMaterialRequests: number;
		stockItems: DashboardStockItem[];
		stockSnapshot: Map<string, number>;
	}): {
		kpis: Inventory.DashboardKpi;
		itemGroupDistribution: Inventory.DashboardItemGroupDistribution[];
		lowStockItems: Inventory.DashboardLowStockItem[];
	} {
		let totalStockQuantity = 0;
		let totalStockValue = 0;
		const lowStockItems: Inventory.DashboardLowStockItem[] = [];
		const groupMap = new Map<string, { value: number; itemCount: number }>();

		for (const item of stockItems) {
			const currentQty = stockSnapshot.get(item.code) ?? 0;
			const safetyStock = item.safetyStock ?? 0;
			const stockValue = currentQty * (item.valuationRate ?? 0);
			const groupName = item.itemGroup?.groupName ?? "Uncategorised";
			const existingGroup = groupMap.get(groupName) ?? {
				value: 0,
				itemCount: 0,
			};

			totalStockQuantity += currentQty;
			totalStockValue += stockValue;
			existingGroup.value += stockValue;
			existingGroup.itemCount += 1;
			groupMap.set(groupName, existingGroup);

			if (safetyStock > 0 && currentQty < safetyStock) {
				lowStockItems.push({
					itemCode: item.code,
					itemName: item.name,
					currentQty: Math.round(currentQty),
					safetyStock,
					deficit: Math.round(safetyStock - currentQty),
					warehouse: "All Warehouses",
				});
			}
		}

		return {
			kpis: {
				totalItems,
				activeWarehouses,
				pendingMaterialRequests,
				lowStockItemCount: lowStockItems.length,
				totalStockValue: Math.round(totalStockValue),
				totalStockQuantity: Math.round(totalStockQuantity),
			},
			itemGroupDistribution: Array.from(groupMap.entries())
				.map(([group, data]) => ({
					group,
					value: Math.round(data.value),
					itemCount: data.itemCount,
				}))
				.sort((a, b) => b.value - a.value)
				.slice(0, 10),
			lowStockItems: lowStockItems
				.sort((a, b) => b.deficit - a.deficit)
				.slice(0, 15),
		};
	}

	private async getStockMovements(
		from: Date,
		to: Date,
	): Promise<Inventory.DashboardStockMovement[]> {
		const entries = await this.prisma.stockEntry.findMany({
			where: {
				postingDate: { gte: from, lte: to },
				status: { not: "CANCELLED" },
			},
			select: {
				postingDate: true,
				stockEntryType: true,
				items: {
					select: { qty: true },
				},
			},
			orderBy: { postingDate: "asc" },
		});

		const dayMap = new Map<string, { inbound: number; outbound: number }>();

		for (const entry of entries) {
			const dateKey = entry.postingDate.toISOString().slice(0, 10);
			const existing = dayMap.get(dateKey) ?? { inbound: 0, outbound: 0 };
			const totalQty = entry.items.reduce((sum, item) => sum + item.qty, 0);

			if (
				entry.stockEntryType === "MATERIAL_RECEIPT" ||
				entry.stockEntryType === "MANUFACTURE"
			) {
				existing.inbound += totalQty;
			} else if (
				entry.stockEntryType === "MATERIAL_ISSUE" ||
				entry.stockEntryType === "SEND_TO_SUBCONTRACTOR"
			) {
				existing.outbound += totalQty;
			} else {
				// Transfers count as both for visibility
				existing.inbound += totalQty;
				existing.outbound += totalQty;
			}

			dayMap.set(dateKey, existing);
		}

		// Also count delivery notes as outbound
		const deliveryNotes = await this.prisma.deliveryNote.findMany({
			where: {
				postingDate: { gte: from, lte: to },
				status: { not: "CANCELLED" },
				isReturn: false,
			},
			select: {
				postingDate: true,
				totalQuantity: true,
			},
		});

		for (const dn of deliveryNotes) {
			const dateKey = dn.postingDate.toISOString().slice(0, 10);
			const existing = dayMap.get(dateKey) ?? { inbound: 0, outbound: 0 };
			existing.outbound += dn.totalQuantity;
			dayMap.set(dateKey, existing);
		}

		// Also count purchase receipts as inbound
		const purchaseReceipts = await this.prisma.purchaseReceipt.findMany({
			where: {
				postingDate: { gte: from, lte: to },
				status: { not: "CANCELLED" },
				isReturn: false,
			},
			select: {
				postingDate: true,
				totalQuantity: true,
			},
		});

		for (const pr of purchaseReceipts) {
			const dateKey = pr.postingDate.toISOString().slice(0, 10);
			const existing = dayMap.get(dateKey) ?? { inbound: 0, outbound: 0 };
			existing.inbound += pr.totalQuantity;
			dayMap.set(dateKey, existing);
		}

		return Array.from(dayMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, data]) => ({
				date,
				inbound: Math.round(data.inbound),
				outbound: Math.round(data.outbound),
			}));
	}

	private async getWarehouseStock(): Promise<
		Inventory.DashboardWarehouseStock[]
	> {
		// Use batch warehouse distribution for warehouse-level stock view
		const batchAgg = await this.prisma.batch.groupBy({
			by: ["currentWarehouseId"],
			where: {
				isDisabled: false,
				quantity: { gt: 0 },
				currentWarehouseId: { not: null },
			},
			_sum: { quantity: true },
			_count: true,
		});

		if (batchAgg.length === 0) {
			// Fallback: use warehouse count if no batches
			const warehouses = await this.prisma.warehouse.findMany({
				where: { disabled: false, isGroupWarehouse: false },
				select: { name: true },
				take: 10,
			});
			return warehouses.map((w) => ({
				warehouse: w.name,
				itemCount: 0,
				totalQty: 0,
			}));
		}

		const warehouseIds = batchAgg
			.map((b) => b.currentWarehouseId)
			.filter(Boolean) as string[];

		const warehouses = await this.prisma.warehouse.findMany({
			where: { id: { in: warehouseIds } },
			select: { id: true, name: true },
		});

		const whNameMap = new Map(warehouses.map((w) => [w.id, w.name]));

		return batchAgg
			.filter((b) => b.currentWarehouseId)
			.map((b) => ({
				warehouse: whNameMap.get(b.currentWarehouseId ?? "") ?? "Unknown",
				itemCount: b._count,
				totalQty: Math.round(b._sum.quantity ?? 0),
			}))
			.sort((a, b) => b.totalQty - a.totalQty)
			.slice(0, 10);
	}

	private async getRecentActivity(): Promise<
		Inventory.DashboardRecentActivity[]
	> {
		const entries = await this.prisma.stockEntry.findMany({
			where: { status: { not: "CANCELLED" } },
			orderBy: { postingDate: "desc" },
			take: 10,
			select: {
				id: true,
				series: true,
				stockEntryType: true,
				postingDate: true,
				items: {
					select: {
						itemCode: true,
						itemName: true,
						qty: true,
						targetWarehouse: true,
						sourceWarehouse: true,
					},
					take: 1,
				},
			},
		});

		return entries.map((entry) => {
			const firstItem = entry.items[0];
			return {
				id: entry.id,
				series: entry.series,
				type: entry.stockEntryType,
				itemCode: firstItem?.itemCode ?? "—",
				itemName: firstItem?.itemName ?? null,
				qty: firstItem?.qty ?? 0,
				warehouse:
					firstItem?.targetWarehouse ?? firstItem?.sourceWarehouse ?? null,
				postingDate: entry.postingDate.toISOString(),
			};
		});
	}

	private async getBatchExpiry(
		from: Date,
		to: Date,
	): Promise<Inventory.DashboardBatchExpiry[]> {
		const batches = await this.prisma.batch.findMany({
			where: {
				isDisabled: false,
				quantity: { gt: 0 },
				expiryDate: { gte: from, lte: to },
			},
			orderBy: { expiryDate: "asc" },
			take: 15,
			select: {
				batchId: true,
				quantity: true,
				expiryDate: true,
				item: { select: { code: true, name: true } },
				currentWarehouse: { select: { name: true } },
			},
		});

		const now = Date.now();

		return batches
			.filter((b) => b.expiryDate !== null)
			.map((batch) => ({
				batchId: batch.batchId,
				itemCode: batch.item.code,
				itemName: batch.item.name,
				warehouse: batch.currentWarehouse?.name ?? null,
				quantity: batch.quantity,
				expiryDate: (batch.expiryDate ?? new Date()).toISOString(),
				daysUntilExpiry: Math.ceil(
					((batch.expiryDate ?? new Date()).getTime() - now) /
						(1000 * 60 * 60 * 24),
				),
			}));
	}

	private async getDeliveryStatus(): Promise<
		Inventory.DashboardDeliveryStatus[]
	> {
		const grouping = await this.prisma.deliveryNote.groupBy({
			by: ["status"],
			_count: true,
			_sum: { totalAmount: true },
		});

		return grouping.map((g) => ({
			status: g.status,
			count: g._count,
			totalAmount: Math.round(g._sum.totalAmount ?? 0),
		}));
	}

	private async getTopMovingItems(
		from: Date,
		to: Date,
	): Promise<Inventory.DashboardTopMovingItem[]> {
		const items = await this.prisma.stockEntryItem.groupBy({
			by: ["itemCode", "itemName"],
			where: {
				stockEntry: {
					postingDate: { gte: from, lte: to },
					status: { not: "CANCELLED" },
				},
			},
			_sum: { qty: true },
			_count: true,
			orderBy: { _sum: { qty: "desc" } },
			take: 10,
		});

		return items.map((item) => ({
			itemCode: item.itemCode,
			itemName: item.itemName,
			totalQty: Math.round(item._sum.qty ?? 0),
			transactionCount: item._count,
		}));
	}

	private async getStockEntryTypeBreakdown(): Promise<
		Inventory.DashboardStockEntryTypeBreakdown[]
	> {
		const types = await this.prisma.stockEntry.groupBy({
			by: ["stockEntryType"],
			where: { status: { not: "CANCELLED" } },
			_count: true,
		});

		// Get total qty per type
		const withQty = await Promise.all(
			types.map(async (t) => {
				const agg = await this.prisma.stockEntryItem.aggregate({
					where: {
						stockEntry: {
							stockEntryType: t.stockEntryType,
							status: { not: "CANCELLED" },
						},
					},
					_sum: { qty: true },
				});
				return {
					type: t.stockEntryType,
					count: t._count,
					totalQty: Math.round(agg._sum.qty ?? 0),
				};
			}),
		);

		return withQty.sort((a, b) => b.count - a.count);
	}
}
