"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import { Ellipsis, Filter, FolderPlus, RotateCcw } from "lucide-react";
import * as React from "react";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { downloadExcelBuffer } from "@/components/advanced-data-table/utils";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import {
	applyWarehouseWiseFilterRules,
	formatCompactDate,
	formatOptionalText,
	formatWarehouseWiseStockCurrency,
	formatWarehouseWiseStockQuantity,
	groupWarehouseWiseRows,
	sortWarehouseWiseRows,
	toWarehouseWiseDetailRows,
	WAREHOUSE_WISE_FILTER_FIELD_OPTIONS,
	WAREHOUSE_WISE_FILTER_OPERATOR_OPTIONS,
	WAREHOUSE_WISE_GROUP_BY_OPTIONS,
	WAREHOUSE_WISE_GROUP_METRIC_OPTIONS,
	WAREHOUSE_WISE_STOCK_BALANCE_CURRENCY_OPTIONS,
	WAREHOUSE_WISE_STOCK_BALANCE_STATUS_OPTIONS,
	WAREHOUSE_WISE_STOCK_SORT_OPTIONS,
	type WarehouseWiseDisplayRow,
	type WarehouseWiseFilterField,
	type WarehouseWiseFilterOperator,
	type WarehouseWiseFilterRule,
	type WarehouseWiseGroupByField,
	type WarehouseWiseGroupMetric,
	type WarehouseWiseStockBalanceCurrency,
	type WarehouseWiseStockBalanceStatus,
	type WarehouseWiseStockSortBy,
} from "./warehouse-wise-stock-balance.utils";

type WarehouseWiseSubscriptionEvent = {
	type: "created" | "updated" | "deleted";
	data: {
		id: string;
		company?: string | null;
		warehouses: string[];
		itemCodes: string[];
	};
};

type FilterState = {
	id: string;
	itemCode: string;
	warehouse: string;
	voucherNo: string;
	company: string;
	dateFrom: string;
	dateTo: string;
	status: WarehouseWiseStockBalanceStatus;
	currency: WarehouseWiseStockBalanceCurrency;
	sortBy: WarehouseWiseStockSortBy;
};

const INITIAL_FILTERS: FilterState = {
	id: "",
	itemCode: "",
	warehouse: "",
	voucherNo: "",
	company: "",
	dateFrom: "",
	dateTo: "",
	status: "SUBMITTED",
	currency: "INR",
	sortBy: "LAST_UPDATED_ON",
};

function createFilterRule(): WarehouseWiseFilterRule {
	return {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		field: "itemCode",
		operator: "contains",
		value: "",
	};
}

function WarehouseWiseRealtimeSubscription({
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
	onData?: (event: WarehouseWiseSubscriptionEvent) => void;
}) {
	trpc.inventory.onStockEntriesChanged.useSubscription(scope, {
		onData,
	});

	return null;
}

export default function WarehouseWiseStockBalancePage() {
	const utils = trpc.useUtils();
	const [filters, setFilters] = React.useState<FilterState>({
		...INITIAL_FILTERS,
	});
	const [filterDialogOpen, setFilterDialogOpen] = React.useState(false);
	const [groupDialogOpen, setGroupDialogOpen] = React.useState(false);
	const [appliedRules, setAppliedRules] = React.useState<
		WarehouseWiseFilterRule[]
	>([]);
	const [draftRules, setDraftRules] = React.useState<WarehouseWiseFilterRule[]>(
		[],
	);
	const [groupBy, setGroupBy] =
		React.useState<WarehouseWiseGroupByField | null>(null);
	const [draftGroupBy, setDraftGroupBy] =
		React.useState<WarehouseWiseGroupByField>("warehouse");
	const [groupMetric, setGroupMetric] =
		React.useState<WarehouseWiseGroupMetric>("count");
	const [draftGroupMetric, setDraftGroupMetric] =
		React.useState<WarehouseWiseGroupMetric>("count");
	const [showTotals, setShowTotals] = React.useState(false);

	const updateFilter = React.useCallback(
		<Key extends keyof FilterState>(key: Key, value: FilterState[Key]) => {
			setFilters((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	const listQueryInput = React.useMemo(() => {
		const itemCode = filters.itemCode.trim();
		const warehouse = filters.warehouse.trim();
		const voucherNo = filters.voucherNo.trim();
		const company = filters.company.trim();

		return {
			take: 250,
			status: filters.status,
			itemCode: itemCode || undefined,
			warehouse: warehouse || undefined,
			voucherNo: voucherNo || undefined,
			company: company || undefined,
			dateFrom: filters.dateFrom
				? new Date(`${filters.dateFrom}T00:00:00.000Z`)
				: undefined,
			dateTo: filters.dateTo
				? new Date(`${filters.dateTo}T23:59:59.999Z`)
				: undefined,
		};
	}, [
		filters.company,
		filters.dateFrom,
		filters.dateTo,
		filters.itemCode,
		filters.status,
		filters.voucherNo,
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
	} = trpc.inventory.listWarehouseWiseStockBalance.useQuery(listQueryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const normalizedRows = React.useMemo(
		() =>
			rawRows.map((row: (typeof rawRows)[number]) => ({
				...row,
				postingDate: new Date(row.postingDate),
				createdAt: new Date(row.createdAt),
				updatedAt: new Date(row.updatedAt),
			})),
		[rawRows],
	);

	const filteredRows = React.useMemo(() => {
		const idFilter = filters.id.trim();
		const rules =
			idFilter.length === 0
				? appliedRules
				: [
						...appliedRules,
						{
							id: "quick-id",
							field: "id" as const,
							operator: "contains" as const,
							value: idFilter,
						},
					];

		return applyWarehouseWiseFilterRules(
			sortWarehouseWiseRows(normalizedRows, filters.sortBy),
			rules,
		);
	}, [appliedRules, filters.id, filters.sortBy, normalizedRows]);

	const displayRows = React.useMemo<WarehouseWiseDisplayRow[]>(() => {
		if (groupBy == null) return toWarehouseWiseDetailRows(filteredRows);
		return groupWarehouseWiseRows(filteredRows, groupBy);
	}, [filteredRows, groupBy]);

	const columns = React.useMemo<ColumnDef<WarehouseWiseDisplayRow>[]>(() => {
		if (groupBy != null) {
			return [
				{
					accessorKey: "groupValue",
					header: ({ column }) => (
						<DataTableColumnHeader column={column} title="Group" />
					),
					cell: ({ row }) => {
						if (row.original.kind !== "group") return "-";
						return (
							<span className="font-medium">{row.original.groupValue}</span>
						);
					},
					meta: { label: "Group", searchable: true, exportable: true },
				},
				{
					accessorKey: "count",
					header: ({ column }) => (
						<DataTableColumnHeader column={column} title="Count" />
					),
					cell: ({ row }) =>
						row.original.kind === "group" ? row.original.count : "-",
					meta: { label: "Count", exportable: true },
				},
				{
					id: "metric",
					header: ({ column }) => (
						<DataTableColumnHeader
							column={column}
							title={
								groupMetric === "count"
									? "Count"
									: groupMetric === "qtyChange"
										? "Qty Change"
										: "Avg Incoming Rate"
							}
						/>
					),
					cell: ({ row }) => {
						if (row.original.kind !== "group") return "-";
						if (groupMetric === "count") return row.original.count;
						if (groupMetric === "qtyChange") {
							return formatWarehouseWiseStockQuantity(
								row.original.totalQtyChange,
							);
						}
						return formatWarehouseWiseStockCurrency(
							row.original.averageIncomingRate,
							filters.currency,
						);
					},
					meta: { label: "Metric", exportable: true },
				},
			];
		}

		return [
			{
				accessorKey: "id",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="ID" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail" ? (
						<span className="font-medium">{row.original.id}</span>
					) : (
						"-"
					),
				meta: { label: "ID", searchable: true, exportable: true },
			},
			{
				accessorKey: "itemCode",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Code" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail"
						? row.original.itemCode
						: row.original.groupValue,
				meta: { label: "Item Code", searchable: true, exportable: true },
			},
			{
				accessorKey: "warehouse",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Warehouse" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail"
						? formatOptionalText(row.original.warehouse)
						: "-",
				meta: { label: "Warehouse", exportable: true },
			},
			{
				accessorKey: "postingDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Posting Date" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail"
						? formatCompactDate(row.original.postingDate)
						: "-",
				meta: { label: "Posting Date", variant: "date", exportable: true },
			},
			{
				accessorKey: "voucherNo",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Voucher No" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail" ? row.original.voucherNo : "-",
				meta: { label: "Voucher No", exportable: true },
			},
			{
				accessorKey: "qtyChange",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Qty Change" />
				),
				cell: ({ row }) => {
					if (row.original.kind !== "detail") return "-";
					return (
						<span
							className={
								row.original.qtyChange < 0
									? "text-amber-700 dark:text-amber-300"
									: "text-emerald-700 dark:text-emerald-300"
							}
						>
							{formatWarehouseWiseStockQuantity(row.original.qtyChange)}
						</span>
					);
				},
				meta: { label: "Qty Change", exportable: true },
			},
			{
				accessorKey: "incomingRate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Incoming Rate" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail"
						? formatWarehouseWiseStockCurrency(
								row.original.incomingRate,
								filters.currency,
							)
						: "-",
				meta: { label: "Incoming Rate", exportable: true },
			},
			{
				accessorKey: "company",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company" />
				),
				cell: ({ row }) =>
					row.original.kind === "detail" ? row.original.company : "-",
				meta: { label: "Company", exportable: true },
			},
		];
	}, [filters.currency, groupBy, groupMetric]);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<WarehouseWiseDisplayRow>({
		data: displayRows,
		columns,
		initialPageSize: 20,
		initialSorting: [
			{ id: groupBy == null ? "postingDate" : "count", desc: true },
		],
		enableRowSelection: false,
		enableMultiRowSelection: false,
		enableGlobalFilter: false,
		onReload: handleReload,
		getRowId: (row) => row.id,
	});

	const exportWarehouseWiseStockBalanceExcel =
		trpc.inventory.exportWarehouseWiseStockBalanceExcel.useMutation();

	const handleExport = React.useCallback(
		async (format: string, _rows: readonly Row<WarehouseWiseDisplayRow>[]) => {
			if (format !== "excel") return;
			const buffer = (await exportWarehouseWiseStockBalanceExcel.mutateAsync(
				listQueryInput,
			)) as ArrayBuffer;
			downloadExcelBuffer(buffer, `warehouse-wise-stock-${Date.now()}.xlsx`);
		},
		[listQueryInput, exportWarehouseWiseStockBalanceExcel],
	);

	const hasActiveFilters = React.useMemo(
		() =>
			(Object.keys(INITIAL_FILTERS) as Array<keyof FilterState>).some(
				(key) => filters[key] !== INITIAL_FILTERS[key],
			) ||
			appliedRules.length > 0 ||
			groupBy != null,
		[appliedRules.length, filters, groupBy],
	);

	const totals = React.useMemo(
		() =>
			filteredRows.reduce(
				(accumulator, row) => {
					accumulator.rows += 1;
					accumulator.qtyChange += row.qtyChange;
					accumulator.incomingRate += row.incomingRate;
					return accumulator;
				},
				{ rows: 0, qtyChange: 0, incomingRate: 0 },
			),
		[filteredRows],
	);

	const averageIncomingRate =
		totals.rows === 0 ? 0 : totals.incomingRate / totals.rows;

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<WarehouseWiseRealtimeSubscription
				scope={realtimeScope}
				onData={() => {
					void utils.inventory.listWarehouseWiseStockBalance.invalidate(
						listQueryInput,
					);
				}}
			/>

			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Warehouse Wise Stock Balance
					</h1>
					<p className="text-muted-foreground">
						Track warehouse-level stock movements with filter, grouping, and
						sort controls.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={() => void refetch()}>
						<RotateCcw className="mr-2 size-4" />
						Refresh
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon" aria-label="Report actions">
								<Ellipsis className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuCheckboxItem
								checked={showTotals}
								onCheckedChange={(checked) => setShowTotals(checked === true)}
							>
								Show Totals
							</DropdownMenuCheckboxItem>
							<DropdownMenuItem
								onClick={() => {
									if (typeof window !== "undefined") {
										window.print();
									}
								}}
							>
								Print
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<div className="rounded-lg border bg-background p-4">
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
					<Input
						value={filters.id}
						onChange={(event) => updateFilter("id", event.target.value)}
						placeholder="ID"
						aria-label="Filter by id"
					/>
					<Input
						value={filters.itemCode}
						onChange={(event) => updateFilter("itemCode", event.target.value)}
						placeholder="Item Code"
						aria-label="Filter by item code"
					/>
					<Input
						value={filters.warehouse}
						onChange={(event) => updateFilter("warehouse", event.target.value)}
						placeholder="Warehouse"
						aria-label="Filter by warehouse"
					/>
					<Input
						value={filters.voucherNo}
						onChange={(event) => updateFilter("voucherNo", event.target.value)}
						placeholder="Voucher No"
						aria-label="Filter by voucher no"
					/>
					<Input
						value={filters.company}
						onChange={(event) => updateFilter("company", event.target.value)}
						placeholder="Company"
						aria-label="Filter by company"
					/>
					<Input
						type="date"
						value={filters.dateFrom}
						onChange={(event) => updateFilter("dateFrom", event.target.value)}
						aria-label="Filter from date"
					/>
					<Input
						type="date"
						value={filters.dateTo}
						onChange={(event) => updateFilter("dateTo", event.target.value)}
						aria-label="Filter to date"
					/>
					<Select
						value={filters.status}
						onValueChange={(value) =>
							updateFilter("status", value as WarehouseWiseStockBalanceStatus)
						}
					>
						<SelectTrigger aria-label="Filter by status">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							{WAREHOUSE_WISE_STOCK_BALANCE_STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="mt-4 flex flex-wrap items-center gap-2">
					<Popover
						open={filterDialogOpen}
						onOpenChange={(open) => {
							setFilterDialogOpen(open);
							if (open) {
								setDraftRules(
									appliedRules.length === 0
										? [createFilterRule()]
										: appliedRules,
								);
							}
						}}
					>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm">
								<Filter className="mr-2 size-4" />
								Filter
							</Button>
						</PopoverTrigger>
						<PopoverContent align="start" className="w-[640px] space-y-4">
							<div className="space-y-2">
								{draftRules.map((rule) => (
									<div key={rule.id} className="grid grid-cols-12 gap-2">
										<Select
											value={rule.field}
											onValueChange={(value) => {
												setDraftRules((current) =>
													current.map((entry) =>
														entry.id === rule.id
															? {
																	...entry,
																	field: value as WarehouseWiseFilterField,
																}
															: entry,
													),
												);
											}}
										>
											<SelectTrigger
												className="col-span-4"
												aria-label="Filter field"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{WAREHOUSE_WISE_FILTER_FIELD_OPTIONS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<Select
											value={rule.operator}
											onValueChange={(value) => {
												setDraftRules((current) =>
													current.map((entry) =>
														entry.id === rule.id
															? {
																	...entry,
																	operator:
																		value as WarehouseWiseFilterOperator,
																}
															: entry,
													),
												);
											}}
										>
											<SelectTrigger
												className="col-span-3"
												aria-label="Filter operator"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{WAREHOUSE_WISE_FILTER_OPERATOR_OPTIONS.map(
													(option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													),
												)}
											</SelectContent>
										</Select>
										<Input
											className="col-span-4"
											value={rule.value}
											onChange={(event) => {
												setDraftRules((current) =>
													current.map((entry) =>
														entry.id === rule.id
															? { ...entry, value: event.target.value }
															: entry,
													),
												);
											}}
											placeholder="Value"
											aria-label="Filter value"
										/>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => {
												setDraftRules((current) =>
													current.filter((entry) => entry.id !== rule.id),
												);
											}}
											aria-label="Remove filter"
										>
											×
										</Button>
									</div>
								))}
							</div>
							<Separator />
							<div className="flex items-center justify-between">
								<Button
									variant="ghost"
									onClick={() => {
										setDraftRules((current) => [
											...current,
											createFilterRule(),
										]);
									}}
								>
									+ Add a Filter
								</Button>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										onClick={() => {
											setAppliedRules([]);
											setDraftRules([createFilterRule()]);
										}}
									>
										Clear Filters
									</Button>
									<Button
										onClick={() => {
											setAppliedRules(
												draftRules.filter(
													(rule) => rule.value.trim().length > 0,
												),
											);
											setFilterDialogOpen(false);
										}}
									>
										Apply Filters
									</Button>
								</div>
							</div>
						</PopoverContent>
					</Popover>

					<Popover
						open={groupDialogOpen}
						onOpenChange={(open) => {
							setGroupDialogOpen(open);
							if (open) {
								setDraftGroupBy(groupBy ?? "warehouse");
								setDraftGroupMetric(groupMetric);
							}
						}}
					>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm">
								<FolderPlus className="mr-2 size-4" />
								Add Group
							</Button>
						</PopoverTrigger>
						<PopoverContent align="start" className="w-96 space-y-4">
							<div className="grid gap-3">
								<Select
									value={draftGroupBy}
									onValueChange={(value) =>
										setDraftGroupBy(value as WarehouseWiseGroupByField)
									}
								>
									<SelectTrigger aria-label="Select group by">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{WAREHOUSE_WISE_GROUP_BY_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select
									value={draftGroupMetric}
									onValueChange={(value) =>
										setDraftGroupMetric(value as WarehouseWiseGroupMetric)
									}
								>
									<SelectTrigger aria-label="Group metric">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{WAREHOUSE_WISE_GROUP_METRIC_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-center justify-end gap-2">
								<Button
									variant="outline"
									onClick={() => {
										setGroupBy(null);
										setGroupDialogOpen(false);
									}}
								>
									Clear Group
								</Button>
								<Button
									onClick={() => {
										setGroupBy(draftGroupBy);
										setGroupMetric(draftGroupMetric);
										setGroupDialogOpen(false);
									}}
								>
									Apply Group
								</Button>
							</div>
						</PopoverContent>
					</Popover>

					<Select
						value={filters.sortBy}
						onValueChange={(value) =>
							updateFilter("sortBy", value as WarehouseWiseStockSortBy)
						}
					>
						<SelectTrigger className="w-[220px]" aria-label="Sort report rows">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{WAREHOUSE_WISE_STOCK_SORT_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={filters.currency}
						onValueChange={(value) =>
							updateFilter(
								"currency",
								value as WarehouseWiseStockBalanceCurrency,
							)
						}
					>
						<SelectTrigger className="w-[160px]" aria-label="Currency">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{WAREHOUSE_WISE_STOCK_BALANCE_CURRENCY_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Button
						variant="outline"
						disabled={!hasActiveFilters}
						onClick={() => {
							setFilters({ ...INITIAL_FILTERS });
							setAppliedRules([]);
							setDraftRules([]);
							setGroupBy(null);
						}}
					>
						Reset
					</Button>
				</div>
			</div>

			{showTotals ? (
				<div className="grid gap-4 md:grid-cols-3">
					<div className="rounded-lg border bg-background p-4">
						<div className="text-sm text-muted-foreground">Rows</div>
						<div className="mt-2 text-2xl font-semibold">{totals.rows}</div>
					</div>
					<div className="rounded-lg border bg-background p-4">
						<div className="text-sm text-muted-foreground">
							Total Qty Change
						</div>
						<div className="mt-2 text-2xl font-semibold">
							{formatWarehouseWiseStockQuantity(totals.qtyChange)}
						</div>
					</div>
					<div className="rounded-lg border bg-background p-4">
						<div className="text-sm text-muted-foreground">
							Average Incoming Rate
						</div>
						<div className="mt-2 text-2xl font-semibold">
							{formatWarehouseWiseStockCurrency(
								averageIncomingRate,
								filters.currency,
							)}
						</div>
					</div>
				</div>
			) : null}

			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
				</div>
			) : null}

			{queryError && !isLoading ? (
				<ErrorState
					error={queryError}
					operation="load"
					title="Failed to load warehouse wise stock balance"
					onRetry={() => void refetch()}
				/>
			) : null}

			{!isLoading && !queryError ? (
				<AdvancedDataTable
					table={table}
					data={displayRows}
					enableExport
					onExport={handleExport}
					enableVirtualization
					enableColumnResizing
					enableBulkActions={false}
					enableGlobalSearch={false}
					ariaLabel="Warehouse wise stock balance table"
				/>
			) : null}
		</div>
	);
}
