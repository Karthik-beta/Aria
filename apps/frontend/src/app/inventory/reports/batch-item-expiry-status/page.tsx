"use client";

import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	type BatchItemExpiryRow,
	type ExpiryStatus,
	formatDate,
	formatOptional,
	formatQty,
	getDefaultFromDate,
	getDefaultToDate,
	getExpiryStatus,
} from "./batch-item-expiry-status.utils";

// ---------------------------------------------------------------------------
// Expiry status badge
// ---------------------------------------------------------------------------

const EXPIRY_STATUS_STYLES: Record<ExpiryStatus, string> = {
	none: "bg-muted text-muted-foreground",
	expired: "bg-destructive/15 text-destructive",
	critical: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
	warning:
		"bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
	ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const EXPIRY_STATUS_LABELS: Record<ExpiryStatus, string> = {
	none: "No Expiry",
	expired: "Expired",
	critical: "Critical",
	warning: "Warning",
	ok: "Ok",
};

function ExpiryStatusBadge({ expiryInDays }: { expiryInDays: number | null }) {
	const status = getExpiryStatus(expiryInDays);
	return (
		<Badge
			variant="secondary"
			className={cn("border-transparent", EXPIRY_STATUS_STYLES[status])}
		>
			{EXPIRY_STATUS_LABELS[status]}
		</Badge>
	);
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type FilterState = {
	fromDate: string;
	toDate: string;
	itemCode: string;
};

const INITIAL_FILTERS: FilterState = {
	fromDate: getDefaultFromDate(),
	toDate: getDefaultToDate(),
	itemCode: "",
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFilters(filters: FilterState): string | null {
	if (!filters.fromDate) return "From Date is required.";
	if (!filters.toDate) return "To Date is required.";
	if (filters.fromDate > filters.toDate)
		return "From Date must not be later than To Date.";
	return null;
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const columns: ColumnDef<BatchItemExpiryRow>[] = [
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
		accessorKey: "batchNo",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Batch" />
		),
		cell: ({ row }) => (
			<span className="font-medium">{row.original.batchNo}</span>
		),
	},
	{
		accessorKey: "stockUom",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Stock UOM" />
		),
		cell: ({ row }) => formatOptional(row.original.stockUom),
	},
	{
		accessorKey: "quantity",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Quantity" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">{formatQty(row.original.quantity)}</span>
		),
	},
	{
		accessorKey: "expiresOn",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Expires On" />
		),
		cell: ({ row }) => formatDate(row.original.expiresOn),
	},
	{
		accessorKey: "expiryInDays",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Expiry (In Days)" />
		),
		cell: ({ row }) => {
			const { expiryInDays } = row.original;
			if (expiryInDays === null) {
				return <span className="text-muted-foreground">—</span>;
			}
			return (
				<div className="flex items-center gap-2">
					<span className="tabular-nums">{expiryInDays}</span>
					<ExpiryStatusBadge expiryInDays={expiryInDays} />
				</div>
			);
		},
		sortingFn: (rowA, rowB) => {
			const a = rowA.original.expiryInDays ?? Number.POSITIVE_INFINITY;
			const b = rowB.original.expiryInDays ?? Number.POSITIVE_INFINITY;
			return a - b;
		},
	},
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function BatchItemExpiryStatusPage() {
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
			fromDate: new Date(`${filters.fromDate}T00:00:00.000Z`),
			toDate: new Date(`${filters.toDate}T23:59:59.999Z`),
			itemCode: filters.itemCode.trim() || undefined,
		};
	}, [validationError, filters.fromDate, filters.toDate, filters.itemCode]);

	const { data, isLoading, error } =
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled
		trpc.inventory.listBatchItemExpiry.useQuery(queryInput!, {
			enabled: queryInput !== null,
		});

	const rows: BatchItemExpiryRow[] = data ?? [];

	const hasActiveFilters =
		filters.fromDate !== INITIAL_FILTERS.fromDate ||
		filters.toDate !== INITIAL_FILTERS.toDate ||
		filters.itemCode !== INITIAL_FILTERS.itemCode;

	const tableState = useAdvancedDataTable({
		data: rows,
		columns,
		initialSorting: [{ id: "expiryInDays", desc: false }],
		initialPageSize: 50,
	});

	return (
		<div className="flex flex-1 flex-col gap-6 p-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold tracking-tight">
					Batch Item Expiry Status
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Active batches with remaining quantity, filtered by the date they were
					created, showing expiry dates and days to expiry.
				</p>
			</div>

			{/* Filters */}
			<search className="flex flex-wrap items-end gap-3">
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
						aria-describedby={validationError ? "filter-error" : undefined}
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
						className="h-9 w-48"
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
					aria-label="Loading batch item expiry data"
				>
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
				</output>
			)}

			{/* Error */}
			{!validationError && !isLoading && error && (
				<ErrorState
					error={error}
					title="Failed to load batch item expiry data"
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
							ariaLabel="Batch item expiry status table"
						/>
					</div>
				))}
		</div>
	);
}
