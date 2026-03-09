import { AssetCategoryChart } from "@/features/asset/components/asset-category-chart";

export default async function Stats() {
	await new Promise((resolve) => setTimeout(resolve, 1000));
	return <AssetCategoryChart />;
}
