"use client";

import type { Inventory } from "@aria/types";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import {
	buildPendingItemChartData,
	formatDate,
	formatPurpose,
	formatQty,
	type RequestedItemsToBeTransferredResult,
	type RequestedItemsToBeTransferredRow,
} from "./requested-items-transferred.utils";

type PurposeFilter = "ALL" | Inventory.RequestedItemsToBeTransferredPurpose;

type FilterState = {
	company: string;
	materialRequest: string;
	itemCode: string;
	targetWarehouse: string;
	purpose: PurposeFilter;
};

const INITIAL_FILTERS: FilterState = {
	company: "",
	materialRequest: "",
	itemCode: "",
	targetWarehouse: "",
	purpose: "ALL",
};

function PurposeBadge({
	purpose,
}: {
	purpose: Inventory.RequestedItemsToBeTransferredPurpose;
}) {
	return (
		<Badge
			variant="secondary"
			className={cn(
				"border-transparent",
				purpose === "MATERIAL_TRANSFER"
					? "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
					: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
			)}
		>
			{formatPurpose(purpose)}
		</Badge>
	);
}

function StatusBadge({ status }: { status: Inventory.MaterialRequestStatus }) {
	const styles: Record<Inventory.MaterialRequestStatus, string> = {
		DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
		PENDING:
			"bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
		APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
		ORDERED: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
		PARTIALLY_ORDERED:
			"bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
		PARTIALLY_RECEIVED:
			"bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
		RECEIVED:
			"bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
		CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
	};

	const label = status
		.replaceAll("_", " ")
		.toLowerCase()
		.replace(/\b\w/g, (char) => char.toUpperCase());

	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				styles[status],
			)}
		>
			{label}
		</span>
	);
}

const columns: ColumnDef<RequestedItemsToBeTransferredRow>[] = [
	{
		accessorKey: "materialRequest",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Material Request" />
		),
		cell: ({ row }) => (
			<Link
				href={`/inventory/stock-transaction/material-request/form?id=${row.original.materialRequestId}`}
				className="font-medium text-primary underline-offset-4 hover:underline"
			>
				{row.original.materialRequest}
			</Link>
		),
		meta: { label: "Material Request", exportable: true },
	},
	{
		accessorKey: "date",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Date" />
		),
		cell: ({ row }) => formatDate(row.original.date),
		sortingFn: (left, right) =>
			left.original.date.getTime() - right.original.date.getTime(),
		meta: { label: "Date", exportable: true },
	},
	{
		accessorKey: "purpose",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Purpose" />
		),
		cell: ({ row }) => <PurposeBadge purpose={row.original.purpose} />,
		meta: { label: "Purpose", exportable: true },
	},
	{
		accessorKey: "status",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Status" />
		),
		cell: ({ row }) => <StatusBadge status={row.original.status} />,
		meta: { label: "Status", exportable: true },
	},
	{
		accessorKey: "itemCode",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Item Code" />
		),
		meta: { label: "Item Code", exportable: true },
	},
	{
		accessorKey: "itemName",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Item Name" />
		),
		cell: ({ row }) => row.original.itemName ?? "—",
		meta: { label: "Item Name", exportable: true },
	},
	{
		accessorKey: "description",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Description" />
		),
		cell: ({ row }) => row.original.description ?? "—",
		meta: { label: "Description", exportable: true },
	},
	{
		accessorKey: "targetWarehouse",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Target Warehouse" />
		),
		cell: ({ row }) => row.original.targetWarehouse ?? "—",
		meta: { label: "Target Warehouse", exportable: true },
	},
	{
		accessorKey: "qty",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Requested Qty" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums">{formatQty(row.original.qty)}</span>
		),
		meta: { label: "Requested Qty", exportable: true },
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
		accessorKey: "qtyToTransfer",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Qty To Transfer" />
		),
		cell: ({ row }) => (
			<span className="tabular-nums font-semibold text-amber-700 dark:text-amber-300">
				{formatQty(row.original.qtyToTransfer)}
			</span>
		),
		meta: { label: "Qty To Transfer", exportable: true },
	},
	{
		accessorKey: "company",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Company" />
		),
		meta: { label: "Company", exportable: true },
	},
];

export default function RequestedItemsToBeTransferredPage() {
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

	const queryInput = React.useMemo(
		() => ({
			company: filters.company.trim() || undefined,
			materialRequest: filters.materialRequest.trim() || undefined,
			itemCode: filters.itemCode.trim() || undefined,
			targetWarehouse: filters.targetWarehouse.trim() || undefined,
			purpose: filters.purpose === "ALL" ? undefined : filters.purpose,
		}),
		[
			filters.company,
			filters.itemCode,
			filters.materialRequest,
			filters.purpose,
			filters.targetWarehouse,
		],
	);

	const {
		data: rawResult,
		isLoading,
		error: queryError,
	} = trpc.inventory.listRequestedItemsToBeTransferred.useQuery(queryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 60_000,
	});

	const result = React.useMemo<
		RequestedItemsToBeTransferredResult | undefined
	>(() => {
		if (!rawResult) {
			return undefined;
		}

		return {
			...rawResult,
			rows: rawResult.rows.map((row) => ({
				...row,
				date: new Date(row.date),
				requiredBy: row.requiredBy ? new Date(row.requiredBy) : null,
			})),
		};
	}, [rawResult]);

	const rows = result?.rows ?? [];
	const summary = result?.summary;
	const chartData = React.useMemo(
		() => buildPendingItemChartData(rows),
		[rows],
	);

	const listQueryInput = queryInput;

	const tableState = useAdvancedDataTable({
		data: rows,
		columns,
		initialSorting: [{ id: "date", desc: false }],
		initialPageSize: 50,
	});

	const handleExport = React.useCallback(async () => {
		const buffer = await (
			trpc.inventory.exportRequestedItemsToBeTransferredExcel as unknown as {
				mutate: (input: typeof listQueryInput) => Promise<Buffer>;
			}
		).mutate(listQueryInput);
		downloadExcelBuffer(
			buffer,
			`requested-items-transferred-${Date.now()}.xlsx`,
		);
	}, [listQueryInput]);

	const activeFilterCount = React.useMemo(
		() =>
			Object.values(queryInput).filter((value) => {
				if (value == null) {
					return false;
				}
				if (typeof value === "string") {
					return value.length > 0;
				}
				return true;
			}).length,
		[queryInput],
	);

	return (
		<div className="flex flex-1 flex-col gap-6 p-6">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-bold tracking-tight">
					Requested Items To Be Transferred
				</h1>
				<p className="text-sm text-muted-foreground">
					Open material transfer and issue requests whose requested quantity
					still exceeds what has already been transferred.
				</p>
			</div>

			<section className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[repeat(5,minmax(0,1fr))]">
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
					<label htmlFor="request-filter" className="text-sm font-medium">
						Material Request
					</label>
					<Input
						id="request-filter"
						placeholder="Series contains..."
						value={filters.materialRequest}
						onChange={(event) =>
							updateFilter("materialRequest", event.target.value)
						}
						className="h-9"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor="item-filter" className="text-sm font-medium">
						Item Code
					</label>
					<Input
						id="item-filter"
						placeholder="Item code contains..."
						value={filters.itemCode}
						onChange={(event) => updateFilter("itemCode", event.target.value)}
						className="h-9"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor="warehouse-filter" className="text-sm font-medium">
						Target Warehouse
					</label>
					<Input
						id="warehouse-filter"
						placeholder="Warehouse contains..."
						value={filters.targetWarehouse}
						onChange={(event) =>
							updateFilter("targetWarehouse", event.target.value)
						}
						className="h-9"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor="purpose-filter" className="text-sm font-medium">
						Purpose
					</label>
					<Select
						value={filters.purpose}
						onValueChange={(value) =>
							updateFilter("purpose", value as PurposeFilter)
						}
					>
						<SelectTrigger id="purpose-filter" className="h-9 min-w-44">
							<SelectValue placeholder="All purposes" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">All purposes</SelectItem>
							<SelectItem value="MATERIAL_TRANSFER">
								Material Transfer
							</SelectItem>
							<SelectItem value="MATERIAL_ISSUE">Material Issue</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="flex items-center justify-between gap-2 lg:col-span-5">
					<p className="text-sm text-muted-foreground">
						{activeFilterCount > 0
							? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`
							: "Showing all open transfer and issue requests"}
					</p>
					<Button variant="outline" size="sm" onClick={resetFilters}>
						Reset
					</Button>
				</div>
			</section>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">
					Loading requested items awaiting transfer…
				</p>
			) : null}

			{!isLoading && queryError ? (
				<ErrorState
					error={queryError}
					title="Failed to load requested items awaiting transfer"
				/>
			) : null}

			{!isLoading && !queryError && summary ? (
				<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Open Requests
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-semibold">{summary.requestCount}</p>
							<p className="text-sm text-muted-foreground">
								{summary.rowCount} item row{summary.rowCount === 1 ? "" : "s"}
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
								{formatQty(summary.totalQtyToTransfer)}
							</p>
							<p className="text-sm text-muted-foreground">
								Still to transfer or issue
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
								Against {formatQty(summary.totalQty)} requested
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Purpose Mix
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Transfers</span>
								<span className="font-semibold">
									{summary.transferRowCount}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Issues</span>
								<span className="font-semibold">{summary.issueRowCount}</span>
							</div>
						</CardContent>
					</Card>
				</section>
			) : null}

			{!isLoading && !queryError && rows.length > 0 ? (
				<>
					<section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
						<Card>
							<CardHeader>
								<CardTitle className="text-base">
									Largest Pending Items
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
													"Qty To Transfer",
												]}
												labelFormatter={(label, payload) => {
													const item = payload?.[0]?.payload as
														| { requestCount?: number }
														| undefined;
													return item?.requestCount != null
														? `${label} · ${item.requestCount} request${item.requestCount === 1 ? "" : "s"}`
														: String(label);
												}}
											/>
											<Bar
												dataKey="qtyToTransfer"
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
									Rows stay visible only while requested quantity remains above
									transferred quantity.
								</p>
								<p>
									Draft and cancelled requests are excluded, matching the
									active-document intent of the ERPNext report.
								</p>
								<p>
									Use the material request link in the table to jump directly
									into the stock transaction workflow.
								</p>
							</CardContent>
						</Card>
					</section>

					<section aria-label="Requested items transfer table">
						<div className="mb-2 flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								{rows.length} row{rows.length === 1 ? "" : "s"} · Pending{" "}
								{formatQty(summary?.totalQtyToTransfer ?? 0)}
							</p>
						</div>
						<AdvancedDataTable
							table={tableState.table}
							data={rows}
							enableExport
							onExport={handleExport}
							enableVirtualization={false}
							enableBulkActions={false}
							ariaLabel="Requested items to be transferred"
						/>
					</section>
				</>
			) : null}

			{!isLoading && !queryError && rows.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
					<p className="text-base font-medium">
						No pending transfer requests found
					</p>
					<p className="text-sm">
						Try broadening the filters or confirm the material requests still
						have quantity left to transfer.
					</p>
				</div>
			) : null}
		</div>
	);
}
