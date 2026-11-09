import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import LocationFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const existingLocation = {
	id: "clh123location",
	name: "Head Office",
	parentLocationId: null,
	parentLocationName: null,
	isGroup: true,
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
		createLocationSchema: {
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
		updateLocationSchema: {
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
	},
}));

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
			listLocations: {
				useQuery: () => ({
					data: {
						items: [parentLocation],
						totalCount: 1,
					},
				}),
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
