import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const SALES_SKELETON_KEYS = [
	"sale-1",
	"sale-2",
	"sale-3",
	"sale-4",
	"sale-5",
] as const;

export function RecentSalesSkeleton() {
	return (
		<Card className="h-full">
			<CardHeader>
				<Skeleton className="h-6 w-[140px]" /> {/* CardTitle */}
				<Skeleton className="h-4 w-[180px]" /> {/* CardDescription */}
			</CardHeader>
			<CardContent>
				<div className="space-y-8">
					{SALES_SKELETON_KEYS.map((saleKey) => (
						<div key={saleKey} className="flex items-center">
							<Skeleton className="h-9 w-9 rounded-full" /> {/* Avatar */}
							<div className="ml-4 space-y-1">
								<Skeleton className="h-4 w-[120px]" /> {/* Name */}
								<Skeleton className="h-4 w-[160px]" /> {/* Email */}
							</div>
							<Skeleton className="ml-auto h-4 w-[80px]" /> {/* Amount */}
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
