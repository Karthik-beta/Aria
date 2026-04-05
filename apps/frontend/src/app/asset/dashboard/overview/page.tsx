"use client";

import type { Asset } from "@aria/types";
import {
	IconAlertTriangle,
	IconBuildingWarehouse,
	IconCircleCheck,
	IconFileInvoice,
	IconPackage,
	IconRefresh,
	IconShield,
	IconTool,
	IconTrendingDown,
} from "@tabler/icons-react";
import Link from "next/link";
import type * as React from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Label,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts";
import PageContainer from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	formatAdjustmentStatus,
	formatAssetStatus,
	formatCompactCurrency,
	formatCurrency,
	formatMonth,
	formatQuantity,
	formatRelativeDate,
	getActiveAssetsInsight,
	getAdjustmentStatusColor,
	getAssetStatusColor,
	getAssetValueInsight,
	getInsuranceUrgency,
	getMaintenanceDueInsight,
	getMaintenanceUrgency,
	getPendingAdjustmentsInsight,
} from "./dashboard.utils";

const DASHBOARD_GRID_CLASS =
	"grid grid-cols-1 gap-4 md:grid-cols-2 lg:auto-rows-[minmax(12rem,auto)] lg:grid-cols-12 lg:grid-flow-row-dense";
const CARD_SURFACE_CLASS =
	"h-full border-border/70 bg-card/95 shadow-sm supports-[backdrop-filter]:backdrop-blur";

function hasSeriesData<T extends object>(data: T[], keys: Array<keyof T>) {
	return data.some((row) =>
		keys.some((key) => {
			const value = (row as Record<PropertyKey, unknown>)[key as PropertyKey];
			return Math.abs(Number(value ?? 0)) > 0;
		}),
	);
}

function truncateLabel(label: string, maxLength: number) {
	return label.length > maxLength
		? `${label.slice(0, Math.max(maxLength - 1, 1))}…`
		: label;
}

// ── Realtime Subscriptions ────────────────────────────────────────────

function DashboardSubscriptions({ onEvent }: { onEvent: () => void }) {
	trpc.asset.onAssetsChanged.useSubscription(undefined, {
		onData: onEvent,
	});
	trpc.asset.onAssetValueAdjustmentsChanged.useSubscription(undefined, {
		onData: onEvent,
	});
	trpc.asset.onAssetMaintenancesChanged.useSubscription(undefined, {
		onData: onEvent,
	});
	return null;
}

// ── Empty / Skeleton States ───────────────────────────────────────────

function FooterLink({
	href,
	children,
}: {
	href: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			className="text-muted-foreground hover:text-foreground transition-colors"
		>
			{children}
		</Link>
	);
}

function CenteredCardState({
	icon: Icon,
	title,
	description,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description?: string;
}) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
			<Icon className="text-muted-foreground size-8" />
			<p className="text-sm font-medium">{title}</p>
			{description ? (
				<p className="text-muted-foreground max-w-xs text-xs">{description}</p>
			) : null}
		</div>
	);
}

function CartesianChartEmptyState({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="border-border/60 bg-muted/20 flex h-full min-h-[15rem] flex-col justify-between rounded-xl border border-dashed p-4">
			<div className="relative h-28 overflow-hidden rounded-lg bg-background/80">
				<div className="absolute inset-0 grid grid-rows-4">
					{["grid-1", "grid-2", "grid-3", "grid-4"].map((line) => (
						<div
							key={line}
							className="border-border/50 border-b last:border-b-0"
						/>
					))}
				</div>
				<div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
					{["h-10", "h-14", "h-8", "h-16", "h-12", "h-9"].map((height) => (
						<div
							key={height}
							className={cn(
								"from-muted-foreground/20 to-muted-foreground/5 w-full rounded-t-md bg-gradient-to-t",
								height,
							)}
						/>
					))}
				</div>
			</div>
			<div className="space-y-1 pt-4 text-center">
				<p className="text-sm font-medium">{title}</p>
				<p className="text-muted-foreground text-xs">{description}</p>
			</div>
		</div>
	);
}

function DonutChartEmptyState({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="border-border/60 bg-muted/20 flex h-full min-h-[15rem] flex-col items-center justify-center gap-5 rounded-xl border border-dashed p-4">
			<div className="relative flex size-40 items-center justify-center rounded-full border-[18px] border-muted-foreground/10">
				<div className="flex size-20 items-center justify-center rounded-full border border-border/70 bg-background/90">
					<span className="text-muted-foreground text-xs font-medium">
						No data
					</span>
				</div>
				<div className="absolute inset-0 rotate-[-32deg] rounded-full border-t-[18px] border-t-muted-foreground/20" />
			</div>
			<div className="space-y-1 text-center">
				<p className="text-sm font-medium">{title}</p>
				<p className="text-muted-foreground max-w-xs text-xs">{description}</p>
			</div>
		</div>
	);
}

function KpiSkeleton({ className }: { className?: string }) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[9.75rem]", className)}>
			<CardHeader>
				<Skeleton className="h-4 w-28" />
				<Skeleton className="mt-2 h-10 w-32" />
			</CardHeader>
			<CardFooter className="mt-auto">
				<Skeleton className="h-4 w-40" />
			</CardFooter>
		</Card>
	);
}

function TileSkeleton({
	className,
	heightClassName = "min-h-[18rem]",
}: {
	className?: string;
	heightClassName?: string;
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, heightClassName, className)}>
			<CardHeader>
				<Skeleton className="h-5 w-44" />
				<Skeleton className="mt-1 h-4 w-56" />
			</CardHeader>
			<CardContent className="flex flex-1">
				<Skeleton className="h-full min-h-[12rem] w-full rounded-xl" />
			</CardContent>
		</Card>
	);
}

function DashboardSkeletonGrid() {
	return (
		<>
			<KpiSkeleton className="lg:col-span-3" />
			<KpiSkeleton className="lg:col-span-3" />
			<KpiSkeleton className="lg:col-span-3" />
			<KpiSkeleton className="lg:col-span-3" />
			<TileSkeleton className="lg:col-span-8" />
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-8" />
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-4 lg:row-span-2" />
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-4" />
		</>
	);
}

// ── Main Dashboard ────────────────────────────────────────────────────

export default function OverviewPage() {
	const utils = trpc.useUtils();

	const { data, isLoading, error, refetch } =
		trpc.asset.getDashboardData.useQuery(undefined, {
			refetchOnWindowFocus: false,
			staleTime: 30_000,
		});

	const handleRealtimeEvent = () => {
		void utils.asset.getDashboardData.invalidate();
	};

	if (error) {
		return (
			<PageContainer>
				<div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
					<IconAlertTriangle className="text-destructive size-12" />
					<p className="text-muted-foreground text-sm">
						Failed to load dashboard data
					</p>
					<Button variant="outline" size="sm" onClick={() => refetch()}>
						<IconRefresh className="mr-2 size-4" />
						Retry
					</Button>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<DashboardSubscriptions onEvent={handleRealtimeEvent} />

			<div className="flex flex-1 flex-col gap-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<h2 className="text-2xl font-bold tracking-tight">
							Asset Dashboard
						</h2>
						<p className="text-muted-foreground text-sm">
							Real-time overview of asset health, depreciation, and maintenance
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={isLoading}
					>
						<IconRefresh
							className={cn("mr-2 size-4", isLoading && "animate-spin")}
						/>
						Refresh
					</Button>
				</div>

				<div className={DASHBOARD_GRID_CLASS}>
					{isLoading ? <DashboardSkeletonGrid /> : null}
					{!isLoading && data ? (
						<>
							<KpiCards kpis={data.kpis} />
							<DepreciationTrendChart
								className="lg:col-span-8"
								data={data.depreciationTrend}
							/>
							<StatusDistributionChart
								className="lg:col-span-4"
								data={data.statusDistribution}
							/>
							<CategoryValueChart
								className="lg:col-span-4"
								data={data.categoryValues}
							/>
							<LocationDistributionChart
								className="lg:col-span-8"
								data={data.locationDistribution}
							/>
							<MaintenanceDueList
								className="lg:col-span-4"
								data={data.maintenanceDue}
							/>
							<RecentActivityFeed
								className="lg:col-span-4 lg:row-span-2"
								data={data.recentActivity}
							/>
							<InsuranceExpiryTracker
								className="lg:col-span-4"
								data={data.insuranceExpiry}
							/>
							<AdjustmentSummaryCard
								className="lg:col-span-4"
								data={data.adjustmentSummary}
							/>
						</>
					) : null}
				</div>
			</div>
		</PageContainer>
	);
}

// ── KPI Cards ─────────────────────────────────────────────────────────

function KpiCards({ kpis }: { kpis: Asset.AssetDashboardKpi }) {
	const valueInsight = getAssetValueInsight(
		kpis.totalAssetValue,
		kpis.totalPurchaseValue,
	);
	const activeInsight = getActiveAssetsInsight(
		kpis.activeAssets,
		kpis.totalAssets,
		kpis.locationCount,
	);
	const maintenanceInsight = getMaintenanceDueInsight(kpis.maintenanceDueCount);
	const adjustmentInsight = getPendingAdjustmentsInsight(
		kpis.pendingAdjustments,
	);

	return (
		<>
			<KpiCard
				className="lg:col-span-3"
				title="Total Asset Value"
				value={formatCompactCurrency(kpis.totalAssetValue)}
				insightText={valueInsight.text}
				insightSubtext={valueInsight.subtext}
				insightColorClass={valueInsight.colorClass}
				insightIcon={IconPackage}
				action={
					<Badge variant="outline" className="text-xs">
						<IconTrendingDown className="size-3" />
						{formatCompactCurrency(kpis.totalDepreciation)} dep.
					</Badge>
				}
			/>
			<KpiCard
				className="lg:col-span-3"
				title="Active Assets"
				value={formatQuantity(kpis.activeAssets)}
				insightText={activeInsight.text}
				insightSubtext={activeInsight.subtext}
				insightColorClass={activeInsight.colorClass}
				insightIcon={IconBuildingWarehouse}
				action={
					<Badge variant="outline" className="text-xs">
						<IconPackage className="size-3" />
						{kpis.totalAssets} total
					</Badge>
				}
			/>
			<KpiCard
				className="lg:col-span-3"
				title="Maintenance Due"
				value={formatQuantity(kpis.maintenanceDueCount)}
				insightText={maintenanceInsight.text}
				insightSubtext={maintenanceInsight.subtext}
				insightColorClass={maintenanceInsight.colorClass}
				insightIcon={
					kpis.maintenanceDueCount === 0 ? IconCircleCheck : IconTool
				}
				action={
					kpis.maintenanceDueCount > 0 ? (
						<Badge variant="destructive" className="text-xs">
							<IconAlertTriangle className="size-3" />
							Attention
						</Badge>
					) : (
						<Badge
							variant="outline"
							className="text-xs text-green-600 dark:text-green-400"
						>
							All Clear
						</Badge>
					)
				}
			/>
			<KpiCard
				className="lg:col-span-3"
				title="Pending Adjustments"
				value={formatQuantity(kpis.pendingAdjustments)}
				insightText={adjustmentInsight.text}
				insightSubtext={adjustmentInsight.subtext}
				insightColorClass={adjustmentInsight.colorClass}
				insightIcon={
					kpis.pendingAdjustments === 0 ? IconCircleCheck : IconFileInvoice
				}
				action={
					<Badge variant="outline" className="text-xs">
						<IconFileInvoice className="size-3" />
						Drafts
					</Badge>
				}
			/>
		</>
	);
}

function KpiCard({
	className,
	title,
	value,
	insightText,
	insightSubtext,
	insightIcon: InsightIcon,
	insightColorClass,
	action,
}: {
	className?: string;
	title: string;
	value: string;
	insightText: string;
	insightSubtext: string;
	insightIcon: React.ComponentType<{ className?: string }>;
	insightColorClass?: string;
	action?: React.ReactNode;
}) {
	return (
		<Card
			className={cn(
				CARD_SURFACE_CLASS,
				"@container/card min-h-[9.75rem] bg-gradient-to-b from-background to-muted/20",
				className,
			)}
		>
			<CardHeader>
				<CardDescription>{title}</CardDescription>
				<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
					{value}
				</CardTitle>
				{action ? <CardAction>{action}</CardAction> : null}
			</CardHeader>
			<CardFooter className="flex-col items-start gap-1.5 text-sm">
				<div
					className={cn(
						"line-clamp-1 flex items-center gap-2 font-medium",
						insightColorClass,
					)}
				>
					<InsightIcon className="size-4 shrink-0" />
					{insightText}
				</div>
				<div className="text-muted-foreground">{insightSubtext}</div>
			</CardFooter>
		</Card>
	);
}

// ── Depreciation Trend Area Chart ─────────────────────────────────────

const depreciationChartConfig = {
	amount: {
		label: "Depreciation",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

function DepreciationTrendChart({
	className,
	data,
}: {
	className?: string;
	data: Asset.AssetDashboardDepreciationTrend[];
}) {
	const hasTrendData = hasSeriesData(data, ["amount"]);

	return (
		<Card className={cn(CARD_SURFACE_CLASS, className)}>
			<CardHeader>
				<CardTitle>Depreciation Trend</CardTitle>
				<CardDescription>
					Monthly depreciation amounts across active schedules
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 px-2 pb-2 pt-4 sm:px-6 sm:pt-6">
				{hasTrendData ? (
					<ChartContainer
						config={depreciationChartConfig}
						className="aspect-auto h-full w-full min-w-0"
					>
						<AreaChart
							data={data}
							margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
						>
							<defs>
								<linearGradient
									id="dashFillDepreciation"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="5%"
										stopColor="var(--color-amount)"
										stopOpacity={0.7}
									/>
									<stop
										offset="95%"
										stopColor="var(--color-amount)"
										stopOpacity={0.05}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="month"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={28}
								tickFormatter={formatMonth}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) => formatCompactCurrency(value)}
								width="auto"
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										indicator="dot"
										labelFormatter={(label) =>
											typeof label === "string"
												? formatMonth(label)
												: String(label ?? "")
										}
										formatter={(value) => formatCurrency(Number(value ?? 0))}
									/>
								}
							/>
							<Area
								dataKey="amount"
								type="monotone"
								fill="url(#dashFillDepreciation)"
								stroke="var(--color-amount)"
								strokeWidth={2}
							/>
						</AreaChart>
					</ChartContainer>
				) : (
					<CartesianChartEmptyState
						title="No depreciation data yet"
						description="Depreciation trends will appear here once active schedules begin generating entries."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<div className="text-muted-foreground text-sm">
					Based on active depreciation schedule entries
				</div>
			</CardFooter>
		</Card>
	);
}

// ── Asset Status Distribution Donut ───────────────────────────────────

function StatusDistributionChart({
	className,
	data,
}: {
	className?: string;
	data: Asset.AssetDashboardStatusDistribution[];
}) {
	const totalAssets = data.reduce((sum, item) => sum + item.count, 0);
	const hasStatusData = hasSeriesData(data, ["count"]);
	const chartConfig: ChartConfig = { count: { label: "Assets" } };
	for (const [_index, item] of data.entries()) {
		chartConfig[item.status] = {
			label: formatAssetStatus(item.status),
			color: getAssetStatusColor(item.status),
		};
	}

	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[18rem]", className)}>
			<CardHeader>
				<CardTitle>Status Distribution</CardTitle>
				<CardDescription>
					{totalAssets} assets across {data.length} status
					{data.length === 1 ? "" : "es"}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 items-center justify-center px-4 pb-0 pt-0 sm:px-6">
				{data.length > 0 && hasStatusData ? (
					<ChartContainer
						config={chartConfig}
						className="mx-auto aspect-auto h-[15rem] w-full max-w-[20rem] min-w-0"
					>
						<PieChart>
							<ChartTooltip
								cursor={false}
								content={<ChartTooltipContent hideLabel />}
							/>
							<Pie
								data={data.map((item) => ({
									name: formatAssetStatus(item.status),
									value: item.count,
									totalValue: item.value,
									fill: getAssetStatusColor(item.status),
								}))}
								dataKey="value"
								nameKey="name"
								innerRadius={58}
								outerRadius={88}
								paddingAngle={2}
								strokeWidth={2}
								stroke="var(--background)"
							>
								<Label
									content={({ viewBox }) => {
										if (viewBox && "cx" in viewBox && "cy" in viewBox) {
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
														className="fill-foreground text-xl font-bold"
													>
														{totalAssets}
													</tspan>
													<tspan
														x={viewBox.cx}
														y={(viewBox.cy ?? 0) + 20}
														className="fill-muted-foreground text-[11px]"
													>
														Assets
													</tspan>
												</text>
											);
										}
										return null;
									}}
								/>
							</Pie>
						</PieChart>
					</ChartContainer>
				) : (
					<DonutChartEmptyState
						title="No assets registered yet"
						description="Status distribution will appear here once assets are created."
					/>
				)}
			</CardContent>
			{data.length > 0 ? (
				<CardFooter className="mt-auto flex flex-wrap gap-3 pt-0">
					{data.map((item) => (
						<div
							key={item.status}
							className="flex items-center gap-1.5 text-xs"
						>
							<span
								className="inline-block size-2.5 rounded-full"
								style={{
									backgroundColor: getAssetStatusColor(item.status),
								}}
							/>
							<span className="text-muted-foreground">
								{formatAssetStatus(item.status)} ({item.count})
							</span>
						</div>
					))}
				</CardFooter>
			) : null}
		</Card>
	);
}

// ── Category Value Horizontal Bar Chart ───────────────────────────────

const categoryChartConfig = {
	currentValue: {
		label: "Current Value",
		color: "var(--chart-2)",
	},
	purchaseValue: {
		label: "Purchase Value",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;

function CategoryValueChart({
	className,
	data,
}: {
	className?: string;
	data: Asset.AssetDashboardCategoryValue[];
}) {
	const hasCategoryData = hasSeriesData(data, [
		"currentValue",
		"purchaseValue",
	]);

	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[18rem]", className)}>
			<CardHeader>
				<CardTitle>Value by Category</CardTitle>
				<CardDescription>
					Purchase vs current value across {data.length} categor
					{data.length === 1 ? "y" : "ies"}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 px-2 pb-2 pt-4 sm:px-6 sm:pt-6">
				{hasCategoryData ? (
					<ChartContainer
						config={categoryChartConfig}
						className="aspect-auto h-full min-h-[15rem] w-full min-w-0"
					>
						<BarChart
							data={data}
							layout="vertical"
							margin={{ top: 8, right: 8, bottom: 0, left: -24 }}
						>
							<CartesianGrid horizontal={false} />
							<YAxis
								dataKey="category"
								type="category"
								tickLine={false}
								axisLine={false}
								width="auto"
								tick={{ fontSize: 11 }}
								tickFormatter={(value: string) => truncateLabel(value, 16)}
							/>
							<XAxis
								type="number"
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) => formatCompactCurrency(value)}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(label) =>
											typeof label === "string" ? label : "Category"
										}
										formatter={(value) => formatCurrency(Number(value ?? 0))}
									/>
								}
							/>
							<Bar
								dataKey="currentValue"
								fill="var(--color-currentValue)"
								radius={[0, 6, 6, 0]}
							/>
						</BarChart>
					</ChartContainer>
				) : (
					<CartesianChartEmptyState
						title="No categorised assets yet"
						description="Category value comparison will appear here once assets are assigned to categories."
					/>
				)}
			</CardContent>
		</Card>
	);
}

// ── Location Distribution Bar Chart ───────────────────────────────────

const locationChartConfig = {
	totalValue: {
		label: "Total Value",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;

function LocationDistributionChart({
	className,
	data,
}: {
	className?: string;
	data: Asset.AssetDashboardLocationDistribution[];
}) {
	const hasLocationData = hasSeriesData(data, ["totalValue"]);

	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[18rem]", className)}>
			<CardHeader>
				<CardTitle>Asset Value by Location</CardTitle>
				<CardDescription>
					{formatCompactCurrency(data.reduce((s, d) => s + d.totalValue, 0))}{" "}
					across {data.length} location{data.length === 1 ? "" : "s"}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 px-2 pb-2 pt-4 sm:px-6 sm:pt-6">
				{hasLocationData ? (
					<ChartContainer
						config={locationChartConfig}
						className="aspect-auto h-full min-h-[15rem] w-full min-w-0"
					>
						<BarChart
							data={data}
							margin={{ top: 8, right: 8, bottom: 12, left: 0 }}
						>
							<defs>
								<linearGradient
									id="dashLocationFill"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="5%"
										stopColor="var(--color-totalValue)"
										stopOpacity={0.95}
									/>
									<stop
										offset="95%"
										stopColor="var(--color-totalValue)"
										stopOpacity={0.55}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="location"
								tickLine={false}
								tickMargin={8}
								axisLine={false}
								tick={{ fontSize: 11 }}
								interval={0}
								angle={-30}
								textAnchor="end"
								height={56}
								tickFormatter={(value: string) => truncateLabel(value, 14)}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) => formatCompactCurrency(value)}
								width="auto"
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(label) =>
											typeof label === "string" ? label : "Location"
										}
										formatter={(value) => formatCurrency(Number(value ?? 0))}
									/>
								}
							/>
							<Bar
								dataKey="totalValue"
								fill="url(#dashLocationFill)"
								radius={[6, 6, 0, 0]}
							/>
						</BarChart>
					</ChartContainer>
				) : (
					<CartesianChartEmptyState
						title="No location data yet"
						description="Asset distribution by location will appear here once assets are deployed."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<div className="text-muted-foreground text-sm">
					{data.length} location{data.length === 1 ? "" : "s"} shown ·{" "}
					{data.reduce((s, d) => s + d.assetCount, 0)} total assets
				</div>
			</CardFooter>
		</Card>
	);
}

// ── Maintenance Due List ──────────────────────────────────────────────

function MaintenanceDueList({
	className,
	data,
}: {
	className?: string;
	data: Asset.AssetDashboardMaintenanceDue[];
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[18rem]", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconTool className="size-4" />
					Maintenance Due
				</CardTitle>
				<CardDescription>
					{data.length} task{data.length === 1 ? "" : "s"} due within 90 days
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col gap-3">
						{data.slice(0, 6).map((task) => {
							const urgency = getMaintenanceUrgency(task.daysUntilDue);

							return (
								<div
									key={task.taskId}
									className="flex items-center justify-between gap-3"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">
											{task.assetName}
										</p>
										<p className="text-muted-foreground truncate text-xs">
											{task.maintenanceTask}
											{task.assignToName ? ` · ${task.assignToName}` : ""}
										</p>
									</div>
									<div className="text-right">
										<Badge
											variant="outline"
											className={cn("text-xs", urgency.className)}
										>
											{urgency.label}
										</Badge>
										<p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
											{task.daysUntilDue <= 0
												? "Overdue"
												: `${task.daysUntilDue}d left`}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<CenteredCardState
						icon={IconTool}
						title="No maintenance tasks due"
						description="Upcoming maintenance within 90 days will appear here."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/asset/maintenance">
					View all maintenance →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}

// ── Recent Activity Feed ──────────────────────────────────────────────

function RecentActivityFeed({
	className,
	data,
}: {
	className?: string;
	data: Asset.AssetDashboardRecentActivity[];
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, className)}>
			<CardHeader>
				<CardTitle>Recent Asset Activity</CardTitle>
				<CardDescription>Latest asset transactions and changes</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col gap-4">
						{data.map((entry) => (
							<div key={entry.id} className="flex items-start gap-3">
								<div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
									<IconPackage className="text-chart-3 size-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center justify-between gap-2">
										<p className="truncate text-sm font-medium">
											{entry.assetName}
										</p>
										<span className="text-muted-foreground shrink-0 text-xs">
											{formatRelativeDate(entry.createdAt)}
										</span>
									</div>
									<p className="text-muted-foreground truncate text-xs">
										{entry.activity} · {entry.assetSeries}
									</p>
								</div>
							</div>
						))}
					</div>
				) : (
					<CenteredCardState
						icon={IconPackage}
						title="No recent asset activity"
						description="Asset operations will appear here as changes are recorded."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/asset/asset">View all assets →</FooterLink>
			</CardFooter>
		</Card>
	);
}

// ── Insurance Expiry Tracker ──────────────────────────────────────────

function InsuranceExpiryTracker({
	className,
	data,
}: {
	className?: string;
	data: Asset.AssetDashboardInsuranceExpiry[];
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[17rem]", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconShield className="text-amber-500 size-4" />
					Insurance Expiry
				</CardTitle>
				<CardDescription>
					{data.length} polic{data.length === 1 ? "y" : "ies"} expiring within
					90 days
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col justify-center gap-3">
						{data.slice(0, 6).map((asset) => {
							const urgency = getInsuranceUrgency(asset.daysUntilExpiry);

							return (
								<div
									key={asset.assetId}
									className="flex items-center justify-between gap-3"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">
											{asset.assetName}
										</p>
										<p className="text-muted-foreground truncate text-xs">
											{asset.insurer} · {asset.policyNumber}
										</p>
									</div>
									<div className="text-right">
										<Badge
											variant="outline"
											className={cn("text-xs", urgency.className)}
										>
											{urgency.label}
										</Badge>
										<p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
											{asset.daysUntilExpiry <= 0
												? "Expired"
												: `${asset.daysUntilExpiry}d left`}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<CenteredCardState
						icon={IconShield}
						title="No policies expiring soon"
						description="Insurance expiries within the next 90 days will appear here."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/asset/asset">View insured assets →</FooterLink>
			</CardFooter>
		</Card>
	);
}

// ── Adjustment Summary Card ───────────────────────────────────────────

function AdjustmentSummaryCard({
	className,
	data,
}: {
	className?: string;
	data: Asset.AssetDashboardAdjustmentSummary[];
}) {
	const totalAdjustments = data.reduce((sum, item) => sum + item.count, 0);
	const totalAmount = data.reduce((sum, item) => sum + item.totalAmount, 0);

	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[17rem]", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconFileInvoice className="size-4" />
					Value Adjustments
				</CardTitle>
				<CardDescription>
					{totalAdjustments} adjustment{totalAdjustments === 1 ? "" : "s"} ·{" "}
					{formatCompactCurrency(totalAmount)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col justify-center gap-4">
						{data.map((item) => {
							const percent =
								totalAdjustments > 0
									? Math.round((item.count / totalAdjustments) * 100)
									: 0;

							return (
								<div key={item.status}>
									<div className="mb-1 flex items-center justify-between">
										<span className="text-sm font-medium">
											{formatAdjustmentStatus(item.status)}
										</span>
										<span className="text-muted-foreground text-xs tabular-nums">
											{item.count} ({percent}%)
										</span>
									</div>
									<div className="bg-muted h-2 overflow-hidden rounded-full">
										<div
											className="h-full rounded-full transition-all"
											style={{
												width: `${percent}%`,
												backgroundColor: getAdjustmentStatusColor(item.status),
											}}
										/>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<CenteredCardState
						icon={IconFileInvoice}
						title="No value adjustments yet"
						description="Adjustment status will appear here once value adjustments are created."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/asset/value-adjustment">
					View all adjustments →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}
