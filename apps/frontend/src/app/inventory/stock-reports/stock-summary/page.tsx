"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import {
	formatCompactDate,
	formatOptionalText,
	formatRelativeAge,
	formatStockSummaryHealth,
	formatStockSummaryMetric,
	formatStockSummaryQuantity,
	getStockSummaryBarWidth,
	getStockSummaryHealthClasses,
	STOCK_SUMMARY_METRIC_OPTIONS,
	type StockSummaryMetric,
	type StockSummaryRow,
} from "./stock-summary.utils";

type StockSummarySubscriptionEvent = {
	type: "created" | "updated" | "deleted";
	data: {
		id: string;
		company?: string | null;
		warehouses: string[];
		itemCodes: string[];
	};
};

type FilterState = {
	company: string;
	warehouse: string;
	itemCode: string;
	itemGroup: string;
	brand: string;
	metric: StockSummaryMetric;
	includeZeroStockItems: boolean;
};

const INITIAL_FILTERS: FilterState = {
	company: "",
	warehouse: "",
	itemCode: "",
	itemGroup: "",
	brand: "",
	metric: "PROJECTED_QTY",
	includeZeroStockItems: false,
};

function StockSummaryRealtimeSubscriptions({
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
	onData?: (event: StockSummarySubscriptionEvent) => void;
}) {
	trpc.inventory.onStockEntriesChanged.useSubscription(scope, {
		onData,
	});
	trpc.inventory.onMaterialRequestsChanged.useSubscription(scope, {
		onData,
	});
	trpc.inventory.onDeliveryNotesChanged.useSubscription(scope, {
		onData,
	});
	trpc.inventory.onPickListsChanged.useSubscription(scope, {
		onData,
	});

	return null;
}

function buildMoveActionHref(row: StockSummaryRow) {
	const searchParams = new URLSearchParams({
		itemCode: row.itemCode,
		warehouse: row.warehouse,
		stockEntryType: "MATERIAL_TRANSFER",
	});

	return `/inventory/stock-transaction/stock-entry/form?${searchParams.toString()}`;
}

function buildAddActionHref(row: StockSummaryRow) {
	const searchParams = new URLSearchParams({
		itemCode: row.itemCode,
		targetWarehouse: row.warehouse,
		purpose: "PURCHASE",
	});

	return `/inventory/stock-transaction/material-request/form?${searchParams.toString()}`;
}

export default function StockSummaryPage() {
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

		return {
			take: 250,
			company: company || undefined,
			warehouse: warehouse || undefined,
			itemCode: itemCode || undefined,
			itemGroup: itemGroup || undefined,
			brand: brand || undefined,
			metric: filters.metric,
			sortDirection: "desc" as const,
			includeZeroStockItems: filters.includeZeroStockItems,
		};
	}, [
		filters.brand,
		filters.company,
		filters.includeZeroStockItems,
		filters.itemCode,
		filters.itemGroup,
		filters.metric,
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
	} = trpc.inventory.listStockSummary.useQuery(listQueryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const rows = React.useMemo<StockSummaryRow[]>(
		() =>
			rawRows.map((row: (typeof rawRows)[number]) => ({
				...row,
				lastActivityDate: row.lastActivityDate
					? new Date(row.lastActivityDate)
					: null,
			})),
		[rawRows],
	);

	const selectedMetricLabel = React.useMemo(
		() => formatStockSummaryMetric(filters.metric),
		[filters.metric],
	);

	const maxMetricValue = React.useMemo(
		() =>
			rows.reduce(
				(maxValue, row) =>
					Math.max(
						maxValue,
						Math.abs(row.primaryMetricValue),
						Math.abs(row.shortageQty),
					),
				1,
			),
		[rows],
	);

	const columns = React.useMemo<ColumnDef<StockSummaryRow>[]>(() => {
		return [
			{
				accessorKey: "warehouse",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Warehouse" />
				),
				cell: ({ row }) => (
					<div>
						<div className="font-medium">{row.original.warehouse}</div>
						<div className="text-xs text-muted-foreground">
							{row.original.company}
						</div>
					</div>
				),
				meta: { label: "Warehouse", searchable: true, exportable: true },
			},
			{
				accessorKey: "itemCode",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item" />
				),
				cell: ({ row }) => (
					<div className="space-y-1">
						<div className="font-medium">{row.original.itemCode}</div>
						<div className="text-sm text-muted-foreground">
							{formatOptionalText(row.original.itemName)}
						</div>
						<div className="text-xs text-muted-foreground">
							{formatOptionalText(row.original.itemGroupName)}
						</div>
					</div>
				),
				meta: { label: "Item", searchable: true, exportable: true },
			},
			{
				accessorKey: "actualQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Actual Qty" />
				),
				cell: ({ row }) => formatStockSummaryQuantity(row.original.actualQty),
				meta: { label: "Actual Qty", exportable: true },
			},
			{
				accessorKey: "primaryMetricValue",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={selectedMetricLabel} />
				),
				cell: ({ row }) => (
					<div className="w-full min-w-40 max-w-56 space-y-1">
						<div className="flex items-center justify-between gap-3 text-sm">
							<span className="font-medium">
								{formatStockSummaryQuantity(row.original.primaryMetricValue)}
							</span>
							{row.original.shortageQty > 0 ? (
								<span className="text-xs text-muted-foreground">
									({formatStockSummaryQuantity(row.original.shortageQty)})
								</span>
							) : null}
						</div>
						<div className="h-2 overflow-hidden rounded-full bg-muted">
							<div
								className={cn(
									"h-full rounded-full transition-[width]",
									row.original.stockHealth === "CRITICAL"
										? "bg-red-500"
										: row.original.stockHealth === "LOW"
											? "bg-amber-500"
											: row.original.stockHealth === "SURPLUS"
												? "bg-sky-500"
												: "bg-emerald-500",
								)}
								style={{
									width: getStockSummaryBarWidth(
										row.original.primaryMetricValue,
										maxMetricValue,
									),
								}}
							/>
						</div>
					</div>
				),
				meta: { label: selectedMetricLabel, exportable: true },
			},
			{
				accessorKey: "stockHealth",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Health" />
				),
				cell: ({ row }) => (
					<span
						className={cn(
							"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
							getStockSummaryHealthClasses(row.original.stockHealth),
						)}
					>
						{formatStockSummaryHealth(row.original.stockHealth)}
					</span>
				),
				meta: { label: "Health", exportable: true },
			},
			{
				accessorKey: "lastActivityDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Last Activity" />
				),
				cell: ({ row }) => (
					<div className="space-y-1 text-sm text-muted-foreground">
						<div>{formatCompactDate(row.original.lastActivityDate)}</div>
						<div className="text-xs">
							{formatRelativeAge(row.original.lastActivityDate)}
						</div>
					</div>
				),
				meta: { label: "Last Activity", variant: "date", exportable: true },
			},
			{
				id: "actions",
				header: "Actions",
				cell: ({ row }) => (
					<div className="flex items-center justify-end gap-2">
						{row.original.recommendedAction === "MOVE_AND_ADD" ? (
							<Button variant="outline" size="sm" asChild>
								<Link href={buildMoveActionHref(row.original)}>Move</Link>
							</Button>
						) : null}
						<Button size="sm" asChild>
							<Link href={buildAddActionHref(row.original)}>Add</Link>
						</Button>
					</div>
				),
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
		];
	}, [maxMetricValue, selectedMetricLabel]);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<StockSummaryRow>({
		data: rows,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "primaryMetricValue", desc: true }],
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
				trpc.inventory.exportStockSummaryExcel as unknown as {
					mutate: (input: typeof listQueryInput) => Promise<Buffer>;
				}
			).mutate(listQueryInput);
			downloadExcelBuffer(buffer, `stock-summary-${Date.now()}.xlsx`);
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

	const totals = React.useMemo(
		() =>
			rows.reduce(
				(accumulator, row) => {
					accumulator.actualQty += row.actualQty;
					accumulator.projectedQty += row.projectedQty;
					accumulator.shortageQty += row.shortageQty;
					accumulator.atRiskItems +=
						row.stockHealth === "CRITICAL" || row.stockHealth === "LOW" ? 1 : 0;
					return accumulator;
				},
				{ actualQty: 0, projectedQty: 0, shortageQty: 0, atRiskItems: 0 },
			),
		[rows],
	);

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<StockSummaryRealtimeSubscriptions
				scope={realtimeScope}
				onData={() => {
					void utils.inventory.listStockSummary.invalidate(listQueryInput);
				}}
			/>

			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Stock Summary</h1>
					<p className="text-muted-foreground">
						Review item-wise warehouse stock posture, shortages, and the next
						operational action from a single queue.
					</p>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Actual Qty</div>
					<div className="mt-2 text-2xl font-semibold">
						{formatStockSummaryQuantity(totals.actualQty)}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Projected Qty</div>
					<div className="mt-2 text-2xl font-semibold">
						{formatStockSummaryQuantity(totals.projectedQty)}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Shortage Qty</div>
					<div className="mt-2 text-2xl font-semibold text-destructive">
						{formatStockSummaryQuantity(totals.shortageQty)}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">At-Risk Items</div>
					<div className="mt-2 text-2xl font-semibold">
						{totals.atRiskItems}
					</div>
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
					<Input
						value={filters.brand}
						onChange={(event) => updateFilter("brand", event.target.value)}
						placeholder="Brand"
						aria-label="Filter by brand"
					/>
					<Select
						value={filters.metric}
						onValueChange={(value) =>
							updateFilter("metric", value as StockSummaryMetric)
						}
					>
						<SelectTrigger aria-label="Primary stock metric">
							<SelectValue placeholder="Primary metric" />
						</SelectTrigger>
						<SelectContent>
							{STOCK_SUMMARY_METRIC_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
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
					title="Failed to load stock summary"
					onRetry={() => {
						void refetch();
					}}
				/>
			)}

			{!queryError && !isLoading && (
				<AdvancedDataTable
					table={table}
					data={rows}
					ariaLabel="Stock summary table"
					enableGlobalSearch={false}
					enableBulkActions={false}
					enableExport
					onExport={handleExport}
					enableColumnResizing
					enableVirtualization
					exportFormats={["csv", "excel", "json"]}
				/>
			)}
		</div>
	);
}
