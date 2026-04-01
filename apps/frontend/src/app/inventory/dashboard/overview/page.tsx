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
import * as React from "react";
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

// ── Skeleton Components ───────────────────────────────────────────────

function KpiSkeleton() {
	return (
		<Card className="@container/card">
			<CardHeader>
				<Skeleton className="h-4 w-24" />
				<Skeleton className="mt-2 h-8 w-32" />
			</CardHeader>
			<CardFooter>
				<Skeleton className="h-4 w-48" />
			</CardFooter>
		</Card>
	);
}

function ChartSkeleton({ height = "h-[300px]" }: { height?: string }) {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-48" />
				<Skeleton className="mt-1 h-4 w-64" />
			</CardHeader>
			<CardContent>
				<Skeleton className={cn("w-full rounded-md", height)} />
			</CardContent>
		</Card>
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

	const handleRealtimeEvent = React.useCallback(() => {
		void utils.inventory.getDashboardData.invalidate();
	}, [utils]);

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

			<div className="flex flex-1 flex-col gap-4">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
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

				{/* KPI Cards */}
				{isLoading ? (
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
						{(
							[
								"total-value",
								"active-items",
								"low-stock",
								"pending-mr",
							] as const
						).map((id) => (
							<KpiSkeleton key={id} />
						))}
					</div>
				) : data ? (
					<KpiCards kpis={data.kpis} />
				) : null}

				{/* Row 1: Stock Movement + Warehouse Distribution */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
					<div className="lg:col-span-4">
						{isLoading ? (
							<ChartSkeleton />
						) : data ? (
							<StockMovementChart data={data.stockMovements} />
						) : null}
					</div>
					<div className="lg:col-span-3">
						{isLoading ? (
							<ChartSkeleton />
						) : data ? (
							<WarehouseStockChart data={data.warehouseStock} />
						) : null}
					</div>
				</div>

				{/* Row 2: Item Group Distribution + Stock Entry Breakdown */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{isLoading ? (
						<>
							<ChartSkeleton />
							<ChartSkeleton />
						</>
					) : data ? (
						<>
							<ItemGroupDistributionChart data={data.itemGroupDistribution} />
							<StockEntryBreakdownChart data={data.stockEntryTypeBreakdown} />
						</>
					) : null}
				</div>

				{/* Row 3: Top Moving Items + Recent Activity */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
					<div className="lg:col-span-4">
						{isLoading ? (
							<ChartSkeleton />
						) : data ? (
							<TopMovingItemsChart data={data.topMovingItems} />
						) : null}
					</div>
					<div className="lg:col-span-3">
						{isLoading ? (
							<ChartSkeleton height="h-[380px]" />
						) : data ? (
							<RecentActivityFeed data={data.recentActivity} />
						) : null}
					</div>
				</div>

				{/* Row 4: Low Stock Alerts + Batch Expiry + Delivery Status */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
					{isLoading ? (
						<>
							<ChartSkeleton height="h-[280px]" />
							<ChartSkeleton height="h-[280px]" />
							<ChartSkeleton height="h-[280px]" />
						</>
					) : data ? (
						<>
							<LowStockAlerts data={data.lowStockItems} />
							<BatchExpiryTracker data={data.batchExpiry} />
							<DeliveryStatusCard data={data.deliveryStatus} />
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
		<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4">
			<Card className="@container/card">
				<CardHeader>
					<CardDescription>Total Stock Value</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{formatCompactCurrency(kpis.totalStockValue)}
					</CardTitle>
					<CardAction>
						<Badge variant="outline" className="text-xs">
							<IconPackage className="size-3" />
							{formatQuantity(kpis.totalStockQuantity)} units
						</Badge>
					</CardAction>
				</CardHeader>
				<CardFooter className="flex-col items-start gap-1 text-sm">
					<div className="text-muted-foreground">
						Across {kpis.totalItems} active items
					</div>
				</CardFooter>
			</Card>

			<Card className="@container/card">
				<CardHeader>
					<CardDescription>Active Items</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{formatQuantity(kpis.totalItems)}
					</CardTitle>
					<CardAction>
						<Badge variant="outline" className="text-xs">
							<IconBuildingWarehouse className="size-3" />
							{kpis.activeWarehouses} warehouses
						</Badge>
					</CardAction>
				</CardHeader>
				<CardFooter className="flex-col items-start gap-1 text-sm">
					<div className="text-muted-foreground">
						Stock tracked across all locations
					</div>
				</CardFooter>
			</Card>

			<Card className="@container/card">
				<CardHeader>
					<CardDescription>Low Stock Alerts</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{kpis.lowStockItemCount}
					</CardTitle>
					<CardAction>
						{kpis.lowStockItemCount > 0 ? (
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
						)}
					</CardAction>
				</CardHeader>
				<CardFooter className="flex-col items-start gap-1 text-sm">
					<div className="text-muted-foreground">
						Items below safety stock level
					</div>
				</CardFooter>
			</Card>

			<Card className="@container/card">
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
				<CardFooter className="flex-col items-start gap-1 text-sm">
					<Link
						href="/inventory/stock-transaction/material-request"
						className="text-muted-foreground hover:text-foreground transition-colors"
					>
						View all requests →
					</Link>
				</CardFooter>
			</Card>
		</div>
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
	data,
}: {
	data: Inventory.DashboardStockMovement[];
}) {
	if (data.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Stock Movements</CardTitle>
					<CardDescription>Last 30 days</CardDescription>
				</CardHeader>
				<CardContent className="flex h-[300px] items-center justify-center">
					<p className="text-muted-foreground text-sm">
						No stock movement data available
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Stock Movements</CardTitle>
				<CardDescription>
					Inbound vs outbound quantity over the last 30 days
				</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={movementChartConfig}
					className="aspect-auto h-[300px] w-full min-w-0 min-h-[300px]"
				>
					<AreaChart data={data} margin={{ left: 12, right: 12 }}>
						<defs>
							<linearGradient id="dashFillInbound" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-inbound)"
									stopOpacity={0.8}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-inbound)"
									stopOpacity={0.05}
								/>
							</linearGradient>
							<linearGradient id="dashFillOutbound" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-outbound)"
									stopOpacity={0.8}
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
							minTickGap={32}
							tickFormatter={formatShortDate}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							tickFormatter={(v) => formatQuantity(v)}
							width={50}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="dot" />}
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
			</CardContent>
			<CardFooter className="text-muted-foreground text-sm">
				Tracking all stock entries, purchase receipts, and delivery notes
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
	data,
}: {
	data: Inventory.DashboardWarehouseStock[];
}) {
	if (data.length === 0) {
		return (
			<Card className="h-full">
				<CardHeader>
					<CardTitle>Warehouse Distribution</CardTitle>
					<CardDescription>Stock by location</CardDescription>
				</CardHeader>
				<CardContent className="flex h-[300px] items-center justify-center">
					<p className="text-muted-foreground text-sm">No warehouse data</p>
				</CardContent>
			</Card>
		);
	}

	const chartData = data.map((d) => ({
		...d,
		warehouse:
			d.warehouse.length > 20 ? `${d.warehouse.slice(0, 18)}…` : d.warehouse,
		fullName: d.warehouse,
	}));

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Warehouse Distribution</CardTitle>
				<CardDescription>
					Stock quantity across {data.length} warehouse
					{data.length > 1 ? "s" : ""}
				</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={warehouseChartConfig}
					className="aspect-auto h-[300px] w-full min-w-0 min-h-[300px]"
				>
					<BarChart
						data={chartData}
						layout="vertical"
						margin={{ left: 8, right: 12 }}
					>
						<CartesianGrid horizontal={false} />
						<YAxis
							dataKey="warehouse"
							type="category"
							tickLine={false}
							axisLine={false}
							width={140}
							tick={{ fontSize: 12 }}
						/>
						<XAxis
							type="number"
							tickLine={false}
							axisLine={false}
							tickFormatter={(v) => formatQuantity(v)}
						/>
						<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
						<Bar
							dataKey="totalQty"
							fill="var(--color-totalQty)"
							radius={[0, 4, 4, 0]}
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

// ── Item Group Distribution Donut ─────────────────────────────────────

function ItemGroupDistributionChart({
	data,
}: {
	data: Inventory.DashboardItemGroupDistribution[];
}) {
	const totalValue = React.useMemo(
		() => data.reduce((sum, d) => sum + d.value, 0),
		[data],
	);

	const chartConfig = React.useMemo(() => {
		const config: ChartConfig = { value: { label: "Stock Value" } };
		for (const [i, d] of data.entries()) {
			config[d.group] = { label: d.group, color: getChartColor(i) };
		}
		return config;
	}, [data]);

	if (data.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Stock Value by Category</CardTitle>
					<CardDescription>Item group distribution</CardDescription>
				</CardHeader>
				<CardContent className="flex h-[300px] items-center justify-center">
					<p className="text-muted-foreground text-sm">No category data</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Stock Value by Category</CardTitle>
				<CardDescription>
					{formatCompactCurrency(totalValue)} across {data.length} categories
				</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={chartConfig}
					className="mx-auto aspect-square h-[300px] w-full min-w-0 min-h-[300px]"
				>
					<PieChart>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									hideLabel
									formatter={(value) => formatCurrency(value as number)}
								/>
							}
						/>
						<Pie
							data={data.map((d, i) => ({
								...d,
								name: d.group,
								fill: getChartColor(i),
							}))}
							dataKey="value"
							nameKey="group"
							innerRadius={70}
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
													className="fill-foreground text-2xl font-bold"
												>
													{formatCompactCurrency(totalValue)}
												</tspan>
												<tspan
													x={viewBox.cx}
													y={(viewBox.cy ?? 0) + 22}
													className="fill-muted-foreground text-xs"
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
			</CardContent>
		</Card>
	);
}

// ── Stock Entry Type Breakdown Pie ────────────────────────────────────

function StockEntryBreakdownChart({
	data,
}: {
	data: Inventory.DashboardStockEntryTypeBreakdown[];
}) {
	const chartConfig = React.useMemo(() => {
		const config: ChartConfig = { count: { label: "Entries" } };
		for (const [i, d] of data.entries()) {
			config[d.type] = {
				label: formatStockEntryType(d.type),
				color: getChartColor(i),
			};
		}
		return config;
	}, [data]);

	const totalEntries = data.reduce((s, d) => s + d.count, 0);

	if (data.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Stock Entry Breakdown</CardTitle>
					<CardDescription>By transaction type</CardDescription>
				</CardHeader>
				<CardContent className="flex h-[300px] items-center justify-center">
					<p className="text-muted-foreground text-sm">No stock entries</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Stock Entry Breakdown</CardTitle>
				<CardDescription>
					{totalEntries} total entries across {data.length} types
				</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={chartConfig}
					className="mx-auto aspect-square h-[300px] w-full min-w-0 min-h-[300px]"
				>
					<PieChart>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent hideLabel />}
						/>
						<Pie
							data={data.map((d, i) => ({
								name: formatStockEntryType(d.type),
								value: d.count,
								totalQty: d.totalQty,
								fill: getChartColor(i),
							}))}
							dataKey="value"
							nameKey="name"
							innerRadius={70}
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
													className="fill-foreground text-2xl font-bold"
												>
													{totalEntries}
												</tspan>
												<tspan
													x={viewBox.cx}
													y={(viewBox.cy ?? 0) + 22}
													className="fill-muted-foreground text-xs"
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
			</CardContent>
			<CardFooter>
				<div className="flex flex-wrap gap-3 text-xs">
					{data.map((d, i) => (
						<div key={d.type} className="flex items-center gap-1.5">
							<span
								className="inline-block size-2.5 rounded-full"
								style={{ backgroundColor: getChartColor(i) }}
							/>
							<span className="text-muted-foreground">
								{formatStockEntryType(d.type)} ({d.count})
							</span>
						</div>
					))}
				</div>
			</CardFooter>
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
	data,
}: {
	data: Inventory.DashboardTopMovingItem[];
}) {
	if (data.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Top Moving Items</CardTitle>
					<CardDescription>Last 30 days</CardDescription>
				</CardHeader>
				<CardContent className="flex h-[300px] items-center justify-center">
					<p className="text-muted-foreground text-sm">No movement data</p>
				</CardContent>
			</Card>
		);
	}

	const chartData = data.map((d) => ({
		...d,
		label: d.itemCode.length > 16 ? `${d.itemCode.slice(0, 14)}…` : d.itemCode,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Top Moving Items</CardTitle>
				<CardDescription>
					Highest-volume items in the last 30 days by quantity
				</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={topMovingConfig}
					className="aspect-auto h-[300px] w-full min-w-0 min-h-[300px]"
				>
					<BarChart data={chartData}>
						<defs>
							<linearGradient id="dashTopMoving" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-totalQty)"
									stopOpacity={1}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-totalQty)"
									stopOpacity={0.6}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="label"
							tickLine={false}
							tickMargin={8}
							axisLine={false}
							tick={{ fontSize: 11 }}
							interval={0}
							angle={-35}
							textAnchor="end"
							height={60}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							tickFormatter={(v) => formatQuantity(v)}
							width={50}
						/>
						<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
						<Bar
							dataKey="totalQty"
							fill="url(#dashTopMoving)"
							radius={[4, 4, 0, 0]}
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
			<CardFooter className="text-muted-foreground text-sm">
				{data.length} items shown ·{" "}
				{data.reduce((s, d) => s + d.transactionCount, 0)} total transactions
			</CardFooter>
		</Card>
	);
}

// ── Recent Activity Feed ──────────────────────────────────────────────

function RecentActivityFeed({
	data,
}: {
	data: Inventory.DashboardRecentActivity[];
}) {
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Recent Stock Activity</CardTitle>
				<CardDescription>Latest stock entry transactions</CardDescription>
			</CardHeader>
			<CardContent>
				{data.length === 0 ? (
					<p className="text-muted-foreground py-8 text-center text-sm">
						No recent activity
					</p>
				) : (
					<div className="space-y-4">
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
				)}
			</CardContent>
			<CardFooter>
				<Link
					href="/inventory/stock-transaction/stock-entry"
					className="text-muted-foreground hover:text-foreground text-xs transition-colors"
				>
					View all stock entries →
				</Link>
			</CardFooter>
		</Card>
	);
}

// ── Low Stock Alerts ──────────────────────────────────────────────────

function LowStockAlerts({ data }: { data: Inventory.DashboardLowStockItem[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconAlertTriangle className="text-destructive size-4" />
					Low Stock Alerts
				</CardTitle>
				<CardDescription>
					{data.length} item{data.length !== 1 ? "s" : ""} below safety stock
				</CardDescription>
			</CardHeader>
			<CardContent>
				{data.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8">
						<IconPackage className="text-muted-foreground size-8" />
						<p className="text-muted-foreground text-sm">
							All items above safety stock
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{data.slice(0, 6).map((item) => (
							<div
								key={item.itemCode}
								className="flex items-center justify-between gap-2"
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
				)}
			</CardContent>
			{data.length > 0 && (
				<CardFooter>
					<Link
						href="/inventory/stock-reports/stock-summary"
						className="text-muted-foreground hover:text-foreground text-xs transition-colors"
					>
						View stock summary →
					</Link>
				</CardFooter>
			)}
		</Card>
	);
}

// ── Batch Expiry Tracker ──────────────────────────────────────────────

function BatchExpiryTracker({
	data,
}: {
	data: Inventory.DashboardBatchExpiry[];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconClock className="text-amber-500 size-4" />
					Batch Expiry Tracker
				</CardTitle>
				<CardDescription>
					{data.length} batch{data.length !== 1 ? "es" : ""} expiring within 90
					days
				</CardDescription>
			</CardHeader>
			<CardContent>
				{data.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8">
						<IconClock className="text-muted-foreground size-8" />
						<p className="text-muted-foreground text-sm">
							No batches expiring soon
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{data.slice(0, 6).map((batch) => {
							const urgency = getExpiryUrgency(batch.daysUntilExpiry);
							return (
								<div
									key={batch.batchId}
									className="flex items-center justify-between gap-2"
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
				)}
			</CardContent>
			{data.length > 0 && (
				<CardFooter>
					<Link
						href="/inventory/serial-no-and-batch/batch"
						className="text-muted-foreground hover:text-foreground text-xs transition-colors"
					>
						View all batches →
					</Link>
				</CardFooter>
			)}
		</Card>
	);
}

// ── Delivery Status Card ──────────────────────────────────────────────

function DeliveryStatusCard({
	data,
}: {
	data: Inventory.DashboardDeliveryStatus[];
}) {
	const totalDeliveries = data.reduce((s, d) => s + d.count, 0);
	const totalAmount = data.reduce((s, d) => s + d.totalAmount, 0);

	return (
		<Card>
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
			<CardContent>
				{data.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8">
						<IconTruckDelivery className="text-muted-foreground size-8" />
						<p className="text-muted-foreground text-sm">
							No delivery notes yet
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{data.map((d) => {
							const pct =
								totalDeliveries > 0
									? Math.round((d.count / totalDeliveries) * 100)
									: 0;
							return (
								<div key={d.status}>
									<div className="mb-1 flex items-center justify-between">
										<span className="text-sm font-medium">
											{formatDeliveryStatus(d.status)}
										</span>
										<span className="text-muted-foreground text-xs tabular-nums">
											{d.count} ({pct}%)
										</span>
									</div>
									<div className="bg-muted h-2 overflow-hidden rounded-full">
										<div
											className="h-full rounded-full transition-all"
											style={{
												width: `${pct}%`,
												backgroundColor: getDeliveryStatusColor(d.status),
											}}
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
			{data.length > 0 && (
				<CardFooter>
					<Link
						href="/inventory/stock-transaction/delivery-note"
						className="text-muted-foreground hover:text-foreground text-xs transition-colors"
					>
						View delivery notes →
					</Link>
				</CardFooter>
			)}
		</Card>
	);
}
