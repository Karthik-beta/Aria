"use client";

import dynamic from "next/dynamic";

const CategoryDistributionChart = dynamic(
	() =>
		import("@/features/inventory/components/category-distribution-chart").then(
			(mod) => mod.CategoryDistributionChart,
		),
	{ ssr: false },
);

export default function Stats() {
	return <CategoryDistributionChart />;
}
