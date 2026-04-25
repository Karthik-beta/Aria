"use client";

import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { downloadExcelBuffer } from "@/components/advanced-data-table/utils";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import {
	formatOptionalText,
	formatQty,
	INITIAL_FILTERS,
	type ItemwiseRecommendedReorderLevelRow,
	type ReorderLevelFilterState,
	validateFilters,
} from "./itemwise-recommended-reorder-level.utils";

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const columns: ColumnDef<ItemwiseRecommendedReorderLevelRow>[] = [
	{
		accessorKey: "itemCode",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Item" />
		),
		cell: ({ row }) => (
			<span className="font-medium">{row.original.itemCode}</span>
		),
		meta: { label: "Item", exportable: true },
	},
	{
		accessorKey: "itemName",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Item Name" />
		),
		cell: ({ row }) => (
			<span className="text-sm text-muted-foreground">
				{row.original.itemName}
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
		accessorKey: "description",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Description" />
		),
		cell: ({ row }) => (
			<span className="text-sm text-muted-foreground">
				{formatOptionalText(row.original.description)}
			</span>
		),
		meta: { label: "Description", exportable: true },
	},
	{
		accessorKey: "safetyStock",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Safety Stock" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatQty(row.original.safetyStock)}
			</span>
		),
		meta: { label: "Safety Stock", exportable: true },
	},
	{
		accessorKey: "leadTimeDays",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Lead Time Days" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">{row.original.leadTimeDays}</span>
		),
		meta: { label: "Lead Time Days", exportable: true },
	},
	{
		accessorKey: "consumed",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Consumed" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">{formatQty(row.original.consumed)}</span>
		),
		meta: { label: "Consumed", exportable: true },
	},
	{
		accessorKey: "delivered",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Delivered" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">{formatQty(row.original.delivered)}</span>
		),
		meta: { label: "Delivered", exportable: true },
	},
	{
		accessorKey: "totalOutgoing",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Total Outgoing" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatQty(row.original.totalOutgoing)}
			</span>
		),
		meta: { label: "Total Outgoing", exportable: true },
	},
	{
		accessorKey: "avgDailyOutgoing",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Avg Daily Outgoing" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatQty(row.original.avgDailyOutgoing)}
			</span>
		),
		meta: { label: "Avg Daily Outgoing", exportable: true },
	},
	{
		accessorKey: "reorderLevel",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Reorder Level" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums font-semibold">
				{formatQty(row.original.reorderLevel)}
			</span>
		),
		meta: { label: "Reorder Level", exportable: true },
	},
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ItemwiseRecommendedReorderLevelPage() {
	const [filters, setFilters] = React.useState<ReorderLevelFilterState>({
		...INITIAL_FILTERS,
	});

	const updateFilter = React.useCallback(
		<K extends keyof ReorderLevelFilterState>(
			key: K,
			value: ReorderLevelFilterState[K],
		) => {
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
			itemGroup: filters.itemGroup.trim() || undefined,
			brand: filters.brand.trim() || undefined,
		};
	}, [
		validationError,
		filters.fromDate,
		filters.toDate,
		filters.itemGroup,
		filters.brand,
	]);

	const { data, isLoading, error, refetch } =
		trpc.inventory.listItemwiseRecommendedReorderLevel.useQuery(
			// biome-ignore lint/style/noNonNullAssertion: guarded by enabled
			queryInput!,
			{
				enabled: queryInput !== null,
				refetchOnWindowFocus: false,
				retry: 2,
				staleTime: 60_000,
			},
		);

	const rows = data ?? [];

	const listQueryInput = React.useMemo(
		() =>
			queryInput
				? {
						fromDate: queryInput.fromDate.toISOString(),
						toDate: queryInput.toDate.toISOString(),
						itemGroup: queryInput.itemGroup,
						brand: queryInput.brand,
					}
				: null,
		[queryInput],
	);

	const handleExport = React.useCallback(async () => {
		if (!listQueryInput) return;
		const buffer = await (
			trpc.inventory.exportItemwiseRecommendedReorderLevelExcel as unknown as {
				mutate: (input: typeof listQueryInput) => Promise<Buffer>;
			}
		).mutate(listQueryInput);
		downloadExcelBuffer(buffer, `itemwise-reorder-level-${Date.now()}.xlsx`);
	}, [listQueryInput]);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<ItemwiseRecommendedReorderLevelRow>({
		data: rows,
		columns,
		initialSorting: [{ id: "itemCode", desc: false }],
		initialPageSize: 50,
		enableRowSelection: false,
		enableMultiRowSelection: false,
		enableGlobalFilter: false,
		onReload: handleReload,
		getRowId: (row) => row.id,
	});

	const hasActiveFilters = React.useMemo(
		() =>
			(
				Object.keys(INITIAL_FILTERS) as Array<keyof ReorderLevelFilterState>
			).some((key) => filters[key] !== INITIAL_FILTERS[key]),
		[filters],
	);

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

	return (
		<div className="flex flex-1 flex-col gap-6 p-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold tracking-tight">
					Itemwise Recommended Reorder Level
				</h1>
				<p className="text-muted-foreground mt-1 text-sm">
					Calculates recommended reorder levels based on historical consumption
					and delivery data. Formula: (Avg Daily Outgoing &times; Lead Time
					Days) + Safety Stock.
				</p>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1">
					<label htmlFor="from-date-input" className="text-sm font-medium">
						From Date <span className="text-destructive">*</span>
					</label>
					<Input
						id="from-date-input"
						type="date"
						value={filters.fromDate}
						onChange={(e) => updateFilter("fromDate", e.target.value)}
						className="h-9 w-44"
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
						className="h-9 w-44"
						aria-label="To date"
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="item-group-input" className="text-sm font-medium">
						Item Group
					</label>
					<Input
						id="item-group-input"
						placeholder="Item Group"
						value={filters.itemGroup}
						onChange={(e) => updateFilter("itemGroup", e.target.value)}
						className="h-9 w-52"
						aria-label="Filter by item group"
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="brand-input" className="text-sm font-medium">
						Brand
					</label>
					<Input
						id="brand-input"
						placeholder="Brand"
						value={filters.brand}
						onChange={(e) => updateFilter("brand", e.target.value)}
						className="h-9 w-44"
						aria-label="Filter by brand"
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
			</div>

			{/* Validation error */}
			{validationError && (
				<p id="filter-error" role="alert" className="text-destructive text-sm">
					{validationError}
				</p>
			)}

			{/* Loading */}
			{!validationError && isLoading && (
				<p className="text-muted-foreground text-sm">
					Loading reorder level data…
				</p>
			)}

			{/* Server error */}
			{!validationError && !isLoading && error && (
				<ErrorState error={error} title="Failed to load reorder level data" />
			)}

			{/* Results */}
			{!validationError &&
				!isLoading &&
				!error &&
				queryInput !== null &&
				(rows.length === 0 ? (
					<div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
						No items found for the selected filters
					</div>
				) : (
					<section
						className="rounded-lg border bg-background"
						aria-label="Itemwise Recommended Reorder Level data table"
					>
						<AdvancedDataTable<ItemwiseRecommendedReorderLevelRow>
							table={table}
							data={rows}
							onExport={handleExport}
						/>
					</section>
				))}
		</div>
	);
}
