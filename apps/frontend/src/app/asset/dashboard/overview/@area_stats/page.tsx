"use client";

import dynamic from "next/dynamic";

const DepreciationTrendChart = dynamic(
	() =>
		import("@/features/asset/components/depreciation-trend-chart").then(
			(mod) => mod.DepreciationTrendChart,
		),
	{ ssr: false },
);

export default function AreaStats() {
	return <DepreciationTrendChart />;
}
