"use client";

import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import {
	Cell,
	Label,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { downloadExcelBuffer } from "@/components/advanced-data-table/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import {
	buildDonutChartData,
	formatAmount,
	formatDurationSeconds,
	formatQty,
	getChartColor,
	getDefaultFromDate,
	getDefaultToDate,
	getDelayClass,
	getDeliveredClass,
	type SalesOrderAnalysisRow,
	type SalesOrderAnalysisStatus,
	STATUS_OPTIONS,
} from "./sales-order-analysis.utils";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type FilterState = {
	company: string;
	fromDate: string;
	toDate: string;
	status: SalesOrderAnalysisStatus[];
	warehouse: string;
	salesOrders: string;
	groupBySalesOrder: boolean;
};

const INITIAL_FILTERS: FilterState = {
	company: "",
	fromDate: getDefaultFromDate(),
	toDate: getDefaultToDate(),
	status: [],
	warehouse: "",
	salesOrders: "",
	groupBySalesOrder: false,
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

export default function SalesOrderAnalysisPage() {
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

		const salesOrders = filters.salesOrders
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		return {
			company: filters.company.trim(),
			fromDate: new Date(`${filters.fromDate}T00:00:00.000Z`),
			toDate: new Date(`${filters.toDate}T23:59:59.999Z`),
			status: filters.status.length > 0 ? filters.status : undefined,
			warehouse: filters.warehouse.trim() || undefined,
			salesOrders: salesOrders.length > 0 ? salesOrders : undefined,
			groupBySalesOrder: filters.groupBySalesOrder,
		};
	}, [
		validationError,
		filters.company,
		filters.fromDate,
		filters.toDate,
		filters.status,
		filters.warehouse,
		filters.salesOrders,
		filters.groupBySalesOrder,
	]);

	const {
		data: result,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listSalesOrderAnalysis.useQuery(
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled
		queryInput!,
		{
			enabled: queryInput != null,
			refetchOnWindowFocus: false,
			retry: 2,
			staleTime: 60_000,
		},
	);

	const rows: SalesOrderAnalysisRow[] = React.useMemo(
		() => result?.rows ?? [],
		[result],
	);

	const donutData = React.useMemo(
		() => (result?.summary ? buildDonutChartData(result.summary) : []),
		[result],
	);

	const totalBilled = result?.summary.totalBilledAmount ?? 0;
	const totalPending = result?.summary.totalPendingAmount ?? 0;
	const grouped = filters.groupBySalesOrder;

	// ---------------------------------------------------------------------------
	// Columns
	// ---------------------------------------------------------------------------

	const columns = React.useMemo<ColumnDef<SalesOrderAnalysisRow>[]>(() => {
		const cols: ColumnDef<SalesOrderAnalysisRow>[] = [
			{
				accessorKey: "date",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Date" />
				),
				cell: ({ row }) => (
					<span className="tabular-nums text-sm">
						{new Date(row.original.date).toLocaleDateString("en-IN")}
					</span>
				),
				meta: { label: "Date", exportable: true },
			},
			{
				accessorKey: "salesOrder",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Sales Order" />
				),
				cell: ({ row }) => (
					<span className="font-medium">{row.original.salesOrder}</span>
				),
				meta: { label: "Sales Order", searchable: true, exportable: true },
			},
			{
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => (
					<span className="text-sm">
						{STATUS_OPTIONS.find((o) => o.value === row.original.status)
							?.label ?? row.original.status}
					</span>
				),
				meta: { label: "Status", exportable: true },
			},
			{
				accessorKey: "customer",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Customer" />
				),
				cell: ({ row }) => (
					<span className="text-sm">{row.original.customer}</span>
				),
				meta: { label: "Customer", searchable: true, exportable: true },
			},
		];

		if (!grouped) {
			cols.push({
				accessorKey: "itemCode",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Code" />
				),
				cell: ({ row }) => (
					<span className="text-sm">{row.original.itemCode ?? "—"}</span>
				),
				meta: { label: "Item Code", searchable: true, exportable: true },
			});
			cols.push({
				accessorKey: "description",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Description" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.description ?? "—"}
					</span>
				),
				meta: { label: "Description", exportable: true },
			});
		}

		cols.push(
			{
				accessorKey: "qty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Qty" />
				),
				cell: ({ row }) => (
					<span className="tabular-nums text-sm">
						{formatQty(row.original.qty)}
					</span>
				),
				meta: { label: "Qty", exportable: true },
			},
			{
				accessorKey: "deliveredQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Delivered Qty" />
				),
				cell: ({ row }) => (
					<span
						className={`tabular-nums text-sm ${getDeliveredClass(row.original.deliveredQty)}`}
					>
						{formatQty(row.original.deliveredQty)}
					</span>
				),
				meta: { label: "Delivered Qty", exportable: true },
			},
			{
				accessorKey: "pendingQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Pending Qty" />
				),
				cell: ({ row }) => (
					<span className="tabular-nums text-sm">
						{formatQty(row.original.pendingQty)}
					</span>
				),
				meta: { label: "Pending Qty", exportable: true },
			},
			{
				accessorKey: "billedQty",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Billed Qty" />
				),
				cell: ({ row }) => (
					<span
						className={`tabular-nums text-sm ${getDeliveredClass(row.original.billedQty)}`}
					>
						{formatQty(row.original.billedQty)}
					</span>
				),
				meta: { label: "Billed Qty", exportable: true },
			},
			{
				accessorKey: "qtyToBill",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Qty to Bill" />
				),
				cell: ({ row }) => (
					<span className="tabular-nums text-sm">
						{formatQty(row.original.qtyToBill)}
					</span>
				),
				meta: { label: "Qty to Bill", exportable: true },
			},
			{
				accessorKey: "amount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Amount" />
				),
				cell: ({ row }) => (
					<span className="tabular-nums text-sm">
						{formatAmount(row.original.amount)}
					</span>
				),
				meta: { label: "Amount", exportable: true },
			},
			{
				accessorKey: "deliveredQtyAmount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Delivered Amount" />
				),
				cell: ({ row }) => (
					<span
						className={`tabular-nums text-sm ${getDeliveredClass(row.original.deliveredQtyAmount)}`}
					>
						{formatAmount(row.original.deliveredQtyAmount)}
					</span>
				),
				meta: { label: "Delivered Amount", exportable: true },
			},
			{
				accessorKey: "billedAmount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Billed Amount" />
				),
				cell: ({ row }) => (
					<span
						className={`tabular-nums text-sm ${getDeliveredClass(row.original.billedAmount)}`}
					>
						{formatAmount(row.original.billedAmount)}
					</span>
				),
				meta: { label: "Billed Amount", exportable: true },
			},
			{
				accessorKey: "pendingAmount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Pending Amount" />
				),
				cell: ({ row }) => (
					<span
						className={`tabular-nums text-sm ${row.original.pendingAmount > 0 ? "text-destructive font-medium" : ""}`}
					>
						{formatAmount(row.original.pendingAmount)}
					</span>
				),
				meta: { label: "Pending Amount", exportable: true },
			},
			{
				accessorKey: "deliveryDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Delivery Date" />
				),
				cell: ({ row }) => (
					<span className="tabular-nums text-sm">
						{new Date(row.original.deliveryDate).toLocaleDateString("en-IN")}
					</span>
				),
				meta: { label: "Delivery Date", exportable: true },
			},
			{
				accessorKey: "delayDays",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Delay (Days)" />
				),
				cell: ({ row }) => (
					<span
						className={`tabular-nums text-sm ${getDelayClass(row.original.delayDays)}`}
					>
						{row.original.delayDays > 0
							? row.original.delayDays.toString()
							: "—"}
					</span>
				),
				meta: { label: "Delay (Days)", exportable: true },
			},
			{
				accessorKey: "timeTakenToDeliverSeconds",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Time to Deliver" />
				),
				cell: ({ row }) => (
					<span className="tabular-nums text-sm">
						{formatDurationSeconds(row.original.timeTakenToDeliverSeconds)}
					</span>
				),
				meta: { label: "Time to Deliver", exportable: true },
			},
		);

		if (!grouped) {
			cols.push({
				accessorKey: "warehouse",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Warehouse" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.warehouse ?? "—"}
					</span>
				),
				meta: { label: "Warehouse", exportable: true },
			});
		}

		cols.push({
			accessorKey: "company",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Company" />
			),
			cell: ({ row }) => (
				<span className="text-sm text-muted-foreground">
					{row.original.company}
				</span>
			),
			meta: { label: "Company", exportable: true },
		});

		return cols;
	}, [grouped]);

	// ---------------------------------------------------------------------------
	// Table
	// ---------------------------------------------------------------------------

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<SalesOrderAnalysisRow>({
		data: rows,
		columns,
		initialPageSize: 50,
		initialSorting: [{ id: "date", desc: true }],
		enableRowSelection: false,
		enableMultiRowSelection: false,
		enableGlobalFilter: false,
		onReload: handleReload,
		getRowId: (row) =>
			grouped ? row.salesOrderId : `${row.salesOrderId}_${row.itemCode ?? ""}`,
	});

	const listQueryInput = queryInput;
	const handleExport = React.useCallback(async () => {
		if (!listQueryInput) return;
		const buffer = await (
			trpc.inventory.exportSalesOrderAnalysisExcel as unknown as {
				mutate: (input: typeof listQueryInput) => Promise<Buffer>;
			}
		).mutate(listQueryInput);
		downloadExcelBuffer(buffer, `sales-order-analysis-${Date.now()}.xlsx`);
	}, [listQueryInput]);

	const hasActiveFilters = React.useMemo(
		() =>
			(Object.keys(INITIAL_FILTERS) as Array<keyof FilterState>).some((key) => {
				const current = filters[key];
				const initial = INITIAL_FILTERS[key];
				if (Array.isArray(current) && Array.isArray(initial)) {
					return current.length !== initial.length;
				}
				return current !== initial;
			}),
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
						Sales Order Analysis
					</h1>
					<p className="text-muted-foreground">
						Analyse sales order fulfilment, delivery delays, and billing status.
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
						value={filters.warehouse}
						onChange={(event) => updateFilter("warehouse", event.target.value)}
						placeholder="Warehouse"
						aria-label="Filter by warehouse"
					/>
					<Input
						value={filters.salesOrders}
						onChange={(event) =>
							updateFilter("salesOrders", event.target.value)
						}
						placeholder="Sales orders (comma-separated)"
						aria-label="Filter by sales orders"
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
				</div>

				{/* Status filter */}
				<div className="mt-3">
					<span className="mb-1.5 block text-sm text-muted-foreground">
						Status:
					</span>
					<div className="flex flex-wrap gap-3">
						{STATUS_OPTIONS.map((opt) => (
							<label
								key={opt.value}
								htmlFor={`status-${opt.value}`}
								className="flex cursor-pointer items-center gap-1.5 text-sm"
							>
								<Checkbox
									id={`status-${opt.value}`}
									checked={filters.status.includes(opt.value)}
									onCheckedChange={(checked) => {
										updateFilter(
											"status",
											checked
												? [...filters.status, opt.value]
												: filters.status.filter((s) => s !== opt.value),
										);
									}}
									aria-label={`Filter by status ${opt.label}`}
								/>
								{opt.label}
							</label>
						))}
					</div>
				</div>

				<div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<label
						htmlFor="group-by-sales-order"
						className="flex cursor-pointer items-center gap-2 text-sm"
					>
						<Checkbox
							id="group-by-sales-order"
							checked={filters.groupBySalesOrder}
							onCheckedChange={(checked) =>
								updateFilter("groupBySalesOrder", Boolean(checked))
							}
							aria-label="Group by sales order"
						/>
						Group by Sales Order
					</label>
					<Button
						variant="outline"
						onClick={resetFilters}
						disabled={!hasActiveFilters}
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
				<output aria-live="polite" className="block">
					<div className="flex items-center justify-center py-12 text-muted-foreground">
						<span className="animate-pulse">Loading sales order data…</span>
					</div>
				</output>
			) : null}

			{/* Error state */}
			{!isLoading && queryError ? (
				<ErrorState error={queryError} operation="load" />
			) : null}

			{/* Donut chart */}
			{!validationError &&
			!isLoading &&
			!queryError &&
			donutData.some((d) => d.value > 0) ? (
				<section
					className="rounded-lg border bg-background p-4"
					aria-label="Sales order billing summary chart"
				>
					<div className="mb-4">
						<h2 className="text-lg font-semibold">Billing Summary</h2>
						<p className="text-sm text-muted-foreground">
							Amount to Bill vs Billed Amount across all filtered sales orders.
						</p>
					</div>
					<div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
						<div className="h-[260px] w-full min-w-0 min-h-[260px]">
							<ResponsiveContainer
								width="100%"
								height="100%"
								minWidth={0}
								minHeight={260}
							>
								<PieChart>
									<Pie
										data={donutData}
										dataKey="value"
										nameKey="name"
										innerRadius={70}
										outerRadius={110}
										strokeWidth={2}
										stroke="var(--background)"
									>
										{donutData.map((entry, index) => (
											<Cell
												key={`cell_${entry.name}`}
												fill={getChartColor(index)}
											/>
										))}
										<Label
											content={({ viewBox }) => {
												if (viewBox && "cx" in viewBox && "cy" in viewBox) {
													const total = totalBilled + totalPending;
													return (
														<text
															x={viewBox.cx}
															y={viewBox.cy}
															textAnchor="middle"
															dominantBaseline="middle"
														>
															<tspan
																x={viewBox.cx}
																y={viewBox.cy}
																className="fill-foreground text-2xl font-bold"
															>
																{`₹${new Intl.NumberFormat("en-IN", {
																	notation: "compact",
																	maximumFractionDigits: 1,
																}).format(total)}`}
															</tspan>
															<tspan
																x={viewBox.cx}
																y={(viewBox.cy ?? 0) + 22}
																className="fill-muted-foreground text-sm"
															>
																Total
															</tspan>
														</text>
													);
												}
												return null;
											}}
										/>
									</Pie>
									<Tooltip
										formatter={(value) => [
											formatAmount(Number(value ?? 0)),
											"",
										]}
									/>
								</PieChart>
							</ResponsiveContainer>
						</div>
						<div className="flex min-w-[180px] flex-col gap-3 pt-4">
							{donutData.map((entry, index) => (
								<div key={entry.name} className="flex items-center gap-2">
									<span
										className="h-3 w-3 shrink-0 rounded-full"
										style={{ backgroundColor: getChartColor(index) }}
									/>
									<span className="text-sm">
										<span className="text-muted-foreground">
											{entry.name}:{" "}
										</span>
										<span className="font-medium">
											{formatAmount(entry.value)}
										</span>
									</span>
								</div>
							))}
						</div>
					</div>
				</section>
			) : null}

			{/* Table */}
			{!validationError && !isLoading && !queryError && rows.length > 0 ? (
				<section aria-label="Sales order analysis table">
					<div className="mb-2 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							{rows.length} row{rows.length !== 1 ? "s" : ""} · Billed:{" "}
							{formatAmount(totalBilled)} · Pending:{" "}
							{formatAmount(totalPending)}
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
						ariaLabel="Sales order analysis"
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
					<p className="text-base font-medium">No sales orders found</p>
					<p className="text-sm">
						Try adjusting the company, date range, or filters.
					</p>
				</div>
			) : null}
		</div>
	);
}
