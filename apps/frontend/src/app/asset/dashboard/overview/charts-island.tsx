"use client";

import type { Asset } from "@aria/types";
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
	formatAssetStatus,
	formatCompactCurrency,
	formatCurrency,
	formatMonth,
	getAssetStatusColor,
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

const depreciationChartConfig = {
	amount: {
		label: "Depreciation",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

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

export function AssetOverviewCharts({
	data,
}: {
	data: Asset.AssetDashboardData;
}) {
	return (
		<>
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
	const chartConfig: ChartConfig = { count: { label: "Assets" } };
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
