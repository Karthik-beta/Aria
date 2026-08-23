"use client";

import type { Asset } from "@aria/types";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, RotateCcw } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";
import {
	AdvancedDataTable,
	downloadExcelBuffer,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { CompanySearchSelect } from "@/components/asset/server-backed-selectors";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
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
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import {
	buildFixedAssetRegisterInput,
	FIXED_ASSET_REGISTER_GROUP_BY_OPTIONS,
	type FixedAssetRegisterFilterState,
	formatCurrency,
	formatDateLabel,
	getDateRangeError,
	getDefaultFromDate,
	getDefaultToDate,
	selectFixedAssetRegisterCompany,
} from "./fixed-asset-register.utils";

const INITIAL_FILTERS: FixedAssetRegisterFilterState = {
	companyId: "",
	financeBookId: "",
	status: "IN_LOCATION",
	fromDate: getDefaultFromDate(),
	toDate: getDefaultToDate(),
	groupBy: "ASSET_CATEGORY",
	assetCategory: "",
	location: "",
};

const COMPANY_DEFAULT_FINANCE_BOOK_VALUE = "__company_default__";

const chartConfig = {
	assetValue: {
		label: "Asset Value",
		color: "var(--chart-1, #2563eb)",
	},
	depreciatedAmount: {
		label: "Depreciated Amount",
		color: "var(--chart-2, #dc2626)",
	},
} satisfies ChartConfig;

/**
 * KPI summary card component for displaying aggregate report statistics.
 */
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

/**
 * Fixed Asset Register Report Page
 *
 * Provides an Asset-domain fixed asset subledger report with Net Book Value
 * calculations, dynamic grouping (by Category or Location), stacked bar chart visual trends,
 * and Excel report export capability. Statutory general-ledger reporting remains outside
 * this Asset module.
 */
export default function FixedAssetRegisterReportPage() {
	const [filters, setFilters] =
		React.useState<FixedAssetRegisterFilterState>(INITIAL_FILTERS);
	const { data: financeBooksData } = trpc.asset.listFinanceBooks.useQuery(
		{ companyId: filters.companyId || undefined, take: 250 },
		{ enabled: Boolean(filters.companyId), staleTime: 30_000 },
	);
	const financeBooks = financeBooksData?.items ?? [];

	const updateFilter = React.useCallback(
		<Key extends keyof FixedAssetRegisterFilterState>(
			key: Key,
			value: FixedAssetRegisterFilterState[Key],
		) => {
			setFilters((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	const handleCompanyChange = React.useCallback((companyId: string) => {
		setFilters((current) =>
			selectFixedAssetRegisterCompany(current, companyId),
		);
	}, []);

	const handleGroupByChange = React.useCallback(
		(value: Asset.FixedAssetRegisterGroupBy) => {
			setFilters((current) => ({
				...current,
				groupBy: value,
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
					keyof FixedAssetRegisterFilterState
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
		() => buildFixedAssetRegisterInput(filters),
		[filters],
	);

	const {
		data,
		error: queryError,
		refetch,
	} = trpc.asset.listFixedAssetRegisterReport.useQuery(queryInput, {
		enabled: dateError === null && Boolean(filters.companyId),
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const exportMutation = trpc.asset.exportFixedAssetRegisterExcel.useMutation({
		onSuccess: (base64Data: string) => {
			downloadExcelBuffer(
				base64Data,
				`fixed_asset_register_${filters.fromDate}_to_${filters.toDate}.xlsx`,
			);
		},
	});

	const handleExportExcel = React.useCallback(() => {
		if (dateError !== null || !filters.companyId) return;
		exportMutation.mutate(queryInput);
	}, [dateError, exportMutation, filters.companyId, queryInput]);

	const rows = React.useMemo<Asset.FixedAssetRegisterRow[]>(
		() => data?.rows ?? [],
		[data?.rows],
	);
	const chartPoints = React.useMemo<Asset.FixedAssetRegisterChartPoint[]>(
		() => data?.chartPoints ?? [],
		[data?.chartPoints],
	);
	const summary =
		data?.summary ??
		({
			totalAssets: 0,
			totalPurchaseAmount: 0,
			totalDepreciatedAmount: 0,
			totalAccumulatedDepreciation: 0,
			totalRevaluationAmount: 0,
			totalNetBookValue: 0,
		} satisfies Asset.FixedAssetRegisterSummary);

	const columns = React.useMemo<
		ColumnDef<Asset.FixedAssetRegisterRow>[]
	>(() => {
		return [
			{
				id: "group",
				accessorFn: (row) => row.groupingLabel,
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title={
							filters.groupBy === "LOCATION" ? "Location" : "Asset Category"
						}
					/>
				),
				cell: ({ row }) => (
					<div className="flex flex-col">
						<span className="font-medium text-foreground">
							{row.original.groupingLabel}
						</span>
					</div>
				),
				meta: {
					label: filters.groupBy === "LOCATION" ? "Location" : "Asset Category",
					exportable: true,
				},
			},
			{
				accessorKey: "assetSeries",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Asset Series" />
				),
				cell: ({ row }) => (
					<Link
						href={`/asset/items/${row.original.assetId}`}
						className="font-mono text-sm text-primary hover:underline"
					>
						{row.original.assetSeries}
					</Link>
				),
				meta: { label: "Asset Series", exportable: true },
			},
			{
				accessorKey: "assetName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Asset Name" />
				),
				cell: ({ row }) => row.original.assetName,
				meta: { label: "Asset Name", exportable: true },
			},
			{
				accessorKey: "company",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company" />
				),
				cell: ({ row }) => row.original.company,
				meta: { label: "Company", exportable: true },
			},
			{
				accessorKey: "purchaseDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Purchase Date" />
				),
				cell: ({ row }) => formatDateLabel(row.original.purchaseDate),
				meta: { label: "Purchase Date", exportable: true },
			},
			{
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => (
					<span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium">
						{row.original.status}
					</span>
				),
				meta: { label: "Status", exportable: true },
			},
			{
				accessorKey: "netPurchaseAmount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Purchase Amount" />
				),
				cell: ({ row }) => formatCurrency(row.original.netPurchaseAmount),
				meta: { label: "Purchase Amount", exportable: true },
			},
			{
				accessorKey: "openingAccumulatedDepreciation",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Opening Dep." />
				),
				cell: ({ row }) =>
					formatCurrency(row.original.openingAccumulatedDepreciation),
				meta: { label: "Opening Depreciation", exportable: true },
			},
			{
				accessorKey: "depreciatedAmount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Depreciated Amount" />
				),
				cell: ({ row }) => formatCurrency(row.original.depreciatedAmount),
				meta: { label: "Depreciated Amount", exportable: true },
			},
			{
				accessorKey: "accumulatedDepreciation",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Accumulated Dep." />
				),
				cell: ({ row }) => formatCurrency(row.original.accumulatedDepreciation),
				meta: { label: "Accumulated Depreciation", exportable: true },
			},
			{
				accessorKey: "revaluationAmount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Revaluation" />
				),
				cell: ({ row }) => formatCurrency(row.original.revaluationAmount),
				meta: { label: "Revaluation Amount", exportable: true },
			},
			{
				accessorKey: "netBookValue",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Net Book Value" />
				),
				cell: ({ row }) => (
					<span className="font-semibold text-foreground">
						{formatCurrency(row.original.netBookValue)}
					</span>
				),
				meta: { label: "Net Book Value", exportable: true },
			},
		];
	}, [filters.groupBy]);

	const { table } = useAdvancedDataTable<Asset.FixedAssetRegisterRow>({
		data: rows,
		columns,
		initialPageSize: 25,
		enableRowSelection: false,
	});

	return (
		<div className="flex flex-col gap-6 p-6">
			{/* Page Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground">
						Fixed Asset Register
					</h1>
					<p className="text-sm text-muted-foreground">
						Asset-domain fixed asset register with Net Book Value calculations
						and trend analysis.
					</p>
					{data?.scope && (
						<p className="text-xs text-muted-foreground">
							Scope: {data.scope.company} ·{" "}
							{data.scope.financeBook ?? "No finance book"} · as of{" "}
							{data.scope.asOfDate}
						</p>
					)}
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleExportExcel}
						disabled={
							exportMutation.isPending ||
							dateError !== null ||
							!filters.companyId
						}
					>
						<Download className="mr-2 h-4 w-4" />
						{exportMutation.isPending ? "Exporting..." : "Export Excel"}
					</Button>
				</div>
			</div>

			{/* Filter Controls */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base font-semibold">
						Filter Criteria
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="groupBy" className="text-xs">
								Group By
							</Label>
							<Select
								value={filters.groupBy}
								onValueChange={(val) =>
									handleGroupByChange(val as Asset.FixedAssetRegisterGroupBy)
								}
							>
								<SelectTrigger id="groupBy" className="h-9">
									<SelectValue placeholder="Select Grouping" />
								</SelectTrigger>
								<SelectContent>
									{FIXED_ASSET_REGISTER_GROUP_BY_OPTIONS.map((opt) => (
										<SelectItem key={opt.value} value={opt.value}>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label htmlFor="company" className="text-xs">
								Company
							</Label>
							<CompanySearchSelect
								id="company"
								value={filters.companyId}
								onValueChange={handleCompanyChange}
								placeholder="Select Company"
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label htmlFor="financeBook" className="text-xs">
								Finance Book
							</Label>
							<Select
								value={
									filters.financeBookId || COMPANY_DEFAULT_FINANCE_BOOK_VALUE
								}
								onValueChange={(value) =>
									updateFilter(
										"financeBookId",
										value === COMPANY_DEFAULT_FINANCE_BOOK_VALUE ? "" : value,
									)
								}
							>
								<SelectTrigger id="financeBook" className="h-9">
									<SelectValue placeholder="Company default" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={COMPANY_DEFAULT_FINANCE_BOOK_VALUE}>
										Company default
									</SelectItem>
									{financeBooks.map((financeBook) => (
										<SelectItem key={financeBook.id} value={financeBook.id}>
											{financeBook.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label htmlFor="status" className="text-xs">
								Status
							</Label>
							<Select
								value={filters.status}
								onValueChange={(value) =>
									updateFilter(
										"status",
										value as Asset.FixedAssetRegisterStatus,
									)
								}
							>
								<SelectTrigger id="status" className="h-9">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="IN_LOCATION">In location</SelectItem>
									<SelectItem value="DISPOSED">Disposed</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label htmlFor="fromDate" className="text-xs">
								From Date
							</Label>
							<Input
								id="fromDate"
								type="date"
								className="h-9"
								value={filters.fromDate}
								onChange={(e) => updateFilter("fromDate", e.target.value)}
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label htmlFor="toDate" className="text-xs">
								To Date
							</Label>
							<Input
								id="toDate"
								type="date"
								className="h-9"
								value={filters.toDate}
								onChange={(e) => updateFilter("toDate", e.target.value)}
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label htmlFor="assetCategory" className="text-xs">
								Category
							</Label>
							<Input
								id="assetCategory"
								className="h-9"
								placeholder="Category name..."
								value={filters.assetCategory}
								onChange={(e) => updateFilter("assetCategory", e.target.value)}
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label htmlFor="location" className="text-xs">
								Location
							</Label>
							<Input
								id="location"
								className="h-9"
								placeholder="Location name..."
								value={filters.location}
								onChange={(e) => updateFilter("location", e.target.value)}
							/>
						</div>
					</div>

					{dateError && (
						<p className="mt-2 text-xs font-medium text-destructive">
							{dateError}
						</p>
					)}

					{hasActiveFilters && (
						<div className="mt-4 flex justify-end">
							<Button variant="ghost" size="sm" onClick={resetFilters}>
								<RotateCcw className="mr-2 h-3.5 w-3.5" />
								Reset Filters
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{/* KPI Summary Cards */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
				<SummaryCard
					title="Total Assets"
					value={summary.totalAssets.toLocaleString("en-IN")}
					description="Assets in register"
				/>
				<SummaryCard
					title="Purchase Amount"
					value={formatCurrency(summary.totalPurchaseAmount)}
					description="Gross acquisition value"
				/>
				<SummaryCard
					title="Depreciated Amount"
					value={formatCurrency(summary.totalDepreciatedAmount)}
					description="Total booked depreciation"
				/>
				<SummaryCard
					title="Revaluation Amount"
					value={formatCurrency(summary.totalRevaluationAmount)}
					description="Cumulative value adjustments"
				/>
				<SummaryCard
					title="Net Book Value"
					value={formatCurrency(summary.totalNetBookValue)}
					description="Current carrying value"
				/>
			</div>

			{/* Monthly Stacked Bar Chart */}
			{chartPoints.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base font-semibold">
							Monthly Asset Value & Depreciation Trends
						</CardTitle>
						<CardDescription>
							Stacked monthly breakdown of asset additions versus booked
							depreciation.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ChartContainer config={chartConfig} className="h-72 w-full">
							<BarChart data={chartPoints} margin={{ left: 12, right: 12 }}>
								<CartesianGrid vertical={false} strokeDasharray="3 3" />
								<XAxis dataKey="month" tickLine={false} axisLine={false} />
								<YAxis tickLine={false} axisLine={false} />
								<ChartTooltip content={<ChartTooltipContent />} />
								<Legend />
								<Bar
									dataKey="assetValue"
									stackId="a"
									fill="var(--color-assetValue)"
									radius={[0, 0, 4, 4]}
								/>
								<Bar
									dataKey="depreciatedAmount"
									stackId="a"
									fill="var(--color-depreciatedAmount)"
									radius={[4, 4, 0, 0]}
								/>
							</BarChart>
						</ChartContainer>
					</CardContent>
				</Card>
			)}

			{/* Main Data Table */}
			{queryError && (
				<ErrorState
					operation="load"
					title="Failed to load register report"
					error={queryError}
					onRetry={() => void refetch()}
				/>
			)}

			{!dateError && !queryError && (
				<AdvancedDataTable
					table={table}
					data={rows}
					enableExport
					onExport={handleExportExcel}
					ariaLabel="Fixed asset register table"
				/>
			)}
		</div>
	);
}
