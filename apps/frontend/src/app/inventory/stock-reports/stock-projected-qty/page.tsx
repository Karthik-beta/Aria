"use client";

import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
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
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import {
	formatCompactDate,
	formatOptionalText,
	formatProjectedQtyQuantity,
	formatRelativeAge,
	STOCK_PROJECTED_QTY_CURRENCY_OPTIONS,
	type StockProjectedQtyCurrency,
	type StockProjectedQtyRow,
} from "./stock-projected-qty.utils";

type StockProjectedQtySubscriptionEvent = {
	type: "created" | "updated" | "deleted";
	data: {
		id: string;
		company?: string | null;
		warehouses: string[];
		itemCodes: string[];
	};
};

type UomDisplayPreference = "INCLUDE" | "HIDE";

type FilterState = {
	company: string;
	warehouse: string;
	itemCode: string;
	itemGroup: string;
	brand: string;
	includeUom: UomDisplayPreference;
	currency: StockProjectedQtyCurrency;
	includeZeroStockItems: boolean;
};

const INITIAL_FILTERS: FilterState = {
	company: "",
	warehouse: "",
	itemCode: "",
	itemGroup: "",
	brand: "",
	includeUom: "INCLUDE",
	currency: "INR",
	includeZeroStockItems: false,
};

function StockProjectedQtyRealtimeSubscription({
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
	onData?: (event: StockProjectedQtySubscriptionEvent) => void;
}) {
	trpc.inventory.onStockEntriesChanged.useSubscription(scope, {
		onData,
	});

	return null;
}

export default function StockProjectedQtyPage() {
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
	} = trpc.inventory.listStockProjectedQty.useQuery(listQueryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const rows = React.useMemo<StockProjectedQtyRow[]>(
		() =>
			rawRows.map((row: (typeof rawRows)[number]) => ({
				...row,
				lastActivityDate: row.lastActivityDate
					? new Date(row.lastActivityDate)
					: null,
			})),
		[rawRows],
	);

	const showUom = filters.includeUom === "INCLUDE";

	const columns = React.useMemo<ColumnDef<StockProjectedQtyRow>[]>(() => {
		const projectedColumns: ColumnDef<StockProjectedQtyRow>[] = [
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
			{
				accessorKey: "warehouse",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Warehouse" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.warehouse}
					</span>
				),
				meta: { label: "Warehouse", exportable: true },
			},
		];

		if (showUom) {
			projectedColumns.push({
				accessorKey: "unitOfMeasure",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Stock UOM" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatOptionalText(row.original.unitOfMeasure)}
					</span>
				),
				meta: { label: "Stock UOM", exportable: true },
			});
		}

		projectedColumns.push(
			{
				accessorKey: "actualQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Actual Qty" />
				),
				cell: ({ row }) => formatProjectedQtyQuantity(row.original.actualQty),
				meta: { label: "Actual Qty", exportable: true },
			},
			{
				accessorKey: "plannedQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Planned Qty" />
				),
				cell: ({ row }) => formatProjectedQtyQuantity(row.original.plannedQty),
				meta: { label: "Planned Qty", exportable: true },
			},
			{
				accessorKey: "requestedQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Requested Qty" />
				),
				cell: ({ row }) =>
					formatProjectedQtyQuantity(row.original.requestedQty),
				meta: { label: "Requested Qty", exportable: true },
			},
			{
				accessorKey: "orderedQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Ordered Qty" />
				),
				cell: ({ row }) => formatProjectedQtyQuantity(row.original.orderedQty),
				meta: { label: "Ordered Qty", exportable: true },
			},
			{
				accessorKey: "reservedQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Reserved Qty" />
				),
				cell: ({ row }) => formatProjectedQtyQuantity(row.original.reservedQty),
				meta: { label: "Reserved Qty", exportable: true },
			},
			{
				accessorKey: "reservedQtyForProduction",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Reserved for Production"
					/>
				),
				cell: ({ row }) =>
					formatProjectedQtyQuantity(row.original.reservedQtyForProduction),
				meta: { label: "Reserved for Production", exportable: true },
			},
			{
				accessorKey: "reservedQtyForSubcontracting",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Reserved for Subcontract"
					/>
				),
				cell: ({ row }) =>
					formatProjectedQtyQuantity(row.original.reservedQtyForSubcontracting),
				meta: { label: "Reserved for Subcontract", exportable: true },
			},
			{
				accessorKey: "reservedQtyForProductionPlan",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Reserved for Production Plan"
					/>
				),
				cell: ({ row }) =>
					formatProjectedQtyQuantity(row.original.reservedQtyForProductionPlan),
				meta: { label: "Reserved for Production Plan", exportable: true },
			},
			{
				accessorKey: "projectedQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Projected Qty" />
				),
				cell: ({ row }) => (
					<span className="font-medium">
						{formatProjectedQtyQuantity(row.original.projectedQty)}
					</span>
				),
				meta: { label: "Projected Qty", exportable: true },
			},
			{
				accessorKey: "reorderLevel",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Reorder Level" />
				),
				cell: ({ row }) =>
					formatProjectedQtyQuantity(row.original.reorderLevel),
				meta: { label: "Reorder Level", exportable: true },
			},
			{
				accessorKey: "reorderQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Reorder Qty" />
				),
				cell: ({ row }) => formatProjectedQtyQuantity(row.original.reorderQty),
				meta: { label: "Reorder Qty", exportable: true },
			},
			{
				accessorKey: "shortageQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Shortage Qty" />
				),
				cell: ({ row }) => (
					<span className="text-destructive">
						{formatProjectedQtyQuantity(row.original.shortageQty)}
					</span>
				),
				meta: { label: "Shortage Qty", exportable: true },
			},
			{
				accessorKey: "lastActivityDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Last Activity" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatCompactDate(row.original.lastActivityDate)}
					</span>
				),
				meta: { label: "Last Activity", variant: "date", exportable: true },
			},
			{
				id: "age",
				accessorFn: (row) => row.lastActivityDate,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Age" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatRelativeAge(row.original.lastActivityDate)}
					</span>
				),
				meta: { label: "Age", variant: "date", exportable: true },
			},
		);

		return projectedColumns;
	}, [showUom]);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<StockProjectedQtyRow>({
		data: rows,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "shortageQty", desc: true }],
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

	const totals = React.useMemo(
		() =>
			rows.reduce(
				(accumulator, row) => {
					accumulator.actualQty += row.actualQty;
					accumulator.projectedQty += row.projectedQty;
					accumulator.shortageQty += row.shortageQty;
					accumulator.shortageItems += row.shortageQty > 0 ? 1 : 0;
					return accumulator;
				},
				{ actualQty: 0, projectedQty: 0, shortageQty: 0, shortageItems: 0 },
			),
		[rows],
	);

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<StockProjectedQtyRealtimeSubscription
				scope={realtimeScope}
				onData={() => {
					void utils.inventory.listStockProjectedQty.invalidate(listQueryInput);
				}}
			/>

			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Stock Projected Qty
					</h1>
					<p className="text-muted-foreground">
						Track projected availability across warehouse stock, inbound demand,
						reservations, and reorder thresholds.
					</p>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Actual Qty</div>
					<div className="mt-2 text-2xl font-semibold">
						{formatProjectedQtyQuantity(totals.actualQty)}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Projected Qty</div>
					<div className="mt-2 text-2xl font-semibold">
						{formatProjectedQtyQuantity(totals.projectedQty)}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">Shortage Qty</div>
					<div className="mt-2 text-2xl font-semibold text-destructive">
						{formatProjectedQtyQuantity(totals.shortageQty)}
					</div>
				</div>
				<div className="rounded-lg border bg-background p-4">
					<div className="text-sm text-muted-foreground">
						Items Below Reorder
					</div>
					<div className="mt-2 text-2xl font-semibold">
						{totals.shortageItems}
					</div>
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
					<Select
						value={filters.includeUom}
						onValueChange={(value) =>
							updateFilter("includeUom", value as UomDisplayPreference)
						}
					>
						<SelectTrigger aria-label="Include UOM">
							<SelectValue placeholder="Include UOM" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="INCLUDE">Include UOM</SelectItem>
							<SelectItem value="HIDE">Hide UOM</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
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
						<Select
							value={filters.currency}
							onValueChange={(value) =>
								updateFilter("currency", value as StockProjectedQtyCurrency)
							}
						>
							<SelectTrigger aria-label="Currency" className="w-full md:w-32">
								<SelectValue placeholder="Currency" />
							</SelectTrigger>
							<SelectContent>
								{STOCK_PROJECTED_QTY_CURRENCY_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
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

			{isLoading && (
				<div className="flex items-center justify-center py-12">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
				</div>
			)}

			{queryError && !isLoading && (
				<ErrorState
					error={queryError}
					operation="load"
					title="Failed to load stock projected quantity"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={rows}
					enableExport
					enableVirtualization
					enableColumnResizing
					enableBulkActions={false}
					enableGlobalSearch={false}
					ariaLabel="Stock projected quantity table"
				/>
			)}
		</div>
	);
}
