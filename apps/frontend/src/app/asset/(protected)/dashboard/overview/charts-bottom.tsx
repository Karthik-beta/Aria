"use client";

import type { Asset } from "@aria/types";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { formatCompactCurrency, formatCurrency } from "./dashboard.utils";

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

const locationChartConfig = {
	totalValue: {
		label: "Total Value",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;

export function AssetOverviewBottomCharts({
	data,
	hasError = false,
	isLoading = false,
	onRetry,
}: {
	data?: Asset.AssetDashboardBottomChartsData;
	hasError?: boolean;
	isLoading?: boolean;
	onRetry?: () => void;
}) {
	if (!data) {
		if (hasError) {
			return (
				<>
					<ChartLoadErrorCard
						className="lg:col-span-4"
						title="Category chart unavailable"
						description="We couldn't load the latest value-by-category chart right now."
						onRetry={onRetry}
					/>
					<ChartLoadErrorCard
						className="lg:col-span-8"
						title="Location chart unavailable"
						description="We couldn't load the latest location distribution right now."
						onRetry={onRetry}
					/>
				</>
			);
		}

		if (isLoading) {
			return (
				<>
					<ChartTileSkeleton className="lg:col-span-4" />
					<ChartTileSkeleton className="lg:col-span-8" />
				</>
			);
		}
	}

	return (
		<>
			<CategoryValueChart
				className="lg:col-span-4"
				data={data?.categoryValues ?? []}
			/>
			<LocationDistributionChart
				className="lg:col-span-8"
				data={data?.locationDistribution ?? []}
			/>
		</>
	);
}

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
