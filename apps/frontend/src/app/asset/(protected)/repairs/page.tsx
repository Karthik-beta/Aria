"use client";

import type { Asset } from "@aria/types";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { AssetRepairDialog } from "@/components/asset/repair-form";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-display";
import { useAssetWriteAccess } from "@/hooks/use-asset-write-access";
import { invalidateAssetDomain } from "@/lib/asset-invalidation";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "../reports/fixed-asset-register/fixed-asset-register.utils";

/**
 * Asset Repairs Page
 * Displays asset breakdown repair history and capitalization status.
 */
export default function AssetRepairsPage() {
	const [dialogOpen, setDialogOpen] = React.useState(false);
	const canWrite = useAssetWriteAccess();
	const utils = trpc.useUtils();

	const { data, error, isLoading, refetch } =
		trpc.asset.listAssetRepairs.useQuery({});

	const submitMutation = trpc.asset.submitAssetRepair.useMutation({
		onSuccess: async () => {
			await invalidateAssetDomain(utils);
			await refetch();
		},
		onError: (mutationError) =>
			toast.error(getToastMessage(mutationError, "submit")),
	});

	const cancelMutation = trpc.asset.cancelAssetRepair.useMutation({
		onSuccess: async () => {
			await invalidateAssetDomain(utils);
			await refetch();
		},
		onError: (mutationError) =>
			toast.error(getToastMessage(mutationError, "cancel")),
	});

	const repairsList: Asset.AssetRepairItem[] = data?.items ?? [];

	const columns = React.useMemo<ColumnDef<Asset.AssetRepairItem>[]>(
		() => [
			{
				accessorKey: "series",
				header: "Repair Series",
				cell: ({ row }) => (
					<span className="font-mono font-medium">{row.original.series}</span>
				),
			},
			{
				accessorKey: "assetName",
				header: "Asset",
				cell: ({ row }) => row.original.assetName,
			},
			{
				accessorKey: "repairCost",
				header: "Repair Cost",
				cell: ({ row }) => (
					<span className="font-mono">
						{formatCurrency(row.original.repairCost)}
					</span>
				),
			},
			{
				accessorKey: "capitalizeRepairCost",
				header: "Capitalized",
				cell: ({ row }) => (
					<span className="text-xs font-medium">
						{row.original.capitalizeRepairCost ? "Yes" : "No"}
					</span>
				),
			},
			{
				accessorKey: "repairStatus",
				header: "Status",
				cell: ({ row }) => (
					<span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
						{row.original.repairStatus}
					</span>
				),
			},
			{
				id: "actions",
				header: "Actions",
				cell: ({ row }) => {
					const r = row.original;
					if (canWrite && r.repairStatus === "PENDING") {
						return (
							<Button
								size="sm"
								onClick={() => submitMutation.mutate({ id: r.id })}
								disabled={submitMutation.isPending}
							>
								Complete Repair
							</Button>
						);
					}
					if (canWrite && r.repairStatus === "COMPLETED") {
						return (
							<Button
								size="sm"
								variant="outline"
								onClick={() => cancelMutation.mutate({ id: r.id })}
								disabled={cancelMutation.isPending}
							>
								Cancel
							</Button>
						);
					}
					return null;
				},
			},
		],
		[canWrite, submitMutation, cancelMutation],
	);

	const { table } = useAdvancedDataTable<Asset.AssetRepairItem>({
		data: repairsList,
		columns,
		initialPageSize: 25,
		enableRowSelection: false,
	});

	return (
		<div className="flex flex-col gap-6 p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Asset Repairs</h1>
					<p className="text-sm text-muted-foreground">
						Track breakdown repairs, downtime, spare parts consumption, and cost
						capitalization.
					</p>
				</div>
				{canWrite && (
					<Button
						onClick={() => setDialogOpen(true)}
						className="flex items-center gap-2"
					>
						<Plus className="h-4 w-4" />
						Record Repair
					</Button>
				)}
			</div>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">Loading asset repairs…</p>
			) : error ? (
				<ErrorState
					operation="load"
					title="Failed to load asset repairs"
					error={error}
					onRetry={() => void refetch()}
				/>
			) : (
				<AdvancedDataTable
					table={table}
					data={repairsList}
					ariaLabel="Asset repairs table"
				/>
			)}

			{canWrite && (
				<AssetRepairDialog open={dialogOpen} onOpenChange={setDialogOpen} />
			)}
		</div>
	);
}
