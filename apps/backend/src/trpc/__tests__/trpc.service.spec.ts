import { TrpcService } from "../trpc.service";

// Minimal mock sub-routers returning plain objects
const mockInventoryRouter = {
	getRouter: jest.fn().mockReturnValue({ inventory: true }),
};

const mockAdminRouter = {
	getRouter: jest.fn().mockReturnValue({ admin: true }),
};

describe("TrpcService", () => {
	let service: TrpcService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new TrpcService(
			mockInventoryRouter as never,
			mockAdminRouter as never,
		);
	});

	describe("before onModuleInit", () => {
		it("has a null appRouter", () => {
			expect(service.appRouter).toBeNull();
		});

		it("throws from getAppRouter when not yet initialized", () => {
			expect(() => service.getAppRouter()).toThrow("AppRouter not initialized");
		});
	});

	describe("onModuleInit", () => {
		it("builds and assigns the app router", () => {
			service.onModuleInit();

			expect(service.appRouter).not.toBeNull();
			expect(mockInventoryRouter.getRouter).toHaveBeenCalledTimes(1);
			expect(mockAdminRouter.getRouter).toHaveBeenCalledTimes(1);
		});
	});

	describe("getAppRouter", () => {
		it("returns the built router after initialization", () => {
			service.onModuleInit();

			const router = service.getAppRouter();
			expect(router).toBe(service.appRouter);
		});
	});
});
