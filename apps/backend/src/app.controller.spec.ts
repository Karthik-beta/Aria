import { Test, type TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

jest.mock("@thallesp/nestjs-better-auth", () => ({
	AllowAnonymous: () => () => undefined,
}));

describe("AppController", () => {
	let appController: AppController;

	beforeEach(async () => {
		const app: TestingModule = await Test.createTestingModule({
			controllers: [AppController],
			providers: [AppService],
		}).compile();

		appController = app.get<AppController>(AppController);
	});

	describe("root", () => {
		it('should return "Hello World!"', () => {
			expect(appController.getHello()).toBe("Hello World!");
		});
	});

	describe("health endpoints", () => {
		it("should return simplified health payload", () => {
			const result = appController.getHealth();

			expect(result).toMatchObject({
				status: "ok",
				service: "aria-backend",
			});
			expect(typeof result.timestamp).toBe("string");
			expect(result.timestamp).not.toHaveLength(0);
		});

		it("should return detailed health payload", () => {
			const result = appController.getDetailedHealth();

			expect(result).toMatchObject({
				status: "ok",
				service: "aria-backend",
				system: expect.objectContaining({
					platform: process.platform,
				}),
			});
			expect(typeof result.uptime).toBe("number");
			expect(result.environment).toBe(process.env.NODE_ENV || "development");
		});
	});
});
