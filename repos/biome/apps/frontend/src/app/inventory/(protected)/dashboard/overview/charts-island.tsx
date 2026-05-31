"use client";

import type { Inventory } from "@aria/types";
import { InventoryOverviewBottomCharts } from "./charts-bottom";
import { InventoryOverviewTopCharts } from "./charts-top";

export interface InventoryOverviewChartsProps {
	itemGroupDistribution: Inventory.DashboardItemGroupDistribution[];
	topChartsData?: Inventory.DashboardTopChartsData;
	bottomChartsData?: Inventory.DashboardBottomChartsData;
	isTopChartsLoading?: boolean;
	isBottomChartsLoading?: boolean;
	hasTopChartsError?: boolean;
	hasBottomChartsError?: boolean;
	onRetryTopCharts?: () => void;
	onRetryBottomCharts?: () => void;
}

export function InventoryOverviewCharts({
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
	return (
		<>
			<InventoryOverviewTopCharts
				data={topChartsData}
				hasError={hasTopChartsError}
				isLoading={isTopChartsLoading}
				onRetry={onRetryTopCharts}
			/>
			<InventoryOverviewBottomCharts
				itemGroupDistribution={itemGroupDistribution}
				data={bottomChartsData}
				hasError={hasBottomChartsError}
				isLoading={isBottomChartsLoading}
				onRetry={onRetryBottomCharts}
			/>
		</>
	);
}
