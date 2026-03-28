import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import QuickStockBalancePage from "./page";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const WAREHOUSES = [
	{ id: "wh-001", name: "Stores - GH" },
	{ id: "wh-002", name: "Finished Goods - GH" },
];

const BALANCE_RESULT = {
	itemCode: "ITEM-001",
	itemName: "Test Widget",
	description: "A reliable test widget",
	barcodes: ["BC-001", "BC-002"],
	availableQty: 42,
	stockValue: 21000,
};

// ── Mock state ────────────────────────────────────────────────────────────────

let mockQueryData: typeof BALANCE_RESULT | undefined;
let mockQueryIsLoading = false;
let mockQueryIsFetching = false;
let mockQueryError: Error | null = null;

function resetQueryState() {
	mockQueryData = undefined;
	mockQueryIsLoading = false;
	mockQueryIsFetching = false;
	mockQueryError = null;
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: vi.fn(),
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
	}),
	useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				getQuickStockBalance: { invalidate: vi.fn() },
			},
		}),
		inventory: {
			listWarehouses: {
				useQuery: () => ({
					data: { items: WAREHOUSES },
					isLoading: false,
				}),
			},
			getQuickStockBalance: {
				useQuery: (_input: unknown, _options?: { enabled?: boolean }) => ({
					data: mockQueryData,
					isLoading: mockQueryIsLoading,
					isFetching: mockQueryIsFetching,
					error: mockQueryError,
				}),
			},
		},
	},
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("QuickStockBalancePage", () => {
	beforeEach(() => {
		resetQueryState();
	});

	it("renders the page heading", () => {
		renderWithProviders(<QuickStockBalancePage />);
		expect(
			screen.getByRole("heading", { name: /quick stock balance/i }),
		).toBeInTheDocument();
	});

	it("renders the Lookup Parameters card with required fields", () => {
		renderWithProviders(<QuickStockBalancePage />);
		expect(screen.getByLabelText(/select warehouse/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/lookup date/i)).toBeInTheDocument();
	});

	it("renders the mode toggle buttons and starts in Item Code mode", () => {
		renderWithProviders(<QuickStockBalancePage />);
		expect(
			screen.getByRole("button", { name: /item code/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /barcode/i }),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/item code/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/item barcode/i)).not.toBeInTheDocument();
	});

	it("switches to barcode input when Barcode mode is selected", async () => {
		const user = userEvent.setup();
		renderWithProviders(<QuickStockBalancePage />);

		await user.click(screen.getByRole("button", { name: /barcode/i }));

		expect(screen.getByLabelText(/item barcode/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/^item code$/i)).not.toBeInTheDocument();
	});

	it("renders Reset button and resets fields when clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<QuickStockBalancePage />);

		// Type something in the item code field
		const itemCodeInput = screen.getByLabelText(/item code/i);
		await user.type(itemCodeInput, "ITEM-001");
		expect(itemCodeInput).toHaveValue("ITEM-001");

		// Click reset
		await user.click(screen.getByRole("button", { name: /reset/i }));

		await waitFor(() => {
			expect(screen.getByLabelText(/item code/i)).toHaveValue("");
		});
	});

	it("shows item result when query returns data and renders the report link", async () => {
		mockQueryData = BALANCE_RESULT;

		const user = userEvent.setup();
		renderWithProviders(<QuickStockBalancePage />);

		// Fill in required fields so isQueryReady becomes true
		await user.click(screen.getByRole("combobox"));
		await user.click(
			await screen.findByRole("option", { name: "Stores - GH" }),
		);
		await user.type(screen.getByLabelText(/item code/i), "ITEM-001");

		await waitFor(() => {
			expect(screen.getByText("ITEM-001")).toBeInTheDocument();
			expect(screen.getByText("Test Widget")).toBeInTheDocument();
			expect(screen.getByText(/a reliable test widget/i)).toBeInTheDocument();

			// The View Stock Balance Report link text should be visible
			expect(
				screen.getByText(/view stock balance report/i),
			).toBeInTheDocument();
		});
	});

	it("displays Available Quantity and Stock Value KPI cards", async () => {
		mockQueryData = BALANCE_RESULT;

		const user = userEvent.setup();
		renderWithProviders(<QuickStockBalancePage />);

		await user.click(screen.getByRole("combobox"));
		await user.click(
			await screen.findByRole("option", { name: "Stores - GH" }),
		);
		await user.type(screen.getByLabelText(/item code/i), "ITEM-001");

		await waitFor(() => {
			// Use exact strings to target stat card labels, not the description paragraph
			expect(screen.getByText("Available Quantity")).toBeInTheDocument();
			expect(screen.getByText("Stock Value")).toBeInTheDocument();
		});
	});

	it("renders barcodes from the item when included in result", async () => {
		mockQueryData = BALANCE_RESULT;

		const user = userEvent.setup();
		renderWithProviders(<QuickStockBalancePage />);

		await user.click(screen.getByRole("combobox"));
		await user.click(
			await screen.findByRole("option", { name: "Stores - GH" }),
		);
		await user.type(screen.getByLabelText(/item code/i), "ITEM-001");

		await waitFor(() => {
			expect(screen.getByText("BC-001")).toBeInTheDocument();
			expect(screen.getByText("BC-002")).toBeInTheDocument();
		});
	});

	it("renders the View Stock Balance Report link text when lookup succeeds", async () => {
		mockQueryData = BALANCE_RESULT;

		const user = userEvent.setup();
		renderWithProviders(<QuickStockBalancePage />);

		await user.click(screen.getByRole("combobox"));
		await user.click(
			await screen.findByRole("option", { name: "Stores - GH" }),
		);
		await user.type(screen.getByLabelText(/item code/i), "ITEM-001");

		await waitFor(() => {
			expect(
				screen.getByText(/view stock balance report/i),
			).toBeInTheDocument();
		});
	});

	it("does not render the result section when no result is available", () => {
		mockQueryData = undefined;

		renderWithProviders(<QuickStockBalancePage />);

		expect(
			screen.queryByText(/view stock balance report/i),
		).not.toBeInTheDocument();
	});

	it("shows an error state when the query fails", async () => {
		mockQueryError = new Error("Item not found");

		const user = userEvent.setup();
		renderWithProviders(<QuickStockBalancePage />);

		await user.click(screen.getByRole("combobox"));
		await user.click(
			await screen.findByRole("option", { name: "Stores - GH" }),
		);
		await user.type(screen.getByLabelText(/item code/i), "ITEM-001");

		await waitFor(() => {
			expect(
				screen.getByRole("heading", {
					name: /could not load stock balance/i,
				}),
			).toBeInTheDocument();
			expect(
				screen.getByText(/item not found/i, { selector: "p" }),
			).toBeInTheDocument();
		});
	});
});
