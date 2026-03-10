import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const BAR_SKELETON_KEYS = [
	"bar-1",
	"bar-2",
	"bar-3",
	"bar-4",
	"bar-5",
	"bar-6",
	"bar-7",
	"bar-8",
	"bar-9",
	"bar-10",
	"bar-11",
	"bar-12",
] as const;

export function BarGraphSkeleton() {
	return (
		<Card>
			<CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
				<div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
					<Skeleton className="h-6 w-[180px]" />
					<Skeleton className="h-4 w-[250px]" />
				</div>
				<div className="flex">
					{[1, 2].map((i) => (
						<div
							key={i}
							className="relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
						>
							<Skeleton className="h-3 w-[80px]" />
							<Skeleton className="h-8 w-[100px] sm:h-10" />
						</div>
					))}
				</div>
			</CardHeader>
			<CardContent className="px-2 sm:p-6">
				{/* Bar-like shapes */}
				<div className="flex aspect-auto h-[280px] w-full items-end justify-around gap-2 pt-8">
					{BAR_SKELETON_KEYS.map((barKey) => (
						<Skeleton
							key={barKey}
							className="w-full"
							style={{
								height: `${Math.max(20, Math.random() * 100)}%`,
							}}
						/>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
