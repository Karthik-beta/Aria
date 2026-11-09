import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DepreciationExecutionModule } from "./depreciation-execution.module";
import { DepreciationSchedulerService } from "./depreciation-scheduler.service";

/** Durable discovery, queueing, posting, and synchronization for depreciation. */
@Module({
	imports: [ScheduleModule.forRoot(), DepreciationExecutionModule],
	providers: [DepreciationSchedulerService],
	exports: [DepreciationExecutionModule, DepreciationSchedulerService],
})
export class DepreciationProcessingModule {}
