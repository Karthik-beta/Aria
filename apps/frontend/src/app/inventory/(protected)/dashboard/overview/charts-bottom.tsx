"use client";

import type { Inventory } from "@aria/types";
import {
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
	CARD_SURFACE_CLASS,
	CartesianChartEmptyState,
	ChartLoadErrorCard,
	ChartTileSkeleton,
	DonutChartEmptyState,
	hasSeriesData,
	truncateLabel,
} from "./charts-shared";
import {
	formatCompactCurrency,
	formatCurrency,
	formatQuantity,
	formatStockEntryType,
	getChartColor,
} from "./dashboard.utils";

export function InventoryOverviewBottomCharts({
	itemGroupDistribution,
	data,
	hasError = false,
	isLoading = false,
	onRetry,
}: {
	itemGroupDistribution: Inventory.DashboardItemGroupDistribution[];
	data?: Inventory.DashboardBottomChartsData;
	hasError?: boolean;
	isLoading?: boolean;
	onRetry?: () => void;
}) {
	return (
		<>
			<ItemGroupDistributionChart
				className="lg:col-span-4"
				data={itemGroupDistribution}
			/>
			{data ? (
				<>
					<TopMovingItemsChart
						className="lg:col-span-8"
						data={data.topMovingItems}
					/>
					<StockEntryBreakdownChart
						className="lg:col-span-4"
						data={data.stockEntryTypeBreakdown}
					/>
				</>
			) : hasError ? (
				<>
					<ChartLoadErrorCard
						className="lg:col-span-8"
						title="Top movers unavailable"
						description="We couldn't load the latest top-moving items right now."
						onRetry={onRetry}
					/>
					<ChartLoadErrorCard
						className="lg:col-span-4"
						title="Entry breakdown unavailable"
						description="We couldn't load the stock entry breakdown right now."
						onRetry={onRetry}
					/>
				</>
			) : isLoading ? (
				<>
					<ChartTileSkeleton className="lg:col-span-8" />
					<ChartTileSkeleton className="lg:col-span-4" />
				</>
			) : null}
		</>
	);
}

export function ItemGroupDistributionChart({
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

export function TopMovingItemsChart({
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
						config={{
							totalQty: { label: "Total Qty Moved", color: "var(--chart-3)" },
						}}
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

export function StockEntryBreakdownChart({
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
