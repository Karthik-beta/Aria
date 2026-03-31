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
	formatOptional,
	formatRate,
	ITEMS_FILTER_OPTIONS,
	type ItemPricesItemsFilter,
	type ItemPricesRow,
} from "./item-prices.utils";

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const columns: ColumnDef<ItemPricesRow>[] = [
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
		cell: ({ row }) => formatOptional(row.original.itemName),
		meta: { label: "Item Name", exportable: true },
	},
	{
		accessorKey: "itemGroupName",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Item Group" />
		),
		cell: ({ row }) => formatOptional(row.original.itemGroupName),
		meta: { label: "Item Group", exportable: true },
	},
	{
		accessorKey: "brandName",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Brand" />
		),
		cell: ({ row }) => formatOptional(row.original.brandName),
		meta: { label: "Brand", exportable: true },
	},
	{
		accessorKey: "description",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Description" />
		),
		cell: ({ row }) => (
			<span className="max-w-xs truncate text-muted-foreground">
				{formatOptional(row.original.description)}
			</span>
		),
		meta: { label: "Description", exportable: true },
	},
	{
		accessorKey: "stockUom",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="UOM" />
		),
		cell: ({ row }) => formatOptional(row.original.stockUom),
		meta: { label: "UOM", exportable: true },
	},
	{
		accessorKey: "lastPurchaseRate",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Last Purchase Rate" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatRate(row.original.lastPurchaseRate)}
			</span>
		),
		sortingFn: (rowA, rowB) => {
			const a = rowA.original.lastPurchaseRate ?? -1;
			const b = rowB.original.lastPurchaseRate ?? -1;
			return a - b;
		},
		meta: { label: "Last Purchase Rate", exportable: true },
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
		sortingFn: (rowA, rowB) =>
			rowA.original.valuationRate - rowB.original.valuationRate,
		meta: { label: "Valuation Rate", exportable: true },
	},
	{
		accessorKey: "standardSellingRate",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Selling Rate" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">
				{formatRate(row.original.standardSellingRate)}
			</span>
		),
		sortingFn: (rowA, rowB) =>
			rowA.original.standardSellingRate - rowB.original.standardSellingRate,
		meta: { label: "Selling Rate", exportable: true },
	},
];

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type FilterState = {
	itemsFilter: ItemPricesItemsFilter;
	itemCode: string;
	itemGroup: string;
	brand: string;
};

const INITIAL_FILTERS: FilterState = {
	itemsFilter: "enabled",
	itemCode: "",
	itemGroup: "",
	brand: "",
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ItemPricesPage() {
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

	const hasActiveFilters =
		filters.itemsFilter !== INITIAL_FILTERS.itemsFilter ||
		filters.itemCode !== INITIAL_FILTERS.itemCode ||
		filters.itemGroup !== INITIAL_FILTERS.itemGroup ||
		filters.brand !== INITIAL_FILTERS.brand;

	const queryInput = React.useMemo(
		() => ({
			itemsFilter: filters.itemsFilter,
			itemCode: filters.itemCode.trim() || undefined,
			itemGroup: filters.itemGroup.trim() || undefined,
			brand: filters.brand.trim() || undefined,
		}),
		[filters.itemsFilter, filters.itemCode, filters.itemGroup, filters.brand],
	);

	const { data, isLoading, error } =
		trpc.inventory.listItemPrices.useQuery(queryInput);

	const rows: ItemPricesRow[] = data ?? [];

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
				<h1 className="text-2xl font-bold tracking-tight">Item Prices</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					All items with their valuation rate, standard selling rate, and last
					recorded purchase rate from purchase receipts.
				</p>
			</div>

			{/* Filters */}
			<search className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1">
					<label htmlFor="items-filter-select" className="text-sm font-medium">
						Items
					</label>
					<Select
						value={filters.itemsFilter}
						onValueChange={(value) =>
							updateFilter("itemsFilter", value as ItemPricesItemsFilter)
						}
					>
						<SelectTrigger
							id="items-filter-select"
							className="h-9 w-52"
							aria-label="Items filter"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ITEMS_FILTER_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="item-code-input" className="text-sm font-medium">
						Item Code
					</label>
					<Input
						id="item-code-input"
						placeholder="Filter by item code"
						value={filters.itemCode}
						onChange={(e) => updateFilter("itemCode", e.target.value)}
						className="h-9 w-48"
						aria-label="Filter by item code"
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="item-group-input" className="text-sm font-medium">
						Item Group
					</label>
					<Input
						id="item-group-input"
						placeholder="Filter by item group"
						value={filters.itemGroup}
						onChange={(e) => updateFilter("itemGroup", e.target.value)}
						className="h-9 w-48"
						aria-label="Filter by item group"
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="brand-input" className="text-sm font-medium">
						Brand
					</label>
					<Input
						id="brand-input"
						placeholder="Filter by brand"
						value={filters.brand}
						onChange={(e) => updateFilter("brand", e.target.value)}
						className="h-9 w-40"
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
			</search>

			{/* Loading */}
			{isLoading && (
				<output
					className="flex items-center justify-center py-12"
					aria-live="polite"
					aria-label="Loading item prices data"
				>
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
				</output>
			)}

			{/* Error */}
			{!isLoading && error && (
				<ErrorState
					error={error}
					title="Failed to load item prices"
					operation="load"
				/>
			)}

			{/* Results */}
			{!isLoading &&
				!error &&
				(rows.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
						<p className="text-lg font-medium text-muted-foreground">
							No items found
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Try adjusting your filters.
						</p>
					</div>
				) : (
					<div className="rounded-lg border bg-background">
						<div className="p-3 text-sm text-muted-foreground">
							{rows.length} item{rows.length !== 1 ? "s" : ""}
						</div>
						<AdvancedDataTable
							table={tableState.table}
							data={rows}
							enableExport
							enableVirtualization
							enableColumnResizing
							enableBulkActions={false}
							ariaLabel="Item prices table"
						/>
					</div>
				))}
		</div>
	);
}
