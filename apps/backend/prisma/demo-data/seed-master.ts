/**
 * Demo Data — Master Data Seeder
 *
 * Seeds all master / reference data in dependency order:
 *  1. UOM (already seeded by app startup — we ensure)
 *  2. Brands
 *  3. Item Groups (recursive)
 *  4. Item Attributes + Values
 *  5. Items (Item table — for product bundles, alternatives, manufacturers)
 *  6. Inventory Items (InventoryItem table — main stock items)
 *  7. Item Barcodes, Item Reorder settings
 *  8. Manufacturers, Alternatives, Product Bundles
 *  9. Warehouses (recursive)
 * 10. QI Parameter Groups, Parameters, Templates
 * 11. Shipping Rules
 * 12. Stock Settings, Item Variant Settings
 */

import type { PrismaService } from "../../src/shared/prisma.service.js";
import type { DemoConfig } from "./config.js";
import {
	BRANDS,
	ITEM_ATTRIBUTES,
	ITEM_GROUPS,
	ITEMS,
	type ItemGroupDef,
	MANUFACTURERS,
	QI_TEMPLATES,
	SHIPPING_RULES,
	WAREHOUSES,
	type WarehouseDef,
} from "./data.js";
import { zeroPad } from "./helpers.js";
import { seedAssetMasterData } from "./seed-asset-master.js";
import { seedFiscalYearData } from "./seed-fiscal-year.js";

/** IDs collected during seeding, passed to transaction seeder */
export interface MasterIds {
	brandIds: Map<string, string>;
	itemGroupIds: Map<string, string>;
	attributeIds: Map<string, string>;
	/** Item table IDs (for product bundles, alternatives) */
	itemIds: Map<string, string>;
	/** InventoryItem table IDs (for stock, batches, serial nos) */
	inventoryItemIds: Map<string, string>;
	uomIds: Map<string, string>;
	warehouseIds: Map<string, string>;
	qiTemplateIds: Map<string, string>;
	qiParameterIds: Map<string, string>;
	assetLocationIds: Map<string, string>;
	assetCategoryIds: Map<string, string>;
	assetMaintenanceTeamIds: Map<string, string>;
	assetIds: Map<string, string>;
}

export async function seedMasterData(
	prisma: PrismaService,
	config: DemoConfig,
): Promise<MasterIds> {
	const ids: MasterIds = {
		brandIds: new Map(),
		itemGroupIds: new Map(),
		attributeIds: new Map(),
		itemIds: new Map(),
		inventoryItemIds: new Map(),
		uomIds: new Map(),
		warehouseIds: new Map(),
		qiTemplateIds: new Map(),
		qiParameterIds: new Map(),
		assetLocationIds: new Map(),
		assetCategoryIds: new Map(),
		assetMaintenanceTeamIds: new Map(),
		assetIds: new Map(),
	};

	// ── 1. Ensure UOMs exist and collect their IDs ────────────────
	const existingUoms = await prisma.unitOfMeasurement.findMany();
	for (const u of existingUoms) {
		ids.uomIds.set(u.name, u.id);
	}
	// If core UOMs missing, create the ones our items need
	const requiredUoms = [...new Set(ITEMS.map((i) => i.uom))];
	for (const uomName of requiredUoms) {
		if (!ids.uomIds.has(uomName)) {
			const created = await prisma.unitOfMeasurement.create({
				data: { name: uomName, disabled: false, isWholeNumber: true },
			});
			ids.uomIds.set(uomName, created.id);
		}
	}
	// Also ensure Kg for weights
	if (!ids.uomIds.has("Kg")) {
		const existing = existingUoms.find((u) => u.name.toLowerCase() === "kg");
		if (existing) {
			ids.uomIds.set("Kg", existing.id);
		} else {
			const created = await prisma.unitOfMeasurement.create({
				data: { name: "Kg", disabled: false, isWholeNumber: false },
			});
			ids.uomIds.set("Kg", created.id);
		}
	}

	// ── 2. Brands ─────────────────────────────────────────────────
	for (const b of BRANDS) {
		const brand = await prisma.brand.create({
			data: { name: b.name, description: b.description },
		});
		ids.brandIds.set(b.name, brand.id);
	}

	// ── 3. Item Groups (recursive) ────────────────────────────────
	async function createGroups(groups: ItemGroupDef[], parentId: string | null) {
		for (const g of groups) {
			const grp = await prisma.itemGroup.create({
				data: {
					groupName: g.name,
					isGroup: g.isGroup,
					parentId,
				},
			});
			ids.itemGroupIds.set(g.name, grp.id);
			if (g.children) {
				await createGroups(g.children, grp.id);
			}
		}
	}
	await createGroups(ITEM_GROUPS, null);

	// ── 4. Item Attributes + Values ───────────────────────────────
	for (const attr of ITEM_ATTRIBUTES) {
		const created = await prisma.itemAttribute.create({
			data: {
				name: attr.name,
				disabled: false,
				numericValues: false,
				attributeValues: {
					create: attr.values.map((v, idx) => ({
						attributeValue: v.value,
						abbreviation: v.abbreviation,
						position: idx,
					})),
				},
			},
		});
		ids.attributeIds.set(attr.name, created.id);
	}

	// ── 5. Items (Item table — for product bundles, alternatives) ─
	for (const item of ITEMS) {
		const groupId = ids.itemGroupIds.get(item.group);
		const brandId = ids.brandIds.get(item.brand);
		const uomId = ids.uomIds.get(item.uom);

		const created = await prisma.item.create({
			data: {
				name: item.name,
				code: item.code,
				description: item.description,
				itemGroupId: groupId ?? null,
				brandId: brandId ?? null,
				defaultUnitOfMeasureId: uomId ?? null,
				disabled: false,
				maintainStock: item.maintainStock,
				valuationRate: item.valuationRate,
				standardSellingRate: item.sellingRate,
				openingStock: 0,
			},
		});
		ids.itemIds.set(item.code, created.id);
	}

	// ── 6. InventoryItem table (main stock tracking) ──────────────
	for (const item of ITEMS) {
		const groupId = ids.itemGroupIds.get(item.group);
		const uomId = ids.uomIds.get(item.uom);

		const created = await prisma.inventoryItem.create({
			data: {
				name: item.name,
				code: item.code,
				description: item.description,
				itemGroupId: groupId ?? null,
				defaultUnitOfMeasureId: uomId ?? null,
				disabled: false,
				maintainStock: item.maintainStock,
				hasBatchNo: item.hasBatchNo,
				hasSerialNo: item.hasSerialNo,
				valuationRate: item.valuationRate,
				standardSellingRate: item.sellingRate,
				openingStock: 0,
				quantity: 0,
				weightPerUnit: item.weightPerUnit ?? null,
				weightUom: item.weightPerUnit ? "Kg" : null,
				safetyStock: item.safetyStock ?? 0,
				leadTimeDays: item.leadTimeDays ?? 0,
				shelfLifeInDays: item.shelfLifeInDays ?? null,
				warrantyPeriodInDays: item.warrantyPeriodInDays ?? null,
				allowNegativeStock: false,
				valuationMethod: "FIFO",
			},
		});
		ids.inventoryItemIds.set(item.code, created.id);
	}

	// ── 7. Item Barcodes ──────────────────────────────────────────
	for (const item of ITEMS) {
		const invId = ids.inventoryItemIds.get(item.code);
		if (!invId) continue;
		await prisma.itemBarcode.create({
			data: {
				itemId: invId,
				barcode: `899${item.code.replace(/[^A-Z0-9]/g, "")}${zeroPad(Math.floor(Math.random() * 10000), 4)}`,
				barcodeType: "EAN",
			},
		});
	}

	// ── 7b. Item Reorder settings ─────────────────────────────────
	const mainWarehouseName = "Peenya Main Warehouse";
	// We'll set reorder after warehouses are created. Store for later.
	const reorderItems = ITEMS.filter((i) => i.safetyStock && i.safetyStock > 0);

	// ── 8a. Item Manufacturers ────────────────────────────────────
	let mfgIdx = 0;
	for (const item of ITEMS) {
		const itemId = ids.itemIds.get(item.code);
		if (!itemId) continue;
		const mfg = MANUFACTURERS[mfgIdx % MANUFACTURERS.length];
		await prisma.itemManufacturer.create({
			data: {
				itemId,
				manufacturer: mfg.name,
				manufacturerPartNumber: `${mfg.partPrefix}-${item.code}`,
				isDefault: true,
			},
		});
		mfgIdx++;
	}

	// ── 8b. Item Alternatives ─────────────────────────────────────
	// Pair items within the same group as alternatives
	const groupedItems = new Map<string, string[]>();
	for (const item of ITEMS) {
		const codes = groupedItems.get(item.group) ?? [];
		codes.push(item.code);
		groupedItems.set(item.group, codes);
	}
	for (const [, codes] of groupedItems) {
		if (codes.length >= 2) {
			const id1 = ids.itemIds.get(codes[0]);
			const id2 = ids.itemIds.get(codes[1]);
			if (id1 && id2) {
				await prisma.itemAlternate.create({
					data: { itemId: id1, alternateItemId: id2 },
				});
			}
		}
	}

	// ── 8c. Product Bundles ───────────────────────────────────────
	// IoT Starter Kit bundle
	const kitId = ids.itemIds.get("KIT-IOT-STRT");
	if (kitId) {
		const bundleItems = [
			{ code: "IOT-ESP32-01", qty: 1 },
			{ code: "SEN-HUMD-01", qty: 1 },
			{ code: "DIS-OLED-128", qty: 1 },
			{ code: "CON-USB-C-01", qty: 1 },
			{ code: "CBL-RIBBON-20", qty: 2 },
		];
		await prisma.productBundle.create({
			data: {
				parentItemId: kitId,
				description: "Pivotr IoT Starter Kit v3 — bundled components",
				disabled: false,
				bundleItems: {
					create: bundleItems
						.map((bi) => {
							const itemId = ids.itemIds.get(bi.code);
							if (!itemId) return null;
							return {
								itemId,
								quantity: bi.qty,
								description: ITEMS.find((i) => i.code === bi.code)?.name ?? "",
							};
						})
						.filter(Boolean) as {
						itemId: string;
						quantity: number;
						description: string;
					}[],
				},
			},
		});
	}

	// LoRa Gateway Kit bundle
	const loraKitId = ids.itemIds.get("KIT-LORA-GW");
	if (loraKitId) {
		const bundleItems = [
			{ code: "IOT-LORA-01", qty: 4 },
			{ code: "IOT-4G-01", qty: 1 },
			{ code: "ENC-IP67-01", qty: 1 },
			{ code: "PWR-SMPS-12V5A", qty: 1 },
			{ code: "CON-RJ45-01", qty: 2 },
		];
		await prisma.productBundle.create({
			data: {
				parentItemId: loraKitId,
				description:
					"Pivotr LoRa Gateway Kit — complete gateway + sensor nodes",
				disabled: false,
				bundleItems: {
					create: bundleItems
						.map((bi) => {
							const itemId = ids.itemIds.get(bi.code);
							if (!itemId) return null;
							return {
								itemId,
								quantity: bi.qty,
								description: ITEMS.find((i) => i.code === bi.code)?.name ?? "",
							};
						})
						.filter(Boolean) as {
						itemId: string;
						quantity: number;
						description: string;
					}[],
				},
			},
		});
	}

	// ── 9. Warehouses (recursive) ─────────────────────────────────
	async function createWarehouses(
		defs: WarehouseDef[],
		parentId: string | null,
	) {
		for (const w of defs) {
			const wh = await prisma.warehouse.upsert({
				where: { name: w.name },
				create: {
					name: w.name,
					disabled: false,
					isGroupWarehouse: w.isGroup,
					parentWarehouseId: parentId,
					company: config.company,
					warehouseType: w.warehouseType ?? null,
					city: w.city ?? null,
					state: w.state ?? null,
					pin: w.pin ?? null,
					addressLine1: w.addressLine1 ?? null,
					isRejectedWarehouse: w.isRejected ?? false,
				},
				update: {
					disabled: false,
					isGroupWarehouse: w.isGroup,
					parentWarehouseId: parentId,
					company: config.company,
					warehouseType: w.warehouseType ?? null,
					city: w.city ?? null,
					state: w.state ?? null,
					pin: w.pin ?? null,
					addressLine1: w.addressLine1 ?? null,
					isRejectedWarehouse: w.isRejected ?? false,
				},
			});
			ids.warehouseIds.set(w.name, wh.id);
			if (w.children) {
				await createWarehouses(w.children, wh.id);
			}
		}
	}
	await createWarehouses(WAREHOUSES, null);

	// Set transit warehouse reference
	const bangaloreGroupId = ids.warehouseIds.get("Pivotr Bangalore");
	const transitId = ids.warehouseIds.get("In Transit - Bangalore");
	if (bangaloreGroupId && transitId) {
		await prisma.warehouse.update({
			where: { id: bangaloreGroupId },
			data: { defaultInTransitWarehouseId: transitId },
		});
	}

	// ── 7b (continued). Item Reorder — now warehouses exist ───────
	const mainWhId = ids.warehouseIds.get(mainWarehouseName);
	if (mainWhId) {
		for (const item of reorderItems) {
			const invId = ids.inventoryItemIds.get(item.code);
			if (!invId) continue;
			await prisma.itemReorder.create({
				data: {
					itemId: invId,
					warehouse: mainWarehouseName,
					reorderLevel: (item.safetyStock ?? 10) * 0.5,
					reorderQty: item.safetyStock ?? 10,
					materialRequestType: "Purchase",
				},
			});
		}
	}

	// ── 10. QI Parameter Groups, Parameters, Templates ────────────
	const paramGroupIds = new Map<string, string>();
	const allGroups = new Set<string>();
	for (const t of QI_TEMPLATES) {
		for (const p of t.parameters) {
			allGroups.add(p.group);
		}
	}
	for (const gName of allGroups) {
		const pg = await prisma.qiParameterGroup.create({
			data: { name: gName },
		});
		paramGroupIds.set(gName, pg.id);
	}

	const paramIds = new Map<string, string>();
	const allParams = new Set<string>();
	for (const t of QI_TEMPLATES) {
		for (const p of t.parameters) {
			allParams.add(`${p.name}|${p.group}`);
		}
	}
	for (const key of allParams) {
		const [name, group] = key.split("|");
		const p = await prisma.qiParameter.create({
			data: {
				parameter: name,
				groupId: paramGroupIds.get(group) ?? null,
			},
		});
		paramIds.set(name, p.id);
		ids.qiParameterIds.set(name, p.id);
	}

	for (const t of QI_TEMPLATES) {
		const template = await prisma.qiTemplate.create({
			data: {
				name: t.name,
				items: {
					create: t.parameters.map((p, idx) => {
						const pId = paramIds.get(p.name);
						if (!pId)
							throw new Error(
								`QI parameter "${p.name}" not found in paramIds map`,
							);
						return {
							parameterId: pId,
							sortOrder: idx,
							numeric: p.numeric,
							formulaBased: false,
							minValue: p.minValue ?? null,
							maxValue: p.maxValue ?? null,
							value: p.value ?? null,
						};
					}),
				},
			},
		});
		ids.qiTemplateIds.set(t.name, template.id);
	}

	// ── 11. Shipping Rules ────────────────────────────────────────
	for (const sr of SHIPPING_RULES) {
		await prisma.shippingRule.create({
			data: {
				shippingRuleLabel: sr.label,
				shippingRuleType: sr.type,
				calculateBasedOn: sr.calcType,
				shippingAmount: sr.amount,
				disabled: false,
			},
		});
	}

	// ── 12. Stock Settings (singleton) ────────────────────────────
	await prisma.stockSettings.upsert({
		where: { singletonKey: "default" },
		update: {
			itemNamingBy: "ITEM_CODE",
			defaultWarehouse: mainWarehouseName,
			defaultValuationMethod: "FIFO",
			defaultStockUom: "Nos",
			allowNegativeStock: false,
			overDeliveryReceiptAllowancePercent: 5,
			overTransferAllowancePercent: 10,
			actionIfQualityInspectionIsNotSubmitted: "WARN",
			actionIfQualityInspectionIsRejected: "STOP",
			freezeStocksOlderThanDays: 90,
		},
		create: {
			singletonKey: "default",
			itemNamingBy: "ITEM_CODE",
			defaultWarehouse: mainWarehouseName,
			defaultValuationMethod: "FIFO",
			defaultStockUom: "Nos",
			allowNegativeStock: false,
			overDeliveryReceiptAllowancePercent: 5,
			overTransferAllowancePercent: 10,
			actionIfQualityInspectionIsNotSubmitted: "WARN",
			actionIfQualityInspectionIsRejected: "STOP",
			freezeStocksOlderThanDays: 90,
		},
	});

	// Item Variant Settings (singleton)
	await prisma.itemVariantSettings.upsert({
		where: { singletonKey: "default" },
		update: {
			doNotUpdateVariantsOnSave: false,
			allowRenameAttributeValue: true,
		},
		create: {
			singletonKey: "default",
			doNotUpdateVariantsOnSave: false,
			allowRenameAttributeValue: true,
		},
	});

	// ── 12. Fiscal Year & Company (master data for all apps) ────
	await seedFiscalYearData(prisma, config);

	// ── 13. Asset Management Masters ───────────────────────────────
	await seedAssetMasterData(prisma, config, ids);

	return ids;
}
