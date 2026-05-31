import { Module } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { InventoryStartupService } from "./inventory-startup.service";
import { InventoryRouter } from "./trpc/inventory.router";

@Module({
	providers: [InventoryService, InventoryStartupService, InventoryRouter],
	exports: [InventoryRouter],
})
export class InventoryModule {}
