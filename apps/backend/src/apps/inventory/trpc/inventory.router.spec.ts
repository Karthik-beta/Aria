import { auth } from "../../../auth/auth.config";
import type { PrismaService } from "../../../shared/prisma.service";
import type {
	TrpcContextType,
	TrpcRequestLike,
	TrpcResponseLike,
} from "../../../trpc/trpc.context";
import type { InventoryService } from "../inventory.service";
import { InventoryRouter } from "./inventory.router";

const getSessionMock = jest.fn();

const mockDashboardData = {
	kpis: {
		totalItems: 3,
		activeWarehouses: 2,
		pendingMaterialRequests: 1,
		lowStockItemCount: 1,
		totalStockValue: 12_500,
		totalStockQuantity: 75,
	},
	stockMovements: [],
	warehouseStock: [],
	itemGroupDistribution: [],
	recentActivity: [],
	lowStockItems: [],
	batchExpiry: [],
	deliveryStatus: [],
	topMovingItems: [],
	stockEntryTypeBreakdown: [],
};

function createInventoryServiceMock() {
	const base = {
		getDashboardData: jest.fn().mockResolvedValue(mockDashboardData),
	};

	return new Proxy(base, {
		get(target, property) {
			if (property in target) {
				return target[property as keyof typeof target];
			}

			return jest.fn();
		},
	}) as unknown as InventoryService & typeof base;
}

function createCaller(inventoryService: InventoryService) {
	const ctx: TrpcContextType = {
		req: { headers: {} } as TrpcRequestLike,
		res: {} as TrpcResponseLike,
		prisma: {} as PrismaService,
	};

	return new InventoryRouter(inventoryService).getRouter().createCaller(ctx);
}

const originalGetSessionDescriptor = Object.getOwnPropertyDescriptor(
	auth.api,
	"getSession",
);

describe("InventoryRouter › getDashboardData", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		Object.defineProperty(auth.api, "getSession", {
			value: getSessionMock,
			configurable: true,
		});
		getSessionMock.mockResolvedValue({
			user: {
				id: "user-1",
				email: "admin@aria.local",
				emailVerified: true,
				name: "System Administrator",
				createdAt: new Date("2026-04-01T00:00:00.000Z"),
				updatedAt: new Date("2026-04-01T00:00:00.000Z"),
			},
			session: {
				id: "session-1",
				userId: "user-1",
				expiresAt: new Date("2026-04-08T00:00:00.000Z"),
			},
		});
	});

	afterEach(() => {
		if (originalGetSessionDescriptor) {
			Object.defineProperty(
				auth.api,
				"getSession",
				originalGetSessionDescriptor,
			);
			return;
		}

		Reflect.deleteProperty(auth.api, "getSession");
	});

	it("returns the unchanged dashboard contract through the protected router", async () => {
		const inventoryService = createInventoryServiceMock();
		const caller = createCaller(inventoryService);

		const result = await caller.getDashboardData();

		expect(inventoryService.getDashboardData).toHaveBeenCalledTimes(1);
		expect(result).toEqual(mockDashboardData);
		expect(result).toMatchObject({
			kpis: expect.any(Object),
			stockMovements: expect.any(Array),
			warehouseStock: expect.any(Array),
			itemGroupDistribution: expect.any(Array),
			recentActivity: expect.any(Array),
			lowStockItems: expect.any(Array),
			batchExpiry: expect.any(Array),
			deliveryStatus: expect.any(Array),
			topMovingItems: expect.any(Array),
			stockEntryTypeBreakdown: expect.any(Array),
		});
	});
});
