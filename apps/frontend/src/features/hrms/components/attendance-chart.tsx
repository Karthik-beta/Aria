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
	{ department: "Engineering", attendance: 96, target: 95 },
	{ department: "Sales", attendance: 92, target: 95 },
	{ department: "HR", attendance: 98, target: 95 },
	{ department: "Finance", attendance: 94, target: 95 },
	{ department: "Operations", attendance: 91, target: 95 },
	{ department: "Marketing", attendance: 93, target: 95 },
];

const chartConfig = {
	attendance: {
		label: "Attendance %",
		color: "var(--primary)",
	},
	target: {
		label: "Target %",
		color: "var(--primary)",
	},
} satisfies ChartConfig;

export function AttendanceChart() {
	return (
		<Card className="@container/card">
			<CardHeader>
				<CardTitle>Bar Chart - Department Attendance</CardTitle>
				<CardDescription>
					<span className="hidden @[540px]/card:block">
						Current attendance vs target by department for the last month
					</span>
					<span className="@[540px]/card:hidden">Attendance by department</span>
				</CardDescription>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-[250px] w-full"
				>
					<BarChart data={chartData}>
						<defs>
							<linearGradient id="fillAttendance" x1="0" y1="0" x2="0" y2="1">
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
							dataKey="department"
							tickLine={false}
							tickMargin={10}
							axisLine={false}
							tickFormatter={(value) => value.slice(0, 10)}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="dashed" />}
						/>
						<Bar dataKey="attendance" fill="url(#fillAttendance)" radius={4} />
						<Bar dataKey="target" fill="url(#fillTarget)" radius={4} />
					</BarChart>
				</ChartContainer>
			</CardContent>
			<CardFooter className="flex-col items-start gap-2 text-sm">
				<div className="flex gap-2 font-medium leading-none">
					HR department leads at 98% attendance{" "}
					<IconTrendingUp className="h-4 w-4" />
				</div>
				<div className="text-muted-foreground leading-none">
					Overall company attendance: 94.3% this month
				</div>
			</CardFooter>
		</Card>
	);
}
