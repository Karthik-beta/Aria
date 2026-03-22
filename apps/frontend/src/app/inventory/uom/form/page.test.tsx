import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import UnitOfMeasureFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;
let currentSearchParams = new URLSearchParams();

const mockUnitsOfMeasure = [
	{
		id: "clh123uom",
		name: "Nos",
		disabled: false,
		isWholeNumber: true,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-02"),
	},
];

const getMockUnitOfMeasureById = (id: string | null) =>
	mockUnitsOfMeasure.find((unit) => unit.id === id) ?? null;

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
		pathname: "/",
		query: {},
	}),
	useSearchParams: () => ({
		get: (key: string) =>
			key === "id" ? currentId : currentSearchParams.get(key),
	}),
}));

vi.mock("@hookform/resolvers/zod", () => ({
	zodResolver: () => async (values: unknown) => ({
		values,
		errors: {},
	}),
}));

vi.mock("@aria/types", () => ({
	Inventory: {
		createUnitOfMeasureSchema: {
			safeParse: (input: unknown) => ({
				success: true as const,
				data: input,
			}),
		},
		updateUnitOfMeasureSchema: {
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
			inventory: {
				listUnitsOfMeasure: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				getUnitOfMeasureById: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			getUnitOfMeasureById: {
				useQuery: () => ({
					data: getMockUnitOfMeasureById(currentId),
					isLoading: false,
				}),
			},
			createUnitOfMeasure: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updateUnitOfMeasure: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("UnitOfMeasureFormPage", () => {
	beforeEach(() => {
		currentId = null;
		currentSearchParams = new URLSearchParams();
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("submits the create payload", async () => {
		currentSearchParams = new URLSearchParams({ name: "Box" });
		const user = userEvent.setup();
		renderWithProviders(<UnitOfMeasureFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Box")).toBeInTheDocument();
		});

		expect(screen.getByLabelText("Enabled")).toBeChecked();
		expect(screen.getByLabelText("Must be Whole Number")).toBeChecked();

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith({
				name: "Box",
				disabled: false,
				isWholeNumber: true,
			});
		});
	});

	it("prefills edit form and submits the update payload", async () => {
		currentId = "clh123uom";
		const user = userEvent.setup();
		renderWithProviders(<UnitOfMeasureFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Nos")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith({
				id: "clh123uom",
				name: "Nos",
				disabled: false,
				isWholeNumber: true,
			});
		});
	});

	it("redirects to the list page when the edit record is missing", async () => {
		currentId = "missing-id";
		renderWithProviders(<UnitOfMeasureFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/inventory/uom");
		});
	});
});
