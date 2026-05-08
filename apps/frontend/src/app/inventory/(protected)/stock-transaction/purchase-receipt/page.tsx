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
import {
	computeReturnedPercentage,
	formatCurrency,
	formatPurchaseReceiptStatus,
	formatRelativeAge,
	getPurchaseReceiptStatusBadgeClass,
	PURCHASE_RECEIPT_STATUS_OPTIONS,
	type PurchaseReceiptStatus,
} from "./purchase-receipt.utils";

function StatusBadge({ status }: { status: PurchaseReceiptStatus }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				getPurchaseReceiptStatusBadgeClass(status),
			)}
		>
			{formatPurchaseReceiptStatus(status)}
		</span>
	);
}

export default function PurchaseReceiptListPage() {
	const utils = trpc.useUtils();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [receiptToDelete, setReceiptToDelete] = React.useState<string | null>(
		null,
	);
	const listQueryInput = React.useMemo(() => ({ take: 100 }), []);

	const {
		data: rawReceipts = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listPurchaseReceipts.useQuery(listQueryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	type PurchaseReceiptRow = Omit<
		(typeof rawReceipts)[number],
		"postingDate" | "vehicleDate" | "createdAt" | "updatedAt"
	> & {
		postingDate: Date;
		vehicleDate: Date | null;
		createdAt: Date;
		updatedAt: Date;
	};

	const receipts = React.useMemo<PurchaseReceiptRow[]>(
		() =>
			rawReceipts.map((receipt) => ({
				...receipt,
				postingDate: new Date(receipt.postingDate),
				vehicleDate: receipt.vehicleDate ? new Date(receipt.vehicleDate) : null,
				createdAt: new Date(receipt.createdAt),
				updatedAt: new Date(receipt.updatedAt),
			})),
		[rawReceipts],
	);

	const deleteMutation = trpc.inventory.deletePurchaseReceipt.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listPurchaseReceipts.cancel(listQueryInput);
			const previous =
				utils.inventory.listPurchaseReceipts.getData(listQueryInput);
			utils.inventory.listPurchaseReceipts.setData(listQueryInput, (old) => {
				if (!old) return old;
				return old.filter((receipt) => receipt.id !== id);
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Purchase receipt deleted successfully");
			setIsDeleteDialogOpen(false);
			setReceiptToDelete(null);
		},
		onError: (error, _vars, context) => {
			if (context?.previous) {
				utils.inventory.listPurchaseReceipts.setData(
					listQueryInput,
					context.previous,
				);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listPurchaseReceipts.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (receiptToDelete) {
			deleteMutation.mutate({ id: receiptToDelete });
		}
	}, [deleteMutation, receiptToDelete]);

	const columns = React.useMemo<ColumnDef<PurchaseReceiptRow>[]>(
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
				accessorKey: "supplier",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Supplier" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/stock-transaction/purchase-receipt/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.supplier}
					</Link>
				),
				meta: {
					label: "Supplier",
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
					options: PURCHASE_RECEIPT_STATUS_OPTIONS,
					exportable: true,
				},
				enableColumnFilter: true,
				filterFn: (row, _id, value) => {
					return (value as string[]).includes(row.original.status);
				},
			},
			{
				accessorKey: "postingDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Date" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.postingDate.toLocaleDateString()}
					</span>
				),
				meta: {
					label: "Date",
					variant: "date",
					exportable: true,
				},
			},
			{
				id: "grandTotal",
				accessorKey: "grandTotal",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Grand Total" />
				),
				cell: ({ row }) => (
					<span className="text-sm tabular-nums">
						{formatCurrency(row.original.grandTotal, row.original.currency)}
					</span>
				),
				meta: {
					label: "Grand Total",
					exportable: true,
				},
			},
			{
				id: "percentReturned",
				accessorFn: (row) =>
					computeReturnedPercentage(
						row.totalAcceptedQuantity,
						row.totalRejectedQuantity,
					),
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="% Returned" />
				),
				cell: ({ row }) => {
					const percentReturned = computeReturnedPercentage(
						row.original.totalAcceptedQuantity,
						row.original.totalRejectedQuantity,
					);
					return (
						<div className="flex min-w-24 items-center gap-2">
							<div className="h-2 w-16 rounded-full bg-muted">
								<div
									className="h-2 rounded-full bg-primary"
									style={{ width: `${percentReturned}%` }}
								/>
							</div>
							<span className="text-xs text-muted-foreground">
								{percentReturned}%
							</span>
						</div>
					);
				},
				meta: {
					label: "% Returned",
					exportable: true,
				},
			},
			{
				accessorKey: "series",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="ID" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.series}
					</span>
				),
				meta: {
					label: "ID",
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
									href={`/inventory/stock-transaction/purchase-receipt/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Purchase Receipt
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setReceiptToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
								className="text-destructive focus:text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Purchase Receipt
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

	const { table } = useAdvancedDataTable<PurchaseReceiptRow>({
		data: receipts,
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
					<h1 className="text-3xl font-bold tracking-tight">
						Purchase Receipts
					</h1>
					<p className="text-muted-foreground">
						Manage supplier purchase receipts, accepted/rejected quantities, and
						tax calculations
					</p>
				</div>
			</div>

			{isLoading && <DataTableSkeleton columnCount={9} rowCount={8} />}

			{queryError && !isLoading && (
				<ErrorState
					error={queryError}
					operation="load"
					title="Failed to load purchase receipts"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={receipts}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={
						<Link
							href="/inventory/stock-transaction/purchase-receipt/form"
							className={cn(buttonVariants({ variant: "default", size: "sm" }))}
						>
							<Plus className="mr-2 h-4 w-4" />
							New Purchase Receipt
						</Link>
					}
					ariaLabel="Purchase receipts table"
				/>
			)}

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setReceiptToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
