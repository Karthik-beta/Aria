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
 * Maps a `MaterialRequestPurpose` value to its display label.
 *
 * @param purpose - The raw enum constant from the backend.
 * @returns A human-readable string, e.g. `"Material Transfer"`.
 */ function formatPurpose(
	purpose:
		| "PURCHASE"
		| "MANUFACTURE"
		| "MATERIAL_TRANSFER"
		| "MATERIAL_ISSUE"
		| "CUSTOMER_PROVIDED",
): string {
	switch (purpose) {
		case "PURCHASE":
			return "Purchase";
		case "MANUFACTURE":
			return "Manufacture";
		case "MATERIAL_TRANSFER":
			return "Material Transfer";
		case "MATERIAL_ISSUE":
			return "Material Issue";
		case "CUSTOMER_PROVIDED":
			return "Customer Provided";
	}
}

/**
 * Renders a coloured pill badge for a `MaterialRequestStatus` value.
 *
 * Pure display component — no side-effects or client-only APIs.
 */
function StatusBadge({
	status,
}: {
	status:
		| "DRAFT"
		| "PENDING"
		| "APPROVED"
		| "ORDERED"
		| "PARTIALLY_ORDERED"
		| "PARTIALLY_RECEIVED"
		| "RECEIVED"
		| "CANCELLED";
}) {
	const variants: Record<typeof status, string> = {
		DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
		PENDING:
			"bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
		APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
		ORDERED: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
		PARTIALLY_ORDERED:
			"bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
		PARTIALLY_RECEIVED:
			"bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
		RECEIVED:
			"bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
		CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
	};

	const labels: Record<typeof status, string> = {
		DRAFT: "Draft",
		PENDING: "Pending",
		APPROVED: "Approved",
		ORDERED: "Ordered",
		PARTIALLY_ORDERED: "Partially Ordered",
		PARTIALLY_RECEIVED: "Partially Received",
		RECEIVED: "Received",
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
 * MaterialRequestListPage — paginated list of all material requests.
 *
 * Fetches list data via tRPC and renders an `AdvancedDataTable` with inline
 * create, edit, and bulk-delete actions. Client component (uses hooks).
 */
export default function MaterialRequestListPage() {
	const utils = trpc.useUtils();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [requestToDelete, setRequestToDelete] = React.useState<string | null>(
		null,
	);

	const {
		data: rawRequests = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listMaterialRequests.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	type MaterialRequestRow = Omit<
		(typeof rawRequests)[number],
		"transactionDate" | "requiredBy" | "createdAt" | "updatedAt"
	> & {
		transactionDate: Date;
		requiredBy: Date | null;
		createdAt: Date;
		updatedAt: Date;
	};

	const requests = React.useMemo<MaterialRequestRow[]>(
		() =>
			rawRequests.map((req) => ({
				...req,
				transactionDate: new Date(req.transactionDate),
				requiredBy: req.requiredBy ? new Date(req.requiredBy) : null,
				createdAt: new Date(req.createdAt),
				updatedAt: new Date(req.updatedAt),
			})),
		[rawRequests],
	);

	const deleteMutation = trpc.inventory.deleteMaterialRequest.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listMaterialRequests.cancel();
			const previous = utils.inventory.listMaterialRequests.getData();
			utils.inventory.listMaterialRequests.setData(undefined, (old) => {
				if (!old) return old;
				return old.filter((req) => req.id !== id);
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Material request deleted successfully");
			setIsDeleteDialogOpen(false);
			setRequestToDelete(null);
		},
		onError: (error, _vars, context) => {
			if (context?.previous) {
				utils.inventory.listMaterialRequests.setData(
					undefined,
					context.previous,
				);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listMaterialRequests.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (requestToDelete) {
			deleteMutation.mutate({ id: requestToDelete });
		}
	}, [deleteMutation, requestToDelete]);

	const columns = React.useMemo<ColumnDef<MaterialRequestRow>[]>(
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
						href={`/inventory/stock-transaction/material-request/form?id=${row.original.id}`}
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
				accessorKey: "purpose",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Purpose" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatPurpose(row.original.purpose)}
					</span>
				),
				meta: {
					label: "Purpose",
					variant: "multiSelect",
					options: [
						{ label: "Purchase", value: "PURCHASE" },
						{ label: "Manufacture", value: "MANUFACTURE" },
						{ label: "Material Transfer", value: "MATERIAL_TRANSFER" },
						{ label: "Material Issue", value: "MATERIAL_ISSUE" },
						{ label: "Customer Provided", value: "CUSTOMER_PROVIDED" },
					],
					exportable: true,
				},
				enableColumnFilter: true,
				filterFn: (row, _id, value) => {
					return (value as string[]).includes(row.original.purpose);
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
						{ label: "Pending", value: "PENDING" },
						{ label: "Approved", value: "APPROVED" },
						{ label: "Ordered", value: "ORDERED" },
						{ label: "Partially Ordered", value: "PARTIALLY_ORDERED" },
						{ label: "Partially Received", value: "PARTIALLY_RECEIVED" },
						{ label: "Received", value: "RECEIVED" },
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
				id: "requiredBy",
				accessorFn: (row) => row.requiredBy,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Required By" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.requiredBy
							? row.original.requiredBy.toLocaleDateString()
							: "-"}
					</span>
				),
				meta: {
					label: "Required By",
					variant: "date",
					exportable: true,
				},
			},
			{
				id: "targetWarehouse",
				accessorKey: "targetWarehouse",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Target Warehouse" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.targetWarehouse ?? "-"}
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
									href={`/inventory/stock-transaction/material-request/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Material Request
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setRequestToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
								className="text-destructive focus:text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Material Request
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

	const { table } = useAdvancedDataTable<MaterialRequestRow>({
		data: requests,
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
					<h1 className="text-3xl font-bold tracking-tight">
						Material Requests
					</h1>
					<p className="text-muted-foreground">
						Manage material requests for purchase, manufacture, and transfers
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
					title="Failed to load material requests"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={requests}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={
						<Link
							href="/inventory/stock-transaction/material-request/form"
							className={cn(buttonVariants({ variant: "default", size: "sm" }))}
						>
							<Plus className="mr-2 h-4 w-4" />
							New Material Request
						</Link>
					}
					ariaLabel="Material requests table"
				/>
			)}

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setRequestToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
