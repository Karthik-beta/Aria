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
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { PickListStatus } from "./pick-list.utils";
import {
	formatPickListPurpose,
	formatPickListStatus,
	formatRelativeAge,
	getPickListStatusBadgeClass,
	PICK_LIST_STATUS_OPTIONS,
} from "./pick-list.utils";

/**
 * StatusBadge — coloured pill for a `PickListStatus` value.
 *
 * Pure display component; no side-effects.
 */
function StatusBadge({ status }: { status: PickListStatus }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				getPickListStatusBadgeClass(status),
			)}
		>
			{formatPickListStatus(status)}
		</span>
	);
}

/**
 * PickListPage — paginated list of all pick lists.
 *
 * Fetches data via tRPC and renders an `AdvancedDataTable` with inline
 * create, edit, and delete actions. Client component (uses hooks).
 */
export default function PickListPage() {
	const utils = trpc.useUtils();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [pickListToDelete, setPickListToDelete] = React.useState<string | null>(
		null,
	);

	const {
		data: rawPickLists = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listPickLists.useQuery(
		{},
		{
			refetchOnWindowFocus: false,
			retry: 2,
			staleTime: 30_000,
		},
	);

	type PickListRow = Omit<
		(typeof rawPickLists)[number],
		"createdAt" | "updatedAt"
	> & {
		createdAt: Date;
		updatedAt: Date;
	};

	const pickLists = React.useMemo<PickListRow[]>(
		() =>
			rawPickLists.map((pl) => ({
				...pl,
				createdAt: new Date(pl.createdAt),
				updatedAt: new Date(pl.updatedAt),
			})),
		[rawPickLists],
	);

	const deleteMutation = trpc.inventory.deletePickList.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listPickLists.cancel();
			const previous = utils.inventory.listPickLists.getData({});
			utils.inventory.listPickLists.setData({}, (old) => {
				if (!old) return old;
				return old.filter((pl) => pl.id !== id);
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Pick list deleted successfully");
			setIsDeleteDialogOpen(false);
			setPickListToDelete(null);
		},
		onError: (error, _vars, context) => {
			if (context?.previous) {
				utils.inventory.listPickLists.setData({}, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listPickLists.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (pickListToDelete) {
			deleteMutation.mutate({ id: pickListToDelete });
		}
	}, [deleteMutation, pickListToDelete]);

	const columns = React.useMemo<ColumnDef<PickListRow>[]>(
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
						href={`/inventory/stock-transaction/pick-list/form?id=${row.original.id}`}
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
				id: "status",
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => <StatusBadge status={row.original.status} />,
				meta: {
					label: "Status",
					variant: "multiSelect",
					options: PICK_LIST_STATUS_OPTIONS,
					exportable: true,
				},
				enableColumnFilter: true,
				filterFn: (row, _id, value) => {
					return (value as string[]).includes(row.original.status);
				},
			},
			{
				accessorKey: "purpose",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Purpose" />
				),
				cell: ({ row }) => (
					<span className="text-sm">
						{formatPickListPurpose(row.original.purpose)}
					</span>
				),
				meta: {
					label: "Purpose",
					exportable: true,
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
				accessorKey: "customer",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Customer" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.customer ?? "—"}
					</span>
				),
				meta: {
					label: "Customer",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "warehouse",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Warehouse" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.warehouse ?? "—"}
					</span>
				),
				meta: {
					label: "Warehouse",
					exportable: true,
				},
			},
			{
				id: "age",
				accessorFn: (row) => row.updatedAt,
				header: () => <span className="text-muted-foreground"></span>,
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatRelativeAge(row.original.updatedAt)}
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
									href={`/inventory/stock-transaction/pick-list/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Pick List
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setPickListToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
								className="text-destructive focus:text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Pick List
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

	const { table } = useAdvancedDataTable<PickListRow>({
		data: pickLists,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "age", desc: true }],
		enableRowSelection: true,
		enableMultiRowSelection: true,
		enableGlobalFilter: true,
		onReload: handleReload,
	});

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Pick Lists</h1>
					<p className="text-muted-foreground">
						Manage pick lists for stock picking and fulfilment
					</p>
				</div>
			</div>

			{isLoading && <DataTableSkeleton columnCount={9} rowCount={8} />}

			{queryError && !isLoading && (
				<ErrorState
					error={queryError}
					operation="load"
					title="Failed to load pick lists"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={pickLists}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={
						<Link
							href="/inventory/stock-transaction/pick-list/form"
							className={cn(buttonVariants({ variant: "default", size: "sm" }))}
						>
							<Plus className="mr-2 h-4 w-4" />
							New Pick List
						</Link>
					}
					ariaLabel="Pick lists table"
				/>
			)}

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setPickListToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
