import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import CompanyListPage from "./page";

const mockDeleteMutate = vi.fn();
const mockCancelQuery = vi.fn().mockResolvedValue(undefined);
const mockGetData = vi.fn().mockReturnValue({ items: [], totalCount: 0 });
const mockSetData = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);
const mockRefetch = vi.fn().mockResolvedValue(undefined);

const acmeCompany = {
	id: "clxyz001",
	name: "Acme Corp",
	abbreviation: "AC",
	country: "United States",
	currency: "USD",
	taxId: "123-456-789",
	domain: "Manufacturing",
	isGroup: false,
	parentCompanyId: null,
	parentCompanyName: null,
	disabled: false,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

const holdCompany = {
	id: "clxyz002",
	name: "Acme Holdings",
	abbreviation: "AH",
	country: "United States",
	currency: "USD",
	taxId: null,
	domain: null,
	isGroup: true,
	parentCompanyId: null,
	parentCompanyName: null,
	disabled: false,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			company: {
				listCompanies: {
					cancel: mockCancelQuery,
					getData: mockGetData,
					setData: mockSetData,
					invalidate: mockInvalidate,
				},
			},
		}),
		company: {
			listCompanies: {
				useQuery: () => ({
					data: {
						items: [acmeCompany, holdCompany],
						totalCount: 2,
					},
					isLoading: false,
					error: null,
					refetch: mockRefetch,
				}),
			},
			deleteCompany: {
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
			deleteManyCompanies: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
			onCompaniesChanged: {
				useSubscription: vi.fn(),
			},
		},
	},
}));

describe("CompanyListPage", () => {
	beforeEach(() => {
		mockDeleteMutate.mockClear();
		mockInvalidate.mockClear();
		mockRefetch.mockClear();
	});

	it("renders the page heading and description", () => {
		renderWithProviders(<CompanyListPage />);

		expect(
			screen.getByRole("heading", { name: /Companies/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Manage your companies and organizational structure/i),
		).toBeInTheDocument();
	});

	it("renders company names in the table", () => {
		renderWithProviders(<CompanyListPage />);

		expect(screen.getByText("Acme Corp")).toBeInTheDocument();
		expect(screen.getByText("Acme Holdings")).toBeInTheDocument();
	});

	it("shows the New Company button", () => {
		renderWithProviders(<CompanyListPage />);

		expect(screen.getByText(/New Company/i)).toBeInTheDocument();
	});

	it("shows Group badge for group companies", () => {
		renderWithProviders(<CompanyListPage />);
		expect(screen.getByText("Group")).toBeInTheDocument();
	});

	it("shows Company badge for non-group companies", () => {
		renderWithProviders(<CompanyListPage />);
		expect(screen.getByText("Company")).toBeInTheDocument();
	});

	it("shows Active status badge", () => {
		renderWithProviders(<CompanyListPage />);
		const activeBadges = screen.getAllByText("Active");
		expect(activeBadges.length).toBeGreaterThan(0);
	});

	it("shows abbreviation values", () => {
		renderWithProviders(<CompanyListPage />);
		expect(screen.getByText("AC")).toBeInTheDocument();
		expect(screen.getByText("AH")).toBeInTheDocument();
	});

	it("shows country values", () => {
		renderWithProviders(<CompanyListPage />);
		const countries = screen.getAllByText("United States");
		expect(countries.length).toBe(2);
	});

	it("opens the delete confirmation dialog when Delete is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<CompanyListPage />);

		const actionButtons = screen.getAllByRole("button", {
			name: /Open menu/i,
		});
		await user.click(actionButtons[0]);

		const deleteItem = screen.getByRole("menuitem", {
			name: /Delete Company/i,
		});
		await user.click(deleteItem);

		expect(
			screen.getByRole("heading", { name: /Are you sure\?/i }),
		).toBeInTheDocument();
	});

	it("calls delete mutation on confirmation", async () => {
		const user = userEvent.setup();
		renderWithProviders(<CompanyListPage />);

		await user.click(screen.getAllByRole("button", { name: /Open menu/i })[0]);
		await user.click(screen.getByRole("menuitem", { name: /Delete Company/i }));
		await user.click(screen.getByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockDeleteMutate).toHaveBeenCalledWith({
				id: acmeCompany.id,
			});
		});
	});
});
