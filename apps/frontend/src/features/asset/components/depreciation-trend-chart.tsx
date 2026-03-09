"use client";

import { IconTrendingDown } from "@tabler/icons-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

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

const chartData = [
	{ month: "January", assetValue: 24500000, depreciation: 92000 },
	{ month: "February", assetValue: 24408000, depreciation: 89000 },
	{ month: "March", assetValue: 24319000, depreciation: 91000 },
	{ month: "April", assetValue: 24228000, depreciation: 88000 },
	{ month: "May", assetValue: 24140000, depreciation: 87000 },
	{ month: "June", assetValue: 24053000, depreciation: 86000 },
];

const chartConfig = {
	visitors: {
		label: "Value",
	},
	assetValue: {
		label: "Asset Value",
		color: "var(--primary)",
	},
	depreciation: {
		label: "Depreciation",
		color: "var(--primary)",
	},
} satisfies ChartConfig;

export function DepreciationTrendChart() {
	return (
		<Card className="@container/card">
			<CardHeader>
				<CardTitle>Area Chart - Depreciation Trends</CardTitle>
				<CardDescription>
					Showing asset value & depreciation for the last 6 months
				</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-[250px] w-full"
				>
					<AreaChart
						data={chartData}
						margin={{
							left: 12,
							right: 12,
						}}
					>
						<defs>
							<linearGradient id="fillAssetValue" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-assetValue)"
									stopOpacity={1.0}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-assetValue)"
									stopOpacity={0.1}
								/>
							</linearGradient>
							<linearGradient id="fillDepreciation" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-depreciation)"
									stopOpacity={0.8}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-depreciation)"
									stopOpacity={0.1}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="month"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={32}
							tickFormatter={(value) => value.slice(0, 3)}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="dot" />}
						/>
						<Area
							dataKey="depreciation"
							type="natural"
							fill="url(#fillDepreciation)"
							stroke="var(--color-depreciation)"
							stackId="a"
						/>
						<Area
							dataKey="assetValue"
							type="natural"
							fill="url(#fillAssetValue)"
							stroke="var(--color-assetValue)"
							stackId="a"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
			<CardFooter>
				<div className="flex w-full items-start gap-2 text-sm">
					<div className="grid gap-2">
						<div className="flex items-center gap-2 leading-none font-medium">
							Steady depreciation at 3.8% annually{" "}
							<IconTrendingDown className="h-4 w-4" />
						</div>
						<div className="text-muted-foreground flex items-center gap-2 leading-none">
							January - June 2024
						</div>
					</div>
				</div>
			</CardFooter>
		</Card>
	);
}
