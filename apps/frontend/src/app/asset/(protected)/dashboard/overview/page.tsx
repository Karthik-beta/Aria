import type { Asset } from "@aria/types";
import { tryFetchServerTrpcQuery } from "@/lib/trpc/server";
import { AssetOverviewClient } from "./overview-client";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
	const initialData =
		await tryFetchServerTrpcQuery<Asset.AssetDashboardOverviewData>(
			"asset.getDashboardOverviewData",
		);
	const snapshotAt = Date.now();

	return (
		<AssetOverviewClient initialData={initialData} snapshotAt={snapshotAt} />
	);
}
