import type { AppRouter as ContractAppRouter } from "@aria/api-contract";
import type { AssetRouter } from "../apps/asset/trpc/asset.router";
import type { InventoryRouter } from "../apps/inventory/trpc/inventory.router";
import { accountRouter } from "./routers/account.router";
import type { AdminRouter } from "./routers/admin-router.service";
import { authorizationRouter } from "./routers/authorization.router";
import { router } from "./trpc";

type InventoryAppRouter = ReturnType<InventoryRouter["getRouter"]>;
type AdminAppRouter = ReturnType<AdminRouter["getRouter"]>;
type AssetAppRouter = ReturnType<AssetRouter["getRouter"]>;
type AppRouterInput = {
	inventory: InventoryAppRouter;
	admin: AdminAppRouter;
	asset: AssetAppRouter;
	authorization: typeof authorizationRouter;
	account: typeof accountRouter;
};

type ContractAppRouterRecord = ContractAppRouter["_def"]["record"];

function createAppRouterRecord(
	inventory: InventoryAppRouter,
	admin: AdminAppRouter,
	asset: AssetAppRouter,
): ContractAppRouterRecord {
	const appRouterRecord: AppRouterInput = {
		inventory,
		admin,
		asset,
		authorization: authorizationRouter,
		account: accountRouter,
	} satisfies ContractAppRouterRecord;

	return appRouterRecord;
}

export type AppRouter = ContractAppRouter;
type AssertContractCompatibility = [
	AppRouterInput["inventory"] extends ContractAppRouterRecord["inventory"]
		? true
		: never,
	ContractAppRouterRecord["inventory"] extends AppRouterInput["inventory"]
		? true
		: never,
	AppRouterInput["admin"] extends ContractAppRouterRecord["admin"]
		? true
		: never,
	ContractAppRouterRecord["admin"] extends AppRouterInput["admin"]
		? true
		: never,
	AppRouterInput["asset"] extends ContractAppRouterRecord["asset"]
		? true
		: never,
	ContractAppRouterRecord["asset"] extends AppRouterInput["asset"]
		? true
		: never,
	AppRouterInput["authorization"] extends ContractAppRouterRecord["authorization"]
		? true
		: never,
	ContractAppRouterRecord["authorization"] extends AppRouterInput["authorization"]
		? true
		: never,
	AppRouterInput["account"] extends ContractAppRouterRecord["account"]
		? true
		: never,
	ContractAppRouterRecord["account"] extends AppRouterInput["account"]
		? true
		: never,
] extends [true, true, true, true, true, true, true, true, true, true]
	? true
	: never;

const APP_ROUTER_CONTRACT_COMPATIBLE: AssertContractCompatibility = true;

export function createAppRouter(
	inventory: InventoryAppRouter,
	admin: AdminAppRouter,
	asset: AssetAppRouter,
): AppRouter {
	void APP_ROUTER_CONTRACT_COMPATIBLE;
	return router(createAppRouterRecord(inventory, admin, asset));
}
