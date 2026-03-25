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
	buildSerialNoListInput,
	formatRelativeAge,
	formatSerialNoStatus,
	getSerialNoStatusBadgeClass,
	SERIAL_NO_PAGE_SIZE,
} from "./serial-no.utils";

type SerialNoRow = Omit<Inventory.SerialNo, "createdAt" | "updatedAt"> & {
	createdAt: Date;
	updatedAt: Date;
};

type StatusFilter = "all" | Inventory.SerialNoStatus;

function StatusBadge({ status }: { status: Inventory.SerialNoStatus }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				getSerialNoStatusBadgeClass(status),
			)}
		>
			{formatSerialNoStatus(status)}
		</span>
	);
}

function SerialNoRealtimeSubscription({
	onData,
}: {
	onData: (event: { type: "created" | "updated" | "deleted" }) => void;
}) {
	trpc.inventory.onSerialNosChanged.useSubscription(undefined, {
		onData,
	});

	return null;
}

export default function SerialNoPage() {
	const utils = trpc.useUtils();
	const [search, setSearch] = React.useState("");
	const [itemId, setItemId] = React.useState("");
	const [warehouseId, setWarehouseId] = React.useState("");
	const [company, setCompany] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
	const [includeDisabled, setIncludeDisabled] = React.useState(false);
	const [sortBy, setSortBy] =
		React.useState<Inventory.SerialNoSortBy>("updatedAt");
	const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
		"desc",
	);
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: SERIAL_NO_PAGE_SIZE,
	});
	const [serialNoToDelete, setSerialNoToDelete] = React.useState<string | null>(
		null,
	);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	const deferredSearch = useDeferredValue(search);
	const deferredCompany = useDeferredValue(company);

	const resetToFirstPage = React.useCallback(() => {
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	const queryInput = React.useMemo(
		() =>
			buildSerialNoListInput({
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
	} = trpc.inventory.listSerialNos.useQuery(queryInput, {
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

	const serialNos = React.useMemo<SerialNoRow[]>(
		() =>
			(data?.items ?? []).map((entry) => ({
				...entry,
				createdAt: new Date(entry.createdAt),
				updatedAt: new Date(entry.updatedAt),
				purchaseDate: entry.purchaseDate ? new Date(entry.purchaseDate) : null,
				warrantyExpiryDate: entry.warrantyExpiryDate
					? new Date(entry.warrantyExpiryDate)
					: null,
				serviceContractExpiryDate: entry.serviceContractExpiryDate
					? new Date(entry.serviceContractExpiryDate)
					: null,
				history: entry.history.map((historyEntry) => ({
					...historyEntry,
					createdAt: new Date(historyEntry.createdAt),
				})),
			})),
		[data?.items],
	);

	const itemOptions = React.useMemo(
		() => rawItems.filter((item) => item.hasSerialNo),
		[rawItems],
	);

	const totalCount = data?.totalCount ?? 0;
	const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

	const deleteMutation = trpc.inventory.deleteSerialNo.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listSerialNos.cancel(queryInput);
			const previous = utils.inventory.listSerialNos.getData(queryInput);
			utils.inventory.listSerialNos.setData(queryInput, (current) => {
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
			toast.success("Serial number deleted successfully");
			setSerialNoToDelete(null);
			setIsDeleteDialogOpen(false);
		},
		onError: (error, _variables, context) => {
			if (context?.previous) {
				utils.inventory.listSerialNos.setData(queryInput, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listSerialNos.invalidate();
		},
	});

	const columns = React.useMemo<ColumnDef<SerialNoRow>[]>(
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
						aria-label="Select all serial numbers"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
						aria-label={`Select ${row.original.serialNo}`}
					/>
				),
				size: 40,
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
			{
				accessorKey: "serialNo",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Serial No" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/serial-no-and-batch/serial-no/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.serialNo}
					</Link>
				),
				meta: { label: "Serial No", exportable: true },
			},
			{
				accessorKey: "itemCode",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Code" />
				),
				cell: ({ row }) => (
					<div className="space-y-1">
						<div className="font-medium">{row.original.itemCode}</div>
						<div className="text-xs text-muted-foreground">
							{row.original.itemName}
						</div>
					</div>
				),
				meta: { label: "Item Code", exportable: true },
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
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => <StatusBadge status={row.original.status} />,
				meta: { label: "Status", exportable: true },
			},
			{
				accessorKey: "company",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company" />
				),
				meta: { label: "Company", exportable: true },
			},
			{
				id: "links",
				header: "Linked Docs",
				cell: ({ row }) => {
					const values = [
						row.original.purchaseReceiptSeries,
						row.original.deliveryNoteSeries,
						row.original.stockEntrySeries,
						row.original.pickListSeries,
					].filter(Boolean);
					return (
						<span className="text-xs text-muted-foreground">
							{values.length > 0 ? values.join(", ") : "None"}
						</span>
					);
				},
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
								aria-label={`Open actions for ${row.original.serialNo}`}
							>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuItem asChild>
								<Link
									href={`/inventory/serial-no-and-batch/serial-no/form?id=${row.original.id}`}
									className="flex items-center gap-2"
								>
									<Edit className="h-4 w-4" />
									Edit Serial No
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => {
									setSerialNoToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Serial No
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				size: 60,
			},
		],
		[],
	);

	const { table } = useAdvancedDataTable<SerialNoRow>({
		data: serialNos,
		columns,
		pageCount,
		onPaginationChange: setPagination,
		getRowId: (row) => row.id,
		enableGlobalFilter: false,
	});

	const handleRealtimeData = React.useCallback(
		(_event: { type: "created" | "updated" | "deleted" }) => {
			void utils.inventory.listSerialNos.invalidate();
		},
		[utils],
	);

	const confirmDelete = React.useCallback(() => {
		if (!serialNoToDelete) return;
		deleteMutation.mutate({ id: serialNoToDelete });
	}, [deleteMutation, serialNoToDelete]);

	if (queryError) {
		return (
			<ErrorState
				error={queryError}
				title="Unable to load serial numbers"
				onRetry={() => void refetch()}
			/>
		);
	}

	return (
		<div className="space-y-4">
			<SerialNoRealtimeSubscription onData={handleRealtimeData} />

			<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Serial No</h1>
					<p className="text-sm text-muted-foreground">
						Track individual serialized inventory with lifecycle, warehouse, and
						transaction links.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => void refetch()}>
						<RefreshCw className="mr-2 h-4 w-4" />
						Refresh
					</Button>
					<Button asChild>
						<Link href="/inventory/serial-no-and-batch/serial-no/form">
							<Plus className="mr-2 h-4 w-4" />
							Add Serial No
						</Link>
					</Button>
				</div>
			</div>

			<div className="rounded-xl border bg-background p-4">
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
					<div className="space-y-2 xl:col-span-2">
						<Label htmlFor="serial-no-search">Search</Label>
						<Input
							id="serial-no-search"
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								resetToFirstPage();
							}}
							placeholder="Serial, item, company, work order..."
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-no-item-filter">Item</Label>
						<Select
							value={itemId || "__all"}
							onValueChange={(value) => {
								setItemId(value === "__all" ? "" : value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-no-item-filter">
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
						<Label htmlFor="serial-no-warehouse-filter">Warehouse</Label>
						<Select
							value={warehouseId || "__all"}
							onValueChange={(value) => {
								setWarehouseId(value === "__all" ? "" : value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-no-warehouse-filter">
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
						<Label htmlFor="serial-no-status-filter">Status</Label>
						<Select
							value={statusFilter}
							onValueChange={(value: StatusFilter) => {
								setStatusFilter(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-no-status-filter">
								<SelectValue placeholder="All statuses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								{Inventory.serialNoStatusSchema.options.map((status) => (
									<SelectItem key={status} value={status}>
										{formatSerialNoStatus(status)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-no-company-filter">Company</Label>
						<Input
							id="serial-no-company-filter"
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
						<Label htmlFor="serial-no-sort-by">Sort By</Label>
						<Select
							value={sortBy}
							onValueChange={(value: Inventory.SerialNoSortBy) => {
								setSortBy(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-no-sort-by">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="updatedAt">Last Updated</SelectItem>
								<SelectItem value="createdAt">Created On</SelectItem>
								<SelectItem value="serialNo">Serial No</SelectItem>
								<SelectItem value="itemCode">Item Code</SelectItem>
								<SelectItem value="warehouse">Warehouse</SelectItem>
								<SelectItem value="status">Status</SelectItem>
								<SelectItem value="company">Company</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-no-sort-direction">Direction</Label>
						<Select
							value={sortDirection}
							onValueChange={(value: "asc" | "desc") => {
								setSortDirection(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-no-sort-direction">
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
							htmlFor="include-disabled-serial-nos"
							className="flex items-center gap-2 text-sm text-muted-foreground"
						>
							<Checkbox
								id="include-disabled-serial-nos"
								checked={includeDisabled}
								onCheckedChange={(value) => {
									setIncludeDisabled(Boolean(value));
									resetToFirstPage();
								}}
							/>
							Include disabled serial numbers
						</label>
					</div>
				</div>
			</div>

			<AdvancedDataTable
				table={table}
				data={serialNos}
				enableGlobalSearch={false}
				enableBulkActions={false}
				enableExport={false}
				enableImport={false}
			/>

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setSerialNoToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
