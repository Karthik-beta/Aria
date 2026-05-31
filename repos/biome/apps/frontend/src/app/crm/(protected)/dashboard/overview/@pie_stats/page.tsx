"use client";

import dynamic from "next/dynamic";

const LeadSourceChart = dynamic(
	() =>
		import("@/features/crm/components/lead-source-chart").then(
			(mod) => mod.LeadSourceChart,
		),
	{ ssr: false },
);

export default function Stats() {
	return <LeadSourceChart />;
}
