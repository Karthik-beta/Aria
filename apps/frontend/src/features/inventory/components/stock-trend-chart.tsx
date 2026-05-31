"use client";

import { IconTrendingUp } from "@tabler/icons-react";
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
	{ month: "January", stockValue: 3200000, turnover: 850000 },
	{ month: "February", stockValue: 3420000, turnover: 920000 },
	{ month: "March", stockValue: 3650000, turnover: 980000 },
	{ month: "April", stockValue: 3880000, turnover: 1050000 },
	{ month: "May", stockValue: 4250000, turnover: 1180000 },
	{ month: "June", stockValue: 4567000, turnover: 1240000 },
];

const chartConfig = {
	visitors: {
		label: "Value",
	},
	stockValue: {
		label: "Stock Value",
		color: "var(--primary)",
	},
	turnover: {
		label: "Turnover",
		color: "var(--primary)",
	},
} satisfies ChartConfig;

export function StockTrendChart() {
	return (
		<Card className="@container/card">
			<CardHeader>
				<CardTitle>Area Chart - Stock Value Trends</CardTitle>
				<CardDescription>
					Showing stock value & turnover for the last 6 months
				</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-[250px] w-full min-w-0 min-h-[250px]"
				>
					<AreaChart
						data={chartData}
						margin={{
							left: 12,
							right: 12,
						}}
					>
						<defs>
							<linearGradient id="fillStockValue" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-stockValue)"
									stopOpacity={1.0}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-stockValue)"
									stopOpacity={0.1}
								/>
							</linearGradient>
							<linearGradient id="fillTurnover" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-turnover)"
									stopOpacity={0.8}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-turnover)"
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
							dataKey="turnover"
							type="natural"
							fill="url(#fillTurnover)"
							stroke="var(--color-turnover)"
							stackId="a"
						/>
						<Area
							dataKey="stockValue"
							type="natural"
							fill="url(#fillStockValue)"
							stroke="var(--color-stockValue)"
							stackId="a"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
			<CardFooter>
				<div className="flex w-full items-start gap-2 text-sm">
					<div className="grid gap-2">
						<div className="flex items-center gap-2 leading-none font-medium">
							Stock value up by 14.8% over 6 months{" "}
							<IconTrendingUp className="h-4 w-4" />
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
