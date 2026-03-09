import { CategoryDistributionChart } from "@/features/inventory/components/category-distribution-chart";

export default async function Stats() {
	await new Promise((resolve) => setTimeout(resolve, 1000));
	return <CategoryDistributionChart />;
}
