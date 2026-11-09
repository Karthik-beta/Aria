"use client";

import type { Inventory } from "@aria/types";
import { format } from "date-fns";
import {
	ArrowDownLeft,
	ArrowUpRight,
	Box,
	Calendar,
	ChevronRight,
	GitCompare,
	Package,
	RefreshCcw,
	Settings,
	Truck,
} from "lucide-react";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type ActivityType = Inventory.ItemActivityType;

const ACTIVITY_ICONS: Record<
	ActivityType,
	React.ComponentType<{ className?: string }>
> = {
	STOCK_IN: ArrowDownLeft,
	STOCK_OUT: ArrowUpRight,
	TRANSFER: GitCompare,
	ADJUSTMENT: RefreshCcw,
	DELIVERY: Truck,
	PURCHASE_RECEIPT: Package,
	STOCK_ENTRY: Box,
	SERIAL_NUMBER: Settings,
	BATCH: Settings,
	CREATED: Package,
	UPDATED: Settings,
	STATUS_CHANGE: RefreshCcw,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
	STOCK_IN: "text-green-600 bg-green-50",
	STOCK_OUT: "text-red-600 bg-red-50",
	TRANSFER: "text-blue-600 bg-blue-50",
	ADJUSTMENT: "text-orange-600 bg-orange-50",
	DELIVERY: "text-purple-600 bg-purple-50",
	PURCHASE_RECEIPT: "text-emerald-600 bg-emerald-50",
	STOCK_ENTRY: "text-cyan-600 bg-cyan-50",
	SERIAL_NUMBER: "text-gray-600 bg-gray-50",
	BATCH: "text-amber-600 bg-amber-50",
	CREATED: "text-green-600 bg-green-50",
	UPDATED: "text-blue-600 bg-blue-50",
	STATUS_CHANGE: "text-orange-600 bg-orange-50",
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
	STOCK_IN: "Stock In",
	STOCK_OUT: "Stock Out",
	TRANSFER: "Transfer",
	ADJUSTMENT: "Adjustment",
	DELIVERY: "Delivery",
	PURCHASE_RECEIPT: "Purchase Receipt",
	STOCK_ENTRY: "Stock Entry",
	SERIAL_NUMBER: "Serial No",
	BATCH: "Batch",
	CREATED: "Created",
	UPDATED: "Updated",
	STATUS_CHANGE: "Status Change",
};

interface ActivityTimelineProps {
	itemId: string;
	limit?: number;
}

export function ActivityTimeline({
	itemId,
	limit = 50,
}: ActivityTimelineProps) {
	const { data, isLoading, error } = trpc.inventory.listItemActivity.useQuery(
		{ itemId, limit },
		{
			refetchOnWindowFocus: false,
			staleTime: 30_000,
		},
	);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calendar className="h-5 w-5" />
						Activity Timeline
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{Array.from({ length: 5 }).map(() => (
						<div key={crypto.randomUUID()} className="flex items-start gap-4">
							<Skeleton className="h-10 w-10 rounded-full" />
							<div className="space-y-2 flex-1">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-3 w-1/2" />
							</div>
						</div>
					))}
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calendar className="h-5 w-5" />
						Activity Timeline
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-destructive">
						Failed to load activity: {error.message}
					</p>
				</CardContent>
			</Card>
		);
	}

	const activities = data ?? [];

	if (activities.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calendar className="h-5 w-5" />
						Activity Timeline
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No activity recorded for this item yet.
					</p>
				</CardContent>
			</Card>
		);
	}

	const groupedByDate = activities.reduce<
		Record<string, (typeof activities)[number][]>
	>((acc, activity) => {
		const dateKey = format(activity.createdAt, "yyyy-MM-dd");
		if (!acc[dateKey]) {
			acc[dateKey] = [];
		}
		acc[dateKey].push(activity);
		return acc;
	}, {});

	const sortedDates = Object.keys(groupedByDate).sort((a, b) =>
		b.localeCompare(a),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Calendar className="h-5 w-5" />
					Activity Timeline
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{sortedDates.map((dateKey) => {
					const dayActivities = groupedByDate[dateKey];
					const date = new Date(dateKey);
					const isToday =
						format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
					const isYesterday =
						format(date, "yyyy-MM-dd") ===
						format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

					let dateLabel = format(date, "MMMM d, yyyy");
					if (isToday) dateLabel = "Today";
					else if (isYesterday) dateLabel = "Yesterday";

					return (
						<div key={dateKey}>
							<div className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
								<Calendar className="h-3 w-3" />
								{dateLabel}
							</div>
							<div className="relative space-y-4 pl-4 border-l-2 border-muted">
								{dayActivities.map((activity) => {
									const IconComponent =
										ACTIVITY_ICONS[activity.activityType] ?? Box;
									const colorClass =
										ACTIVITY_COLORS[activity.activityType] ??
										"text-gray-600 bg-gray-50";
									const label =
										ACTIVITY_LABELS[activity.activityType] ??
										activity.activityType;

									return (
										<div
											key={activity.id}
											className="relative flex items-start gap-4 pl-4"
										>
											<div
												className={cn(
													"absolute -left-[21px] flex h-8 w-8 items-center justify-center rounded-full border-2 border-background",
													colorClass,
												)}
											>
												<IconComponent className="h-4 w-4" />
											</div>

											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 flex-wrap">
													<Badge variant="outline" className="text-xs">
														{label}
													</Badge>
													{activity.referenceName && (
														<span className="text-xs text-muted-foreground flex items-center gap-1">
															<ChevronRight className="h-3 w-3" />
															{activity.referenceName}
														</span>
													)}
												</div>
												<p className="text-sm mt-1">{activity.description}</p>
												<div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
													{activity.quantity !== null && (
														<span
															className={cn(
																"font-medium",
																activity.activityType === "STOCK_IN" &&
																	"text-green-600",
																activity.activityType === "STOCK_OUT" &&
																	"text-red-600",
															)}
														>
															{activity.activityType === "STOCK_IN"
																? "+"
																: activity.activityType === "STOCK_OUT"
																	? "-"
																	: ""}
															{activity.quantity} units
														</span>
													)}
													<span>{format(activity.createdAt, "h:mm a")}</span>
													{activity.warehouse && (
														<span>{activity.warehouse}</span>
													)}
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
