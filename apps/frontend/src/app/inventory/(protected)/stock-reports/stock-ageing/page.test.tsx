import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fireEvent,
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
} from "@/test/utils";
import StockAgeingPage from "./page";

const { mockInvalidate, mockUseQuery, mockUseSubscription } = vi.hoisted(
	() => ({
		mockInvalidate: vi.fn().mockResolvedValue(undefined),
		mockUseQuery: vi.fn(),
		mockUseSubscription: vi.fn(),
	}),
);

vi.mock("@/components/ui/chart", () => ({
	ChartContainer: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	ChartTooltip: ({ content }: { content: React.ReactNode }) => content,
	ChartTooltipContent: () => <div>tooltip</div>,
}));

vi.mock("recharts", () => ({
	Bar: () => null,
	BarChart: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CartesianGrid: () => null,
	XAxis: () => null,
	YAxis: () => null,
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listStockAgeing: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listStockAgeing: {
				useQuery: mockUseQuery,
			},
			onStockEntriesChanged: {
				useSubscription: mockUseSubscription,
			},
		},
	},
}));

describe("StockAgeingPage", () => {
	beforeEach(() => {
		mockInvalidate.mockClear();
		mockUseSubscription.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockImplementation(() => ({
			data: [
				{
					id: "Aria Corp::ITEM-001",
					company: "Aria Corp",
					itemCode: "ITEM-001",
					itemName: "iPhone 13",
					description: "128 GB",
					itemGroupName: "Phones",
					brandName: "Apple",
					warehouse: null,
					unitOfMeasure: "Nos",
					availableQty: 11,
					averageAge: 82,
					averageRate: 45000,
					asOfDate: new Date("2026-03-24T00:00:00.000Z"),
					buckets: [
						{ index: 0, minAge: 0, maxAge: 30, quantity: 3, value: 135000 },
						{ index: 1, minAge: 31, maxAge: 60, quantity: 2, value: 90000 },
						{ index: 2, minAge: 61, maxAge: 90, quantity: 6, value: 270000 },
						{ index: 3, minAge: 91, maxAge: null, quantity: 0, value: 0 },
					],
				},
			],
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		}));
	});

	it("renders the stock ageing header and table row", () => {
		renderWithProviders(<StockAgeingPage />);

		expect(screen.getByText("Stock Ageing")).toBeInTheDocument();
		expect(screen.getByText("ITEM-001")).toBeInTheDocument();
		expect(screen.getByText("iPhone 13")).toBeInTheDocument();
	});

	it("passes ageing range changes into the report query", async () => {
		renderWithProviders(<StockAgeingPage />);

		fireEvent.change(screen.getByLabelText("Filter by ageing ranges"), {
			target: { value: "15, 45, 90" },
		});

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({
					ageingRanges: "15, 45, 90",
					take: 250,
				}),
				expect.objectContaining({ enabled: true }),
			);
		});
	});

	it("toggles warehouse-wise mode in the backend query", async () => {
		const user = userEvent.setup();
		renderWithProviders(<StockAgeingPage />);

		await user.click(screen.getByLabelText("Show warehouse-wise stock"));

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({ showWarehouseWiseStock: true }),
				expect.objectContaining({ enabled: true }),
			);
		});
	});

	it("shows client-side validation feedback for invalid ageing ranges", async () => {
		renderWithProviders(<StockAgeingPage />);

		fireEvent.change(screen.getByLabelText("Filter by ageing ranges"), {
			target: { value: "30, bad, 90" },
		});

		await waitFor(() => {
			expect(
				screen.getByText(
					"Ageing ranges must be comma-separated positive integers",
				),
			).toBeInTheDocument();
		});

		expect(mockUseQuery).toHaveBeenLastCalledWith(
			expect.any(Object),
			expect.objectContaining({ enabled: false }),
		);
	});
});
