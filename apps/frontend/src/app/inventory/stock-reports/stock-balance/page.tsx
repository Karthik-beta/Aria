"use client";

import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { downloadExcelBuffer } from "@/components/advanced-data-table/utils";
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
import {
	formatCompactDate,
	formatOptionalText,
	formatRelativeAge,
	formatStockBalanceCurrency,
	formatStockBalanceQuantity,
	STOCK_BALANCE_CURRENCY_OPTIONS,
	STOCK_BALANCE_STATUS_OPTIONS,
	type StockBalanceCurrency,
	type StockBalanceRow,
	type StockBalanceStatus,
} from "./stock-balance.utils";

type StockBalanceSubscriptionEvent = {
	type: "created" | "updated" | "deleted";
	data: {
		id: string;
		company?: string | null;
		warehouses: string[];
		itemCodes: string[];
	};
};

type UomDisplayPreference = "INCLUDE" | "HIDE";

type FilterState = {
	company: string;
	dateFrom: string;
	dateTo: string;
	itemGroup: string;
	itemCode: string;
	warehouse: string;
	brand: string;
	project: string;
	status: StockBalanceStatus;
	includeUom: UomDisplayPreference;
	currency: StockBalanceCurrency;
	includeZeroStockItems: boolean;
};

const INITIAL_FILTERS: FilterState = {
	company: "",
	dateFrom: "",
	dateTo: "",
	itemGroup: "",
	itemCode: "",
	warehouse: "",
	brand: "",
	project: "",
	status: "SUBMITTED",
	includeUom: "INCLUDE",
	currency: "INR",
	includeZeroStockItems: false,
};

function StockBalanceRealtimeSubscription({
	scope,
	onData,
}: {
	scope:
		| {
				company?: string;
				warehouse?: string;
				itemCode?: string;
		  }
		| undefined;
	onData?: (event: StockBalanceSubscriptionEvent) => void;
}) {
	trpc.inventory.onStockEntriesChanged.useSubscription(scope, {
		onData,
	});

	return null;
}

export default function StockBalancePage() {
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
		const project = filters.project.trim();

		return {
			take: 250,
			status: filters.status,
			company: company || undefined,
			warehouse: warehouse || undefined,
			itemCode: itemCode || undefined,
			itemGroup: itemGroup || undefined,
			brand: brand || undefined,
			project: project || undefined,
			dateFrom: filters.dateFrom
				? new Date(`${filters.dateFrom}T00:00:00.000Z`)
				: undefined,
			dateTo: filters.dateTo
				? new Date(`${filters.dateTo}T23:59:59.999Z`)
				: undefined,
			includeZeroStockItems: filters.includeZeroStockItems,
		};
	}, [
		filters.brand,
		filters.company,
		filters.dateFrom,
		filters.dateTo,
		filters.includeZeroStockItems,
		filters.itemCode,
		filters.itemGroup,
		filters.project,
		filters.status,
		filters.warehouse,
	]);

	const realtimeScope = React.useMemo(
		() => ({
			company: listQueryInput.company,
			warehouse: listQueryInput.warehouse,
			itemCode: listQueryInput.itemCode,
		}),
		[listQueryInput.company, listQueryInput.itemCode, listQueryInput.warehouse],
	);

	const {
		data: rawRows = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listStockBalance.useQuery(listQueryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const rows = React.useMemo<StockBalanceRow[]>(
		() =>
			rawRows.map((row: (typeof rawRows)[number]) => ({
				...row,
				lastPostingDate: row.lastPostingDate
					? new Date(row.lastPostingDate)
					: null,
			})),
		[rawRows],
	);

	const showUom = filters.includeUom === "INCLUDE";

	const columns = React.useMemo<ColumnDef<StockBalanceRow>[]>(() => {
		const balanceColumns: ColumnDef<StockBalanceRow>[] = [
			{
				accessorKey: "itemCode",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item" />
				),
				cell: ({ row }) => (
					<span className="font-medium">{row.original.itemCode}</span>
				),
				meta: { label: "Item", searchable: true, exportable: true },
			},
			{
				accessorKey: "itemName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Name" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatOptionalText(row.original.itemName)}
					</span>
				),
				meta: { label: "Item Name", exportable: true },
			},
			{
				accessorKey: "itemGroupName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Group" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatOptionalText(row.original.itemGroupName)}
					</span>
				),
				meta: { label: "Item Group", exportable: true },
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
				meta: { label: "Warehouse", exportable: true },
			},
		];

		if (showUom) {
			balanceColumns.push({
				accessorKey: "unitOfMeasure",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Stock UOM" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatOptionalText(row.original.unitOfMeasure)}
					</span>
				),
				meta: { label: "Stock UOM", exportable: true },
			});
		}

		balanceColumns.push(
			{
				accessorKey: "openingQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Opening Qty" />
				),
				cell: ({ row }) => formatStockBalanceQuantity(row.original.openingQty),
				meta: { label: "Opening Qty", exportable: true },
			},
			{
				accessorKey: "openingValue",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Opening Value" />
				),
				cell: ({ row }) =>
					formatStockBalanceCurrency(
						row.original.openingValue,
						filters.currency,
					),
				meta: { label: "Opening Value", exportable: true },
			},
			{
				accessorKey: "inQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="In Qty" />
				),
				cell: ({ row }) => (
					<span className="text-emerald-700 dark:text-emerald-300">
						{formatStockBalanceQuantity(row.original.inQty)}
					</span>
				),
				meta: { label: "In Qty", exportable: true },
			},
			{
				accessorKey: "inValue",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="In Value" />
				),
				cell: ({ row }) => (
					<span className="text-emerald-700 dark:text-emerald-300">
						{formatStockBalanceCurrency(row.original.inValue, filters.currency)}
					</span>
				),
				meta: { label: "In Value", exportable: true },
			},
			{
				accessorKey: "outQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Out Qty" />
				),
				cell: ({ row }) => (
					<span className="text-amber-700 dark:text-amber-300">
						{formatStockBalanceQuantity(row.original.outQty)}
					</span>
				),
				meta: { label: "Out Qty", exportable: true },
			},
			{
				accessorKey: "outValue",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Out Value" />
				),
				cell: ({ row }) => (
					<span className="text-amber-700 dark:text-amber-300">
						{formatStockBalanceCurrency(
							row.original.outValue,
							filters.currency,
						)}
					</span>
				),
				meta: { label: "Out Value", exportable: true },
			},
			{
				accessorKey: "balanceQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Balance Qty" />
				),
				cell: ({ row }) => (
					<span className="font-medium">
						{formatStockBalanceQuantity(row.original.balanceQty)}
					</span>
				),
				meta: { label: "Balance Qty", exportable: true },
			},
			{
				accessorKey: "valuationRate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Avg Rate" />
				),
				cell: ({ row }) =>
					row.original.valuationRate == null
						? "-"
						: formatStockBalanceCurrency(
								row.original.valuationRate,
								filters.currency,
							),
				meta: { label: "Avg Rate", exportable: true },
			},
			{
				accessorKey: "balanceValue",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Valuation" />
				),
				cell: ({ row }) =>
					row.original.balanceValue == null
						? "-"
						: formatStockBalanceCurrency(
								row.original.balanceValue,
								filters.currency,
							),
				meta: { label: "Valuation", exportable: true },
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
				meta: { label: "Company", exportable: true },
			},
			{
				accessorKey: "lastPostingDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Last Movement" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatCompactDate(row.original.lastPostingDate)}
					</span>
				),
				meta: { label: "Last Movement", variant: "date", exportable: true },
			},
			{
				id: "age",
				accessorFn: (row) => row.lastPostingDate,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Age" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatRelativeAge(row.original.lastPostingDate)}
					</span>
				),
				meta: { label: "Age", variant: "date", exportable: true },
			},
		);

		return balanceColumns;
	}, [filters.currency, showUom]);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<StockBalanceRow>({
		data: rows,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "balanceValue", desc: true }],
		enableRowSelection: false,
		enableMultiRowSelection: false,
		enableGlobalFilter: false,
		onReload: handleReload,
		getRowId: (row) => row.id,
	});

	const handleExport = React.useCallback(
		async (format: string) => {
			if (format !== "excel") return;
			const buffer = await (
				trpc.inventory.exportStockBalanceExcel as unknown as {
					mutate: (input: typeof listQueryInput) => Promise<Buffer>;
				}
			).mutate(listQueryInput);
			downloadExcelBuffer(buffer, `stock-balance-${Date.now()}.xlsx`);
		},
		[listQueryInput],
	);

	const hasActiveFilters = React.useMemo(
		() =>
			(Object.keys(INITIAL_FILTERS) as Array<keyof FilterState>).some(
				(key) => filters[key] !== INITIAL_FILTERS[key],
			),
		[filters],
	);

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<StockBalanceRealtimeSubscription
				scope={realtimeScope}
				onData={() => {
					void utils.inventory.listStockBalance.invalidate(listQueryInput);
				}}
			/>

			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Stock Balance</h1>
					<p className="text-muted-foreground">
						Review opening, inward, outward, and closing stock by item and
						warehouse.
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
						value={filters.itemGroup}
						onChange={(event) => updateFilter("itemGroup", event.target.value)}
						placeholder="Item Group"
						aria-label="Filter by item group"
					/>
					<Input
						value={filters.itemCode}
						onChange={(event) => updateFilter("itemCode", event.target.value)}
						placeholder="Item"
						aria-label="Filter by item code"
					/>
					<Input
						value={filters.warehouse}
						onChange={(event) => updateFilter("warehouse", event.target.value)}
						placeholder="Warehouse"
						aria-label="Filter by warehouse"
					/>
					<Input
						value={filters.brand}
						onChange={(event) => updateFilter("brand", event.target.value)}
						placeholder="Brand"
						aria-label="Filter by brand"
					/>
					<Input
						value={filters.project}
						onChange={(event) => updateFilter("project", event.target.value)}
						placeholder="Project"
						aria-label="Filter by project"
					/>
					<Select
						value={filters.status}
						onValueChange={(value) =>
							updateFilter("status", value as StockBalanceStatus)
						}
					>
						<SelectTrigger aria-label="Filter by status">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							{STOCK_BALANCE_STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
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
							updateFilter("currency", value as StockBalanceCurrency)
						}
					>
						<SelectTrigger aria-label="Currency">
							<SelectValue placeholder="Currency" />
						</SelectTrigger>
						<SelectContent>
							{STOCK_BALANCE_CURRENCY_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
						<div className="flex items-center gap-2 text-sm text-foreground">
							<Checkbox
								checked={filters.includeZeroStockItems}
								onCheckedChange={(checked) =>
									updateFilter("includeZeroStockItems", checked === true)
								}
								aria-label="Include zero stock items"
							/>
							<span>Include Zero Stock Items</span>
						</div>
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
					title="Failed to load stock balance"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={rows}
					enableExport
					onExport={handleExport}
					enableVirtualization
					enableColumnResizing
					enableBulkActions={false}
					enableGlobalSearch={false}
					ariaLabel="Stock balance table"
				/>
			)}
		</div>
	);
}
