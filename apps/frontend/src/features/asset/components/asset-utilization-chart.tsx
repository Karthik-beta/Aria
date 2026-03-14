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
	{ asset: "Machinery", utilization: 87, target: 90 },
	{ asset: "Vehicles", utilization: 76, target: 80 },
	{ asset: "IT Equipment", utilization: 92, target: 85 },
	{ asset: "Furniture", utilization: 68, target: 70 },
	{ asset: "Tools", utilization: 81, target: 85 },
	{ asset: "HVAC", utilization: 94, target: 90 },
];

const chartConfig = {
	utilization: {
		label: "Utilization %",
		color: "var(--primary)",
	},
	target: {
		label: "Target %",
		color: "var(--primary)",
	},
} satisfies ChartConfig;

export function AssetUtilizationChart() {
	return (
		<Card className="@container/card">
			<CardHeader>
				<CardTitle>Bar Chart - Asset Utilization</CardTitle>
				<CardDescription>
					<span className="hidden @[540px]/card:block">
						Current utilization vs target by category for the last 6 months
					</span>
					<span className="@[540px]/card:hidden">Utilization by category</span>
				</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-[250px] w-full"
				>
					<BarChart data={chartData}>
						<defs>
							<linearGradient id="fillUtilization" x1="0" y1="0" x2="0" y2="1">
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
							<linearGradient id="fillTarget" x1="0" y1="0" x2="0" y2="1">
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
							dataKey="asset"
							tickLine={false}
							tickMargin={10}
							axisLine={false}
							tickFormatter={(value) => value.slice(0, 12)}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="dashed" />}
						/>
						<Bar
							dataKey="utilization"
							fill="url(#fillUtilization)"
							radius={4}
						/>
						<Bar dataKey="target" fill="url(#fillTarget)" radius={4} />
					</BarChart>
				</ChartContainer>
			</CardContent>
			<CardFooter className="flex-col items-start gap-2 text-sm">
				<div className="flex gap-2 font-medium leading-none">
					IT Equipment exceeding target by 7%{" "}
					<IconTrendingUp className="h-4 w-4" />
				</div>
				<div className="text-muted-foreground leading-none">
					Overall utilization: 83% across all asset categories
				</div>
			</CardFooter>
		</Card>
	);
}
