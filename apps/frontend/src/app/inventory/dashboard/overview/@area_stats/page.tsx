import { StockTrendChart } from "@/features/inventory/components/stock-trend-chart";

export default async function AreaStats() {
	await new Promise((resolve) => setTimeout(resolve, 2000));
	return <StockTrendChart />;
}
