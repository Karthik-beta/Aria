/**
 * Demo Data — Transaction Seeder
 *
 * Creates transactional records that form the operational history of
 * Pivotr Electronics over the configured date range:
 *
 *  1. Purchase Orders (supplier orders placed)
 *  2. Purchase Receipts (goods received from suppliers)
 *  3. Stock Entries (material receipts, transfers, issues, manufacture)
 *  4. Sales Orders (customer orders received)
 *  5. Material Requests (internal requisitions)
 *  6. Delivery Notes (goods shipped to customers)
 *  7. Batches (created via purchase receipts & stock entries)
 *  8. Serial Numbers + History (for serialised items)
 *  9. Pick Lists (picking for delivery)
 * 10. Packing Slips (packaging for shipment)
 * 11. Delivery Trips (logistics scheduling)
 * 12. Installation Notes (on-site installations)
 * 13. Subcontracting Orders (outsourced manufacturing)
 *
 * Data tells a coherent story: procurement → receipt → stock → pick →
 * pack → deliver → install. Quantities and statuses are consistent.
 */

import type { DemoDepreciationCoordinator } from "../../src/apps/asset/depreciation/demo-data.types.js";
import type { PrismaService } from "../../src/shared/prisma.service.js";
import type { DemoConfig } from "./config.js";
import { CUSTOMERS, DRIVERS, ITEMS, SUPPLIERS, VEHICLES } from "./data.js";
import {
	makeSeries,
	pick,
	pickN,
	randomFloat,
	randomInt,
	scaled,
	spreadDates,
	zeroPad,
} from "./helpers.js";
import { seedAssetTransactions } from "./seed-asset-transactions.js";
import type { MasterIds } from "./seed-master.js";

// ── Counters for series generation ────────────────────────────────
const batchCounter = 0;
const serialCounter = 0;

function nextSeries(prefix: string, counter: { val: number }, year: number) {
	counter.val++;
	return makeSeries(prefix, year, counter.val);
}

function parseSeriesSequence(series: string): number {
	const match = series.match(/-(\d{4})$/);
	return match ? Number(match[1]) : 0;
}

async function getSeriesStart(
	prismaModel: {
		findMany: (args: {
			where: { series: { startsWith: string } };
			select: { series: true };
		}) => Promise<Array<{ series: string }>>;
	},
	prefix: string,
	year: number,
) {
	const seriesList = await prismaModel.findMany({
		where: { series: { startsWith: `${prefix}-${year}-` } },
		select: { series: true },
	});

	let max = 0;
	for (const item of seriesList) {
		max = Math.max(max, parseSeriesSequence(item.series));
	}

	return max;
}

export async function seedTransactions(
	prisma: PrismaService,
	config: DemoConfig,
	ids: MasterIds,
	depreciation: DemoDepreciationCoordinator,
): Promise<void> {
	const year = config.dateRange.from.getFullYear();
	const poC = {
		val: await getSeriesStart(prisma.purchaseOrder, "MAT-PO", year),
	};
	const prC = {
		val: await getSeriesStart(prisma.purchaseReceipt, "MAT-PRE", year),
	};
	const seC = { val: await getSeriesStart(prisma.stockEntry, "MAT-STE", year) };
	const soC = { val: await getSeriesStart(prisma.salesOrder, "MAT-SO", year) };
	const mrC = {
		val: await getSeriesStart(prisma.materialRequest, "MAT-MR", year),
	};
	const dnC = {
		val: await getSeriesStart(prisma.deliveryNote, "MAT-DN", year),
	};
	const plC = { val: await getSeriesStart(prisma.pickList, "STO-PICK", year) };
	const psC = {
		val: await getSeriesStart(prisma.packingSlip, "MAT-PAC", year),
	};
	const dtC = {
		val: await getSeriesStart(prisma.deliveryTrip, "MAT-DT", year),
	};
	const inC = {
		val: await getSeriesStart(prisma.installationNote, "MAT-INS", year),
	};
	const bC = { val: batchCounter };
	const snC = { val: serialCounter };
	const scoC = {
		val: await getSeriesStart(prisma.subcontractingOrder, "MAT-SCO", year),
	};

	// warehouse names for re-use
	const mainWh = "Peenya Main Warehouse";
	const rawWh = "Peenya Raw Material Store";
	const fgWh = "Electronic City Finished Goods";
	const qcWh = "Whitefield QC Hold Area";
	const rejWh = "Whitefield Rejected Goods";
	const chennaiWh = "Ambattur Distribution Centre";
	const hydWh = "Patancheru Warehouse";

	// Categorise items
	const stockItems = ITEMS.filter((i) => i.maintainStock);
	const batchItems = ITEMS.filter((i) => i.hasBatchNo);
	const serialItems = ITEMS.filter((i) => i.hasSerialNo);

	// ────────────────────────────────────────────────────────────
	// 1. Purchase Orders
	// ────────────────────────────────────────────────────────────
	const poCount = scaled(8, config);
	const poDates = spreadDates(poCount, config);
	const purchaseOrderIds: string[] = [];

	for (let i = 0; i < poCount; i++) {
		const supplier = pick(SUPPLIERS);
		const lineItems = pickN(stockItems, randomInt(3, 6));
		const series = nextSeries("MAT-PO", poC, year);
		const po = await prisma.purchaseOrder.create({
			data: {
				series,
				transactionDate: poDates[i],
				supplier,
				company: config.company,
				status: i < poCount - 2 ? "COMPLETED" : "TO_RECEIVE_AND_BILL",
				conversionRate: 1,
				setWarehouse: mainWh,
				items: {
					create: lineItems.map((item) => {
						const qty = randomInt(20, 200);
						const lead = item.leadTimeDays ?? 7;
						return {
							itemCode: item.code,
							itemName: item.name,
							requiredDate: new Date(poDates[i].getTime() + lead * 86400000),
							qty,
							receivedQty: i < poCount - 2 ? qty : 0,
							rate: item.valuationRate,
							baseRate: item.valuationRate,
							amount: qty * item.valuationRate,
							baseAmount: qty * item.valuationRate,
							warehouse: mainWh,
						};
					}),
				},
			},
		});
		purchaseOrderIds.push(po.id);
	}

	// ────────────────────────────────────────────────────────────
	// 2. Purchase Receipts (goods received)
	// ────────────────────────────────────────────────────────────
	const prCount = scaled(10, config);
	const prDates = spreadDates(prCount, config);
	const purchaseReceiptIds: string[] = [];

	for (let i = 0; i < prCount; i++) {
		const supplier = pick(SUPPLIERS);
		const lineItems = pickN(stockItems, randomInt(2, 5));
		const series = nextSeries("MAT-PRE", prC, year);

		let totalQty = 0;
		let totalAmt = 0;
		const itemsData = lineItems.map((item) => {
			const qty = randomInt(10, 150);
			const rejQty = Math.random() < 0.1 ? randomInt(1, 3) : 0;
			const accQty = qty - rejQty;
			totalQty += qty;
			totalAmt += accQty * item.valuationRate;
			return {
				itemCode: item.code,
				itemName: item.name,
				acceptedQuantity: accQty,
				rejectedQuantity: rejQty,
				rate: item.valuationRate,
				amount: accQty * item.valuationRate,
				uom: item.uom,
				acceptedWarehouse: mainWh,
				rejectedWarehouse: rejQty > 0 ? rejWh : null,
			};
		});

		const gst = totalAmt * 0.18;
		const pr = await prisma.purchaseReceipt.create({
			data: {
				series,
				postingDate: prDates[i],
				supplier,
				company: config.company,
				status: i < prCount - 1 ? "COMPLETED" : "DRAFT",
				acceptedWarehouse: mainWh,
				rejectedWarehouse: rejWh,
				totalQuantity: totalQty,
				totalAcceptedQuantity: itemsData.reduce(
					(s, x) => s + x.acceptedQuantity,
					0,
				),
				totalRejectedQuantity: itemsData.reduce(
					(s, x) => s + x.rejectedQuantity,
					0,
				),
				totalAmount: totalAmt,
				taxesAndChargesAdded: gst,
				totalTaxesAndCharges: gst,
				grandTotal: totalAmt + gst,
				currency: config.currency,
				items: { create: itemsData },
				taxes: {
					create: [
						{
							type: "On Net Total",
							accountHead: "CGST - PE",
							taxRate: 9,
							amount: gst / 2,
							total: totalAmt + gst / 2,
						},
						{
							type: "On Net Total",
							accountHead: "SGST - PE",
							taxRate: 9,
							amount: gst / 2,
							total: totalAmt + gst,
						},
					],
				},
			},
		});
		purchaseReceiptIds.push(pr.id);
	}

	// ────────────────────────────────────────────────────────────
	// 3. Stock Entries
	// ────────────────────────────────────────────────────────────
	const seCount = scaled(15, config);
	const seDates = spreadDates(seCount, config);
	const stockEntryIds: string[] = [];

	const entryTypes: Array<{
		type:
			| "MATERIAL_RECEIPT"
			| "MATERIAL_ISSUE"
			| "MATERIAL_TRANSFER"
			| "MANUFACTURE"
			| "REPACK";
		source: string | null;
		target: string | null;
	}> = [
		{ type: "MATERIAL_RECEIPT", source: null, target: mainWh },
		{ type: "MATERIAL_RECEIPT", source: null, target: rawWh },
		{ type: "MATERIAL_TRANSFER", source: mainWh, target: fgWh },
		{ type: "MATERIAL_TRANSFER", source: mainWh, target: chennaiWh },
		{ type: "MATERIAL_TRANSFER", source: mainWh, target: hydWh },
		{ type: "MATERIAL_TRANSFER", source: rawWh, target: mainWh },
		{ type: "MATERIAL_ISSUE", source: mainWh, target: null },
		{ type: "MANUFACTURE", source: rawWh, target: fgWh },
		{ type: "REPACK", source: mainWh, target: mainWh },
	];

	for (let i = 0; i < seCount; i++) {
		const et = entryTypes[i % entryTypes.length];
		const lineItems = pickN(stockItems, randomInt(2, 4));
		const series = nextSeries("MAT-STE", seC, year);

		const se = await prisma.stockEntry.create({
			data: {
				series,
				stockEntryType: et.type,
				postingDate: seDates[i],
				company: config.company,
				status: i < seCount - 2 ? "SUBMITTED" : "DRAFT",
				defaultSourceWarehouse: et.source,
				defaultTargetWarehouse: et.target,
				remarks: `Demo stock entry — ${et.type.toLowerCase().replace(/_/g, " ")}`,
				items: {
					create: lineItems.map((item) => {
						const qty = randomInt(5, 80);
						return {
							sourceWarehouse: et.source,
							targetWarehouse: et.target,
							itemCode: item.code,
							itemName: item.name,
							qty,
							basicRate: item.valuationRate,
							basicAmount: qty * item.valuationRate,
							unitOfMeasure: item.uom,
						};
					}),
				},
			},
		});
		stockEntryIds.push(se.id);
	}

	// ────────────────────────────────────────────────────────────
	// 4. Sales Orders
	// ────────────────────────────────────────────────────────────
	const soCount = scaled(10, config);
	const soDates = spreadDates(soCount, config);
	const salesOrderIds: string[] = [];

	for (let i = 0; i < soCount; i++) {
		const customer = pick(CUSTOMERS);
		const lineItems = pickN(stockItems, randomInt(2, 5));
		const series = nextSeries("MAT-SO", soC, year);

		const isCompleted = i < soCount - 3;
		const so = await prisma.salesOrder.create({
			data: {
				series,
				transactionDate: soDates[i],
				customer,
				company: config.company,
				status: isCompleted
					? "COMPLETED"
					: i < soCount - 1
						? "TO_DELIVER_AND_BILL"
						: "DRAFT",
				conversionRate: 1,
				items: {
					create: lineItems.map((item) => {
						const qty = randomInt(5, 50);
						const delivDate = new Date(soDates[i].getTime() + 7 * 86400000);
						return {
							itemCode: item.code,
							itemName: item.name,
							deliveryDate: delivDate,
							qty,
							deliveredQty: isCompleted ? qty : 0,
							rate: item.sellingRate,
							baseRate: item.sellingRate,
							amount: qty * item.sellingRate,
							baseAmount: qty * item.sellingRate,
							warehouse: fgWh,
						};
					}),
				},
			},
		});
		salesOrderIds.push(so.id);
	}

	// ────────────────────────────────────────────────────────────
	// 5. Material Requests
	// ────────────────────────────────────────────────────────────
	const mrCount = scaled(6, config);
	const mrDates = spreadDates(mrCount, config);

	const mrPurposes: Array<
		"PURCHASE" | "MATERIAL_TRANSFER" | "MATERIAL_ISSUE" | "MANUFACTURE"
	> = [
		"PURCHASE",
		"PURCHASE",
		"MATERIAL_TRANSFER",
		"MATERIAL_ISSUE",
		"MANUFACTURE",
		"PURCHASE",
	];

	for (let i = 0; i < mrCount; i++) {
		const purpose = mrPurposes[i % mrPurposes.length];
		const lineItems = pickN(stockItems, randomInt(2, 4));
		const series = nextSeries("MAT-MR", mrC, year);

		await prisma.materialRequest.create({
			data: {
				series,
				transactionDate: mrDates[i],
				purpose,
				company: config.company,
				status:
					i < mrCount - 2 ? "ORDERED" : i === mrCount - 1 ? "DRAFT" : "PENDING",
				requiredBy: new Date(mrDates[i].getTime() + 14 * 86400000),
				targetWarehouse: purpose === "MATERIAL_TRANSFER" ? fgWh : mainWh,
				items: {
					create: lineItems.map((item) => ({
						itemCode: item.code,
						itemName: item.name,
						quantity: randomInt(10, 100),
						unitOfMeasure: item.uom,
						targetWarehouse: mainWh,
						requiredBy: new Date(mrDates[i].getTime() + 14 * 86400000),
					})),
				},
			},
		});
	}

	// ────────────────────────────────────────────────────────────
	// 6. Delivery Notes
	// ────────────────────────────────────────────────────────────
	const dnCount = scaled(8, config);
	const dnDates = spreadDates(dnCount, config);
	const deliveryNoteIds: string[] = [];
	const deliveryNoteSeries: string[] = [];

	for (let i = 0; i < dnCount; i++) {
		const customer = pick(CUSTOMERS);
		const [custName, custCity = "Bengaluru"] = customer.split(", ");
		const lineItems = pickN(stockItems, randomInt(2, 4));
		const series = nextSeries("MAT-DN", dnC, year);

		let totalQty = 0;
		let totalAmt = 0;
		const itemsData = lineItems.map((item) => {
			const qty = randomInt(3, 30);
			totalQty += qty;
			totalAmt += qty * item.sellingRate;
			return {
				itemCode: item.code,
				itemName: item.name,
				quantity: qty,
				uom: item.uom,
				rate: item.sellingRate,
				amount: qty * item.sellingRate,
				warehouse: fgWh,
			};
		});

		const status =
			i < dnCount - 2
				? ("COMPLETED" as const)
				: i === dnCount - 1
					? ("DRAFT" as const)
					: ("TO_BILL" as const);
		const dn = await prisma.deliveryNote.create({
			data: {
				series,
				postingDate: dnDates[i],
				customer,
				company: config.company,
				status,
				currency: config.currency,
				sourceWarehouse: fgWh,
				totalQuantity: totalQty,
				totalAmount: totalAmt,
				grandTotal: totalAmt,
				shippingAddress: `${custName}, ${custCity}`,
				companyAddress:
					"Pivotr Electronics, Peenya Industrial Area, Bengaluru 560058",
				items: { create: itemsData },
			},
		});
		deliveryNoteIds.push(dn.id);
		deliveryNoteSeries.push(series);
	}

	// ────────────────────────────────────────────────────────────
	// 7. Batches
	// ────────────────────────────────────────────────────────────
	const batchCount = scaled(12, config);
	const batchDates = spreadDates(batchCount, config);
	const batchIds: string[] = [];

	for (let i = 0; i < batchCount; i++) {
		const item = batchItems[i % batchItems.length];
		const invId = ids.inventoryItemIds.get(item.code);
		const whId = ids.warehouseIds.get(i % 3 === 0 ? rawWh : mainWh);
		if (!invId) continue;

		bC.val++;
		const batchId = `BATCH-${item.code}-${zeroPad(bC.val, 4)}`;
		const mfgDate = batchDates[i];
		const expiryDate = item.shelfLifeInDays
			? new Date(mfgDate.getTime() + item.shelfLifeInDays * 86400000)
			: null;

		// Link to a purchase receipt if available
		const prId =
			i < purchaseReceiptIds.length
				? purchaseReceiptIds[i % purchaseReceiptIds.length]
				: null;

		const batch = await prisma.batch.create({
			data: {
				batchId,
				itemId: invId,
				company: config.company,
				currentWarehouseId: whId ?? null,
				manufacturingDate: mfgDate,
				expiryDate,
				quantity: randomInt(20, 200),
				purchaseReceiptId: prId,
				description: `${item.name} — manufactured ${mfgDate.toISOString().slice(0, 10)}`,
			},
		});
		batchIds.push(batch.id);
	}

	// ────────────────────────────────────────────────────────────
	// 8. Serial Numbers + History
	// ────────────────────────────────────────────────────────────
	const snCount = scaled(15, config);

	for (let i = 0; i < snCount; i++) {
		const item = serialItems[i % serialItems.length];
		const invId = ids.inventoryItemIds.get(item.code);
		if (!invId) continue;

		snC.val++;
		const serialNo = `SN-${item.code}-${zeroPad(snC.val, 5)}`;

		// Lifecycle story: most are AVAILABLE, some DELIVERED, a few INSTALLED
		let status: "AVAILABLE" | "DELIVERED" | "INSTALLED" | "RETURNED";
		let currentWhId: string | null;
		let dnId: string | null = null;

		if (i < snCount * 0.5) {
			status = "AVAILABLE";
			currentWhId = ids.warehouseIds.get(i % 2 === 0 ? mainWh : fgWh) ?? null;
		} else if (i < snCount * 0.8) {
			status = "DELIVERED";
			currentWhId = null;
			dnId =
				deliveryNoteIds.length > 0
					? deliveryNoteIds[i % deliveryNoteIds.length]
					: null;
		} else if (i < snCount * 0.95) {
			status = "INSTALLED";
			currentWhId = null;
			dnId =
				deliveryNoteIds.length > 0
					? deliveryNoteIds[i % deliveryNoteIds.length]
					: null;
		} else {
			status = "RETURNED";
			currentWhId = ids.warehouseIds.get(qcWh) ?? null;
		}

		const purchaseDate = new Date(
			config.dateRange.from.getTime() +
				Math.random() *
					(config.dateRange.to.getTime() - config.dateRange.from.getTime()) *
					0.5,
		);
		const warrantyExpiry = item.warrantyPeriodInDays
			? new Date(purchaseDate.getTime() + item.warrantyPeriodInDays * 86400000)
			: null;
		const serviceExpiry = item.warrantyPeriodInDays
			? new Date(
					purchaseDate.getTime() + (item.warrantyPeriodInDays + 365) * 86400000,
				)
			: null;

		const prId =
			purchaseReceiptIds.length > 0
				? purchaseReceiptIds[i % purchaseReceiptIds.length]
				: null;

		const sn = await prisma.serialNo.create({
			data: {
				serialNo,
				itemId: invId,
				company: config.company,
				status,
				currentWarehouseId: currentWhId,
				purchaseDate,
				warrantyExpiryDate: warrantyExpiry,
				serviceContractExpiryDate: serviceExpiry,
				purchaseReceiptId: prId,
				deliveryNoteId: dnId,
				notes:
					status === "RETURNED"
						? "Returned by customer — pending QC inspection"
						: null,
			},
		});

		// Create history entries
		await prisma.serialNoHistory.create({
			data: {
				serialNoId: sn.id,
				eventType: "CREATED",
				toStatus: "AVAILABLE",
				warehouseId: ids.warehouseIds.get(mainWh) ?? null,
				transactionLabel: `Created via purchase receipt`,
			},
		});

		if (status !== "AVAILABLE") {
			await prisma.serialNoHistory.create({
				data: {
					serialNoId: sn.id,
					eventType: "STATUS_CHANGED",
					fromStatus: "AVAILABLE",
					toStatus: status,
					transactionLabel:
						status === "DELIVERED"
							? "Shipped to customer"
							: status === "INSTALLED"
								? "Installed at customer site"
								: "Returned from customer",
				},
			});
		}
	}

	// ────────────────────────────────────────────────────────────
	// 9. Pick Lists
	// ────────────────────────────────────────────────────────────
	const plCount = scaled(5, config);

	for (let i = 0; i < plCount; i++) {
		const lineItems = pickN(stockItems, randomInt(2, 4));
		const series = nextSeries("STO-PICK", plC, year);

		const isCompleted = i < plCount - 1;
		await prisma.pickList.create({
			data: {
				series,
				status: isCompleted ? "COMPLETED" : "OPEN",
				company: config.company,
				customer: pick(CUSTOMERS),
				purpose: "DELIVERY",
				warehouse: fgWh,
				items: {
					create: lineItems.map((item) => {
						const qty = randomInt(3, 20);
						return {
							item: item.code,
							warehouse: fgWh,
							qty,
							stockQty: qty,
							pickedQty: isCompleted ? qty : randomFloat(0, qty, 0),
						};
					}),
				},
			},
		});
	}

	// ────────────────────────────────────────────────────────────
	// 10. Packing Slips (for completed delivery notes)
	// ────────────────────────────────────────────────────────────
	const packableDNs = deliveryNoteIds.slice(
		0,
		Math.min(scaled(4, config), deliveryNoteIds.length),
	);
	let caseNo = 0;

	for (const dnId of packableDNs) {
		const dn = await prisma.deliveryNote.findUnique({
			where: { id: dnId },
			include: { items: true },
		});
		if (!dn || dn.items.length === 0) continue;

		caseNo++;
		const series = nextSeries("MAT-PAC", psC, year);

		let netWeight = 0;
		const psItems = dn.items.map((dni) => {
			const itemDef = ITEMS.find((it) => it.code === dni.itemCode);
			const weight = (itemDef?.weightPerUnit ?? 0.1) * dni.quantity;
			netWeight += weight;
			return {
				deliveryNoteItemId: dni.id,
				itemCode: dni.itemCode,
				itemName: dni.itemName ?? "",
				qty: dni.quantity,
				netWeight: weight,
				weightUom: "Kg",
			};
		});

		await prisma.packingSlip.create({
			data: {
				series,
				status: "SUBMITTED",
				deliveryNoteId: dnId,
				fromCaseNo: caseNo,
				toCaseNo: caseNo,
				netWeightPkg: Math.round(netWeight * 100) / 100,
				netWeightUom: "Kg",
				grossWeightPkg: Math.round(netWeight * 1.15 * 100) / 100,
				grossWeightUom: "Kg",
				items: { create: psItems },
			},
		});
	}

	// ────────────────────────────────────────────────────────────
	// 11. Delivery Trips
	// ────────────────────────────────────────────────────────────
	const dtCount = scaled(4, config);
	const dtDates = spreadDates(dtCount, config);

	for (let i = 0; i < dtCount; i++) {
		const driver = DRIVERS[i % DRIVERS.length];
		const series = nextSeries("MAT-DT", dtC, year);
		const stopCount = randomInt(2, 4);

		const stops = Array.from({ length: stopCount }, (_, idx) => ({
			stopNumber: idx + 1,
			customer: pick(CUSTOMERS).split(",")[0],
			addressName: `${pick(["MG Road", "Brigade Road", "Indiranagar", "Koramangala", "Whitefield", "Electronic City", "Jayanagar", "Malleshwaram"])}, Bengaluru`,
			deliveryNote:
				idx < deliveryNoteSeries.length
					? deliveryNoteSeries[idx % deliveryNoteSeries.length]
					: null,
			estimatedArrival: new Date(dtDates[i].getTime() + (idx + 1) * 3600000),
		}));

		const status =
			i < dtCount - 1
				? i < dtCount - 2
					? ("COMPLETED" as const)
					: ("IN_TRANSIT" as const)
				: ("SCHEDULED" as const);

		await prisma.deliveryTrip.create({
			data: {
				series,
				status,
				company: config.company,
				driver: driver.name,
				driverAddress: driver.address,
				vehicle: VEHICLES[i % VEHICLES.length],
				departureTime: dtDates[i],
				stops: { create: stops },
			},
		});
	}

	// ────────────────────────────────────────────────────────────
	// 12. Installation Notes
	// ────────────────────────────────────────────────────────────
	const instCount = scaled(4, config);
	const instDates = spreadDates(instCount, config);

	// Get serialised inventory items that are "INSTALLED"
	const installedSerials = await prisma.serialNo.findMany({
		where: { status: "INSTALLED", company: config.company },
		take: instCount * 2,
	});

	for (let i = 0; i < instCount; i++) {
		const customer = pick(CUSTOMERS);
		const [custName, custCity = "Bengaluru"] = customer.split(", ");
		const series = nextSeries("MAT-INS", inC, year);
		const dnId =
			deliveryNoteIds.length > 0
				? deliveryNoteIds[i % deliveryNoteIds.length]
				: null;

		// Take up to 2 installed serials for this note
		const serials = installedSerials.splice(
			0,
			Math.min(2, installedSerials.length),
		);

		const instItems = serials.map((sn) => ({
			itemId: sn.itemId,
			serialNoId: sn.id,
			installedQty: 1,
			description: `Installed at customer site — ${customer.split(",")[0]}`,
		}));

		// If no serials, skip
		if (instItems.length === 0) continue;

		await prisma.installationNote.create({
			data: {
				series,
				installationDate: instDates[i],
				installationTime: `${zeroPad(9 + (i % 8), 2)}:${zeroPad((i * 15) % 60, 2)}:00`,
				customer: custName,
				customerName: customer,
				customerAddress: `${custName}, ${custCity}, India`,
				territory: "South India",
				company: config.company,
				status: i < instCount - 1 ? "COMPLETED" : "IN_PROGRESS",
				deliveryNoteId: dnId,
				remarks: `On-site installation for ${customer.split(",")[0]}`,
				items: { create: instItems },
			},
		});
	}

	// ────────────────────────────────────────────────────────────
	// 13. Subcontracting Orders
	// ────────────────────────────────────────────────────────────
	const scoCount = scaled(3, config);
	const scoDates = spreadDates(scoCount, config);

	for (let i = 0; i < scoCount; i++) {
		const supplier = pick(SUPPLIERS);
		const series = nextSeries("MAT-SCO", scoC, year);

		// Assembly items as finished goods
		const assemblyItems = ITEMS.filter(
			(it) => it.group === "Custom Assemblies",
		);
		const fgItem = assemblyItems[i % assemblyItems.length];
		const fgQty = randomInt(5, 20);
		const received = i < scoCount - 1 ? fgQty : 0;

		// Raw materials needed
		const rawItems = pickN(
			ITEMS.filter(
				(it) =>
					it.group === "Passive Components" ||
					it.group === "PCB & Circuit Boards",
			),
			randomInt(2, 3),
		);

		await prisma.subcontractingOrder.create({
			data: {
				series,
				transactionDate: scoDates[i],
				supplier,
				company: config.company,
				status:
					i < scoCount - 1
						? received === fgQty
							? "COMPLETED"
							: "PARTIALLY_RECEIVED"
						: "OPEN",
				percentReceived: fgQty > 0 ? (received / fgQty) * 100 : 0,
				items: {
					create: [
						{
							itemCode: fgItem.code,
							itemName: fgItem.name,
							qty: fgQty,
							receivedQty: received,
						},
					],
				},
				suppliedItems: {
					create: rawItems.map((rm) => {
						const rmMultiplier = randomInt(5, 20);
						const reqQty = fgQty * rmMultiplier;
						return {
							rmItemCode: rm.code,
							rmItemName: rm.name,
							requiredQty: reqQty,
							suppliedQty: i < scoCount - 1 ? reqQty : 0,
							returnedQty: 0,
						};
					}),
				},
			},
		});
	}

	// ────────────────────────────────────────────────────────────
	// 14. Asset Management Transaction Story
	// ────────────────────────────────────────────────────────────
	await seedAssetTransactions(prisma, config, ids, depreciation);
}
