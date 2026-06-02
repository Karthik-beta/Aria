import type {
	TRPCBuiltRouter,
	TRPCDecorateCreateRouterOptions,
} from "@trpc/server";
import type { assetRouter } from "../apps/asset/trpc/asset.router";
import type { companyRouter } from "../apps/company/trpc/company.router";
import type { inventoryRouter } from "../apps/inventory/trpc/inventory.router";
import type { accountRouter } from "./routers/account.router";

type InventoryAppRouter = typeof inventoryRouter;
type AssetAppRouter = typeof assetRouter;
type CompanyAppRouter = typeof companyRouter;

type AppRouterInput = {
	inventory: InventoryAppRouter;
	asset: AssetAppRouter;
	company: CompanyAppRouter;
	account: typeof accountRouter;
};

type AppRouterRoot = (typeof inventoryRouter)["_def"]["_config"]["$types"];
type AppRouterRecord = TRPCDecorateCreateRouterOptions<AppRouterInput>;

export type AppRouter = TRPCBuiltRouter<AppRouterRoot, AppRouterRecord>;
