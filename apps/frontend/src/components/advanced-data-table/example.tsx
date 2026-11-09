/**
 * Example: Advanced Data Table Implementation
 * Demonstrates how to use the AdvancedDataTable component with tRPC
 */

"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle, Edit, FileDown, Trash, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
	AdvancedDataTable,
	type BulkAction,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";

// import { trpc } from '@/lib/trpc'; // Uncomment when tRPC is set up

// Example data type
interface Product {
	id: string;
	name: string;
	code: string;
	category: string;
	price: number;
	stock: number;
	status: "active" | "inactive" | "discontinued";
	createdAt: Date;
	updatedAt: Date;
}

// Example column configuration
const columns: ColumnDef<Product>[] = [
	// Selection column
	{
		id: "select",
		header: ({ table }) => (
			<input
				type="checkbox"
				checked={table.getIsAllPageRowsSelected()}
				onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
				aria-label="Select all"
				className="h-4 w-4 rounded border-gray-300"
			/>
		),
		cell: ({ row }) => (
			<input
				type="checkbox"
				checked={row.getIsSelected()}
				onChange={(e) => row.toggleSelected(e.target.checked)}
				aria-label="Select row"
				className="h-4 w-4 rounded border-gray-300"
			/>
		),
		enableSorting: false,
		enableHiding: false,
	},

	// Name column with search
	{
		accessorKey: "name",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Product Name" />
		),
		cell: ({ row }) => (
			<div className="font-medium">{row.getValue("name")}</div>
		),
		meta: {
			label: "Product Name",
			placeholder: "Search products...",
			variant: "text",
			searchable: true,
			exportable: true,
		},
		enableSorting: true,
		enableColumnFilter: true,
	},

	// Code column
	{
		accessorKey: "code",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Code" />
		),
		cell: ({ row }) => <code className="text-xs">{row.getValue("code")}</code>,
		meta: {
			label: "Code",
			variant: "text",
			exportable: true,
		},
		enableSorting: true,
	},

	// Category with multiselect filter
	{
		accessorKey: "category",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Category" />
		),
		cell: ({ row }) => (
			<Badge variant="outline" className="capitalize">
				{row.getValue("category")}
			</Badge>
		),
		meta: {
			label: "Category",
			variant: "multiSelect",
			options: [
				{ label: "Electronics", value: "electronics" },
				{ label: "Furniture", value: "furniture" },
				{ label: "Clothing", value: "clothing" },
				{ label: "Books", value: "books" },
			],
			exportable: true,
		},
		enableColumnFilter: true,
		filterFn: (row, id, value) => {
			return value.includes(row.getValue(id));
		},
	},

	// Price with number filter
	{
		accessorKey: "price",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Price" />
		),
		cell: ({ row }) => {
			const price = parseFloat(row.getValue("price"));
			const formatted = new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: "USD",
			}).format(price);
			return <div className="font-medium">{formatted}</div>;
		},
		meta: {
			label: "Price",
			variant: "number",
			unit: "$",
			exportable: true,
		},
		enableSorting: true,
	},

	// Stock with number filter
	{
		accessorKey: "stock",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Stock" />
		),
		cell: ({ row }) => {
			const stock = row.getValue("stock") as number;
			return (
				<div className={stock < 10 ? "text-red-600" : "text-green-600"}>
					{stock} units
				</div>
			);
		},
		meta: {
			label: "Stock",
			variant: "number",
			exportable: true,
		},
		enableSorting: true,
	},

	// Status with select filter
	{
		accessorKey: "status",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Status" />
		),
		cell: ({ row }) => {
			const status = row.getValue("status") as Product["status"];
			const Icon = status === "active" ? CheckCircle : XCircle;
			const variant = status === "active" ? "default" : "secondary";

			return (
				<Badge variant={variant} className="capitalize">
					<Icon className="mr-1 h-3 w-3" />
					{status}
				</Badge>
			);
		},
		meta: {
			label: "Status",
			variant: "multiSelect",
			options: [
				{ label: "Active", value: "active", icon: CheckCircle },
				{ label: "Inactive", value: "inactive", icon: XCircle },
				{ label: "Discontinued", value: "discontinued", icon: XCircle },
			],
			exportable: true,
		},
		enableColumnFilter: true,
		filterFn: (row, id, value) => {
			return value.includes(row.getValue(id));
		},
	},

	// Actions column
	{
		id: "actions",
		header: "Actions",
		cell: ({ row }) => (
			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						toast.success(`Editing ${row.original.name}`);
					}}
				>
					<Edit className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						toast.success(`Deleting ${row.original.name}`);
					}}
				>
					<Trash className="h-4 w-4 text-red-600" />
				</Button>
			</div>
		),
		enableSorting: false,
		enableHiding: false,
	},
];

// Example mock data
const mockData: Product[] = Array.from({ length: 100 }, (_, i) => ({
	id: `prod-${i + 1}`,
	name: `Product ${i + 1}`,
	code: `CODE-${String(i + 1).padStart(5, "0")}`,
	category: ["electronics", "furniture", "clothing", "books"][i % 4],
	price: Math.random() * 1000,
	stock: Math.floor(Math.random() * 100),
	status: ["active", "inactive", "discontinued"][i % 3] as Product["status"],
	createdAt: new Date(),
	updatedAt: new Date(),
}));

export function AdvancedDataTableExample() {
	// Uncomment when tRPC is set up:
	// const { data, isLoading } = trpc.products.list.useQuery({
	//   page: 1,
	//   pageSize: 25,
	// });

	const { table } = useAdvancedDataTable({
		data: mockData, // Replace with data?.items || []
		columns,
		pageCount: 4, // Replace with Math.ceil((data?.total || 0) / 25)
		initialPageSize: 25,
	});

	// Define bulk actions
	const bulkActions: BulkAction<Product>[] = [
		{
			label: "Export Selected",
			icon: <FileDown className="h-4 w-4" />,
			action: async (rows) => {
				toast.success(`Exporting ${rows.length} products`);
			},
			variant: "outline",
		},
		{
			label: "Activate Selected",
			icon: <CheckCircle className="h-4 w-4" />,
			action: async (rows) => {
				const ids = rows.map((r) => r.original.id);
				toast.success(`Activated ${ids.length} products`);
			},
			variant: "default",
		},
		{
			label: "Delete Selected",
			icon: <Trash className="h-4 w-4" />,
			action: async (rows) => {
				const ids = rows.map((r) => r.original.id);
				toast.success(`Deleted ${ids.length} products`);
			},
			variant: "destructive",
			requiresConfirmation: true,
			confirmationMessage:
				"This will permanently delete the selected products. This action cannot be undone.",
		},
	];

	return (
		<div className="container mx-auto py-10">
			<AdvancedDataTable
				table={table}
				data={mockData} // Replace with data?.items || []
				totalItems={100} // Replace with data?.total
				enableGlobalSearch
				enableExport
				enableImport
				enableBulkActions
				enableVirtualization
				enableColumnResizing
				enableColumnReordering
				exportFormats={["csv", "excel", "json"]}
				bulkActions={bulkActions}
				onExport={async (format, rows) => {
					toast.success(
						`Exported ${rows.length} rows as ${format.toUpperCase()}`,
					);
				}}
				onImport={async (data) => {
					toast.success(`Imported ${data.length} rows`);
				}}
				ariaLabel="Products table"
				ariaDescription="A table of all products with advanced filtering, sorting, and bulk actions"
			/>
		</div>
	);
}
