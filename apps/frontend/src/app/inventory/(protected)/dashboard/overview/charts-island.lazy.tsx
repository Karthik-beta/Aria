"use client";

import dynamic from "next/dynamic";
import * as React from "react";
import type { InventoryOverviewChartsProps } from "./charts-island";
import { ChartTileSkeleton } from "./charts-shared";

const InventoryOverviewTopCharts = dynamic(
	() =>
		import("./charts-top").then((module) => module.InventoryOverviewTopCharts),
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

const InventoryOverviewBottomCharts = dynamic(
	() =>
		import("./charts-bottom").then(
			(module) => module.InventoryOverviewBottomCharts,
		),
	{
		ssr: false,
		loading: () => (
			<>
				<ChartTileSkeleton className="lg:col-span-4" />
				<ChartTileSkeleton className="lg:col-span-8" />
				<ChartTileSkeleton className="lg:col-span-4" />
			</>
		),
	},
);

export function InventoryOverviewChartsLazy({
	itemGroupDistribution,
	topChartsData,
	bottomChartsData,
	isTopChartsLoading = false,
	isBottomChartsLoading = false,
	hasTopChartsError = false,
	hasBottomChartsError = false,
	onRetryTopCharts,
	onRetryBottomCharts,
}: InventoryOverviewChartsProps) {
	const [showBottomCharts, setShowBottomCharts] = React.useState(false);

	React.useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			setShowBottomCharts(true);
		}, 300);

		return () => window.clearTimeout(timeoutId);
	}, []);

	return (
		<>
			<InventoryOverviewTopCharts
				data={topChartsData}
				hasError={hasTopChartsError}
				isLoading={isTopChartsLoading}
				onRetry={onRetryTopCharts}
			/>
			{showBottomCharts ? (
				<InventoryOverviewBottomCharts
					itemGroupDistribution={itemGroupDistribution}
					data={bottomChartsData}
					hasError={hasBottomChartsError}
					isLoading={isBottomChartsLoading}
					onRetry={onRetryBottomCharts}
				/>
			) : (
				<>
					<ChartTileSkeleton className="lg:col-span-4" />
					<ChartTileSkeleton className="lg:col-span-8" />
					<ChartTileSkeleton className="lg:col-span-4" />
				</>
			)}
		</>
	);
}
