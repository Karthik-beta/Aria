"use client";

import type { Inventory } from "@aria/types";
import {
	IconAlertTriangle,
	IconArrowDown,
	IconArrowUp,
	IconBox,
	IconBuildingWarehouse,
	IconClock,
	IconFileInvoice,
	IconPackage,
	IconRefresh,
	IconTruckDelivery,
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
	formatCompactCurrency,
	formatCurrency,
	formatDeliveryStatus,
	formatQuantity,
	formatRelativeDate,
	formatShortDate,
	formatStockEntryType,
	getChartColor,
	getDeliveryStatusColor,
	getExpiryUrgency,
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
	trpc.inventory.onStockEntriesChanged.useSubscription(undefined, {
		onData: onEvent,
	});
	trpc.inventory.onItemsChanged.useSubscription(undefined, {
		onData: onEvent,
	});
	trpc.inventory.onMaterialRequestsChanged.useSubscription(undefined, {
		onData: onEvent,
	});
	trpc.inventory.onDeliveryNotesChanged.useSubscription(undefined, {
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
			className="text-muted-foreground hover:text-foreground text-xs transition-colors"
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
			<TileSkeleton
				className="lg:col-span-8 lg:row-span-2"
				heightClassName="min-h-[28rem]"
			/>
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-8" />
			<TileSkeleton
				className="lg:col-span-4 lg:row-span-2"
				heightClassName="min-h-[28rem]"
			/>
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-6" />
			<TileSkeleton className="lg:col-span-6" />
		</>
	);
}

// ── Main Dashboard ────────────────────────────────────────────────────

export default function OverviewPage() {
	const utils = trpc.useUtils();

	const { data, isLoading, error, refetch } =
		trpc.inventory.getDashboardData.useQuery(undefined, {
			refetchOnWindowFocus: false,
			staleTime: 30_000,
		});

	const handleRealtimeEvent = () => {
		void utils.inventory.getDashboardData.invalidate();
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
							Inventory Dashboard
						</h2>
						<p className="text-muted-foreground text-sm">
							Real-time overview of stock health, movements, and operations
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
							<StockMovementChart
								className="lg:col-span-8 lg:row-span-2"
								data={data.stockMovements}
							/>
							<WarehouseStockChart
								className="lg:col-span-4"
								data={data.warehouseStock}
							/>
							<ItemGroupDistributionChart
								className="lg:col-span-4"
								data={data.itemGroupDistribution}
							/>
							<TopMovingItemsChart
								className="lg:col-span-8"
								data={data.topMovingItems}
							/>
							<RecentActivityFeed
								className="lg:col-span-4 lg:row-span-2"
								data={data.recentActivity}
							/>
							<StockEntryBreakdownChart
								className="lg:col-span-4"
								data={data.stockEntryTypeBreakdown}
							/>
							<LowStockAlerts
								className="lg:col-span-4"
								data={data.lowStockItems}
							/>
							<BatchExpiryTracker
								className="lg:col-span-6"
								data={data.batchExpiry}
							/>
							<DeliveryStatusCard
								className="lg:col-span-6"
								data={data.deliveryStatus}
							/>
						</>
					) : null}
				</div>
			</div>
		</PageContainer>
	);
}

// ── KPI Cards ─────────────────────────────────────────────────────────

function KpiCards({ kpis }: { kpis: Inventory.DashboardKpi }) {
	return (
		<>
			<KpiCard
				className="lg:col-span-3"
				title="Total Stock Value"
				value={formatCompactCurrency(kpis.totalStockValue)}
				footer={`Across ${kpis.totalItems} active items`}
				action={
					<Badge variant="outline" className="text-xs">
						<IconPackage className="size-3" />
						{formatQuantity(kpis.totalStockQuantity)} units
					</Badge>
				}
			/>
			<KpiCard
				className="lg:col-span-3"
				title="Active Items"
				value={formatQuantity(kpis.totalItems)}
				footer="Stock tracked across all locations"
				action={
					<Badge variant="outline" className="text-xs">
						<IconBuildingWarehouse className="size-3" />
						{kpis.activeWarehouses} warehouses
					</Badge>
				}
			/>
			<KpiCard
				className="lg:col-span-3"
				title="Low Stock Alerts"
				value={formatQuantity(kpis.lowStockItemCount)}
				footer="Items below safety stock level"
				action={
					kpis.lowStockItemCount > 0 ? (
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
			<Card
				className={cn(
					CARD_SURFACE_CLASS,
					"@container/card min-h-[9.75rem] bg-gradient-to-b from-background to-muted/20 lg:col-span-3",
				)}
			>
				<CardHeader>
					<CardDescription>Pending Material Requests</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{kpis.pendingMaterialRequests}
					</CardTitle>
					<CardAction>
						<Badge variant="outline" className="text-xs">
							<IconFileInvoice className="size-3" />
							Open
						</Badge>
					</CardAction>
				</CardHeader>
				<CardFooter className="mt-auto">
					<FooterLink href="/inventory/stock-transaction/material-request">
						View all requests →
					</FooterLink>
				</CardFooter>
			</Card>
		</>
	);
}

function KpiCard({
	className,
	title,
	value,
	footer,
	action,
}: {
	className?: string;
	title: string;
	value: string;
	footer: string;
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
			<CardFooter className="mt-auto">
				<div className="text-muted-foreground text-sm">{footer}</div>
			</CardFooter>
		</Card>
	);
}

// ── Stock Movement Area Chart ─────────────────────────────────────────

const movementChartConfig = {
	inbound: {
		label: "Inbound",
		color: "var(--chart-2)",
	},
	outbound: {
		label: "Outbound",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

function StockMovementChart({
	className,
	data,
}: {
	className?: string;
	data: Inventory.DashboardStockMovement[];
}) {
	const hasMovementData = hasSeriesData(data, ["inbound", "outbound"]);

	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[28rem]", className)}>
			<CardHeader>
				<CardTitle>Stock Movements</CardTitle>
				<CardDescription>
					Inbound vs outbound quantity over the last 30 days
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 px-2 pb-2 pt-4 sm:px-6 sm:pt-6">
				{hasMovementData ? (
					<ChartContainer
						config={movementChartConfig}
						className="aspect-auto h-full min-h-[20rem] w-full min-w-0"
					>
						<AreaChart
							data={data}
							margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
						>
							<defs>
								<linearGradient
									id="dashFillInbound"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="5%"
										stopColor="var(--color-inbound)"
										stopOpacity={0.7}
									/>
									<stop
										offset="95%"
										stopColor="var(--color-inbound)"
										stopOpacity={0.05}
									/>
								</linearGradient>
								<linearGradient
									id="dashFillOutbound"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="5%"
										stopColor="var(--color-outbound)"
										stopOpacity={0.7}
									/>
									<stop
										offset="95%"
										stopColor="var(--color-outbound)"
										stopOpacity={0.05}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="date"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={28}
								tickFormatter={formatShortDate}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) => formatQuantity(value)}
								width="auto"
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										indicator="dot"
										labelFormatter={(label) =>
											typeof label === "string"
												? formatShortDate(label)
												: String(label ?? "")
										}
									/>
								}
							/>
							<Area
								dataKey="inbound"
								type="monotone"
								fill="url(#dashFillInbound)"
								stroke="var(--color-inbound)"
								strokeWidth={2}
							/>
							<Area
								dataKey="outbound"
								type="monotone"
								fill="url(#dashFillOutbound)"
								stroke="var(--color-outbound)"
								strokeWidth={2}
							/>
						</AreaChart>
					</ChartContainer>
				) : (
					<CartesianChartEmptyState
						title="No committed stock movement yet"
						description="Inbound and outbound trends will appear here as receipts, entries, and deliveries are posted."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<div className="text-muted-foreground text-sm">
					Tracking all stock entries, purchase receipts, and delivery notes
				</div>
			</CardFooter>
		</Card>
	);
}

// ── Warehouse Stock Bar Chart ─────────────────────────────────────────

const warehouseChartConfig = {
	totalQty: {
		label: "Stock Quantity",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

function WarehouseStockChart({
	className,
	data,
}: {
	className?: string;
	data: Inventory.DashboardWarehouseStock[];
}) {
	const hasWarehouseData = hasSeriesData(data, ["totalQty"]);

	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[18rem]", className)}>
			<CardHeader>
				<CardTitle>Warehouse Distribution</CardTitle>
				<CardDescription>
					Stock quantity across {data.length} warehouse
					{data.length === 1 ? "" : "s"}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 px-2 pb-2 pt-4 sm:px-6 sm:pt-6">
				{hasWarehouseData ? (
					<ChartContainer
						config={warehouseChartConfig}
						className="aspect-auto h-full min-h-[15rem] w-full min-w-0"
					>
						<BarChart
							data={data}
							layout="vertical"
							margin={{ top: 8, right: 8, bottom: 0, left: -24 }}
						>
							<CartesianGrid horizontal={false} />
							<YAxis
								dataKey="warehouse"
								type="category"
								tickLine={false}
								axisLine={false}
								width="auto"
								tick={{ fontSize: 12 }}
								tickFormatter={(value: string) => truncateLabel(value, 18)}
							/>
							<XAxis
								type="number"
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) => formatQuantity(value)}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(label) =>
											typeof label === "string" ? label : "Warehouse"
										}
										formatter={(value) => formatQuantity(Number(value ?? 0))}
									/>
								}
							/>
							<Bar
								dataKey="totalQty"
								fill="var(--color-totalQty)"
								radius={[0, 6, 6, 0]}
							/>
						</BarChart>
					</ChartContainer>
				) : (
					<CartesianChartEmptyState
						title="No warehouse stock to compare"
						description="Warehouse balances will appear here once committed stock is distributed across active locations."
					/>
				)}
			</CardContent>
		</Card>
	);
}

// ── Item Group Distribution Donut ─────────────────────────────────────

function ItemGroupDistributionChart({
	className,
	data,
}: {
	className?: string;
	data: Inventory.DashboardItemGroupDistribution[];
}) {
	const totalValue = data.reduce((sum, item) => sum + item.value, 0);
	const hasCategoryValue = hasSeriesData(data, ["value"]);
	const chartConfig: ChartConfig = { value: { label: "Stock Value" } };
	for (const [index, item] of data.entries()) {
		chartConfig[item.group] = {
			label: item.group,
			color: getChartColor(index),
		};
	}

	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[18rem]", className)}>
			<CardHeader>
				<CardTitle>Stock Value by Category</CardTitle>
				<CardDescription>
					{formatCompactCurrency(totalValue)} across {data.length}{" "}
					{data.length === 1 ? "category" : "categories"}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 items-center justify-center px-4 pb-0 pt-0 sm:px-6">
				{data.length > 0 && hasCategoryValue ? (
					<ChartContainer
						config={chartConfig}
						className="mx-auto aspect-auto h-[15rem] w-full max-w-[20rem] min-w-0"
					>
						<PieChart>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										hideLabel
										formatter={(value) => formatCurrency(Number(value ?? 0))}
									/>
								}
							/>
							<Pie
								data={data.map((item, index) => ({
									...item,
									name: item.group,
									fill: getChartColor(index),
								}))}
								dataKey="value"
								nameKey="group"
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
														{formatCompactCurrency(totalValue)}
													</tspan>
													<tspan
														x={viewBox.cx}
														y={(viewBox.cy ?? 0) + 20}
														className="fill-muted-foreground text-[11px]"
													>
														Total Value
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
						title="No stock value recorded yet"
						description="Categories are ready. Value distribution will populate as committed stock is available for tracked items."
					/>
				)}
			</CardContent>
			{data.length > 0 ? (
				<CardFooter className="mt-auto flex flex-wrap gap-3 pt-0">
					{data.slice(0, 5).map((item, index) => (
						<div key={item.group} className="flex items-center gap-1.5 text-xs">
							<span
								className="inline-block size-2.5 rounded-full"
								style={{ backgroundColor: getChartColor(index) }}
							/>
							<span className="text-muted-foreground">
								{truncateLabel(item.group, 20)}
							</span>
						</div>
					))}
				</CardFooter>
			) : null}
		</Card>
	);
}

// ── Stock Entry Type Breakdown Pie ────────────────────────────────────

function StockEntryBreakdownChart({
	className,
	data,
}: {
	className?: string;
	data: Inventory.DashboardStockEntryTypeBreakdown[];
}) {
	const totalEntries = data.reduce((sum, item) => sum + item.count, 0);
	const hasBreakdownData = hasSeriesData(data, ["count"]);
	const chartConfig: ChartConfig = { count: { label: "Entries" } };
	for (const [index, item] of data.entries()) {
		chartConfig[item.type] = {
			label: formatStockEntryType(item.type),
			color: getChartColor(index),
		};
	}

	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[18rem]", className)}>
			<CardHeader>
				<CardTitle>Stock Entry Breakdown</CardTitle>
				<CardDescription>
					{totalEntries} total entries across {data.length} types
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 items-center justify-center px-4 pb-0 pt-0 sm:px-6">
				{data.length > 0 && hasBreakdownData ? (
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
								data={data.map((item, index) => ({
									name: formatStockEntryType(item.type),
									value: item.count,
									totalQty: item.totalQty,
									fill: getChartColor(index),
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
														{totalEntries}
													</tspan>
													<tspan
														x={viewBox.cx}
														y={(viewBox.cy ?? 0) + 20}
														className="fill-muted-foreground text-[11px]"
													>
														Entries
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
						title="No submitted stock entries yet"
						description="Entry type mix will appear here once committed stock entries begin flowing through the ledger."
					/>
				)}
			</CardContent>
			{data.length > 0 ? (
				<CardFooter className="mt-auto flex flex-wrap gap-3 pt-0">
					{data.map((item, index) => (
						<div key={item.type} className="flex items-center gap-1.5 text-xs">
							<span
								className="inline-block size-2.5 rounded-full"
								style={{ backgroundColor: getChartColor(index) }}
							/>
							<span className="text-muted-foreground">
								{formatStockEntryType(item.type)} ({item.count})
							</span>
						</div>
					))}
				</CardFooter>
			) : null}
		</Card>
	);
}

// ── Top Moving Items Bar Chart ────────────────────────────────────────

const topMovingConfig = {
	totalQty: {
		label: "Total Qty Moved",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;

function TopMovingItemsChart({
	className,
	data,
}: {
	className?: string;
	data: Inventory.DashboardTopMovingItem[];
}) {
	const hasMovingData = hasSeriesData(data, ["totalQty"]);

	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[18rem]", className)}>
			<CardHeader>
				<CardTitle>Top Moving Items</CardTitle>
				<CardDescription>
					Highest-volume items in the last 30 days by quantity
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 px-2 pb-2 pt-4 sm:px-6 sm:pt-6">
				{hasMovingData ? (
					<ChartContainer
						config={topMovingConfig}
						className="aspect-auto h-full min-h-[15rem] w-full min-w-0"
					>
						<BarChart
							data={data}
							margin={{ top: 8, right: 8, bottom: 12, left: 0 }}
						>
							<defs>
								<linearGradient id="dashTopMoving" x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="5%"
										stopColor="var(--color-totalQty)"
										stopOpacity={0.95}
									/>
									<stop
										offset="95%"
										stopColor="var(--color-totalQty)"
										stopOpacity={0.55}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="itemCode"
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
								tickFormatter={(value) => formatQuantity(value)}
								width="auto"
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(label) =>
											typeof label === "string" ? label : "Item"
										}
										formatter={(value) => formatQuantity(Number(value ?? 0))}
									/>
								}
							/>
							<Bar
								dataKey="totalQty"
								fill="url(#dashTopMoving)"
								radius={[6, 6, 0, 0]}
							/>
						</BarChart>
					</ChartContainer>
				) : (
					<CartesianChartEmptyState
						title="No fast movers yet"
						description="This view highlights the most active items once committed movement begins over the selected period."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<div className="text-muted-foreground text-sm">
					{data.length} items shown ·{" "}
					{data.reduce((sum, item) => sum + item.transactionCount, 0)} total
					transactions
				</div>
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
	data: Inventory.DashboardRecentActivity[];
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[28rem]", className)}>
			<CardHeader>
				<CardTitle>Recent Stock Activity</CardTitle>
				<CardDescription>Latest stock entry transactions</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col gap-4">
						{data.map((entry) => (
							<div key={entry.id} className="flex items-start gap-3">
								<div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
									{entry.type === "MATERIAL_RECEIPT" ? (
										<IconArrowDown className="text-chart-2 size-4" />
									) : entry.type === "MATERIAL_ISSUE" ? (
										<IconArrowUp className="text-chart-1 size-4" />
									) : (
										<IconBox className="text-chart-3 size-4" />
									)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center justify-between gap-2">
										<p className="truncate text-sm font-medium">
											{entry.itemCode}
										</p>
										<span className="text-muted-foreground shrink-0 text-xs">
											{formatRelativeDate(entry.postingDate)}
										</span>
									</div>
									<p className="text-muted-foreground truncate text-xs">
										{formatStockEntryType(entry.type)} · {entry.series}
										{entry.warehouse ? ` · ${entry.warehouse}` : ""}
									</p>
									<Badge variant="outline" className="mt-1 text-xs">
										{entry.qty > 0 ? "+" : ""}
										{formatQuantity(entry.qty)} units
									</Badge>
								</div>
							</div>
						))}
					</div>
				) : (
					<CenteredCardState
						icon={IconBox}
						title="No recent stock activity"
						description="Submitted stock entries will appear here as soon as inventory operations are posted."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/inventory/stock-transaction/stock-entry">
					View all stock entries →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}

// ── Low Stock Alerts ──────────────────────────────────────────────────

function LowStockAlerts({
	className,
	data,
}: {
	className?: string;
	data: Inventory.DashboardLowStockItem[];
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[18rem]", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconAlertTriangle className="text-destructive size-4" />
					Low Stock Alerts
				</CardTitle>
				<CardDescription>
					{data.length} item{data.length === 1 ? "" : "s"} below safety stock
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col gap-3">
						{data.slice(0, 6).map((item) => (
							<div
								key={item.itemCode}
								className="flex items-center justify-between gap-3"
							>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">
										{item.itemCode}
									</p>
									<p className="text-muted-foreground truncate text-xs">
										{item.itemName}
									</p>
								</div>
								<div className="text-right">
									<p className="text-sm tabular-nums">
										{formatQuantity(item.currentQty)}{" "}
										<span className="text-muted-foreground">
											/ {formatQuantity(item.safetyStock)}
										</span>
									</p>
									<p className="text-destructive text-xs font-medium tabular-nums">
										−{formatQuantity(item.deficit)} deficit
									</p>
								</div>
							</div>
						))}
					</div>
				) : (
					<CenteredCardState
						icon={IconPackage}
						title="All items are above safety stock"
						description="This panel will surface the most urgent shortages once committed balances drop below reorder thresholds."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/inventory/stock-reports/stock-summary">
					View stock summary →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}

// ── Batch Expiry Tracker ──────────────────────────────────────────────

function BatchExpiryTracker({
	className,
	data,
}: {
	className?: string;
	data: Inventory.DashboardBatchExpiry[];
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[17rem]", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconClock className="text-amber-500 size-4" />
					Batch Expiry Tracker
				</CardTitle>
				<CardDescription>
					{data.length} batch{data.length === 1 ? "" : "es"} expiring within 90
					days
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col justify-center gap-3">
						{data.slice(0, 6).map((batch) => {
							const urgency = getExpiryUrgency(batch.daysUntilExpiry);

							return (
								<div
									key={batch.batchId}
									className="flex items-center justify-between gap-3"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">
											{batch.batchId}
										</p>
										<p className="text-muted-foreground truncate text-xs">
											{batch.itemCode} · {formatQuantity(batch.quantity)} units
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
											{batch.daysUntilExpiry <= 0
												? "Expired"
												: `${batch.daysUntilExpiry}d left`}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<CenteredCardState
						icon={IconClock}
						title="No batches expiring soon"
						description="Upcoming batch expiries within the next 90 days will appear here for proactive action."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/inventory/serial-no-and-batch/batch">
					View all batches →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}

// ── Delivery Status Card ──────────────────────────────────────────────

function DeliveryStatusCard({
	className,
	data,
}: {
	className?: string;
	data: Inventory.DashboardDeliveryStatus[];
}) {
	const totalDeliveries = data.reduce((sum, item) => sum + item.count, 0);
	const totalAmount = data.reduce((sum, item) => sum + item.totalAmount, 0);

	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[17rem]", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconTruckDelivery className="size-4" />
					Delivery Status
				</CardTitle>
				<CardDescription>
					{totalDeliveries} delivery notes ·{" "}
					{formatCompactCurrency(totalAmount)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col justify-center gap-4">
						{data.map((item) => {
							const percent =
								totalDeliveries > 0
									? Math.round((item.count / totalDeliveries) * 100)
									: 0;

							return (
								<div key={item.status}>
									<div className="mb-1 flex items-center justify-between">
										<span className="text-sm font-medium">
											{formatDeliveryStatus(item.status)}
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
												backgroundColor: getDeliveryStatusColor(item.status),
											}}
										/>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<CenteredCardState
						icon={IconTruckDelivery}
						title="No delivery notes yet"
						description="Status progression appears here once delivery notes begin moving through the fulfilment flow."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/inventory/stock-transaction/delivery-note">
					View delivery notes →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}
