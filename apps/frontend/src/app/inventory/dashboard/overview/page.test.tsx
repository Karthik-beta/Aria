import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "@/test/utils";
import OverviewPage from "./page";

const { mockInvalidate, mockRefetch, mockUseQuery, mockUseSubscription } =
	vi.hoisted(() => ({
		mockInvalidate: vi.fn().mockResolvedValue(undefined),
		mockRefetch: vi.fn(),
		mockUseQuery: vi.fn(),
		mockUseSubscription: vi.fn(),
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
				getDashboardData: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			getDashboardData: {
				useQuery: mockUseQuery,
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

function createDashboardData() {
	return {
		kpis: {
			totalItems: 38,
			activeWarehouses: 8,
			pendingMaterialRequests: 1,
			lowStockItemCount: 3,
			totalStockValue: 375000,
			totalStockQuantity: 2400,
		},
		stockMovements: [
			{ date: "2026-03-01", inbound: 120, outbound: 20 },
			{ date: "2026-03-02", inbound: 180, outbound: 75 },
		],
		warehouseStock: [
			{ warehouse: "Peenya Main Warehouse", itemCount: 20, totalQty: 1800 },
			{ warehouse: "Peenya Raw Material", itemCount: 12, totalQty: 850 },
		],
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
		renderWithProviders(<OverviewPage />);

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

	it("renders warning insight callouts when stock health needs attention", () => {
		// createDashboardData has lowStockItemCount=3 (of 38) and pendingMaterialRequests=1
		renderWithProviders(<OverviewPage />);

		// Low stock: Math.round(3 / 38 * 100) = 8% of items need reorder
		expect(screen.getByText("8% of items need reorder")).toBeInTheDocument();
		expect(
			screen.getByText("Below safety stock threshold"),
		).toBeInTheDocument();

		// Pending requests: 1 request awaiting action
		expect(screen.getByText("1 request awaiting action")).toBeInTheDocument();
		// Card 4 always shows the footer link (not the subtext)
		expect(screen.getByText("View all requests →")).toBeInTheDocument();
	});

	it("renders positive insight callouts when stock health is clear", () => {
		mockUseQuery.mockReturnValue({
			data: {
				...createDashboardData(),
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
			error: null,
			refetch: mockRefetch,
		});

		renderWithProviders(<OverviewPage />);

		expect(
			screen.getByText("All items within safe limits"),
		).toBeInTheDocument();
		expect(screen.getByText("No reorder action needed")).toBeInTheDocument();

		expect(screen.getByText("Procurement up to date")).toBeInTheDocument();
		// Card 4 shows FooterLink as the second footer line
		expect(screen.getByText("View all requests →")).toBeInTheDocument();
	});

	it("renders per-warehouse and avg-value insights from real kpi data", () => {
		renderWithProviders(<OverviewPage />);

		// Active Items: Math.round(38 / 8) = 5 items per warehouse
		expect(screen.getByText("~5 items per warehouse")).toBeInTheDocument();
		expect(
			screen.getByText("Tracking 8 storage locations"),
		).toBeInTheDocument();
	});

	it("renders chart empty states when data is empty or all zero", () => {
		mockUseQuery.mockReturnValue({
			data: {
				...createDashboardData(),
				stockMovements: [
					{ date: "2026-03-01", inbound: 0, outbound: 0 },
					{ date: "2026-03-02", inbound: 0, outbound: 0 },
				],
				warehouseStock: [
					{ warehouse: "Peenya Main Warehouse", itemCount: 2, totalQty: 0 },
				],
				itemGroupDistribution: [
					{ group: "Electronic Components", value: 0, itemCount: 10 },
				],
				topMovingItems: [],
				stockEntryTypeBreakdown: [],
				recentActivity: [],
				lowStockItems: [],
				batchExpiry: [],
				deliveryStatus: [],
			},
			isLoading: false,
			error: null,
			refetch: mockRefetch,
		});

		renderWithProviders(<OverviewPage />);

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

	it("retries the query from the error state", () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error("Dashboard failed"),
			refetch: mockRefetch,
		});

		renderWithProviders(<OverviewPage />);

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));

		expect(mockRefetch).toHaveBeenCalledTimes(1);
	});

	it("refreshes manually and invalidates the dashboard on realtime events", async () => {
		renderWithProviders(<OverviewPage />);

		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

		expect(mockRefetch).toHaveBeenCalledTimes(1);
		expect(mockUseSubscription).toHaveBeenCalledTimes(4);

		const firstRealtimeHandler = mockUseSubscription.mock.calls[0]?.[1]?.onData;
		expect(firstRealtimeHandler).toBeTypeOf("function");

		await firstRealtimeHandler?.();

		expect(mockInvalidate).toHaveBeenCalledTimes(1);
	});
});
