import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetAccountingService } from "../asset-accounting.service";
import { ASSET_CWIP_CAPITALIZATION_QUEUE } from "./cwip-capitalization.constants";
import { CwipCapitalizationProcessor } from "./cwip-capitalization.processor";
import { CwipCapitalizationDiscoveryService } from "./cwip-capitalization-discovery.service";
import { CwipCapitalizationPersistenceService } from "./cwip-capitalization-persistence.service";
import { CwipCapitalizationQueueClient } from "./cwip-capitalization-queue.client";
import { depreciationJobOptions } from "./depreciation.config";

/** Queue-backed CWIP capitalization execution without automatic scheduling. */
@Module({
	imports: [
		BullModule.registerQueue({
			name: ASSET_CWIP_CAPITALIZATION_QUEUE,
			defaultJobOptions: depreciationJobOptions(),
		}),
	],
	providers: [
		AssetAccountingService,
		CwipCapitalizationQueueClient,
		{
			provide: CwipCapitalizationPersistenceService,
			inject: [PrismaService, AssetAccountingService],
			useFactory: (prisma: PrismaService, accounting: AssetAccountingService) =>
				new CwipCapitalizationPersistenceService(prisma, accounting),
		},
		{
			provide: CwipCapitalizationDiscoveryService,
			inject: [PrismaService, CwipCapitalizationQueueClient],
			useFactory: (
				prisma: PrismaService,
				queue: CwipCapitalizationQueueClient,
			) => new CwipCapitalizationDiscoveryService(prisma, queue),
		},
		{
			provide: CwipCapitalizationProcessor,
			inject: [CwipCapitalizationPersistenceService],
			useFactory: (persistence: CwipCapitalizationPersistenceService) =>
				new CwipCapitalizationProcessor(persistence),
		},
	],
	exports: [
		CwipCapitalizationDiscoveryService,
		CwipCapitalizationPersistenceService,
		CwipCapitalizationProcessor,
		CwipCapitalizationQueueClient,
	],
})
export class CwipCapitalizationExecutionModule {}
