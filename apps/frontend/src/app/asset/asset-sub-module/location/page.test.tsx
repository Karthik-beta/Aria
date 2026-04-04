import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import LocationPage from "./page";

const mockDeleteMutate = vi.fn();
const mockCancelQuery = vi.fn().mockResolvedValue(undefined);
const mockGetData = vi.fn().mockReturnValue({ items: [], totalCount: 0 });
const mockSetData = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);
const mockRefetch = vi.fn().mockResolvedValue(undefined);

const locationRecord = {
	id: "clh123location",
	name: "Head Office",
	parentLocationId: null,
	parentLocationName: null,
	isGroup: true,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

const leafLocationRecord = {
	id: "clh456location",
	name: "Floor 1",
	parentLocationId: "clh123location",
	parentLocationName: "Head Office",
	isGroup: false,
	createdAt: new Date("2026-01-03"),
	updatedAt: new Date("2026-01-04"),
};

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				listLocations: {
					cancel: mockCancelQuery,
					getData: mockGetData,
					setData: mockSetData,
					invalidate: mockInvalidate,
				},
			},
		}),
		asset: {
			listLocations: {
				useQuery: () => ({
					data: {
						items: [locationRecord, leafLocationRecord],
						totalCount: 2,
					},
					isLoading: false,
					error: null,
					refetch: mockRefetch,
				}),
			},
			deleteLocation: {
				useMutation: ({
					onSuccess,
					onMutate,
					onError,
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
			onLocationsChanged: {
				useSubscription: vi.fn(),
			},
		},
	},
}));

describe("LocationPage", () => {
	beforeEach(() => {
		mockDeleteMutate.mockClear();
		mockInvalidate.mockClear();
		mockRefetch.mockClear();
	});

	it("renders the page heading and descriptions", () => {
		renderWithProviders(<LocationPage />);

		expect(
			screen.getByRole("heading", { name: /Locations/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Manage asset locations and site hierarchy/i),
		).toBeInTheDocument();
	});

	it("renders location names in the table", () => {
		renderWithProviders(<LocationPage />);

		// "Head Office" appears as both a location name and a parent location name,
		// so use getAllByText to avoid the "multiple elements" error.
		expect(screen.getAllByText("Head Office").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("Floor 1")).toBeInTheDocument();
	});

	it("renders parent location name for child locations", () => {
		renderWithProviders(<LocationPage />);
		// "Head Office" is the name of one location AND the parent name of "Floor 1",
		// so it appears at least twice in the rendered output.
		expect(screen.getAllByText("Head Office").length).toBeGreaterThanOrEqual(2);
	});

	it("shows the Add Location button", () => {
		renderWithProviders(<LocationPage />);

		// next/link is mocked in the test setup to render its children without an <a>
		// wrapper, so we assert on the visible text instead of role="link".
		expect(screen.getByText(/Add Location/i)).toBeInTheDocument();
	});

	it("shows type badges for group and leaf locations", () => {
		renderWithProviders(<LocationPage />);
		expect(screen.getByText("Group")).toBeInTheDocument();
		expect(screen.getByText("Leaf")).toBeInTheDocument();
	});

	it("opens the delete confirmation dialog when Delete is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<LocationPage />);

		// Open the actions dropdown for the first location row.
		// Rows are sorted alphabetically: "Floor 1" comes first, then "Head Office".
		const actionButtons = screen.getAllByRole("button", {
			name: /Open actions/i,
		});
		await user.click(actionButtons[0]);

		const deleteItem = screen.getByRole("menuitem", {
			name: /Delete Location/i,
		});
		await user.click(deleteItem);

		// AlertModal renders with "Are you sure?" as the fixed dialog heading.
		expect(
			screen.getByRole("heading", { name: /Are you sure\?/i }),
		).toBeInTheDocument();
	});

	it("calls delete mutation on confirmation", async () => {
		const user = userEvent.setup();
		renderWithProviders(<LocationPage />);

		// Target the action button for "Head Office" specifically, because rows are
		// sorted alphabetically and "Floor 1" renders before "Head Office".
		await user.click(
			screen.getByRole("button", { name: /Open actions for Head Office/i }),
		);
		await user.click(
			screen.getByRole("menuitem", { name: /Delete Location/i }),
		);
		await user.click(screen.getByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockDeleteMutate).toHaveBeenCalledWith({
				id: locationRecord.id,
			});
		});
	});

	it("renders search and type filter controls", () => {
		renderWithProviders(<LocationPage />);

		expect(
			screen.getByPlaceholderText(/Search locations/i),
		).toBeInTheDocument();
		// The page has multiple comboboxes (Type filter + table page-size selector),
		// so use getAllByRole and verify at least one is present.
		expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(1);
	});
});
