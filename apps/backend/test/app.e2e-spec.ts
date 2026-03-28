import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppController } from "../src/app.controller";
import { AppService } from "../src/app.service";

describe("AppController (e2e)", () => {
	async function createApp() {
		const moduleFixture = await Test.createTestingModule({
			controllers: [AppController],
			providers: [AppService],
		}).compile();

		const app = moduleFixture.createNestApplication();
		await app.init();

		return { app, moduleFixture };
	}

	it('returns "Hello World!" from the root route', async () => {
		const { app, moduleFixture } = await createApp();

		try {
			const response = await request(app.getHttpServer()).get("/").expect(200);

			expect(response.text).toBe("Hello World!");
		} finally {
			await app.close();
			await moduleFixture.close();
		}
	});

	it("returns the simplified health payload", async () => {
		const { app, moduleFixture } = await createApp();

		try {
			const response = await request(app.getHttpServer())
				.get("/health")
				.expect(200);

			expect(response.body).toMatchObject({
				status: "ok",
				service: "aria-backend",
			});
			expect(typeof response.body.timestamp).toBe("string");
			expect(response.body.timestamp).not.toBe("");
		} finally {
			await app.close();
			await moduleFixture.close();
		}
	});

	it("returns the detailed health payload", async () => {
		const { app, moduleFixture } = await createApp();

		try {
			const response = await request(app.getHttpServer())
				.get("/health/detailed")
				.expect(200);

			expect(response.body).toMatchObject({
				status: "ok",
				service: "aria-backend",
				environment: process.env.NODE_ENV || "development",
			});
			expect(response.body.system).toMatchObject({
				platform: process.platform,
			});
			expect(typeof response.body.uptime).toBe("number");
		} finally {
			await app.close();
			await moduleFixture.close();
		}
	});
});
