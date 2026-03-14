import type {
	TRPCBuiltRouter,
	TRPCDecorateCreateRouterOptions,
} from "@trpc/server";
import type { inventoryRouter } from "../apps/inventory/trpc/inventory.router";
import type { accountRouter } from "./routers/account.router";
import type { adminRouter } from "./routers/admin.router";
import type { authorizationRouter } from "./routers/authorization.router";

type InventoryAppRouter = typeof inventoryRouter;

type AppRouterInput = {
	inventory: InventoryAppRouter;
	admin: typeof adminRouter;
	authorization: typeof authorizationRouter;
	account: typeof accountRouter;
};

type AppRouterRoot = (typeof adminRouter)["_def"]["_config"]["$types"];
type AppRouterRecord = TRPCDecorateCreateRouterOptions<AppRouterInput>;

export type AppRouter = TRPCBuiltRouter<AppRouterRoot, AppRouterRecord>;
