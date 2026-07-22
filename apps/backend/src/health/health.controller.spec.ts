import { describe, expect, it, mock } from "bun:test";
import { TerminusModule } from "@nestjs/terminus";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { HealthController } from "./health.controller";
import { AriaHealthIndicator } from "./health-indicator.service";

function up(key: string) {
	return { [key]: { status: "up" as const } };
}

describe("HealthController", () => {
	async function createApp(redisReady: boolean) {
		const indicator = {
			database: mock(async () => up("postgres")),
			redisProducer: mock(async () =>
				redisReady
					? up("redis-producer")
					: {
							"redis-producer": {
								status: "down" as const,
								message: "Redis unavailable",
							},
						},
			),
			worker: mock(async () => up("depreciation-worker")),
			queueEventsConnection: mock(async () => up("depreciation-queue-events")),
		};
		const testingModule = await Test.createTestingModule({
			imports: [TerminusModule],
			controllers: [HealthController],
			providers: [{ provide: AriaHealthIndicator, useValue: indicator }],
		}).compile();
		const app = testingModule.createNestApplication();
		await app.init();
		return { app, testingModule };
	}

	it("keeps process liveness independent of dependencies", async () => {
		const { app, testingModule } = await createApp(false);
		try {
			const response = await request(app.getHttpServer())
				.get("/health/live")
				.expect(200);
			expect(response.body.status).toBe("ok");
		} finally {
			await app.close();
			await testingModule.close();
		}
	});

	it("returns 200 for readiness and its compatibility alias", async () => {
		const { app, testingModule } = await createApp(true);
		try {
			await request(app.getHttpServer()).get("/health/ready").expect(200);
			await request(app.getHttpServer()).get("/health").expect(200);
		} finally {
			await app.close();
			await testingModule.close();
		}
	});

	it("returns 503 when Redis is unavailable", async () => {
		const { app, testingModule } = await createApp(false);
		try {
			const response = await request(app.getHttpServer())
				.get("/health/ready")
				.expect(503);
			expect(response.body.status).toBe("error");
			expect(response.body.error["redis-producer"].status).toBe("down");
		} finally {
			await app.close();
			await testingModule.close();
		}
	});
});
