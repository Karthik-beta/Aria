import { auth } from "../../../auth/auth.config";
import type { PrismaService } from "../../../shared/prisma.service";
import type {
	TrpcContextType,
	TrpcRequestLike,
	TrpcResponseLike,
} from "../../../trpc/trpc.context";
import type { AssetService } from "../asset.service";
import { AssetRouter } from "./asset.router";

const getSessionMock = jest.fn();

const mockDashboardData = {
	kpis: {
		totalAssets: 12,
		activeAssets: 8,
		totalAssetValue: 950000,
		totalPurchaseValue: 1200000,
		totalDepreciation: 250000,
		maintenanceDueCount: 2,
		pendingAdjustments: 1,
		locationCount: 4,
	},
	statusDistribution: [],
	depreciationTrend: [],
	categoryValues: [],
	locationDistribution: [],
	maintenanceDue: [],
	recentActivity: [],
	adjustmentSummary: [],
	insuranceExpiry: [],
};

const mockDashboardOverviewData = {
	kpis: mockDashboardData.kpis,
	maintenanceDue: mockDashboardData.maintenanceDue,
	recentActivity: mockDashboardData.recentActivity,
	adjustmentSummary: mockDashboardData.adjustmentSummary,
	insuranceExpiry: mockDashboardData.insuranceExpiry,
};

const mockDashboardTopChartsData = {
	statusDistribution: mockDashboardData.statusDistribution,
	depreciationTrend: mockDashboardData.depreciationTrend,
};

const mockDashboardBottomChartsData = {
	categoryValues: mockDashboardData.categoryValues,
	locationDistribution: mockDashboardData.locationDistribution,
};

function createAssetServiceMock() {
	const base = {
		getDashboardData: jest.fn().mockResolvedValue(mockDashboardData),
		getDashboardOverviewData: jest
			.fn()
			.mockResolvedValue(mockDashboardOverviewData),
		getDashboardTopChartsData: jest
			.fn()
			.mockResolvedValue(mockDashboardTopChartsData),
		getDashboardBottomChartsData: jest
			.fn()
			.mockResolvedValue(mockDashboardBottomChartsData),
	};

	return new Proxy(base, {
		get(target, property) {
			if (property in target) {
				return target[property as keyof typeof target];
			}

			return jest.fn();
		},
	}) as unknown as AssetService & typeof base;
}

function createCaller(assetService: AssetService) {
	const ctx: TrpcContextType = {
		req: { headers: {} } as TrpcRequestLike,
		res: {} as TrpcResponseLike,
		prisma: {} as PrismaService,
	};

	return new AssetRouter(assetService).getRouter().createCaller(ctx);
}

const originalGetSessionDescriptor = Object.getOwnPropertyDescriptor(
	auth.api,
	"getSession",
);

describe("AssetRouter › dashboard queries", () => {
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

	it("returns the full and split dashboard contracts through the protected router", async () => {
		const assetService = createAssetServiceMock();
		const caller = createCaller(assetService);

		const [dashboardData, overviewData, topChartsData, bottomChartsData] =
			await Promise.all([
				caller.getDashboardData(),
				caller.getDashboardOverviewData(),
				caller.getDashboardTopChartsData(),
				caller.getDashboardBottomChartsData(),
			]);

		expect(assetService.getDashboardData).toHaveBeenCalledTimes(1);
		expect(assetService.getDashboardOverviewData).toHaveBeenCalledTimes(1);
		expect(assetService.getDashboardTopChartsData).toHaveBeenCalledTimes(1);
		expect(assetService.getDashboardBottomChartsData).toHaveBeenCalledTimes(1);
		expect(dashboardData).toEqual(mockDashboardData);
		expect(overviewData).toEqual(mockDashboardOverviewData);
		expect(topChartsData).toEqual(mockDashboardTopChartsData);
		expect(bottomChartsData).toEqual(mockDashboardBottomChartsData);
	});
});
