"use client";

import { IconTrendingUp } from "@tabler/icons-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

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
	{ category: "Electronics", current: 450, reorder: 200 },
	{ category: "Furniture", current: 180, reorder: 100 },
	{ category: "Supplies", current: 320, reorder: 150 },
	{ category: "Hardware", current: 280, reorder: 120 },
	{ category: "Software", current: 95, reorder: 80 },
	{ category: "Accessories", current: 410, reorder: 180 },
];

const chartConfig = {
	current: {
		label: "Current Stock",
		color: "var(--primary)",
	},
	reorder: {
		label: "Reorder Level",
		color: "var(--primary)",
	},
} satisfies ChartConfig;

export function StockLevelChart() {
	return (
		<Card className="@container/card">
			<CardHeader>
				<CardTitle>Bar Chart - Stock Levels</CardTitle>
				<CardDescription>
					<span className="hidden @[540px]/card:block">
						Current stock vs. reorder points for the last 6 categories
					</span>
					<span className="@[540px]/card:hidden">Stock levels by category</span>
				</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-[250px] w-full"
				>
					<BarChart data={chartData}>
						<defs>
							<linearGradient id="fillCurrent" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--primary)"
									stopOpacity={1.0}
								/>
								<stop
									offset="95%"
									stopColor="var(--primary)"
									stopOpacity={0.8}
								/>
							</linearGradient>
							<linearGradient id="fillReorder" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--primary)"
									stopOpacity={0.6}
								/>
								<stop
									offset="95%"
									stopColor="var(--primary)"
									stopOpacity={0.4}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="category"
							tickLine={false}
							tickMargin={10}
							axisLine={false}
							tickFormatter={(value) => value.slice(0, 10)}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="dashed" />}
						/>
						<Bar dataKey="current" fill="url(#fillCurrent)" radius={4} />
						<Bar dataKey="reorder" fill="url(#fillReorder)" radius={4} />
					</BarChart>
				</ChartContainer>
			</CardContent>
			<CardFooter className="flex-col items-start gap-2 text-sm">
				<div className="flex gap-2 font-medium leading-none">
					Stock levels healthy across categories{" "}
					<IconTrendingUp className="h-4 w-4" />
				</div>
				<div className="text-muted-foreground leading-none">
					Showing current stock vs reorder points for 6 categories
				</div>
			</CardFooter>
		</Card>
	);
}
