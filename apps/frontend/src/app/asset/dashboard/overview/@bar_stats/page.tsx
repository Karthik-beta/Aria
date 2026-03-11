"use client";

import dynamic from "next/dynamic";

const AssetUtilizationChart = dynamic(
	() =>
		import("@/features/asset/components/asset-utilization-chart").then(
			(mod) => mod.AssetUtilizationChart,
		),
	{ ssr: false },
);

export default function BarStats() {
	return <AssetUtilizationChart />;
}
