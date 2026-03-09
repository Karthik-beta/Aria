import { StockLevelChart } from "@/features/inventory/components/stock-level-chart";

export default async function Page() {
	await new Promise((resolve) => setTimeout(resolve, 3000));
	return <StockLevelChart />;
}
