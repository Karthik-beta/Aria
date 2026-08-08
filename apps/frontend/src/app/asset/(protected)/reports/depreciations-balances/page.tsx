"use client";

import type { Asset } from "@aria/types";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import {
	AdvancedDataTable,
	downloadExcelBuffer,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	ASSET_DEPRECIATIONS_AND_BALANCES_GROUP_BY_OPTIONS,
	type AssetDepreciationsAndBalancesFilterState,
	buildAssetDepreciationsAndBalancesInput,
	formatCurrency,
	getClosingDateLabel,
	getDateRangeError,
	getDefaultFromDate,
	getDefaultToDate,
	getOpeningDateLabel,
	getSignedAmountClassName,
	renderOptionalText,
} from "./depreciations-balances.utils";

const INITIAL_FILTERS: AssetDepreciationsAndBalancesFilterState = {
	company: "",
	fromDate: getDefaultFromDate(),
	toDate: getDefaultToDate(),
	groupBy: "ASSET_CATEGORY",
	asset: "",
	assetCategory: "",
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

export default function AssetDepreciationsAndBalancesPage() {
	const [filters, setFilters] =
		React.useState<AssetDepreciationsAndBalancesFilterState>(INITIAL_FILTERS);

	const updateFilter = React.useCallback(
		<Key extends keyof AssetDepreciationsAndBalancesFilterState>(
			key: Key,
			value: AssetDepreciationsAndBalancesFilterState[Key],
		) => {
			setFilters((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	const handleGroupByChange = React.useCallback(
		(value: Asset.AssetDepreciationsAndBalancesGroupBy) => {
			setFilters((current) => ({
				...current,
				groupBy: value,
				asset: value === "ASSET" ? current.asset : "",
				assetCategory: value === "ASSET_CATEGORY" ? current.assetCategory : "",
			}));
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
					keyof AssetDepreciationsAndBalancesFilterState
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
		() => buildAssetDepreciationsAndBalancesInput(filters),
		[filters],
	);

	const {
		data,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.asset.listAssetDepreciationsAndBalances.useQuery(queryInput, {
		enabled: dateError === null,
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const rows: Asset.AssetDepreciationsAndBalancesRow[] = data?.rows ?? [];
	const summary =
		data?.summary ??
		({
			matchedAssetCount: 0,
			rowCount: 0,
			totalValueAsOnFromDate: 0,
			totalValueAsOnToDate: 0,
			totalNetAssetValueAsOnFromDate: 0,
			totalNetAssetValueAsOnToDate: 0,
			totalDepreciationAmountDuringPeriod: 0,
			totalValueAdjustmentDuringPeriod: 0,
		} satisfies Asset.AssetDepreciationsAndBalancesSummary);

	const showCapitalizedColumn = React.useMemo(
		() => rows.some((row) => row.valueOfCapitalizedAsset !== 0),
		[rows],
	);
	const showReversalColumn = React.useMemo(
		() => rows.some((row) => row.depreciationEliminatedViaReversal !== 0),
		[rows],
	);
	const openingDateLabel = React.useMemo(
		() => getOpeningDateLabel(filters.fromDate),
		[filters.fromDate],
	);
	const closingDateLabel = React.useMemo(
		() => getClosingDateLabel(filters.toDate),
		[filters.toDate],
	);

	const columns = React.useMemo<
		ColumnDef<Asset.AssetDepreciationsAndBalancesRow>[]
	>(() => {
		const baseColumns: ColumnDef<Asset.AssetDepreciationsAndBalancesRow>[] = [
			{
				id: "group",
				accessorFn: (row) => row.groupingLabel,
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title={filters.groupBy === "ASSET" ? "Asset" : "Asset Category"}
					/>
				),
				cell: ({ row }) =>
					filters.groupBy === "ASSET" ? (
						<div className="flex flex-col">
							<span className="font-medium text-foreground">
								{row.original.assetSeries}
							</span>
							<span className="text-xs text-muted-foreground">
								{renderOptionalText(row.original.assetName)}
							</span>
							<span className="text-xs text-muted-foreground">
								{renderOptionalText(row.original.assetCategoryName)}
							</span>
						</div>
					) : (
						<div className="flex flex-col">
							<span className="font-medium text-foreground">
								{row.original.groupingLabel}
							</span>
							<span className="text-xs text-muted-foreground">
								{row.original.assetCount} asset
								{row.original.assetCount === 1 ? "" : "s"}
							</span>
						</div>
					),
				meta: {
					label: filters.groupBy === "ASSET" ? "Asset" : "Asset Category",
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
				accessorKey: "valueAsOnFromDate",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title={`Value as on ${openingDateLabel}`}
					/>
				),
				cell: ({ row }) => formatCurrency(row.original.valueAsOnFromDate),
				meta: {
					label: `Value as on ${openingDateLabel}`,
					exportable: true,
				},
			},
			{
				accessorKey: "valueOfNewPurchase",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Value of New Purchase"
					/>
				),
				cell: ({ row }) => formatCurrency(row.original.valueOfNewPurchase),
				meta: {
					label: "Value of New Purchase",
					exportable: true,
				},
			},
			{
				accessorKey: "valueOfSoldAsset",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Value of Sold Asset" />
				),
				cell: ({ row }) => formatCurrency(row.original.valueOfSoldAsset),
				meta: {
					label: "Value of Sold Asset",
					exportable: true,
				},
			},
			{
				accessorKey: "valueOfScrappedAsset",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Value of Scrapped Asset"
					/>
				),
				cell: ({ row }) => formatCurrency(row.original.valueOfScrappedAsset),
				meta: {
					label: "Value of Scrapped Asset",
					exportable: true,
				},
			},
		];

		if (showCapitalizedColumn) {
			baseColumns.push({
				accessorKey: "valueOfCapitalizedAsset",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Value of Capitalized Asset"
					/>
				),
				cell: ({ row }) => formatCurrency(row.original.valueOfCapitalizedAsset),
				meta: {
					label: "Value of Capitalized Asset",
					exportable: true,
				},
			});
		}

		baseColumns.push(
			{
				accessorKey: "valueAdjustmentDuringPeriod",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Revaluation Delta" />
				),
				cell: ({ row }) => (
					<span
						className={cn(
							"text-sm font-medium",
							getSignedAmountClassName(
								row.original.valueAdjustmentDuringPeriod,
							),
						)}
					>
						{formatCurrency(row.original.valueAdjustmentDuringPeriod)}
					</span>
				),
				meta: {
					label: "Revaluation Delta",
					exportable: true,
				},
			},
			{
				accessorKey: "valueAsOnToDate",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title={`Value as on ${closingDateLabel}`}
					/>
				),
				cell: ({ row }) => formatCurrency(row.original.valueAsOnToDate),
				meta: {
					label: `Value as on ${closingDateLabel}`,
					exportable: true,
				},
			},
			{
				accessorKey: "accumulatedDepreciationAsOnFromDate",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title={`Accumulated Depreciation as on ${openingDateLabel}`}
					/>
				),
				cell: ({ row }) =>
					formatCurrency(row.original.accumulatedDepreciationAsOnFromDate),
				meta: {
					label: `Accumulated Depreciation as on ${openingDateLabel}`,
					exportable: true,
				},
			},
			{
				accessorKey: "depreciationAmountDuringPeriod",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Depreciation During Period"
					/>
				),
				cell: ({ row }) =>
					formatCurrency(row.original.depreciationAmountDuringPeriod),
				meta: {
					label: "Depreciation During Period",
					exportable: true,
				},
			},
			{
				accessorKey: "depreciationEliminatedDuringPeriod",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Depreciation Eliminated by Disposal"
					/>
				),
				cell: ({ row }) =>
					formatCurrency(row.original.depreciationEliminatedDuringPeriod),
				meta: {
					label: "Depreciation Eliminated by Disposal",
					exportable: true,
				},
			},
		);

		if (showReversalColumn) {
			baseColumns.push({
				accessorKey: "depreciationEliminatedViaReversal",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Depreciation Eliminated via Reversal"
					/>
				),
				cell: ({ row }) =>
					formatCurrency(row.original.depreciationEliminatedViaReversal),
				meta: {
					label: "Depreciation Eliminated via Reversal",
					exportable: true,
				},
			});
		}

		baseColumns.push(
			{
				accessorKey: "accumulatedDepreciationAsOnToDate",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title={`Accumulated Depreciation as on ${closingDateLabel}`}
					/>
				),
				cell: ({ row }) =>
					formatCurrency(row.original.accumulatedDepreciationAsOnToDate),
				meta: {
					label: `Accumulated Depreciation as on ${closingDateLabel}`,
					exportable: true,
				},
			},
			{
				accessorKey: "netAssetValueAsOnFromDate",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title={`Net Asset Value as on ${openingDateLabel}`}
					/>
				),
				cell: ({ row }) =>
					formatCurrency(row.original.netAssetValueAsOnFromDate),
				meta: {
					label: `Net Asset Value as on ${openingDateLabel}`,
					exportable: true,
				},
			},
			{
				accessorKey: "netAssetValueAsOnToDate",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title={`Net Asset Value as on ${closingDateLabel}`}
					/>
				),
				cell: ({ row }) => formatCurrency(row.original.netAssetValueAsOnToDate),
				meta: {
					label: `Net Asset Value as on ${closingDateLabel}`,
					exportable: true,
				},
			},
		);

		return baseColumns;
	}, [
		closingDateLabel,
		filters.groupBy,
		openingDateLabel,
		showCapitalizedColumn,
		showReversalColumn,
	]);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } =
		useAdvancedDataTable<Asset.AssetDepreciationsAndBalancesRow>({
			data: rows,
			columns,
			initialPageSize: 25,
			initialSorting: [{ id: "group", desc: false }],
			enableRowSelection: false,
			enableMultiRowSelection: false,
			enableGlobalFilter: false,
			onReload: handleReload,
			getRowId: (row) => row.groupingKey,
		});

	const exportAssetDepreciationsAndBalancesExcel =
		trpc.asset.exportAssetDepreciationsAndBalancesExcel.useMutation();

	const _handleExport = React.useCallback(
		async (
			_format: string,
			_rows: readonly Row<Asset.AssetDepreciationsAndBalancesRow>[],
		) => {
			if (!queryInput) return;
			const buffer =
				(await exportAssetDepreciationsAndBalancesExcel.mutateAsync(
					queryInput,
				)) as string;
			downloadExcelBuffer(
				buffer,
				`asset-depreciations-balances-${Date.now()}.xlsx`,
			);
		},
		[queryInput, exportAssetDepreciationsAndBalancesExcel],
	);

	const skeletonKeys = React.useMemo(
		() => ({
			stats: Array.from({ length: 6 }, () => crypto.randomUUID()),
			cards: Array.from({ length: 5 }, () => crypto.randomUUID()),
			rows: Array.from({ length: 8 }, () => crypto.randomUUID()),
		}),
		[],
	);

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Asset Depreciations and Balances
					</h1>
					<p className="text-muted-foreground">
						Review opening balances, schedule-backed depreciation, disposal
						elimination, and closing carrying values by asset or category.
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
					<Select value={filters.groupBy} onValueChange={handleGroupByChange}>
						<SelectTrigger aria-label="Group by">
							<SelectValue placeholder="Group By" />
						</SelectTrigger>
						<SelectContent>
							{ASSET_DEPRECIATIONS_AND_BALANCES_GROUP_BY_OPTIONS.map(
								(option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								),
							)}
						</SelectContent>
					</Select>
					{filters.groupBy === "ASSET_CATEGORY" ? (
						<Input
							value={filters.assetCategory}
							onChange={(event) =>
								updateFilter("assetCategory", event.target.value)
							}
							placeholder="Asset Category"
							aria-label="Filter by asset category"
						/>
					) : (
						<Input
							value={filters.asset}
							onChange={(event) => updateFilter("asset", event.target.value)}
							placeholder="Asset"
							aria-label="Filter by asset"
						/>
					)}
				</div>
				<div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="flex flex-col gap-1">
						<Label className="text-xs text-muted-foreground">
							Balance Scope
						</Label>
						<p className="text-sm text-muted-foreground">
							Opening and closing values include submitted asset value
							adjustments. Depreciation is derived from the effective schedule
							revision for each asset.
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
				<>
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
						<SummaryCard
							title="Matched Assets"
							value={String(summary.matchedAssetCount)}
							description="Assets contributing to the report scope"
						/>
						<SummaryCard
							title="Grouped Rows"
							value={String(summary.rowCount)}
							description="Rows after grouping by category or asset"
						/>
						<SummaryCard
							title="Period Depreciation"
							value={formatCurrency(
								summary.totalDepreciationAmountDuringPeriod,
							)}
							description="Schedule-backed depreciation booked in the range"
						/>
						<SummaryCard
							title="Revaluation Delta"
							value={formatCurrency(summary.totalValueAdjustmentDuringPeriod)}
							description="Submitted asset value adjustments inside the range"
						/>
						<SummaryCard
							title="Closing Net Asset Value"
							value={formatCurrency(summary.totalNetAssetValueAsOnToDate)}
							description="Closing carrying value across visible groups"
						/>
					</div>

					<div className="rounded-md border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
						Opening balances use {openingDateLabel} as the cutoff date. Closing
						balances use {closingDateLabel} and follow the latest effective
						depreciation schedule revision available in Aria.
					</div>
				</>
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
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
					title="Failed to load asset depreciations and balances"
					onRetry={() => void refetch()}
				/>
			)}

			{!dateError && !isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={rows}
					enableExport
					onExport={_handleExport}
					enableVirtualization
					enableColumnResizing
					enableBulkActions={false}
					enableGlobalSearch={false}
					ariaLabel="Asset depreciations and balances table"
					emptyState={
						<div className="flex flex-col items-center gap-2 py-12">
							<BookOpen className="h-10 w-10 text-muted-foreground/40" />
							<p className="text-sm text-muted-foreground">
								No asset balance rows match these filters.
							</p>
							<Link
								href="/asset/value-adjustments"
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
