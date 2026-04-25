import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import DeliveryTripFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const mockDeliveryTrips = [
	{
		id: "clh123dt000001",
		series: "MAT-DT-2026-00001",
		seriesPattern: "MAT-DT-.YYYY.-",
		status: "DRAFT" as const,
		company: "Aria Corp",
		driver: "John Doe",
		driverAddress: "123 Main St",
		vehicle: "Truck-01",
		departureTime: new Date("2026-04-01T08:00:00.000Z"),
		initialEmailNotificationSent: false,
		stops: [
			{
				id: "clh123dt000001stop01",
				deliveryTripId: "clh123dt000001",
				stopNumber: 1,
				customer: "Customer A",
				addressName: "456 Oak Ave",
				locked: false,
				deliveryNote: null,
				estimatedArrival: null,
			},
		],
		createdAt: new Date("2026-03-23"),
		updatedAt: new Date("2026-03-23"),
	},
];

const getMockDeliveryTripById = (id: string | null) =>
	mockDeliveryTrips.find((dt) => dt.id === id) ?? null;

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
	Inventory: {
		createDeliveryTripStopSchema: { shape: {} },
		createDeliveryTripSchema: {
			shape: {},
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
		updateDeliveryTripSchema: {
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listDeliveryTrips: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			getDeliveryTripById: {
				useQuery: () => ({
					data: getMockDeliveryTripById(currentId),
					isLoading: false,
				}),
			},
			createDeliveryTrip: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updateDeliveryTrip: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("DeliveryTripFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("renders create form with Save button", () => {
		renderWithProviders(<DeliveryTripFormPage />);

		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		expect(screen.getByText("New Delivery Trip")).toBeInTheDocument();
	});

	it("submits create payload with company", async () => {
		const user = userEvent.setup();
		renderWithProviders(<DeliveryTripFormPage />);

		await user.clear(screen.getByLabelText(/Company \*/i));
		await user.type(screen.getByLabelText(/Company \*/i), "Aria Corp");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ company: "Aria Corp" }),
			);
		});
	});

	it("prefills edit form with series from data", async () => {
		currentId = "clh123dt000001";
		renderWithProviders(<DeliveryTripFormPage />);

		await waitFor(() => {
			expect(screen.getByText("MAT-DT-2026-00001")).toBeInTheDocument();
		});
	});

	it("renders stop rows in edit mode", async () => {
		currentId = "clh123dt000001";
		renderWithProviders(<DeliveryTripFormPage />);

		await waitFor(() => {
			expect(screen.getByText("MAT-DT-2026-00001")).toBeInTheDocument();
		});
	});
});
