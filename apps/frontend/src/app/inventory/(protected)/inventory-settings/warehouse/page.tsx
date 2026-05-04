"use client";

import type { Inventory } from "@aria/types";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import {
	Edit,
	Heart,
	MessageCircle,
	MoreHorizontal,
	Plus,
	Trash,
} from "lucide-react";
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
import {
	buildWarehouseListInput,
	getRelativeAge,
	getWarehouseStatusLabel,
	WAREHOUSE_PAGE_SIZE,
} from "./warehouse.utils";

type WarehouseRow = Omit<Inventory.Warehouse, "createdAt" | "updatedAt"> & {
	createdAt: Date;
	updatedAt: Date;
};

type StatusFilter = "all" | "enabled" | "disabled";
type GroupFilter = "all" | "group" | "leaf";

export default function WarehousePage() {
	const utils = trpc.useUtils();
	const [search, setSearch] = React.useState("");
	const [company, setCompany] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
	const [groupFilter, setGroupFilter] = React.useState<GroupFilter>("all");
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: WAREHOUSE_PAGE_SIZE,
	});
	const [warehouseToDelete, setWarehouseToDelete] = React.useState<
		string | null
	>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	const deferredSearch = useDeferredValue(search);
	const deferredCompany = useDeferredValue(company);

	const resetToFirstPage = React.useCallback(() => {
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	const queryInput = React.useMemo(
		() =>
			buildWarehouseListInput({
				search: deferredSearch,
				company: deferredCompany,
				status: statusFilter,
				group: groupFilter,
				pageIndex: pagination.pageIndex,
				pageSize: pagination.pageSize,
			}),
		[deferredCompany, deferredSearch, groupFilter, pagination, statusFilter],
	);

	const {
		data,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listWarehouses.useQuery(queryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		placeholderData: (previous) => previous,
	});

	const warehouses = React.useMemo<WarehouseRow[]>(
		() =>
			(data?.items ?? []).map((warehouse) => ({
				...warehouse,
				createdAt: new Date(warehouse.createdAt),
				updatedAt: new Date(warehouse.updatedAt),
			})),
		[data?.items],
	);

	const totalCount = data?.totalCount ?? 0;
	const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

	const deleteMutation = trpc.inventory.deleteWarehouse.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listWarehouses.cancel(queryInput);
			const previous = utils.inventory.listWarehouses.getData(queryInput);
			utils.inventory.listWarehouses.setData(queryInput, (current) => {
				if (!current) return current;
				return {
					...current,
					items: current.items.filter((warehouse) => warehouse.id !== id),
					totalCount: Math.max(0, current.totalCount - 1),
				};
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Warehouse deleted successfully");
			setWarehouseToDelete(null);
			setIsDeleteDialogOpen(false);
		},
		onError: (error, _variables, context) => {
			if (context?.previous) {
				utils.inventory.listWarehouses.setData(queryInput, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listWarehouses.invalidate();
		},
	});

	const openDeleteDialog = React.useCallback((warehouseId: string) => {
		setWarehouseToDelete(warehouseId);
		setIsDeleteDialogOpen(true);
	}, []);

	const confirmDelete = React.useCallback(() => {
		if (!warehouseToDelete) return;
		deleteMutation.mutate({ id: warehouseToDelete });
	}, [deleteMutation, warehouseToDelete]);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const handleSearchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setSearch(event.target.value);
			resetToFirstPage();
		},
		[resetToFirstPage],
	);

	const handleCompanyChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setCompany(event.target.value);
			resetToFirstPage();
		},
		[resetToFirstPage],
	);

	const handleStatusChange = React.useCallback(
		(value: StatusFilter) => {
			setStatusFilter(value);
			resetToFirstPage();
		},
		[resetToFirstPage],
	);

	const handleGroupChange = React.useCallback(
		(value: GroupFilter) => {
			setGroupFilter(value);
			resetToFirstPage();
		},
		[resetToFirstPage],
	);

	const columns = React.useMemo<ColumnDef<WarehouseRow>[]>(
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
						aria-label="Select all warehouses"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
						aria-label={`Select ${row.original.name}`}
					/>
				),
				size: 40,
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
			{
				id: "warehouseName",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="ID" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/inventory-settings/warehouse/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.name}
					</Link>
				),
				meta: {
					label: "ID",
					exportable: true,
				},
			},
			{
				id: "status",
				accessorFn: (row) => getWarehouseStatusLabel(row.disabled),
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => {
					const status = getWarehouseStatusLabel(row.original.disabled);
					return status === "Enabled" ? (
						<span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
							Enabled
						</span>
					) : (
						<span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
							Disabled
						</span>
					);
				},
				meta: { label: "Status", exportable: true },
			},
			{
				id: "groupWarehouse",
				accessorFn: (row) => (row.isGroupWarehouse ? "Yes" : "No"),
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Is Group Warehouse" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.isGroupWarehouse ? "Yes" : "No"}
					</span>
				),
				meta: { label: "Is Group Warehouse", exportable: true },
			},
			{
				id: "company",
				accessorKey: "company",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.company}
					</span>
				),
				meta: { label: "Company", exportable: true },
			},
			{
				id: "age",
				accessorFn: (row) => row.updatedAt,
				header: () => <span className="sr-only">Age</span>,
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{getRelativeAge(row.original.updatedAt)}
					</span>
				),
				meta: { label: "Age", exportable: true },
				size: 70,
			},
			{
				id: "counts",
				header: () => (
					<div className="text-right text-sm text-muted-foreground">
						{warehouses.length} of {totalCount}
					</div>
				),
				cell: () => (
					<div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
						<MessageCircle className="h-4 w-4" />
						<span>0</span>
						<Heart className="h-4 w-4" />
					</div>
				),
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
				size: 90,
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								aria-label={`Open actions for ${row.original.name}`}
							>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link
									href={`/inventory/inventory-settings/warehouse/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Warehouse
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => openDeleteDialog(row.original.id)}
								className="text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Warehouse
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
				size: 64,
			},
		],
		[openDeleteDialog, totalCount, warehouses.length],
	);

	const tableResetKey = `${statusFilter}-${groupFilter}-${deferredSearch}-${deferredCompany}`;

	return (
		<div className="flex min-h-screen flex-col bg-muted px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Warehouse</h1>
					<p className="text-sm text-muted-foreground">
						Manage warehouse masters, hierarchy, contact details, and transit
						defaults.
					</p>
				</div>
				<Button asChild className="h-9 px-5">
					<Link href="/inventory/inventory-settings/warehouse/form">
						<Plus className="mr-2 h-4 w-4" />
						Add Warehouse
					</Link>
				</Button>
			</div>

			<div className="mb-4 rounded-xl border bg-background p-4">
				<div className="grid gap-4 md:grid-cols-4">
					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="warehouse-search">Search</Label>
						<Input
							id="warehouse-search"
							value={search}
							onChange={handleSearchChange}
							placeholder="Search by warehouse, company, city, or parent"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="warehouse-company-filter">Company</Label>
						<Input
							id="warehouse-company-filter"
							value={company}
							onChange={handleCompanyChange}
							placeholder="Filter by company"
						/>
					</div>
					<div className="space-y-2">
						<Label>Status</Label>
						<Select value={statusFilter} onValueChange={handleStatusChange}>
							<SelectTrigger>
								<SelectValue placeholder="All statuses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								<SelectItem value="enabled">Enabled</SelectItem>
								<SelectItem value="disabled">Disabled</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Warehouse Shape</Label>
						<Select value={groupFilter} onValueChange={handleGroupChange}>
							<SelectTrigger>
								<SelectValue placeholder="All warehouses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All warehouses</SelectItem>
								<SelectItem value="group">Group warehouses</SelectItem>
								<SelectItem value="leaf">Leaf warehouses</SelectItem>
							</SelectContent>
						</Select>
					</div>
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
					title="Failed to load warehouses"
					onRetry={() => refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<WarehouseTable
					key={tableResetKey}
					data={warehouses}
					columns={columns}
					pageCount={pageCount}
					totalCount={totalCount}
					onPaginationChange={setPagination}
					onReload={handleReload}
				/>
			)}

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => setIsDeleteDialogOpen(false)}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}

function WarehouseTable(props: {
	data: readonly WarehouseRow[];
	columns: ColumnDef<WarehouseRow, unknown>[];
	pageCount: number;
	totalCount: number;
	onPaginationChange: (pagination: PaginationState) => void;
	onReload: () => void | Promise<void>;
}) {
	const { table } = useAdvancedDataTable<WarehouseRow>({
		data: props.data,
		columns: props.columns,
		pageCount: props.pageCount,
		initialPageSize: WAREHOUSE_PAGE_SIZE,
		enableGlobalFilter: false,
		onPaginationChange: props.onPaginationChange,
		onReload: props.onReload,
	});

	return (
		<AdvancedDataTable
			table={table}
			data={props.data}
			totalItems={props.totalCount}
			enableGlobalSearch={false}
			enableExport
			enableBulkActions
			enableVirtualization
			enableColumnResizing
			ariaLabel="Warehouse table"
		/>
	);
}
