"use client";

import { IconTrendingUp } from "@tabler/icons-react";
import * as React from "react";
import { Label, Pie, PieChart } from "recharts";

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
	{ category: "machinery", value: 8500000, fill: "var(--primary)" },
	{ category: "vehicles", value: 6200000, fill: "var(--primary-light)" },
	{ category: "it", value: 4800000, fill: "var(--primary-lighter)" },
	{ category: "furniture", value: 2900000, fill: "var(--primary-dark)" },
	{ category: "others", value: 1653000, fill: "var(--primary-darker)" },
];

const chartConfig = {
	value: {
		label: "Asset Value",
	},
	machinery: {
		label: "Machinery",
		color: "var(--primary)",
	},
	vehicles: {
		label: "Vehicles",
		color: "var(--primary)",
	},
	it: {
		label: "IT Equipment",
		color: "var(--primary)",
	},
	furniture: {
		label: "Furniture",
		color: "var(--primary)",
	},
	others: {
		label: "Others",
		color: "var(--primary)",
	},
} satisfies ChartConfig;

export function AssetCategoryChart() {
	const totalValue = React.useMemo(() => {
		return chartData.reduce((acc, curr) => acc + curr.value, 0);
	}, []);

	return (
		<Card className="@container/card">
			<CardHeader>
				<CardTitle>Pie Chart - Asset Categories</CardTitle>
				<CardDescription>
					<span className="hidden @[540px]/card:block">
						Total asset value by category for the last 6 months
					</span>
					<span className="@[540px]/card:hidden">Category distribution</span>
				</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={chartConfig}
					className="mx-auto aspect-square h-[250px]"
				>
					<PieChart>
						<defs>
							{["machinery", "vehicles", "it", "furniture", "others"].map(
								(category, index) => (
									<linearGradient
										key={category}
										id={`fill${category}`}
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="0%"
											stopColor="var(--primary)"
											stopOpacity={1 - index * 0.15}
										/>
										<stop
											offset="100%"
											stopColor="var(--primary)"
											stopOpacity={0.8 - index * 0.15}
										/>
									</linearGradient>
								),
							)}
						</defs>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent hideLabel />}
						/>
						<Pie
							data={chartData.map((item) => ({
								...item,
								fill: `url(#fill${item.category})`,
							}))}
							dataKey="value"
							nameKey="category"
							innerRadius={60}
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
													className="fill-foreground text-3xl font-bold"
												>
													₹{(totalValue / 10000000).toFixed(1)}Cr
												</tspan>
												<tspan
													x={viewBox.cx}
													y={(viewBox.cy || 0) + 24}
													className="fill-muted-foreground text-sm"
												>
													Total Assets
												</tspan>
											</text>
										);
									}
								}}
							/>
						</Pie>
					</PieChart>
				</ChartContainer>
			</CardContent>
			<CardFooter className="flex-col gap-2 text-sm">
				<div className="flex items-center gap-2 leading-none font-medium">
					Machinery assets at{" "}
					{((chartData[0].value / totalValue) * 100).toFixed(1)}% of portfolio{" "}
					<IconTrendingUp className="h-4 w-4" />
				</div>
				<div className="text-muted-foreground leading-none">
					Based on data from January - June 2024
				</div>
			</CardFooter>
		</Card>
	);
}
