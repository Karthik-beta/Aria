import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
} from "@nestjs/common";
import type { InventoryService } from "./inventory.service";

@Injectable()
export class InventoryStartupService implements OnApplicationBootstrap {
	private readonly logger = new Logger(InventoryStartupService.name);

	constructor(private readonly inventoryService: InventoryService) {}

	async onApplicationBootstrap(): Promise<void> {
		try {
			const result =
				await this.inventoryService.preloadStandardUnitsOfMeasure();
			this.logger.log(
				`UOM preload completed (inserted: ${result.inserted}, total source rows: ${result.total})`,
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown preload error";
			const stack = error instanceof Error ? error.stack : undefined;

			this.logger.error(
				`UOM preload failed during startup; continuing without seeding standard units. Reason: ${message}`,
				stack,
			);
		}
	}
}
