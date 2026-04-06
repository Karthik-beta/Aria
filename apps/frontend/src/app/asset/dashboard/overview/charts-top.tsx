"use client";

import type { Asset } from "@aria/types";
import {
	Area,
	AreaChart,
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
} from "./charts-shared";
import {
	formatAssetStatus,
	formatCompactCurrency,
	formatCurrency,
	formatMonth,
	getAssetStatusColor,
} from "./dashboard.utils";

const depreciationChartConfig = {
	amount: {
		label: "Depreciation",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

const statusChartConfig = {
	count: {
		label: "Assets",
	},
} satisfies ChartConfig;

export function AssetOverviewTopCharts({
	data,
	hasError = false,
	isLoading = false,
	onRetry,
}: {
	data?: Asset.AssetDashboardTopChartsData;
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
						title="Depreciation trend unavailable"
						description="We couldn't load the latest depreciation trend right now."
						onRetry={onRetry}
					/>
					<ChartLoadErrorCard
						className="lg:col-span-4"
						title="Status chart unavailable"
						description="We couldn't load the latest asset status breakdown right now."
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
			<DepreciationTrendChart
				className="lg:col-span-8"
				data={data?.depreciationTrend ?? []}
			/>
			<StatusDistributionChart
				className="lg:col-span-4"
				data={data?.statusDistribution ?? []}
			/>
		</>
	);
}

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

function StatusDistributionChart({
	className,
	data,
}: {
	className?: string;
	data: Asset.AssetDashboardStatusDistribution[];
}) {
	const totalAssets = data.reduce((sum, item) => sum + item.count, 0);
	const hasStatusData = hasSeriesData(data, ["count"]);
	const chartConfig: ChartConfig = { ...statusChartConfig };
	for (const item of data) {
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
