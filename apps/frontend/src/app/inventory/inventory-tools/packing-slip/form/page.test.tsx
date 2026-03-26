import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import PackingSlipFormPage from "./page";

// ── Mock state ──────────────────────────────────────────────────────────────

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockSubmitMutate = vi.fn();
const mockCancelMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const mockPackingSlips = [
	{
		id: "clh123psl000001",
		series: "MAT-PAC-2026-00001",
		status: "DRAFT" as const,
		deliveryNoteId: "DN-2026-00001",
		fromCaseNo: 1,
		toCaseNo: 1,
		netWeightPkg: 10.5,
		netWeightUom: "kg",
		grossWeightPkg: 12.0,
		grossWeightUom: "kg",
		letterHead: null,
		items: [
			{
				id: "clh123pslitem01",
				packingSlipId: "clh123psl000001",
				deliveryNoteItemId: "clh123dnitem01",
				itemCode: "ITEM-001",
				itemName: "Widget A",
				description: null,
				qty: 5,
				netWeight: 2.1,
				weightUom: "kg",
				batchNo: null,
			},
		],
		createdAt: new Date("2026-03-26"),
		updatedAt: new Date("2026-03-26"),
	},
	{
		id: "clh123psl000002",
		series: "MAT-PAC-2026-00002",
		status: "SUBMITTED" as const,
		deliveryNoteId: "DN-2026-00002",
		fromCaseNo: 1,
		toCaseNo: 2,
		netWeightPkg: 20.0,
		netWeightUom: "kg",
		grossWeightPkg: null,
		grossWeightUom: null,
		letterHead: null,
		items: [],
		createdAt: new Date("2026-03-25"),
		updatedAt: new Date("2026-03-25"),
	},
];

const getMockSlipById = (id: string | null) =>
	mockPackingSlips.find((ps) => ps.id === id) ?? null;

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
		pathname: "/",
		query: {},
	}),
	useSearchParams: () => ({
		get: (key: string) => (key === "id" ? currentId : null),
	}),
}));

vi.mock("@hookform/resolvers/zod", () => ({
	zodResolver: () => async (values: unknown) => ({
		values,
		errors: {},
	}),
}));

vi.mock("@aria/types", () => ({
	Inventory: {
		createPackingSlipItemSchema: { shape: {} },
		createPackingSlipSchema: {
			shape: {},
		},
		updatePackingSlipSchema: {
			shape: {},
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listPackingSlips: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				getPackingSlipById: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			getPackingSlipById: {
				useQuery: () => ({
					data: getMockSlipById(currentId),
					isLoading: false,
				}),
			},
			getDeliveryNoteById: {
				useQuery: () => ({
					data: null,
					isLoading: false,
				}),
			},
			getRecommendedCaseNo: {
				useQuery: () => ({ data: undefined }),
			},
			createPackingSlip: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updatePackingSlip: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
			submitPackingSlip: {
				useMutation: () => ({
					isPending: false,
					mutate: mockSubmitMutate,
				}),
			},
			cancelPackingSlip: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCancelMutate,
				}),
			},
		},
	},
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PackingSlipFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockSubmitMutate.mockClear();
		mockCancelMutate.mockClear();
		mockPush.mockClear();
	});

	it("renders create form with Save button", () => {
		renderWithProviders(<PackingSlipFormPage />);

		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		expect(screen.getByText("New Packing Slip")).toBeInTheDocument();
	});

	it("renders Delivery Note field in create mode", () => {
		renderWithProviders(<PackingSlipFormPage />);

		expect(screen.getByLabelText(/Delivery Note/i)).toBeInTheDocument();
	});

	it("prefills edit form with series from data", async () => {
		currentId = "clh123psl000001";
		renderWithProviders(<PackingSlipFormPage />);

		await waitFor(() => {
			expect(
				screen.getByDisplayValue("MAT-PAC-2026-00001"),
			).toBeInTheDocument();
		});
	});

	it("shows Submit button for DRAFT slip in edit mode", async () => {
		currentId = "clh123psl000001";
		renderWithProviders(<PackingSlipFormPage />);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Submit" }),
			).toBeInTheDocument();
		});
	});

	it("shows Cancel Slip button for SUBMITTED slip in edit mode", async () => {
		currentId = "clh123psl000002";
		renderWithProviders(<PackingSlipFormPage />);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Cancel Slip" }),
			).toBeInTheDocument();
		});
	});

	it("hides Save button for SUBMITTED slip (readonly mode)", async () => {
		currentId = "clh123psl000002";
		renderWithProviders(<PackingSlipFormPage />);

		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: "Save" }),
			).not.toBeInTheDocument();
		});
	});

	it("submits update payload in edit mode", async () => {
		currentId = "clh123psl000001";
		const user = userEvent.setup();
		renderWithProviders(<PackingSlipFormPage />);

		await waitFor(() => {
			expect(
				screen.getByDisplayValue("MAT-PAC-2026-00001"),
			).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ id: "clh123psl000001" }),
			);
		});
	});

	it("calls submitPackingSlip when Submit is clicked", async () => {
		currentId = "clh123psl000001";
		const user = userEvent.setup();
		renderWithProviders(<PackingSlipFormPage />);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Submit" }),
			).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() => {
			expect(mockSubmitMutate).toHaveBeenCalledWith({
				id: "clh123psl000001",
			});
		});
	});

	it("calls cancelPackingSlip when Cancel Slip is clicked", async () => {
		currentId = "clh123psl000002";
		const user = userEvent.setup();
		renderWithProviders(<PackingSlipFormPage />);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Cancel Slip" }),
			).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Cancel Slip" }));

		await waitFor(() => {
			expect(mockCancelMutate).toHaveBeenCalledWith({
				id: "clh123psl000002",
			});
		});
	});

	it("redirects to list when edit id is not found", async () => {
		currentId = "missing-id";
		renderWithProviders(<PackingSlipFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/inventory/inventory-tools/packing-slip",
			);
		});
	});

	it("adds an item row when Add Row is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<PackingSlipFormPage />);

		// Switch to items tab
		await user.click(screen.getByRole("tab", { name: /Items/i }));

		// Empty state text
		expect(
			screen.getByText(/Enter a Delivery Note above/i),
		).toBeInTheDocument();

		// Click Add Row
		await user.click(screen.getByRole("button", { name: /Add Row/i }));

		// Row should be added (empty state text disappears)
		expect(
			screen.queryByText(/Enter a Delivery Note above/i),
		).not.toBeInTheDocument();
	});
});
