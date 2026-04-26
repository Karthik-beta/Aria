"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { downloadExcelBuffer } from "@/components/advanced-data-table/utils";
import { Button } from "@/components/ui/button";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	buildStockAgeingChartData,
	classifyStockAgeingHealth,
	DEFAULT_STOCK_AGEING_RANGE_INPUT,
	formatCompactDate,
	formatOptionalText,
	formatStockAgeingBucketLabel,
	formatStockAgeingCurrency,
	formatStockAgeingHealth,
	formatStockAgeingQuantity,
	getBucketQuantity,
	getBucketValue,
	getStockAgeingHealthClasses,
	type StockAgeingRow,
	safeParseAgeingRangeInput,
} from "./stock-ageing.utils";

type StockAgeingSubscriptionEvent = {
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
	asOfDate: string;
	warehouse: string;
	itemCode: string;
	brand: string;
	ageingRanges: string;
	showWarehouseWiseStock: boolean;
};

function getCurrentDateInputValue(): string {
	return new Date().toISOString().slice(0, 10);
}

const INITIAL_FILTERS: FilterState = {
	company: "",
	asOfDate: getCurrentDateInputValue(),
	warehouse: "",
	itemCode: "",
	brand: "",
	ageingRanges: DEFAULT_STOCK_AGEING_RANGE_INPUT,
	showWarehouseWiseStock: false,
};

const chartConfig = {
	averageAge: {
		label: "Average age",
		color: "hsl(var(--chart-4))",
	},
} as const;

function StockAgeingRealtimeSubscription({
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
	onData?: (event: StockAgeingSubscriptionEvent) => void;
}) {
	trpc.inventory.onStockEntriesChanged.useSubscription(scope, {
		onData,
	});

	return null;
}

export default function StockAgeingPage() {
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

	const rangeValidation = React.useMemo(
		() => safeParseAgeingRangeInput(filters.ageingRanges),
		[filters.ageingRanges],
	);

	const listQueryInput = React.useMemo(() => {
		const company = filters.company.trim();
		const warehouse = filters.warehouse.trim();
		const itemCode = filters.itemCode.trim();
		const brand = filters.brand.trim();

		return {
			take: 250,
			company: company || undefined,
			warehouse: warehouse || undefined,
			itemCode: itemCode || undefined,
			brand: brand || undefined,
			asOfDate: filters.asOfDate
				? new Date(`${filters.asOfDate}T23:59:59.999Z`)
				: undefined,
			showWarehouseWiseStock: filters.showWarehouseWiseStock,
			ageingRanges: filters.ageingRanges.trim() || undefined,
		};
	}, [
		filters.ageingRanges,
		filters.asOfDate,
		filters.brand,
		filters.company,
		filters.itemCode,
		filters.showWarehouseWiseStock,
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
	} = trpc.inventory.listStockAgeing.useQuery(listQueryInput, {
		enabled: rangeValidation.error == null,
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const rows = React.useMemo<StockAgeingRow[]>(
		() =>
			rawRows.map((row: (typeof rawRows)[number]) => ({
				...row,
				asOfDate: new Date(row.asOfDate),
			})),
		[rawRows],
	);

	const columns = React.useMemo<ColumnDef<StockAgeingRow>[]>(() => {
		const ageingColumns: ColumnDef<StockAgeingRow>[] = [
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
							{formatOptionalText(row.original.description)}
						</div>
					</div>
				),
				meta: { label: "Item", searchable: true, exportable: true },
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
				accessorKey: "brandName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Brand" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatOptionalText(row.original.brandName)}
					</span>
				),
				meta: { label: "Brand", exportable: true },
			},
		];

		if (filters.showWarehouseWiseStock) {
			ageingColumns.push({
				accessorKey: "warehouse",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Warehouse" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatOptionalText(row.original.warehouse)}
					</span>
				),
				meta: { label: "Warehouse", exportable: true },
			});
		}

		ageingColumns.push(
			{
				accessorKey: "availableQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Available Qty" />
				),
				cell: ({ row }) => (
					<span className="font-medium">
						{formatStockAgeingQuantity(row.original.availableQty)}
					</span>
				),
				meta: { label: "Available Qty", exportable: true },
			},
			{
				accessorKey: "averageAge",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Average Age" />
				),
				cell: ({ row }) => {
					const health = classifyStockAgeingHealth(row.original.averageAge);

					return (
						<div className="space-y-1">
							<div className="font-medium">
								{formatStockAgeingQuantity(row.original.averageAge)}
							</div>
							<span
								className={cn(
									"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
									getStockAgeingHealthClasses(health),
								)}
							>
								{formatStockAgeingHealth(health)}
							</span>
						</div>
					);
				},
				meta: { label: "Average Age", exportable: true },
			},
		);

		for (const [index] of rangeValidation.ranges.entries()) {
			ageingColumns.push(
				{
					id: `bucket-qty-${index}`,
					accessorFn: (row) => getBucketQuantity(row, index),
					header: ({ column }) => (
						<DataTableColumnHeader
							column={column}
							title={`Age (${formatStockAgeingBucketLabel(
								rows[0]?.buckets[index] ?? {
									index,
									minAge:
										index === 0 ? 0 : rangeValidation.ranges[index - 1] + 1,
									maxAge: rangeValidation.ranges[index],
									quantity: 0,
									value: 0,
								},
							)})`}
						/>
					),
					cell: ({ row }) =>
						formatStockAgeingQuantity(getBucketQuantity(row.original, index)),
					meta: {
						label: `Age (${index + 1})`,
						exportable: true,
					},
				},
				{
					id: `bucket-value-${index}`,
					accessorFn: (row) => getBucketValue(row, index),
					header: ({ column }) => (
						<DataTableColumnHeader
							column={column}
							title={`Value (${formatStockAgeingBucketLabel(
								rows[0]?.buckets[index] ?? {
									index,
									minAge:
										index === 0 ? 0 : rangeValidation.ranges[index - 1] + 1,
									maxAge: rangeValidation.ranges[index],
									quantity: 0,
									value: 0,
								},
							)})`}
						/>
					),
					cell: ({ row }) =>
						formatStockAgeingQuantity(getBucketValue(row.original, index)),
					meta: {
						label: `Value (${index + 1})`,
						exportable: true,
					},
				},
			);
		}

		const overflowIndex = rangeValidation.ranges.length;
		const overflowBucket = rows[0]?.buckets[overflowIndex] ?? {
			index: overflowIndex,
			minAge: rangeValidation.ranges[rangeValidation.ranges.length - 1] + 1,
			maxAge: null,
			quantity: 0,
			value: 0,
		};

		ageingColumns.push(
			{
				id: `bucket-qty-${overflowIndex}`,
				accessorFn: (row) => getBucketQuantity(row, overflowIndex),
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title={`Age (${formatStockAgeingBucketLabel(overflowBucket)})`}
					/>
				),
				cell: ({ row }) =>
					formatStockAgeingQuantity(
						getBucketQuantity(row.original, overflowIndex),
					),
				meta: {
					label: `Age (${formatStockAgeingBucketLabel(overflowBucket)})`,
					exportable: true,
				},
			},
			{
				id: `bucket-value-${overflowIndex}`,
				accessorFn: (row) => getBucketValue(row, overflowIndex),
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title={`Value (${formatStockAgeingBucketLabel(overflowBucket)})`}
					/>
				),
				cell: ({ row }) =>
					formatStockAgeingQuantity(
						getBucketValue(row.original, overflowIndex),
					),
				meta: {
					label: `Value (${formatStockAgeingBucketLabel(overflowBucket)})`,
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
				meta: { label: "Company", exportable: true },
			},
		);

		return ageingColumns;
	}, [filters.showWarehouseWiseStock, rangeValidation.ranges, rows]);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<StockAgeingRow>({
		data: rows,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "averageAge", desc: true }],
		enableRowSelection: false,
		enableMultiRowSelection: false,
		enableGlobalFilter: false,
		onReload: handleReload,
		getRowId: (row) => row.id,
	});

	const exportStockAgeingExcel =
		trpc.inventory.exportStockAgeingExcel.useMutation();

	const handleExport = React.useCallback(
		async (format: string, _rows: readonly Row<StockAgeingRow>[]) => {
			if (format !== "excel") return;
			const buffer = (await exportStockAgeingExcel.mutateAsync(
				listQueryInput,
			)) as ArrayBuffer;
			downloadExcelBuffer(buffer, `stock-ageing-${Date.now()}.xlsx`);
		},
		[listQueryInput, exportStockAgeingExcel],
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
					accumulator.availableQty += row.availableQty;
					accumulator.totalValue += row.buckets.reduce(
						(sum, bucket) => sum + bucket.value,
						0,
					);
					accumulator.weightedAge += row.availableQty * row.averageAge;
					accumulator.agedItems +=
						classifyStockAgeingHealth(row.averageAge) === "AGED" ||
						classifyStockAgeingHealth(row.averageAge) === "OBSOLETE"
							? 1
							: 0;
					return accumulator;
				},
				{ availableQty: 0, totalValue: 0, weightedAge: 0, agedItems: 0 },
			),
		[rows],
	);

	const chartData = React.useMemo(
		() => buildStockAgeingChartData(rows),
		[rows],
	);
	const weightedAverageAge =
		totals.availableQty > 0 ? totals.weightedAge / totals.availableQty : 0;

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<StockAgeingRealtimeSubscription
				scope={realtimeScope}
				onData={() => {
					void utils.inventory.listStockAgeing.invalidate(listQueryInput);
				}}
			/>

			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Stock Ageing</h1>
					<p className="text-muted-foreground">
						Track FIFO-aged stock by item, warehouse, and bucketed holding
						periods as of a selected date.
					</p>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Available Qty</div>
					<div className="mt-2 text-2xl font-semibold">
						{formatStockAgeingQuantity(totals.availableQty)}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Weighted Avg Age</div>
					<div className="mt-2 text-2xl font-semibold">
						{formatStockAgeingQuantity(weightedAverageAge)}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Stock Value</div>
					<div className="mt-2 text-2xl font-semibold">
						{formatStockAgeingCurrency(totals.totalValue)}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Aged Items</div>
					<div className="mt-2 text-2xl font-semibold">{totals.agedItems}</div>
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
						value={filters.asOfDate}
						onChange={(event) => updateFilter("asOfDate", event.target.value)}
						aria-label="Filter by report date"
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
						value={filters.brand}
						onChange={(event) => updateFilter("brand", event.target.value)}
						placeholder="Brand"
						aria-label="Filter by brand"
					/>
					<Input
						value={filters.ageingRanges}
						onChange={(event) =>
							updateFilter("ageingRanges", event.target.value)
						}
						placeholder="30, 60, 90"
						aria-label="Filter by ageing ranges"
					/>
				</div>

				<div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-sm text-foreground">
							<Checkbox
								checked={filters.showWarehouseWiseStock}
								onCheckedChange={(checked) =>
									updateFilter("showWarehouseWiseStock", checked === true)
								}
								aria-label="Show warehouse-wise stock"
							/>
							<span>Show Warehouse-wise Stock</span>
						</div>
						<p className="text-xs text-muted-foreground">
							Use comma-separated day breaks such as `30, 60, 90`.
						</p>
						{rangeValidation.error ? (
							<p className="text-xs text-destructive">
								{rangeValidation.error}
							</p>
						) : null}
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

			{chartData.length > 0 &&
			!isLoading &&
			!queryError &&
			!rangeValidation.error ? (
				<div className="rounded-lg border bg-background p-4">
					<div className="mb-4">
						<h2 className="text-lg font-semibold">Oldest Available Stock</h2>
						<p className="text-sm text-muted-foreground">
							Top items ranked by weighted average age.
						</p>
					</div>
					<ChartContainer
						config={chartConfig}
						className="h-[320px] w-full min-w-0 min-h-[320px]"
					>
						<BarChart data={chartData}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="label"
								tickLine={false}
								axisLine={false}
								interval={0}
								tickMargin={8}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								tickFormatter={(value: number) => Math.round(value).toString()}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										formatter={(value, _name, item) => {
											if (item.dataKey === "averageAge") {
												return formatStockAgeingQuantity(Number(value));
											}
											return value;
										}}
									/>
								}
							/>
							<Bar
								dataKey="averageAge"
								fill="var(--color-averageAge)"
								radius={[6, 6, 0, 0]}
							/>
						</BarChart>
					</ChartContainer>
				</div>
			) : null}

			{isLoading && (
				<div className="flex items-center justify-center py-12">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
				</div>
			)}

			{queryError && !isLoading && (
				<ErrorState
					error={queryError}
					operation="load"
					title="Failed to load stock ageing"
					onRetry={() => {
						void refetch();
					}}
				/>
			)}

			{!queryError && !isLoading && !rangeValidation.error && (
				<AdvancedDataTable
					table={table}
					data={rows}
					ariaLabel="Stock ageing table"
					enableGlobalSearch={false}
					enableBulkActions={false}
					enableExport
					enableColumnResizing
					enableVirtualization
					exportFormats={["csv", "excel", "json"]}
					onExport={handleExport}
				/>
			)}

			{!queryError &&
			!isLoading &&
			rows.length > 0 &&
			!rangeValidation.error ? (
				<div className="text-right text-xs text-muted-foreground">
					As of {formatCompactDate(rows[0]?.asOfDate)}
				</div>
			) : null}
		</div>
	);
}
