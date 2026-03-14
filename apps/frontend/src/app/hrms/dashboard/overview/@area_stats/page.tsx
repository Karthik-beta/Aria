"use client";

import dynamic from "next/dynamic";

const LeaveTrendChart = dynamic(
	() =>
		import("@/features/hrms/components/leave-trend-chart").then(
			(mod) => mod.LeaveTrendChart,
		),
	{ ssr: false },
);

export default function AreaStats() {
	return <LeaveTrendChart />;
}
