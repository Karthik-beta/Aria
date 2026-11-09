import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import type { Metadata } from "next";
import type React from "react";
import PageContainer from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
	title: "HRMS Dashboard - Aria ERP",
	description:
		"Human Resource Management System overview with employee analytics",
};

export default function OverViewLayout({
	pie_stats,
	bar_stats,
	area_stats,
}: {
	pie_stats: React.ReactNode;
	bar_stats: React.ReactNode;
	area_stats: React.ReactNode;
}) {
	return (
		<PageContainer>
			<div className="flex flex-1 flex-col space-y-2">
				<div className="flex items-center justify-between space-y-2">
					<h2 className="text-2xl font-bold tracking-tight">
						HRMS Dashboard 👥
					</h2>
				</div>

				<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4">
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Total Employees</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								342
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<IconTrendingUp />
									+18 new
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Workforce expanding <IconTrendingUp className="size-4" />
							</div>
							<div className="text-muted-foreground">
								New hires this quarter
							</div>
						</CardFooter>
					</Card>
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>On Leave Today</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								28
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<IconTrendingDown />
									8.2%
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Employees on leave <IconTrendingDown className="size-4" />
							</div>
							<div className="text-muted-foreground">Within normal range</div>
						</CardFooter>
					</Card>
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Attendance Rate</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								94.3%
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<IconTrendingUp />
									+2.1%
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Excellent attendance <IconTrendingUp className="size-4" />
							</div>
							<div className="text-muted-foreground">Above target of 92%</div>
						</CardFooter>
					</Card>
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Avg. Salary Cost</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								₹65,400
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<IconTrendingUp />
									+5.8%
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Competitive salaries <IconTrendingUp className="size-4" />
							</div>
							<div className="text-muted-foreground">
								Annual increment applied
							</div>
						</CardFooter>
					</Card>
				</div>
				{/* Unique HRMS layout: 3 charts without sales section */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div className="lg:col-span-2">{bar_stats}</div>
					<div className="lg:col-span-1">{area_stats}</div>
					<div className="lg:col-span-1">{pie_stats}</div>
				</div>
			</div>
		</PageContainer>
	);
}
