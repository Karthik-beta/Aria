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

export class DashboardSubService {
	constructor(private readonly prisma: PrismaService) {}

	async getDashboardData(): Promise<Inventory.DashboardData> {
		const now = new Date();
		const thirtyDaysAgo = new Date(now);
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const ninetyDaysFromNow = new Date(now);
		ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

		const [
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
		] = await Promise.all([
			this.getKpis(),
			this.getStockMovements(thirtyDaysAgo, now),
			this.getWarehouseStock(),
			this.getItemGroupDistribution(),
			this.getRecentActivity(),
			this.getLowStockItems(),
			this.getBatchExpiry(now, ninetyDaysFromNow),
			this.getDeliveryStatus(),
			this.getTopMovingItems(thirtyDaysAgo, now),
			this.getStockEntryTypeBreakdown(),
		]);

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

	private async getKpis(): Promise<Inventory.DashboardKpi> {
		const [
			totalItems,
			activeWarehouses,
			pendingMaterialRequests,
			lowStockCount,
			stockAggregation,
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
			this.prisma.inventoryItem
				.count({
					where: {
						disabled: false,
						maintainStock: true,
						safetyStock: { gt: 0 },
						quantity: {
							lt: this.prisma.inventoryItem.fields?.safetyStock as never,
						},
					},
				})
				.catch(() =>
					// Prisma doesn't support field-vs-field comparison in WHERE, so
					// we use a raw query fallback.
					this.prisma.client
						.$queryRawUnsafe<[{ count: bigint }]>(
							`SELECT COUNT(*)::bigint AS count FROM "inventory_items" WHERE "disabled" = false AND "maintainStock" = true AND "safetyStock" > 0 AND "quantity" < "safetyStock"`,
						)
						.then((rows: [{ count: bigint }]) => Number(rows[0]?.count ?? 0)),
				),
			this.prisma.inventoryItem.aggregate({
				where: { disabled: false, maintainStock: true },
				_sum: { quantity: true },
				_count: true,
			}),
		]);

		// Compute total stock value as SUM(quantity * valuationRate)
		const stockValueResult = await this.prisma.client.$queryRawUnsafe<
			[{ total: number | null }]
		>(
			`SELECT COALESCE(SUM("quantity" * COALESCE("valuationRate", 0)), 0)::float AS total FROM "inventory_items" WHERE "disabled" = false AND "maintainStock" = true`,
		);

		return {
			totalItems,
			activeWarehouses,
			pendingMaterialRequests,
			lowStockItemCount: typeof lowStockCount === "number" ? lowStockCount : 0,
			totalStockValue: stockValueResult[0]?.total ?? 0,
			totalStockQuantity: stockAggregation._sum.quantity ?? 0,
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

	private async getItemGroupDistribution(): Promise<
		Inventory.DashboardItemGroupDistribution[]
	> {
		const items = await this.prisma.inventoryItem.findMany({
			where: { disabled: false, maintainStock: true },
			select: {
				quantity: true,
				valuationRate: true,
				itemGroup: { select: { groupName: true } },
			},
		});

		const groupMap = new Map<string, { value: number; itemCount: number }>();

		for (const item of items) {
			const groupName = item.itemGroup?.groupName ?? "Uncategorised";
			const existing = groupMap.get(groupName) ?? {
				value: 0,
				itemCount: 0,
			};
			existing.value += item.quantity * (item.valuationRate ?? 0);
			existing.itemCount += 1;
			groupMap.set(groupName, existing);
		}

		return Array.from(groupMap.entries())
			.map(([group, data]) => ({
				group,
				value: Math.round(data.value),
				itemCount: data.itemCount,
			}))
			.sort((a, b) => b.value - a.value)
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

	private async getLowStockItems(): Promise<Inventory.DashboardLowStockItem[]> {
		const items = await this.prisma.client.$queryRawUnsafe<
			Array<{
				code: string;
				name: string;
				quantity: number;
				safetyStock: number;
			}>
		>(
			`SELECT "code", "name", "quantity", "safetyStock"
			 FROM "inventory_items"
			 WHERE "disabled" = false
			   AND "maintainStock" = true
			   AND "safetyStock" > 0
			   AND "quantity" < "safetyStock"
			 ORDER BY ("safetyStock" - "quantity") DESC
			 LIMIT 15`,
		);

		return items.map((item) => ({
			itemCode: item.code,
			itemName: item.name,
			currentQty: item.quantity,
			safetyStock: item.safetyStock,
			deficit: item.safetyStock - item.quantity,
			warehouse: "All Warehouses",
		}));
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
