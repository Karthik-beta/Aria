"use client";

import dynamic from "next/dynamic";

const AssetCategoryChart = dynamic(
	() =>
		import("@/features/asset/components/asset-category-chart").then(
			(mod) => mod.AssetCategoryChart,
		),
	{ ssr: false },
);

export default function Stats() {
	return <AssetCategoryChart />;
}
