import { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";

type StockSnapshotQueryClient = Pick<
	PrismaService,
	"client" | "inventoryItem"
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
	const purchaseReceiptItemFilter = itemCodes
		? Prisma.sql`AND pri."itemCode" IN (${Prisma.join(itemCodes)})`
		: Prisma.empty;
	const stockEntryItemFilter = itemCodes
		? Prisma.sql`AND sei."itemCode" IN (${Prisma.join(itemCodes)})`
		: Prisma.empty;
	const deliveryNoteItemFilter = itemCodes
		? Prisma.sql`AND dni."itemCode" IN (${Prisma.join(itemCodes)})`
		: Prisma.empty;
	const purchaseReceiptCompanyFilter = options.company
		? Prisma.sql`AND pr.company = ${options.company}`
		: Prisma.empty;
	const stockEntryCompanyFilter = options.company
		? Prisma.sql`AND se.company = ${options.company}`
		: Prisma.empty;
	const deliveryNoteCompanyFilter = options.company
		? Prisma.sql`AND dn.company = ${options.company}`
		: Prisma.empty;
	const snapshotRows = await prisma.client.$queryRaw<
		Array<{ itemCode: string; quantity: number | null }>
	>(Prisma.sql`
		SELECT movement.item_code AS "itemCode", SUM(movement.quantity_delta) AS "quantity"
		FROM (
			SELECT pri."itemCode" AS item_code, SUM(pri."acceptedQuantity") AS quantity_delta
			FROM purchase_receipt_items pri
			INNER JOIN purchase_receipts pr ON pr.id = pri."purchaseReceiptId"
			WHERE pr.status NOT IN ('DRAFT', 'CANCELLED')
				AND pr."isReturn" = false
				${purchaseReceiptCompanyFilter}
				${purchaseReceiptItemFilter}
			GROUP BY pri."itemCode"

			UNION ALL

			SELECT
				sei."itemCode" AS item_code,
				SUM(
					CASE
						WHEN COALESCE(
							sei."targetWarehouse",
							se."defaultTargetWarehouse"
						) IS NOT NULL THEN sei.qty
						ELSE 0
					END
					-
					CASE
						WHEN COALESCE(
							sei."sourceWarehouse",
							se."defaultSourceWarehouse"
						) IS NOT NULL THEN sei.qty
						ELSE 0
					END
				) AS quantity_delta
			FROM stock_entry_items sei
			INNER JOIN stock_entries se ON se.id = sei."stockEntryId"
			WHERE se.status = 'SUBMITTED'
				${stockEntryCompanyFilter}
				${stockEntryItemFilter}
			GROUP BY sei."itemCode"

			UNION ALL

			SELECT dni."itemCode" AS item_code, -SUM(dni.quantity) AS quantity_delta
			FROM delivery_note_items dni
			INNER JOIN delivery_notes dn ON dn.id = dni."deliveryNoteId"
			WHERE dn.status NOT IN ('DRAFT', 'CANCELLED')
				AND dn."isReturn" = false
				${deliveryNoteCompanyFilter}
				${deliveryNoteItemFilter}
			GROUP BY dni."itemCode"
		) movement
		GROUP BY movement.item_code
	`);

	const snapshot = new Map<string, number>();

	for (const row of snapshotRows) {
		addQuantity(snapshot, row.itemCode, Number(row.quantity ?? 0));
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
