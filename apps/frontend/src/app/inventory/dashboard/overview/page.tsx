import type { Inventory } from "@aria/types";
import { tryFetchServerTrpcQuery } from "@/lib/trpc/server";
import { InventoryOverviewClient } from "./overview-client";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
	const initialData = await tryFetchServerTrpcQuery<Inventory.DashboardData>(
		"inventory.getDashboardData",
	);
	const snapshotAt = Date.now();

	return (
		<InventoryOverviewClient
			initialData={initialData}
			snapshotAt={snapshotAt}
		/>
	);
}
