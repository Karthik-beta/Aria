"use client";

import dynamic from "next/dynamic";

const StockTrendChart = dynamic(
	() =>
		import("@/features/inventory/components/stock-trend-chart").then(
			(mod) => mod.StockTrendChart,
		),
	{ ssr: false },
);

export default function AreaStats() {
	return <StockTrendChart />;
}
