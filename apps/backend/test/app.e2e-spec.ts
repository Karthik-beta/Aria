import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "./../src/app.module";
import { PrismaService } from "./../src/shared/prisma.service";

jest.mock("@thallesp/nestjs-better-auth", () => {
	const AuthModule = {
		forRoot() {
			return {
				module: AuthModule,
				global: true,
			};
		},
	};

	return {
		AllowAnonymous: () => () => undefined,
		AuthModule,
	};
});
jest.mock("better-auth", () => ({
	betterAuth: () => ({
		handler: jest.fn(),
	}),
}));
jest.mock("better-auth/adapters/prisma", () => ({
	prismaAdapter: jest.fn(),
}));
jest.mock("better-auth/plugins", () => ({
	customSession: jest.fn(),
	username: jest.fn(),
}));

describe("AppController (e2e)", () => {
	let app: INestApplication;
	let moduleFixture: TestingModule;

	beforeEach(async () => {
		moduleFixture = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		const prisma = moduleFixture.get(PrismaService);
		await app.close();
		await moduleFixture.close();
		await prisma.$disconnect();
	});

	it("/ (GET)", async () => {
		const server = app.getHttpServer() as Parameters<typeof request>[0];

		await request(server).get("/").expect(200).expect("Hello World!");
	});

	it("/health (GET)", async () => {
		const server = app.getHttpServer() as Parameters<typeof request>[0];

		const response = await request(server).get("/health").expect(200);

		expect(response.body).toMatchObject({
			status: "ok",
			service: "aria-backend",
		});
		expect(typeof response.body.timestamp).toBe("string");
	});

	it("/health/detailed (GET)", async () => {
		const server = app.getHttpServer() as Parameters<typeof request>[0];

		const response = await request(server).get("/health/detailed").expect(200);

		expect(response.body).toMatchObject({
			status: "ok",
			service: "aria-backend",
			environment: process.env.NODE_ENV || "development",
		});
		expect(response.body.system).toHaveProperty("platform", process.platform);
	});
});
