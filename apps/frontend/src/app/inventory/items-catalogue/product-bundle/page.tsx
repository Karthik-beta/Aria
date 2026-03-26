"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
	CheckCircle2,
	Eye,
	Heart,
	MessageCircle,
	MoreHorizontal,
	Plus,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/error-display";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function getRelativeAge(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffYears >= 1) return `${diffYears} y`;
	if (diffMonths >= 1) return `${diffMonths} m`;
	if (diffDays >= 1) return `${diffDays} d`;
	return "Today";
}

export default function ProductBundleListPage() {
	const {
		data: rawBundles = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listProductBundles.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: Infinity,
	});

	type ProductBundleRow = Omit<
		(typeof rawBundles)[number],
		"createdAt" | "updatedAt"
	> & {
		createdAt: Date;
		updatedAt: Date;
	};

	const bundles = React.useMemo<ProductBundleRow[]>(
		() =>
			rawBundles.map((bundle) => ({
				...bundle,
				createdAt: new Date(bundle.createdAt),
				updatedAt: new Date(bundle.updatedAt),
			})),
		[rawBundles],
	);

	const columns = React.useMemo<ColumnDef<ProductBundleRow>[]>(
		() => [
			{
				id: "select",
				header: ({ table }) => (
					<Checkbox
						checked={
							table.getIsAllPageRowsSelected() ||
							(table.getIsSomePageRowsSelected() ? "indeterminate" : false)
						}
						onCheckedChange={(value) =>
							table.toggleAllPageRowsSelected(!!value)
						}
						aria-label="Select all"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(!!value)}
						aria-label={`Select ${row.original.id}`}
					/>
				),
				size: 40,
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
			{
				accessorKey: "id",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="ID" />
				),
				cell: ({ row }) => (
					<span className="font-medium text-primary">{row.original.id}</span>
				),
				meta: {
					label: "ID",
					searchable: true,
					exportable: true,
				},
			},
			{
				id: "status",
				accessorFn: (row) => (row.disabled ? "Disabled" : "Enabled"),
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) =>
					row.original.disabled ? (
						<span className="text-muted-foreground text-sm">Disabled</span>
					) : (
						<span className="text-primary text-sm font-medium">Enabled</span>
					),
				meta: {
					label: "Status",
					variant: "multiSelect",
					options: [
						{ label: "Enabled", value: "Enabled", icon: CheckCircle2 },
						{ label: "Disabled", value: "Disabled", icon: XCircle },
					],
					exportable: true,
				},
				enableColumnFilter: true,
				filterFn: (row, _id, value) => {
					const status = row.original.disabled ? "Disabled" : "Enabled";
					return value.includes(status);
				},
			},
			{
				id: "parentItem",
				accessorFn: (row) => row.parentItemName ?? row.parentItemId,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Parent Item" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.parentItemName ?? row.original.parentItemId}
					</span>
				),
				meta: {
					label: "Parent Item",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "description",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Description" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.description || "-"}
					</span>
				),
				meta: {
					label: "Description",
					searchable: true,
					exportable: true,
				},
			},
			{
				id: "items",
				accessorFn: (row) => row.bundleItems.length,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Items" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.bundleItems.length}
					</span>
				),
				meta: {
					label: "Items",
					exportable: true,
				},
			},
			{
				id: "age",
				accessorFn: (row) => row.updatedAt,
				header: () => <span className="text-muted-foreground"></span>,
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{getRelativeAge(new Date(row.original.updatedAt))}
					</span>
				),
				meta: {
					label: "Age",
					variant: "date",
					exportable: true,
				},
				size: 50,
			},
			{
				id: "counts",
				header: () => (
					<div className="text-right text-muted-foreground text-sm">
						{bundles.length} of {bundles.length}
					</div>
				),
				cell: () => (
					<div className="flex items-center justify-end gap-2 text-muted-foreground text-sm">
						<MessageCircle className="h-4 w-4" />
						<span>0</span>
						<Heart className="h-4 w-4" />
					</div>
				),
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
				size: 80,
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 w-8 p-0">
								<span className="sr-only">Open menu</span>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link
									href={`/inventory/items-catalogue/item/${row.original.parentItemId}`}
								>
									<Eye className="mr-2 h-4 w-4" />
									View Parent Item
								</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
		],
		[bundles.length],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<ProductBundleRow>({
		data: bundles,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "age", desc: true }],
		enableRowSelection: true,
		enableMultiRowSelection: true,
		enableGlobalFilter: true,
		onReload: handleReload,
	});

	return (
		<div className="container mx-auto py-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Product Bundles</h1>
					<p className="text-muted-foreground">
						Manage bundled products and parent item associations
					</p>
				</div>
			</div>

			{isLoading && (
				<div className="flex items-center justify-center py-12">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
				</div>
			)}

			{queryError && !isLoading && (
				<ErrorState
					error={queryError}
					operation="load"
					title="Failed to load product bundles"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={bundles}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={
						<Link
							href="/inventory/items-catalogue/product-bundle/form"
							className={cn(buttonVariants({ variant: "default", size: "sm" }))}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Product Bundle
						</Link>
					}
					ariaLabel="Product bundles table"
				/>
			)}
		</div>
	);
}
