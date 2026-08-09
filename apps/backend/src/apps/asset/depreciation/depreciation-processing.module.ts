import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaService } from "../../../shared/prisma.service";
import { CwipCapitalizationExecutionModule } from "./cwip-capitalization-execution.module";
import { DepreciationExecutionModule } from "./depreciation-execution.module";
import { DepreciationSchedulerService } from "./depreciation-scheduler.service";

/** Durable discovery, queueing, posting, and synchronization for depreciation. */
@Module({
	imports: [
		ScheduleModule.forRoot(),
		DepreciationExecutionModule,
		CwipCapitalizationExecutionModule,
	],
	providers: [PrismaService, DepreciationSchedulerService],
	exports: [
		DepreciationExecutionModule,
		CwipCapitalizationExecutionModule,
		DepreciationSchedulerService,
	],
})
export class DepreciationProcessingModule {}
