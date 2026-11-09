"use client";

import { Suspense } from "react";
import { AppUserManagement } from "@/components/auth/app-user-management";
import { Skeleton } from "@/components/ui/skeleton";

export default function InventoryUsersPage() {
	return (
		<Suspense
			fallback={
				<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
					<div className="space-y-2">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-64" />
					</div>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Skeleton className="h-4 w-4" />
								<Skeleton className="h-5 w-40" />
							</div>
							<Skeleton className="h-9 w-32" />
						</div>
						<Skeleton className="h-64 w-full rounded-md border" />
					</div>
				</div>
			}
		>
			<AppUserManagement
				orgSlug="inventory"
				appName="Inventory"
				appRoute="/inventory/dashboard/overview"
			/>
		</Suspense>
	);
}
