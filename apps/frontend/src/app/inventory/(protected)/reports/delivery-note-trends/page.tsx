"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import * as React from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
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
	BASED_ON_OPTIONS,
	buildBarChartData,
	type DeliveryNoteTrendsBasedOn,
	type DeliveryNoteTrendsPeriod,
	type DeliveryNoteTrendsPeriodFrequency,
	type DeliveryNoteTrendsRow,
	formatAmount,
	formatDimensionText,
	formatPeriodCellValue,
	formatQty,
	getDefaultFromDate,
	getDefaultToDate,
	getSeriesColor,
	METRIC_OPTIONS,
	PERIOD_OPTIONS,
	type TrendsMetric,
} from "./delivery-note-trends.utils";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type FilterState = {
	company: string;
	fromDate: string;
	toDate: string;
	period: DeliveryNoteTrendsPeriodFrequency;
	basedOn: DeliveryNoteTrendsBasedOn;
	customer: string;
	itemCode: string;
	warehouse: string;
};

const INITIAL_FILTERS: FilterState = {
	company: "",
	fromDate: getDefaultFromDate(),
	toDate: getDefaultToDate(),
	period: "Monthly",
	basedOn: "Item",
	customer: "",
	itemCode: "",
	warehouse: "",
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFilters(filters: FilterState): string | null {
	if (!filters.company.trim()) return "Company is required.";
	if (!filters.fromDate) return "From Date is required.";
	if (!filters.toDate) return "To Date is required.";
	if (filters.fromDate > filters.toDate) {
		return "From Date must not be later than To Date.";
	}
	return null;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function DeliveryNoteTrendsPage() {
	const [filters, setFilters] = React.useState<FilterState>({
		...INITIAL_FILTERS,
	});

	const [metric, setMetric] = React.useState<TrendsMetric>("amount");

	const updateFilter = React.useCallback(
		<Key extends keyof FilterState>(key: Key, value: FilterState[Key]) => {
			setFilters((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	const resetFilters = React.useCallback(() => {
		setFilters({ ...INITIAL_FILTERS });
		setMetric("amount");
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
			period: filters.period,
			basedOn: filters.basedOn,
			company: filters.company.trim(),
			customer: filters.customer.trim() || undefined,
			itemCode: filters.itemCode.trim() || undefined,
			warehouse: filters.warehouse.trim() || undefined,
		};
	}, [
		validationError,
		filters.fromDate,
		filters.toDate,
		filters.period,
		filters.basedOn,
		filters.company,
		filters.customer,
		filters.itemCode,
		filters.warehouse,
	]);

	const {
		data: result,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listDeliveryNoteTrends.useQuery(
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled
		queryInput!,
		{
			enabled: queryInput != null,
			refetchOnWindowFocus: false,
			retry: 2,
			staleTime: 60_000,
		},
	);

	const rows: DeliveryNoteTrendsRow[] = React.useMemo(
		() => result?.rows ?? [],
		[result],
	);

	const periods: DeliveryNoteTrendsPeriod[] = React.useMemo(
		() =>
			(result?.periods ?? []).map((p) => ({
				...p,
				from: new Date(p.from),
				to: new Date(p.to),
			})),
		[result],
	);

	const totalQty = result?.totalQty ?? 0;
	const totalAmount = result?.totalAmount ?? 0;

	// ---------------------------------------------------------------------------
	// Columns — fixed dimension columns + dynamic period columns
	// ---------------------------------------------------------------------------

	const columns = React.useMemo<ColumnDef<DeliveryNoteTrendsRow>[]>(() => {
		const fixed: ColumnDef<DeliveryNoteTrendsRow>[] = [
			{
				accessorKey: "dimensionKey",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title={
							BASED_ON_OPTIONS.find((o) => o.value === filters.basedOn)
								?.label ?? "Dimension"
						}
					/>
				),
				cell: ({ row }) => (
					<span className="font-medium">
						{formatDimensionText(row.original.dimensionKey)}
					</span>
				),
				meta: {
					label:
						BASED_ON_OPTIONS.find((o) => o.value === filters.basedOn)?.label ??
						"Dimension",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "dimensionLabel",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Name" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatDimensionText(row.original.dimensionLabel)}
					</span>
				),
				meta: { label: "Name", exportable: true },
			},
		];

		const periodCols: ColumnDef<DeliveryNoteTrendsRow>[] = periods.map(
			(period) => ({
				id: `period_${period.key}`,
				accessorFn: (row) =>
					metric === "qty"
						? (row.periodQty[period.key] ?? 0)
						: (row.periodAmount[period.key] ?? 0),
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={period.label} />
				),
				cell: ({ row }) => {
					const value =
						metric === "qty"
							? row.original.periodQty[period.key]
							: row.original.periodAmount[period.key];
					const isZero = !value;
					return (
						<span
							className={
								isZero
									? "text-sm text-muted-foreground/40"
									: "text-sm font-medium tabular-nums"
							}
						>
							{formatPeriodCellValue(value ?? 0, metric)}
						</span>
					);
				},
				meta: { label: period.label, exportable: true },
			}),
		);

		const totalCol: ColumnDef<DeliveryNoteTrendsRow> = {
			id: "total",
			accessorFn: (row) => (metric === "qty" ? row.totalQty : row.totalAmount),
			header: ({ column }) => (
				<DataTableColumnHeader
					column={column}
					title={metric === "qty" ? "Total Qty" : "Total Amount"}
				/>
			),
			cell: ({ row }) => {
				const value =
					metric === "qty" ? row.original.totalQty : row.original.totalAmount;
				return (
					<span className="text-sm font-semibold tabular-nums">
						{metric === "qty" ? formatQty(value) : formatAmount(value)}
					</span>
				);
			},
			meta: {
				label: metric === "qty" ? "Total Qty" : "Total Amount",
				exportable: true,
			},
		};

		return [...fixed, ...periodCols, totalCol];
	}, [periods, metric, filters.basedOn]);

	// ---------------------------------------------------------------------------
	// Bar chart — top 10 by total amount
	// ---------------------------------------------------------------------------

	const barChartData = React.useMemo(() => buildBarChartData(rows), [rows]);

	// ---------------------------------------------------------------------------
	// Table
	// ---------------------------------------------------------------------------

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<DeliveryNoteTrendsRow>({
		data: rows,
		columns,
		initialPageSize: 50,
		initialSorting: [{ id: "total", desc: true }],
		enableRowSelection: false,
		enableMultiRowSelection: false,
		enableGlobalFilter: false,
		onReload: handleReload,
		getRowId: (row) => row.id,
	});

	const exportDeliveryNoteTrendsExcel =
		trpc.inventory.exportDeliveryNoteTrendsExcel.useMutation();

	const handleExport = React.useCallback(
		async (_format: string, _rows: readonly Row<DeliveryNoteTrendsRow>[]) => {
			if (!queryInput) return;
			const buffer = (await exportDeliveryNoteTrendsExcel.mutateAsync(
				queryInput,
			)) as string;
			downloadExcelBuffer(buffer, `delivery-note-trends-${Date.now()}.xlsx`);
		},
		[queryInput, exportDeliveryNoteTrendsExcel],
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
					<h1 className="text-3xl font-bold tracking-tight">
						Delivery Note Trends
					</h1>
					<p className="text-muted-foreground">
						Analyse delivered quantities and amounts by dimension across time
						periods.
					</p>
				</div>
			</div>

			{/* Filters */}
			<search className="rounded-lg border bg-background p-4">
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<Input
						value={filters.company}
						onChange={(event) => updateFilter("company", event.target.value)}
						placeholder="Company *"
						aria-label="Filter by company (required)"
					/>
					<Input
						value={filters.customer}
						onChange={(event) => updateFilter("customer", event.target.value)}
						placeholder="Customer"
						aria-label="Filter by customer"
					/>
					<Input
						value={filters.itemCode}
						onChange={(event) => updateFilter("itemCode", event.target.value)}
						placeholder="Item code"
						aria-label="Filter by item code"
					/>
					<Input
						value={filters.warehouse}
						onChange={(event) => updateFilter("warehouse", event.target.value)}
						placeholder="Warehouse"
						aria-label="Filter by warehouse"
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
						value={filters.period}
						onValueChange={(value) =>
							updateFilter("period", value as DeliveryNoteTrendsPeriodFrequency)
						}
					>
						<SelectTrigger aria-label="Select period frequency">
							<SelectValue placeholder="Period" />
						</SelectTrigger>
						<SelectContent>
							{PERIOD_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={filters.basedOn}
						onValueChange={(value) =>
							updateFilter("basedOn", value as DeliveryNoteTrendsBasedOn)
						}
					>
						<SelectTrigger aria-label="Select dimension (based on)">
							<SelectValue placeholder="Based On" />
						</SelectTrigger>
						<SelectContent>
							{BASED_ON_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="flex items-center gap-3">
						<span className="text-sm text-muted-foreground">Show:</span>
						{METRIC_OPTIONS.map((opt) => (
							<label
								key={opt.value}
								className="flex cursor-pointer items-center gap-1.5 text-sm"
							>
								<input
									type="radio"
									name="metric"
									value={opt.value}
									checked={metric === opt.value}
									onChange={() => setMetric(opt.value)}
									className="accent-primary"
								/>
								{opt.label}
							</label>
						))}
					</div>
					<Button
						variant="outline"
						onClick={resetFilters}
						disabled={!hasActiveFilters && metric === "amount"}
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

			{/* Loading state */}
			{isLoading && queryInput != null ? (
				<div className="flex flex-col gap-4">
					<div className="rounded-lg border bg-background p-4">
						<div className="flex items-center gap-2 mb-4">
							<Skeleton className="h-4 w-24" />
							<div className="flex gap-4 ml-auto">
								<Skeleton className="h-7 w-20" />
								<Skeleton className="h-7 w-20" />
							</div>
						</div>
					</div>
					<div className="rounded-lg border bg-background p-4">
						<div className="mb-4">
							<Skeleton className="h-5 w-48 mb-1" />
							<Skeleton className="h-4 w-64" />
						</div>
						<Skeleton className="h-[300px] w-full rounded-md" />
					</div>
					<DataTableSkeleton
						columnCount={12}
						rowCount={10}
						filterCount={0}
						cellWidths={[
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
						]}
					/>
				</div>
			) : null}

			{/* Error state */}
			{!isLoading && queryError ? (
				<ErrorState error={queryError} operation="load" />
			) : null}

			{/* Bar chart — top 10 by total amount */}
			{!validationError &&
			!isLoading &&
			!queryError &&
			barChartData.length > 0 ? (
				<section
					className="rounded-lg border bg-background p-4"
					aria-label="Delivery note trends bar chart"
				>
					<div className="mb-4">
						<h2 className="text-lg font-semibold">Top Deliveries by Amount</h2>
						<p className="text-sm text-muted-foreground">
							Top {Math.min(barChartData.length, 10)}{" "}
							{BASED_ON_OPTIONS.find((o) => o.value === filters.basedOn)
								?.label ?? "dimension"}{" "}
							values by total delivered amount.
						</p>
					</div>
					<div className="h-[300px] w-full min-w-0 min-h-[300px]">
						<ResponsiveContainer
							width="100%"
							height="100%"
							minWidth={0}
							minHeight={300}
						>
							<BarChart
								data={barChartData}
								layout="vertical"
								margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
							>
								<CartesianGrid strokeDasharray="3 3" horizontal={false} />
								<XAxis
									type="number"
									tickFormatter={(v: number) =>
										`₹${new Intl.NumberFormat("en-IN", {
											notation: "compact",
											maximumFractionDigits: 1,
										}).format(v)}`
									}
									tick={{ fontSize: 11 }}
								/>
								<YAxis
									dataKey="label"
									type="category"
									width={160}
									tick={{ fontSize: 11 }}
								/>
								<Tooltip
									formatter={(value) => [
										formatAmount(Number(value ?? 0)),
										"Amount",
									]}
								/>
								{barChartData.map((_, i) => (
									<Bar
										key={`bar_${i.toString()}`}
										dataKey="amount"
										fill={getSeriesColor(i)}
									>
										<Cell
											key={`cell_${i.toString()}`}
											fill={getSeriesColor(i)}
										/>
									</Bar>
								))}
							</BarChart>
						</ResponsiveContainer>
					</div>
				</section>
			) : null}

			{/* Table */}
			{!validationError && !isLoading && !queryError && rows.length > 0 ? (
				<section aria-label="Delivery note trends table">
					<div className="mb-2 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							{rows.length} row{rows.length !== 1 ? "s" : ""} · {periods.length}{" "}
							period{periods.length !== 1 ? "s" : ""} · Total amount:{" "}
							{formatAmount(totalAmount)} · Total qty: {formatQty(totalQty)}
						</p>
					</div>
					<AdvancedDataTable
						table={table}
						data={rows}
						enableExport
						onExport={handleExport}
						enableVirtualization={false}
						enableColumnResizing
						enableBulkActions={false}
						ariaLabel="Delivery note trends"
					/>
				</section>
			) : null}

			{/* Empty state */}
			{!validationError &&
			!isLoading &&
			!queryError &&
			queryInput != null &&
			rows.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
					<p className="text-base font-medium">No delivery notes found</p>
					<p className="text-sm">
						Try adjusting the company, date range, or filters.
					</p>
				</div>
			) : null}
		</div>
	);
}
