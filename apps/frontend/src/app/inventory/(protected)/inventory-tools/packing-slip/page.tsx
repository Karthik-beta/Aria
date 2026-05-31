"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
	CheckCircle2,
	Edit,
	MoreHorizontal,
	Plus,
	Trash,
	XCircle,
} from "lucide-react";
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

type PackingSlipStatus = "DRAFT" | "SUBMITTED" | "CANCELLED";

const STATUS_BADGE_CLASS: Record<PackingSlipStatus, string> = {
	DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
	SUBMITTED:
		"bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const STATUS_LABEL: Record<PackingSlipStatus, string> = {
	DRAFT: "Draft",
	SUBMITTED: "Submitted",
	CANCELLED: "Cancelled",
};

const PACKING_SLIP_STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(
	([value, label]) => ({ value, label }),
);

function formatRelativeAge(date: Date): string {
	const diffMs = Date.now() - date.getTime();
	const diffDays = Math.floor(diffMs / 86_400_000);
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);
	if (diffYears >= 1) return `${diffYears} y`;
	if (diffMonths >= 1) return `${diffMonths} m`;
	if (diffDays >= 1) return `${diffDays} d`;
	return "Today";
}

/**
 * StatusBadge — coloured pill for a `PackingSlipStatus` value.
 *
 * Pure display component; no side-effects.
 */
function StatusBadge({ status }: { status: PackingSlipStatus }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				STATUS_BADGE_CLASS[status],
			)}
		>
			{STATUS_LABEL[status]}
		</span>
	);
}

/**
 * PackingSlipPage — paginated list of all packing slips.
 *
 * Fetches data via tRPC and renders an `AdvancedDataTable` with inline
 * create, edit, submit, cancel, and delete actions. Client component (uses hooks).
 */
export default function PackingSlipPage() {
	const utils = trpc.useUtils();
	const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
	const [slipToDelete, setSlipToDelete] = React.useState<string | null>(null);
	const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
	const [submitDialogOpen, setSubmitDialogOpen] = React.useState(false);
	const [slipToSubmit, setSlipToSubmit] = React.useState<string | null>(null);
	const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
	const [slipToCancel, setSlipToCancel] = React.useState<string | null>(null);

	const {
		data: rawSlips = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listPackingSlips.useQuery(
		{},
		{ refetchOnWindowFocus: false, retry: 2, staleTime: 30_000 },
	);

	type PackingSlipRow = Omit<
		(typeof rawSlips)[number],
		"createdAt" | "updatedAt"
	> & { createdAt: Date; updatedAt: Date };

	const slips = React.useMemo<PackingSlipRow[]>(
		() =>
			rawSlips.map((s) => ({
				...s,
				createdAt: new Date(s.createdAt),
				updatedAt: new Date(s.updatedAt),
			})),
		[rawSlips],
	);

	const deleteMutation = trpc.inventory.deletePackingSlip.useMutation({
		onSuccess: () => {
			toast.success("Packing slip deleted");
			setDeleteDialogOpen(false);
			setSlipToDelete(null);
			void utils.inventory.listPackingSlips.invalidate();
		},
		onError: (err) => toast.error(getToastMessage(err, "delete")),
	});

	const submitMutation = trpc.inventory.submitPackingSlip.useMutation({
		onSuccess: () => {
			toast.success("Packing slip submitted");
			setSubmitDialogOpen(false);
			setSlipToSubmit(null);
			void utils.inventory.listPackingSlips.invalidate();
		},
		onError: (err) => toast.error(getToastMessage(err, "submit")),
	});

	const cancelMutation = trpc.inventory.cancelPackingSlip.useMutation({
		onSuccess: () => {
			toast.success("Packing slip cancelled");
			setCancelDialogOpen(false);
			setSlipToCancel(null);
			void utils.inventory.listPackingSlips.invalidate();
		},
		onError: (err) => toast.error(getToastMessage(err, "cancel")),
	});

	const bulkDeleteMutation = trpc.inventory.deleteManyPackingSlips.useMutation({
		onSuccess: ({ count }) => {
			toast.success(`${count} packing slip${count === 1 ? "" : "s"} deleted`);
			setBulkDeleteDialogOpen(false);
			table.resetRowSelection();
			void utils.inventory.listPackingSlips.invalidate();
		},
		onError: (err) => toast.error(getToastMessage(err, "delete")),
	});

	const confirmDelete = React.useCallback(() => {
		if (slipToDelete) deleteMutation.mutate({ id: slipToDelete });
	}, [deleteMutation, slipToDelete]);

	const confirmSubmit = React.useCallback(() => {
		if (slipToSubmit) submitMutation.mutate({ id: slipToSubmit });
	}, [submitMutation, slipToSubmit]);

	const confirmCancel = React.useCallback(() => {
		if (slipToCancel) cancelMutation.mutate({ id: slipToCancel });
	}, [cancelMutation, slipToCancel]);

	const columns = React.useMemo<ColumnDef<PackingSlipRow>[]>(
		() => [
			{
				id: "select",
				header: ({ table }) => (
					<Checkbox
						checked={
							table.getIsAllPageRowsSelected() ||
							(table.getIsSomePageRowsSelected() ? "indeterminate" : false)
						}
						onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
						aria-label="Select all"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(v) => row.toggleSelected(!!v)}
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
						href={`/inventory/inventory-tools/packing-slip/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.series}
					</Link>
				),
				meta: { label: "Series", searchable: true, exportable: true },
			},
			{
				id: "status",
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => (
					<StatusBadge status={row.original.status as PackingSlipStatus} />
				),
				meta: {
					label: "Status",
					variant: "multiSelect",
					options: PACKING_SLIP_STATUS_OPTIONS,
					exportable: true,
				},
				enableColumnFilter: true,
				filterFn: (row, _id, value) =>
					(value as string[]).includes(row.original.status),
			},
			{
				id: "deliveryNote",
				accessorKey: "deliveryNoteId",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Delivery Note" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.deliveryNoteId}
					</span>
				),
				meta: { label: "Delivery Note", exportable: true },
			},
			{
				id: "packageNos",
				accessorFn: (row) => `${row.fromCaseNo}–${row.toCaseNo}`,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Package No." />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.fromCaseNo === row.original.toCaseNo
							? `#${row.original.fromCaseNo}`
							: `#${row.original.fromCaseNo}–${row.original.toCaseNo}`}
					</span>
				),
				meta: { label: "Package No.", exportable: true },
			},
			{
				id: "netWeight",
				accessorKey: "netWeightPkg",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Net Weight" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.netWeightPkg > 0
							? `${row.original.netWeightPkg} ${row.original.netWeightUom ?? ""}`.trim()
							: "—"}
					</span>
				),
				meta: { label: "Net Weight", exportable: true },
			},
			{
				id: "items",
				accessorFn: (row) => row.items.length,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Items" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.items.length}
					</span>
				),
				meta: { label: "Items", exportable: true },
				size: 60,
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
				meta: { label: "Age", variant: "date", exportable: true },
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
									href={`/inventory/inventory-tools/packing-slip/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									View / Edit
								</Link>
							</DropdownMenuItem>
							{row.original.status === "DRAFT" && (
								<DropdownMenuItem
									onClick={() => {
										setSlipToSubmit(row.original.id);
										setSubmitDialogOpen(true);
									}}
								>
									<CheckCircle2 className="mr-2 h-4 w-4" />
									Submit
								</DropdownMenuItem>
							)}
							{row.original.status === "SUBMITTED" && (
								<DropdownMenuItem
									onClick={() => {
										setSlipToCancel(row.original.id);
										setCancelDialogOpen(true);
									}}
								>
									<XCircle className="mr-2 h-4 w-4" />
									Cancel
								</DropdownMenuItem>
							)}
							{row.original.status !== "SUBMITTED" && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() => {
											setSlipToDelete(row.original.id);
											setDeleteDialogOpen(true);
										}}
										className="text-destructive focus:text-destructive"
									>
										<Trash className="mr-2 h-4 w-4" />
										Delete
									</DropdownMenuItem>
								</>
							)}
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

	const { table } = useAdvancedDataTable<PackingSlipRow>({
		data: slips,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "age", desc: true }],
		enableRowSelection: true,
		enableMultiRowSelection: true,
		enableGlobalFilter: true,
		onReload: handleReload,
	});

	const selectedIds = table
		.getSelectedRowModel()
		.rows.map((r) => r.original.id);

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Packing Slips</h1>
					<p className="text-muted-foreground">
						Generate packing slips for packages to be delivered
					</p>
				</div>
				{selectedIds.length > 0 && (
					<Button
						variant="destructive"
						size="sm"
						onClick={() => setBulkDeleteDialogOpen(true)}
					>
						<Trash className="mr-2 h-4 w-4" />
						Delete ({selectedIds.length})
					</Button>
				)}
			</div>

			{isLoading && (
				<DataTableSkeleton
					columnCount={9}
					rowCount={10}
					filterCount={0}
					withViewOptions={false}
				/>
			)}

			{queryError && !isLoading && (
				<ErrorState
					error={queryError}
					operation="load"
					title="Failed to load packing slips"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={slips}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={
						<Link
							href="/inventory/inventory-tools/packing-slip/form"
							className={cn(buttonVariants({ variant: "default", size: "sm" }))}
						>
							<Plus className="mr-2 h-4 w-4" />
							New Packing Slip
						</Link>
					}
					ariaLabel="Packing slips table"
				/>
			)}

			<AlertModal
				isOpen={deleteDialogOpen}
				onClose={() => {
					setDeleteDialogOpen(false);
					setSlipToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>

			<AlertModal
				isOpen={submitDialogOpen}
				onClose={() => {
					setSubmitDialogOpen(false);
					setSlipToSubmit(null);
				}}
				onConfirm={confirmSubmit}
				loading={submitMutation.isPending}
			/>

			<AlertModal
				isOpen={cancelDialogOpen}
				onClose={() => {
					setCancelDialogOpen(false);
					setSlipToCancel(null);
				}}
				onConfirm={confirmCancel}
				loading={cancelMutation.isPending}
			/>

			<AlertModal
				isOpen={bulkDeleteDialogOpen}
				onClose={() => setBulkDeleteDialogOpen(false)}
				onConfirm={() => bulkDeleteMutation.mutate({ ids: selectedIds })}
				loading={bulkDeleteMutation.isPending}
			/>
		</div>
	);
}
