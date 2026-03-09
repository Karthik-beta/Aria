import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
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

export const metadata = {
	title: "Asset Dashboard - Aria ERP",
	description: "Asset management and depreciation tracking dashboard",
};

export default function OverViewLayout({
	sales,
	pie_stats,
	bar_stats,
	area_stats,
}: {
	sales: React.ReactNode;
	pie_stats: React.ReactNode;
	bar_stats: React.ReactNode;
	area_stats: React.ReactNode;
}) {
	return (
		<PageContainer>
			<div className="flex flex-1 flex-col space-y-2">
				<div className="flex items-center justify-between space-y-2">
					<h2 className="text-2xl font-bold tracking-tight">
						Asset Dashboard 🏭
					</h2>
				</div>

				<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4">
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Total Asset Value</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								₹2,45,67,000
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<IconTrendingUp />
									+5.2%
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Asset value growing <IconTrendingUp className="size-4" />
							</div>
							<div className="text-muted-foreground">
								New acquisitions this quarter
							</div>
						</CardFooter>
					</Card>
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Assets Under Maintenance</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								12
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<IconTrendingDown />
									-3 assets
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Maintenance in progress <IconTrendingDown className="size-4" />
							</div>
							<div className="text-muted-foreground">
								Schedule updates required
							</div>
						</CardFooter>
					</Card>
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Active Assets</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								487
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<IconTrendingUp />
									+8.5%
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								High utilization rate <IconTrendingUp className="size-4" />
							</div>
							<div className="text-muted-foreground">
								Assets deployed efficiently
							</div>
						</CardFooter>
					</Card>
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Depreciation Rate</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								3.8%
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<IconTrendingUp />
									+0.2%
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Within expected range <IconTrendingUp className="size-4" />
							</div>
							<div className="text-muted-foreground">
								Normal depreciation trend
							</div>
						</CardFooter>
					</Card>
				</div>
				{/* Asset-specific layout: 1 full width + 2 columns */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div className="lg:col-span-1">{bar_stats}</div>
					<div className="lg:col-span-1">{area_stats}</div>
				</div>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div className="lg:col-span-1">{pie_stats}</div>
					<div className="lg:col-span-1">{sales}</div>
				</div>
			</div>
		</PageContainer>
	);
}
