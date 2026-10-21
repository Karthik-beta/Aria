import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const rootChild = {
	id: "clh123location",
	name: "Head Office",
	isGroup: true,
	expandable: true,
	assetCount: 2,
	childCount: 1,
	area: 12345.5,
	isContainer: true,
};

const nestedChild = {
	id: "clh456location",
	name: "Floor 1",
	isGroup: false,
	expandable: false,
	assetCount: 1,
	childCount: 0,
	area: 0,
	isContainer: false,
};

const mockChildrenQuery = vi.fn(
	(input: { parentId: string | null }, opts?: { enabled?: boolean }) => {
		if (opts?.enabled === false) {
			return { data: undefined, isLoading: false, error: null };
		}
		const data =
			input.parentId === null
				? [rootChild]
				: input.parentId === rootChild.id
					? [nestedChild]
					: [];
		return { data, isLoading: false, error: null, refetch: vi.fn() };
	},
);

const canManageAssets = vi.hoisted(() => ({ value: true }));

vi.mock("@/hooks/use-can-manage-assets", () => ({
	useCanManageAssets: () => canManageAssets.value,
}));

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
				listLocationChildren: {
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
			listLocationChildren: {
				useQuery: (...args: Parameters<typeof mockChildrenQuery>) =>
					mockChildrenQuery(...args),
			},
			onLocationsChanged: {
				useSubscription: vi.fn(),
			},
		},
	},
}));

describe("LocationPage", () => {
	beforeEach(() => {
		canManageAssets.value = true;
		window.localStorage.clear();
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

describe("LocationPage — tree view", () => {
	beforeEach(() => {
		canManageAssets.value = true;
		window.localStorage.clear();
		mockDeleteMutate.mockClear();
		mockChildrenQuery.mockClear();
	});

	afterEach(() => {
		window.localStorage.clear();
	});

	it("shows the table by default with a Tree toggle next to it", () => {
		renderWithProviders(<LocationPage />);

		expect(screen.getByRole("button", { name: "Table" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByRole("button", { name: "Tree" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
		expect(screen.queryByLabelText("Location tree")).not.toBeInTheDocument();
		expect(mockChildrenQuery).not.toHaveBeenCalled();
	});

	it("renders roots with asset count, area and container badge in tree view", async () => {
		const user = userEvent.setup();
		renderWithProviders(<LocationPage />);

		await user.click(screen.getByRole("button", { name: "Tree" }));

		const tree = screen.getByLabelText("Location tree");
		expect(tree).toBeInTheDocument();
		expect(screen.getByText("Head Office")).toBeInTheDocument();
		expect(screen.getByText("2 assets")).toBeInTheDocument();
		expect(screen.getByText(/12,345\.5 m²/)).toBeInTheDocument();
		expect(screen.getByText("Container")).toBeInTheDocument();
		// Roots are requested with parentId null.
		expect(mockChildrenQuery).toHaveBeenCalledWith(
			{ parentId: null },
			expect.anything(),
		);
		// The table is replaced by the tree.
		expect(screen.queryByLabelText("Location table")).not.toBeInTheDocument();
	});

	it("loads children lazily when a group is expanded", async () => {
		const user = userEvent.setup();
		renderWithProviders(<LocationPage />);
		await user.click(screen.getByRole("button", { name: "Tree" }));

		expect(screen.queryByText("Floor 1")).not.toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: "Expand Head Office" }),
		);

		expect(screen.getByText("Floor 1")).toBeInTheDocument();
		expect(screen.getByText("1 asset")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Collapse Head Office" }),
		).toHaveAttribute("aria-expanded", "true");
		expect(mockChildrenQuery).toHaveBeenCalledWith(
			{ parentId: rootChild.id },
			expect.objectContaining({ enabled: true }),
		);
	});

	it("offers edit, add child and delete actions to managers", async () => {
		const user = userEvent.setup();
		renderWithProviders(<LocationPage />);
		await user.click(screen.getByRole("button", { name: "Tree" }));

		await user.click(
			screen.getByRole("button", { name: /Open actions for Head Office/i }),
		);

		// next/link is mocked without an <a> wrapper, so assert on the text.
		expect(screen.getByText(/Edit Location/i)).toBeInTheDocument();
		expect(screen.getByText(/Add Child Location/i)).toBeInTheDocument();
		await user.click(
			screen.getByRole("menuitem", { name: /Delete Location/i }),
		);
		expect(
			screen.getByRole("heading", { name: /Are you sure\?/i }),
		).toBeInTheDocument();
	});

	it("remembers the tree view across mounts", async () => {
		const user = userEvent.setup();
		const { unmount } = renderWithProviders(<LocationPage />);
		await user.click(screen.getByRole("button", { name: "Tree" }));
		unmount();

		renderWithProviders(<LocationPage />);

		await waitFor(() => {
			expect(screen.getByLabelText("Location tree")).toBeInTheDocument();
		});
	});

	it("hides write actions from members but keeps the tree visible", async () => {
		canManageAssets.value = false;
		const user = userEvent.setup();
		renderWithProviders(<LocationPage />);
		await user.click(screen.getByRole("button", { name: "Tree" }));

		expect(screen.getByText("Head Office")).toBeInTheDocument();
		expect(screen.queryByText(/Add Location/i)).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Open actions for/i }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Expand Head Office" }),
		).toBeInTheDocument();
	});
});

describe("LocationPage — read-only access", () => {
	beforeEach(() => {
		canManageAssets.value = false;
	});

	afterEach(() => {
		canManageAssets.value = true;
	});

	it("hides Add Location and row actions but keeps the list", () => {
		renderWithProviders(<LocationPage />);

		expect(screen.getByText("Floor 1")).toBeInTheDocument();
		expect(screen.queryByText(/Add Location/i)).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Open actions for/i }),
		).not.toBeInTheDocument();
	});
});
