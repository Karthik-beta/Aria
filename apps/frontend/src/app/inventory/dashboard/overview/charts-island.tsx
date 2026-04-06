"use client";

import type { Inventory } from "@aria/types";
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
	formatCompactCurrency,
	formatCurrency,
	formatQuantity,
	formatShortDate,
	formatStockEntryType,
	getChartColor,
} from "./dashboard.utils";

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

const topMovingConfig = {
	totalQty: {
		label: "Total Qty Moved",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;

export function InventoryOverviewCharts({
	data,
}: {
	data: Inventory.DashboardData;
}) {
	return (
		<>
			<StockMovementChart
				className="lg:col-span-8"
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
			<StockEntryBreakdownChart
				className="lg:col-span-4"
				data={data.stockEntryTypeBreakdown}
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
