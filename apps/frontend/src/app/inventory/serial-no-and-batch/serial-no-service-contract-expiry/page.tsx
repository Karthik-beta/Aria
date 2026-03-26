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
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	formatRelativeAge,
	formatSerialNoStatus,
	getSerialNoStatusBadgeClass,
} from "../serial-no/serial-no.utils";
import {
	buildSerialNoServiceContractExpiryListInput,
	formatCompactDate,
	formatDaysUntilExpiry,
	formatSerialNoServiceContractExpiryState,
	getSerialNoServiceContractExpiryStateBadgeClass,
	SERIAL_NO_SERVICE_CONTRACT_EXPIRY_PAGE_SIZE,
} from "./serial-no-service-contract-expiry.utils";

type ServiceContractExpiryRow = Omit<
	Inventory.SerialNoServiceContractExpiryRow,
	"createdAt" | "updatedAt" | "purchaseDate" | "serviceContractExpiryDate"
> & {
	createdAt: Date;
	updatedAt: Date;
	purchaseDate: Date | null;
	serviceContractExpiryDate: Date;
};

type StatusFilter = "all" | Inventory.SerialNoStatus;
type ExpiryStateFilter = "all" | Inventory.SerialNoServiceContractExpiryState;

const SERIAL_NO_STATUS_OPTIONS: Inventory.SerialNoStatus[] = [
	"DRAFT",
	"AVAILABLE",
	"DELIVERED",
	"INSTALLED",
	"RETURNED",
	"SCRAPPED",
	"DISPOSED",
];

const EXPIRY_STATE_OPTIONS: Inventory.SerialNoServiceContractExpiryState[] = [
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
	state: Inventory.SerialNoServiceContractExpiryState;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				getSerialNoServiceContractExpiryStateBadgeClass(state),
			)}
		>
			{formatSerialNoServiceContractExpiryState(state)}
		</span>
	);
}

function SerialNoServiceContractExpiryRealtimeSubscription({
	onData,
}: {
	onData: (event: { type: "created" | "updated" | "deleted" }) => void;
}) {
	trpc.inventory.onSerialNosChanged.useSubscription(undefined, {
		onData,
	});

	return null;
}

export default function SerialNoServiceContractExpiryPage() {
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
		React.useState<Inventory.SerialNoServiceContractExpirySortBy>(
			"serviceContractExpiryDate",
		);
	const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
		"asc",
	);
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: SERIAL_NO_SERVICE_CONTRACT_EXPIRY_PAGE_SIZE,
	});

	const deferredSearch = useDeferredValue(search);
	const deferredCompany = useDeferredValue(company);

	const resetToFirstPage = React.useCallback(() => {
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	const queryInput = React.useMemo(
		() =>
			buildSerialNoServiceContractExpiryListInput({
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
		error: queryError,
		refetch,
	} = trpc.inventory.listSerialNoServiceContractExpiry.useQuery(queryInput, {
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

	const rows = React.useMemo<ServiceContractExpiryRow[]>(
		() =>
			(data?.items ?? []).map((entry) => ({
				...entry,
				createdAt: new Date(entry.createdAt),
				updatedAt: new Date(entry.updatedAt),
				purchaseDate: entry.purchaseDate ? new Date(entry.purchaseDate) : null,
				serviceContractExpiryDate: new Date(entry.serviceContractExpiryDate),
			})),
		[data?.items],
	);

	const itemOptions = React.useMemo(
		() => rawItems.filter((item) => item.hasSerialNo),
		[rawItems],
	);

	const totalCount = data?.totalCount ?? 0;
	const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

	const columns = React.useMemo<ColumnDef<ServiceContractExpiryRow>[]>(
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
				accessorKey: "serviceContractExpiryDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Contract Expiry" />
				),
				cell: ({ row }) =>
					formatCompactDate(row.original.serviceContractExpiryDate),
				meta: { label: "Contract Expiry", exportable: true },
			},
			{
				accessorKey: "daysUntilExpiry",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Ageing" />
				),
				cell: ({ row }) => formatDaysUntilExpiry(row.original.daysUntilExpiry),
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

	const { table } = useAdvancedDataTable<ServiceContractExpiryRow>({
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
			void utils.inventory.listSerialNoServiceContractExpiry.invalidate();
		},
		[utils],
	);

	if (queryError) {
		return (
			<ErrorState
				error={queryError}
				title="Unable to load service contract expiry report"
				onRetry={() => void refetch()}
			/>
		);
	}

	return (
		<div className="container mx-auto space-y-6 py-6">
			<SerialNoServiceContractExpiryRealtimeSubscription
				onData={handleRealtimeData}
			/>

			<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Serial No Service Contract Expiry
					</h1>
					<p className="text-sm text-muted-foreground">
						Monitor serialized inventory contracts, ageing, and upcoming service
						expiry risk.
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
						<Label htmlFor="serial-contract-search">Search</Label>
						<Input
							id="serial-contract-search"
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								resetToFirstPage();
							}}
							placeholder="Serial, item, warehouse, company..."
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-contract-item-filter">Item</Label>
						<Select
							value={itemId || "__all"}
							onValueChange={(value) => {
								setItemId(value === "__all" ? "" : value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-contract-item-filter">
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
						<Label htmlFor="serial-contract-warehouse-filter">Warehouse</Label>
						<Select
							value={warehouseId || "__all"}
							onValueChange={(value) => {
								setWarehouseId(value === "__all" ? "" : value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-contract-warehouse-filter">
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
						<Label htmlFor="serial-contract-status-filter">Status</Label>
						<Select
							value={statusFilter}
							onValueChange={(value: StatusFilter) => {
								setStatusFilter(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-contract-status-filter">
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
						<Label htmlFor="serial-contract-expiry-state-filter">
							Expiry State
						</Label>
						<Select
							value={expiryStateFilter}
							onValueChange={(value: ExpiryStateFilter) => {
								setExpiryStateFilter(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-contract-expiry-state-filter">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All expiry states</SelectItem>
								{EXPIRY_STATE_OPTIONS.map((state) => (
									<SelectItem key={state} value={state}>
										{formatSerialNoServiceContractExpiryState(state)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
					<div className="space-y-2">
						<Label htmlFor="serial-contract-company-filter">Company</Label>
						<Input
							id="serial-contract-company-filter"
							value={company}
							onChange={(event) => {
								setCompany(event.target.value);
								resetToFirstPage();
							}}
							placeholder="Filter by company"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-contract-expiry-from">Expiry From</Label>
						<Input
							id="serial-contract-expiry-from"
							type="date"
							value={expiryDateFrom}
							onChange={(event) => {
								setExpiryDateFrom(event.target.value);
								resetToFirstPage();
							}}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-contract-expiry-to">Expiry To</Label>
						<Input
							id="serial-contract-expiry-to"
							type="date"
							value={expiryDateTo}
							onChange={(event) => {
								setExpiryDateTo(event.target.value);
								resetToFirstPage();
							}}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-contract-expiring-window">
							Due Soon Window (days)
						</Label>
						<Input
							id="serial-contract-expiring-window"
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
						<Label htmlFor="serial-contract-sort-by">Sort By</Label>
						<Select
							value={sortBy}
							onValueChange={(
								value: Inventory.SerialNoServiceContractExpirySortBy,
							) => {
								setSortBy(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-contract-sort-by">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="serviceContractExpiryDate">
									Contract Expiry
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
						<Label htmlFor="serial-contract-sort-direction">Direction</Label>
						<Select
							value={sortDirection}
							onValueChange={(value: "asc" | "desc") => {
								setSortDirection(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="serial-contract-sort-direction">
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
						htmlFor="include-disabled-contracts"
						className="flex items-center gap-2 text-sm text-muted-foreground"
					>
						<Checkbox
							id="include-disabled-contracts"
							checked={includeDisabled}
							onCheckedChange={(value) => {
								setIncludeDisabled(Boolean(value));
								resetToFirstPage();
							}}
						/>
						Include disabled serial numbers
					</label>
					<div className="text-sm text-muted-foreground">
						{totalCount} contract{totalCount === 1 ? "" : "s"} in scope
					</div>
				</div>
			</div>

			<AdvancedDataTable
				table={table}
				data={rows}
				enableGlobalSearch={false}
				enableBulkActions={false}
				enableImport={false}
				enableExport
				ariaLabel="Serial number service contract expiry report"
			/>
		</div>
	);
}
