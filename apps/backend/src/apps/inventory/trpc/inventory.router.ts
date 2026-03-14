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

type InventoryRouterInput = {
	listItems: ReturnType<typeof createListItemsProcedure>;
	listItemGroups: ReturnType<typeof createListItemGroupsProcedure>;
	listUnitsOfMeasure: ReturnType<typeof createListUnitsOfMeasureProcedure>;
	listBundleItems: ReturnType<typeof createListBundleItemsProcedure>;
	listProductBundles: ReturnType<typeof createListProductBundlesProcedure>;
	createProductBundle: ReturnType<typeof createCreateProductBundleProcedure>;
	updateProductBundle: ReturnType<typeof createUpdateProductBundleProcedure>;
	deleteProductBundle: ReturnType<typeof createDeleteProductBundleProcedure>;
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
		listBundleItems: createListBundleItemsProcedure(inventoryService),
		listProductBundles: createListProductBundlesProcedure(inventoryService),
		createProductBundle: createCreateProductBundleProcedure(inventoryService),
		updateProductBundle: createUpdateProductBundleProcedure(inventoryService),
		deleteProductBundle: createDeleteProductBundleProcedure(inventoryService),
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
