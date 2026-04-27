"use client";

import dynamic from "next/dynamic";

const RevenueTrendChart = dynamic(
	() =>
		import("@/features/crm/components/revenue-trend-chart").then(
			(mod) => mod.RevenueTrendChart,
		),
	{ ssr: false },
);

export default function AreaStats() {
	return <RevenueTrendChart />;
}
