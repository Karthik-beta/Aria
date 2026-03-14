/**
 * AdvancedDataTable Component Tests
 * Tests for the main table component rendering and interactions
 */

import type { ColumnDef } from "@tanstack/react-table";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import { AdvancedDataTable } from "./advanced-data-table";
import { useAdvancedDataTable } from "./use-advanced-data-table";

// Test data type
type TestProduct = {
	id: string;
	name: string;
	price: number;
	stock: number;
};

// Test data
const products: TestProduct[] = [
	{ id: "1", name: "Laptop", price: 999, stock: 50 },
	{ id: "2", name: "Mouse", price: 29, stock: 200 },
	{ id: "3", name: "Keyboard", price: 79, stock: 150 },
	{ id: "4", name: "Monitor", price: 299, stock: 75 },
	{ id: "5", name: "Headphones", price: 149, stock: 100 },
];

// Test columns
const columns: ColumnDef<TestProduct>[] = [
	{
		id: "select",
		header: "Select",
		cell: () => <input type="checkbox" />,
	},
	{
		accessorKey: "name",
		header: "Product Name",
		enableGlobalFilter: true,
	},
	{
		accessorKey: "price",
		header: "Price",
		cell: ({ row }) => `$${row.original.price}`,
	},
	{
		accessorKey: "stock",
		header: "Stock",
		enableSorting: true,
	},
];

// Wrapper component for testing
function TestTableWrapper({
	data = products,
	enableExport = false,
	enableGlobalSearch = false,
}) {
	const { table } = useAdvancedDataTable({
		data,
		columns,
	});

	return (
		<AdvancedDataTable
			table={table}
			data={data}
			enableExport={enableExport}
			enableGlobalSearch={enableGlobalSearch}
			ariaLabel="Products table"
		/>
	);
}

describe("AdvancedDataTable Component", () => {
	describe("Rendering", () => {
		it("should render table with data", () => {
			renderWithProviders(<TestTableWrapper />);

			// Check headers
			expect(screen.getByText("Product Name")).toBeInTheDocument();
			expect(screen.getByText("Price")).toBeInTheDocument();
			expect(screen.getByText("Stock")).toBeInTheDocument();

			// Check data rows
			expect(screen.getByText("Laptop")).toBeInTheDocument();
			expect(screen.getByText("Mouse")).toBeInTheDocument();
			expect(screen.getByText("$999")).toBeInTheDocument();
			expect(screen.getByText("$29")).toBeInTheDocument();
		});

		it("should render with aria attributes", () => {
			renderWithProviders(<TestTableWrapper />);

			// The region has the aria-label, not the table itself
			const region = screen.getByRole("region", { name: "Products table" });
			expect(region).toBeInTheDocument();

			// Table exists within the region
			const table = screen.getByRole("table");
			expect(table).toBeInTheDocument();
		});

		it("should render empty state when no data", () => {
			renderWithProviders(<TestTableWrapper data={[]} />);

			expect(screen.getByText(/no data available/i)).toBeInTheDocument();
		});

		it("should render all columns", () => {
			renderWithProviders(<TestTableWrapper />);

			const headers = screen.getAllByRole("columnheader");
			// Select + Name + Price + Stock
			expect(headers.length).toBeGreaterThanOrEqual(4);
		});
	});

	describe("Toolbar Features", () => {
		it("should render global search when enabled", () => {
			renderWithProviders(<TestTableWrapper enableGlobalSearch />);

			const searchInput = screen.getByPlaceholderText(/search/i);
			expect(searchInput).toBeInTheDocument();
		});

		it("should render export button when enabled", () => {
			renderWithProviders(<TestTableWrapper enableExport />);

			const exportButton = screen.getByRole("button", { name: /export/i });
			expect(exportButton).toBeInTheDocument();
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

			// Should show "Page 1 of X" or similar - use getAllByText since there are multiple "page" texts
			const pageTexts = screen.getAllByText(/page/i);
			expect(pageTexts.length).toBeGreaterThan(0);
		});

		it("should disable previous button on first page", () => {
			renderWithProviders(<TestTableWrapper />);

			const prevButton = screen.getByRole("button", { name: /previous/i });
			expect(prevButton).toBeDisabled();
		});
	});

	describe("Accessibility", () => {
		it("should have proper table structure", () => {
			renderWithProviders(<TestTableWrapper />);

			const table = screen.getByRole("table");
			expect(table).toBeInTheDocument();

			// Table has both thead and tbody which are both rowgroups
			const rowgroups = within(table).getAllByRole("rowgroup");
			expect(rowgroups.length).toBeGreaterThanOrEqual(2); // thead and tbody
		});

		it("should have accessible column headers", () => {
			renderWithProviders(<TestTableWrapper />);

			const headers = screen.getAllByRole("columnheader");
			expect(headers.length).toBeGreaterThan(0);
		});

		it("should have accessible rows", () => {
			renderWithProviders(<TestTableWrapper />);

			const rows = screen.getAllByRole("row");
			// Header row + data rows
			expect(rows.length).toBeGreaterThan(1);
		});
	});

	describe("Responsive Features", () => {
		it("should render without virtualization for small datasets", () => {
			renderWithProviders(<TestTableWrapper />);

			// All 5 products should be rendered
			expect(screen.getByText("Laptop")).toBeInTheDocument();
			expect(screen.getByText("Mouse")).toBeInTheDocument();
			expect(screen.getByText("Keyboard")).toBeInTheDocument();
			expect(screen.getByText("Monitor")).toBeInTheDocument();
			expect(screen.getByText("Headphones")).toBeInTheDocument();
		});
	});

	describe("Error Handling", () => {
		it("should not crash with missing optional props", () => {
			expect(() => {
				renderWithProviders(<TestTableWrapper />);
			}).not.toThrow();
		});

		it("should handle columns without headers gracefully", () => {
			const minimalColumns: ColumnDef<TestProduct>[] = [
				{
					accessorKey: "name",
				},
			];

			const MinimalTable = () => {
				const { table } = useAdvancedDataTable({
					data: products,
					columns: minimalColumns,
				});
				return <AdvancedDataTable table={table} data={products} />;
			};

			expect(() => {
				renderWithProviders(<MinimalTable />);
			}).not.toThrow();
		});
	});
});
