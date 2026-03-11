"use client";

import dynamic from "next/dynamic";

const StockLevelChart = dynamic(
	() =>
		import("@/features/inventory/components/stock-level-chart").then(
			(mod) => mod.StockLevelChart,
		),
	{ ssr: false },
);

export default function Page() {
	return <StockLevelChart />;
}
