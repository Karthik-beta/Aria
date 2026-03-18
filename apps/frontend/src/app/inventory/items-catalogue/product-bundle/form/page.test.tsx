import { describe, expect, it, vi } from "vitest";
import {
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
} from "../../../../../test/utils";
import ProductBundleFormPage from "./page";

const mockMutate = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
		pathname: "/",
		query: {},
	}),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listProductBundles: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			listBundleItems: {
				useQuery: () => ({
					data: [
						{
							id: "clh1234567890abcde123456",
							name: "Parent Item",
							code: "PARENT-001",
							defaultUnitOfMeasureId: "clh1234567890abcde123458",
						},
						{
							id: "clh1234567890abcde123457",
							name: "Child Item",
							code: "CHILD-001",
							defaultUnitOfMeasureId: "clh1234567890abcde123458",
						},
					],
				}),
			},
			listUnitsOfMeasure: {
				useQuery: () => ({
					data: [{ id: "clh1234567890abcde123458", name: "Nos" }],
				}),
			},
			createProductBundle: {
				useMutation: () => ({
					isPending: false,
					mutate: mockMutate,
				}),
			},
		},
	},
}));

describe("ProductBundleFormPage", () => {
	it("renders expected sections", () => {
		renderWithProviders(<ProductBundleFormPage />);

		expect(screen.getByText("New Product Bundle")).toBeInTheDocument();
		expect(screen.getByText("About Product Bundle")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Add Row" })).toBeInTheDocument();
	});

	it("adds an item row", async () => {
		const user = userEvent.setup();
		renderWithProviders(<ProductBundleFormPage />);

		await user.click(screen.getByRole("button", { name: "Add Row" }));

		const rowIndicators = screen.getAllByText(/^[12]$/);
		expect(rowIndicators.length).toBeGreaterThan(1);
	});

	it("submits bundle payload", async () => {
		const user = userEvent.setup();
		renderWithProviders(<ProductBundleFormPage />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockMutate).toHaveBeenCalledWith({
				parentItemId: "clh1234567890abcde123456",
				description: undefined,
				disabled: false,
				bundleItems: [
					{
						itemId: "clh1234567890abcde123457",
						quantity: 1,
						description: undefined,
						unitOfMeasurementId: "clh1234567890abcde123458",
					},
				],
			});
		});
	});
});
