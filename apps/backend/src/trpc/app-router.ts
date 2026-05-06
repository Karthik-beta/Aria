import type { AppRouter as ContractAppRouter } from "@aria/api-contract";
import type { AssetRouter } from "../apps/asset/trpc/asset.router";
import type { InventoryRouter } from "../apps/inventory/trpc/inventory.router";
import { accountRouter } from "./routers/account.router";
import { router } from "./trpc";

type InventoryAppRouter = ReturnType<InventoryRouter["getRouter"]>;
type AssetAppRouter = ReturnType<AssetRouter["getRouter"]>;
type AppRouterInput = {
	inventory: InventoryAppRouter;
	asset: AssetAppRouter;
	account: typeof accountRouter;
};

type ContractAppRouterRecord = ContractAppRouter["_def"]["record"];

function createAppRouterRecord(
	inventory: InventoryAppRouter,
	asset: AssetAppRouter,
): ContractAppRouterRecord {
	const appRouterRecord: AppRouterInput = {
		inventory,
		asset,
		account: accountRouter,
	} satisfies ContractAppRouterRecord;

	return appRouterRecord;
}

export type AppRouter = ContractAppRouter;

export function createAppRouter(
	inventory: InventoryAppRouter,
	asset: AssetAppRouter,
): AppRouter {
	return router(createAppRouterRecord(inventory, asset));
}
