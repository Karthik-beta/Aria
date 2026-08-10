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
import { AssetCapitalizationDialog } from "@/components/asset/capitalization-form";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-display";
import { useAssetWriteAccess } from "@/hooks/use-asset-write-access";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import {
	formatCurrency,
	formatDateLabel,
} from "../reports/fixed-asset-register/fixed-asset-register.utils";

/**
 * Asset Capitalizations Page
 * Displays composite asset capitalizations (CWIP to Fixed Asset).
 */
export default function AssetCapitalizationsPage() {
	const [dialogOpen, setDialogOpen] = React.useState(false);
	const canWrite = useAssetWriteAccess();

	const { data, error, isLoading, refetch } =
		trpc.asset.listAssetCapitalizations.useQuery({});

	const submitMutation = trpc.asset.submitAssetCapitalization.useMutation({
		onSuccess: () => void refetch(),
		onError: (mutationError) =>
			toast.error(getToastMessage(mutationError, "submit")),
	});

	const cancelMutation = trpc.asset.cancelAssetCapitalization.useMutation({
		onSuccess: () => void refetch(),
		onError: (mutationError) =>
			toast.error(getToastMessage(mutationError, "cancel")),
	});

	const capitalizationsList: Asset.AssetCapitalizationItem[] =
		data?.items ?? [];

	const columns = React.useMemo<ColumnDef<Asset.AssetCapitalizationItem>[]>(
		() => [
			{
				accessorKey: "series",
				header: "Series",
				cell: ({ row }) => (
					<span className="font-mono font-medium">{row.original.series}</span>
				),
			},
			{
				accessorKey: "targetType",
				header: "Type",
				cell: ({ row }) => (
					<span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium">
						{row.original.targetType}
					</span>
				),
			},
			{
				accessorKey: "totalValue",
				header: "Total Value",
				cell: ({ row }) => (
					<span className="font-mono font-bold">
						{formatCurrency(row.original.totalValue)}
					</span>
				),
			},
			{
				accessorKey: "postingDate",
				header: "Posting Date",
				cell: ({ row }) => formatDateLabel(row.original.postingDate),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => (
					<span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
						{row.original.status}
					</span>
				),
			},
			{
				id: "actions",
				header: "Actions",
				cell: ({ row }) => {
					const c = row.original;
					if (canWrite && c.status === "DRAFT") {
						return (
							<Button
								size="sm"
								onClick={() => submitMutation.mutate({ id: c.id })}
								disabled={submitMutation.isPending}
							>
								Submit
							</Button>
						);
					}
					if (canWrite && c.status === "SUBMITTED") {
						return (
							<Button
								size="sm"
								variant="outline"
								onClick={() => cancelMutation.mutate({ id: c.id })}
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

	const { table } = useAdvancedDataTable<Asset.AssetCapitalizationItem>({
		data: capitalizationsList,
		columns,
		initialPageSize: 25,
		enableRowSelection: false,
	});

	return (
		<div className="flex flex-col gap-6 p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">
						Asset Capitalizations
					</h1>
					<p className="text-sm text-muted-foreground">
						Capitalize CWIP stock items, service expenses, and consumed assets
						into fixed asset book value.
					</p>
				</div>
				{canWrite && (
					<Button
						onClick={() => setDialogOpen(true)}
						className="flex items-center gap-2"
					>
						<Plus className="h-4 w-4" />
						Capitalize Asset
					</Button>
				)}
			</div>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">
					Loading asset capitalizations…
				</p>
			) : error ? (
				<ErrorState
					operation="load"
					title="Failed to load asset capitalizations"
					error={error}
					onRetry={() => void refetch()}
				/>
			) : (
				<AdvancedDataTable
					table={table}
					data={capitalizationsList}
					ariaLabel="Asset capitalizations table"
				/>
			)}

			{canWrite && (
				<AssetCapitalizationDialog
					open={dialogOpen}
					onOpenChange={setDialogOpen}
				/>
			)}
		</div>
	);
}
