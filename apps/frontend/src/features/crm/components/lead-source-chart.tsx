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
	{ source: "website", leads: 380, fill: "var(--primary)" },
	{ source: "referral", leads: 245, fill: "var(--primary-light)" },
	{ source: "coldcall", leads: 156, fill: "var(--primary-lighter)" },
	{ source: "linkedin", leads: 198, fill: "var(--primary-dark)" },
	{ source: "email", leads: 142, fill: "var(--primary-darker)" },
];

const chartConfig = {
	leads: {
		label: "Leads",
	},
	website: {
		label: "Website",
		color: "var(--primary)",
	},
	referral: {
		label: "Referral",
		color: "var(--primary)",
	},
	coldcall: {
		label: "Cold Call",
		color: "var(--primary)",
	},
	linkedin: {
		label: "LinkedIn",
		color: "var(--primary)",
	},
	email: {
		label: "Email Marketing",
		color: "var(--primary)",
	},
} satisfies ChartConfig;

export function LeadSourceChart() {
	const totalLeads = React.useMemo(() => {
		return chartData.reduce((acc, curr) => acc + curr.leads, 0);
	}, []);

	return (
		<Card className="@container/card">
			<CardHeader>
				<CardTitle>Pie Chart - Lead Sources</CardTitle>
				<CardDescription>
					<span className="hidden @[540px]/card:block">
						Total leads by source channel for the last 6 months
					</span>
					<span className="@[540px]/card:hidden">Lead distribution</span>
				</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={chartConfig}
					className="mx-auto aspect-square h-[250px]"
				>
					<PieChart>
						<defs>
							{["website", "referral", "coldcall", "linkedin", "email"].map(
								(source, index) => (
									<linearGradient
										key={source}
										id={`fill${source}`}
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
								fill: `url(#fill${item.source})`,
							}))}
							dataKey="leads"
							nameKey="source"
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
													{totalLeads.toLocaleString()}
												</tspan>
												<tspan
													x={viewBox.cx}
													y={(viewBox.cy || 0) + 24}
													className="fill-muted-foreground text-sm"
												>
													Total Leads
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
					Website leads dominate at{" "}
					{((chartData[0].leads / totalLeads) * 100).toFixed(1)}%{" "}
					<IconTrendingUp className="h-4 w-4" />
				</div>
				<div className="text-muted-foreground leading-none">
					Based on data from January - June 2024
				</div>
			</CardFooter>
		</Card>
	);
}
