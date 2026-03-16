import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
} from "../../../../../test/utils";
import ShippingRuleFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;
const mockRules = [
	{
		id: "clh123rule",
		shippingRuleLabel: "Priority Shipping",
		shippingRuleType: "SELLING" as const,
		disabled: false,
		calculateBasedOn: "NET_TOTAL" as const,
		shippingAmount: 25,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-02"),
	},
];

const getMockRuleById = (id: string | null) =>
	mockRules.find((rule) => rule.id === id) ?? null;

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

vi.mock("@aria/types", () => {
	const createShape = {
		shippingRuleLabel: {} as never,
		shippingRuleType: {} as never,
		disabled: {} as never,
		calculateBasedOn: {} as never,
		shippingAmount: {} as never,
	};

	return {
		Inventory: {
			createShippingRuleSchema: {
				shape: createShape,
				safeParse: (input: unknown) => ({
					success: true as const,
					data: input,
				}),
			},
			updateShippingRuleSchema: {
				omit: () => ({
					extend: () => ({
						safeParse: (input: unknown) => ({
							success: true as const,
							data: input,
						}),
					}),
				}),
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
			inventory: {
				listShippingRules: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			getShippingRuleById: {
				useQuery: () => ({
					data: getMockRuleById(currentId),
					isLoading: false,
				}),
			},
			createShippingRule: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updateShippingRule: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("ShippingRuleFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("submits create payload", async () => {
		const user = userEvent.setup();
		renderWithProviders(<ShippingRuleFormPage />);

		await user.type(
			screen.getByLabelText(/Shipping Rule Label/i),
			"Standard Shipping",
		);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith({
				shippingRuleLabel: "Standard Shipping",
				shippingRuleType: "SELLING",
				disabled: false,
				calculateBasedOn: "FIXED",
				shippingAmount: 0,
			});
		});
	});

	it("prefills edit form and submits update payload", async () => {
		currentId = "clh123rule";
		const user = userEvent.setup();
		renderWithProviders(<ShippingRuleFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Priority Shipping")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith({
				id: "clh123rule",
				shippingRuleLabel: "Priority Shipping",
				shippingRuleType: "SELLING",
				disabled: false,
				calculateBasedOn: "NET_TOTAL",
				shippingAmount: 25,
			});
		});
	});

	it("redirects to list when edit id is not found", async () => {
		currentId = "missing-id";
		renderWithProviders(<ShippingRuleFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/inventory/shipping-rules");
		});
	});
});
