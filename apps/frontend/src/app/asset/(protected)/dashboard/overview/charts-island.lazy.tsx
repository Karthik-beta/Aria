"use client";

import dynamic from "next/dynamic";
import * as React from "react";
import type { AssetOverviewChartsProps } from "./charts-island";
import { ChartTileSkeleton } from "./charts-shared";

const AssetOverviewTopCharts = dynamic(
	() => import("./charts-top").then((module) => module.AssetOverviewTopCharts),
	{
		ssr: false,
		loading: () => (
			<>
				<ChartTileSkeleton className="lg:col-span-8" />
				<ChartTileSkeleton className="lg:col-span-4" />
			</>
		),
	},
);

const AssetOverviewBottomCharts = dynamic(
	() =>
		import("./charts-bottom").then(
			(module) => module.AssetOverviewBottomCharts,
		),
	{
		ssr: false,
		loading: () => (
			<>
				<ChartTileSkeleton className="lg:col-span-4" />
				<ChartTileSkeleton className="lg:col-span-8" />
			</>
		),
	},
);

export function AssetOverviewChartsLazy({
	topChartsData,
	bottomChartsData,
	isTopChartsLoading = false,
	isBottomChartsLoading = false,
	hasTopChartsError = false,
	hasBottomChartsError = false,
	onRetryTopCharts,
	onRetryBottomCharts,
}: AssetOverviewChartsProps) {
	const [showBottomCharts, setShowBottomCharts] = React.useState(false);

	React.useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			setShowBottomCharts(true);
		}, 300);

		return () => window.clearTimeout(timeoutId);
	}, []);

	return (
		<>
			<AssetOverviewTopCharts
				data={topChartsData}
				hasError={hasTopChartsError}
				isLoading={isTopChartsLoading}
				onRetry={onRetryTopCharts}
			/>
			{showBottomCharts ? (
				<AssetOverviewBottomCharts
					data={bottomChartsData}
					hasError={hasBottomChartsError}
					isLoading={isBottomChartsLoading}
					onRetry={onRetryBottomCharts}
				/>
			) : (
				<>
					<ChartTileSkeleton className="lg:col-span-4" />
					<ChartTileSkeleton className="lg:col-span-8" />
				</>
			)}
		</>
	);
}
