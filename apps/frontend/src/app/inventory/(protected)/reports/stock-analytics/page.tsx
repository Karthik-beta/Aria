"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import * as React from "react";
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
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
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { trpc } from "@/lib/trpc";
import {
	buildChartData,
	FREQUENCY_OPTIONS,
	formatOptionalText,
	formatPeriodValue,
	getDefaultFromDate,
	getDefaultToDate,
	getSeriesColor,
	type StockAnalyticsPeriod,
	type StockAnalyticsRangeFrequency,
	type StockAnalyticsRow,
	type StockAnalyticsValueQuantity,
	VALUE_QUANTITY_OPTIONS,
} from "./stock-analytics.utils";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type FilterState = {
	company: string;
	fromDate: string;
	toDate: string;
	frequency: StockAnalyticsRangeFrequency;
	valueQuantity: StockAnalyticsValueQuantity;
	warehouse: string;
	itemCode: string;
	itemGroup: string;
	brand: string;
};

const INITIAL_FILTERS: FilterState = {
	company: "",
	fromDate: getDefaultFromDate(),
	toDate: getDefaultToDate(),
	frequency: "Monthly",
	valueQuantity: "Quantity",
	warehouse: "",
	itemCode: "",
	itemGroup: "",
	brand: "",
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFilters(filters: FilterState): string | null {
	if (!filters.fromDate) return "From Date is required.";
	if (!filters.toDate) return "To Date is required.";
	if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
		return "From Date must not be later than To Date.";
	}
	return null;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function StockAnalyticsPage() {
	const [filters, setFilters] = React.useState<FilterState>({
		...INITIAL_FILTERS,
	});

	const [selectedItems, setSelectedItems] = React.useState<Set<string>>(
		new Set(),
	);

	const updateFilter = React.useCallback(
		<Key extends keyof FilterState>(key: Key, value: FilterState[Key]) => {
			setFilters((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	const resetFilters = React.useCallback(() => {
		setFilters({ ...INITIAL_FILTERS });
		setSelectedItems(new Set());
	}, []);

	const validationError = React.useMemo(
		() => validateFilters(filters),
		[filters],
	);

	const queryInput = React.useMemo(() => {
		if (validationError) return null;

		return {
			fromDate: new Date(`${filters.fromDate}T00:00:00.000Z`),
			toDate: new Date(`${filters.toDate}T23:59:59.999Z`),
			frequency: filters.frequency,
			valueQuantity: filters.valueQuantity,
			company: filters.company.trim() || undefined,
			warehouse: filters.warehouse.trim() || undefined,
			itemCode: filters.itemCode.trim() || undefined,
			itemGroup: filters.itemGroup.trim() || undefined,
			brand: filters.brand.trim() || undefined,
		};
	}, [
		validationError,
		filters.fromDate,
		filters.toDate,
		filters.frequency,
		filters.valueQuantity,
		filters.company,
		filters.warehouse,
		filters.itemCode,
		filters.itemGroup,
		filters.brand,
	]);

	const {
		data: result,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listStockAnalytics.useQuery(
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled
		queryInput!,
		{
			enabled: queryInput != null,
			refetchOnWindowFocus: false,
			retry: 2,
			staleTime: 60_000,
		},
	);

	const rows: StockAnalyticsRow[] = React.useMemo(
		() => result?.rows ?? [],
		[result],
	);

	const periods: StockAnalyticsPeriod[] = React.useMemo(
		() =>
			(result?.periods ?? []).map((p) => ({
				...p,
				from: new Date(p.from),
				to: new Date(p.to),
			})),
		[result],
	);

	// Auto-select the first item when data loads (mirrors ERPNext default)
	const hasAutoSelected = React.useRef(false);
	React.useEffect(() => {
		if (rows.length > 0 && !hasAutoSelected.current) {
			setSelectedItems(new Set([rows[0].itemCode]));
			hasAutoSelected.current = true;
		}
		if (rows.length === 0) {
			hasAutoSelected.current = false;
		}
	}, [rows]);

	// Reset auto-select flag when filters change so the first item of new
	// results gets auto-selected again
	const queryInputKey = JSON.stringify(queryInput);
	// biome-ignore lint/correctness/useExhaustiveDependencies: queryInputKey is a stable serialized representation of queryInput
	React.useEffect(() => {
		hasAutoSelected.current = false;
		setSelectedItems(new Set());
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [queryInputKey]);

	const toggleItem = React.useCallback((itemCode: string) => {
		setSelectedItems((prev) => {
			const next = new Set(prev);
			if (next.has(itemCode)) {
				next.delete(itemCode);
			} else {
				next.add(itemCode);
			}
			return next;
		});
	}, []);

	// ---------------------------------------------------------------------------
	// Columns – fixed + dynamic period columns
	// ---------------------------------------------------------------------------

	const columns = React.useMemo<ColumnDef<StockAnalyticsRow>[]>(() => {
		const fixed: ColumnDef<StockAnalyticsRow>[] = [
			{
				id: "select",
				header: () => null,
				cell: ({ row }) => (
					<Checkbox
						checked={selectedItems.has(row.original.itemCode)}
						onCheckedChange={() => toggleItem(row.original.itemCode)}
						aria-label={`Toggle ${row.original.itemCode} in chart`}
					/>
				),
				enableSorting: false,
				enableHiding: false,
				size: 40,
			},
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
				accessorKey: "itemGroup",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Group" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatOptionalText(row.original.itemGroup)}
					</span>
				),
				meta: { label: "Item Group", exportable: true },
			},
			{
				accessorKey: "brand",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Brand" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatOptionalText(row.original.brand)}
					</span>
				),
				meta: { label: "Brand", exportable: true },
			},
			{
				accessorKey: "unitOfMeasure",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="UOM" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatOptionalText(row.original.unitOfMeasure)}
					</span>
				),
				meta: { label: "UOM", exportable: true },
			},
		];

		const periodCols: ColumnDef<StockAnalyticsRow>[] = periods.map(
			(period) => ({
				id: `period_${period.key}`,
				accessorFn: (row) => row.periodValues[period.key] ?? null,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={period.label} />
				),
				cell: ({ row }) => {
					const value = row.original.periodValues[period.key];
					return (
						<span
							className={
								value == null
									? "text-sm text-muted-foreground/40"
									: "text-sm font-medium tabular-nums"
							}
						>
							{formatPeriodValue(value, filters.valueQuantity)}
						</span>
					);
				},
				meta: { label: period.label, exportable: true },
			}),
		);

		return [...fixed, ...periodCols];
	}, [periods, filters.valueQuantity, selectedItems, toggleItem]);

	// ---------------------------------------------------------------------------
	// Chart data
	// ---------------------------------------------------------------------------

	const chartData = React.useMemo(
		() => buildChartData(selectedItems, rows, periods),
		[selectedItems, rows, periods],
	);

	const selectedRows = React.useMemo(
		() => rows.filter((r) => selectedItems.has(r.itemCode)),
		[rows, selectedItems],
	);

	// ---------------------------------------------------------------------------
	// Table
	// ---------------------------------------------------------------------------

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<StockAnalyticsRow>({
		data: rows,
		columns,
		initialPageSize: 50,
		initialSorting: [{ id: "itemCode", desc: false }],
		enableRowSelection: false,
		enableMultiRowSelection: false,
		enableGlobalFilter: false,
		onReload: handleReload,
		getRowId: (row) => row.id,
	});

	const exportStockAnalyticsExcel =
		trpc.inventory.exportStockAnalyticsExcel.useMutation();

	const handleExport = React.useCallback(
		async (_format: string, _rows: readonly Row<StockAnalyticsRow>[]) => {
			if (!queryInput) return;
			const buffer = (await exportStockAnalyticsExcel.mutateAsync(
				queryInput,
			)) as string;
			downloadExcelBuffer(buffer, `stock-analytics-${Date.now()}.xlsx`);
		},
		[queryInput, exportStockAnalyticsExcel],
	);

	const hasActiveFilters = React.useMemo(
		() =>
			(Object.keys(INITIAL_FILTERS) as Array<keyof FilterState>).some(
				(key) => filters[key] !== INITIAL_FILTERS[key],
			),
		[filters],
	);

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			{/* Header */}
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Stock Analytics</h1>
					<p className="text-muted-foreground">
						Track cumulative stock balances across time periods. Select items in
						the table to compare trends in the chart.
					</p>
				</div>
			</div>

			{/* Filters */}
			<search className="rounded-lg border bg-background p-4">
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
						placeholder="Item code"
						aria-label="Filter by item code"
					/>
					<Input
						value={filters.itemGroup}
						onChange={(event) => updateFilter("itemGroup", event.target.value)}
						placeholder="Item group"
						aria-label="Filter by item group"
					/>
					<Input
						value={filters.brand}
						onChange={(event) => updateFilter("brand", event.target.value)}
						placeholder="Brand"
						aria-label="Filter by brand"
					/>
					<Input
						type="date"
						value={filters.fromDate}
						onChange={(event) => updateFilter("fromDate", event.target.value)}
						aria-label="From date"
					/>
					<Input
						type="date"
						value={filters.toDate}
						onChange={(event) => updateFilter("toDate", event.target.value)}
						aria-label="To date"
					/>
					<Select
						value={filters.frequency}
						onValueChange={(value) =>
							updateFilter("frequency", value as StockAnalyticsRangeFrequency)
						}
					>
						<SelectTrigger aria-label="Select range frequency">
							<SelectValue placeholder="Range" />
						</SelectTrigger>
						<SelectContent>
							{FREQUENCY_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="flex items-center gap-3">
						<span className="text-sm text-muted-foreground">Show as:</span>
						{VALUE_QUANTITY_OPTIONS.map((opt) => (
							<label
								key={opt.value}
								className="flex cursor-pointer items-center gap-1.5 text-sm"
							>
								<input
									type="radio"
									name="valueQuantity"
									value={opt.value}
									checked={filters.valueQuantity === opt.value}
									onChange={() =>
										updateFilter(
											"valueQuantity",
											opt.value as StockAnalyticsValueQuantity,
										)
									}
									className="accent-primary"
								/>
								{opt.label}
							</label>
						))}
					</div>
					<Button
						variant="outline"
						onClick={resetFilters}
						disabled={!hasActiveFilters}
					>
						Reset filters
					</Button>
				</div>

				{validationError ? (
					<p className="mt-2 text-sm text-destructive" role="alert">
						{validationError}
					</p>
				) : null}
			</search>

			{/* Line chart */}
			{!validationError &&
			!isLoading &&
			!queryError &&
			selectedRows.length > 0 &&
			periods.length > 0 ? (
				<section
					className="rounded-lg border bg-background p-4"
					aria-label="Stock trend line chart"
				>
					<div className="mb-4">
						<h2 className="text-lg font-semibold">Stock Trend</h2>
						<p className="text-sm text-muted-foreground">
							Cumulative{" "}
							{filters.valueQuantity === "Quantity" ? "quantity" : "value"}{" "}
							balance per period for selected items.
						</p>
					</div>
					<div className="h-[320px] w-full min-w-0 min-h-[320px]">
						<ResponsiveContainer
							width="100%"
							height="100%"
							minWidth={0}
							minHeight={320}
						>
							<LineChart
								data={chartData}
								margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
							>
								<CartesianGrid strokeDasharray="3 3" vertical={false} />
								<XAxis
									dataKey="label"
									tickLine={false}
									axisLine={false}
									tick={{ fontSize: 12 }}
									interval="preserveStartEnd"
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									tick={{ fontSize: 12 }}
									tickFormatter={(v: number) =>
										filters.valueQuantity === "Value"
											? `₹${Math.round(v / 1000)}k`
											: String(Math.round(v))
									}
									width={60}
								/>
								<Tooltip
									formatter={(value, name) => [
										formatPeriodValue(value as number, filters.valueQuantity),
										name,
									]}
									labelStyle={{ fontWeight: 600 }}
								/>
								<Legend />
								{selectedRows.map((row, index) => (
									<Line
										key={row.itemCode}
										type="monotone"
										dataKey={row.itemCode}
										name={row.itemName ?? row.itemCode}
										stroke={getSeriesColor(index)}
										strokeWidth={2}
										dot={false}
										connectNulls={false}
									/>
								))}
							</LineChart>
						</ResponsiveContainer>
					</div>
				</section>
			) : null}

			{/* Loading state */}
			{isLoading && (
				<div className="flex flex-col gap-4">
					<div className="rounded-lg border bg-background p-4">
						<div className="mb-4">
							<Skeleton className="h-5 w-48 mb-1" />
							<Skeleton className="h-4 w-64" />
						</div>
						<Skeleton className="h-[320px] w-full rounded-md" />
					</div>
					<DataTableSkeleton columnCount={7} rowCount={10} filterCount={0} />
				</div>
			)}

			{/* Error state */}
			{!isLoading && queryError && (
				<ErrorState
					title="Failed to load Stock Analytics"
					error={queryError}
					operation="load"
					onRetry={() => void refetch()}
				/>
			)}

			{/* Table */}
			{!isLoading && !queryError && !validationError && rows.length === 0 && (
				<div className="flex flex-col items-center justify-center rounded-lg border bg-background py-16 text-center">
					<p className="text-lg font-medium text-muted-foreground">
						No stock movements found
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Try adjusting your filters or date range.
					</p>
				</div>
			)}
			{!isLoading && !queryError && !validationError && rows.length > 0 && (
				<div className="rounded-lg border bg-background">
					<div className="p-3 text-sm text-muted-foreground">
						{rows.length} item{rows.length !== 1 ? "s" : ""} &middot;{" "}
						{periods.length} period{periods.length !== 1 ? "s" : ""}
						{selectedItems.size > 0
							? ` · ${selectedItems.size} selected in chart`
							: ""}
					</div>
					<AdvancedDataTable
						table={table}
						data={rows}
						enableExport
						enableVirtualization
						enableColumnResizing
						enableBulkActions={false}
						onExport={handleExport}
						ariaLabel="Stock analytics table"
					/>
				</div>
			)}
		</div>
	);
}
