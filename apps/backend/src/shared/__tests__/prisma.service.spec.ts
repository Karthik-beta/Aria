import { PrismaService } from "../prisma.service";

describe("PrismaService", () => {
	let service: PrismaService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new PrismaService();

		// Replace the real client's lifecycle methods with spies
		// to avoid real database connections during tests
		service.client.$connect = jest.fn().mockResolvedValue(undefined);
		service.client.$disconnect = jest.fn().mockResolvedValue(undefined);
	});

	// ── Lifecycle Hooks ──────────────────────────────────────────────

	describe("onModuleInit", () => {
		it("calls $connect on the underlying client", async () => {
			await service.onModuleInit();
			expect(service.client.$connect).toHaveBeenCalledTimes(1);
		});
	});

	describe("onModuleDestroy", () => {
		it("calls $disconnect on the underlying client", async () => {
			await service.onModuleDestroy();
			expect(service.client.$disconnect).toHaveBeenCalledTimes(1);
		});
	});

	// ── Model Accessors ─────────────────────────────────────────────

	describe("model accessors", () => {
		const authModels = ["user", "session", "account", "verification"] as const;
		const inventoryModels = ["inventoryItem", "warehouse", "serialNo"] as const;

		const allModels = [...authModels, ...inventoryModels];

		it.each(allModels)(
			"exposes %s accessor delegating to the underlying client",
			(model) => {
				const accessor = service[model as keyof PrismaService];
				expect(accessor).toBeDefined();
				expect(accessor).toBe(
					service.client[model as keyof typeof service.client],
				);
			},
		);
	});

	// ── Transaction Support ─────────────────────────────────────────

	describe("$transaction", () => {
		it("is bound to the underlying client", () => {
			expect(typeof service.$transaction).toBe("function");
		});

		it("delegates to client.$transaction", async () => {
			const mockResult = [{ id: "1" }];
			service.client.$transaction = jest.fn().mockResolvedValue(mockResult);
			// Re-bind after replacing the mock
			service.$transaction = service.client.$transaction.bind(service.client);

			const result = await service.$transaction([]);
			expect(service.client.$transaction).toHaveBeenCalledWith([]);
			expect(result).toBe(mockResult);
		});
	});

	// ── Error Handling ──────────────────────────────────────────────

	describe("lifecycle error handling", () => {
		it("propagates $connect errors", async () => {
			const error = new Error("Connection refused");
			(service.client.$connect as jest.Mock).mockRejectedValue(error);

			await expect(service.onModuleInit()).rejects.toThrow(
				"Connection refused",
			);
		});

		it("propagates $disconnect errors", async () => {
			const error = new Error("Disconnect failed");
			(service.client.$disconnect as jest.Mock).mockRejectedValue(error);

			await expect(service.onModuleDestroy()).rejects.toThrow(
				"Disconnect failed",
			);
		});
	});
});
