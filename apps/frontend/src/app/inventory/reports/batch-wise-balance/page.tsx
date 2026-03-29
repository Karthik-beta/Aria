"use client";

import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
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
	type BatchWiseBalanceRow,
	formatCurrency,
	formatDate,
	formatOptional,
	formatQty,
	formatRate,
	getDefaultFromDate,
	getDefaultToDate,
} from "./batch-wise-balance.utils";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type FilterState = {
	company: string;
	fromDate: string;
	toDate: string;
	itemCode: string;
	warehouse: string;
	batchNo: string;
};

const INITIAL_FILTERS: FilterState = {
	company: "",
	fromDate: getDefaultFromDate(),
	toDate: getDefaultToDate(),
	itemCode: "",
	warehouse: "",
	batchNo: "",
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFilters(filters: FilterState): string | null {
	if (!filters.company.trim()) return "Company is required.";
	if (!filters.fromDate) return "From Date is required.";
	if (!filters.toDate) return "To Date is required.";
	if (filters.fromDate > filters.toDate)
		return "From Date must not be later than To Date.";
	return null;
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const columns: ColumnDef<BatchWiseBalanceRow>[] = [
	{
		accessorKey: "itemCode",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Item" />
		),
		cell: ({ row }) => (
			<span className="font-medium">{row.original.itemCode}</span>
		),
	},
	{
		accessorKey: "itemName",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Item Name" />
		),
		cell: ({ row }) => formatOptional(row.original.itemName),
	},
	{
		accessorKey: "description",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Description" />
		),
		cell: ({ row }) => formatOptional(row.original.description),
	},
	{
		accessorKey: "warehouse",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Warehouse" />
		),
		cell: ({ row }) => formatOptional(row.original.warehouse),
	},
	{
		accessorKey: "batchNo",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Batch" />
		),
	},
	{
		accessorKey: "openingQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Opening Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">{formatQty(row.original.openingQty)}</span>
		),
	},
	{
		accessorKey: "inQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="In Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">{formatQty(row.original.inQty)}</span>
		),
	},
	{
		accessorKey: "outQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Out Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">{formatQty(row.original.outQty)}</span>
		),
	},
	{
		accessorKey: "balanceQty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Balance Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums font-semibold">
				{formatQty(row.original.balanceQty)}
			</span>
		),
	},
	{
		accessorKey: "valuationRate",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Valuation Rate" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatRate(row.original.valuationRate)}
			</span>
		),
	},
	{
		accessorKey: "balanceValue",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Balance Value" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums font-semibold">
				{formatCurrency(row.original.balanceValue)}
			</span>
		),
	},
	{
		accessorKey: "unitOfMeasure",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="UOM" />
		),
		cell: ({ row }) => formatOptional(row.original.unitOfMeasure),
	},
	{
		accessorKey: "manufacturingDate",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Mfg Date" />
		),
		cell: ({ row }) => formatDate(row.original.manufacturingDate),
	},
	{
		accessorKey: "expiryDate",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Expiry Date" />
		),
		cell: ({ row }) => formatDate(row.original.expiryDate),
	},
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function BatchWiseBalancePage() {
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

	const queryInput = React.useMemo(() => {
		if (validationError) return null;
		return {
			company: filters.company.trim(),
			fromDate: new Date(`${filters.fromDate}T00:00:00.000Z`),
			toDate: new Date(`${filters.toDate}T23:59:59.999Z`),
			itemCode: filters.itemCode.trim() || undefined,
			warehouse: filters.warehouse.trim() || undefined,
			batchNo: filters.batchNo.trim() || undefined,
		};
	}, [
		validationError,
		filters.company,
		filters.fromDate,
		filters.toDate,
		filters.itemCode,
		filters.warehouse,
		filters.batchNo,
	]);

	const { data, isLoading, error } =
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled
		trpc.inventory.listBatchWiseBalance.useQuery(queryInput!, {
			enabled: queryInput !== null,
		});

	const rows: BatchWiseBalanceRow[] = data ?? [];

	const hasActiveFilters =
		filters.company !== INITIAL_FILTERS.company ||
		filters.fromDate !== INITIAL_FILTERS.fromDate ||
		filters.toDate !== INITIAL_FILTERS.toDate ||
		filters.itemCode !== INITIAL_FILTERS.itemCode ||
		filters.warehouse !== INITIAL_FILTERS.warehouse ||
		filters.batchNo !== INITIAL_FILTERS.batchNo;

	const tableState = useAdvancedDataTable({
		data: rows,
		columns,
		initialSorting: [{ id: "itemCode", desc: false }],
		initialPageSize: 50,
	});

	return (
		<div className="flex flex-1 flex-col gap-6 p-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold tracking-tight">
					Batch-Wise Balance History
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Opening, incoming, and closing stock balance grouped by batch for the
					selected date range.
				</p>
			</div>

			{/* Filters */}
			<search className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1">
					<label htmlFor="company-input" className="text-sm font-medium">
						Company <span className="text-destructive">*</span>
					</label>
					<Input
						id="company-input"
						placeholder="Company *"
						value={filters.company}
						onChange={(e) => updateFilter("company", e.target.value)}
						className="h-9 w-48"
						aria-describedby={validationError ? "filter-error" : undefined}
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="from-date-input" className="text-sm font-medium">
						From Date <span className="text-destructive">*</span>
					</label>
					<Input
						id="from-date-input"
						type="date"
						value={filters.fromDate}
						onChange={(e) => updateFilter("fromDate", e.target.value)}
						className="h-9 w-40"
						aria-label="From date"
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="to-date-input" className="text-sm font-medium">
						To Date <span className="text-destructive">*</span>
					</label>
					<Input
						id="to-date-input"
						type="date"
						value={filters.toDate}
						onChange={(e) => updateFilter("toDate", e.target.value)}
						className="h-9 w-40"
						aria-label="To date"
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="item-code-input" className="text-sm font-medium">
						Item Code
					</label>
					<Input
						id="item-code-input"
						placeholder="Item code"
						value={filters.itemCode}
						onChange={(e) => updateFilter("itemCode", e.target.value)}
						className="h-9 w-40"
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="warehouse-input" className="text-sm font-medium">
						Warehouse
					</label>
					<Input
						id="warehouse-input"
						placeholder="Warehouse"
						value={filters.warehouse}
						onChange={(e) => updateFilter("warehouse", e.target.value)}
						className="h-9 w-48"
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="batch-no-input" className="text-sm font-medium">
						Batch No
					</label>
					<Input
						id="batch-no-input"
						placeholder="Batch number"
						value={filters.batchNo}
						onChange={(e) => updateFilter("batchNo", e.target.value)}
						className="h-9 w-40"
					/>
				</div>

				<Button
					variant="outline"
					size="sm"
					onClick={resetFilters}
					disabled={!hasActiveFilters}
					className="h-9"
				>
					Reset
				</Button>
			</search>

			{/* Validation error */}
			{validationError && (
				<p id="filter-error" role="alert" className="text-sm text-destructive">
					{validationError}
				</p>
			)}

			{/* Loading */}
			{!validationError && isLoading && (
				<output
					className="flex items-center justify-center py-12"
					aria-live="polite"
					aria-label="Loading batch-wise balance data"
				>
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
				</output>
			)}

			{/* Error */}
			{!validationError && !isLoading && error && (
				<ErrorState
					error={error}
					title="Failed to load batch-wise balance data"
					operation="load"
				/>
			)}

			{/* Results */}
			{!validationError &&
				!isLoading &&
				!error &&
				queryInput !== null &&
				(rows.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
						<p className="text-lg font-medium text-muted-foreground">
							No batches found
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Try adjusting your filters or date range.
						</p>
					</div>
				) : (
					<div className="rounded-lg border bg-background">
						<div className="p-3 text-sm text-muted-foreground">
							{rows.length} batch{rows.length !== 1 ? "es" : ""}
						</div>
						<AdvancedDataTable
							table={tableState.table}
							data={rows}
							enableExport
							enableVirtualization
							enableColumnResizing
							enableBulkActions={false}
							ariaLabel="Batch-wise balance history table"
						/>
					</div>
				))}
		</div>
	);
}
