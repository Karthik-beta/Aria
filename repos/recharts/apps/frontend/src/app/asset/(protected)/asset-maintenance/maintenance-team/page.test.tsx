import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import MaintenanceTeamPage from "./page";

const mockDeleteMutate = vi.fn();
const mockCancelQuery = vi.fn().mockResolvedValue(undefined);
const mockGetData = vi.fn().mockReturnValue({ items: [], totalCount: 0 });
const mockSetData = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);
const mockRefetch = vi.fn().mockResolvedValue(undefined);

const alphaTeam = {
	id: "team-001",
	name: "Alpha Team",
	maintenanceManager: "manager@example.com",
	maintenanceManagerName: "Manager Name",
	company: "ACME Corp",
	members: [
		{
			id: "mem-001",
			teamId: "team-001",
			teamMember: "john@example.com",
			fullName: "John Doe",
			maintenanceRole: "Technician",
			createdAt: new Date("2026-01-01"),
			updatedAt: new Date("2026-01-01"),
		},
	],
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

const betaTeam = {
	id: "team-002",
	name: "Beta Team",
	maintenanceManager: null,
	maintenanceManagerName: null,
	company: "Beta Corp",
	members: [],
	createdAt: new Date("2026-02-01"),
	updatedAt: new Date("2026-02-02"),
};

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				listMaintenanceTeams: {
					cancel: mockCancelQuery,
					getData: mockGetData,
					setData: mockSetData,
					invalidate: mockInvalidate,
				},
			},
		}),
		asset: {
			listMaintenanceTeams: {
				useQuery: () => ({
					data: {
						items: [alphaTeam, betaTeam],
						totalCount: 2,
					},
					isLoading: false,
					error: null,
					refetch: mockRefetch,
				}),
			},
			deleteMaintenanceTeam: {
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
			onMaintenanceTeamsChanged: {
				useSubscription: vi.fn(),
			},
		},
	},
}));

describe("MaintenanceTeamPage", () => {
	beforeEach(() => {
		mockDeleteMutate.mockClear();
		mockInvalidate.mockClear();
		mockRefetch.mockClear();
	});

	it("renders the page heading and description", () => {
		renderWithProviders(<MaintenanceTeamPage />);

		expect(
			screen.getByRole("heading", {
				name: /Asset Maintenance Teams/i,
			}),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Manage teams responsible for asset maintenance/i),
		).toBeInTheDocument();
	});

	it("renders team names in the table", () => {
		renderWithProviders(<MaintenanceTeamPage />);

		expect(screen.getByText("Alpha Team")).toBeInTheDocument();
		expect(screen.getByText("Beta Team")).toBeInTheDocument();
	});

	it("shows the Add Team button", () => {
		renderWithProviders(<MaintenanceTeamPage />);

		expect(screen.getByText(/Add Team/i)).toBeInTheDocument();
	});

	it("shows the manager name when present", () => {
		renderWithProviders(<MaintenanceTeamPage />);

		expect(screen.getByText("Manager Name")).toBeInTheDocument();
	});

	it("shows search filter control", () => {
		renderWithProviders(<MaintenanceTeamPage />);

		expect(screen.getByPlaceholderText(/Search teams/i)).toBeInTheDocument();
	});

	it("opens the delete confirmation dialog when Delete is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<MaintenanceTeamPage />);

		const actionButtons = screen.getAllByRole("button", {
			name: /Open actions/i,
		});
		await user.click(actionButtons[0]);

		const deleteItem = screen.getByRole("menuitem", {
			name: /Delete Team/i,
		});
		await user.click(deleteItem);

		expect(
			screen.getByRole("heading", { name: /Are you sure\?/i }),
		).toBeInTheDocument();
	});

	it("calls delete mutation on confirmation", async () => {
		const user = userEvent.setup();
		renderWithProviders(<MaintenanceTeamPage />);

		await user.click(
			screen.getByRole("button", {
				name: /Open actions for Alpha Team/i,
			}),
		);
		await user.click(screen.getByRole("menuitem", { name: /Delete Team/i }));
		await user.click(screen.getByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockDeleteMutate).toHaveBeenCalledWith({
				id: alphaTeam.id,
			});
		});
	});
});
