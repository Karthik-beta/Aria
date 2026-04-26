"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
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
import { downloadExcelBuffer } from "@/components/advanced-data-table/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import {
	buildPendingMaterialChartData,
	formatDate,
	formatQty,
	getDefaultFromDate,
	getDefaultToDate,
	type SubcontractedRawMaterialsResult,
	type SubcontractedRawMaterialsRow,
} from "./subcontracted-raw-materials-transferred.utils";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type FilterState = {
	supplier: string;
	fromDate: string;
	toDate: string;
	company: string;
	rmItemCode: string;
};

const INITIAL_FILTERS: FilterState = {
	supplier: "",
	fromDate: getDefaultFromDate(),
	toDate: getDefaultToDate(),
	company: "",
	rmItemCode: "",
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFilters(filters: FilterState): string | null {
	if (!filters.supplier.trim()) return "Supplier is required.";
	if (!filters.fromDate) return "From Date is required.";
	if (!filters.toDate) return "To Date is required.";
	if (filters.fromDate > filters.toDate) {
		return "From Date must not be later than To Date.";
	}
	return null;
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const columns: ColumnDef<SubcontractedRawMaterialsRow>[] = [
	{
		accessorKey: "subcontractOrder",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Subcontract Order" />
		),
		cell: ({ row }) => (
			<span className="font-medium">{row.original.subcontractOrder}</span>
		),
		meta: { label: "Subcontract Order", searchable: true, exportable: true },
	},
	{
		accessorKey: "date",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Date" />
		),
		cell: ({ row }) => formatDate(row.original.date),
		sortingFn: (left, right) =>
			new Date(left.original.date).getTime() -
			new Date(right.original.date).getTime(),
		meta: { label: "Date", exportable: true },
	},
	{
		accessorKey: "supplier",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Supplier" />
		),
		cell: ({ row }) => <span className="text-sm">{row.original.supplier}</span>,
		meta: { label: "Supplier", searchable: true, exportable: true },
	},
	{
		accessorKey: "rmItemCode",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Item Code" />
		),
		meta: { label: "Item Code", searchable: true, exportable: true },
	},
	{
		accessorKey: "rmItemName",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Item Name" />
		),
		cell: ({ row }) => row.original.rmItemName ?? "—",
		meta: { label: "Item Name", exportable: true },
	},
	{
		accessorKey: "requiredQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Required Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatQty(row.original.requiredQty)}
			</span>
		),
		meta: { label: "Required Qty", exportable: true },
	},
	{
		accessorKey: "transferredQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Transferred Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatQty(row.original.transferredQty)}
			</span>
		),
		meta: { label: "Transferred Qty", exportable: true },
	},
	{
		accessorKey: "returnedQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Returned Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatQty(row.original.returnedQty)}
			</span>
		),
		meta: { label: "Returned Qty", exportable: true },
	},
	{
		accessorKey: "pendingQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Pending Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums font-semibold text-amber-700 dark:text-amber-300">
				{formatQty(row.original.pendingQty)}
			</span>
		),
		meta: { label: "Pending Qty", exportable: true },
	},
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SubcontractedRawMaterialsTransferredPage() {
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

	const validationError = React.useMemo(
		() => validateFilters(filters),
		[filters],
	);

	const queryInput = React.useMemo(() => {
		if (validationError) return null;

		return {
			supplier: filters.supplier.trim(),
			fromDate: new Date(`${filters.fromDate}T00:00:00.000Z`),
			toDate: new Date(`${filters.toDate}T23:59:59.999Z`),
			company: filters.company.trim() || undefined,
			rmItemCode: filters.rmItemCode.trim() || undefined,
		};
	}, [
		validationError,
		filters.supplier,
		filters.fromDate,
		filters.toDate,
		filters.company,
		filters.rmItemCode,
	]);

	const {
		data: rawResult,
		isLoading,
		error: queryError,
	} = trpc.inventory.listSubcontractedRawMaterials.useQuery(
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled
		queryInput!,
		{
			enabled: queryInput != null,
			refetchOnWindowFocus: false,
			retry: 2,
			staleTime: 60_000,
		},
	);

	const result = React.useMemo<
		SubcontractedRawMaterialsResult | undefined
	>(() => {
		if (!rawResult) return undefined;

		return {
			...rawResult,
			rows: rawResult.rows.map((row) => ({
				...row,
				date: new Date(row.date),
			})),
		};
	}, [rawResult]);

	const rows = result?.rows ?? [];
	const summary = result?.summary;
	const chartData = React.useMemo(
		() => buildPendingMaterialChartData(rows),
		[rows],
	);

	const tableState = useAdvancedDataTable({
		data: rows,
		columns,
		initialSorting: [{ id: "date", desc: false }],
		initialPageSize: 50,
	});

	const exportSubcontractedRawMaterialsExcel =
		trpc.inventory.exportSubcontractedRawMaterialsExcel.useMutation();

	const handleExport = React.useCallback(
		async (
			_format: string,
			_rows: readonly Row<SubcontractedRawMaterialsRow>[],
		) => {
			if (!queryInput) return;
			const buffer = (await exportSubcontractedRawMaterialsExcel.mutateAsync(
				queryInput,
			)) as string;
			downloadExcelBuffer(
				buffer,
				`subcontracted-raw-materials-transferred-${Date.now()}.xlsx`,
			);
		},
		[queryInput, exportSubcontractedRawMaterialsExcel],
	);

	return (
		<div className="flex flex-1 flex-col gap-6 p-6">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-bold tracking-tight">
					Subcontracted Raw Materials To Be Transferred
				</h1>
				<p className="text-sm text-muted-foreground">
					Raw materials that still need to be sent to subcontractors for open
					subcontracting orders.
				</p>
			</div>

			{/* Filters */}
			<section className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[repeat(5,minmax(0,1fr))]">
				<div className="flex flex-col gap-1">
					<label htmlFor="supplier-filter" className="text-sm font-medium">
						Supplier <span className="text-destructive">*</span>
					</label>
					<Input
						id="supplier-filter"
						placeholder="Supplier name…"
						value={filters.supplier}
						onChange={(event) => updateFilter("supplier", event.target.value)}
						className="h-9"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor="from-date-filter" className="text-sm font-medium">
						From Date <span className="text-destructive">*</span>
					</label>
					<Input
						id="from-date-filter"
						type="date"
						value={filters.fromDate}
						onChange={(event) => updateFilter("fromDate", event.target.value)}
						className="h-9"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor="to-date-filter" className="text-sm font-medium">
						To Date <span className="text-destructive">*</span>
					</label>
					<Input
						id="to-date-filter"
						type="date"
						value={filters.toDate}
						onChange={(event) => updateFilter("toDate", event.target.value)}
						className="h-9"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor="company-filter" className="text-sm font-medium">
						Company
					</label>
					<Input
						id="company-filter"
						placeholder="All companies"
						value={filters.company}
						onChange={(event) => updateFilter("company", event.target.value)}
						className="h-9"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor="item-filter" className="text-sm font-medium">
						Item Code
					</label>
					<Input
						id="item-filter"
						placeholder="Item code contains…"
						value={filters.rmItemCode}
						onChange={(event) => updateFilter("rmItemCode", event.target.value)}
						className="h-9"
					/>
				</div>
				<div className="flex items-center justify-between gap-2 lg:col-span-5">
					{validationError ? (
						<p className="text-sm text-destructive">{validationError}</p>
					) : (
						<p className="text-sm text-muted-foreground">
							Showing pending raw material transfers for supplier &quot;
							{filters.supplier.trim()}&quot;
						</p>
					)}
					<Button variant="outline" size="sm" onClick={resetFilters}>
						Reset
					</Button>
				</div>
			</section>

			{/* Loading */}
			{isLoading ? (
				<p className="text-sm text-muted-foreground">
					Loading subcontracted raw materials…
				</p>
			) : null}

			{/* Error */}
			{!isLoading && queryError ? (
				<ErrorState
					error={queryError}
					title="Failed to load subcontracted raw materials report"
				/>
			) : null}

			{/* Validation prevents query */}
			{!isLoading && !queryError && validationError ? (
				<div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
					<p className="text-base font-medium">
						Fill in the required filters to load the report
					</p>
					<p className="text-sm">{validationError}</p>
				</div>
			) : null}

			{/* Summary cards */}
			{!isLoading && !queryError && summary ? (
				<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Open Orders
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-semibold">{summary.orderCount}</p>
							<p className="text-sm text-muted-foreground">
								{summary.rowCount} material row
								{summary.rowCount === 1 ? "" : "s"}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Pending Qty
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-semibold text-amber-700 dark:text-amber-300">
								{formatQty(summary.totalPendingQty)}
							</p>
							<p className="text-sm text-muted-foreground">
								Still to transfer to subcontractor
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Transferred Qty
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-semibold">
								{formatQty(summary.totalTransferredQty)}
							</p>
							<p className="text-sm text-muted-foreground">
								Against {formatQty(summary.totalRequiredQty)} required
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Returned Qty
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-semibold">
								{formatQty(summary.totalReturnedQty)}
							</p>
							<p className="text-sm text-muted-foreground">
								Materials returned by subcontractor
							</p>
						</CardContent>
					</Card>
				</section>
			) : null}

			{/* Chart + table */}
			{!isLoading && !queryError && rows.length > 0 ? (
				<>
					<section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
						<Card>
							<CardHeader>
								<CardTitle className="text-base">
									Largest Pending Materials
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="h-[260px] w-full min-w-0 min-h-[260px]">
									<ResponsiveContainer
										width="100%"
										height="100%"
										minWidth={0}
										minHeight={260}
									>
										<BarChart
											data={chartData}
											margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
										>
											<CartesianGrid strokeDasharray="3 3" vertical={false} />
											<XAxis
												dataKey="label"
												tickLine={false}
												axisLine={false}
												tick={{ fontSize: 11 }}
											/>
											<YAxis
												tickLine={false}
												axisLine={false}
												tickFormatter={formatQty}
												tick={{ fontSize: 11 }}
											/>
											<Tooltip
												formatter={(value) => [
													formatQty(Number(value ?? 0)),
													"Pending Qty",
												]}
												labelFormatter={(label, payload) => {
													const item = payload?.[0]?.payload as
														| { orderCount?: number }
														| undefined;
													return item?.orderCount != null
														? `${label} · ${item.orderCount} order${item.orderCount === 1 ? "" : "s"}`
														: String(label);
												}}
											/>
											<Bar
												dataKey="pendingQty"
												fill="hsl(var(--chart-2))"
												radius={[6, 6, 0, 0]}
											/>
										</BarChart>
									</ResponsiveContainer>
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Report Notes</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3 text-sm text-muted-foreground">
								<p>
									Rows are visible only while the required quantity exceeds the
									net transferred quantity (supplied minus returned).
								</p>
								<p>
									Draft and cancelled subcontracting orders are excluded, as are
									orders that are fully received.
								</p>
								<p>
									Transferred Qty = Supplied Qty − Returned Qty. Pending Qty =
									Required Qty − Transferred Qty.
								</p>
							</CardContent>
						</Card>
					</section>

					<section aria-label="Subcontracted raw materials table">
						<div className="mb-2 flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								{rows.length} row{rows.length === 1 ? "" : "s"} · Pending{" "}
								{formatQty(summary?.totalPendingQty ?? 0)}
							</p>
						</div>
						<AdvancedDataTable
							table={tableState.table}
							data={rows}
							enableExport
							onExport={handleExport}
							enableVirtualization={false}
							enableBulkActions={false}
							ariaLabel="Subcontracted raw materials to be transferred"
						/>
					</section>
				</>
			) : null}

			{/* Empty state */}
			{!isLoading && !queryError && !validationError && rows.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
					<p className="text-base font-medium">
						No pending raw material transfers found
					</p>
					<p className="text-sm">
						All required materials may have been transferred, or the filters may
						exclude matching subcontracting orders.
					</p>
				</div>
			) : null}
		</div>
	);
}
