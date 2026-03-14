import { Injectable, type OnModuleInit } from "@nestjs/common";
import { InventoryRouter } from "../apps/inventory/trpc/inventory.router";
import { type AppRouter, createAppRouter } from "./app-router";
import { AdminRouter } from "./routers/admin-router.service";

const NEST_ROUTER_DEPENDENCIES = [InventoryRouter, AdminRouter] as const;
void NEST_ROUTER_DEPENDENCIES;

/**
 * TrpcService is responsible for creating and managing the main tRPC router.
 *
 * Following official NestJS tRPC pattern from nestjs-trpc documentation.
 * The appRouter is created after dependency injection completes.
 */
@Injectable()
export class TrpcService implements OnModuleInit {
	public appRouter: AppRouter | null = null;

	constructor(
		private readonly inventoryRouter: InventoryRouter,
		private readonly adminRouter: AdminRouter,
	) {}

	onModuleInit() {
		// Create the router after all dependencies are resolved
		this.appRouter = this.buildAppRouter();
	}

	/**
	 * Factory method to create the app router.
	 * This is the single source of truth for the router structure.
	 */
	buildAppRouter(): AppRouter {
		return createAppRouter(
			this.inventoryRouter.getRouter(),
			this.adminRouter.getRouter(),
		);
	}

	/**
	 * Retrieve the initialized appRouter.
	 * Throws if called before onModuleInit completes.
	 */
	getAppRouter(): AppRouter {
		if (!this.appRouter) {
			throw new Error(
				"AppRouter not initialized. Make sure the module has been initialized.",
			);
		}
		return this.appRouter;
	}
}
