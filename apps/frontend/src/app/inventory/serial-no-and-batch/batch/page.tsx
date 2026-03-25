"use client";

import { Inventory } from "@aria/types";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Edit, MoreHorizontal, Plus, RefreshCw, Trash } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDeferredValue } from "react";
import { toast } from "sonner";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { AlertModal } from "@/components/modal/alert-modal";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	BATCH_PAGE_SIZE,
	buildBatchListInput,
	formatBatchDate,
	formatBatchStatus,
	formatRelativeAge,
	getBatchStatusBadgeClass,
} from "./batch.utils";

type BatchRow = Omit<Inventory.Batch, "createdAt" | "updatedAt"> & {
	createdAt: Date;
	updatedAt: Date;
};

type StatusFilter = "all" | Inventory.BatchStatus;

function StatusBadge({ status }: { status: Inventory.BatchStatus }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				getBatchStatusBadgeClass(status),
			)}
		>
			{formatBatchStatus(status)}
		</span>
	);
}

function BatchRealtimeSubscription({
	onData,
}: {
	onData: (event: { type: "created" | "updated" | "deleted" }) => void;
}) {
	trpc.inventory.onBatchesChanged.useSubscription(undefined, {
		onData,
	});

	return null;
}

export default function BatchPage() {
	const utils = trpc.useUtils();
	const [search, setSearch] = React.useState("");
	const [itemId, setItemId] = React.useState("");
	const [warehouseId, setWarehouseId] = React.useState("");
	const [company, setCompany] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
	const [includeDisabled, setIncludeDisabled] = React.useState(false);
	const [sortBy, setSortBy] =
		React.useState<Inventory.BatchSortBy>("updatedAt");
	const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
		"desc",
	);
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: BATCH_PAGE_SIZE,
	});
	const [batchToDelete, setBatchToDelete] = React.useState<string | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	const deferredSearch = useDeferredValue(search);
	const deferredCompany = useDeferredValue(company);

	const resetToFirstPage = React.useCallback(() => {
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	const queryInput = React.useMemo(
		() =>
			buildBatchListInput({
				search: deferredSearch,
				itemId,
				warehouseId,
				company: deferredCompany,
				status: statusFilter,
				includeDisabled,
				pageIndex: pagination.pageIndex,
				pageSize: pagination.pageSize,
				sortBy,
				sortDirection,
			}),
		[
			deferredCompany,
			deferredSearch,
			includeDisabled,
			itemId,
			pagination.pageIndex,
			pagination.pageSize,
			sortBy,
			sortDirection,
			statusFilter,
			warehouseId,
		],
	);

	const {
		data,
		error: queryError,
		refetch,
	} = trpc.inventory.listBatches.useQuery(queryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		placeholderData: (previous) => previous,
	});

	const { data: rawItems = [] } = trpc.inventory.listItems.useQuery(undefined, {
		staleTime: 30_000,
	});
	const { data: warehouseOptions } = trpc.inventory.listWarehouses.useQuery(
		{ take: 250 },
		{ staleTime: 30_000 },
	);

	const batches = React.useMemo<BatchRow[]>(
		() =>
			(data?.items ?? []).map((entry) => ({
				...entry,
				createdAt: new Date(entry.createdAt),
				updatedAt: new Date(entry.updatedAt),
				manufacturingDate: entry.manufacturingDate
					? new Date(entry.manufacturingDate)
					: null,
				expiryDate: entry.expiryDate ? new Date(entry.expiryDate) : null,
			})),
		[data?.items],
	);

	const itemOptions = React.useMemo(
		() => rawItems.filter((item) => item.hasBatchNo),
		[rawItems],
	);

	const totalCount = data?.totalCount ?? 0;
	const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

	const deleteMutation = trpc.inventory.deleteBatch.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listBatches.cancel(queryInput);
			const previous = utils.inventory.listBatches.getData(queryInput);
			utils.inventory.listBatches.setData(queryInput, (current) => {
				if (!current) return current;
				return {
					...current,
					items: current.items.filter((entry) => entry.id !== id),
					totalCount: Math.max(0, current.totalCount - 1),
				};
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Batch deleted successfully");
			setBatchToDelete(null);
			setIsDeleteDialogOpen(false);
		},
		onError: (error, _variables, context) => {
			if (context?.previous) {
				utils.inventory.listBatches.setData(queryInput, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listBatches.invalidate();
		},
	});

	const columns = React.useMemo<ColumnDef<BatchRow>[]>(
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
							table.toggleAllPageRowsSelected(Boolean(value))
						}
						aria-label="Select all batches"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
						aria-label={`Select ${row.original.batchId}`}
					/>
				),
				size: 40,
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
			{
				accessorKey: "batchId",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Batch ID" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/serial-no-and-batch/batch/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.batchId}
					</Link>
				),
				meta: { label: "Batch ID", exportable: true },
			},
			{
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => <StatusBadge status={row.original.status} />,
				meta: { label: "Status", exportable: true },
			},
			{
				accessorKey: "itemCode",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item" />
				),
				cell: ({ row }) => (
					<div className="space-y-1">
						<div className="font-medium">{row.original.itemCode}</div>
						<div className="text-xs text-muted-foreground">
							{row.original.itemName}
						</div>
					</div>
				),
				meta: { label: "Item", exportable: true },
			},
			{
				id: "warehouse",
				accessorFn: (row) => row.currentWarehouseName ?? "",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Warehouse" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.currentWarehouseName ?? "Unassigned"}
					</span>
				),
				meta: { label: "Warehouse", exportable: true },
			},
			{
				id: "expiryDate",
				accessorKey: "expiryDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Expiry" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatBatchDate(row.original.expiryDate)}
					</span>
				),
				meta: { label: "Expiry", exportable: true },
			},
			{
				accessorKey: "quantity",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Quantity" />
				),
				cell: ({ row }) => row.original.quantity.toLocaleString(),
				meta: { label: "Quantity", exportable: true },
			},
			{
				accessorKey: "company",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company" />
				),
				meta: { label: "Company", exportable: true },
			},
			{
				id: "updatedAt",
				accessorKey: "updatedAt",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Last Updated" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatRelativeAge(row.original.updatedAt)}
					</span>
				),
				meta: { label: "Last Updated", exportable: true },
			},
			{
				id: "actions",
				cell: ({ row }) => (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="h-8 w-8 p-0"
								aria-label={`Open actions for ${row.original.batchId}`}
							>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuItem asChild>
								<Link
									href={`/inventory/serial-no-and-batch/batch/form?id=${row.original.id}`}
									className="flex items-center gap-2"
								>
									<Edit className="h-4 w-4" />
									Edit Batch
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => {
									setBatchToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Batch
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				size: 60,
			},
		],
		[],
	);

	const { table } = useAdvancedDataTable<BatchRow>({
		data: batches,
		columns,
		pageCount,
		onPaginationChange: setPagination,
		getRowId: (row) => row.id,
		enableGlobalFilter: false,
	});

	const handleRealtimeData = React.useCallback(
		(_event: { type: "created" | "updated" | "deleted" }) => {
			void utils.inventory.listBatches.invalidate();
		},
		[utils],
	);

	const confirmDelete = React.useCallback(() => {
		if (!batchToDelete) return;
		deleteMutation.mutate({ id: batchToDelete });
	}, [batchToDelete, deleteMutation]);

	if (queryError) {
		return (
			<ErrorState
				error={queryError}
				title="Unable to load batches"
				onRetry={() => void refetch()}
			/>
		);
	}

	return (
		<div className="space-y-4">
			<BatchRealtimeSubscription onData={handleRealtimeData} />

			<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Batch</h1>
					<p className="text-sm text-muted-foreground">
						Track batch-controlled inventory by item, warehouse, quantity, and
						expiry.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => void refetch()}>
						<RefreshCw className="mr-2 h-4 w-4" />
						Refresh
					</Button>
					<Button asChild>
						<Link href="/inventory/serial-no-and-batch/batch/form">
							<Plus className="mr-2 h-4 w-4" />
							Add Batch
						</Link>
					</Button>
				</div>
			</div>

			<div className="rounded-xl border bg-background p-4">
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
					<div className="space-y-2 xl:col-span-2">
						<Label htmlFor="batch-search">Search</Label>
						<Input
							id="batch-search"
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								resetToFirstPage();
							}}
							placeholder="Batch, item, warehouse, company..."
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="batch-item-filter">Item</Label>
						<Select
							value={itemId || "__all"}
							onValueChange={(value) => {
								setItemId(value === "__all" ? "" : value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="batch-item-filter">
								<SelectValue placeholder="All items" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__all">All items</SelectItem>
								{itemOptions.map((item) => (
									<SelectItem key={item.id} value={item.id}>
										{item.code}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="batch-warehouse-filter">Warehouse</Label>
						<Select
							value={warehouseId || "__all"}
							onValueChange={(value) => {
								setWarehouseId(value === "__all" ? "" : value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="batch-warehouse-filter">
								<SelectValue placeholder="All warehouses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__all">All warehouses</SelectItem>
								{(warehouseOptions?.items ?? []).map((warehouse) => (
									<SelectItem key={warehouse.id} value={warehouse.id}>
										{warehouse.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="batch-status-filter">Status</Label>
						<Select
							value={statusFilter}
							onValueChange={(value: StatusFilter) => {
								setStatusFilter(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="batch-status-filter">
								<SelectValue placeholder="All statuses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								{Inventory.batchStatusSchema.options.map((status) => (
									<SelectItem key={status} value={status}>
										{formatBatchStatus(status)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="batch-company-filter">Company</Label>
						<Input
							id="batch-company-filter"
							value={company}
							onChange={(event) => {
								setCompany(event.target.value);
								resetToFirstPage();
							}}
							placeholder="Filter by company"
						/>
					</div>
				</div>

				<div className="mt-4 grid gap-4 md:grid-cols-3">
					<div className="space-y-2">
						<Label htmlFor="batch-sort-by">Sort By</Label>
						<Select
							value={sortBy}
							onValueChange={(value: Inventory.BatchSortBy) => {
								setSortBy(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="batch-sort-by">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="updatedAt">Last Updated</SelectItem>
								<SelectItem value="createdAt">Created On</SelectItem>
								<SelectItem value="batchId">Batch ID</SelectItem>
								<SelectItem value="itemCode">Item</SelectItem>
								<SelectItem value="warehouse">Warehouse</SelectItem>
								<SelectItem value="expiryDate">Expiry Date</SelectItem>
								<SelectItem value="quantity">Quantity</SelectItem>
								<SelectItem value="company">Company</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="batch-sort-direction">Direction</Label>
						<Select
							value={sortDirection}
							onValueChange={(value: "asc" | "desc") => {
								setSortDirection(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="batch-sort-direction">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="desc">Descending</SelectItem>
								<SelectItem value="asc">Ascending</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex items-end">
						<label
							htmlFor="include-disabled-batches"
							className="flex items-center gap-2 text-sm text-muted-foreground"
						>
							<Checkbox
								id="include-disabled-batches"
								checked={includeDisabled}
								onCheckedChange={(value) => {
									setIncludeDisabled(Boolean(value));
									resetToFirstPage();
								}}
							/>
							Include disabled batches
						</label>
					</div>
				</div>
			</div>

			<AdvancedDataTable
				table={table}
				data={batches}
				enableGlobalSearch={false}
				enableBulkActions={false}
				enableExport={false}
				enableImport={false}
			/>

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setBatchToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
