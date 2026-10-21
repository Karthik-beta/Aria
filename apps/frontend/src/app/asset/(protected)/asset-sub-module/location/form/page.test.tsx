import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	fireEvent,
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
} from "@/test/utils";
import LocationFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;
let currentParentId: string | null = null;
const mockListLocationsQuery = vi.fn();

const existingLocation = {
	id: "clh123location",
	name: "Head Office",
	parentLocationId: null,
	parentLocationName: null,
	isGroup: true,
	isContainer: true,
	latitude: 12.5,
	longitude: 77.25,
	area: 2500,
	areaUom: "Square Meter",
	geolocation: {
		type: "FeatureCollection" as const,
		features: [
			{
				type: "Feature" as const,
				properties: { point_type: "circle", radius: 10 },
				geometry: { type: "Point" as const, coordinates: [77.25, 12.5] },
			},
		],
	},
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

const parentLocation = {
	id: "clh999parent",
	name: "Global HQ",
	parentLocationId: null,
	parentLocationName: null,
	isGroup: true,
	createdAt: new Date("2025-12-01"),
	updatedAt: new Date("2025-12-01"),
};

const canManageAssets = vi.hoisted(() => ({ value: true }));

vi.mock("@/hooks/use-can-manage-assets", () => ({
	useCanManageAssets: () => canManageAssets.value,
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
	}),
	useSearchParams: () => ({
		get: (key: string) =>
			key === "id" ? currentId : key === "parentId" ? currentParentId : null,
	}),
}));

vi.mock("@hookform/resolvers/zod", () => ({
	zodResolver: () => async (values: unknown) => ({
		values,
		errors: {},
	}),
}));

// Keep the real GeoJSON schema (used by the form's textarea parsing); only the
// create/update schemas are stubbed so payloads pass through unchanged.
vi.mock("@aria/types", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aria/types")>();
	return {
		...actual,
		Asset: {
			...actual.Asset,
			createLocationSchema: {
				safeParse: (input: unknown) => ({
					success: true as const,
					data: input,
				}),
			},
			updateLocationSchema: {
				safeParse: (input: unknown) => ({
					success: true as const,
					data: input,
				}),
			},
		},
	};
});

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				listLocations: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				getLocationById: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				getLocationAncestors: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		asset: {
			getLocationById: {
				useQuery: () => ({
					data:
						currentId === existingLocation.id
							? existingLocation
							: currentId
								? null
								: undefined,
					isLoading: false,
				}),
			},
			getLocationAncestors: {
				useQuery: () => ({
					data:
						currentId === existingLocation.id
							? [{ id: "clh999parent", name: "Global HQ", isGroup: true }]
							: undefined,
				}),
			},
			listLocations: {
				useQuery: (...args: unknown[]) => {
					mockListLocationsQuery(...args);
					return {
						data: {
							items: [parentLocation],
							totalCount: 1,
						},
					};
				},
			},
			createLocation: {
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
			updateLocation: {
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

describe("LocationFormPage", () => {
	beforeEach(() => {
		canManageAssets.value = true;
		currentId = null;
		currentParentId = null;
		mockListLocationsQuery.mockClear();
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("renders create form with empty fields", () => {
		renderWithProviders(<LocationFormPage />);

		expect(
			screen.getByRole("heading", { name: /New Location/i }),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/Location Name/i)).toHaveValue("");
	});

	it("submits the create payload", async () => {
		const user = userEvent.setup();
		renderWithProviders(<LocationFormPage />);

		await user.type(screen.getByLabelText(/Location Name/i), "Site Alpha");
		await user.click(screen.getByRole("button", { name: /Save/i }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Site Alpha",
					parentLocationId: null,
					isGroup: false,
				}),
			);
		});
	});

	it("shows Not Saved badge after editing a field", async () => {
		const user = userEvent.setup();
		renderWithProviders(<LocationFormPage />);

		await user.type(screen.getByLabelText(/Location Name/i), "Draft");

		expect(screen.getByText("Not Saved")).toBeInTheDocument();
	});

	it("prefills fields in edit mode", async () => {
		currentId = existingLocation.id;
		renderWithProviders(<LocationFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Head Office")).toBeInTheDocument();
		});
	});

	it("submits the update payload in edit mode", async () => {
		currentId = existingLocation.id;
		const user = userEvent.setup();
		renderWithProviders(<LocationFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Head Office")).toBeInTheDocument();
		});

		await user.clear(screen.getByLabelText(/Location Name/i));
		await user.type(
			screen.getByLabelText(/Location Name/i),
			"Head Office Updated",
		);
		await user.click(screen.getByRole("button", { name: /Save/i }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: existingLocation.id,
					name: "Head Office Updated",
				}),
			);
		});
	});

	it("redirects to the list when a missing location is edited", async () => {
		currentId = "missing-id";
		renderWithProviders(<LocationFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/asset/asset-sub-module/location");
		});
	});

	it("navigates back to list via Back to List button", async () => {
		const user = userEvent.setup();
		renderWithProviders(<LocationFormPage />);

		await user.click(screen.getByRole("button", { name: /Back to List/i }));

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/asset/asset-sub-module/location");
		});
	});

	it("renders parent location options from the API", async () => {
		renderWithProviders(<LocationFormPage />);

		// The combobox for parent location should be present
		expect(screen.getByLabelText(/Parent Location/i)).toBeInTheDocument();
	});

	it("asks the API to leave out the location and its descendants in the parent picker", () => {
		currentId = existingLocation.id;
		renderWithProviders(<LocationFormPage />);

		expect(mockListLocationsQuery).toHaveBeenCalledWith(
			expect.objectContaining({
				isGroup: true,
				excludeDescendantsOf: existingLocation.id,
			}),
			expect.anything(),
		);
	});

	it("does not exclude anything when creating a location", () => {
		renderWithProviders(<LocationFormPage />);

		const [input] = mockListLocationsQuery.mock.calls[0];
		expect(input).toMatchObject({ isGroup: true });
		expect(input.excludeDescendantsOf).toBeUndefined();
	});

	it("shows the ancestor path in edit mode", async () => {
		currentId = existingLocation.id;
		renderWithProviders(<LocationFormPage />);

		const path = await screen.findByLabelText("Location path");
		expect(path).toHaveTextContent("Global HQ");
		expect(path).toHaveTextContent("Head Office");
	});

	it("pre-selects the parent when adding a child location", async () => {
		currentParentId = parentLocation.id;
		const user = userEvent.setup();
		renderWithProviders(<LocationFormPage />);

		await user.type(screen.getByLabelText(/Location Name/i), "Child");
		await user.click(screen.getByRole("button", { name: /Save/i }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Child",
					parentLocationId: parentLocation.id,
				}),
			);
		});
	});

	it("hydrates the container, coordinate, UOM and geolocation fields", async () => {
		currentId = existingLocation.id;
		renderWithProviders(<LocationFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Head Office")).toBeInTheDocument();
		});
		expect(screen.getByLabelText(/Latitude/i)).toHaveValue("12.5");
		expect(screen.getByLabelText(/Longitude/i)).toHaveValue("77.25");
		expect(screen.getByLabelText(/Area UOM/i)).toHaveValue("Square Meter");
		expect(
			screen.getByRole("checkbox", { name: /Is Container/i }),
		).toBeChecked();
		expect(screen.getByLabelText(/Geolocation/i)).toHaveValue(
			JSON.stringify(existingLocation.geolocation, null, 2),
		);
	});

	it("shows the computed area read-only", async () => {
		currentId = existingLocation.id;
		renderWithProviders(<LocationFormPage />);

		const area = await screen.findByLabelText("Area");
		expect(area).toHaveAttribute("readonly");
		expect(area).toHaveValue("2,500 m²");
	});

	it("sends container, coordinates, UOM and parsed geolocation without an area", async () => {
		const user = userEvent.setup();
		renderWithProviders(<LocationFormPage />);

		await user.type(screen.getByLabelText(/Location Name/i), "Farm");
		await user.click(screen.getByRole("checkbox", { name: /Is Container/i }));
		await user.type(screen.getByLabelText(/Latitude/i), "19.1");
		await user.type(screen.getByLabelText(/Longitude/i), "72.87");
		await user.type(screen.getByLabelText(/Area UOM/i), "Square Meter");
		fireEvent.change(screen.getByLabelText(/Geolocation/i), {
			target: { value: '{"type":"FeatureCollection","features":[]}' },
		});
		await user.click(screen.getByRole("button", { name: /Save/i }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Farm",
					isContainer: true,
					latitude: 19.1,
					longitude: 72.87,
					areaUom: "Square Meter",
					geolocation: { type: "FeatureCollection", features: [] },
				}),
			);
		});
		expect(mockCreateMutate.mock.calls[0][0]).not.toHaveProperty("area");
	});

	it("shows the group/leaf status summary", () => {
		renderWithProviders(<LocationFormPage />);

		expect(
			screen.getByText(/Leaf \(end-point location\)/i),
		).toBeInTheDocument();
	});

	it("shows group status when Is Group is checked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<LocationFormPage />);

		await user.click(screen.getByRole("checkbox", { name: /Is Group/i }));

		expect(
			screen.getByText(/Group \(can have children\)/i),
		).toBeInTheDocument();
	});
});

describe("LocationFormPage — read-only access", () => {
	beforeEach(() => {
		canManageAssets.value = false;
	});

	afterEach(() => {
		canManageAssets.value = true;
	});

	it("renders the write-access notice instead of the form", () => {
		renderWithProviders(<LocationFormPage />);

		expect(
			screen.getByText(
				/You need the owner or admin role in this organization to change asset records/i,
			),
		).toBeInTheDocument();
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
	});
});
