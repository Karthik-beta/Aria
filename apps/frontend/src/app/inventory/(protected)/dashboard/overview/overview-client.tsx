"use client";

import type { Inventory } from "@aria/types";
import {
	IconAlertTriangle,
	IconArrowDown,
	IconArrowUp,
	IconBox,
	IconBuildingWarehouse,
	IconCircleCheck,
	IconClock,
	IconFileInvoice,
	IconPackage,
	IconRefresh,
	IconTrendingDown,
	IconTruckDelivery,
} from "@tabler/icons-react";
import Link from "next/link";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { InventoryOverviewChartsProps } from "./charts-island";
import { InventoryOverviewChartsLazy } from "./charts-island.lazy";
import {
	formatCompactCurrency,
	formatDeliveryStatus,
	formatQuantity,
	formatRelativeDate,
	formatStockEntryType,
	getActiveItemsInsight,
	getDeliveryStatusColor,
	getExpiryUrgency,
	getLowStockInsight,
	getPendingRequestsInsight,
	getStockValueInsight,
} from "./dashboard.utils";

const DASHBOARD_GRID_CLASS =
	"grid grid-cols-1 gap-4 md:grid-cols-2 lg:auto-rows-[minmax(12rem,auto)] lg:grid-cols-12 lg:grid-flow-row-dense";
const CARD_SURFACE_CLASS =
	"h-full border-border/70 bg-card/95 shadow-sm supports-[backdrop-filter]:backdrop-blur";

// ── Realtime Subscriptions ────────────────────────────────────────────

function DashboardSubscriptions({ onEvent }: { onEvent: () => void }) {
	trpc.inventory.onStockEntriesChanged.useSubscription(undefined, {
		onData: onEvent,
	});
	trpc.inventory.onItemsChanged.useSubscription(undefined, {
		onData: onEvent,
	});
	trpc.inventory.onMaterialRequestsChanged.useSubscription(undefined, {
		onData: onEvent,
	});
	trpc.inventory.onDeliveryNotesChanged.useSubscription(undefined, {
		onData: onEvent,
	});
	return null;
}

function useDebouncedDashboardInvalidate(
	invalidate: () => Promise<unknown>,
	delayMs = 200,
) {
	const timeoutRef = React.useRef<number | null>(null);

	React.useEffect(() => {
		return () => {
			if (timeoutRef.current !== null) {
				window.clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return React.useCallback(() => {
		if (timeoutRef.current !== null) {
			window.clearTimeout(timeoutRef.current);
		}

		timeoutRef.current = window.setTimeout(() => {
			timeoutRef.current = null;
			void invalidate();
		}, delayMs);
	}, [delayMs, invalidate]);
}

// ── Empty / Skeleton States ───────────────────────────────────────────

function FooterLink({
	href,
	children,
}: {
	href: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			className="text-muted-foreground hover:text-foreground transition-colors"
		>
			{children}
		</Link>
	);
}

function CenteredCardState({
	icon: Icon,
	title,
	description,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description?: string;
}) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
			<Icon className="text-muted-foreground size-8" />
			<p className="text-sm font-medium">{title}</p>
			{description ? (
				<p className="text-muted-foreground max-w-xs text-xs">{description}</p>
			) : null}
		</div>
	);
}

function KpiSkeleton({ className }: { className?: string }) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[9.75rem]", className)}>
			<CardHeader>
				<Skeleton className="h-4 w-28" />
				<Skeleton className="mt-2 h-10 w-32" />
			</CardHeader>
			<CardFooter className="mt-auto">
				<Skeleton className="h-4 w-40" />
			</CardFooter>
		</Card>
	);
}

function TileSkeleton({
	className,
	heightClassName = "min-h-[18rem]",
}: {
	className?: string;
	heightClassName?: string;
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, heightClassName, className)}>
			<CardHeader>
				<Skeleton className="h-5 w-44" />
				<Skeleton className="mt-1 h-4 w-56" />
			</CardHeader>
			<CardContent className="flex flex-1">
				<Skeleton className="h-full min-h-[12rem] w-full rounded-xl" />
			</CardContent>
		</Card>
	);
}

function DashboardSkeletonGrid() {
	return (
		<>
			<KpiSkeleton className="lg:col-span-3" />
			<KpiSkeleton className="lg:col-span-3" />
			<KpiSkeleton className="lg:col-span-3" />
			<KpiSkeleton className="lg:col-span-3" />
			<TileSkeleton className="lg:col-span-8" />
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-8" />
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-4 lg:row-span-2" />
			<TileSkeleton className="lg:col-span-4" />
			<TileSkeleton className="lg:col-span-4" />
		</>
	);
}

// ── Main Dashboard ────────────────────────────────────────────────────

export function InventoryOverviewClient({
	initialData,
	ChartsComponent = InventoryOverviewChartsLazy,
	snapshotAt,
}: {
	initialData?: Inventory.DashboardOverviewData;
	ChartsComponent?: React.ComponentType<InventoryOverviewChartsProps>;
	snapshotAt?: number;
}) {
	const utils = trpc.useUtils();
	const [renderSnapshotAt] = React.useState(() => snapshotAt ?? Date.now());

	const overviewQuery = trpc.inventory.getDashboardOverviewData.useQuery(
		undefined,
		{
			refetchOnWindowFocus: false,
			staleTime: 30_000,
			initialData,
			initialDataUpdatedAt: initialData ? renderSnapshotAt : undefined,
		},
	);
	const topChartsQuery = trpc.inventory.getDashboardTopChartsData.useQuery(
		undefined,
		{
			refetchOnWindowFocus: false,
			staleTime: 30_000,
		},
	);
	const bottomChartsQuery =
		trpc.inventory.getDashboardBottomChartsData.useQuery(undefined, {
			refetchOnWindowFocus: false,
			staleTime: 30_000,
		});

	const invalidateDashboardQueries = React.useCallback(async () => {
		await Promise.all([
			utils.inventory.getDashboardOverviewData.invalidate(),
			utils.inventory.getDashboardTopChartsData.invalidate(),
			utils.inventory.getDashboardBottomChartsData.invalidate(),
		]);
	}, [utils]);
	const handleRealtimeEvent = useDebouncedDashboardInvalidate(
		invalidateDashboardQueries,
	);
	const handleRefresh = React.useCallback(() => {
		void Promise.all([
			overviewQuery.refetch(),
			topChartsQuery.refetch(),
			bottomChartsQuery.refetch(),
		]);
	}, [bottomChartsQuery, overviewQuery, topChartsQuery]);

	const isRefreshing =
		overviewQuery.isFetching ||
		topChartsQuery.isFetching ||
		bottomChartsQuery.isFetching;
	const hasOverviewError = !overviewQuery.data && overviewQuery.error;
	const hasTopChartsError = !topChartsQuery.data && !!topChartsQuery.error;
	const hasBottomChartsError =
		!bottomChartsQuery.data && !!bottomChartsQuery.error;

	if (hasOverviewError) {
		return (
			<PageContainer>
				<div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
					<IconAlertTriangle className="text-destructive size-12" />
					<p className="text-muted-foreground text-sm">
						Failed to load dashboard data
					</p>
					<Button
						variant="outline"
						size="sm"
						onClick={() => overviewQuery.refetch()}
					>
						<IconRefresh className="mr-2 size-4" />
						Retry
					</Button>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			{overviewQuery.data ? (
				<DashboardSubscriptions onEvent={handleRealtimeEvent} />
			) : null}

			<div className="flex flex-1 flex-col gap-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<h2 className="text-2xl font-bold tracking-tight">
							Inventory Dashboard
						</h2>
						<p className="text-muted-foreground text-sm">
							Real-time overview of stock health, movements, and operations
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={isRefreshing}
					>
						<IconRefresh
							className={cn("mr-2 size-4", isRefreshing && "animate-spin")}
						/>
						Refresh
					</Button>
				</div>

				<div className={DASHBOARD_GRID_CLASS}>
					{overviewQuery.isLoading && !overviewQuery.data ? (
						<DashboardSkeletonGrid />
					) : null}
					{overviewQuery.data ? (
						<>
							<KpiCards kpis={overviewQuery.data.kpis} />
							<ChartsComponent
								itemGroupDistribution={overviewQuery.data.itemGroupDistribution}
								topChartsData={topChartsQuery.data}
								bottomChartsData={bottomChartsQuery.data}
								isTopChartsLoading={
									!topChartsQuery.data && topChartsQuery.isLoading
								}
								isBottomChartsLoading={
									!bottomChartsQuery.data && bottomChartsQuery.isLoading
								}
								hasTopChartsError={hasTopChartsError}
								hasBottomChartsError={hasBottomChartsError}
								onRetryTopCharts={() => {
									void topChartsQuery.refetch();
								}}
								onRetryBottomCharts={() => {
									void bottomChartsQuery.refetch();
								}}
							/>
							<LowStockAlerts
								className="lg:col-span-4"
								data={overviewQuery.data.lowStockItems}
							/>
							<RecentActivityFeed
								className="lg:col-span-4 lg:row-span-2"
								data={overviewQuery.data.recentActivity}
								snapshotAt={renderSnapshotAt}
							/>
							<BatchExpiryTracker
								className="lg:col-span-4"
								data={overviewQuery.data.batchExpiry}
							/>
							<DeliveryStatusCard
								className="lg:col-span-4"
								data={overviewQuery.data.deliveryStatus}
							/>
						</>
					) : null}
				</div>
			</div>
		</PageContainer>
	);
}

// ── KPI Cards ─────────────────────────────────────────────────────────

function KpiCards({ kpis }: { kpis: Inventory.DashboardKpi }) {
	const stockValueInsight = getStockValueInsight(
		kpis.totalStockValue,
		kpis.totalStockQuantity,
		kpis.totalItems,
	);
	const activeItemsInsight = getActiveItemsInsight(
		kpis.totalItems,
		kpis.activeWarehouses,
	);
	const lowStockInsight = getLowStockInsight(
		kpis.lowStockItemCount,
		kpis.totalItems,
	);
	const pendingRequestsInsight = getPendingRequestsInsight(
		kpis.pendingMaterialRequests,
	);

	return (
		<>
			<KpiCard
				className="lg:col-span-3"
				title="Total Stock Value"
				value={formatCompactCurrency(kpis.totalStockValue)}
				insightText={stockValueInsight.text}
				insightSubtext={stockValueInsight.subtext}
				insightColorClass={stockValueInsight.colorClass}
				insightIcon={IconPackage}
				action={
					<Badge variant="outline" className="text-xs">
						<IconPackage className="size-3" />
						{formatQuantity(kpis.totalStockQuantity)} units
					</Badge>
				}
			/>
			<KpiCard
				className="lg:col-span-3"
				title="Active Items"
				value={formatQuantity(kpis.totalItems)}
				insightText={activeItemsInsight.text}
				insightSubtext={activeItemsInsight.subtext}
				insightColorClass={activeItemsInsight.colorClass}
				insightIcon={IconBuildingWarehouse}
				action={
					<Badge variant="outline" className="text-xs">
						<IconBuildingWarehouse className="size-3" />
						{kpis.activeWarehouses} warehouses
					</Badge>
				}
			/>
			<KpiCard
				className="lg:col-span-3"
				title="Low Stock Alerts"
				value={formatQuantity(kpis.lowStockItemCount)}
				insightText={lowStockInsight.text}
				insightSubtext={lowStockInsight.subtext}
				insightColorClass={lowStockInsight.colorClass}
				insightIcon={
					kpis.lowStockItemCount === 0 ? IconCircleCheck : IconTrendingDown
				}
				action={
					kpis.lowStockItemCount > 0 ? (
						<Badge variant="destructive" className="text-xs">
							<IconAlertTriangle className="size-3" />
							Attention
						</Badge>
					) : (
						<Badge
							variant="outline"
							className="text-xs text-green-600 dark:text-green-400"
						>
							All Clear
						</Badge>
					)
				}
			/>
			<Card
				className={cn(
					CARD_SURFACE_CLASS,
					"@container/card min-h-[9.75rem] bg-gradient-to-b from-background to-muted/20 lg:col-span-3",
				)}
			>
				<CardHeader>
					<CardDescription>Pending Material Requests</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{kpis.pendingMaterialRequests}
					</CardTitle>
					<CardAction>
						<Badge variant="outline" className="text-xs">
							<IconFileInvoice className="size-3" />
							Open
						</Badge>
					</CardAction>
				</CardHeader>
				<CardFooter className="flex-col items-start gap-1.5 text-sm">
					<div
						className={cn(
							"line-clamp-1 flex items-center gap-2 font-medium",
							pendingRequestsInsight.colorClass,
						)}
					>
						{kpis.pendingMaterialRequests === 0 ? (
							<IconCircleCheck className="size-4 shrink-0" />
						) : (
							<IconFileInvoice className="size-4 shrink-0" />
						)}
						{pendingRequestsInsight.text}
					</div>
					<FooterLink href="/inventory/stock-transaction/material-request">
						View all requests →
					</FooterLink>
				</CardFooter>
			</Card>
		</>
	);
}

function KpiCard({
	className,
	title,
	value,
	insightText,
	insightSubtext,
	insightIcon: InsightIcon,
	insightColorClass,
	action,
}: {
	className?: string;
	title: string;
	value: string;
	insightText: string;
	insightSubtext: string;
	insightIcon: React.ComponentType<{ className?: string }>;
	insightColorClass?: string;
	action?: React.ReactNode;
}) {
	return (
		<Card
			className={cn(
				CARD_SURFACE_CLASS,
				"@container/card min-h-[9.75rem] bg-gradient-to-b from-background to-muted/20",
				className,
			)}
		>
			<CardHeader>
				<CardDescription>{title}</CardDescription>
				<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
					{value}
				</CardTitle>
				{action ? <CardAction>{action}</CardAction> : null}
			</CardHeader>
			<CardFooter className="flex-col items-start gap-1.5 text-sm">
				<div
					className={cn(
						"line-clamp-1 flex items-center gap-2 font-medium",
						insightColorClass,
					)}
				>
					<InsightIcon className="size-4 shrink-0" />
					{insightText}
				</div>
				<div className="text-muted-foreground">{insightSubtext}</div>
			</CardFooter>
		</Card>
	);
}

function RecentActivityFeed({
	className,
	data,
	snapshotAt,
}: {
	className?: string;
	data: Inventory.DashboardRecentActivity[];
	snapshotAt: number;
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, className)}>
			<CardHeader>
				<CardTitle>Recent Stock Activity</CardTitle>
				<CardDescription>Latest stock entry transactions</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col gap-4">
						{data.map((entry) => (
							<div key={entry.id} className="flex items-start gap-3">
								<div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
									{entry.type === "MATERIAL_RECEIPT" ? (
										<IconArrowDown className="text-chart-2 size-4" />
									) : entry.type === "MATERIAL_ISSUE" ? (
										<IconArrowUp className="text-chart-1 size-4" />
									) : (
										<IconBox className="text-chart-3 size-4" />
									)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center justify-between gap-2">
										<p className="truncate text-sm font-medium">
											{entry.itemCode}
										</p>
										<span className="text-muted-foreground shrink-0 text-xs">
											{formatRelativeDate(entry.postingDate, snapshotAt)}
										</span>
									</div>
									<p className="text-muted-foreground truncate text-xs">
										{formatStockEntryType(entry.type)} · {entry.series}
										{entry.warehouse ? ` · ${entry.warehouse}` : ""}
									</p>
									<Badge variant="outline" className="mt-1 text-xs">
										{entry.qty > 0 ? "+" : ""}
										{formatQuantity(entry.qty)} units
									</Badge>
								</div>
							</div>
						))}
					</div>
				) : (
					<CenteredCardState
						icon={IconBox}
						title="No recent stock activity"
						description="Submitted stock entries will appear here as soon as inventory operations are posted."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/inventory/stock-transaction/stock-entry">
					View all stock entries →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}

// ── Low Stock Alerts ──────────────────────────────────────────────────

function LowStockAlerts({
	className,
	data,
}: {
	className?: string;
	data: Inventory.DashboardLowStockItem[];
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[18rem]", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconAlertTriangle className="text-destructive size-4" />
					Low Stock Alerts
				</CardTitle>
				<CardDescription>
					{data.length} item{data.length === 1 ? "" : "s"} below safety stock
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col gap-3">
						{data.slice(0, 6).map((item) => (
							<div
								key={item.itemCode}
								className="flex items-center justify-between gap-3"
							>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">
										{item.itemCode}
									</p>
									<p className="text-muted-foreground truncate text-xs">
										{item.itemName}
									</p>
								</div>
								<div className="text-right">
									<p className="text-sm tabular-nums">
										{formatQuantity(item.currentQty)}{" "}
										<span className="text-muted-foreground">
											/ {formatQuantity(item.safetyStock)}
										</span>
									</p>
									<p className="text-destructive text-xs font-medium tabular-nums">
										−{formatQuantity(item.deficit)} deficit
									</p>
								</div>
							</div>
						))}
					</div>
				) : (
					<CenteredCardState
						icon={IconPackage}
						title="All items are above safety stock"
						description="This panel will surface the most urgent shortages once committed balances drop below reorder thresholds."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/inventory/stock-reports/stock-summary">
					View stock summary →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}

// ── Batch Expiry Tracker ──────────────────────────────────────────────

function BatchExpiryTracker({
	className,
	data,
}: {
	className?: string;
	data: Inventory.DashboardBatchExpiry[];
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[17rem]", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconClock className="text-amber-500 size-4" />
					Batch Expiry Tracker
				</CardTitle>
				<CardDescription>
					{data.length} batch{data.length === 1 ? "" : "es"} expiring within 90
					days
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col justify-center gap-3">
						{data.slice(0, 6).map((batch) => {
							const urgency = getExpiryUrgency(batch.daysUntilExpiry);

							return (
								<div
									key={batch.batchId}
									className="flex items-center justify-between gap-3"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">
											{batch.batchId}
										</p>
										<p className="text-muted-foreground truncate text-xs">
											{batch.itemCode} · {formatQuantity(batch.quantity)} units
										</p>
									</div>
									<div className="text-right">
										<Badge
											variant="outline"
											className={cn("text-xs", urgency.className)}
										>
											{urgency.label}
										</Badge>
										<p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
											{batch.daysUntilExpiry <= 0
												? "Expired"
												: `${batch.daysUntilExpiry}d left`}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<CenteredCardState
						icon={IconClock}
						title="No batches expiring soon"
						description="Upcoming batch expiries within the next 90 days will appear here for proactive action."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/inventory/serial-no-and-batch/batch">
					View all batches →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}

// ── Delivery Status Card ──────────────────────────────────────────────

function DeliveryStatusCard({
	className,
	data,
}: {
	className?: string;
	data: Inventory.DashboardDeliveryStatus[];
}) {
	const totalDeliveries = data.reduce((sum, item) => sum + item.count, 0);
	const totalAmount = data.reduce((sum, item) => sum + item.totalAmount, 0);

	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[17rem]", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconTruckDelivery className="size-4" />
					Delivery Status
				</CardTitle>
				<CardDescription>
					{totalDeliveries} delivery notes ·{" "}
					{formatCompactCurrency(totalAmount)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col justify-center gap-4">
						{data.map((item) => {
							const percent =
								totalDeliveries > 0
									? Math.round((item.count / totalDeliveries) * 100)
									: 0;

							return (
								<div key={item.status}>
									<div className="mb-1 flex items-center justify-between">
										<span className="text-sm font-medium">
											{formatDeliveryStatus(item.status)}
										</span>
										<span className="text-muted-foreground text-xs tabular-nums">
											{item.count} ({percent}%)
										</span>
									</div>
									<div className="bg-muted h-2 overflow-hidden rounded-full">
										<div
											className="h-full rounded-full transition-all"
											style={{
												width: `${percent}%`,
												backgroundColor: getDeliveryStatusColor(item.status),
											}}
										/>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<CenteredCardState
						icon={IconTruckDelivery}
						title="No delivery notes yet"
						description="Status progression appears here once delivery notes begin moving through the fulfilment flow."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/inventory/stock-transaction/delivery-note">
					View delivery notes →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}
