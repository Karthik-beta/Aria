import type {
	TRPCBuiltRouter,
	TRPCDecorateCreateRouterOptions,
} from "@trpc/server";
import type { InventoryRouter } from "../apps/inventory/trpc/inventory.router";
import { accountRouter } from "./routers/account.router";
import type { adminRouter } from "./routers/admin.router";
import { authorizationRouter } from "./routers/authorization.router";
import { router } from "./trpc";

type InventoryAppRouter = ReturnType<InventoryRouter["getRouter"]>;
type AppRouterInput = {
	inventory: InventoryAppRouter;
	admin: typeof adminRouter;
	authorization: typeof authorizationRouter;
	account: typeof accountRouter;
};

function createAppRouterRecord(
	inventory: InventoryAppRouter,
	admin: typeof adminRouter,
): AppRouterInput {
	return {
		inventory,
		admin,
		authorization: authorizationRouter,
		account: accountRouter,
	};
}

type AppRouterRoot = (typeof adminRouter)["_def"]["_config"]["$types"];
type AppRouterRecord = TRPCDecorateCreateRouterOptions<
	ReturnType<typeof createAppRouterRecord>
>;

export type AppRouter = TRPCBuiltRouter<AppRouterRoot, AppRouterRecord>;

export function createAppRouter(
	inventory: InventoryAppRouter,
	admin: typeof adminRouter,
): AppRouter {
	return router(createAppRouterRecord(inventory, admin));
}
