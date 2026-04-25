import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import MaintenanceTeamFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const existingTeam = {
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
	Asset: {
		createMaintenanceTeamSchema: {
			safeParse: (input: unknown) => ({
				success: true as const,
				data: input,
			}),
		},
		updateMaintenanceTeamSchema: {
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
				listMaintenanceTeams: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				getMaintenanceTeamById: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		asset: {
			getMaintenanceTeamById: {
				useQuery: () => ({
					data: currentId === existingTeam.id ? existingTeam : null,
					isLoading: false,
				}),
			},
			createMaintenanceTeam: {
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
			updateMaintenanceTeam: {
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
	},
}));

describe("MaintenanceTeamFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("renders create form heading for a new team", () => {
		renderWithProviders(<MaintenanceTeamFormPage />);

		expect(
			screen.getByRole("heading", { name: /New Maintenance Team/i }),
		).toBeInTheDocument();
	});

	it("renders required fields: Team Name, Company", () => {
		renderWithProviders(<MaintenanceTeamFormPage />);

		expect(screen.getByLabelText(/Team Name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Company/i)).toBeInTheDocument();
	});

	it("renders the Back to List and Save buttons", () => {
		renderWithProviders(<MaintenanceTeamFormPage />);

		expect(
			screen.getByRole("button", { name: /Back to List/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Save/i })).toBeInTheDocument();
	});

	it("renders the Add Member button", () => {
		renderWithProviders(<MaintenanceTeamFormPage />);

		expect(
			screen.getByRole("button", { name: /Add Member/i }),
		).toBeInTheDocument();
	});

	it("adds a member row when Add Member is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<MaintenanceTeamFormPage />);

		expect(screen.getByText(/No members added/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Add Member/i }));

		expect(screen.queryByText(/No members added/i)).not.toBeInTheDocument();
		expect(
			screen.getByPlaceholderText(/Member ID or email/i),
		).toBeInTheDocument();
	});

	it("removes a member row when the trash icon is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<MaintenanceTeamFormPage />);

		await user.click(screen.getByRole("button", { name: /Add Member/i }));
		expect(
			screen.getByPlaceholderText(/Member ID or email/i),
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Remove member 1/i }));
		expect(screen.getByText(/No members added/i)).toBeInTheDocument();
	});

	it("shows Not Saved badge after editing a field", async () => {
		const user = userEvent.setup();
		renderWithProviders(<MaintenanceTeamFormPage />);

		await user.type(screen.getByLabelText(/Team Name/i), "Draft Team");

		expect(screen.getByText("Not Saved")).toBeInTheDocument();
	});

	it("saves create form and calls createMaintenanceTeam mutation", async () => {
		const user = userEvent.setup();
		renderWithProviders(<MaintenanceTeamFormPage />);

		await user.type(screen.getByLabelText(/Team Name/i), "New Team");
		await user.type(screen.getByLabelText(/Company/i), "New Corp");
		await user.click(screen.getByRole("button", { name: /Save/i }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ name: "New Team", company: "New Corp" }),
			);
		});
	});

	it("prefills fields in edit mode", async () => {
		currentId = existingTeam.id;
		renderWithProviders(<MaintenanceTeamFormPage />);

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Alpha Team" }),
			).toBeInTheDocument();
		});

		await waitFor(() => {
			expect(screen.getByDisplayValue("Alpha Team")).toBeInTheDocument();
		});
	});

	it("calls updateMaintenanceTeam mutation in edit mode", async () => {
		currentId = existingTeam.id;
		const user = userEvent.setup();
		renderWithProviders(<MaintenanceTeamFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Alpha Team")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: /Save/i }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ id: existingTeam.id }),
			);
		});
	});
});
