import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { DepreciationProcessingModule } from "../apps/asset/depreciation/depreciation-processing.module";
import { DatabaseModule } from "../shared/database.module";
import { HealthController } from "./health.controller";
import { AriaHealthIndicator } from "./health-indicator.service";

/** Readiness and liveness endpoints used by Docker and operators. */
@Module({
	imports: [TerminusModule, DatabaseModule, DepreciationProcessingModule],
	controllers: [HealthController],
	providers: [AriaHealthIndicator],
})
export class HealthModule {}
