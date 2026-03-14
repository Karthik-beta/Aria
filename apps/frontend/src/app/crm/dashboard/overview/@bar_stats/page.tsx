"use client";

import dynamic from "next/dynamic";

const SalesPipelineChart = dynamic(
	() =>
		import("@/features/crm/components/sales-pipeline-chart").then(
			(mod) => mod.SalesPipelineChart,
		),
	{ ssr: false },
);

export default function BarStats() {
	return <SalesPipelineChart />;
}
