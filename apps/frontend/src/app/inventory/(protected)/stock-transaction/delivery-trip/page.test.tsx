import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import DeliveryTripPage from "./page";

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listDeliveryTrips: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue([]),
					setData: vi.fn(),
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			listDeliveryTrips: {
				useQuery: () => ({
					data: [
						{
							id: "clh123dt000001",
							series: "MAT-DT-2026-00001",
							seriesPattern: "MAT-DT-.YYYY.-",
							status: "SCHEDULED",
							company: "Aria Corp",
							driver: "John Doe",
							driverAddress: "123 Main St",
							vehicle: "Truck-01",
							departureTime: new Date("2026-04-01T08:00:00.000Z"),
							initialEmailNotificationSent: false,
							stops: [],
							createdAt: new Date("2026-03-23"),
							updatedAt: new Date("2026-03-23"),
						},
					],
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			deleteDeliveryTrip: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
		},
	},
}));

describe("DeliveryTripPage", () => {
	it("renders page header and create button", () => {
		renderWithProviders(<DeliveryTripPage />);

		expect(screen.getByText("Delivery Trips")).toBeInTheDocument();
		expect(screen.getByText("New Delivery Trip")).toBeInTheDocument();
	});

	it("renders delivery trip row data", () => {
		renderWithProviders(<DeliveryTripPage />);

		expect(screen.getByText("MAT-DT-2026-00001")).toBeInTheDocument();
		expect(screen.getByText("John Doe")).toBeInTheDocument();
		expect(screen.getByText("Scheduled")).toBeInTheDocument();
	});
});
