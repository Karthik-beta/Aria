"use client";

import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import {
	buildBarChartData,
	formatQty,
	type ItemShortageRow,
} from "./item-shortage.utils";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type FilterState = {
	company: string;
	warehouses: string;
};

const INITIAL_FILTERS: FilterState = {
	company: "",
	warehouses: "",
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFilters(filters: FilterState): string | null {
	if (!filters.company.trim()) return "Company is required.";
	return null;
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const columns: ColumnDef<ItemShortageRow>[] = [
	{
		accessorKey: "warehouse",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Warehouse" />
		),
		cell: ({ row }) => (
			<span className="font-medium">{row.original.warehouse}</span>
		),
	},
	{
		accessorKey: "itemCode",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Item Code" />
		),
	},
	{
		accessorKey: "itemName",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Item Name" />
		),
		cell: ({ row }) => row.original.itemName ?? "—",
	},
	{
		accessorKey: "description",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Description" />
		),
		cell: ({ row }) => row.original.description ?? "—",
	},
	{
		accessorKey: "actualQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Actual Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">{formatQty(row.original.actualQty)}</span>
		),
	},
	{
		accessorKey: "orderedQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Ordered Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">{formatQty(row.original.orderedQty)}</span>
		),
	},
	{
		accessorKey: "plannedQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Planned Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">{formatQty(row.original.plannedQty)}</span>
		),
	},
	{
		accessorKey: "requestedQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Requested Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatQty(row.original.requestedQty)}
			</span>
		),
	},
	{
		accessorKey: "reservedQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Reserved Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatQty(row.original.reservedQty)}
			</span>
		),
	},
	{
		accessorKey: "reservedQtyForProduction",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Reserved for Production" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatQty(row.original.reservedQtyForProduction)}
			</span>
		),
	},
	{
		accessorKey: "projectedQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Projected Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums font-semibold text-destructive">
				{formatQty(row.original.projectedQty)}
			</span>
		),
	},
	{
		accessorKey: "company",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Company" />
		),
	},
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ItemShortageReportPage() {
	const [filters, setFilters] = React.useState<FilterState>({
		...INITIAL_FILTERS,
	});

	const updateFilter = React.useCallback(
		<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
			setFilters((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	const resetFilters = React.useCallback(() => {
		setFilters({ ...INITIAL_FILTERS });
	}, []);

	const validationError = React.useMemo(
		() => validateFilters(filters),
		[filters],
	);

	const warehousesList = React.useMemo(() => {
		if (!filters.warehouses.trim()) return undefined;
		return filters.warehouses
			.split(",")
			.map((w) => w.trim())
			.filter(Boolean);
	}, [filters.warehouses]);

	const queryInput = React.useMemo(() => {
		if (validationError) return null;
		return {
			company: filters.company.trim(),
			warehouses: warehousesList,
		};
	}, [validationError, filters.company, warehousesList]);

	const { data, isLoading, error } =
		trpc.inventory.listItemShortageReport.useQuery(queryInput ?? {}, {
			enabled: queryInput !== null,
		});

	const rows = data ?? [];

	const chartData = React.useMemo(() => buildBarChartData(rows), [rows]);

	const tableState = useAdvancedDataTable({
		data: rows,
		columns,
		initialSorting: [{ id: "projectedQty", desc: false }],
		initialPageSize: 50,
	});

	return (
		<div className="flex flex-1 flex-col gap-6 p-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold tracking-tight">
					Item Shortage Report
				</h1>
				<p className="text-muted-foreground mt-1 text-sm">
					Items where projected stock is negative—indicating active demand
					exceeds available and incoming supply.
				</p>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1">
					<label htmlFor="company-input" className="text-sm font-medium">
						Company <span className="text-destructive">*</span>
					</label>
					<Input
						id="company-input"
						placeholder="Company *"
						value={filters.company}
						onChange={(e) => updateFilter("company", e.target.value)}
						className="h-9 w-56"
						aria-describedby={validationError ? "filter-error" : undefined}
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="warehouses-input" className="text-sm font-medium">
						Warehouses
					</label>
					<Input
						id="warehouses-input"
						placeholder="Warehouses (comma-separated)"
						value={filters.warehouses}
						onChange={(e) => updateFilter("warehouses", e.target.value)}
						className="h-9 w-72"
					/>
				</div>

				<Button
					variant="outline"
					size="sm"
					onClick={resetFilters}
					className="h-9"
				>
					Reset
				</Button>
			</div>

			{/* Validation error */}
			{validationError && (
				<p id="filter-error" role="alert" className="text-destructive text-sm">
					{validationError}
				</p>
			)}

			{/* Loading */}
			{!validationError && isLoading && (
				<p className="text-muted-foreground text-sm">Loading shortage data…</p>
			)}

			{/* Server error */}
			{!validationError && !isLoading && error && (
				<ErrorState error={error} title="Failed to load shortage data" />
			)}

			{/* Results */}
			{!validationError &&
				!isLoading &&
				!error &&
				queryInput !== null &&
				(rows.length === 0 ? (
					<div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
						No shortage items found
					</div>
				) : (
					<>
						{/* Bar chart – top-10 most critical items */}
						<div className="rounded-lg border p-4">
							<p className="text-sm font-medium mb-3">
								Top {Math.min(chartData.length, 10)} Most Critical Items
							</p>
							<div className="h-[200px] w-full min-w-0 min-h-[200px]">
								<ResponsiveContainer
									width="100%"
									height="100%"
									minWidth={0}
									minHeight={200}
								>
									<BarChart
										data={chartData}
										margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
									>
										<CartesianGrid vertical={false} strokeDasharray="3 3" />
										<XAxis
											dataKey="label"
											tickLine={false}
											axisLine={false}
											tick={{ fontSize: 11 }}
											interval={0}
											angle={-25}
											textAnchor="end"
											height={48}
										/>
										<YAxis
											tickLine={false}
											axisLine={false}
											tick={{ fontSize: 11 }}
											tickFormatter={formatQty}
										/>
										<Tooltip
											formatter={(value) => [
												formatQty(-(value as number)),
												"Projected Qty",
											]}
											labelStyle={{ fontWeight: 600 }}
										/>
										<Bar
											dataKey="shortfall"
											fill="var(--destructive)"
											radius={[4, 4, 0, 0]}
											name="Shortfall"
										/>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</div>

						{/* Data table */}
						<AdvancedDataTable table={tableState.table} data={rows} />
					</>
				))}
		</div>
	);
}
