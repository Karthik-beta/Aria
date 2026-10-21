import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import { FinanceBookManager } from "./finance-book-manager";

const canManageAssets = vi.hoisted(() => ({ value: true }));
const listState = vi.hoisted(() => ({
	isLoading: false,
	items: [{ id: "clbook1", name: "Companies Act" }] as {
		id: string;
		name: string;
	}[],
}));
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/hooks/use-can-manage-assets", () => ({
	useCanManageAssets: () => canManageAssets.value,
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				listFinanceBooks: { invalidate: vi.fn().mockResolvedValue(undefined) },
			},
		}),
		asset: {
			listFinanceBooks: {
				useQuery: () => ({
					data: listState.isLoading ? undefined : { items: listState.items },
					isLoading: listState.isLoading,
				}),
			},
			createFinanceBook: {
				useMutation: () => ({ isPending: false, mutate: mockCreate }),
			},
			updateFinanceBook: {
				useMutation: () => ({ isPending: false, mutate: mockUpdate }),
			},
			deleteFinanceBook: {
				useMutation: () => ({ isPending: false, mutate: mockDelete }),
			},
		},
	},
}));

describe("FinanceBookManager", () => {
	beforeEach(() => {
		canManageAssets.value = true;
		listState.isLoading = false;
		listState.items = [{ id: "clbook1", name: "Companies Act" }];
		mockCreate.mockClear();
		mockUpdate.mockClear();
		mockDelete.mockClear();
	});

	it("renders the add form and row actions for managers", () => {
		renderWithProviders(<FinanceBookManager />);

		expect(
			screen.getByRole("heading", { name: /Finance Books/i }),
		).toBeInTheDocument();
		expect(screen.getByLabelText("Name")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Delete Companies Act" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Rename Companies Act" }),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/Only organization owners and admins/i),
		).not.toBeInTheDocument();
	});

	it("renders a read-only list without write controls for non-managers", () => {
		canManageAssets.value = false;
		renderWithProviders(<FinanceBookManager />);

		expect(screen.getByText("Companies Act")).toBeInTheDocument();
		expect(screen.queryByText("New Finance Book")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Add" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Delete Companies Act/ }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Rename Companies Act/ }),
		).not.toBeInTheDocument();
		expect(
			screen.getByText(
				"Only organization owners and admins can change finance books.",
			),
		).toBeInTheDocument();
	});

	it("renders the empty state", () => {
		listState.items = [];
		renderWithProviders(<FinanceBookManager />);

		expect(screen.getByText("No named finance books yet.")).toBeInTheDocument();
	});

	it("does not render the list while loading", () => {
		listState.isLoading = true;
		renderWithProviders(<FinanceBookManager />);

		expect(screen.queryByText("Companies Act")).not.toBeInTheDocument();
		expect(
			screen.queryByText("No named finance books yet."),
		).not.toBeInTheDocument();
	});

	it("creates a finance book with the trimmed name", async () => {
		const user = userEvent.setup();
		renderWithProviders(<FinanceBookManager />);

		await user.type(screen.getByLabelText("Name"), "  IFRS  ");
		await user.click(screen.getByRole("button", { name: "Add" }));

		expect(mockCreate).toHaveBeenCalledWith({ name: "IFRS" });
	});

	it("deletes a finance book", async () => {
		const user = userEvent.setup();
		renderWithProviders(<FinanceBookManager />);

		await user.click(
			screen.getByRole("button", { name: "Delete Companies Act" }),
		);

		expect(mockDelete).toHaveBeenCalledWith({ id: "clbook1" });
	});

	it("renames a finance book with the trimmed name", async () => {
		const user = userEvent.setup();
		renderWithProviders(<FinanceBookManager />);

		await user.click(
			screen.getByRole("button", { name: "Rename Companies Act" }),
		);
		const input = await screen.findByLabelText("Name", {
			selector: "#finance-book-rename",
		});
		await user.clear(input);
		await user.type(input, " Tax Book ");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(mockUpdate).toHaveBeenCalledWith({
				id: "clbook1",
				name: "Tax Book",
			}),
		);
	});
});
