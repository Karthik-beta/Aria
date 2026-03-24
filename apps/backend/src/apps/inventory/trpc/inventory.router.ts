import { EventEmitter } from "node:events";
import { Inventory } from "@aria/types";
import { Injectable } from "@nestjs/common";
import type {
	TRPCBuiltRouter,
	TRPCDecorateCreateRouterOptions,
} from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import type { accountRouter } from "../../../trpc/routers/account.router";
import { protectedProcedure, router } from "../../../trpc/trpc";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { InventoryService } from "../inventory.service";

// Global event emitter for real-time subscriptions
const inventoryEvents = new EventEmitter({ captureRejections: true });
inventoryEvents.setMaxListeners(50);

type ItemGroupsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.ItemGroup | { id: string };
};

type ItemsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.Item | { id: string };
};

function createListItemsProcedure(inventoryService: InventoryService) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAll();
	});
}

function createListItemGroupsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ search: z.string().optional() }).optional())
		.query(async ({ input }) => {
			return inventoryService.findAllItemGroups(input?.search);
		});
}

function createListUnitsOfMeasureProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ search: z.string().optional() }).optional())
		.query(async ({ input }) => {
			return inventoryService.findAllUnitsOfMeasure(input?.search);
		});
}

function createGetUnitOfMeasureByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ input }) => {
			return inventoryService.findUnitOfMeasureById(input.id);
		});
}

function createCreateUnitOfMeasureProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createUnitOfMeasureSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createUnitOfMeasure(input);
		});
}

function createUpdateUnitOfMeasureProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateUnitOfMeasureSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateUnitOfMeasure(input);
		});
}

function createDeleteUnitOfMeasureProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteUnitOfMeasure(input.id);
		});
}

function createListBundleItemsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ search: z.string().optional() }).optional())
		.query(async ({ input }) => {
			return inventoryService.findAllItemsForBundleSelection(input?.search);
		});
}

function createListProductBundlesProcedure(inventoryService: InventoryService) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAllProductBundles();
	});
}

function createCreateProductBundleProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createProductBundleSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createProductBundle(input);
		});
}

function createUpdateProductBundleProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateProductBundleSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateProductBundle(input);
		});
}

function createDeleteProductBundleProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteProductBundle(input.id);
		});
}

function createListShippingRulesProcedure(inventoryService: InventoryService) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAllShippingRules();
	});
}

function createGetShippingRuleByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findShippingRuleById(input.id);
		});
}

function createCreateShippingRuleProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createShippingRuleSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createShippingRule(input);
		});
}

function createUpdateShippingRuleProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateShippingRuleSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateShippingRule(input);
		});
}

function createDeleteShippingRuleProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteShippingRule(input.id);
		});
}

function createListItemManufacturersProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAllItemManufacturers();
	});
}

function createGetItemManufacturerByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ input }) => {
			return inventoryService.findItemManufacturerById(input.id);
		});
}

function createCreateItemManufacturerProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createItemManufacturerSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createItemManufacturer(input);
		});
}

function createUpdateItemManufacturerProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateItemManufacturerSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateItemManufacturer(input);
		});
}

function createDeleteItemManufacturerProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteItemManufacturer(input.id);
		});
}

function createListItemAlternativesProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAllItemAlternatives();
	});
}

function createGetItemAlternativeByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ input }) => {
			return inventoryService.findItemAlternativeById(input.id);
		});
}

function createCreateItemAlternativeProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createItemAlternativeSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createItemAlternative(input);
		});
}

function createUpdateItemAlternativeProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateItemAlternativeSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateItemAlternative(input);
		});
}

function createDeleteItemAlternativeProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteItemAlternative(input.id);
		});
}

function createCreateItemProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createSchema)
		.mutation(async ({ input }) => {
			const item = await inventoryService.create(input);
			void inventoryEvents.emit("itemCreated", item);
			return item;
		});
}

function createUpdateItemProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateSchema)
		.mutation(async ({ input }) => {
			const item = await inventoryService.update(input);
			void inventoryEvents.emit("itemUpdated", item);
			return item;
		});
}

function createDeleteItemProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			await inventoryService.delete(input.id);
			inventoryEvents.emit("itemDeleted", { id: input.id });
			return { success: true, id: input.id };
		});
}

function createBulkDeleteItemsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.bulkDeleteSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteMany(input.ids);

			for (const id of result.ids) {
				inventoryEvents.emit("itemDeleted", { id });
			}

			return result;
		});
}

function createCreateItemGroupProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createGroupSchema)
		.mutation(async ({ input }) => {
			const group = await inventoryService.createGroup(input);
			inventoryEvents.emit("itemGroupCreated", group);
			return group;
		});
}

function createUpdateItemGroupProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateGroupSchema)
		.mutation(async ({ input }) => {
			const group = await inventoryService.updateGroup(input);
			inventoryEvents.emit("itemGroupUpdated", group);
			return group;
		});
}

function createDeleteItemGroupProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteGroup(input.id);
			inventoryEvents.emit("itemGroupDeleted", { id: input.id });
			return result;
		});
}

const onItemGroupsChangedProcedure = protectedProcedure.subscription(() => {
	return observable<ItemGroupsChangedEvent>((emit) => {
		const onCreated = (data: Inventory.ItemGroup) => {
			emit.next({ type: "created", data });
		};
		const onUpdated = (data: Inventory.ItemGroup) => {
			emit.next({ type: "updated", data });
		};
		const onDeleted = (data: { id: string }) => {
			emit.next({ type: "deleted", data });
		};

		inventoryEvents.on("itemGroupCreated", onCreated);
		inventoryEvents.on("itemGroupUpdated", onUpdated);
		inventoryEvents.on("itemGroupDeleted", onDeleted);

		return () => {
			inventoryEvents.off("itemGroupCreated", onCreated);
			inventoryEvents.off("itemGroupUpdated", onUpdated);
			inventoryEvents.off("itemGroupDeleted", onDeleted);
		};
	});
});

const onItemCreatedProcedure = protectedProcedure.subscription(() => {
	return observable<Inventory.Item>((emit) => {
		const onCreated = (data: Inventory.Item) => {
			emit.next(data);
		};

		inventoryEvents.on("itemCreated", onCreated);

		return () => {
			inventoryEvents.off("itemCreated", onCreated);
		};
	});
});

const onItemUpdatedProcedure = protectedProcedure.subscription(() => {
	return observable<Inventory.Item>((emit) => {
		const onUpdated = (data: Inventory.Item) => {
			emit.next(data);
		};

		inventoryEvents.on("itemUpdated", onUpdated);

		return () => {
			inventoryEvents.off("itemUpdated", onUpdated);
		};
	});
});

const onItemDeletedProcedure = protectedProcedure.subscription(() => {
	return observable<{ id: string }>((emit) => {
		const onDeleted = (data: { id: string }) => {
			emit.next(data);
		};

		inventoryEvents.on("itemDeleted", onDeleted);

		return () => {
			inventoryEvents.off("itemDeleted", onDeleted);
		};
	});
});

const onItemsChangedProcedure = protectedProcedure.subscription(() => {
	return observable<ItemsChangedEvent>((emit) => {
		const onCreated = (data: Inventory.Item) => {
			emit.next({ type: "created", data });
		};

		const onUpdated = (data: Inventory.Item) => {
			emit.next({ type: "updated", data });
		};

		const onDeleted = (data: { id: string }) => {
			emit.next({ type: "deleted", data });
		};

		inventoryEvents.on("itemCreated", onCreated);
		inventoryEvents.on("itemUpdated", onUpdated);
		inventoryEvents.on("itemDeleted", onDeleted);

		return () => {
			inventoryEvents.off("itemCreated", onCreated);
			inventoryEvents.off("itemUpdated", onUpdated);
			inventoryEvents.off("itemDeleted", onDeleted);
		};
	});
});

// ─── Material Request Procedures ────────────────────────────────────────────

type MaterialRequestsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.MaterialRequest | { id: string };
};

function createListMaterialRequestsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAllMaterialRequests();
	});
}

function createGetMaterialRequestByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findMaterialRequestById(input.id);
		});
}

function createCreateMaterialRequestProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createMaterialRequestSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createMaterialRequest(input);
			void inventoryEvents.emit("materialRequestCreated", result);
			return result;
		});
}

function createUpdateMaterialRequestProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateMaterialRequestSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updateMaterialRequest(input);
			void inventoryEvents.emit("materialRequestUpdated", result);
			return result;
		});
}

function createDeleteMaterialRequestProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteMaterialRequest(input.id);
			inventoryEvents.emit("materialRequestDeleted", { id: input.id });
			return result;
		});
}

function createDeleteManyMaterialRequestsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeleteMaterialRequestsSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteManyMaterialRequests(
				input.ids,
			);
			for (const id of result.ids) {
				inventoryEvents.emit("materialRequestDeleted", { id });
			}
			return result;
		});
}

const onMaterialRequestsChangedProcedure = protectedProcedure.subscription(
	() => {
		return observable<MaterialRequestsChangedEvent>((emit) => {
			const onCreated = (data: Inventory.MaterialRequest) => {
				emit.next({ type: "created", data });
			};

			const onUpdated = (data: Inventory.MaterialRequest) => {
				emit.next({ type: "updated", data });
			};

			const onDeleted = (data: { id: string }) => {
				emit.next({ type: "deleted", data });
			};

			inventoryEvents.on("materialRequestCreated", onCreated);
			inventoryEvents.on("materialRequestUpdated", onUpdated);
			inventoryEvents.on("materialRequestDeleted", onDeleted);

			return () => {
				inventoryEvents.off("materialRequestCreated", onCreated);
				inventoryEvents.off("materialRequestUpdated", onUpdated);
				inventoryEvents.off("materialRequestDeleted", onDeleted);
			};
		});
	},
);

// ─── Stock Entry Procedures ──────────────────────────────────────────────────

type StockEntriesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.StockEntry | { id: string };
};

function createListStockEntriesProcedure(inventoryService: InventoryService) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAllStockEntries();
	});
}

function createGetStockEntryByIdProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findStockEntryById(input.id);
		});
}

function createCreateStockEntryProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createStockEntrySchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createStockEntry(input);
			void inventoryEvents.emit("stockEntryCreated", result);
			return result;
		});
}

function createUpdateStockEntryProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateStockEntrySchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updateStockEntry(input);
			void inventoryEvents.emit("stockEntryUpdated", result);
			return result;
		});
}

function createDeleteStockEntryProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteStockEntry(input.id);
			void inventoryEvents.emit("stockEntryDeleted", { id: input.id });
			return result;
		});
}

function createDeleteManyStockEntriesProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeleteStockEntriesSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteManyStockEntries(input.ids);
			for (const id of result.ids) {
				inventoryEvents.emit("stockEntryDeleted", { id });
			}
			return result;
		});
}

const onStockEntriesChangedProcedure = protectedProcedure.subscription(() => {
	return observable<StockEntriesChangedEvent>((emit) => {
		const onCreated = (data: Inventory.StockEntry) => {
			emit.next({ type: "created", data });
		};
		const onUpdated = (data: Inventory.StockEntry) => {
			emit.next({ type: "updated", data });
		};
		const onDeleted = (data: { id: string }) => {
			emit.next({ type: "deleted", data });
		};

		inventoryEvents.on("stockEntryCreated", onCreated);
		inventoryEvents.on("stockEntryUpdated", onUpdated);
		inventoryEvents.on("stockEntryDeleted", onDeleted);

		return () => {
			inventoryEvents.off("stockEntryCreated", onCreated);
			inventoryEvents.off("stockEntryUpdated", onUpdated);
			inventoryEvents.off("stockEntryDeleted", onDeleted);
		};
	});
});

function createListStockLedgerProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listStockLedgerSchema)
		.query(async ({ input }) => {
			return inventoryService.findStockLedger(input);
		});
}

function createListStockBalanceProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listStockBalanceSchema)
		.query(async ({ input }) => {
			return inventoryService.findStockBalance(input);
		});
}

function createListStockProjectedQtyProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listStockProjectedQtySchema)
		.query(async ({ input }) => {
			return inventoryService.findStockProjectedQty(input);
		});
}

function createListStockSummaryProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listStockSummarySchema)
		.query(async ({ input }) => {
			return inventoryService.findStockSummary(input);
		});
}

function createListStockAgeingProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listStockAgeingSchema)
		.query(async ({ input }) => {
			return inventoryService.findStockAgeing(input);
		});
}

function createListItemPriceStockProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listItemPriceStockSchema)
		.query(async ({ input }) => {
			return inventoryService.findItemPriceStock(input);
		});
}

// ─── Delivery Note Procedures ────────────────────────────────────────────────

type DeliveryNotesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.DeliveryNote | { id: string };
};

function createListDeliveryNotesProcedure(inventoryService: InventoryService) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAllDeliveryNotes();
	});
}

function createGetDeliveryNoteByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findDeliveryNoteById(input.id);
		});
}

function createCreateDeliveryNoteProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createDeliveryNoteSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createDeliveryNote(input);
			void inventoryEvents.emit("deliveryNoteCreated", result);
			return result;
		});
}

function createUpdateDeliveryNoteProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateDeliveryNoteSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updateDeliveryNote(input);
			void inventoryEvents.emit("deliveryNoteUpdated", result);
			return result;
		});
}

function createDeleteDeliveryNoteProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteDeliveryNote(input.id);
			void inventoryEvents.emit("deliveryNoteDeleted", { id: input.id });
			return result;
		});
}

function createDeleteManyDeliveryNotesProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeleteDeliveryNotesSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteManyDeliveryNotes(input.ids);
			for (const id of result.ids) {
				inventoryEvents.emit("deliveryNoteDeleted", { id });
			}
			return result;
		});
}

const onDeliveryNotesChangedProcedure = protectedProcedure.subscription(() => {
	return observable<DeliveryNotesChangedEvent>((emit) => {
		const onCreated = (data: Inventory.DeliveryNote) => {
			emit.next({ type: "created", data });
		};
		const onUpdated = (data: Inventory.DeliveryNote) => {
			emit.next({ type: "updated", data });
		};
		const onDeleted = (data: { id: string }) => {
			emit.next({ type: "deleted", data });
		};

		inventoryEvents.on("deliveryNoteCreated", onCreated);
		inventoryEvents.on("deliveryNoteUpdated", onUpdated);
		inventoryEvents.on("deliveryNoteDeleted", onDeleted);

		return () => {
			inventoryEvents.off("deliveryNoteCreated", onCreated);
			inventoryEvents.off("deliveryNoteUpdated", onUpdated);
			inventoryEvents.off("deliveryNoteDeleted", onDeleted);
		};
	});
});

// ─── Purchase Receipt Procedures ─────────────────────────────────────────────

function createListPurchaseReceiptsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listPurchaseReceiptsSchema)
		.query(async ({ input }) => {
			return inventoryService.findAllPurchaseReceipts(input);
		});
}

function createGetPurchaseReceiptByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findPurchaseReceiptById(input.id);
		});
}

function createCreatePurchaseReceiptProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createPurchaseReceiptSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createPurchaseReceipt(input);
		});
}

function createUpdatePurchaseReceiptProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updatePurchaseReceiptSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updatePurchaseReceipt(input);
		});
}

function createDeletePurchaseReceiptProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			return inventoryService.deletePurchaseReceipt(input.id);
		});
}

function createDeleteManyPurchaseReceiptsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeletePurchaseReceiptsSchema)
		.mutation(async ({ input }) => {
			return inventoryService.deleteManyPurchaseReceipts(input.ids);
		});
}

// ─── Pick List Procedures ────────────────────────────────────────────────────

type PickListsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.PickList | { id: string };
};

function createListPickListsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listPickListsSchema)
		.query(async ({ input }) => {
			return inventoryService.findAllPickLists(input);
		});
}

function createGetPickListByIdProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findPickListById(input.id);
		});
}

function createCreatePickListProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createPickListSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createPickList(input);
			void inventoryEvents.emit("pickListCreated", result);
			return result;
		});
}

function createUpdatePickListProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updatePickListSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updatePickList(input);
			void inventoryEvents.emit("pickListUpdated", result);
			return result;
		});
}

function createDeletePickListProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deletePickList(input.id);
			void inventoryEvents.emit("pickListDeleted", { id: input.id });
			return result;
		});
}

function createDeleteManyPickListsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeletePickListsSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteManyPickLists(input.ids);
			for (const id of result.ids) {
				void inventoryEvents.emit("pickListDeleted", { id });
			}
			return result;
		});
}

const onPickListsChangedProcedure = protectedProcedure.subscription(() => {
	return observable<PickListsChangedEvent>((emit) => {
		const onCreated = (data: Inventory.PickList) => {
			emit.next({ type: "created", data });
		};
		const onUpdated = (data: Inventory.PickList) => {
			emit.next({ type: "updated", data });
		};
		const onDeleted = (data: { id: string }) => {
			emit.next({ type: "deleted", data });
		};

		inventoryEvents.on("pickListCreated", onCreated);
		inventoryEvents.on("pickListUpdated", onUpdated);
		inventoryEvents.on("pickListDeleted", onDeleted);

		return () => {
			inventoryEvents.off("pickListCreated", onCreated);
			inventoryEvents.off("pickListUpdated", onUpdated);
			inventoryEvents.off("pickListDeleted", onDeleted);
		};
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Delivery Trip procedures
// ─────────────────────────────────────────────────────────────────────────────

type DeliveryTripsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.DeliveryTrip | { id: string };
};

function createListDeliveryTripsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listDeliveryTripsSchema)
		.query(async ({ input }) => {
			return inventoryService.findAllDeliveryTrips(input);
		});
}

function createGetDeliveryTripByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findDeliveryTripById(input.id);
		});
}

function createCreateDeliveryTripProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createDeliveryTripSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createDeliveryTrip(input);
			void inventoryEvents.emit("deliveryTripCreated", result);
			return result;
		});
}

function createUpdateDeliveryTripProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateDeliveryTripSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updateDeliveryTrip(input);
			void inventoryEvents.emit("deliveryTripUpdated", result);
			return result;
		});
}

function createDeleteDeliveryTripProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteDeliveryTrip(input.id);
			void inventoryEvents.emit("deliveryTripDeleted", { id: input.id });
			return result;
		});
}

function createDeleteManyDeliveryTripsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeleteDeliveryTripsSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteManyDeliveryTrips(input.ids);
			for (const id of result.ids) {
				void inventoryEvents.emit("deliveryTripDeleted", { id });
			}
			return result;
		});
}

const onDeliveryTripsChangedProcedure = protectedProcedure.subscription(() => {
	return observable<DeliveryTripsChangedEvent>((emit) => {
		const onCreated = (data: Inventory.DeliveryTrip) => {
			emit.next({ type: "created", data });
		};
		const onUpdated = (data: Inventory.DeliveryTrip) => {
			emit.next({ type: "updated", data });
		};
		const onDeleted = (data: { id: string }) => {
			emit.next({ type: "deleted", data });
		};

		inventoryEvents.on("deliveryTripCreated", onCreated);
		inventoryEvents.on("deliveryTripUpdated", onUpdated);
		inventoryEvents.on("deliveryTripDeleted", onDeleted);

		return () => {
			inventoryEvents.off("deliveryTripCreated", onCreated);
			inventoryEvents.off("deliveryTripUpdated", onUpdated);
			inventoryEvents.off("deliveryTripDeleted", onDeleted);
		};
	});
});

type InventoryRouterInput = {
	listItems: ReturnType<typeof createListItemsProcedure>;
	listItemGroups: ReturnType<typeof createListItemGroupsProcedure>;
	listUnitsOfMeasure: ReturnType<typeof createListUnitsOfMeasureProcedure>;
	getUnitOfMeasureById: ReturnType<typeof createGetUnitOfMeasureByIdProcedure>;
	createUnitOfMeasure: ReturnType<typeof createCreateUnitOfMeasureProcedure>;
	updateUnitOfMeasure: ReturnType<typeof createUpdateUnitOfMeasureProcedure>;
	deleteUnitOfMeasure: ReturnType<typeof createDeleteUnitOfMeasureProcedure>;
	listBundleItems: ReturnType<typeof createListBundleItemsProcedure>;
	listProductBundles: ReturnType<typeof createListProductBundlesProcedure>;
	createProductBundle: ReturnType<typeof createCreateProductBundleProcedure>;
	updateProductBundle: ReturnType<typeof createUpdateProductBundleProcedure>;
	deleteProductBundle: ReturnType<typeof createDeleteProductBundleProcedure>;
	listShippingRules: ReturnType<typeof createListShippingRulesProcedure>;
	getShippingRuleById: ReturnType<typeof createGetShippingRuleByIdProcedure>;
	createShippingRule: ReturnType<typeof createCreateShippingRuleProcedure>;
	updateShippingRule: ReturnType<typeof createUpdateShippingRuleProcedure>;
	deleteShippingRule: ReturnType<typeof createDeleteShippingRuleProcedure>;
	listItemManufacturers: ReturnType<
		typeof createListItemManufacturersProcedure
	>;
	getItemManufacturerById: ReturnType<
		typeof createGetItemManufacturerByIdProcedure
	>;
	createItemManufacturer: ReturnType<
		typeof createCreateItemManufacturerProcedure
	>;
	updateItemManufacturer: ReturnType<
		typeof createUpdateItemManufacturerProcedure
	>;
	deleteItemManufacturer: ReturnType<
		typeof createDeleteItemManufacturerProcedure
	>;
	listItemAlternatives: ReturnType<typeof createListItemAlternativesProcedure>;
	getItemAlternativeById: ReturnType<
		typeof createGetItemAlternativeByIdProcedure
	>;
	createItemAlternative: ReturnType<
		typeof createCreateItemAlternativeProcedure
	>;
	updateItemAlternative: ReturnType<
		typeof createUpdateItemAlternativeProcedure
	>;
	deleteItemAlternative: ReturnType<
		typeof createDeleteItemAlternativeProcedure
	>;
	createItem: ReturnType<typeof createCreateItemProcedure>;
	updateItem: ReturnType<typeof createUpdateItemProcedure>;
	deleteItem: ReturnType<typeof createDeleteItemProcedure>;
	deleteItems: ReturnType<typeof createBulkDeleteItemsProcedure>;
	createItemGroup: ReturnType<typeof createCreateItemGroupProcedure>;
	updateItemGroup: ReturnType<typeof createUpdateItemGroupProcedure>;
	deleteItemGroup: ReturnType<typeof createDeleteItemGroupProcedure>;
	onItemGroupsChanged: typeof onItemGroupsChangedProcedure;
	onItemCreated: typeof onItemCreatedProcedure;
	onItemUpdated: typeof onItemUpdatedProcedure;
	onItemDeleted: typeof onItemDeletedProcedure;
	onItemsChanged: typeof onItemsChangedProcedure;
	listMaterialRequests: ReturnType<typeof createListMaterialRequestsProcedure>;
	getMaterialRequestById: ReturnType<
		typeof createGetMaterialRequestByIdProcedure
	>;
	createMaterialRequest: ReturnType<
		typeof createCreateMaterialRequestProcedure
	>;
	updateMaterialRequest: ReturnType<
		typeof createUpdateMaterialRequestProcedure
	>;
	deleteMaterialRequest: ReturnType<
		typeof createDeleteMaterialRequestProcedure
	>;
	deleteManyMaterialRequests: ReturnType<
		typeof createDeleteManyMaterialRequestsProcedure
	>;
	onMaterialRequestsChanged: typeof onMaterialRequestsChangedProcedure;
	listStockEntries: ReturnType<typeof createListStockEntriesProcedure>;
	getStockEntryById: ReturnType<typeof createGetStockEntryByIdProcedure>;
	createStockEntry: ReturnType<typeof createCreateStockEntryProcedure>;
	updateStockEntry: ReturnType<typeof createUpdateStockEntryProcedure>;
	deleteStockEntry: ReturnType<typeof createDeleteStockEntryProcedure>;
	deleteManyStockEntries: ReturnType<
		typeof createDeleteManyStockEntriesProcedure
	>;
	onStockEntriesChanged: typeof onStockEntriesChangedProcedure;
	listStockLedger: ReturnType<typeof createListStockLedgerProcedure>;
	listStockBalance: ReturnType<typeof createListStockBalanceProcedure>;
	listStockProjectedQty: ReturnType<
		typeof createListStockProjectedQtyProcedure
	>;
	listStockSummary: ReturnType<typeof createListStockSummaryProcedure>;
	listStockAgeing: ReturnType<typeof createListStockAgeingProcedure>;
	listItemPriceStock: ReturnType<typeof createListItemPriceStockProcedure>;
	listDeliveryNotes: ReturnType<typeof createListDeliveryNotesProcedure>;
	getDeliveryNoteById: ReturnType<typeof createGetDeliveryNoteByIdProcedure>;
	createDeliveryNote: ReturnType<typeof createCreateDeliveryNoteProcedure>;
	updateDeliveryNote: ReturnType<typeof createUpdateDeliveryNoteProcedure>;
	deleteDeliveryNote: ReturnType<typeof createDeleteDeliveryNoteProcedure>;
	deleteManyDeliveryNotes: ReturnType<
		typeof createDeleteManyDeliveryNotesProcedure
	>;
	onDeliveryNotesChanged: typeof onDeliveryNotesChangedProcedure;
	listPurchaseReceipts: ReturnType<typeof createListPurchaseReceiptsProcedure>;
	getPurchaseReceiptById: ReturnType<
		typeof createGetPurchaseReceiptByIdProcedure
	>;
	createPurchaseReceipt: ReturnType<
		typeof createCreatePurchaseReceiptProcedure
	>;
	updatePurchaseReceipt: ReturnType<
		typeof createUpdatePurchaseReceiptProcedure
	>;
	deletePurchaseReceipt: ReturnType<
		typeof createDeletePurchaseReceiptProcedure
	>;
	deleteManyPurchaseReceipts: ReturnType<
		typeof createDeleteManyPurchaseReceiptsProcedure
	>;
	listPickLists: ReturnType<typeof createListPickListsProcedure>;
	getPickListById: ReturnType<typeof createGetPickListByIdProcedure>;
	createPickList: ReturnType<typeof createCreatePickListProcedure>;
	updatePickList: ReturnType<typeof createUpdatePickListProcedure>;
	deletePickList: ReturnType<typeof createDeletePickListProcedure>;
	deleteManyPickLists: ReturnType<typeof createDeleteManyPickListsProcedure>;
	onPickListsChanged: typeof onPickListsChangedProcedure;
	listDeliveryTrips: ReturnType<typeof createListDeliveryTripsProcedure>;
	getDeliveryTripById: ReturnType<typeof createGetDeliveryTripByIdProcedure>;
	createDeliveryTrip: ReturnType<typeof createCreateDeliveryTripProcedure>;
	updateDeliveryTrip: ReturnType<typeof createUpdateDeliveryTripProcedure>;
	deleteDeliveryTrip: ReturnType<typeof createDeleteDeliveryTripProcedure>;
	deleteManyDeliveryTrips: ReturnType<
		typeof createDeleteManyDeliveryTripsProcedure
	>;
	onDeliveryTripsChanged: typeof onDeliveryTripsChangedProcedure;
};

type InventoryRouterRoot = (typeof accountRouter)["_def"]["_config"]["$types"];
type InventoryRouterRecord =
	TRPCDecorateCreateRouterOptions<InventoryRouterInput>;
type InventoryAppRouter = TRPCBuiltRouter<
	InventoryRouterRoot,
	InventoryRouterRecord
>;

function createInventoryRouterRecord(
	inventoryService: InventoryService,
): InventoryRouterInput {
	return {
		listItems: createListItemsProcedure(inventoryService),
		listItemGroups: createListItemGroupsProcedure(inventoryService),
		listUnitsOfMeasure: createListUnitsOfMeasureProcedure(inventoryService),
		getUnitOfMeasureById: createGetUnitOfMeasureByIdProcedure(inventoryService),
		createUnitOfMeasure: createCreateUnitOfMeasureProcedure(inventoryService),
		updateUnitOfMeasure: createUpdateUnitOfMeasureProcedure(inventoryService),
		deleteUnitOfMeasure: createDeleteUnitOfMeasureProcedure(inventoryService),
		listBundleItems: createListBundleItemsProcedure(inventoryService),
		listProductBundles: createListProductBundlesProcedure(inventoryService),
		createProductBundle: createCreateProductBundleProcedure(inventoryService),
		updateProductBundle: createUpdateProductBundleProcedure(inventoryService),
		deleteProductBundle: createDeleteProductBundleProcedure(inventoryService),
		listShippingRules: createListShippingRulesProcedure(inventoryService),
		getShippingRuleById: createGetShippingRuleByIdProcedure(inventoryService),
		createShippingRule: createCreateShippingRuleProcedure(inventoryService),
		updateShippingRule: createUpdateShippingRuleProcedure(inventoryService),
		deleteShippingRule: createDeleteShippingRuleProcedure(inventoryService),
		listItemManufacturers:
			createListItemManufacturersProcedure(inventoryService),
		getItemManufacturerById:
			createGetItemManufacturerByIdProcedure(inventoryService),
		createItemManufacturer:
			createCreateItemManufacturerProcedure(inventoryService),
		updateItemManufacturer:
			createUpdateItemManufacturerProcedure(inventoryService),
		deleteItemManufacturer:
			createDeleteItemManufacturerProcedure(inventoryService),
		listItemAlternatives: createListItemAlternativesProcedure(inventoryService),
		getItemAlternativeById:
			createGetItemAlternativeByIdProcedure(inventoryService),
		createItemAlternative:
			createCreateItemAlternativeProcedure(inventoryService),
		updateItemAlternative:
			createUpdateItemAlternativeProcedure(inventoryService),
		deleteItemAlternative:
			createDeleteItemAlternativeProcedure(inventoryService),
		createItem: createCreateItemProcedure(inventoryService),
		updateItem: createUpdateItemProcedure(inventoryService),
		deleteItem: createDeleteItemProcedure(inventoryService),
		deleteItems: createBulkDeleteItemsProcedure(inventoryService),
		createItemGroup: createCreateItemGroupProcedure(inventoryService),
		updateItemGroup: createUpdateItemGroupProcedure(inventoryService),
		deleteItemGroup: createDeleteItemGroupProcedure(inventoryService),
		onItemGroupsChanged: onItemGroupsChangedProcedure,
		onItemCreated: onItemCreatedProcedure,
		onItemUpdated: onItemUpdatedProcedure,
		onItemDeleted: onItemDeletedProcedure,
		onItemsChanged: onItemsChangedProcedure,
		listMaterialRequests: createListMaterialRequestsProcedure(inventoryService),
		getMaterialRequestById:
			createGetMaterialRequestByIdProcedure(inventoryService),
		createMaterialRequest:
			createCreateMaterialRequestProcedure(inventoryService),
		updateMaterialRequest:
			createUpdateMaterialRequestProcedure(inventoryService),
		deleteMaterialRequest:
			createDeleteMaterialRequestProcedure(inventoryService),
		deleteManyMaterialRequests:
			createDeleteManyMaterialRequestsProcedure(inventoryService),
		onMaterialRequestsChanged: onMaterialRequestsChangedProcedure,
		listStockEntries: createListStockEntriesProcedure(inventoryService),
		getStockEntryById: createGetStockEntryByIdProcedure(inventoryService),
		createStockEntry: createCreateStockEntryProcedure(inventoryService),
		updateStockEntry: createUpdateStockEntryProcedure(inventoryService),
		deleteStockEntry: createDeleteStockEntryProcedure(inventoryService),
		deleteManyStockEntries:
			createDeleteManyStockEntriesProcedure(inventoryService),
		onStockEntriesChanged: onStockEntriesChangedProcedure,
		listStockLedger: createListStockLedgerProcedure(inventoryService),
		listStockBalance: createListStockBalanceProcedure(inventoryService),
		listStockProjectedQty:
			createListStockProjectedQtyProcedure(inventoryService),
		listStockSummary: createListStockSummaryProcedure(inventoryService),
		listStockAgeing: createListStockAgeingProcedure(inventoryService),
		listItemPriceStock: createListItemPriceStockProcedure(inventoryService),
		listDeliveryNotes: createListDeliveryNotesProcedure(inventoryService),
		getDeliveryNoteById: createGetDeliveryNoteByIdProcedure(inventoryService),
		createDeliveryNote: createCreateDeliveryNoteProcedure(inventoryService),
		updateDeliveryNote: createUpdateDeliveryNoteProcedure(inventoryService),
		deleteDeliveryNote: createDeleteDeliveryNoteProcedure(inventoryService),
		deleteManyDeliveryNotes:
			createDeleteManyDeliveryNotesProcedure(inventoryService),
		onDeliveryNotesChanged: onDeliveryNotesChangedProcedure,
		listPurchaseReceipts: createListPurchaseReceiptsProcedure(inventoryService),
		getPurchaseReceiptById:
			createGetPurchaseReceiptByIdProcedure(inventoryService),
		createPurchaseReceipt:
			createCreatePurchaseReceiptProcedure(inventoryService),
		updatePurchaseReceipt:
			createUpdatePurchaseReceiptProcedure(inventoryService),
		deletePurchaseReceipt:
			createDeletePurchaseReceiptProcedure(inventoryService),
		deleteManyPurchaseReceipts:
			createDeleteManyPurchaseReceiptsProcedure(inventoryService),
		listPickLists: createListPickListsProcedure(inventoryService),
		getPickListById: createGetPickListByIdProcedure(inventoryService),
		createPickList: createCreatePickListProcedure(inventoryService),
		updatePickList: createUpdatePickListProcedure(inventoryService),
		deletePickList: createDeletePickListProcedure(inventoryService),
		deleteManyPickLists: createDeleteManyPickListsProcedure(inventoryService),
		onPickListsChanged: onPickListsChangedProcedure,
		listDeliveryTrips: createListDeliveryTripsProcedure(inventoryService),
		getDeliveryTripById: createGetDeliveryTripByIdProcedure(inventoryService),
		createDeliveryTrip: createCreateDeliveryTripProcedure(inventoryService),
		updateDeliveryTrip: createUpdateDeliveryTripProcedure(inventoryService),
		deleteDeliveryTrip: createDeleteDeliveryTripProcedure(inventoryService),
		deleteManyDeliveryTrips:
			createDeleteManyDeliveryTripsProcedure(inventoryService),
		onDeliveryTripsChanged: onDeliveryTripsChangedProcedure,
	};
}

function buildInventoryRouter(
	inventoryService: InventoryService,
): InventoryAppRouter {
	return router(createInventoryRouterRecord(inventoryService));
}

@Injectable()
export class InventoryRouter {
	constructor(private readonly inventoryService: InventoryService) {}

	getRouter(): InventoryAppRouter {
		return buildInventoryRouter(this.inventoryService);
	}
}
