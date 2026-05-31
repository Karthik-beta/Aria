import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CARD_SURFACE_CLASS =
	"h-full border-border/70 bg-card/95 shadow-sm supports-[backdrop-filter]:backdrop-blur";

function hasSeriesData<T extends object>(data: T[], keys: Array<keyof T>) {
	return data.some((row) =>
		keys.some((key) => {
			const value = (row as Record<PropertyKey, unknown>)[key as PropertyKey];
			return Math.abs(Number(value ?? 0)) > 0;
		}),
	);
}

function truncateLabel(label: string, maxLength: number) {
	return label.length > maxLength
		? `${label.slice(0, Math.max(maxLength - 1, 1))}…`
		: label;
}

function CartesianChartEmptyState({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="border-border/60 bg-muted/20 flex h-full min-h-[15rem] flex-col justify-between rounded-xl border border-dashed p-4">
			<div className="relative h-28 overflow-hidden rounded-lg bg-background/80">
				<div className="absolute inset-0 grid grid-rows-4">
					{["grid-1", "grid-2", "grid-3", "grid-4"].map((line) => (
						<div
							key={line}
							className="border-border/50 border-b last:border-b-0"
						/>
					))}
				</div>
				<div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
					{["h-10", "h-14", "h-8", "h-16", "h-12", "h-9"].map((height) => (
						<div
							key={height}
							className={cn(
								"from-muted-foreground/20 to-muted-foreground/5 w-full rounded-t-md bg-gradient-to-t",
								height,
							)}
						/>
					))}
				</div>
			</div>
			<div className="space-y-1 pt-4 text-center">
				<p className="text-sm font-medium">{title}</p>
				<p className="text-muted-foreground text-xs">{description}</p>
			</div>
		</div>
	);
}

function DonutChartEmptyState({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="border-border/60 bg-muted/20 flex h-full min-h-[15rem] flex-col items-center justify-center gap-5 rounded-xl border border-dashed p-4">
			<div className="relative flex size-40 items-center justify-center rounded-full border-[18px] border-muted-foreground/10">
				<div className="flex size-20 items-center justify-center rounded-full border border-border/70 bg-background/90">
					<span className="text-muted-foreground text-xs font-medium">
						No data
					</span>
				</div>
				<div className="absolute inset-0 rotate-[-32deg] rounded-full border-t-[18px] border-t-muted-foreground/20" />
			</div>
			<div className="space-y-1 text-center">
				<p className="text-sm font-medium">{title}</p>
				<p className="text-muted-foreground max-w-xs text-xs">{description}</p>
			</div>
		</div>
	);
}

function ChartTileSkeleton({
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

function ChartLoadErrorCard({
	className,
	title,
	description,
	onRetry,
}: {
	className?: string;
	title: string;
	description: string;
	onRetry?: () => void;
}) {
	return (
		<Card className={cn(CARD_SURFACE_CLASS, "min-h-[18rem]", className)}>
			<CardContent className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
				<IconAlertTriangle className="text-destructive size-8" />
				<div className="space-y-1">
					<p className="text-sm font-medium">{title}</p>
					<p className="text-muted-foreground text-xs">{description}</p>
				</div>
				{onRetry ? (
					<Button variant="outline" size="sm" onClick={onRetry}>
						<IconRefresh className="mr-2 size-4" />
						Retry
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}

export {
	CARD_SURFACE_CLASS,
	CartesianChartEmptyState,
	ChartLoadErrorCard,
	ChartTileSkeleton,
	DonutChartEmptyState,
	hasSeriesData,
	truncateLabel,
};
