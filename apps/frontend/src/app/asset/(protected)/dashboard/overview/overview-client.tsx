"use client";

import type { Asset } from "@aria/types";
import {
	IconAlertTriangle,
	IconBuildingWarehouse,
	IconCircleCheck,
	IconFileInvoice,
	IconPackage,
	IconRefresh,
	IconShield,
	IconTool,
	IconTrendingDown,
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
import type { AssetOverviewChartsProps } from "./charts-island";
import { AssetOverviewChartsLazy } from "./charts-island.lazy";
import {
	formatAdjustmentStatus,
	formatCompactCurrency,
	formatQuantity,
	formatRelativeDate,
	getActiveAssetsInsight,
	getAdjustmentStatusColor,
	getAssetValueInsight,
	getInsuranceUrgency,
	getMaintenanceDueInsight,
	getMaintenanceUrgency,
	getPendingAdjustmentsInsight,
} from "./dashboard.utils";

const DASHBOARD_GRID_CLASS =
	"grid grid-cols-1 gap-4 md:grid-cols-2 lg:auto-rows-[minmax(12rem,auto)] lg:grid-cols-12 lg:grid-flow-row-dense";
const CARD_SURFACE_CLASS =
	"h-full border-border/70 bg-card/95 shadow-sm supports-[backdrop-filter]:backdrop-blur";

// ── Realtime Subscriptions ────────────────────────────────────────────

function DashboardSubscriptions({ onEvent }: { onEvent: () => void }) {
	trpc.asset.onAssetsChanged.useSubscription(undefined, {
		onData: onEvent,
	});
	trpc.asset.onAssetValueAdjustmentsChanged.useSubscription(undefined, {
		onData: onEvent,
	});
	trpc.asset.onAssetMaintenancesChanged.useSubscription(undefined, {
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

export function AssetOverviewClient({
	initialData,
	ChartsComponent = AssetOverviewChartsLazy,
	snapshotAt,
}: {
	initialData?: Asset.AssetDashboardOverviewData;
	ChartsComponent?: React.ComponentType<AssetOverviewChartsProps>;
	snapshotAt?: number;
}) {
	const utils = trpc.useUtils();
	const [renderSnapshotAt] = React.useState(() => snapshotAt ?? Date.now());

	const overviewQuery = trpc.asset.getDashboardOverviewData.useQuery(
		undefined,
		{
			refetchOnWindowFocus: false,
			staleTime: 30_000,
			initialData,
			initialDataUpdatedAt: initialData ? renderSnapshotAt : undefined,
		},
	);
	const topChartsQuery = trpc.asset.getDashboardTopChartsData.useQuery(
		undefined,
		{
			refetchOnWindowFocus: false,
			staleTime: 30_000,
		},
	);
	const bottomChartsQuery = trpc.asset.getDashboardBottomChartsData.useQuery(
		undefined,
		{
			refetchOnWindowFocus: false,
			staleTime: 30_000,
		},
	);

	const invalidateDashboardQueries = React.useCallback(async () => {
		await Promise.all([
			utils.asset.getDashboardOverviewData.invalidate(),
			utils.asset.getDashboardTopChartsData.invalidate(),
			utils.asset.getDashboardBottomChartsData.invalidate(),
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
							Asset Dashboard
						</h2>
						<p className="text-muted-foreground text-sm">
							Real-time overview of asset health, depreciation, and maintenance
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
							<MaintenanceDueList
								className="lg:col-span-4"
								data={overviewQuery.data.maintenanceDue}
							/>
							<RecentActivityFeed
								className="lg:col-span-4 lg:row-span-2"
								data={overviewQuery.data.recentActivity}
								snapshotAt={renderSnapshotAt}
							/>
							<InsuranceExpiryTracker
								className="lg:col-span-4"
								data={overviewQuery.data.insuranceExpiry}
							/>
							<AdjustmentSummaryCard
								className="lg:col-span-4"
								data={overviewQuery.data.adjustmentSummary}
							/>
						</>
					) : null}
				</div>
			</div>
		</PageContainer>
	);
}

// ── KPI Cards ─────────────────────────────────────────────────────────

function KpiCards({ kpis }: { kpis: Asset.AssetDashboardKpi }) {
	const valueInsight = getAssetValueInsight(
		kpis.totalAssetValue,
		kpis.totalPurchaseValue,
	);
	const activeInsight = getActiveAssetsInsight(
		kpis.activeAssets,
		kpis.totalAssets,
		kpis.locationCount,
	);
	const maintenanceInsight = getMaintenanceDueInsight(kpis.maintenanceDueCount);
	const adjustmentInsight = getPendingAdjustmentsInsight(
		kpis.pendingAdjustments,
	);

	return (
		<>
			<KpiCard
				className="lg:col-span-3"
				title="Total Asset Value"
				value={formatCompactCurrency(kpis.totalAssetValue)}
				insightText={valueInsight.text}
				insightSubtext={valueInsight.subtext}
				insightColorClass={valueInsight.colorClass}
				insightIcon={IconPackage}
				action={
					<Badge variant="outline" className="text-xs">
						<IconTrendingDown className="size-3" />
						{formatCompactCurrency(kpis.totalDepreciation)} dep.
					</Badge>
				}
			/>
			<KpiCard
				className="lg:col-span-3"
				title="Active Assets"
				value={formatQuantity(kpis.activeAssets)}
				insightText={activeInsight.text}
				insightSubtext={activeInsight.subtext}
				insightColorClass={activeInsight.colorClass}
				insightIcon={IconBuildingWarehouse}
				action={
					<Badge variant="outline" className="text-xs">
						<IconPackage className="size-3" />
						{kpis.totalAssets} total
					</Badge>
				}
			/>
			<KpiCard
				className="lg:col-span-3"
				title="Maintenance Due"
				value={formatQuantity(kpis.maintenanceDueCount)}
				insightText={maintenanceInsight.text}
				insightSubtext={maintenanceInsight.subtext}
				insightColorClass={maintenanceInsight.colorClass}
				insightIcon={
					kpis.maintenanceDueCount === 0 ? IconCircleCheck : IconTool
				}
				action={
					kpis.maintenanceDueCount > 0 ? (
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
			<KpiCard
				className="lg:col-span-3"
				title="Pending Adjustments"
				value={formatQuantity(kpis.pendingAdjustments)}
				insightText={adjustmentInsight.text}
				insightSubtext={adjustmentInsight.subtext}
				insightColorClass={adjustmentInsight.colorClass}
				insightIcon={
					kpis.pendingAdjustments === 0 ? IconCircleCheck : IconFileInvoice
				}
				action={
					<Badge variant="outline" className="text-xs">
						<IconFileInvoice className="size-3" />
						Drafts
					</Badge>
				}
			/>
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

function MaintenanceDueList({
	className,
	data,
}: {
	className?: string;
	data: Asset.AssetDashboardMaintenanceDue[];
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[18rem]", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconTool className="size-4" />
					Maintenance Due
				</CardTitle>
				<CardDescription>
					{data.length} task{data.length === 1 ? "" : "s"} due within 90 days
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col gap-3">
						{data.slice(0, 6).map((task) => {
							const urgency = getMaintenanceUrgency(task.daysUntilDue);

							return (
								<div
									key={task.taskId}
									className="flex items-center justify-between gap-3"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">
											{task.assetName}
										</p>
										<p className="text-muted-foreground truncate text-xs">
											{task.maintenanceTask}
											{task.assignToName ? ` · ${task.assignToName}` : ""}
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
											{task.daysUntilDue <= 0
												? "Overdue"
												: `${task.daysUntilDue}d left`}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<CenteredCardState
						icon={IconTool}
						title="No maintenance tasks due"
						description="Upcoming maintenance within 90 days will appear here."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/asset/asset-maintenance/maintenance">
					View all maintenance →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}

// ── Recent Activity Feed ──────────────────────────────────────────────

function RecentActivityFeed({
	className,
	data,
	snapshotAt,
}: {
	className?: string;
	data: Asset.AssetDashboardRecentActivity[];
	snapshotAt: number;
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, className)}>
			<CardHeader>
				<CardTitle>Recent Asset Activity</CardTitle>
				<CardDescription>Latest asset transactions and changes</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col gap-4">
						{data.map((entry) => (
							<div key={entry.id} className="flex items-start gap-3">
								<div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
									<IconPackage className="text-chart-3 size-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center justify-between gap-2">
										<p className="truncate text-sm font-medium">
											{entry.assetName}
										</p>
										<span className="text-muted-foreground shrink-0 text-xs">
											{formatRelativeDate(entry.createdAt, snapshotAt)}
										</span>
									</div>
									<p className="text-muted-foreground truncate text-xs">
										{entry.activity} · {entry.assetSeries}
									</p>
								</div>
							</div>
						))}
					</div>
				) : (
					<CenteredCardState
						icon={IconPackage}
						title="No recent asset activity"
						description="Asset operations will appear here as changes are recorded."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/asset/asset-sub-module/asset">
					View all assets →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}

// ── Insurance Expiry Tracker ──────────────────────────────────────────

function InsuranceExpiryTracker({
	className,
	data,
}: {
	className?: string;
	data: Asset.AssetDashboardInsuranceExpiry[];
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[17rem]", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconShield className="text-amber-500 size-4" />
					Insurance Expiry
				</CardTitle>
				<CardDescription>
					{data.length} polic{data.length === 1 ? "y" : "ies"} expiring within
					90 days
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col justify-center gap-3">
						{data.slice(0, 6).map((asset) => {
							const urgency = getInsuranceUrgency(asset.daysUntilExpiry);

							return (
								<div
									key={asset.assetId}
									className="flex items-center justify-between gap-3"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">
											{asset.assetName}
										</p>
										<p className="text-muted-foreground truncate text-xs">
											{asset.insurer} · {asset.policyNumber}
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
											{asset.daysUntilExpiry <= 0
												? "Expired"
												: `${asset.daysUntilExpiry}d left`}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<CenteredCardState
						icon={IconShield}
						title="No policies expiring soon"
						description="Insurance expiries within the next 90 days will appear here."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/asset/asset-sub-module/asset">
					View insured assets →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}

// ── Adjustment Summary Card ───────────────────────────────────────────

function AdjustmentSummaryCard({
	className,
	data,
}: {
	className?: string;
	data: Asset.AssetDashboardAdjustmentSummary[];
}) {
	const totalAdjustments = data.reduce((sum, item) => sum + item.count, 0);
	const totalAmount = data.reduce((sum, item) => sum + item.totalAmount, 0);

	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[17rem]", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<IconFileInvoice className="size-4" />
					Value Adjustments
				</CardTitle>
				<CardDescription>
					{totalAdjustments} adjustment{totalAdjustments === 1 ? "" : "s"} ·{" "}
					{formatCompactCurrency(totalAmount)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{data.length > 0 ? (
					<div className="flex flex-1 flex-col justify-center gap-4">
						{data.map((item) => {
							const percent =
								totalAdjustments > 0
									? Math.round((item.count / totalAdjustments) * 100)
									: 0;

							return (
								<div key={item.status}>
									<div className="mb-1 flex items-center justify-between">
										<span className="text-sm font-medium">
											{formatAdjustmentStatus(item.status)}
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
												backgroundColor: getAdjustmentStatusColor(item.status),
											}}
										/>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<CenteredCardState
						icon={IconFileInvoice}
						title="No value adjustments yet"
						description="Adjustment status will appear here once value adjustments are created."
					/>
				)}
			</CardContent>
			<CardFooter className="mt-auto">
				<FooterLink href="/asset/value-adjustment">
					View all adjustments →
				</FooterLink>
			</CardFooter>
		</Card>
	);
}
