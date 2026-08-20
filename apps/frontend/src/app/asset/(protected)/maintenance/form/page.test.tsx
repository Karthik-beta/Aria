import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import AssetMaintenanceFormPage from "./page";

vi.mock("@/hooks/use-asset-write-access", () => ({
	useAssetWriteAccess: () => true,
}));

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const existingRecord = {
	id: "maint-001",
	assetId: "asset-001",
	assetName: "Hydraulic Pump A",
	assetCategoryName: "Machinery",
	itemCode: "HYD-PMP-001",
	companyId: "comp-2",
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

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
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
	dateOnlyFromPersistedDateTime: (value: Date) =>
		value.toISOString().slice(0, 10),
	normalizeDateOnly: (value: Date | string) =>
		value instanceof Date
			? value.toISOString().slice(0, 10)
			: value.slice(0, 10),
	Asset: {
		createAssetMaintenanceSchema: {
			safeParse: (input: unknown) => ({
				success: true as const,
				data: input,
			}),
		},
		updateAssetMaintenanceSchema: {
			safeParse: (input: unknown) => ({
				success: true as const,
				data: input,
			}),
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				invalidate: vi.fn().mockResolvedValue(undefined),
				listAssetMaintenances: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				getAssetMaintenanceById: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		asset: {
			listAssets: {
				useQuery: () => ({
					data: {
						items: [
							{
								id: "clhasset001",
								series: "AST-001",
								assetName: "Hydraulic Pump A",
								companyId: "comp-1",
								company: "New Corp",
								status: "SUBMITTED",
							},
						],
						totalCount: 1,
					},
					isLoading: false,
					isFetching: false,
				}),
			},
			listMaintenanceTeams: {
				useQuery: () => ({
					data: { items: [], totalCount: 0 },
					isLoading: false,
					isFetching: false,
				}),
			},
			getAssetMaintenanceById: {
				useQuery: () => ({
					data: currentId === existingRecord.id ? existingRecord : null,
					isLoading: false,
				}),
			},
			createAssetMaintenance: {
				useMutation: ({
					onSuccess,
					onError: _onError,
				}: Record<string, unknown>) => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockCreateMutate(vars);
						if (typeof onSuccess === "function")
							onSuccess({ id: "clh999new" }, vars, undefined);
					},
				}),
			},
			updateAssetMaintenance: {
				useMutation: ({
					onSuccess,
					onError: _onError,
				}: Record<string, unknown>) => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockUpdateMutate(vars);
						if (typeof onSuccess === "function")
							onSuccess({ id: currentId }, vars, undefined);
					},
				}),
			},
		},
		company: {
			listCompanies: {
				useQuery: () => ({
					data: {
						items: [
							{ id: "comp-1", name: "New Corp" },
							{ id: "comp-2", name: "ACME Corp" },
						],
					},
					isLoading: false,
				}),
			},
		},
	},
}));

describe("AssetMaintenanceFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("renders create form heading for a new record", () => {
		renderWithProviders(<AssetMaintenanceFormPage />);

		expect(
			screen.getByRole("heading", { name: /New Asset Maintenance/i }),
		).toBeInTheDocument();
	});

	it("renders required fields: Asset, Company, Maintenance Team", () => {
		renderWithProviders(<AssetMaintenanceFormPage />);

		expect(screen.getByLabelText(/^Select asset$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Company/i)).toBeInTheDocument();
		expect(
			screen.getByLabelText(/^Select maintenance team$/i),
		).toBeInTheDocument();
	});

	it("renders the Back to List and Save buttons", () => {
		renderWithProviders(<AssetMaintenanceFormPage />);

		expect(
			screen.getByRole("button", { name: /Back to List/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Save/i })).toBeInTheDocument();
	});

	it("renders the Add Task button", () => {
		renderWithProviders(<AssetMaintenanceFormPage />);

		expect(
			screen.getByRole("button", { name: /Add Task/i }),
		).toBeInTheDocument();
	});

	it("adds a task row when Add Task is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetMaintenanceFormPage />);

		expect(screen.getByText(/No tasks added/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Add Task/i }));

		expect(screen.queryByText(/No tasks added/i)).not.toBeInTheDocument();
		expect(screen.getByPlaceholderText(/Task name/i)).toBeInTheDocument();
	});

	it("removes a task row when the trash icon is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetMaintenanceFormPage />);

		await user.click(screen.getByRole("button", { name: /Add Task/i }));
		expect(screen.getByPlaceholderText(/Task name/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Remove task 1/i }));
		expect(screen.getByText(/No tasks added/i)).toBeInTheDocument();
	});

	it("shows Not Saved badge after editing a field", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetMaintenanceFormPage />);

		await user.type(
			screen.getByLabelText(/Manager Display Name/i),
			"Draft Manager",
		);

		expect(screen.getByText("Not Saved")).toBeInTheDocument();
	});

	it("saves create form and calls createAssetMaintenance mutation", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetMaintenanceFormPage />);

		await user.click(screen.getByLabelText(/^Select asset$/i));
		await user.click(await screen.findByText(/Hydraulic Pump A/));
		const companyButton = screen.getByRole("button", { name: /company/i });
		await user.click(companyButton);
		const companyOption = await screen.findByRole("option", {
			name: "New Corp",
		});
		await user.click(companyOption);
		await user.click(screen.getByRole("button", { name: /Save/i }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					assetId: "clhasset001",
					companyId: "comp-1",
				}),
			);
		});
	});

	it("prefills fields in edit mode", async () => {
		currentId = existingRecord.id;
		renderWithProviders(<AssetMaintenanceFormPage />);

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Hydraulic Pump A" }),
			).toBeInTheDocument();
		});

		await waitFor(() => {
			expect(screen.getByText("ACME Corp")).toBeInTheDocument();
		});
	});

	it("calls updateAssetMaintenance mutation in edit mode", async () => {
		currentId = existingRecord.id;
		const user = userEvent.setup();
		renderWithProviders(<AssetMaintenanceFormPage />);

		await waitFor(() => {
			expect(screen.getByText("ACME Corp")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: /Save/i }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ id: existingRecord.id }),
			);
		});
	});
});
