import PageContainer from "@/components/layout/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const DASHBOARD_GRID_CLASS =
	"grid grid-cols-1 gap-4 md:grid-cols-2 lg:auto-rows-[minmax(12rem,auto)] lg:grid-cols-12 lg:grid-flow-row-dense";
const CARD_SURFACE_CLASS =
	"h-full border-border/70 bg-card/95 shadow-sm supports-[backdrop-filter]:backdrop-blur";

function KpiSkeleton({ className }: { className?: string }) {
	return (
		<Card
			className={`${CARD_SURFACE_CLASS} min-h-[9.75rem] ${className ?? ""}`}
		>
			<CardHeader>
				<Skeleton className="h-4 w-28" />
				<Skeleton className="mt-2 h-10 w-32" />
			</CardHeader>
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
		<Card
			className={`${CARD_SURFACE_CLASS} ${heightClassName} ${className ?? ""}`}
		>
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

export default function Loading() {
	return (
		<PageContainer>
			<div className="flex flex-1 flex-col gap-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-2">
						<Skeleton className="h-8 w-56" />
						<Skeleton className="h-4 w-80 max-w-full" />
					</div>
					<Skeleton className="h-9 w-24" />
				</div>

				<div className={DASHBOARD_GRID_CLASS}>
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
				</div>
			</div>
		</PageContainer>
	);
}
