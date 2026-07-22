import { Controller, Get } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves HealthCheckService from emitted runtime metadata.
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { AriaHealthIndicator } from "./health-indicator.service";

/** Exposes process liveness separately from dependency readiness. */
@Controller("health")
export class HealthController {
	constructor(
		private readonly health: HealthCheckService,
		private readonly indicator: AriaHealthIndicator,
	) {}

	@Get("live")
	live() {
		return {
			status: "ok",
			service: "aria-backend",
			uptime: process.uptime(),
			timestamp: new Date().toISOString(),
		};
	}

	@Get()
	@HealthCheck()
	compatibilityReady() {
		return this.ready();
	}

	@Get("ready")
	@HealthCheck()
	ready() {
		return this.health.check([
			() => this.indicator.database(),
			() => this.indicator.redisProducer(),
			() => this.indicator.worker(),
			() => this.indicator.queueEventsConnection(),
		]);
	}
}
