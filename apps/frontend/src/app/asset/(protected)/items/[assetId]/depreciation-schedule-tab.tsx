"use client";

import type { Asset } from "@aria/types";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

type DepreciationScheduleTabProps = {
	asset: Asset.AssetItem;
};

type ScheduleRow = {
	period: number;
	scheduleDate: string;
	depreciationAmount: number;
	accumulatedDepreciationAmount: number;
	valueAfterDepreciation: number;
	status: "SCHEDULED" | "POSTED" | "CANCELLED";
};

/**
 * Depreciation Schedule Breakdown Tab component for Asset Details view.
 */
export function AssetDepreciationScheduleTab({
	asset,
}: DepreciationScheduleTabProps) {
	const rows: ScheduleRow[] = React.useMemo(() => {
		if (!asset.totalNumberOfDepreciations || !asset.netPurchaseAmount)
			return [];
		const totalPeriods = asset.totalNumberOfDepreciations;
		const perPeriod =
			(asset.netPurchaseAmount - (asset.expectedValueAfterUsefulLife ?? 0)) /
			totalPeriods;

		let accum = asset.openingAccumulatedDepreciation ?? 0;
		let bookValue = asset.netPurchaseAmount - accum;

		const result: ScheduleRow[] = [];
		const startDate = asset.depreciationStartDate
			? new Date(asset.depreciationStartDate)
			: new Date();

		for (let i = 1; i <= totalPeriods; i++) {
			const date = new Date(startDate);
			date.setMonth(
				date.getMonth() + (i - 1) * (asset.frequencyOfDepreciation ?? 1),
			);

			const amount = Math.min(perPeriod, bookValue);
			accum += amount;
			bookValue -= amount;

			const isPosted = i <= (asset.openingNumberOfBookedDepreciations ?? 0);

			result.push({
				period: i,
				scheduleDate: date.toISOString().split("T")[0],
				depreciationAmount: amount,
				accumulatedDepreciationAmount: accum,
				valueAfterDepreciation: Math.max(bookValue, 0),
				status: isPosted ? "POSTED" : "SCHEDULED",
			});
		}

		return result;
	}, [asset]);

	const columns = React.useMemo<ColumnDef<ScheduleRow>[]>(
		() => [
			{
				accessorKey: "period",
				header: "Period",
				cell: ({ row }) => (
					<span className="font-mono">{row.original.period}</span>
				),
			},
			{
				accessorKey: "scheduleDate",
				header: "Schedule Date",
				cell: ({ row }) => row.original.scheduleDate,
			},
			{
				accessorKey: "depreciationAmount",
				header: "Depreciation Amount",
				cell: ({ row }) => (
					<span className="font-mono">
						INR {row.original.depreciationAmount.toFixed(2)}
					</span>
				),
			},
			{
				accessorKey: "accumulatedDepreciationAmount",
				header: "Accumulated Depreciation",
				cell: ({ row }) => (
					<span className="font-mono">
						INR {row.original.accumulatedDepreciationAmount.toFixed(2)}
					</span>
				),
			},
			{
				accessorKey: "valueAfterDepreciation",
				header: "Carrying Book Value",
				cell: ({ row }) => (
					<span className="font-mono font-semibold">
						INR {row.original.valueAfterDepreciation.toFixed(2)}
					</span>
				),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => (
					<span
						className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
							row.original.status === "POSTED"
								? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
								: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
						}`}
					>
						{row.original.status}
					</span>
				),
			},
		],
		[],
	);

	const { table } = useAdvancedDataTable<ScheduleRow>({
		data: rows,
		columns,
		initialPageSize: 25,
		enableRowSelection: false,
	});

	return (
		<Card className="mt-4">
			<CardHeader>
				<CardTitle className="text-base font-semibold">
					Depreciation Schedule Breakdown
				</CardTitle>
				<CardDescription>
					Posted versus scheduled periodic depreciation entries across asset
					useful life.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<AdvancedDataTable
					table={table}
					data={rows}
					ariaLabel="Depreciation schedule table"
				/>
			</CardContent>
		</Card>
	);
}
