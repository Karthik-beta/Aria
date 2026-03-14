"use client";

import dynamic from "next/dynamic";

const DepartmentDistributionChart = dynamic(
	() =>
		import("@/features/hrms/components/department-distribution-chart").then(
			(mod) => mod.DepartmentDistributionChart,
		),
	{ ssr: false },
);

export default function Stats() {
	return <DepartmentDistributionChart />;
}
