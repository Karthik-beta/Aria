"use client";

import type { Asset } from "@aria/types";
import { AssetOverviewBottomCharts } from "./charts-bottom";
import { AssetOverviewTopCharts } from "./charts-top";

export interface AssetOverviewChartsProps {
	topChartsData?: Asset.AssetDashboardTopChartsData;
	bottomChartsData?: Asset.AssetDashboardBottomChartsData;
	isTopChartsLoading?: boolean;
	isBottomChartsLoading?: boolean;
	hasTopChartsError?: boolean;
	hasBottomChartsError?: boolean;
	onRetryTopCharts?: () => void;
	onRetryBottomCharts?: () => void;
}

export function AssetOverviewCharts({
	topChartsData,
	bottomChartsData,
	isTopChartsLoading = false,
	isBottomChartsLoading = false,
	hasTopChartsError = false,
	hasBottomChartsError = false,
	onRetryTopCharts,
	onRetryBottomCharts,
}: AssetOverviewChartsProps) {
	return (
		<>
			<AssetOverviewTopCharts
				data={topChartsData}
				hasError={hasTopChartsError}
				isLoading={isTopChartsLoading}
				onRetry={onRetryTopCharts}
			/>
			<AssetOverviewBottomCharts
				data={bottomChartsData}
				hasError={hasBottomChartsError}
				isLoading={isBottomChartsLoading}
				onRetry={onRetryBottomCharts}
			/>
		</>
	);
}
