import { RecentStockMovements } from "@/features/inventory/components/recent-stock-movements";

export default async function Page() {
	await new Promise((resolve) => setTimeout(resolve, 3000));
	return <RecentStockMovements />;
}
