"use client";

import type { Inventory } from "@aria/types";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	XAxis,
	YAxis,
} from "recharts";
import {
	Card,
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
import { cn } from "@/lib/utils";
import {
	CARD_SURFACE_CLASS,
	CartesianChartEmptyState,
	ChartLoadErrorCard,
	ChartTileSkeleton,
	hasSeriesData,
	truncateLabel,
} from "./charts-shared";
import { formatQuantity, formatShortDate } from "./dashboard.utils";

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

const warehouseChartConfig = {
	totalQty: {
		label: "Stock Quantity",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

export function InventoryOverviewTopCharts({
	data,
	hasError = false,
	isLoading = false,
	onRetry,
}: {
	data?: Inventory.DashboardTopChartsData;
	hasError?: boolean;
	isLoading?: boolean;
	onRetry?: () => void;
}) {
	if (!data) {
		if (hasError) {
			return (
				<>
					<ChartLoadErrorCard
						className="lg:col-span-8"
						title="Stock movement chart unavailable"
						description="We couldn't load the latest movement trends right now."
						onRetry={onRetry}
					/>
					<ChartLoadErrorCard
						className="lg:col-span-4"
						title="Warehouse chart unavailable"
						description="We couldn't load the current warehouse distribution right now."
						onRetry={onRetry}
					/>
				</>
			);
		}

		if (isLoading) {
			return (
				<>
					<ChartTileSkeleton className="lg:col-span-8" />
					<ChartTileSkeleton className="lg:col-span-4" />
				</>
			);
		}
	}

	return (
		<>
			<StockMovementChart
				className="lg:col-span-8"
				data={data?.stockMovements ?? []}
			/>
			<WarehouseStockChart
				className="lg:col-span-4"
				data={data?.warehouseStock ?? []}
			/>
		</>
	);
}

function StockMovementChart({
	className,
	data,
}: {
	className?: string;
	data: Inventory.DashboardStockMovement[];
}) {
	const hasMovementData = hasSeriesData(data, ["inbound", "outbound"]);

	return (
		<Card className={cn(CARD_SURFACE_CLASS, className)}>
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
						className="aspect-auto h-full w-full min-w-0"
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
