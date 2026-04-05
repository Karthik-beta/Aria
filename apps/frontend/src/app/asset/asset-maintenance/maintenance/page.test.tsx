import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import AssetMaintenancePage from "./page";

const mockDeleteMutate = vi.fn();
const mockCancelQuery = vi.fn().mockResolvedValue(undefined);
const mockGetData = vi.fn().mockReturnValue({ items: [], totalCount: 0 });
const mockSetData = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);
const mockRefetch = vi.fn().mockResolvedValue(undefined);

const pumpMaintenance = {
	id: "maint-001",
	assetId: "asset-001",
	assetName: "Hydraulic Pump A",
	assetCategoryName: "Machinery",
	itemCode: "HYD-PMP-001",
	company: "ACME Corp",
	maintenanceTeamId: "team-001",
	maintenanceTeamName: "Alpha Team",
	maintenanceManager: "manager@example.com",
	maintenanceManagerName: "Manager Name",
	tasks: [
		{
			id: "task-001",
			maintenanceId: "maint-001",
			maintenanceTask: "Lubrication Check",
			maintenanceType: "PREVENTIVE_MAINTENANCE" as const,
			maintenanceStatus: "PLANNED" as const,
			startDate: new Date("2026-01-01"),
			periodicity: "MONTHLY" as const,
			endDate: null,
			certificateRequired: false,
			assignTo: null,
			assignToName: null,
			nextDueDate: new Date("2026-02-01"),
			lastCompletionDate: null,
			description: null,
			createdAt: new Date("2026-01-01"),
			updatedAt: new Date("2026-01-01"),
		},
	],
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

const compressorMaintenance = {
	id: "maint-002",
	assetId: "asset-002",
	assetName: "Air Compressor B",
	assetCategoryName: null,
	itemCode: null,
	company: "Beta Corp",
	maintenanceTeamId: "team-002",
	maintenanceTeamName: "Beta Team",
	maintenanceManager: null,
	maintenanceManagerName: null,
	tasks: [
		{
			id: "task-002",
			maintenanceId: "maint-002",
			maintenanceTask: "Filter Replacement",
			maintenanceType: null,
			maintenanceStatus: "OVERDUE" as const,
			startDate: new Date("2025-06-01"),
			periodicity: "QUARTERLY" as const,
			endDate: null,
			certificateRequired: true,
			assignTo: null,
			assignToName: null,
			nextDueDate: new Date("2025-09-01"),
			lastCompletionDate: null,
			description: null,
			createdAt: new Date("2025-06-01"),
			updatedAt: new Date("2025-06-01"),
		},
	],
	createdAt: new Date("2025-06-01"),
	updatedAt: new Date("2025-06-02"),
};

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				listAssetMaintenances: {
					cancel: mockCancelQuery,
					getData: mockGetData,
					setData: mockSetData,
					invalidate: mockInvalidate,
				},
			},
		}),
		asset: {
			listAssetMaintenances: {
				useQuery: () => ({
					data: {
						items: [pumpMaintenance, compressorMaintenance],
						totalCount: 2,
					},
					isLoading: false,
					error: null,
					refetch: mockRefetch,
				}),
			},
			deleteAssetMaintenance: {
				useMutation: ({
					onSuccess,
					onMutate,
					onError: _onError,
					onSettled,
				}: Record<string, unknown>) => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockDeleteMutate(vars);
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

describe("AssetMaintenancePage", () => {
	beforeEach(() => {
		mockDeleteMutate.mockClear();
		mockInvalidate.mockClear();
		mockRefetch.mockClear();
	});

	it("renders the page heading and description", () => {
		renderWithProviders(<AssetMaintenancePage />);

		expect(
			screen.getByRole("heading", { name: /Asset Maintenance/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Manage maintenance schedules for your assets/i),
		).toBeInTheDocument();
	});

	it("renders asset names in the table", () => {
		renderWithProviders(<AssetMaintenancePage />);

		expect(screen.getByText("Hydraulic Pump A")).toBeInTheDocument();
		expect(screen.getByText("Air Compressor B")).toBeInTheDocument();
	});

	it("shows the Add Maintenance button", () => {
		renderWithProviders(<AssetMaintenancePage />);

		expect(screen.getByText(/Add Maintenance/i)).toBeInTheDocument();
	});

	it("shows company names", () => {
		renderWithProviders(<AssetMaintenancePage />);

		expect(screen.getByText("ACME Corp")).toBeInTheDocument();
		expect(screen.getByText("Beta Corp")).toBeInTheDocument();
	});

	it("shows search filter control", () => {
		renderWithProviders(<AssetMaintenancePage />);

		expect(screen.getByPlaceholderText(/Search assets/i)).toBeInTheDocument();
	});

	it("shows Planned status for PLANNED tasks", () => {
		renderWithProviders(<AssetMaintenancePage />);

		expect(screen.getByText("Planned")).toBeInTheDocument();
	});

	it("shows Overdue status for OVERDUE tasks", () => {
		renderWithProviders(<AssetMaintenancePage />);

		expect(screen.getByText("Overdue")).toBeInTheDocument();
	});

	it("opens the delete confirmation dialog when Delete is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetMaintenancePage />);

		const actionButtons = screen.getAllByRole("button", {
			name: /Open actions/i,
		});
		await user.click(actionButtons[0]);

		const deleteItem = screen.getByRole("menuitem", {
			name: /Delete Maintenance/i,
		});
		await user.click(deleteItem);

		expect(
			screen.getByRole("heading", { name: /Are you sure\?/i }),
		).toBeInTheDocument();
	});

	it("calls delete mutation on confirmation", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetMaintenancePage />);

		await user.click(
			screen.getByRole("button", {
				name: /Open actions for Hydraulic Pump A/i,
			}),
		);
		await user.click(
			screen.getByRole("menuitem", { name: /Delete Maintenance/i }),
		);
		await user.click(screen.getByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockDeleteMutate).toHaveBeenCalledWith({
				id: pumpMaintenance.id,
			});
		});
	});
});
