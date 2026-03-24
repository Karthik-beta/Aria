"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Edit, MoreHorizontal, Plus, Trash } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { AlertModal } from "@/components/modal/alert-modal";
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
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

/**
 * Returns a human-readable age string relative to now, capped at years.
 *
 * @param date - The reference date to measure from.
 * @returns `"Today"`, `"<n> d"`, `"<n> m"`, or `"<n> y"`.
 */
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

/**
 * Maps a `StockEntryType` value to its display label.
 *
 * @param type - The raw enum constant from the backend.
 * @returns A human-readable string, e.g. `"Material Receipt"`.
 */
function formatStockEntryType(
	type:
		| "MATERIAL_RECEIPT"
		| "MATERIAL_ISSUE"
		| "MATERIAL_TRANSFER"
		| "MATERIAL_TRANSFER_FOR_MANUFACTURE"
		| "MANUFACTURE"
		| "REPACK"
		| "SEND_TO_SUBCONTRACTOR",
): string {
	switch (type) {
		case "MATERIAL_RECEIPT":
			return "Material Receipt";
		case "MATERIAL_ISSUE":
			return "Material Issue";
		case "MATERIAL_TRANSFER":
			return "Material Transfer";
		case "MATERIAL_TRANSFER_FOR_MANUFACTURE":
			return "Material Transfer for Manufacture";
		case "MANUFACTURE":
			return "Manufacture";
		case "REPACK":
			return "Repack";
		case "SEND_TO_SUBCONTRACTOR":
			return "Send to Subcontractor";
	}
}

/**
 * Renders a coloured pill badge for a `StockEntryStatus` value.
 *
 * Pure display component — no side-effects or client-only APIs.
 */
function StatusBadge({
	status,
}: {
	status: "DRAFT" | "SUBMITTED" | "CANCELLED";
}) {
	const variants: Record<typeof status, string> = {
		DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
		SUBMITTED:
			"bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
		CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
	};

	const labels: Record<typeof status, string> = {
		DRAFT: "Draft",
		SUBMITTED: "Submitted",
		CANCELLED: "Cancelled",
	};

	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				variants[status],
			)}
		>
			{labels[status]}
		</span>
	);
}

/**
 * StockEntryListPage — paginated list of all stock entries.
 *
 * Fetches list data via tRPC and renders an `AdvancedDataTable` with inline
 * create, edit, and delete actions. Client component (uses hooks).
 */
export default function StockEntryListPage() {
	const utils = trpc.useUtils();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [entryToDelete, setEntryToDelete] = React.useState<string | null>(null);

	const {
		data: rawEntries = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listStockEntries.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	type StockEntryRow = Omit<
		(typeof rawEntries)[number],
		"postingDate" | "createdAt" | "updatedAt"
	> & {
		postingDate: Date;
		createdAt: Date;
		updatedAt: Date;
	};

	const entries = React.useMemo<StockEntryRow[]>(
		() =>
			rawEntries.map((entry) => ({
				...entry,
				postingDate: new Date(entry.postingDate),
				createdAt: new Date(entry.createdAt),
				updatedAt: new Date(entry.updatedAt),
			})),
		[rawEntries],
	);

	const deleteMutation = trpc.inventory.deleteStockEntry.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listStockEntries.cancel();
			const previous = utils.inventory.listStockEntries.getData();
			utils.inventory.listStockEntries.setData(undefined, (old) => {
				if (!old) return old;
				return old.filter((entry) => entry.id !== id);
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Stock entry deleted successfully");
			setIsDeleteDialogOpen(false);
			setEntryToDelete(null);
		},
		onError: (error, _vars, context) => {
			if (context?.previous) {
				utils.inventory.listStockEntries.setData(undefined, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listStockEntries.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (entryToDelete) {
			deleteMutation.mutate({ id: entryToDelete });
		}
	}, [deleteMutation, entryToDelete]);

	const columns = React.useMemo<ColumnDef<StockEntryRow>[]>(
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
						aria-label={`Select ${row.original.series}`}
					/>
				),
				size: 40,
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
			{
				accessorKey: "series",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Series" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/stock-transaction/stock-entry/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.series}
					</Link>
				),
				meta: {
					label: "Series",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "stockEntryType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Stock Entry Type" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatStockEntryType(row.original.stockEntryType)}
					</span>
				),
				meta: {
					label: "Stock Entry Type",
					variant: "multiSelect",
					options: [
						{ label: "Material Receipt", value: "MATERIAL_RECEIPT" },
						{ label: "Material Issue", value: "MATERIAL_ISSUE" },
						{ label: "Material Transfer", value: "MATERIAL_TRANSFER" },
						{
							label: "Material Transfer for Manufacture",
							value: "MATERIAL_TRANSFER_FOR_MANUFACTURE",
						},
						{ label: "Manufacture", value: "MANUFACTURE" },
						{ label: "Repack", value: "REPACK" },
						{
							label: "Send to Subcontractor",
							value: "SEND_TO_SUBCONTRACTOR",
						},
					],
					exportable: true,
				},
				enableColumnFilter: true,
				filterFn: (row, _id, value) => {
					return (value as string[]).includes(row.original.stockEntryType);
				},
			},
			{
				id: "status",
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => <StatusBadge status={row.original.status} />,
				meta: {
					label: "Status",
					variant: "multiSelect",
					options: [
						{ label: "Draft", value: "DRAFT" },
						{ label: "Submitted", value: "SUBMITTED" },
						{ label: "Cancelled", value: "CANCELLED" },
					],
					exportable: true,
				},
				enableColumnFilter: true,
				filterFn: (row, _id, value) => {
					return (value as string[]).includes(row.original.status);
				},
			},
			{
				accessorKey: "company",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.company}
					</span>
				),
				meta: {
					label: "Company",
					searchable: true,
					exportable: true,
				},
			},
			{
				id: "defaultSourceWarehouse",
				accessorKey: "defaultSourceWarehouse",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Source Warehouse" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.defaultSourceWarehouse ?? "-"}
					</span>
				),
				meta: {
					label: "Source Warehouse",
					searchable: true,
					exportable: true,
				},
			},
			{
				id: "defaultTargetWarehouse",
				accessorKey: "defaultTargetWarehouse",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Target Warehouse" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.defaultTargetWarehouse ?? "-"}
					</span>
				),
				meta: {
					label: "Target Warehouse",
					searchable: true,
					exportable: true,
				},
			},
			{
				id: "age",
				accessorFn: (row) => row.updatedAt,
				header: () => <span className="text-muted-foreground"></span>,
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{getRelativeAge(row.original.updatedAt)}
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
									href={`/inventory/stock-transaction/stock-entry/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Stock Entry
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setEntryToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
								className="text-destructive focus:text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Stock Entry
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
		],
		[],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<StockEntryRow>({
		data: entries,
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
					<h1 className="text-3xl font-bold tracking-tight">Stock Entries</h1>
					<p className="text-muted-foreground">
						Manage stock entries for receipts, issues, transfers, and
						manufacture
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
					title="Failed to load stock entries"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={entries}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={
						<Link
							href="/inventory/stock-transaction/stock-entry/form"
							className={cn(buttonVariants({ variant: "default", size: "sm" }))}
						>
							<Plus className="mr-2 h-4 w-4" />
							New Stock Entry
						</Link>
					}
					ariaLabel="Stock entries table"
				/>
			)}

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setEntryToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
