import type { Inventory } from "@aria/types";
import type { Prisma } from "../../generated/prisma/client";

export type StockAgeingReportItem = Prisma.StockEntryItemGetPayload<{
	include: {
		stockEntry: true;
	};
}>;

export interface StockAgeingBucketRange {
	minAge: number;
	maxAge?: number | null;
}

type StockAgeingLayer = {
	company: string;
	itemCode: string;
	warehouse: string;
	itemName?: string | null;
	description?: string | null;
	unitOfMeasure?: string | null;
	qty: number;
	basicRate: number;
	acquiredAt: Date;
};

type ConsumedLayerSegment = Omit<StockAgeingLayer, "warehouse">;

interface BuildStockAgeingRowsOptions {
	asOfDate: Date;
	showWarehouseWiseStock?: boolean;
	bucketRanges: StockAgeingBucketRange[];
}

function createWarehouseStockKey(
	company: string,
	itemCode: string,
	warehouse: string,
) {
	return `${company}::${itemCode}::${warehouse}`;
}

function normalizeBucketRanges(
	ranges: StockAgeingBucketRange[],
): StockAgeingBucketRange[] {
	return [...ranges]
		.filter(
			(range) =>
				Number.isFinite(range.minAge) &&
				range.minAge >= 0 &&
				(range.maxAge == null || range.maxAge >= range.minAge),
		)
		.sort((left, right) => left.minAge - right.minAge);
}

function consumeWarehouseLayers(
	layers: StockAgeingLayer[],
	requestedQty: number,
): { consumed: ConsumedLayerSegment[]; missingQty: number } {
	if (requestedQty <= 0) {
		return { consumed: [], missingQty: 0 };
	}

	let remainingQty = requestedQty;
	const consumed: ConsumedLayerSegment[] = [];

	while (remainingQty > 0 && layers.length > 0) {
		const currentLayer = layers[0];
		const consumedQty = Math.min(currentLayer.qty, remainingQty);

		consumed.push({
			company: currentLayer.company,
			itemCode: currentLayer.itemCode,
			itemName: currentLayer.itemName,
			description: currentLayer.description,
			unitOfMeasure: currentLayer.unitOfMeasure,
			qty: consumedQty,
			basicRate: currentLayer.basicRate,
			acquiredAt: currentLayer.acquiredAt,
		});

		currentLayer.qty -= consumedQty;
		remainingQty -= consumedQty;

		if (currentLayer.qty <= 0) {
			layers.shift();
		}
	}

	return { consumed, missingQty: remainingQty };
}

function createFallbackSegment(
	item: StockAgeingReportItem,
	warehouse: string,
	qty: number,
): StockAgeingLayer {
	return {
		company: item.stockEntry.company,
		itemCode: item.itemCode,
		itemName: item.itemName,
		description: item.description,
		unitOfMeasure: item.unitOfMeasure,
		warehouse,
		qty,
		basicRate: item.basicRate,
		acquiredAt: item.stockEntry.postingDate,
	};
}

function pushLayer(
	state: Map<string, StockAgeingLayer[]>,
	layer: StockAgeingLayer,
): void {
	if (layer.qty <= 0) {
		return;
	}

	const stateKey = createWarehouseStockKey(
		layer.company,
		layer.itemCode,
		layer.warehouse,
	);
	const warehouseLayers = state.get(stateKey) ?? [];
	warehouseLayers.push(layer);
	state.set(stateKey, warehouseLayers);
}

function buildAgeingBuckets(
	layers: StockAgeingLayer[],
	asOfDate: Date,
	ranges: StockAgeingBucketRange[],
): Inventory.StockAgeingBucket[] {
	return ranges.map((range, index) => {
		let quantity = 0;
		let value = 0;

		for (const layer of layers) {
			const ageInDays = Math.max(
				0,
				Math.floor(
					(asOfDate.getTime() - layer.acquiredAt.getTime()) /
						(1000 * 60 * 60 * 24),
				),
			);
			const inRange =
				ageInDays >= range.minAge &&
				(range.maxAge == null || ageInDays <= range.maxAge);

			if (!inRange) {
				continue;
			}

			quantity += layer.qty;
			value += layer.qty * layer.basicRate;
		}

		return {
			index,
			minAge: range.minAge,
			maxAge: range.maxAge ?? null,
			quantity,
			value,
		};
	});
}

/**
 * Builds stock ageing rows by replaying stock movements and preserving FIFO age
 * across inter-warehouse transfers.
 */
export function buildStockAgeingRows(
	items: StockAgeingReportItem[],
	options: BuildStockAgeingRowsOptions,
): Inventory.StockAgeingRow[] {
	const bucketRanges = normalizeBucketRanges(options.bucketRanges);
	const state = new Map<string, StockAgeingLayer[]>();

	for (const item of items) {
		if (item.stockEntry.postingDate.getTime() > options.asOfDate.getTime()) {
			continue;
		}

		const sourceWarehouse =
			item.sourceWarehouse ?? item.stockEntry.defaultSourceWarehouse ?? null;
		const targetWarehouse =
			item.targetWarehouse ?? item.stockEntry.defaultTargetWarehouse ?? null;

		let consumedSegments: ConsumedLayerSegment[] = [];
		let missingQty = 0;

		if (sourceWarehouse) {
			const sourceStateKey = createWarehouseStockKey(
				item.stockEntry.company,
				item.itemCode,
				sourceWarehouse,
			);
			const sourceLayers = state.get(sourceStateKey) ?? [];
			const result = consumeWarehouseLayers(sourceLayers, item.qty);
			consumedSegments = result.consumed;
			missingQty = result.missingQty;

			if (sourceLayers.length > 0) {
				state.set(sourceStateKey, sourceLayers);
			} else {
				state.delete(sourceStateKey);
			}
		}

		if (!targetWarehouse) {
			continue;
		}

		for (const segment of consumedSegments) {
			pushLayer(state, {
				...segment,
				warehouse: targetWarehouse,
			});
		}

		if (!sourceWarehouse && item.qty > 0) {
			pushLayer(state, createFallbackSegment(item, targetWarehouse, item.qty));
		}

		if (missingQty > 0) {
			pushLayer(
				state,
				createFallbackSegment(item, targetWarehouse, missingQty),
			);
		}
	}

	const groupedLayers = new Map<string, StockAgeingLayer[]>();

	for (const [warehouseStateKey, warehouseLayers] of state.entries()) {
		const positiveLayers = warehouseLayers.filter((layer) => layer.qty > 0);
		if (positiveLayers.length === 0) {
			continue;
		}

		const [company, itemCode, warehouse] = warehouseStateKey.split("::");
		const rowKey = options.showWarehouseWiseStock
			? warehouseStateKey
			: `${company}::${itemCode}`;
		const rowLayers = groupedLayers.get(rowKey) ?? [];

		for (const layer of positiveLayers) {
			rowLayers.push(
				options.showWarehouseWiseStock ? layer : { ...layer, warehouse },
			);
		}

		groupedLayers.set(rowKey, rowLayers);
	}

	return [...groupedLayers.entries()]
		.map(([rowKey, layers]) => {
			const availableQty = layers.reduce((sum, layer) => sum + layer.qty, 0);
			const totalValue = layers.reduce(
				(sum, layer) => sum + layer.qty * layer.basicRate,
				0,
			);
			const weightedAge = layers.reduce((sum, layer) => {
				const ageInDays = Math.max(
					0,
					Math.floor(
						(options.asOfDate.getTime() - layer.acquiredAt.getTime()) /
							(1000 * 60 * 60 * 24),
					),
				);
				return sum + layer.qty * ageInDays;
			}, 0);

			const firstLayer = layers[0];
			const [company, itemCode, warehouse] = rowKey.split("::");

			return {
				id: rowKey,
				company,
				itemCode,
				itemName: firstLayer?.itemName ?? null,
				description: firstLayer?.description ?? null,
				warehouse: options.showWarehouseWiseStock ? warehouse : null,
				unitOfMeasure: firstLayer?.unitOfMeasure ?? null,
				availableQty,
				averageAge: availableQty > 0 ? weightedAge / availableQty : 0,
				averageRate: availableQty > 0 ? totalValue / availableQty : 0,
				asOfDate: options.asOfDate,
				buckets: buildAgeingBuckets(layers, options.asOfDate, bucketRanges),
			} satisfies Inventory.StockAgeingRow;
		})
		.filter((row) => row.availableQty > 0)
		.sort((left, right) => {
			if (right.averageAge !== left.averageAge) {
				return right.averageAge - left.averageAge;
			}

			if (left.company !== right.company) {
				return left.company.localeCompare(right.company);
			}

			if ((left.warehouse ?? "") !== (right.warehouse ?? "")) {
				return (left.warehouse ?? "").localeCompare(right.warehouse ?? "");
			}

			return left.itemCode.localeCompare(right.itemCode);
		});
}
