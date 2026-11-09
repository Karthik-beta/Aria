"use client";

import dynamic from "next/dynamic";

const AttendanceChart = dynamic(
	() =>
		import("@/features/hrms/components/attendance-chart").then(
			(mod) => mod.AttendanceChart,
		),
	{ ssr: false },
);

export default function BarStats() {
	return <AttendanceChart />;
}
