import type { PrismaService } from "../../../shared/prisma.service";

type StockSnapshotQueryClient = Pick<
	PrismaService,
	| "inventoryItem"
	| "purchaseReceiptItem"
	| "stockEntryItem"
	| "deliveryNoteItem"
> & {
	inventoryItem: {
		findMany: PrismaService["inventoryItem"]["findMany"];
		update: PrismaService["inventoryItem"]["update"];
	};
};

export interface StockSnapshotOptions {
	company?: string;
	itemCodes?: string[];
}

function resolveItemCodes(itemCodes?: string[]) {
	const filteredCodes = itemCodes?.map((code) => code.trim()).filter(Boolean);
	return filteredCodes && filteredCodes.length > 0 ? filteredCodes : null;
}

function addQuantity(
	snapshot: Map<string, number>,
	itemCode: string,
	quantityDelta: number,
) {
	snapshot.set(itemCode, (snapshot.get(itemCode) ?? 0) + quantityDelta);
}

/**
 * Build on-hand stock by item code from committed inventory movements only.
 *
 * The snapshot intentionally ignores denormalised `inventory_items.quantity`
 * so dashboard reads and demo-data backfills use one consistent source.
 */
export async function buildCommittedStockSnapshot(
	prisma: StockSnapshotQueryClient,
	options: StockSnapshotOptions = {},
): Promise<Map<string, number>> {
	const itemCodes = resolveItemCodes(options.itemCodes);
	const itemCodeFilter = itemCodes ? { itemCode: { in: itemCodes } } : {};

	const [purchaseReceiptItems, stockEntryItems, deliveryNoteItems] =
		await Promise.all([
			prisma.purchaseReceiptItem.findMany({
				where: {
					...itemCodeFilter,
					purchaseReceipt: {
						status: { notIn: ["DRAFT", "CANCELLED"] },
						isReturn: false,
						...(options.company ? { company: options.company } : {}),
					},
				},
				select: {
					itemCode: true,
					acceptedQuantity: true,
				},
			}),
			prisma.stockEntryItem.findMany({
				where: {
					...itemCodeFilter,
					stockEntry: {
						status: "SUBMITTED",
						...(options.company ? { company: options.company } : {}),
					},
				},
				select: {
					itemCode: true,
					qty: true,
					sourceWarehouse: true,
					targetWarehouse: true,
					stockEntry: {
						select: {
							defaultSourceWarehouse: true,
							defaultTargetWarehouse: true,
						},
					},
				},
			}),
			prisma.deliveryNoteItem.findMany({
				where: {
					...itemCodeFilter,
					deliveryNote: {
						status: { notIn: ["DRAFT", "CANCELLED"] },
						isReturn: false,
						...(options.company ? { company: options.company } : {}),
					},
				},
				select: {
					itemCode: true,
					quantity: true,
				},
			}),
		]);

	const snapshot = new Map<string, number>();

	for (const item of purchaseReceiptItems) {
		addQuantity(snapshot, item.itemCode, item.acceptedQuantity);
	}

	for (const item of stockEntryItems) {
		const sourceWarehouse =
			item.sourceWarehouse ?? item.stockEntry.defaultSourceWarehouse;
		const targetWarehouse =
			item.targetWarehouse ?? item.stockEntry.defaultTargetWarehouse;

		if (targetWarehouse) {
			addQuantity(snapshot, item.itemCode, item.qty);
		}

		if (sourceWarehouse) {
			addQuantity(snapshot, item.itemCode, -item.qty);
		}
	}

	for (const item of deliveryNoteItems) {
		addQuantity(snapshot, item.itemCode, -item.quantity);
	}

	return snapshot;
}

/**
 * Persist a committed stock snapshot back into `inventory_items.quantity`.
 *
 * This is used by the demo-data loader so seeded dashboards and stock screens
 * stay aligned with the same movement-ledger calculation used at read time.
 */
export async function reconcileInventoryItemQuantities(
	prisma: StockSnapshotQueryClient,
	options: Required<Pick<StockSnapshotOptions, "company">> &
		StockSnapshotOptions,
): Promise<void> {
	const itemCodes = resolveItemCodes(options.itemCodes);
	const snapshot = await buildCommittedStockSnapshot(prisma, options);
	const inventoryItems = await prisma.inventoryItem.findMany({
		where: {
			maintainStock: true,
			...(itemCodes ? { code: { in: itemCodes } } : {}),
		},
		select: {
			id: true,
			code: true,
		},
	});

	await Promise.all(
		inventoryItems.map((item) =>
			prisma.inventoryItem.update({
				where: { id: item.id },
				data: { quantity: Math.round(snapshot.get(item.code) ?? 0) },
			}),
		),
	);
}
