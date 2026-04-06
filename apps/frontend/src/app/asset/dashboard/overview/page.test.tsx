import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "@/test/utils";
import { AssetOverviewCharts } from "./charts-island";
import { AssetOverviewClient } from "./overview-client";

const { mockInvalidate, mockRefetch, mockUseQuery, mockUseSubscription } =
	vi.hoisted(() => ({
		mockInvalidate: vi.fn().mockResolvedValue(undefined),
		mockRefetch: vi.fn(),
		mockUseQuery: vi.fn(),
		mockUseSubscription: vi.fn(),
	}));

vi.mock("next/dynamic", () => ({
	default: () => () => null,
}));

vi.mock("@/components/ui/chart", () => ({
	ChartContainer: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="chart-container">{children}</div>
	),
	ChartTooltip: ({ content }: { content: React.ReactNode }) => content,
	ChartTooltipContent: () => <div>tooltip</div>,
}));

vi.mock("recharts", () => ({
	AreaChart: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="area-chart">{children}</div>
	),
	BarChart: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="bar-chart">{children}</div>
	),
	PieChart: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="pie-chart">{children}</div>
	),
	Area: () => null,
	Bar: () => null,
	Pie: () => null,
	CartesianGrid: () => null,
	XAxis: () => null,
	YAxis: () => null,
	Label: () => null,
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				getDashboardData: {
					invalidate: mockInvalidate,
				},
			},
		}),
		asset: {
			getDashboardData: {
				useQuery: mockUseQuery,
			},
			onAssetsChanged: {
				useSubscription: mockUseSubscription,
			},
			onAssetValueAdjustmentsChanged: {
				useSubscription: mockUseSubscription,
			},
			onAssetMaintenancesChanged: {
				useSubscription: mockUseSubscription,
			},
		},
	},
}));

function createDashboardData() {
	return {
		kpis: {
			totalAssets: 13,
			activeAssets: 8,
			totalAssetValue: 950_000,
			totalPurchaseValue: 1_500_000,
			totalDepreciation: 350_000,
			maintenanceDueCount: 2,
			pendingAdjustments: 1,
			locationCount: 5,
		},
		statusDistribution: [
			{ status: "SUBMITTED", count: 4, value: 400_000 },
			{ status: "PARTIALLY_DEPRECIATED", count: 3, value: 350_000 },
			{ status: "FULLY_DEPRECIATED", count: 2, value: 0 },
			{ status: "IN_MAINTENANCE", count: 1, value: 100_000 },
			{ status: "SOLD", count: 2, value: 0 },
			{ status: "SCRAPPED", count: 1, value: 0 },
		],
		depreciationTrend: [
			{ month: "2025-01", amount: 25_000 },
			{ month: "2025-02", amount: 28_000 },
			{ month: "2025-03", amount: 27_500 },
		],
		categoryValues: [
			{
				category: "SMT & PCB Assembly Equipment",
				purchaseValue: 800_000,
				currentValue: 500_000,
				assetCount: 5,
			},
			{
				category: "IT Infrastructure",
				purchaseValue: 300_000,
				currentValue: 200_000,
				assetCount: 4,
			},
		],
		locationDistribution: [
			{
				location: "Peenya Phase 2 - Building A",
				assetCount: 6,
				totalValue: 600_000,
			},
			{
				location: "Electronic City - Tower B",
				assetCount: 4,
				totalValue: 250_000,
			},
		],
		maintenanceDue: [
			{
				taskId: "task-1",
				assetName: "SMT Pick & Place - Yamaha YSM20R",
				maintenanceTask: "Nozzle Calibration",
				maintenanceType: "PREVENTIVE",
				assignToName: "Rajesh K.",
				nextDueDate: new Date().toISOString(),
				daysUntilDue: -2,
				periodicity: "MONTHLY",
			},
			{
				taskId: "task-2",
				assetName: "HP ProBook 450 G10 (Batch)",
				maintenanceTask: "Software Update",
				maintenanceType: "PREVENTIVE",
				assignToName: null,
				nextDueDate: new Date().toISOString(),
				daysUntilDue: 14,
				periodicity: "QUARTERLY",
			},
		],
		recentActivity: [
			{
				id: "act-1",
				assetId: "asset-1",
				assetName: "SMT Pick & Place - Yamaha YSM20R",
				assetSeries: "AST-2025-00001",
				activity: "Created",
				createdAt: new Date().toISOString(),
			},
		],
		adjustmentSummary: [
			{ status: "DRAFT", count: 1, totalAmount: 25_000 },
			{ status: "SUBMITTED", count: 3, totalAmount: 150_000 },
		],
		insuranceExpiry: [
			{
				assetId: "asset-1",
				assetName: "Reflow Oven - Heller 1913 MK5",
				insurer: "ICICI Lombard",
				policyNumber: "POL-2025-001",
				insuredValue: 800_000,
				insuranceEndDate: new Date().toISOString(),
				daysUntilExpiry: 15,
			},
		],
	};
}

describe("OverviewPage", () => {
	beforeEach(() => {
		mockInvalidate.mockClear();
		mockRefetch.mockClear();
		mockUseSubscription.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockReturnValue({
			data: createDashboardData(),
			isLoading: false,
			error: null,
			refetch: mockRefetch,
		});
	});

	it("renders every dashboard tile with populated data", () => {
		renderWithProviders(
			<AssetOverviewClient ChartsComponent={AssetOverviewCharts} />,
		);

		for (const label of [
			"Asset Dashboard",
			"Total Asset Value",
			"Active Assets",
			"Maintenance Due",
			"Pending Adjustments",
			"Depreciation Trend",
			"Status Distribution",
			"Value by Category",
			"Asset Value by Location",
			"Recent Asset Activity",
			"Insurance Expiry",
			"Value Adjustments",
		]) {
			expect(screen.getAllByText(label)[0]).toBeInTheDocument();
		}
	});

	it("renders KPI insight callouts from real kpi data", () => {
		renderWithProviders(
			<AssetOverviewClient ChartsComponent={AssetOverviewCharts} />,
		);

		// Asset value: 950_000 / 1_500_000 = 63% retained
		expect(screen.getByText("63% value retained")).toBeInTheDocument();
		expect(screen.getByText("Purchase cost ₹15.0L")).toBeInTheDocument();

		// Active assets: 8 / 13 = 62% operational
		expect(screen.getByText("62% operational")).toBeInTheDocument();
		expect(screen.getByText("Across 5 locations")).toBeInTheDocument();

		// Maintenance due: 2 tasks
		expect(screen.getByText("2 tasks due now")).toBeInTheDocument();

		// Pending adjustments: 1 draft
		expect(screen.getByText("1 draft awaiting review")).toBeInTheDocument();
	});

	it("renders positive insight callouts when asset health is clear", () => {
		mockUseQuery.mockReturnValue({
			data: {
				...createDashboardData(),
				kpis: {
					totalAssets: 13,
					activeAssets: 13,
					totalAssetValue: 1_500_000,
					totalPurchaseValue: 1_500_000,
					totalDepreciation: 0,
					maintenanceDueCount: 0,
					pendingAdjustments: 0,
					locationCount: 5,
				},
			},
			isLoading: false,
			error: null,
			refetch: mockRefetch,
		});

		renderWithProviders(
			<AssetOverviewClient ChartsComponent={AssetOverviewCharts} />,
		);

		expect(screen.getByText("All maintenance up to date")).toBeInTheDocument();
		expect(screen.getByText("No pending adjustments")).toBeInTheDocument();
	});

	it("renders chart empty states when data arrays are empty or all zero", () => {
		mockUseQuery.mockReturnValue({
			data: {
				...createDashboardData(),
				depreciationTrend: [{ month: "2025-01", amount: 0 }],
				statusDistribution: [],
				categoryValues: [
					{
						category: "Test",
						purchaseValue: 0,
						currentValue: 0,
						assetCount: 0,
					},
				],
				locationDistribution: [
					{ location: "Test", assetCount: 0, totalValue: 0 },
				],
				maintenanceDue: [],
				recentActivity: [],
				insuranceExpiry: [],
				adjustmentSummary: [],
			},
			isLoading: false,
			error: null,
			refetch: mockRefetch,
		});

		renderWithProviders(
			<AssetOverviewClient ChartsComponent={AssetOverviewCharts} />,
		);

		expect(screen.getByText("No depreciation data yet")).toBeInTheDocument();
		expect(screen.getByText("No assets registered yet")).toBeInTheDocument();
		expect(screen.getByText("No categorised assets yet")).toBeInTheDocument();
		expect(screen.getByText("No location data yet")).toBeInTheDocument();
		expect(screen.getByText("No maintenance tasks due")).toBeInTheDocument();
		expect(screen.getByText("No recent asset activity")).toBeInTheDocument();
		expect(screen.getByText("No policies expiring soon")).toBeInTheDocument();
		expect(screen.getByText("No value adjustments yet")).toBeInTheDocument();
	});

	it("retries the query from the error state", () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error("Dashboard failed"),
			refetch: mockRefetch,
		});

		renderWithProviders(
			<AssetOverviewClient ChartsComponent={AssetOverviewCharts} />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));

		expect(mockRefetch).toHaveBeenCalledTimes(1);
	});

	it("refreshes manually and invalidates the dashboard on realtime events", async () => {
		renderWithProviders(
			<AssetOverviewClient ChartsComponent={AssetOverviewCharts} />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

		expect(mockRefetch).toHaveBeenCalledTimes(1);
		expect(mockUseSubscription).toHaveBeenCalledTimes(3);

		const firstRealtimeHandler = mockUseSubscription.mock.calls[0]?.[1]?.onData;
		expect(firstRealtimeHandler).toBeTypeOf("function");

		await firstRealtimeHandler?.();

		expect(mockInvalidate).toHaveBeenCalledTimes(1);
	});
});
