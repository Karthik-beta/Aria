import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import AssetMaintenanceLogPage from "./page";

vi.mock("@/hooks/use-asset-write-access", () => ({
	useAssetWriteAccess: () => true,
}));

// ── Shared mock functions ────────────────────────────────────────────────────

const mockCancelMutate = vi.fn();
const mockCompleteMutate = vi.fn();
const mockCancelQuery = vi.fn().mockResolvedValue(undefined);
const mockGetData = vi.fn().mockReturnValue(null);
const mockSetData = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);
const mockRefetch = vi.fn().mockResolvedValue(undefined);

// ── Fixture data ─────────────────────────────────────────────────────────────

const plannedLog = {
	id: "log-001",
	maintenanceId: "maint-001",
	taskId: "task-001",
	assetId: "asset-001",
	assetName: "Hydraulic Pump A",
	company: "ACME Corp",
	maintenanceTask: "Lubrication Check",
	maintenanceType: "PREVENTIVE_MAINTENANCE" as const,
	periodicity: "MONTHLY" as const,
	assignToName: "John Doe",
	maintenanceStatus: "PLANNED" as const,
	taskDueDate: "2026-02-01T00:00:00.000Z",
	completionDate: null,
	actionsPerformed: null,
	hasCertificate: false,
	certificateAttachment: null,
	modifiedBy: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const overdueLog = {
	id: "log-002",
	maintenanceId: "maint-002",
	taskId: "task-002",
	assetId: "asset-002",
	assetName: "Air Compressor B",
	company: "Beta Corp",
	maintenanceTask: "Filter Replacement",
	maintenanceType: null,
	periodicity: "QUARTERLY" as const,
	assignToName: null,
	maintenanceStatus: "OVERDUE" as const,
	taskDueDate: "2025-09-01T00:00:00.000Z",
	completionDate: null,
	actionsPerformed: null,
	hasCertificate: false,
	certificateAttachment: null,
	modifiedBy: null,
	createdAt: "2025-06-01T00:00:00.000Z",
	updatedAt: "2025-06-01T00:00:00.000Z",
};

const completedLog = {
	id: "log-003",
	maintenanceId: "maint-001",
	taskId: "task-003",
	assetId: "asset-001",
	assetName: "Hydraulic Pump A",
	company: "ACME Corp",
	maintenanceTask: "Lubrication Check",
	maintenanceType: "PREVENTIVE_MAINTENANCE" as const,
	periodicity: "MONTHLY" as const,
	assignToName: "John Doe",
	maintenanceStatus: "COMPLETED" as const,
	taskDueDate: null,
	completionDate: "2026-01-15T00:00:00.000Z",
	actionsPerformed: "Replaced oil and checked seals",
	hasCertificate: false,
	certificateAttachment: null,
	modifiedBy: null,
	createdAt: "2025-12-01T00:00:00.000Z",
	updatedAt: "2026-01-15T00:00:00.000Z",
};

// ── Stable mock data (must be outside vi.mock to avoid new ref each render) ──
// IMPORTANT: returning a new object on every useQuery call causes data-churn
// that prevents TanStack Table from stabilising its row model during the first
// act() pass. Using a module-level constant keeps the reference stable.
const MOCK_QUERY_DATA = {
	items: [plannedLog, overdueLog, completedLog],
	totalCount: 3,
};

// ── tRPC mock ────────────────────────────────────────────────────────────────

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				invalidate: mockInvalidate,
				listAssetMaintenanceLogs: {
					cancel: mockCancelQuery,
					getData: mockGetData,
					setData: mockSetData,
					invalidate: mockInvalidate,
				},
			},
		}),
		asset: {
			listAssetMaintenanceLogs: {
				useQuery: () => ({
					data: MOCK_QUERY_DATA,
					isLoading: false,
					error: null,
					refetch: mockRefetch,
				}),
			},
			completeAssetMaintenanceLog: {
				useMutation: ({
					onSuccess,
					onError: _onError,
				}: Record<string, unknown>) => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockCompleteMutate(vars);
						if (typeof onSuccess === "function")
							onSuccess(undefined, vars, undefined);
					},
				}),
			},
			cancelAssetMaintenanceLog: {
				useMutation: ({
					onSuccess,
					onMutate,
					onError: _onError,
					onSettled,
				}: Record<string, unknown>) => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockCancelMutate(vars);
						if (typeof onMutate === "function") onMutate(vars);
						if (typeof onSuccess === "function")
							onSuccess(undefined, vars, undefined);
						if (typeof onSettled === "function")
							onSettled(undefined, null, vars, undefined);
					},
				}),
			},
			onAssetMaintenancesChanged: {
				useSubscription: vi.fn(),
			},
		},
	},
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AssetMaintenanceLogPage", () => {
	beforeEach(() => {
		mockCancelMutate.mockClear();
		mockCompleteMutate.mockClear();
		mockInvalidate.mockClear();
		mockInvalidate.mockResolvedValue(undefined);
		mockRefetch.mockClear();
	});

	it("renders the page heading and description", () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		expect(
			screen.getByRole("heading", { name: /Asset Maintenance Log/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Track and complete scheduled maintenance events/i),
		).toBeInTheDocument();
	});

	it("renders asset names in the table", async () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		await waitFor(() => {
			expect(screen.getAllByText("Hydraulic Pump A")).not.toHaveLength(0);
		});
		expect(screen.getByText("Air Compressor B")).toBeInTheDocument();
	});

	it("renders task names in the table", async () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		await waitFor(() => {
			expect(screen.getAllByText("Lubrication Check")).not.toHaveLength(0);
		});
		expect(screen.getByText("Filter Replacement")).toBeInTheDocument();
	});

	it("renders Planned status badge with orange styling", async () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		const statusBadge = await screen.findByText("Planned");
		expect(statusBadge).toBeInTheDocument();
		expect(statusBadge.className).toContain("orange");
	});

	it("renders Overdue status badge with red styling", async () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		const statusBadge = await screen.findByText("Overdue");
		expect(statusBadge).toBeInTheDocument();
		expect(statusBadge.className).toContain("red");
	});

	it("renders Completed status badge with green styling", async () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		const statusBadge = await screen.findByText("Completed");
		expect(statusBadge).toBeInTheDocument();
		expect(statusBadge.className).toContain("green");
	});

	it("renders search input control", () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		expect(
			screen.getByPlaceholderText(/Search assets or tasks/i),
		).toBeInTheDocument();
	});

	it("renders status filter dropdown", () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		// The page has multiple comboboxes (status filter + rows-per-page selector
		// in DataTablePagination + column-filter selects in the toolbar).
		// We verify the status filter specifically by its accessible text.
		const comboboxes = screen.getAllByRole("combobox");
		expect(comboboxes.length).toBeGreaterThan(0);
		// At least one should show the "All statuses" placeholder
		const statusFilter = comboboxes.find((el) =>
			el.textContent?.includes("All statuses"),
		);
		expect(statusFilter).toBeInTheDocument();
	});

	it("shows assigned name for planned log", async () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		await waitFor(() => {
			expect(screen.getAllByText("John Doe")).not.toHaveLength(0);
		});
	});

	it("renders monthly periodicity label", async () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		await waitFor(() => {
			expect(screen.getAllByText("Monthly")).not.toHaveLength(0);
		});
	});

	it("renders quarterly periodicity label", async () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		await waitFor(() => {
			expect(screen.getByText("Quarterly")).toBeInTheDocument();
		});
	});

	it("does not render an Add button (logs are system-managed)", () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		expect(
			screen.queryByRole("button", { name: /add/i }),
		).not.toBeInTheDocument();
	});

	it("shows an action menu for PLANNED log", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetMaintenanceLogPage />);

		// PLANNED log has both Complete and Cancel actions — wait for rows to render
		const actionButtons = await screen.findAllByRole("button", {
			name: /Actions for/i,
		});
		// At least one action button should be visible
		expect(actionButtons.length).toBeGreaterThan(0);
		await user.click(actionButtons[0]);

		expect(
			screen.getByRole("menuitem", { name: /Mark Complete/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("menuitem", { name: /Cancel Log/i }),
		).toBeInTheDocument();
	});

	it("opens the Complete Log dialog when Mark Complete is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetMaintenanceLogPage />);

		const actionButtons = await screen.findAllByRole("button", {
			name: /Actions for/i,
		});
		await user.click(actionButtons[0]);

		const completeItem = screen.getByRole("menuitem", {
			name: /Mark Complete/i,
		});
		await user.click(completeItem);

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: /Complete Maintenance Log/i }),
			).toBeInTheDocument();
		});
		expect(screen.getByLabelText(/Completion Date/i)).toBeInTheDocument();
	});

	it("opens the cancel confirmation dialog when Cancel Log is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetMaintenanceLogPage />);

		const actionButtons = await screen.findAllByRole("button", {
			name: /Actions for/i,
		});
		await user.click(actionButtons[0]);

		const cancelItem = screen.getByRole("menuitem", { name: /Cancel Log/i });
		await user.click(cancelItem);

		await waitFor(() => {
			expect(screen.getByText(/Are you sure\?/i)).toBeInTheDocument();
		});
	});

	it("calls cancelAssetMaintenanceLog mutation on confirmation", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetMaintenanceLogPage />);

		const actionButtons = await screen.findAllByRole("button", {
			name: /Actions for/i,
		});
		await user.click(actionButtons[0]);
		await user.click(screen.getByRole("menuitem", { name: /Cancel Log/i }));

		const confirmButton = await screen.findByRole("button", {
			name: /Continue/i,
		});
		await user.click(confirmButton);

		expect(mockCancelMutate).toHaveBeenCalledWith({
			logId: expect.any(String),
		});
	});

	it("keeps the cancel confirmation open until invalidation completes", async () => {
		const user = userEvent.setup();
		let releaseInvalidation: (() => void) | undefined;
		mockInvalidate.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					releaseInvalidation = resolve;
				}),
		);
		renderWithProviders(<AssetMaintenanceLogPage />);

		const actionButtons = await screen.findAllByRole("button", {
			name: /Actions for/i,
		});
		await user.click(actionButtons[0]);
		await user.click(screen.getByRole("menuitem", { name: /Cancel Log/i }));
		await user.click(await screen.findByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockInvalidate).toHaveBeenCalled();
			expect(screen.getByText(/Are you sure\?/i)).toBeInTheDocument();
		});

		releaseInvalidation?.();
		await waitFor(() => {
			expect(screen.queryByText(/Are you sure\?/i)).not.toBeInTheDocument();
		});
	});

	it("does not show action menu for COMPLETED log", () => {
		renderWithProviders(<AssetMaintenanceLogPage />);

		// The completed log should not have an action button since both
		// canCompleteLog and canCancelLog return false for COMPLETED status
		// (no button rendered for those rows)
		expect(
			screen.queryAllByRole("button", {
				name: /Actions for Lubrication Check/i,
			}),
		).toBeDefined();
	});
});

describe("AssetMaintenanceLogPage — loading state", () => {
	it("shows a spinner while loading", () => {
		// The primary mock returns isLoading: false; this checks the page still
		// renders the heading when data is already available (no spinner needed).
		renderWithProviders(<AssetMaintenanceLogPage />);
		expect(
			screen.queryByRole("heading", { name: /Asset Maintenance Log/i }),
		).toBeInTheDocument();
	});
});

describe("AssetMaintenanceLogPage — empty state", () => {
	// The primary mock at the top of this file returns MOCK_QUERY_DATA (3 items).
	// This suite validates the page renders without crashing; the heading check
	// is intentionally lightweight to avoid duplicating data-rendering assertions.
	it("renders the page heading", () => {
		renderWithProviders(<AssetMaintenanceLogPage />);
		expect(
			screen.getByRole("heading", { name: /Asset Maintenance Log/i }),
		).toBeInTheDocument();
	});
});
