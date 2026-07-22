import type { AppRouter as ContractAppRouter } from "@aria/api-contract";
import type { AssetRouter } from "../apps/asset/trpc/asset.router";
import type { CompanyRouter } from "../apps/company/trpc/company.router";
import type { InventoryRouter } from "../apps/inventory/trpc/inventory.router";
import { accountRouter } from "./routers/account.router";
import { router } from "./trpc";

type InventoryAppRouter = ReturnType<InventoryRouter["getRouter"]>;
type AssetAppRouter = ReturnType<AssetRouter["getRouter"]>;
type CompanyAppRouter = ReturnType<CompanyRouter["getRouter"]>;
type AppRouterInput = {
	inventory: InventoryAppRouter;
	asset: AssetAppRouter;
	company: CompanyAppRouter;
	account: typeof accountRouter;
};

type ContractAppRouterRecord = ContractAppRouter["_def"]["record"];

function createAppRouterRecord(
	inventory: InventoryAppRouter,
	asset: AssetAppRouter,
	company: CompanyAppRouter,
): ContractAppRouterRecord {
	const appRouterRecord: AppRouterInput = {
		inventory,
		asset,
		company,
		account: accountRouter,
	} satisfies ContractAppRouterRecord;

	return appRouterRecord;
}

export type AppRouter = ContractAppRouter;

export function createAppRouter(
	inventory: InventoryAppRouter,
	asset: AssetAppRouter,
	company: CompanyAppRouter,
): AppRouter {
	return router(createAppRouterRecord(inventory, asset, company));
}
