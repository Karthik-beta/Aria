import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "@/test/utils";
import { InventoryOverviewCharts } from "./charts-island";
import { InventoryOverviewClient } from "./overview-client";

const {
	mockInvalidateOverview,
	mockInvalidateTopCharts,
	mockInvalidateBottomCharts,
	mockRefetchOverview,
	mockRefetchTopCharts,
	mockRefetchBottomCharts,
	mockUseOverviewQuery,
	mockUseTopChartsQuery,
	mockUseBottomChartsQuery,
	mockUseSubscription,
} = vi.hoisted(() => ({
	mockInvalidateOverview: vi.fn().mockResolvedValue(undefined),
	mockInvalidateTopCharts: vi.fn().mockResolvedValue(undefined),
	mockInvalidateBottomCharts: vi.fn().mockResolvedValue(undefined),
	mockRefetchOverview: vi.fn(),
	mockRefetchTopCharts: vi.fn(),
	mockRefetchBottomCharts: vi.fn(),
	mockUseOverviewQuery: vi.fn(),
	mockUseTopChartsQuery: vi.fn(),
	mockUseBottomChartsQuery: vi.fn(),
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
			inventory: {
				getDashboardOverviewData: {
					invalidate: mockInvalidateOverview,
				},
				getDashboardTopChartsData: {
					invalidate: mockInvalidateTopCharts,
				},
				getDashboardBottomChartsData: {
					invalidate: mockInvalidateBottomCharts,
				},
			},
		}),
		inventory: {
			getDashboardOverviewData: {
				useQuery: mockUseOverviewQuery,
			},
			getDashboardTopChartsData: {
				useQuery: mockUseTopChartsQuery,
			},
			getDashboardBottomChartsData: {
				useQuery: mockUseBottomChartsQuery,
			},
			onStockEntriesChanged: {
				useSubscription: mockUseSubscription,
			},
			onItemsChanged: {
				useSubscription: mockUseSubscription,
			},
			onMaterialRequestsChanged: {
				useSubscription: mockUseSubscription,
			},
			onDeliveryNotesChanged: {
				useSubscription: mockUseSubscription,
			},
		},
	},
}));

function createOverviewData() {
	return {
		kpis: {
			totalItems: 38,
			activeWarehouses: 8,
			pendingMaterialRequests: 1,
			lowStockItemCount: 3,
			totalStockValue: 375000,
			totalStockQuantity: 2400,
		},
		itemGroupDistribution: [
			{ group: "Electronic Components", value: 180000, itemCount: 12 },
			{ group: "Raw Materials", value: 95000, itemCount: 9 },
		],
		recentActivity: [
			{
				id: "entry-1",
				series: "MAT-STE-2026-0001",
				type: "MATERIAL_RECEIPT",
				itemCode: "PCB-FR4-01",
				itemName: "FR-4 PCB",
				qty: 200,
				warehouse: "Peenya Main Warehouse",
				postingDate: new Date().toISOString(),
			},
		],
		lowStockItems: [
			{
				itemCode: "LOW-001",
				itemName: "Critical Resistor",
				currentQty: 5,
				safetyStock: 25,
				deficit: 20,
				warehouse: "All Warehouses",
			},
		],
		batchExpiry: [
			{
				batchId: "BATCH-001",
				itemCode: "RAW-SOLDER-01",
				itemName: "Solder Wire",
				warehouse: "Peenya Main Warehouse",
				quantity: 10,
				expiryDate: new Date("2026-05-01T00:00:00.000Z").toISOString(),
				daysUntilExpiry: 30,
			},
		],
		deliveryStatus: [
			{ status: "DRAFT", count: 1, totalAmount: 1000 },
			{ status: "COMPLETED", count: 4, totalAmount: 25000 },
		],
	};
}

function createTopChartsData() {
	return {
		stockMovements: [
			{ date: "2026-03-01", inbound: 120, outbound: 20 },
			{ date: "2026-03-02", inbound: 180, outbound: 75 },
		],
		warehouseStock: [
			{ warehouse: "Peenya Main Warehouse", itemCount: 20, totalQty: 1800 },
			{ warehouse: "Peenya Raw Material", itemCount: 12, totalQty: 850 },
		],
	};
}

function createBottomChartsData() {
	return {
		topMovingItems: [
			{
				itemCode: "PCB-FR4-01",
				itemName: "FR-4 PCB",
				totalQty: 400,
				transactionCount: 9,
			},
		],
		stockEntryTypeBreakdown: [
			{ type: "MATERIAL_RECEIPT", count: 8, totalQty: 500 },
			{ type: "MATERIAL_TRANSFER", count: 3, totalQty: 120 },
		],
	};
}

describe("OverviewPage", () => {
	beforeEach(() => {
		mockInvalidateOverview.mockClear();
		mockInvalidateTopCharts.mockClear();
		mockInvalidateBottomCharts.mockClear();
		mockRefetchOverview.mockClear();
		mockRefetchTopCharts.mockClear();
		mockRefetchBottomCharts.mockClear();
		mockUseSubscription.mockClear();
		mockUseOverviewQuery.mockReset();
		mockUseTopChartsQuery.mockReset();
		mockUseBottomChartsQuery.mockReset();

		mockUseOverviewQuery.mockReturnValue({
			data: createOverviewData(),
			isLoading: false,
			isFetching: false,
			error: null,
			refetch: mockRefetchOverview,
		});
		mockUseTopChartsQuery.mockReturnValue({
			data: createTopChartsData(),
			isLoading: false,
			isFetching: false,
			error: null,
			refetch: mockRefetchTopCharts,
		});
		mockUseBottomChartsQuery.mockReturnValue({
			data: createBottomChartsData(),
			isLoading: false,
			isFetching: false,
			error: null,
			refetch: mockRefetchBottomCharts,
		});
	});

	it("renders every dashboard tile with populated data", () => {
		renderWithProviders(
			<InventoryOverviewClient ChartsComponent={InventoryOverviewCharts} />,
		);

		for (const label of [
			"Inventory Dashboard",
			"Total Stock Value",
			"Active Items",
			"Low Stock Alerts",
			"Pending Material Requests",
			"Stock Movements",
			"Warehouse Distribution",
			"Stock Value by Category",
			"Stock Entry Breakdown",
			"Top Moving Items",
			"Recent Stock Activity",
			"Batch Expiry Tracker",
			"Delivery Status",
		]) {
			expect(screen.getAllByText(label)[0]).toBeInTheDocument();
		}
	});

	it("keeps the shell visible while chart queries are still loading", () => {
		mockUseTopChartsQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
			isFetching: true,
			error: null,
			refetch: mockRefetchTopCharts,
		});
		mockUseBottomChartsQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
			isFetching: true,
			error: null,
			refetch: mockRefetchBottomCharts,
		});

		renderWithProviders(
			<InventoryOverviewClient ChartsComponent={InventoryOverviewCharts} />,
		);

		expect(screen.getByText("Inventory Dashboard")).toBeInTheDocument();
		expect(screen.getAllByText("Low Stock Alerts")[0]).toBeInTheDocument();
		expect(screen.getAllByText("Batch Expiry Tracker")[0]).toBeInTheDocument();
		expect(screen.getAllByText("Delivery Status")[0]).toBeInTheDocument();
	});

	it("renders warning insight callouts when stock health needs attention", () => {
		renderWithProviders(
			<InventoryOverviewClient ChartsComponent={InventoryOverviewCharts} />,
		);

		expect(screen.getByText("8% of items need reorder")).toBeInTheDocument();
		expect(
			screen.getByText("Below safety stock threshold"),
		).toBeInTheDocument();
		expect(screen.getByText("1 request awaiting action")).toBeInTheDocument();
		expect(screen.getByText("View all requests →")).toBeInTheDocument();
	});

	it("renders positive insight callouts when stock health is clear", () => {
		mockUseOverviewQuery.mockReturnValue({
			data: {
				...createOverviewData(),
				kpis: {
					totalItems: 38,
					activeWarehouses: 8,
					pendingMaterialRequests: 0,
					lowStockItemCount: 0,
					totalStockValue: 375000,
					totalStockQuantity: 2400,
				},
			},
			isLoading: false,
			isFetching: false,
			error: null,
			refetch: mockRefetchOverview,
		});

		renderWithProviders(
			<InventoryOverviewClient ChartsComponent={InventoryOverviewCharts} />,
		);

		expect(
			screen.getByText("All items within safe limits"),
		).toBeInTheDocument();
		expect(screen.getByText("No reorder action needed")).toBeInTheDocument();
		expect(screen.getByText("Procurement up to date")).toBeInTheDocument();
		expect(screen.getByText("View all requests →")).toBeInTheDocument();
	});

	it("renders per-warehouse and avg-value insights from real kpi data", () => {
		renderWithProviders(
			<InventoryOverviewClient ChartsComponent={InventoryOverviewCharts} />,
		);

		expect(screen.getByText("~5 items per warehouse")).toBeInTheDocument();
		expect(
			screen.getByText("Tracking 8 storage locations"),
		).toBeInTheDocument();
	});

	it("renders chart empty states when data is empty or all zero", () => {
		mockUseOverviewQuery.mockReturnValue({
			data: {
				...createOverviewData(),
				itemGroupDistribution: [
					{ group: "Electronic Components", value: 0, itemCount: 10 },
				],
				recentActivity: [],
				lowStockItems: [],
				batchExpiry: [],
				deliveryStatus: [],
			},
			isLoading: false,
			isFetching: false,
			error: null,
			refetch: mockRefetchOverview,
		});
		mockUseTopChartsQuery.mockReturnValue({
			data: {
				stockMovements: [
					{ date: "2026-03-01", inbound: 0, outbound: 0 },
					{ date: "2026-03-02", inbound: 0, outbound: 0 },
				],
				warehouseStock: [
					{ warehouse: "Peenya Main Warehouse", itemCount: 2, totalQty: 0 },
				],
			},
			isLoading: false,
			isFetching: false,
			error: null,
			refetch: mockRefetchTopCharts,
		});
		mockUseBottomChartsQuery.mockReturnValue({
			data: {
				topMovingItems: [],
				stockEntryTypeBreakdown: [],
			},
			isLoading: false,
			isFetching: false,
			error: null,
			refetch: mockRefetchBottomCharts,
		});

		renderWithProviders(
			<InventoryOverviewClient ChartsComponent={InventoryOverviewCharts} />,
		);

		expect(
			screen.getByText("No committed stock movement yet"),
		).toBeInTheDocument();
		expect(
			screen.getByText("No warehouse stock to compare"),
		).toBeInTheDocument();
		expect(screen.getByText("No stock value recorded yet")).toBeInTheDocument();
		expect(screen.getByText("No fast movers yet")).toBeInTheDocument();
		expect(
			screen.getByText("No submitted stock entries yet"),
		).toBeInTheDocument();
		expect(
			screen.getByText("All items are above safety stock"),
		).toBeInTheDocument();
		expect(screen.getByText("No batches expiring soon")).toBeInTheDocument();
		expect(screen.getByText("No delivery notes yet")).toBeInTheDocument();
	});

	it("retries the overview query from the error state", () => {
		mockUseOverviewQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			isFetching: false,
			error: new Error("Dashboard failed"),
			refetch: mockRefetchOverview,
		});

		renderWithProviders(
			<InventoryOverviewClient ChartsComponent={InventoryOverviewCharts} />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));

		expect(mockRefetchOverview).toHaveBeenCalledTimes(1);
	});

	it("refreshes manually and invalidates all dashboard queries on realtime events", async () => {
		vi.useFakeTimers();

		try {
			renderWithProviders(
				<InventoryOverviewClient ChartsComponent={InventoryOverviewCharts} />,
			);

			fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

			expect(mockRefetchOverview).toHaveBeenCalledTimes(1);
			expect(mockRefetchTopCharts).toHaveBeenCalledTimes(1);
			expect(mockRefetchBottomCharts).toHaveBeenCalledTimes(1);
			expect(mockUseSubscription).toHaveBeenCalledTimes(4);

			const firstRealtimeHandler =
				mockUseSubscription.mock.calls[0]?.[1]?.onData;
			expect(firstRealtimeHandler).toBeTypeOf("function");

			await firstRealtimeHandler?.();
			await vi.advanceTimersByTimeAsync(250);

			expect(mockInvalidateOverview).toHaveBeenCalledTimes(1);
			expect(mockInvalidateTopCharts).toHaveBeenCalledTimes(1);
			expect(mockInvalidateBottomCharts).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
