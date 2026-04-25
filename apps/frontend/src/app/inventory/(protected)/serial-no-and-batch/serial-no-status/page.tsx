"use client";

import type { Inventory } from "@aria/types";
import type { ColumnDef } from "@tanstack/react-table";
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
	buildSerialNoStatusListInput,
	formatCompactDate,
	formatDaysInCurrentStatus,
	groupSerialNoStatusRows,
	SERIAL_NO_STATUS_GROUP_BY_OPTIONS,
	SERIAL_NO_STATUS_GROUP_METRIC_OPTIONS,
	type SerialNoStatusDisplayRow,
	type SerialNoStatusGroupByField,
	type SerialNoStatusGroupMetric,
	toSerialNoStatusDetailRows,
} from "./serial-no-status.utils";

type StatusRow = Omit<
	Inventory.SerialNoStatusRow,
	| "createdAt"
	| "updatedAt"
	| "purchaseDate"
	| "warrantyExpiryDate"
	| "serviceContractExpiryDate"
	| "lastStatusChangedAt"
> & {
	createdAt: Date;
	updatedAt: Date;
	purchaseDate: Date | null;
	warrantyExpiryDate: Date | null;
	serviceContractExpiryDate: Date | null;
	lastStatusChangedAt: Date;
};

type StatusFilter = "all" | Inventory.SerialNoStatus;

const SERIAL_NO_STATUS_OPTIONS: Inventory.SerialNoStatus[] = [
	"DRAFT",
	"AVAILABLE",
	"DELIVERED",
	"INSTALLED",
	"RETURNED",
	"SCRAPPED",
	"DISPOSED",
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

function SerialNoStatusRealtimeSubscription({
	onData,
}: {
	onData: (event: { type: "created" | "updated" | "deleted" }) => void;
}) {
	trpc.inventory.onSerialNosChanged.useSubscription(undefined, {
		onData,
	});

	return null;
}

export default function SerialNoStatusPage() {
	const utils = trpc.useUtils();
	const [search, setSearch] = React.useState("");
	const [itemId, setItemId] = React.useState("");
	const [warehouseId, setWarehouseId] = React.useState("");
	const [company, setCompany] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
	const [includeDisabled, setIncludeDisabled] = React.useState(false);
	const [sortBy, setSortBy] =
		React.useState<Inventory.SerialNoStatusSortBy>("updatedAt");
	const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
		"desc",
	);
	const [groupBy, setGroupBy] = React.useState<
		SerialNoStatusGroupByField | "none"
	>("none");
	const [groupMetric, setGroupMetric] =
		React.useState<SerialNoStatusGroupMetric>("count");

	const deferredSearch = useDeferredValue(search);
	const deferredCompany = useDeferredValue(company);

	const queryInput = React.useMemo(
		() =>
			buildSerialNoStatusListInput({
				search: deferredSearch,
				itemId,
				warehouseId,
				company: deferredCompany,
				status: statusFilter,
				includeDisabled,
				sortBy,
				sortDirection,
			}),
		[
			deferredCompany,
			deferredSearch,
			includeDisabled,
			itemId,
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
	} = trpc.inventory.listSerialNoStatus.useQuery(queryInput, {
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

	const rows = React.useMemo<StatusRow[]>(
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
				lastStatusChangedAt: new Date(entry.lastStatusChangedAt),
			})),
		[data?.items],
	);

	const itemOptions = React.useMemo(
		() => rawItems.filter((item) => item.hasSerialNo),
		[rawItems],
	);

	const totalCount = data?.totalCount ?? 0;

	const statusTotals = React.useMemo(
		() => ({
			total: rows.length,
			available: rows.filter((row) => row.status === "AVAILABLE").length,
			installed: rows.filter((row) => row.status === "INSTALLED").length,
			disabled: rows.filter((row) => row.isDisabled).length,
		}),
		[rows],
	);

	const displayRows = React.useMemo<SerialNoStatusDisplayRow[]>(() => {
		if (groupBy === "none") {
			return toSerialNoStatusDetailRows(rows);
		}

		return groupSerialNoStatusRows(rows, groupBy);
	}, [groupBy, rows]);

	const columns = React.useMemo<ColumnDef<SerialNoStatusDisplayRow>[]>(() => {
		if (groupBy !== "none") {
			return [
				{
					accessorKey: "groupValue",
					header: ({ column }) => (
						<DataTableColumnHeader column={column} title="Group" />
					),
					cell: ({ row }) =>
						row.original.kind === "group" ? (
							<span className="font-medium">{row.original.groupValue}</span>
						) : (
							"-"
						),
					meta: { label: "Group", exportable: true },
				},
				{
					accessorKey: "count",
					header: ({ column }) => (
						<DataTableColumnHeader column={column} title="Count" />
					),
					cell: ({ row }) =>
						row.original.kind === "group" ? row.original.count : "-",
					meta: { label: "Count", exportable: true },
				},
				{
					id: "metric",
					header: ({ column }) => (
						<DataTableColumnHeader
							column={column}
							title={
								groupMetric === "count"
									? "Count"
									: groupMetric === "disabledCount"
										? "Disabled"
										: "Avg Days In Status"
							}
						/>
					),
					cell: ({ row }) => {
						if (row.original.kind !== "group") {
							return "-";
						}

						if (groupMetric === "count") {
							return row.original.count;
						}

						if (groupMetric === "disabledCount") {
							return row.original.disabledCount;
						}

						return formatDaysInCurrentStatus(
							Math.round(row.original.averageDaysInCurrentStatus),
						);
					},
					meta: { label: "Metric", exportable: true },
				},
			];
		}

		return [
			{
				accessorKey: "serialNo",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Serial No" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail" ? (
						<Link
							href={`/inventory/serial-no-and-batch/serial-no/form?id=${row.original.id}`}
							className="font-medium text-primary hover:underline"
						>
							{row.original.serialNo}
						</Link>
					) : (
						"-"
					),
				meta: { label: "Serial No", exportable: true },
			},
			{
				accessorKey: "itemCode",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Code" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail" ? row.original.itemCode : "-",
				meta: { label: "Item Code", exportable: true },
			},
			{
				accessorKey: "currentWarehouseName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Warehouse" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail"
						? (row.original.currentWarehouseName ?? "Unassigned")
						: "-",
				meta: { label: "Warehouse", exportable: true },
			},
			{
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail" ? (
						<StatusBadge status={row.original.status} />
					) : (
						"-"
					),
				meta: { label: "Status", exportable: true },
			},
			{
				accessorKey: "daysInCurrentStatus",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Days In Status" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail"
						? formatDaysInCurrentStatus(row.original.daysInCurrentStatus)
						: "-",
				meta: { label: "Days In Status", exportable: true },
			},
			{
				accessorKey: "lastStatusChangedAt",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status Changed" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail"
						? formatCompactDate(row.original.lastStatusChangedAt)
						: "-",
				meta: { label: "Status Changed", exportable: true },
			},
			{
				accessorKey: "maintenanceStatus",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Maintenance" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail"
						? (row.original.maintenanceStatus ?? "Not set")
						: "-",
				meta: { label: "Maintenance", exportable: true },
			},
			{
				accessorKey: "company",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail" ? row.original.company : "-",
				meta: { label: "Company", exportable: true },
			},
			{
				accessorKey: "updatedAt",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Last Updated" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail"
						? formatRelativeAge(row.original.updatedAt)
						: "-",
				meta: { label: "Last Updated", exportable: true },
			},
		];
	}, [groupBy, groupMetric]);

	const { table } = useAdvancedDataTable<SerialNoStatusDisplayRow>({
		data: displayRows,
		columns,
		getRowId: (row) => row.id,
		enableGlobalFilter: false,
		enableRowSelection: false,
		enableMultiRowSelection: false,
	});

	const handleRealtimeData = React.useCallback(
		(_event: { type: "created" | "updated" | "deleted" }) => {
			void utils.inventory.listSerialNoStatus.invalidate();
		},
		[utils],
	);

	if (queryError) {
		return (
			<div className="flex flex-col gap-6 px-4 py-6 md:px-6">
				<ErrorState
					error={queryError}
					title="Unable to load serial number status report"
					onRetry={() => void refetch()}
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 px-4 py-6 md:px-6">
			<SerialNoStatusRealtimeSubscription onData={handleRealtimeData} />

			<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Serial No Status
					</h1>
					<p className="text-sm text-muted-foreground">
						Review serialized inventory by current lifecycle state, warehouse
						placement, and operational ageing.
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={() => void refetch()}>
					<RefreshCw className="mr-2 h-4 w-4" />
					Refresh
				</Button>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Rows In Scope</div>
					<div className="mt-2 text-2xl font-semibold">
						{statusTotals.total}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Available</div>
					<div className="mt-2 text-2xl font-semibold">
						{statusTotals.available}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Installed</div>
					<div className="mt-2 text-2xl font-semibold">
						{statusTotals.installed}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Disabled</div>
					<div className="mt-2 text-2xl font-semibold">
						{statusTotals.disabled}
					</div>
				</div>
			</div>

			<div className="rounded-xl border bg-background p-4">
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
					<div className="space-y-2 xl:col-span-2">
						<Label htmlFor="serial-status-search">Search</Label>
						<Input
							id="serial-status-search"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Serial, item, warehouse, company..."
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-status-item-filter">Item</Label>
						<Select
							value={itemId || "__all"}
							onValueChange={(value) =>
								setItemId(value === "__all" ? "" : value)
							}
						>
							<SelectTrigger id="serial-status-item-filter">
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
						<Label htmlFor="serial-status-warehouse-filter">Warehouse</Label>
						<Select
							value={warehouseId || "__all"}
							onValueChange={(value) =>
								setWarehouseId(value === "__all" ? "" : value)
							}
						>
							<SelectTrigger id="serial-status-warehouse-filter">
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
						<Label htmlFor="serial-status-filter">Status</Label>
						<Select
							value={statusFilter}
							onValueChange={(value: StatusFilter) => setStatusFilter(value)}
						>
							<SelectTrigger id="serial-status-filter">
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
						<Label htmlFor="serial-status-company-filter">Company</Label>
						<Input
							id="serial-status-company-filter"
							value={company}
							onChange={(event) => setCompany(event.target.value)}
							placeholder="Filter by company"
						/>
					</div>
				</div>

				<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
					<div className="space-y-2">
						<Label htmlFor="serial-status-group-by">Group By</Label>
						<Select
							value={groupBy}
							onValueChange={(value: SerialNoStatusGroupByField | "none") =>
								setGroupBy(value)
							}
						>
							<SelectTrigger id="serial-status-group-by">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">No grouping</SelectItem>
								{SERIAL_NO_STATUS_GROUP_BY_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-status-group-metric">Group Metric</Label>
						<Select
							value={groupMetric}
							onValueChange={(value: SerialNoStatusGroupMetric) =>
								setGroupMetric(value)
							}
							disabled={groupBy === "none"}
						>
							<SelectTrigger id="serial-status-group-metric">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{SERIAL_NO_STATUS_GROUP_METRIC_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="serial-status-sort-by">Sort By</Label>
						<Select
							value={sortBy}
							onValueChange={(value: Inventory.SerialNoStatusSortBy) =>
								setSortBy(value)
							}
						>
							<SelectTrigger id="serial-status-sort-by">
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
						<Label htmlFor="serial-status-sort-direction">Direction</Label>
						<Select
							value={sortDirection}
							onValueChange={(value: "asc" | "desc") => setSortDirection(value)}
						>
							<SelectTrigger id="serial-status-sort-direction">
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
						htmlFor="include-disabled-serial-status"
						className="flex items-center gap-2 text-sm text-muted-foreground"
					>
						<Checkbox
							id="include-disabled-serial-status"
							checked={includeDisabled}
							onCheckedChange={(value) => setIncludeDisabled(Boolean(value))}
						/>
						Include disabled serial numbers
					</label>
					<div className="text-sm text-muted-foreground">
						{totalCount} serial number{totalCount === 1 ? "" : "s"} in scope,
						showing up to 250 rows
					</div>
				</div>
			</div>

			<AdvancedDataTable
				table={table}
				data={displayRows}
				enableGlobalSearch={false}
				enableBulkActions={false}
				enableImport={false}
				enableExport
				ariaLabel="Serial number status report"
			/>
		</div>
	);
}
