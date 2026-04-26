"use client";

import type { Asset } from "@aria/types";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { BookOpen } from "lucide-react";
import * as React from "react";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { downloadExcelBuffer } from "@/components/advanced-data-table/utils";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	type AssetActivityReportFilterState,
	buildAssetActivityReportInput,
	formatAssetStatus,
	formatDateTime,
	getAssetStatusClassName,
	getDateRangeError,
	getDefaultFromDate,
	getDefaultToDate,
	renderOptionalText,
} from "./activity.utils";

type ActivityRow = Omit<Asset.AssetActivityReportRow, "createdAt"> & {
	createdAt: Date;
};

const INITIAL_FILTERS: AssetActivityReportFilterState = {
	company: "",
	fromDate: getDefaultFromDate(),
	toDate: getDefaultToDate(),
	asset: "",
	assetCategory: "",
	activity: "",
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

export default function AssetActivityPage() {
	const [filters, setFilters] =
		React.useState<AssetActivityReportFilterState>(INITIAL_FILTERS);

	const updateFilter = React.useCallback(
		<Key extends keyof AssetActivityReportFilterState>(
			key: Key,
			value: AssetActivityReportFilterState[Key],
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
					keyof AssetActivityReportFilterState
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
		() => buildAssetActivityReportInput(filters),
		[filters],
	);

	const {
		data,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.asset.listAssetActivityReport.useQuery(queryInput, {
		enabled: dateError === null,
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const rows = React.useMemo<ActivityRow[]>(
		() =>
			(data?.rows ?? []).map((row) => ({
				...row,
				createdAt: new Date(row.createdAt),
			})),
		[data?.rows],
	);

	const summary =
		data?.summary ??
		({
			rowCount: 0,
			distinctAssetCount: 0,
			firstActivityAt: null,
			lastActivityAt: null,
		} satisfies Asset.AssetActivityReportSummary);

	const columns = React.useMemo<ColumnDef<ActivityRow>[]>(
		() => [
			{
				accessorKey: "createdAt",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Recorded At" />
				),
				cell: ({ row }) => formatDateTime(row.original.createdAt),
				meta: {
					label: "Recorded At",
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
				accessorKey: "activity",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Activity" />
				),
				cell: ({ row }) => (
					<div className="max-w-2xl whitespace-normal text-sm leading-6 text-foreground">
						{row.original.activity}
					</div>
				),
				meta: {
					label: "Activity",
					exportable: true,
				},
			},
		],
		[],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const exportAssetActivityExcel =
		trpc.asset.exportAssetActivityExcel.useMutation();

	const handleExport = React.useCallback(
		async (_format: string, _rows: readonly Row<ActivityRow>[]) => {
			if (!queryInput) return;
			const buffer = (await exportAssetActivityExcel.mutateAsync(
				queryInput,
			)) as ArrayBuffer;
			downloadExcelBuffer(buffer, `asset-activity-${Date.now()}.xlsx`);
		},
		[queryInput, exportAssetActivityExcel],
	);

	const { table } = useAdvancedDataTable<ActivityRow>({
		data: rows,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "createdAt", desc: true }],
		enableRowSelection: false,
		enableMultiRowSelection: false,
		enableGlobalFilter: false,
		onReload: handleReload,
		getRowId: (row) => row.activityId,
	});

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Asset Activity</h1>
					<p className="text-muted-foreground">
						Review the append-only activity trail captured for asset creation,
						updates, and submitted value adjustments.
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
						value={filters.activity}
						onChange={(event) => updateFilter("activity", event.target.value)}
						placeholder="Activity contains"
						aria-label="Filter by activity"
					/>
				</div>
				<div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="flex flex-col gap-1">
						<Label className="text-xs text-muted-foreground">
							Activity Scope
						</Label>
						<p className="text-sm text-muted-foreground">
							Dates are inclusive and the report shows the asset events recorded
							inside Aria for the selected range.
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
						title="Activities"
						value={String(summary.rowCount)}
						description="Recorded asset events inside the selected date range"
					/>
					<SummaryCard
						title="Distinct Assets"
						value={String(summary.distinctAssetCount)}
						description="Assets that produced at least one visible activity row"
					/>
					<SummaryCard
						title="First Recorded Event"
						value={formatDateTime(summary.firstActivityAt)}
						description="Oldest event in the current report scope"
					/>
					<SummaryCard
						title="Latest Recorded Event"
						value={formatDateTime(summary.lastActivityAt)}
						description="Most recent event in the current report scope"
					/>
				</div>
			)}

			{isLoading && !dateError && (
				<div className="flex items-center justify-center py-12">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
				</div>
			)}

			{queryError && !isLoading && !dateError && (
				<ErrorState
					error={queryError}
					operation="load"
					title="Failed to load asset activity"
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
					ariaLabel="Asset activity table"
					emptyState={
						<div className="flex flex-col items-center gap-2 py-12">
							<BookOpen className="h-10 w-10 text-muted-foreground/40" />
							<p className="text-sm font-medium">No asset activity found</p>
							<p className="text-center text-sm text-muted-foreground">
								Adjust the date range or filters to inspect a different slice of
								the asset audit trail.
							</p>
						</div>
					}
				/>
			)}
		</div>
	);
}
