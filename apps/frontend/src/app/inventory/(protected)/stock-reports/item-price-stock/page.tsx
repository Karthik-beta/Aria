"use client";

import type { Inventory } from "@aria/types";
import type { ColumnDef, Row } from "@tanstack/react-table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { trpc } from "@/lib/trpc";
import {
	formatCompactDate,
	formatItemPriceStockCurrency,
	formatItemPriceStockQuantity,
	formatOptionalText,
	formatRelativeAge,
	ITEM_PRICE_STOCK_CURRENCY_OPTIONS,
	type ItemPriceStockCurrency,
	type ItemPriceStockRow,
} from "./item-price-stock.utils";

type ItemPriceStockSubscriptionEvent = {
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
	currency: ItemPriceStockCurrency;
	includeZeroStockItems: boolean;
};

const INITIAL_FILTERS: FilterState = {
	company: "",
	warehouse: "",
	itemCode: "",
	itemGroup: "",
	brand: "",
	currency: "INR",
	includeZeroStockItems: true,
};

function ItemPriceStockRealtimeSubscriptions({
	scope,
	onInventoryData,
	onItemData,
}: {
	scope:
		| {
				company?: string;
				warehouse?: string;
				itemCode?: string;
		  }
		| undefined;
	onInventoryData?: (event: ItemPriceStockSubscriptionEvent) => void;
	onItemData?: (event: Inventory.Item | { id: string }) => void;
}) {
	trpc.inventory.onStockEntriesChanged.useSubscription(scope, {
		onData: onInventoryData,
	});
	trpc.inventory.onItemsChanged.useSubscription(undefined, {
		onData: (event) => {
			onItemData?.(event.data);
		},
	});

	return null;
}

export default function ItemPriceStockPage() {
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
			includeZeroStockItems: filters.includeZeroStockItems,
		};
	}, [
		filters.brand,
		filters.company,
		filters.includeZeroStockItems,
		filters.itemCode,
		filters.itemGroup,
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
	} = trpc.inventory.listItemPriceStock.useQuery(listQueryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const rows = React.useMemo<ItemPriceStockRow[]>(
		() =>
			rawRows.map((row: (typeof rawRows)[number]) => ({
				...row,
				lastActivityDate: row.lastActivityDate
					? new Date(row.lastActivityDate)
					: null,
			})),
		[rawRows],
	);

	const columns = React.useMemo<ColumnDef<ItemPriceStockRow>[]>(() => {
		return [
			{
				accessorKey: "itemCode",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Code" />
				),
				cell: ({ row }) => (
					<span className="font-medium">{row.original.itemCode}</span>
				),
				meta: { label: "Item Code", searchable: true, exportable: true },
			},
			{
				accessorKey: "itemName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Name" />
				),
				cell: ({ row }) => formatOptionalText(row.original.itemName),
				meta: { label: "Item Name", exportable: true },
			},
			{
				accessorKey: "brandName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Brand" />
				),
				cell: ({ row }) => formatOptionalText(row.original.brandName),
				meta: { label: "Brand", exportable: true },
			},
			{
				accessorKey: "warehouse",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Warehouse" />
				),
				cell: ({ row }) => row.original.warehouse,
				meta: { label: "Warehouse", exportable: true },
			},
			{
				accessorKey: "availableQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Stock Available" />
				),
				cell: ({ row }) => (
					<span className="font-medium">
						{formatItemPriceStockQuantity(row.original.availableQty)}
					</span>
				),
				meta: { label: "Stock Available", exportable: true },
			},
			{
				accessorKey: "buyingPriceList",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Buying Price List" />
				),
				cell: ({ row }) => row.original.buyingPriceList,
				meta: { label: "Buying Price List", exportable: true },
			},
			{
				accessorKey: "buyingRate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Buying Rate" />
				),
				cell: ({ row }) =>
					formatItemPriceStockCurrency(
						row.original.buyingRate,
						filters.currency,
					),
				meta: { label: "Buying Rate", exportable: true },
			},
			{
				accessorKey: "sellingPriceList",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Selling Price List" />
				),
				cell: ({ row }) => row.original.sellingPriceList,
				meta: { label: "Selling Price List", exportable: true },
			},
			{
				accessorKey: "sellingRate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Selling Rate" />
				),
				cell: ({ row }) =>
					formatItemPriceStockCurrency(
						row.original.sellingRate,
						filters.currency,
					),
				meta: { label: "Selling Rate", exportable: true },
			},
			{
				accessorKey: "lastActivityDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Last Movement" />
				),
				cell: ({ row }) => formatCompactDate(row.original.lastActivityDate),
				meta: { label: "Last Movement", variant: "date", exportable: true },
			},
			{
				id: "age",
				accessorFn: (row) => row.lastActivityDate,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Age" />
				),
				cell: ({ row }) => formatRelativeAge(row.original.lastActivityDate),
				meta: { label: "Age", variant: "date", exportable: true },
			},
		];
	}, [filters.currency]);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const exportItemPriceStockExcel =
		trpc.inventory.exportItemPriceStockExcel.useMutation();

	const handleExport = React.useCallback(
		async (format: string, _rows: readonly Row<ItemPriceStockRow>[]) => {
			if (format !== "excel") return;
			const buffer = (await exportItemPriceStockExcel.mutateAsync(
				listQueryInput,
			)) as string;
			downloadExcelBuffer(buffer, `item-price-stock-${Date.now()}.xlsx`);
		},
		[listQueryInput, exportItemPriceStockExcel],
	);

	const { table } = useAdvancedDataTable<ItemPriceStockRow>({
		data: rows,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "availableQty", desc: true }],
		enableRowSelection: false,
		enableMultiRowSelection: false,
		enableGlobalFilter: false,
		onReload: handleReload,
		getRowId: (row) => row.id,
	});

	const hasActiveFilters = React.useMemo(
		() =>
			(Object.keys(INITIAL_FILTERS) as Array<keyof FilterState>).some(
				(key) => filters[key] !== INITIAL_FILTERS[key],
			),
		[filters],
	);

	const handleRealtimeInventoryData = React.useCallback(() => {
		void utils.inventory.listItemPriceStock.invalidate(listQueryInput);
	}, [listQueryInput, utils.inventory.listItemPriceStock]);

	const handleRealtimeItemData = React.useCallback(
		(event: Inventory.Item | { id: string }) => {
			const itemCodeFilter = listQueryInput.itemCode?.trim().toLowerCase();

			if (itemCodeFilter && "code" in event) {
				if (!event.code.toLowerCase().includes(itemCodeFilter)) {
					return;
				}
			}

			void utils.inventory.listItemPriceStock.invalidate(listQueryInput);
		},
		[listQueryInput, utils.inventory.listItemPriceStock],
	);

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<ItemPriceStockRealtimeSubscriptions
				scope={realtimeScope}
				onInventoryData={handleRealtimeInventoryData}
				onItemData={handleRealtimeItemData}
			/>

			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Item Price Stock
					</h1>
					<p className="text-muted-foreground">
						Review stock availability alongside standard buying and selling
						rates.
					</p>
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
					<Input
						value={filters.warehouse}
						onChange={(event) => updateFilter("warehouse", event.target.value)}
						placeholder="Warehouse"
						aria-label="Filter by warehouse"
					/>
					<Select
						value={filters.currency}
						onValueChange={(value) =>
							updateFilter("currency", value as ItemPriceStockCurrency)
						}
					>
						<SelectTrigger aria-label="Currency">
							<SelectValue placeholder="Currency" />
						</SelectTrigger>
						<SelectContent>
							{ITEM_PRICE_STOCK_CURRENCY_OPTIONS.map((option) => (
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

			<div className="rounded-lg border bg-background p-4">
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
				</div>
				<div className="mt-4 flex items-center gap-4">
					<Skeleton className="h-5 w-40" />
				</div>
			</div>

			<DataTableSkeleton columnCount={11} filterCount={6} rowCount={10} />

			{queryError && !isLoading && (
				<ErrorState
					error={queryError}
					operation="load"
					title="Failed to load item price stock"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={rows}
					enableExport
					onExport={handleExport}
					enableVirtualization
					enableColumnResizing
					enableBulkActions={false}
					enableGlobalSearch={false}
					ariaLabel="Item price stock table"
				/>
			)}
		</div>
	);
}
