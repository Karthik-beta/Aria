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
import type { DeliveryNoteStatus } from "./delivery-note.utils";
import {
	DELIVERY_NOTE_STATUS_OPTIONS,
	formatDeliveryNoteStatus,
	formatRelativeAge,
	getDeliveryNoteStatusBadgeClass,
} from "./delivery-note.utils";

/**
 * Renders a coloured pill badge for a `DeliveryNoteStatus` value.
 *
 * Pure display component — no side-effects or client-only APIs.
 */
function StatusBadge({ status }: { status: DeliveryNoteStatus }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				getDeliveryNoteStatusBadgeClass(status),
			)}
		>
			{formatDeliveryNoteStatus(status)}
		</span>
	);
}

/**
 * DeliveryNoteListPage — paginated list of all delivery notes.
 *
 * Fetches list data via tRPC and renders an `AdvancedDataTable` with inline
 * create, edit, and delete actions. Client component (uses hooks).
 */
export default function DeliveryNoteListPage() {
	const utils = trpc.useUtils();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [noteToDelete, setNoteToDelete] = React.useState<string | null>(null);

	const {
		data: rawNotes = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listDeliveryNotes.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	type DeliveryNoteRow = Omit<
		(typeof rawNotes)[number],
		"postingDate" | "createdAt" | "updatedAt"
	> & {
		postingDate: Date;
		createdAt: Date;
		updatedAt: Date;
	};

	const notes = React.useMemo<DeliveryNoteRow[]>(
		() =>
			rawNotes.map((note) => ({
				...note,
				postingDate: new Date(note.postingDate),
				createdAt: new Date(note.createdAt),
				updatedAt: new Date(note.updatedAt),
			})),
		[rawNotes],
	);

	const deleteMutation = trpc.inventory.deleteDeliveryNote.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listDeliveryNotes.cancel();
			const previous = utils.inventory.listDeliveryNotes.getData();
			utils.inventory.listDeliveryNotes.setData(undefined, (old) => {
				if (!old) return old;
				return old.filter((note) => note.id !== id);
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Delivery note deleted successfully");
			setIsDeleteDialogOpen(false);
			setNoteToDelete(null);
		},
		onError: (error, _vars, context) => {
			if (context?.previous) {
				utils.inventory.listDeliveryNotes.setData(undefined, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listDeliveryNotes.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (noteToDelete) {
			deleteMutation.mutate({ id: noteToDelete });
		}
	}, [deleteMutation, noteToDelete]);

	const columns = React.useMemo<ColumnDef<DeliveryNoteRow>[]>(
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
						href={`/inventory/stock-transaction/delivery-note/form?id=${row.original.id}`}
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
				accessorKey: "customer",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Customer" />
				),
				cell: ({ row }) => (
					<span className="text-sm">{row.original.customer}</span>
				),
				meta: {
					label: "Customer",
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
					options: DELIVERY_NOTE_STATUS_OPTIONS,
					exportable: true,
				},
				enableColumnFilter: true,
				filterFn: (row, _id, value) => {
					return (value as string[]).includes(row.original.status);
				},
			},
			{
				accessorKey: "grandTotal",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Grand Total" />
				),
				cell: ({ row }) => (
					<span className="text-sm tabular-nums">
						{row.original.currency ?? ""}{" "}
						{(row.original.grandTotal ?? 0).toFixed(2)}
					</span>
				),
				meta: {
					label: "Grand Total",
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
				accessorKey: "postingDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Posting Date" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.postingDate.toLocaleDateString()}
					</span>
				),
				meta: {
					label: "Posting Date",
					variant: "date",
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
									href={`/inventory/stock-transaction/delivery-note/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Delivery Note
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setNoteToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
								className="text-destructive focus:text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Delivery Note
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

	const { table } = useAdvancedDataTable<DeliveryNoteRow>({
		data: notes,
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
					<h1 className="text-3xl font-bold tracking-tight">Delivery Notes</h1>
					<p className="text-muted-foreground">
						Manage delivery notes for outgoing shipments to customers
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
					title="Failed to load delivery notes"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={notes}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={
						<Link
							href="/inventory/stock-transaction/delivery-note/form"
							className={cn(buttonVariants({ variant: "default", size: "sm" }))}
						>
							<Plus className="mr-2 h-4 w-4" />
							New Delivery Note
						</Link>
					}
					ariaLabel="Delivery notes table"
				/>
			)}

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setNoteToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
