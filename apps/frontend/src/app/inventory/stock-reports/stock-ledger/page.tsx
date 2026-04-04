"use client";

import type { Inventory } from "@aria/types";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
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
	formatCompactDate,
	formatLedgerCurrency,
	formatLedgerQuantity,
	formatRelativeAge,
	formatStockLedgerMovement,
	formatStockLedgerStatus,
	formatStockLedgerType,
	getStockLedgerMovementBadgeClass,
	getStockLedgerStatusBadgeClass,
	STOCK_LEDGER_CURRENCY_OPTIONS,
	STOCK_LEDGER_STATUS_OPTIONS,
	STOCK_LEDGER_TYPE_OPTIONS,
	type StockLedgerCurrency,
	type StockLedgerStatus,
	type StockLedgerType,
} from "./stock-ledger.utils";

type StockLedgerSubscriptionEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.StockEntry | { id: string };
};

type UomDisplayPreference = "INCLUDE" | "HIDE";

function StockLedgerRealtimeSubscription({
	onData,
}: {
	onData?: (event: StockLedgerSubscriptionEvent) => void;
}) {
	trpc.inventory.onStockEntriesChanged.useSubscription(undefined, {
		onData,
	});

	return null;
}

type FilterState = {
	company: string;
	dateFrom: string;
	dateTo: string;
	warehouse: string;
	itemCode: string;
	itemGroup: string;
	brand: string;
	voucherNo: string;
	project: string;
	status: StockLedgerStatus | "";
	stockEntryType: StockLedgerType | "";
	includeUom: UomDisplayPreference;
	currency: StockLedgerCurrency;
	segregateSerialBatchBundle: boolean;
};

const INITIAL_FILTERS: FilterState = {
	company: "",
	dateFrom: "",
	dateTo: "",
	warehouse: "",
	itemCode: "",
	itemGroup: "",
	brand: "",
	voucherNo: "",
	project: "",
	status: "",
	stockEntryType: "",
	includeUom: "INCLUDE",
	currency: "INR",
	segregateSerialBatchBundle: false,
};

function renderLedgerText(value?: string | null): string {
	const normalized = value?.trim();
	return normalized && normalized.length > 0 ? normalized : "-";
}

function StatusBadge({ status }: { status: StockLedgerStatus }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				getStockLedgerStatusBadgeClass(status),
			)}
		>
			{formatStockLedgerStatus(status)}
		</span>
	);
}

function MovementBadge({
	movementType,
}: {
	movementType: Inventory.StockLedgerRow["movementType"];
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				getStockLedgerMovementBadgeClass(movementType),
			)}
		>
			{formatStockLedgerMovement(movementType)}
		</span>
	);
}

export default function StockLedgerPage() {
	const utils = trpc.useUtils();
	const [filters, setFilters] = React.useState<FilterState>({
		...INITIAL_FILTERS,
	});

	const updateFilter = React.useCallback(
		<Key extends keyof FilterState>(key: Key, value: FilterState[Key]) => {
			setFilters((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	const resetFilters = React.useCallback(() => {
		setFilters({ ...INITIAL_FILTERS });
	}, []);

	const listQueryInput = React.useMemo(() => {
		const company = filters.company.trim();
		const warehouse = filters.warehouse.trim();
		const itemCode = filters.itemCode.trim();
		const itemGroup = filters.itemGroup.trim();
		const brand = filters.brand.trim();
		const voucherNo = filters.voucherNo.trim();
		const project = filters.project.trim();

		return {
			take: 250,
			company: company || undefined,
			warehouse: warehouse || undefined,
			itemCode: itemCode || undefined,
			itemGroup: itemGroup || undefined,
			brand: brand || undefined,
			voucherNo: voucherNo || undefined,
			project: project || undefined,
			status: filters.status || undefined,
			stockEntryType: filters.stockEntryType || undefined,
			dateFrom: filters.dateFrom
				? new Date(`${filters.dateFrom}T00:00:00.000Z`)
				: undefined,
			dateTo: filters.dateTo
				? new Date(`${filters.dateTo}T23:59:59.999Z`)
				: undefined,
		};
	}, [
		filters.company,
		filters.dateFrom,
		filters.dateTo,
		filters.warehouse,
		filters.itemCode,
		filters.itemGroup,
		filters.brand,
		filters.voucherNo,
		filters.project,
		filters.status,
		filters.stockEntryType,
	]);

	const {
		data: rawRows = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listStockLedger.useQuery(listQueryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	type StockLedgerRow = Omit<
		(typeof rawRows)[number],
		"postingDate" | "createdAt" | "updatedAt"
	> & {
		postingDate: Date;
		createdAt: Date;
		updatedAt: Date;
	};

	const rows = React.useMemo<StockLedgerRow[]>(
		() =>
			rawRows.map((row: (typeof rawRows)[number]) => ({
				...row,
				postingDate: new Date(row.postingDate),
				createdAt: new Date(row.createdAt),
				updatedAt: new Date(row.updatedAt),
			})),
		[rawRows],
	);

	const showUom = filters.includeUom === "INCLUDE";
	const showSerialBatchColumns = filters.segregateSerialBatchBundle;

	const columns = React.useMemo<ColumnDef<StockLedgerRow>[]>(() => {
		const ledgerColumns: ColumnDef<StockLedgerRow>[] = [
			{
				accessorKey: "postingDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Date" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatCompactDate(row.original.postingDate)}
					</span>
				),
				meta: {
					label: "Date",
					variant: "date",
					exportable: true,
				},
			},
			{
				accessorKey: "itemCode",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item" />
				),
				cell: ({ row }) => (
					<span className="font-medium">{row.original.itemCode}</span>
				),
				meta: {
					label: "Item",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "itemName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Name" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{renderLedgerText(row.original.itemName)}
					</span>
				),
				meta: {
					label: "Item Name",
					exportable: true,
				},
			},
		];

		if (showUom) {
			ledgerColumns.push({
				accessorKey: "unitOfMeasure",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Stock UOM" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{renderLedgerText(row.original.unitOfMeasure)}
					</span>
				),
				meta: {
					label: "Stock UOM",
					exportable: true,
				},
			});
		}

		ledgerColumns.push(
			{
				accessorKey: "qtyIn",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="In Qty" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-emerald-700 dark:text-emerald-300">
						{formatLedgerQuantity(row.original.qtyIn)}
					</span>
				),
				meta: {
					label: "In Qty",
					exportable: true,
				},
			},
			{
				accessorKey: "qtyOut",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Out Qty" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-amber-700 dark:text-amber-300">
						{formatLedgerQuantity(row.original.qtyOut)}
					</span>
				),
				meta: {
					label: "Out Qty",
					exportable: true,
				},
			},
			{
				accessorKey: "balanceQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Balance Qty" />
				),
				cell: ({ row }) => (
					<span className="text-sm font-medium">
						{formatLedgerQuantity(row.original.balanceQty)}
					</span>
				),
				meta: {
					label: "Balance Qty",
					exportable: true,
				},
			},
			{
				accessorKey: "warehouse",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Warehouse" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.warehouse}
					</span>
				),
				meta: {
					label: "Warehouse",
					exportable: true,
				},
			},
			{
				accessorKey: "itemGroupName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Group" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{renderLedgerText(row.original.itemGroupName)}
					</span>
				),
				meta: {
					label: "Item Group",
					exportable: true,
				},
			},
			{
				accessorKey: "brandName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Brand" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{renderLedgerText(row.original.brandName)}
					</span>
				),
				meta: {
					label: "Brand",
					exportable: true,
				},
			},
			{
				accessorKey: "description",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Description" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{renderLedgerText(row.original.description)}
					</span>
				),
				meta: {
					label: "Description",
					exportable: true,
				},
			},
			{
				accessorKey: "basicRate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Incoming Rate" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatLedgerCurrency(row.original.basicRate, filters.currency)}
					</span>
				),
				meta: {
					label: "Incoming Rate",
					exportable: true,
				},
			},
			{
				accessorKey: "valuationRate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Avg Rate" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.valuationRate == null
							? "-"
							: formatLedgerCurrency(
									row.original.valuationRate,
									filters.currency,
								)}
					</span>
				),
				meta: {
					label: "Avg Rate",
					exportable: true,
				},
			},
			{
				accessorKey: "balanceValue",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Valuation" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.balanceValue == null
							? "-"
							: formatLedgerCurrency(
									row.original.balanceValue,
									filters.currency,
								)}
					</span>
				),
				meta: {
					label: "Valuation",
					exportable: true,
				},
			},
			{
				accessorKey: "stockEntryType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Voucher Type" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatStockLedgerType(row.original.stockEntryType)}
					</span>
				),
				meta: {
					label: "Voucher Type",
					exportable: true,
				},
			},
			{
				accessorKey: "voucherNo",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Voucher #" />
				),
				cell: ({ row }) => (
					<span className="font-medium">{row.original.voucherNo}</span>
				),
				meta: {
					label: "Voucher #",
					exportable: true,
				},
			},
		);

		if (showSerialBatchColumns) {
			ledgerColumns.push(
				{
					accessorKey: "batchNo",
					header: ({ column }) => (
						<DataTableColumnHeader column={column} title="Batch No" />
					),
					cell: ({ row }) => (
						<span className="text-sm text-muted-foreground">
							{renderLedgerText(row.original.batchNo)}
						</span>
					),
					meta: {
						label: "Batch No",
						exportable: true,
					},
				},
				{
					accessorKey: "serialNo",
					header: ({ column }) => (
						<DataTableColumnHeader column={column} title="Serial No" />
					),
					cell: ({ row }) => (
						<span className="text-sm text-muted-foreground">
							{renderLedgerText(row.original.serialNo)}
						</span>
					),
					meta: {
						label: "Serial No",
						exportable: true,
					},
				},
			);
		}

		ledgerColumns.push(
			{
				accessorKey: "project",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Project" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{renderLedgerText(row.original.project)}
					</span>
				),
				meta: {
					label: "Project",
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
					exportable: true,
				},
			},
			{
				id: "movementType",
				accessorKey: "movementType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Movement" />
				),
				cell: ({ row }) => (
					<MovementBadge movementType={row.original.movementType} />
				),
				meta: {
					label: "Movement",
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
					exportable: true,
				},
			},
			{
				id: "age",
				accessorFn: (row) => row.updatedAt,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Age" />
				),
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
			},
		);

		return ledgerColumns;
	}, [filters.currency, showSerialBatchColumns, showUom]);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<StockLedgerRow>({
		data: rows,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "postingDate", desc: true }],
		enableRowSelection: false,
		enableMultiRowSelection: false,
		enableGlobalFilter: false,
		onReload: handleReload,
		getRowId: (row) => row.id,
	});

	const hasActiveFilters = React.useMemo(
		() =>
			(Object.keys(INITIAL_FILTERS) as Array<keyof FilterState>).some(
				(key) => filters[key] !== INITIAL_FILTERS[key],
			),
		[filters],
	);

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<StockLedgerRealtimeSubscription
				onData={() => {
					void utils.inventory.listStockLedger.invalidate(listQueryInput);
				}}
			/>

			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Stock Ledger</h1>
					<p className="text-muted-foreground">
						Review stock movement history with voucher, brand, group, and
						valuation detail.
					</p>
				</div>
			</div>

			<div className="rounded-lg border bg-background p-4">
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
					<Input
						value={filters.company}
						onChange={(event) => updateFilter("company", event.target.value)}
						placeholder="Company"
						aria-label="Filter by company"
					/>
					<Input
						type="date"
						value={filters.dateFrom}
						onChange={(event) => updateFilter("dateFrom", event.target.value)}
						aria-label="Filter from date"
					/>
					<Input
						type="date"
						value={filters.dateTo}
						onChange={(event) => updateFilter("dateTo", event.target.value)}
						aria-label="Filter to date"
					/>
					<Input
						value={filters.warehouse}
						onChange={(event) => updateFilter("warehouse", event.target.value)}
						placeholder="Warehouse"
						aria-label="Filter by warehouse"
					/>
					<Input
						value={filters.itemCode}
						onChange={(event) => updateFilter("itemCode", event.target.value)}
						placeholder="Item"
						aria-label="Filter by item code"
					/>
					<Input
						value={filters.itemGroup}
						onChange={(event) => updateFilter("itemGroup", event.target.value)}
						placeholder="Item Group"
						aria-label="Filter by item group"
					/>
					<Select
						value={filters.status}
						onValueChange={(value) =>
							updateFilter(
								"status",
								value === "ALL" ? "" : (value as StockLedgerStatus),
							)
						}
					>
						<SelectTrigger aria-label="Filter by status">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">All Statuses</SelectItem>
							{STOCK_LEDGER_STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={filters.stockEntryType}
						onValueChange={(value) =>
							updateFilter(
								"stockEntryType",
								value === "ALL" ? "" : (value as StockLedgerType),
							)
						}
					>
						<SelectTrigger aria-label="Filter by stock entry type">
							<SelectValue placeholder="Entry Type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">All Types</SelectItem>
							{STOCK_LEDGER_TYPE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						value={filters.brand}
						onChange={(event) => updateFilter("brand", event.target.value)}
						placeholder="Brand"
						aria-label="Filter by brand"
					/>
					<Input
						value={filters.voucherNo}
						onChange={(event) => updateFilter("voucherNo", event.target.value)}
						placeholder="Voucher #"
						aria-label="Filter by voucher number"
					/>
					<Input
						value={filters.project}
						onChange={(event) => updateFilter("project", event.target.value)}
						placeholder="Project"
						aria-label="Filter by project"
					/>
					<Select
						value={filters.includeUom}
						onValueChange={(value) =>
							updateFilter("includeUom", value as UomDisplayPreference)
						}
					>
						<SelectTrigger aria-label="Include UOM">
							<SelectValue placeholder="Include UOM" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="INCLUDE">Include UOM</SelectItem>
							<SelectItem value="HIDE">Hide UOM</SelectItem>
						</SelectContent>
					</Select>
					<Select
						value={filters.currency}
						onValueChange={(value) =>
							updateFilter("currency", value as StockLedgerCurrency)
						}
					>
						<SelectTrigger aria-label="Currency">
							<SelectValue placeholder="Currency" />
						</SelectTrigger>
						<SelectContent>
							{STOCK_LEDGER_CURRENCY_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="flex items-center gap-2 text-sm text-foreground">
						<Checkbox
							checked={filters.segregateSerialBatchBundle}
							onCheckedChange={(checked) =>
								updateFilter("segregateSerialBatchBundle", checked === true)
							}
							aria-label="Segregate serial or batch bundle"
						/>
						<span>Segregate Serial / Batch Bundle</span>
					</div>
					<Button
						variant="outline"
						onClick={resetFilters}
						disabled={!hasActiveFilters}
					>
						Reset filters
					</Button>
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
					title="Failed to load stock ledger"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={rows}
					enableExport
					enableVirtualization
					enableColumnResizing
					enableBulkActions={false}
					enableGlobalSearch={false}
					ariaLabel="Stock ledger table"
				/>
			)}
		</div>
	);
}
