/**
 * AdvancedDataTable Component Tests
 * Tests for the main table component rendering and bulk-edit interactions.
 */

import type { ColumnDef } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import {
	fireEvent,
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
	within,
} from "@/test/utils";
import { AdvancedDataTable } from "./advanced-data-table";
import type { AdvancedDataTableProps } from "./types";
import { useAdvancedDataTable } from "./use-advanced-data-table";

const { toastError, toastSuccess } = vi.hoisted(() => ({
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: {
		success: toastSuccess,
		error: toastError,
	},
}));

type TestProduct = {
	id: string;
	name: string;
	price: number;
	stock: number;
	active: boolean;
	category: "hardware" | "accessory";
	launchDate: string;
};

const products: TestProduct[] = [
	{
		id: "1",
		name: "Laptop",
		price: 999,
		stock: 50,
		active: true,
		category: "hardware",
		launchDate: "2026-01-10",
	},
	{
		id: "2",
		name: "Mouse",
		price: 29,
		stock: 200,
		active: false,
		category: "accessory",
		launchDate: "2026-02-11",
	},
	{
		id: "3",
		name: "Keyboard",
		price: 79,
		stock: 150,
		active: true,
		category: "accessory",
		launchDate: "2026-03-12",
	},
	{
		id: "4",
		name: "Monitor",
		price: 299,
		stock: 75,
		active: true,
		category: "hardware",
		launchDate: "2026-04-13",
	},
	{
		id: "5",
		name: "Headphones",
		price: 149,
		stock: 100,
		active: false,
		category: "accessory",
		launchDate: "2026-05-14",
	},
];

const columns: ColumnDef<TestProduct>[] = [
	{
		id: "select",
		header: ({ table }) => (
			<input
				type="checkbox"
				checked={table.getIsAllPageRowsSelected()}
				onChange={(event) =>
					table.toggleAllPageRowsSelected(event.target.checked)
				}
				aria-label="Select all rows"
			/>
		),
		cell: ({ row }) => (
			<input
				type="checkbox"
				checked={row.getIsSelected()}
				onChange={(event) => row.toggleSelected(event.target.checked)}
				aria-label={`Select row ${row.original.id}`}
			/>
		),
		enableSorting: false,
		enableColumnFilter: false,
		enableGlobalFilter: false,
	},
	{
		accessorKey: "name",
		header: "Product Name",
		enableGlobalFilter: true,
		meta: {
			label: "Product Name",
			bulkEdit: {
				type: "text",
				allowClear: true,
			},
		},
	},
	{
		accessorKey: "price",
		header: "Price",
		cell: ({ row }) => `$${row.original.price}`,
		meta: {
			label: "Price",
			bulkEdit: {
				type: "number",
			},
		},
	},
	{
		accessorKey: "active",
		header: "Active",
		cell: ({ row }) => (row.original.active ? "True" : "False"),
		meta: {
			label: "Active",
			bulkEdit: {
				type: "boolean",
				allowClear: true,
			},
		},
	},
	{
		accessorKey: "category",
		header: "Category",
		cell: ({ row }) => row.original.category,
		meta: {
			label: "Category",
			options: [
				{ label: "Hardware", value: "hardware" },
				{ label: "Accessory", value: "accessory" },
			],
			bulkEdit: {
				type: "select",
			},
		},
	},
	{
		accessorKey: "launchDate",
		header: "Launch Date",
		meta: {
			label: "Launch Date",
			bulkEdit: {
				type: "date",
			},
		},
	},
	{
		accessorKey: "stock",
		header: "Stock",
		enableSorting: true,
		meta: {
			label: "Stock",
		},
	},
];

function TestTableWrapper({
	data = products,
	tableColumns = columns,
	enableExport = false,
	enableGlobalSearch = false,
	enableBulkEdit = false,
	onBulkEdit,
	onError,
}: {
	data?: TestProduct[];
	tableColumns?: ColumnDef<TestProduct>[];
	enableExport?: boolean;
	enableGlobalSearch?: boolean;
	enableBulkEdit?: boolean;
	onBulkEdit?: AdvancedDataTableProps<TestProduct>["onBulkEdit"];
	onError?: AdvancedDataTableProps<TestProduct>["onError"];
}) {
	const { table } = useAdvancedDataTable({
		data,
		columns: tableColumns,
	});

	return (
		<AdvancedDataTable
			table={table}
			data={data}
			enableExport={enableExport}
			enableGlobalSearch={enableGlobalSearch}
			enableBulkEdit={enableBulkEdit}
			onBulkEdit={onBulkEdit}
			onError={onError}
			ariaLabel="Products table"
		/>
	);
}

async function openBulkEditDialog() {
	const user = userEvent.setup({ pointerEventsCheck: 0 });

	await user.click(screen.getByLabelText("Select row 1"));
	await user.click(await screen.findByRole("button", { name: /actions/i }));
	await user.click(await screen.findByRole("menuitem", { name: "Bulk Edit" }));

	return user;
}

async function chooseSelectOption(
	user: Awaited<ReturnType<typeof userEvent.setup>>,
	label: string,
	option: string,
) {
	await user.click(screen.getByLabelText(label));
	await user.click(await screen.findByRole("option", { name: option }));
}

function getBulkEditValueControl() {
	const element = document.getElementById("bulk-edit-value");
	if (!element) {
		throw new Error("Bulk edit value control not found");
	}

	return element;
}

describe("AdvancedDataTable Component", () => {
	describe("Rendering", () => {
		it("should render table with data", () => {
			renderWithProviders(<TestTableWrapper />);

			expect(screen.getByText("Product Name")).toBeInTheDocument();
			expect(screen.getByText("Price")).toBeInTheDocument();
			expect(screen.getByText("Stock")).toBeInTheDocument();
			expect(screen.getByText("Laptop")).toBeInTheDocument();
			expect(screen.getByText("Mouse")).toBeInTheDocument();
			expect(screen.getByText("$999")).toBeInTheDocument();
			expect(screen.getByText("$29")).toBeInTheDocument();
		});

		it("should render with aria attributes", () => {
			renderWithProviders(<TestTableWrapper />);

			expect(
				screen.getByRole("region", { name: "Products table" }),
			).toBeInTheDocument();
			expect(screen.getByRole("table")).toBeInTheDocument();
		});

		it("should render empty state when no data", () => {
			renderWithProviders(<TestTableWrapper data={[]} />);

			expect(screen.getByText(/no data available/i)).toBeInTheDocument();
		});

		it("should render all columns", () => {
			renderWithProviders(<TestTableWrapper />);

			expect(screen.getAllByRole("columnheader").length).toBeGreaterThanOrEqual(
				7,
			);
		});
	});

	describe("Toolbar Features", () => {
		it("should render global search when enabled", () => {
			renderWithProviders(<TestTableWrapper enableGlobalSearch />);

			expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
		});

		it("should render export button when enabled", () => {
			renderWithProviders(<TestTableWrapper enableExport />);

			expect(
				screen.getByRole("button", { name: /export/i }),
			).toBeInTheDocument();
		});

		it("shows bulk edit only when selection exists and eligible fields are present", async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });
			renderWithProviders(
				<TestTableWrapper
					enableBulkEdit
					onBulkEdit={vi.fn().mockResolvedValue(undefined)}
				/>,
			);

			expect(
				screen.queryByRole("button", { name: /actions/i }),
			).not.toBeInTheDocument();

			await user.click(screen.getByLabelText("Select row 1"));
			await user.click(screen.getByRole("button", { name: /actions/i }));

			expect(
				screen.getByRole("menuitem", { name: "Bulk Edit" }),
			).toBeInTheDocument();
		});

		it("hides the action menu when no columns opt into bulk edit", async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });
			const columnsWithoutBulkEdit = columns.map((column) => ({
				...column,
				meta: column.meta ? { ...column.meta, bulkEdit: undefined } : undefined,
			}));

			renderWithProviders(
				<TestTableWrapper
					enableBulkEdit
					onBulkEdit={vi.fn().mockResolvedValue(undefined)}
					tableColumns={columnsWithoutBulkEdit}
				/>,
			);

			await user.click(screen.getByLabelText("Select row 1"));

			expect(
				screen.queryByRole("button", { name: /actions/i }),
			).not.toBeInTheDocument();
		});
	});

	describe("Bulk Edit", () => {
		it("lists only explicit bulk-edit fields", async () => {
			renderWithProviders(
				<TestTableWrapper
					enableBulkEdit
					onBulkEdit={vi.fn().mockResolvedValue(undefined)}
				/>,
			);
			const user = await openBulkEditDialog();

			await user.click(screen.getByLabelText("Field"));

			expect(
				await screen.findByRole("option", { name: "Product Name" }),
			).toBeInTheDocument();
			expect(screen.getByRole("option", { name: "Price" })).toBeInTheDocument();
			expect(
				screen.getByRole("option", { name: "Active" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("option", { name: "Category" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("option", { name: "Launch Date" }),
			).toBeInTheDocument();
			expect(
				screen.queryByRole("option", { name: "Stock" }),
			).not.toBeInTheDocument();
		});

		it("switches the value editor for text, number, boolean, select, and date fields", async () => {
			renderWithProviders(
				<TestTableWrapper
					enableBulkEdit
					onBulkEdit={vi.fn().mockResolvedValue(undefined)}
				/>,
			);
			const user = await openBulkEditDialog();

			expect(getBulkEditValueControl()).toHaveAttribute("type", "text");

			await chooseSelectOption(user, "Field", "Price");
			expect(getBulkEditValueControl()).toHaveAttribute("type", "number");

			await chooseSelectOption(user, "Field", "Active");
			expect(getBulkEditValueControl()).toHaveAttribute("aria-label", "Value");
			expect(getBulkEditValueControl().tagName).toMatch(/^(BUTTON|DIV)$/);

			await chooseSelectOption(user, "Field", "Category");
			expect(getBulkEditValueControl()).toHaveAttribute("aria-label", "Value");
			expect(getBulkEditValueControl().tagName).toMatch(/^(BUTTON|DIV)$/);

			await chooseSelectOption(user, "Field", "Launch Date");
			expect(getBulkEditValueControl()).toHaveAttribute("type", "date");
		}, 30_000);

		it("emits a normalized set request", async () => {
			const onBulkEdit = vi.fn().mockResolvedValue(undefined);
			renderWithProviders(
				<TestTableWrapper enableBulkEdit onBulkEdit={onBulkEdit} />,
			);
			const user = await openBulkEditDialog();

			await user.type(screen.getByLabelText("Value"), "Updated Laptop");
			await user.click(
				screen.getByRole("button", { name: /update 1 record/i }),
			);

			await waitFor(() => {
				expect(onBulkEdit).toHaveBeenCalledTimes(1);
			});

			const request = onBulkEdit.mock.calls[0][0];
			expect(request).toEqual(
				expect.objectContaining({
					columnId: "name",
					field: "name",
					operation: "set",
					value: "Updated Laptop",
					config: expect.objectContaining({
						label: "Product Name",
						type: "text",
					}),
				}),
			);
			expect(request.rows).toHaveLength(1);
			expect(request.rows[0]?.original.id).toBe("1");
		});

		it("emits a clear request when the field allows empty values", async () => {
			const onBulkEdit = vi.fn().mockResolvedValue(undefined);
			renderWithProviders(
				<TestTableWrapper enableBulkEdit onBulkEdit={onBulkEdit} />,
			);
			const user = await openBulkEditDialog();

			expect(
				screen.getByText(
					"You have not entered a value. The field will be set to empty.",
				),
			).toBeInTheDocument();

			await user.click(
				screen.getByRole("button", { name: /update 1 record/i }),
			);

			await waitFor(() => {
				expect(onBulkEdit).toHaveBeenCalledTimes(1);
			});

			expect(onBulkEdit.mock.calls[0][0]).toEqual(
				expect.objectContaining({
					columnId: "name",
					field: "name",
					operation: "clear",
				}),
			);
			expect(onBulkEdit.mock.calls[0][0]).not.toHaveProperty("value");
		});

		it("blocks submit for invalid select, number, and date states", async () => {
			renderWithProviders(
				<TestTableWrapper
					enableBulkEdit
					onBulkEdit={vi.fn().mockResolvedValue(undefined)}
				/>,
			);
			const user = await openBulkEditDialog();

			await chooseSelectOption(user, "Field", "Category");
			expect(
				screen.getByRole("button", { name: /update 1 record/i }),
			).toBeDisabled();

			await chooseSelectOption(user, "Field", "Price");
			fireEvent.change(screen.getByLabelText("Value"), {
				target: { value: "invalid-number" },
			});
			expect(
				screen.getByRole("button", { name: /update 1 record/i }),
			).toBeDisabled();

			await chooseSelectOption(user, "Field", "Launch Date");
			fireEvent.change(screen.getByLabelText("Value"), {
				target: { value: "not-a-date" },
			});
			expect(
				screen.getByRole("button", { name: /update 1 record/i }),
			).toBeDisabled();
		}, 30_000);

		it("keeps the dialog open and reports through onError when bulk edit fails", async () => {
			const onBulkEdit = vi.fn().mockRejectedValue(new Error("boom"));
			const onError = vi.fn();
			renderWithProviders(
				<TestTableWrapper
					enableBulkEdit
					onBulkEdit={onBulkEdit}
					onError={onError}
				/>,
			);
			const user = await openBulkEditDialog();

			await user.click(
				screen.getByRole("button", { name: /update 1 record/i }),
			);

			await waitFor(() => {
				expect(onBulkEdit).toHaveBeenCalledTimes(1);
			});
			expect(
				screen.getByRole("heading", { name: "Bulk Edit" }),
			).toBeInTheDocument();
			expect(onError).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "bulk-action",
					actionLabel: "Bulk Edit",
				}),
			);
		});
	});

	describe("Pagination", () => {
		it("should render pagination controls", () => {
			renderWithProviders(<TestTableWrapper />);

			expect(
				screen.getByRole("button", { name: /previous/i }),
			).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
		});

		it("should show correct page information", () => {
			renderWithProviders(<TestTableWrapper />);

			expect(screen.getAllByText(/page/i).length).toBeGreaterThan(0);
		});

		it("should disable previous button on first page", () => {
			renderWithProviders(<TestTableWrapper />);

			expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
		});
	});

	describe("Accessibility", () => {
		it("should have proper table structure", () => {
			renderWithProviders(<TestTableWrapper />);

			const table = screen.getByRole("table");
			expect(
				within(table).getAllByRole("rowgroup").length,
			).toBeGreaterThanOrEqual(2);
		});

		it("should have accessible column headers", () => {
			renderWithProviders(<TestTableWrapper />);

			expect(screen.getAllByRole("columnheader").length).toBeGreaterThan(0);
		});

		it("should have accessible rows", () => {
			renderWithProviders(<TestTableWrapper />);

			expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
		});
	});

	describe("Responsive Features", () => {
		it("should render without virtualization for small datasets", () => {
			renderWithProviders(<TestTableWrapper />);

			expect(screen.getByText("Laptop")).toBeInTheDocument();
			expect(screen.getByText("Mouse")).toBeInTheDocument();
			expect(screen.getByText("Keyboard")).toBeInTheDocument();
			expect(screen.getByText("Monitor")).toBeInTheDocument();
			expect(screen.getByText("Headphones")).toBeInTheDocument();
		});
	});

	describe("Error Handling", () => {
		it("should not crash with missing optional props", () => {
			expect(() => renderWithProviders(<TestTableWrapper />)).not.toThrow();
		});

		it("should handle columns without headers gracefully", () => {
			const minimalColumns: ColumnDef<TestProduct>[] = [
				{ accessorKey: "name" },
			];

			function MinimalTable() {
				const { table } = useAdvancedDataTable({
					data: products,
					columns: minimalColumns,
				});
				return <AdvancedDataTable table={table} data={products} />;
			}

			expect(() => renderWithProviders(<MinimalTable />)).not.toThrow();
		});
	});
});
