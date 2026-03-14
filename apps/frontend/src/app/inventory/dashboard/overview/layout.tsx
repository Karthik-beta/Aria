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
	title: "Inventory Dashboard - Aria ERP",
	description: "Inventory management and stock tracking dashboard",
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
						Inventory Dashboard 📦
					</h2>
				</div>

				<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4">
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Stock Value</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								₹45,67,890
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<IconTrendingUp />
									+8.3%
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Stock value increased <IconTrendingUp className="size-4" />
							</div>
							<div className="text-muted-foreground">
								Compared to last month
							</div>
						</CardFooter>
					</Card>
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Low Stock Items</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								23
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<IconTrendingDown />
									-5 items
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Reorder required soon <IconTrendingDown className="size-4" />
							</div>
							<div className="text-muted-foreground">Check reorder levels</div>
						</CardFooter>
					</Card>
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Items in Stock</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								1,847
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<IconTrendingUp />
									+12.5%
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Inventory growing <IconTrendingUp className="size-4" />
							</div>
							<div className="text-muted-foreground">
								New items added this quarter
							</div>
						</CardFooter>
					</Card>
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Stock Turnover Rate</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								6.2x
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<IconTrendingUp />
									+0.8x
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Healthy turnover <IconTrendingUp className="size-4" />
							</div>
							<div className="text-muted-foreground">
								Efficient inventory management
							</div>
						</CardFooter>
					</Card>
				</div>
				{/* Inventory-specific layout: 2 columns + 1 full width */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div className="lg:col-span-1">{bar_stats}</div>
					<div className="lg:col-span-1">{sales}</div>
				</div>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div className="lg:col-span-1">{area_stats}</div>
					<div className="lg:col-span-1">{pie_stats}</div>
				</div>
			</div>
		</PageContainer>
	);
}
