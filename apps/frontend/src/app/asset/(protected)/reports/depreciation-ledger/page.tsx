"use client";

import type { Asset } from "@aria/types";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { BookOpen, TriangleAlert } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { downloadExcelBuffer } from "@/components/advanced-data-table/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	type AssetDepreciationLedgerFilterState,
	buildAssetDepreciationLedgerInput,
	formatAssetStatus,
	formatCurrency,
	formatDate,
	formatDepreciationMethod,
	formatRevisionLabel,
	getAssetStatusClassName,
	getDateRangeError,
	getDefaultFromDate,
	getDefaultToDate,
	renderOptionalText,
} from "./depreciation-ledger.utils";

type LedgerRow = Omit<
	Asset.AssetDepreciationLedgerRow,
	"purchaseDate" | "depreciationDate" | "adjustmentDate"
> & {
	purchaseDate: Date | null;
	depreciationDate: Date;
	adjustmentDate: Date;
};

const INITIAL_FILTERS: AssetDepreciationLedgerFilterState = {
	company: "",
	fromDate: getDefaultFromDate(),
	toDate: getDefaultToDate(),
	asset: "",
	assetCategory: "",
	costCenter: "",
};

function SummaryCard(props: {
	title: string;
	value: string;
	description: string;
}) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardDescription>{props.title}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-semibold tracking-tight">
					{props.value}
				</div>
				<p className="mt-1 text-xs text-muted-foreground">
					{props.description}
				</p>
			</CardContent>
		</Card>
	);
}

export default function AssetDepreciationLedgerPage() {
	const [filters, setFilters] =
		React.useState<AssetDepreciationLedgerFilterState>(INITIAL_FILTERS);

	const updateFilter = React.useCallback(
		<Key extends keyof AssetDepreciationLedgerFilterState>(
			key: Key,
			value: AssetDepreciationLedgerFilterState[Key],
		) => {
			setFilters((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	const resetFilters = React.useCallback(() => {
		setFilters(INITIAL_FILTERS);
	}, []);

	const hasActiveFilters = React.useMemo(
		() =>
			(
				Object.keys(INITIAL_FILTERS) as Array<
					keyof AssetDepreciationLedgerFilterState
				>
			).some((key) => filters[key] !== INITIAL_FILTERS[key]),
		[filters],
	);

	const dateError = React.useMemo(
		() =>
			getDateRangeError({
				fromDate: filters.fromDate,
				toDate: filters.toDate,
			}),
		[filters.fromDate, filters.toDate],
	);

	const queryInput = React.useMemo(
		() => buildAssetDepreciationLedgerInput(filters),
		[filters],
	);

	const {
		data,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.asset.listAssetDepreciationLedger.useQuery(queryInput, {
		enabled: dateError === null,
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const rows = React.useMemo<LedgerRow[]>(
		() =>
			(data?.rows ?? []).map((row) => ({
				...row,
				purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : null,
				depreciationDate: new Date(row.depreciationDate),
				adjustmentDate: new Date(row.adjustmentDate),
			})),
		[data?.rows],
	);

	const summary =
		data?.summary ??
		({
			matchedAssetCount: 0,
			assetsWithLedgerCount: 0,
			assetsWithoutLedgerCount: 0,
			rowCount: 0,
			totalDepreciationAmount: 0,
			closingValueTotal: 0,
		} satisfies Asset.AssetDepreciationLedgerSummary);

	const columns = React.useMemo<ColumnDef<LedgerRow>[]>(
		() => [
			{
				accessorKey: "depreciationDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Depreciation Date" />
				),
				cell: ({ row }) => formatDate(row.original.depreciationDate),
				meta: {
					label: "Depreciation Date",
					exportable: true,
				},
			},
			{
				id: "asset",
				accessorFn: (row) => row.assetName,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Asset" />
				),
				cell: ({ row }) => (
					<div className="flex flex-col">
						<span className="font-medium text-foreground">
							{row.original.assetName}
						</span>
						<span className="text-xs text-muted-foreground">
							{row.original.assetSeries}
						</span>
					</div>
				),
				meta: {
					label: "Asset",
					exportable: true,
				},
			},
			{
				accessorKey: "assetCategoryName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Asset Category" />
				),
				cell: ({ row }) => renderOptionalText(row.original.assetCategoryName),
				meta: {
					label: "Asset Category",
					exportable: true,
				},
			},
			{
				accessorKey: "company",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company" />
				),
				cell: ({ row }) => row.original.company,
				meta: {
					label: "Company",
					exportable: true,
				},
			},
			{
				id: "revisionSource",
				accessorFn: (row) => row.adjustmentSeries,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Revision Source" />
				),
				cell: ({ row }) => (
					<div className="flex flex-col text-sm">
						<span className="font-medium text-foreground">
							{formatRevisionLabel(row.original.scheduleRevisionNumber)} ·{" "}
							{row.original.adjustmentSeries}
						</span>
						<span className="text-xs text-muted-foreground">
							Adjusted {formatDate(row.original.adjustmentDate)}
						</span>
						<span className="text-xs text-muted-foreground">
							Revaluation{" "}
							{renderOptionalText(row.original.revaluationEntrySeries)}
						</span>
					</div>
				),
				meta: {
					label: "Revision Source",
					exportable: true,
				},
			},
			{
				accessorKey: "costCenter",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Cost Center" />
				),
				cell: ({ row }) => renderOptionalText(row.original.costCenter),
				meta: {
					label: "Cost Center",
					exportable: true,
				},
			},
			{
				accessorKey: "purchaseAmount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Purchase Amount" />
				),
				cell: ({ row }) => formatCurrency(row.original.purchaseAmount),
				meta: {
					label: "Purchase Amount",
					exportable: true,
				},
			},
			{
				accessorKey: "openingAccumulatedDepreciation",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Opening Accum. Depr." />
				),
				cell: ({ row }) =>
					formatCurrency(row.original.openingAccumulatedDepreciation),
				meta: {
					label: "Opening Accumulated Depreciation",
					exportable: true,
				},
			},
			{
				accessorKey: "depreciationAmount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Depreciation Amount" />
				),
				cell: ({ row }) => formatCurrency(row.original.depreciationAmount),
				meta: {
					label: "Depreciation Amount",
					exportable: true,
				},
			},
			{
				accessorKey: "accumulatedDepreciationAmount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Accum. Depr." />
				),
				cell: ({ row }) =>
					formatCurrency(row.original.accumulatedDepreciationAmount),
				meta: {
					label: "Accumulated Depreciation",
					exportable: true,
				},
			},
			{
				accessorKey: "valueAfterDepreciation",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Value After Depr." />
				),
				cell: ({ row }) => formatCurrency(row.original.valueAfterDepreciation),
				meta: {
					label: "Value After Depreciation",
					exportable: true,
				},
			},
			{
				accessorKey: "depreciationMethod",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Method" />
				),
				cell: ({ row }) =>
					formatDepreciationMethod(row.original.depreciationMethod),
				meta: {
					label: "Method",
					exportable: true,
				},
			},
			{
				accessorKey: "assetStatus",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Current Status" />
				),
				cell: ({ row }) => (
					<span
						className={cn(
							"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
							getAssetStatusClassName(row.original.assetStatus),
						)}
					>
						{formatAssetStatus(row.original.assetStatus)}
					</span>
				),
				meta: {
					label: "Current Status",
					exportable: true,
				},
			},
			{
				accessorKey: "purchaseDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Purchase Date" />
				),
				cell: ({ row }) => formatDate(row.original.purchaseDate),
				meta: {
					label: "Purchase Date",
					exportable: true,
				},
			},
		],
		[],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<LedgerRow>({
		data: rows,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "depreciationDate", desc: true }],
		enableRowSelection: false,
		enableMultiRowSelection: false,
		enableGlobalFilter: false,
		onReload: handleReload,
		getRowId: (row) =>
			`${row.scheduleId}:${row.assetId}:${row.depreciationDate.toISOString()}`,
	});

	const exportAssetDepreciationLedgerExcel =
		trpc.asset.exportAssetDepreciationLedgerExcel.useMutation();

	const handleExport = React.useCallback(
		async (_format: string, _rows: readonly Row<LedgerRow>[]) => {
			if (!queryInput) return;
			const buffer = (await exportAssetDepreciationLedgerExcel.mutateAsync(
				queryInput,
			)) as string;
			downloadExcelBuffer(
				buffer,
				`asset-depreciation-ledger-${Date.now()}.xlsx`,
			);
		},
		[queryInput, exportAssetDepreciationLedgerExcel],
	);

	const skeletonKeys = React.useMemo(
		() => ({
			stats: Array.from({ length: 6 }, () => crypto.randomUUID()),
			cards: Array.from({ length: 4 }, () => crypto.randomUUID()),
			rows: Array.from({ length: 8 }, () => crypto.randomUUID()),
		}),
		[],
	);

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Asset Depreciation Ledger
					</h1>
					<p className="text-muted-foreground">
						Review schedule-backed depreciation history derived from submitted
						asset value adjustments.
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
						type="date"
						value={filters.fromDate}
						onChange={(event) => updateFilter("fromDate", event.target.value)}
						aria-label="Filter from date"
					/>
					<Input
						type="date"
						value={filters.toDate}
						onChange={(event) => updateFilter("toDate", event.target.value)}
						aria-label="Filter to date"
					/>
					<Input
						value={filters.asset}
						onChange={(event) => updateFilter("asset", event.target.value)}
						placeholder="Asset"
						aria-label="Filter by asset"
					/>
					<Input
						value={filters.assetCategory}
						onChange={(event) =>
							updateFilter("assetCategory", event.target.value)
						}
						placeholder="Asset Category"
						aria-label="Filter by asset category"
					/>
					<Input
						value={filters.costCenter}
						onChange={(event) => updateFilter("costCenter", event.target.value)}
						placeholder="Cost Center"
						aria-label="Filter by cost center"
					/>
				</div>
				<div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="flex flex-col gap-1">
						<Label className="text-xs text-muted-foreground">
							Ledger Scope
						</Label>
						<p className="text-sm text-muted-foreground">
							Dates are inclusive and the report uses the effective revision for
							each schedule period.
						</p>
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

			{dateError && (
				<div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
					{dateError}
				</div>
			)}

			{!dateError && !isLoading && !queryError && (
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					<SummaryCard
						title="Matched Assets"
						value={String(summary.matchedAssetCount)}
						description={`${summary.assetsWithLedgerCount} have schedule-backed ledger rows`}
					/>
					<SummaryCard
						title="Ledger Entries"
						value={String(summary.rowCount)}
						description="Effective depreciation periods inside the selected range"
					/>
					<SummaryCard
						title="Depreciation In Range"
						value={formatCurrency(summary.totalDepreciationAmount)}
						description="Sum of depreciation amounts across visible entries"
					/>
					<SummaryCard
						title="Closing Book Value"
						value={formatCurrency(summary.closingValueTotal)}
						description="Latest visible carrying value across assets in scope"
					/>
				</div>
			)}

			{!dateError &&
				!isLoading &&
				!queryError &&
				summary.assetsWithoutLedgerCount > 0 && (
					<div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
						<div className="flex items-start gap-2">
							<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
							<p>
								{summary.assetsWithoutLedgerCount} matched asset
								{summary.assetsWithoutLedgerCount === 1 ? "" : "s"} do not have
								schedule-backed ledger rows in this date range. Earlier
								depreciation history may still exist only in opening balances.
							</p>
						</div>
					</div>
				)}

			{isLoading && !dateError && (
				<div className="flex flex-1 flex-col gap-4">
					<div className="rounded-lg border bg-background p-4">
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
							{skeletonKeys.stats.map((key) => (
								<Skeleton key={key} className="h-10 w-full" />
							))}
						</div>
					</div>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						{skeletonKeys.cards.map((key) => (
							<Card key={key}>
								<CardHeader className="pb-2">
									<Skeleton className="h-4 w-24" />
								</CardHeader>
								<CardContent>
									<Skeleton className="h-8 w-16" />
								</CardContent>
							</Card>
						))}
					</div>
					<div className="rounded-lg border bg-background">
						<div className="w-full overflow-auto">
							<table className="w-full">
								<thead className="bg-muted/95">
									<tr>
										<th className="p-3">
											<Skeleton className="h-4 w-24" />
										</th>
										<th className="p-3">
											<Skeleton className="h-4 w-32" />
										</th>
										<th className="p-3">
											<Skeleton className="h-4 w-20" />
										</th>
										<th className="p-3">
											<Skeleton className="h-4 w-16" />
										</th>
									</tr>
								</thead>
								<tbody>
									{skeletonKeys.rows.map((key) => (
										<tr key={key} className="border-t">
											<td className="p-3">
												<Skeleton className="h-4 w-24" />
											</td>
											<td className="p-3">
												<Skeleton className="h-4 w-32" />
											</td>
											<td className="p-3">
												<Skeleton className="h-4 w-20" />
											</td>
											<td className="p-3">
												<Skeleton className="h-4 w-16" />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{queryError && !isLoading && !dateError && (
				<ErrorState
					error={queryError}
					operation="load"
					title="Failed to load asset depreciation ledger"
					onRetry={() => void refetch()}
				/>
			)}

			{!dateError && !isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={rows}
					enableExport
					onExport={handleExport}
					enableVirtualization
					enableColumnResizing
					enableBulkActions={false}
					enableGlobalSearch={false}
					ariaLabel="Asset depreciation ledger table"
					emptyState={
						<div className="flex flex-col items-center gap-2 py-12">
							<BookOpen className="h-10 w-10 text-muted-foreground/40" />
							<p className="text-sm text-muted-foreground">
								No effective depreciation entries match these filters.
							</p>
							<Link
								href="/asset/asset-maintenance/value-adjustment"
								className={cn(
									buttonVariants({
										variant: "outline",
										size: "sm",
									}),
									"mt-1",
								)}
							>
								Review value adjustments
							</Link>
						</div>
					}
				/>
			)}
		</div>
	);
}
