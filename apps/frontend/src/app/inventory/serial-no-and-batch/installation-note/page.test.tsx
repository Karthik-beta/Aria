import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import InstallationNotePage from "./page";

const { mockDeleteMutate, mockInvalidate, mockUseSubscription } = vi.hoisted(
	() => ({
		mockDeleteMutate: vi.fn(),
		mockInvalidate: vi.fn().mockResolvedValue(undefined),
		mockUseSubscription: vi.fn(),
	}),
);

vi.mock("@aria/types", () => ({
	Inventory: {
		installationNoteStatusSchema: {
			options: ["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listInstallationNotes: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue({ items: [], totalCount: 0 }),
					setData: vi.fn(),
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			onInstallationNotesChanged: {
				useSubscription: mockUseSubscription,
			},
			listInstallationNotes: {
				useQuery: () => ({
					data: {
						items: [
							{
								id: "ins-1",
								series: "MAT-INS-2026-00001",
								seriesPattern: "MAT-INS-.YYYY.-",
								installationDate: new Date("2026-03-26"),
								installationTime: "10:30:00",
								customer: "Acme Industries",
								customerName: "Acme Industries",
								customerAddress: null,
								contactPerson: null,
								territory: "All Territories",
								customerGroup: "Corporate",
								company: "Aria Corp",
								status: "DRAFT",
								deliveryNoteId: null,
								deliveryNoteSeries: null,
								remarks: "Ready to install",
								items: [],
								createdAt: new Date("2026-03-26"),
								updatedAt: new Date("2026-03-26"),
							},
						],
						totalCount: 1,
					},
					error: null,
					refetch: vi.fn(),
				}),
			},
			listDeliveryNotes: {
				useQuery: () => ({ data: [] }),
			},
			deleteInstallationNote: {
				useMutation: () => ({
					isPending: false,
					mutate: mockDeleteMutate,
				}),
			},
		},
	},
}));

describe("InstallationNotePage", () => {
	beforeEach(() => {
		mockDeleteMutate.mockClear();
		mockInvalidate.mockClear();
		mockUseSubscription.mockClear();
	});

	it("renders installation note list data", () => {
		renderWithProviders(<InstallationNotePage />);

		expect(
			screen.getByRole("heading", { name: "Installation Note" }),
		).toBeInTheDocument();
		expect(screen.getByText("MAT-INS-2026-00001")).toBeInTheDocument();
		expect(screen.getAllByText("Acme Industries")).toHaveLength(2);
	});

	it("submits delete from the row actions menu", async () => {
		const user = userEvent.setup();
		renderWithProviders(<InstallationNotePage />);

		await user.click(
			screen.getByRole("button", {
				name: /Open actions for MAT-INS-2026-00001/i,
			}),
		);
		await user.click(
			screen.getByRole("menuitem", { name: /Delete Installation Note/i }),
		);
		await user.click(screen.getByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockDeleteMutate).toHaveBeenCalledWith({ id: "ins-1" });
		});
	});
});
