"use client";

import type { Inventory } from "@aria/types";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDeferredValue } from "react";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	formatRelativeAge,
	formatSerialNoStatus,
	getSerialNoStatusBadgeClass,
} from "../serial-no/serial-no.utils";
import {
	buildSerialNoWarrantyExpiryListInput,
	formatSerialNoWarrantyExpiryState,
	formatWarrantyCompactDate,
	formatWarrantyDaysUntilExpiry,
	getSerialNoWarrantyExpiryStateBadgeClass,
	SERIAL_NO_WARRANTY_EXPIRY_PAGE_SIZE,
} from "./serial-no-warranty-expiry.utils";

type WarrantyExpiryRow = Omit<
	Inventory.SerialNoWarrantyExpiryRow,
	"createdAt" | "updatedAt" | "purchaseDate" | "warrantyExpiryDate"
> & {
	createdAt: Date;
	updatedAt: Date;
	purchaseDate: Date | null;
	warrantyExpiryDate: Date;
};

type StatusFilter = "all" | Inventory.SerialNoStatus;
type ExpiryStateFilter = "all" | Inventory.SerialNoWarrantyExpiryState;

const SERIAL_NO_STATUS_OPTIONS: Inventory.SerialNoStatus[] = [
	"DRAFT",
	"AVAILABLE",
	"DELIVERED",
	"INSTALLED",
	"RETURNED",
	"SCRAPPED",
	"DISPOSED",
];

const EXPIRY_STATE_OPTIONS: Inventory.SerialNoWarrantyExpiryState[] = [
	"EXPIRED",
	"DUE_SOON",
	"ACTIVE",
];

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

function ExpiryStateBadge({
	state,
}: {
	state: Inventory.SerialNoWarrantyExpiryState;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				getSerialNoWarrantyExpiryStateBadgeClass(state),
			)}
		>
			{formatSerialNoWarrantyExpiryState(state)}
		</span>
	);
}

function SerialNoWarrantyExpiryRealtimeSubscription({
	onData,
}: {
	onData: (event: { type: "created" | "updated" | "deleted" }) => void;
}) {
	trpc.inventory.onSerialNosChanged.useSubscription(undefined, {
		onData,
	});

	return null;
}

export default function SerialNoWarrantyExpiryPage() {
	const utils = trpc.useUtils();
	const [search, setSearch] = React.useState("");
	const [itemId, setItemId] = React.useState("");
	const [warehouseId, setWarehouseId] = React.useState("");
	const [company, setCompany] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
	const [expiryStateFilter, setExpiryStateFilter] =
		React.useState<ExpiryStateFilter>("all");
	const [includeDisabled, setIncludeDisabled] = React.useState(false);
	const [expiryDateFrom, setExpiryDateFrom] = React.useState("");
	const [expiryDateTo, setExpiryDateTo] = React.useState("");
	const [expiringWithinDays, setExpiringWithinDays] = React.useState("30");
	const [sortBy, setSortBy] =
		React.useState<Inventory.SerialNoWarrantyExpirySortBy>(
			"warrantyExpiryDate",
		);
	const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
		"asc",
	);
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: SERIAL_NO_WARRANTY_EXPIRY_PAGE_SIZE,
	});

	const deferredSearch = useDeferredValue(search);
	const deferredCompany = useDeferredValue(company);

	const resetToFirstPage = React.useCallback(() => {
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	const queryInput = React.useMemo(
		() =>
			buildSerialNoWarrantyExpiryListInput({
				search: deferredSearch,
				itemId,
				warehouseId,
				company: deferredCompany,
				status: statusFilter,
				expiryState: expiryStateFilter,
				includeDisabled,
				expiryDateFrom,
				expiryDateTo,
				expiringWithinDays,
				pageIndex: pagination.pageIndex,
				pageSize: pagination.pageSize,
				sortBy,
				sortDirection,
			}),
		[
			deferredCompany,
			deferredSearch,
			expiringWithinDays,
			expiryDateFrom,
			expiryDateTo,
			expiryStateFilter,
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
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listSerialNoWarrantyExpiry.useQuery(queryInput, {
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

	const rows = React.useMemo<WarrantyExpiryRow[]>(
		() =>
			(data?.items ?? []).map((entry) => ({
				...entry,
				createdAt: new Date(entry.createdAt),
				updatedAt: new Date(entry.updatedAt),
				purchaseDate: entry.purchaseDate ? new Date(entry.purchaseDate) : null,
				warrantyExpiryDate: new Date(entry.warrantyExpiryDate),
			})),
		[data?.items],
	);

	const itemOptions = React.useMemo(
		() => rawItems.filter((item) => item.hasSerialNo),
		[rawItems],
	);

	const totalCount = data?.totalCount ?? 0;
	const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

	const columns = React.useMemo<ColumnDef<WarrantyExpiryRow>[]>(
		() => [
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
				cell: ({ row }) => row.original.itemCode,
				meta: { label: "Item Code", exportable: true },
			},
			{
				accessorKey: "currentWarehouseName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Warehouse" />
				),
				cell: ({ row }) => row.original.currentWarehouseName ?? "Unassigned",
				meta: { label: "Warehouse", exportable: true },
			},
			{
				accessorKey: "warrantyExpiryDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Warranty Expiry" />
				),
				cell: ({ row }) =>
					formatWarrantyCompactDate(row.original.warrantyExpiryDate),
				meta: { label: "Warranty Expiry", exportable: true },
			},
			{
				accessorKey: "daysUntilExpiry",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Ageing" />
				),
				cell: ({ row }) =>
					formatWarrantyDaysUntilExpiry(row.original.daysUntilExpiry),
				meta: { label: "Ageing", exportable: true },
			},
			{
				accessorKey: "expiryState",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Expiry State" />
				),
				cell: ({ row }) => (
					<ExpiryStateBadge state={row.original.expiryState} />
				),
				meta: { label: "Expiry State", exportable: true },
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
				cell: ({ row }) => row.original.company,
				meta: { label: "Company", exportable: true },
			},
			{
				accessorKey: "updatedAt",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Last Updated" />
				),
				cell: ({ row }) => formatRelativeAge(row.original.updatedAt),
				meta: { label: "Last Updated", exportable: true },
			},
		],
		[],
	);

	const { table } = useAdvancedDataTable<WarrantyExpiryRow>({
		data: rows,
		columns,
		pageCount,
		onPaginationChange: setPagination,
		getRowId: (row) => row.id,
		enableGlobalFilter: false,
		enableRowSelection: false,
		enableMultiRowSelection: false,
	});

	const handleRealtimeData = React.useCallback(
		(_event: { type: "created" | "updated" | "deleted" }) => {
			void utils.inventory.listSerialNoWarrantyExpiry.invalidate();
		},
		[utils],
	);

	if (queryError) {
		return (
			<div className="flex flex-col gap-6 px-4 py-6 md:px-6">
				<ErrorState
					error={queryError}
					title="Unable to load warranty expiry report"
					onRetry={() => void refetch()}
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 px-4 py-6 md:px-6">
			<SerialNoWarrantyExpiryRealtimeSubscription onData={handleRealtimeData} />

			<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Serial No Warranty Expiry
					</h1>
					<p className="text-sm text-muted-foreground">
						Monitor serialized inventory warranties, ageing, and upcoming
						warranty expiry risk.
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={() => void refetch()}>
					<RefreshCw className="mr-2 h-4 w-4" />
					Refresh
				</Button>
			</div>

			<div className="rounded-xl border bg-background p-4">
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
					<div className="space-y-2 xl:col-span-2">
						<Label htmlFor="serial-warranty-search">Search</Label>
						<Input
							id="serial-warranty-search"
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								resetToFirstPage();
							}}
							placeholder="Serial, item, warehouse, company..."
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-warranty-item-filter">Item</Label>
						<Select
							value={itemId || "__all"}
							onValueChange={(value) => {
								setItemId(value === "__all" ? "" : value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-warranty-item-filter">
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
						<Label htmlFor="serial-warranty-warehouse-filter">Warehouse</Label>
						<Select
							value={warehouseId || "__all"}
							onValueChange={(value) => {
								setWarehouseId(value === "__all" ? "" : value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-warranty-warehouse-filter">
								<SelectValue placeholder="All warehouses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__all">All warehouses</SelectItem>
								{warehouseOptions?.items.map((warehouse) => (
									<SelectItem key={warehouse.id} value={warehouse.id}>
										{warehouse.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-warranty-status-filter">Status</Label>
						<Select
							value={statusFilter}
							onValueChange={(value: StatusFilter) => {
								setStatusFilter(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-warranty-status-filter">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								{SERIAL_NO_STATUS_OPTIONS.map((status) => (
									<SelectItem key={status} value={status}>
										{formatSerialNoStatus(status)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-warranty-expiry-state-filter">
							Expiry State
						</Label>
						<Select
							value={expiryStateFilter}
							onValueChange={(value: ExpiryStateFilter) => {
								setExpiryStateFilter(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-warranty-expiry-state-filter">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All expiry states</SelectItem>
								{EXPIRY_STATE_OPTIONS.map((state) => (
									<SelectItem key={state} value={state}>
										{formatSerialNoWarrantyExpiryState(state)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
					<div className="space-y-2">
						<Label htmlFor="serial-warranty-company-filter">Company</Label>
						<Input
							id="serial-warranty-company-filter"
							value={company}
							onChange={(event) => {
								setCompany(event.target.value);
								resetToFirstPage();
							}}
							placeholder="Filter by company"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-warranty-expiry-from">Expiry From</Label>
						<Input
							id="serial-warranty-expiry-from"
							type="date"
							value={expiryDateFrom}
							onChange={(event) => {
								setExpiryDateFrom(event.target.value);
								resetToFirstPage();
							}}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-warranty-expiry-to">Expiry To</Label>
						<Input
							id="serial-warranty-expiry-to"
							type="date"
							value={expiryDateTo}
							onChange={(event) => {
								setExpiryDateTo(event.target.value);
								resetToFirstPage();
							}}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-warranty-expiring-window">
							Due Soon Window (days)
						</Label>
						<Input
							id="serial-warranty-expiring-window"
							inputMode="numeric"
							value={expiringWithinDays}
							onChange={(event) => {
								setExpiringWithinDays(event.target.value);
								resetToFirstPage();
							}}
							placeholder="30"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-warranty-sort-by">Sort By</Label>
						<Select
							value={sortBy}
							onValueChange={(
								value: Inventory.SerialNoWarrantyExpirySortBy,
							) => {
								setSortBy(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-warranty-sort-by">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="warrantyExpiryDate">
									Warranty Expiry
								</SelectItem>
								<SelectItem value="updatedAt">Last Updated</SelectItem>
								<SelectItem value="serialNo">Serial No</SelectItem>
								<SelectItem value="itemCode">Item Code</SelectItem>
								<SelectItem value="warehouse">Warehouse</SelectItem>
								<SelectItem value="status">Status</SelectItem>
								<SelectItem value="company">Company</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-warranty-sort-direction">Direction</Label>
						<Select
							value={sortDirection}
							onValueChange={(value: "asc" | "desc") => {
								setSortDirection(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-warranty-sort-direction">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="asc">Ascending</SelectItem>
								<SelectItem value="desc">Descending</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="mt-4 flex items-center justify-between">
					<label
						htmlFor="include-disabled-warranty"
						className="flex items-center gap-2 text-sm text-muted-foreground"
					>
						<Checkbox
							id="include-disabled-warranty"
							checked={includeDisabled}
							onCheckedChange={(value) => {
								setIncludeDisabled(Boolean(value));
								resetToFirstPage();
							}}
						/>
						Include disabled serial numbers
					</label>
					<div className="text-sm text-muted-foreground">
						{totalCount} serial no{totalCount === 1 ? "" : "s"} in scope
					</div>
				</div>
			</div>

			{isLoading && (
				<div className="flex items-center justify-center py-12">
					<DataTableSkeleton columnCount={8} rowCount={8} />
				</div>
			)}

			{!isLoading && (
				<AdvancedDataTable
					table={table}
					data={rows}
					enableGlobalSearch={false}
					enableBulkActions={false}
					enableImport={false}
					enableExport
					ariaLabel="Serial number warranty expiry report"
				/>
			)}
		</div>
	);
}
