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
import { AssetMovementDialog } from "@/components/asset/movement-dialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-display";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { formatDateLabel } from "../reports/fixed-asset-register/fixed-asset-register.utils";

/**
 * Asset Movements Page
 * Displays asset movement transactions (Transfer, Receipt, Issue) and state submission/cancellation actions.
 */
export default function AssetMovementsPage() {
	const [dialogOpen, setDialogOpen] = React.useState(false);

	const { data, error, isLoading, refetch } =
		trpc.asset.listAssetMovements.useQuery({});

	const submitMutation = trpc.asset.submitAssetMovement.useMutation({
		onSuccess: () => void refetch(),
		onError: (mutationError) =>
			toast.error(getToastMessage(mutationError, "submit")),
	});

	const cancelMutation = trpc.asset.cancelAssetMovement.useMutation({
		onSuccess: () => void refetch(),
		onError: (mutationError) =>
			toast.error(getToastMessage(mutationError, "cancel")),
	});

	const movementsList: Asset.AssetMovement[] = data?.items ?? [];

	const columns = React.useMemo<ColumnDef<Asset.AssetMovement>[]>(
		() => [
			{
				accessorKey: "series",
				header: "Movement Series",
				cell: ({ row }) => (
					<span className="font-mono font-medium">{row.original.series}</span>
				),
			},
			{
				accessorKey: "purpose",
				header: "Purpose",
				cell: ({ row }) => (
					<span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium">
						{row.original.purpose}
					</span>
				),
			},
			{
				accessorKey: "company",
				header: "Company",
			},
			{
				accessorKey: "transactionDate",
				header: "Date",
				cell: ({ row }) => formatDateLabel(row.original.transactionDate),
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
					const m = row.original;
					if (m.status === "DRAFT") {
						return (
							<Button
								size="sm"
								onClick={() => submitMutation.mutate({ id: m.id })}
								disabled={submitMutation.isPending}
							>
								Submit
							</Button>
						);
					}
					if (m.status === "SUBMITTED") {
						return (
							<Button
								size="sm"
								variant="outline"
								onClick={() => cancelMutation.mutate({ id: m.id })}
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
		[submitMutation, cancelMutation],
	);

	const { table } = useAdvancedDataTable<Asset.AssetMovement>({
		data: movementsList,
		columns,
		initialPageSize: 25,
		enableRowSelection: false,
	});

	return (
		<div className="flex flex-col gap-6 p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Asset Movements</h1>
					<p className="text-sm text-muted-foreground">
						Track asset location transfers, custodian reassignments, issues, and
						receipts.
					</p>
				</div>
				<Button
					onClick={() => setDialogOpen(true)}
					className="flex items-center gap-2"
				>
					<Plus className="h-4 w-4" />
					New Movement
				</Button>
			</div>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">
					Loading asset movements…
				</p>
			) : error ? (
				<ErrorState
					operation="load"
					title="Failed to load asset movements"
					error={error}
					onRetry={() => void refetch()}
				/>
			) : (
				<AdvancedDataTable
					table={table}
					data={movementsList}
					ariaLabel="Asset movements table"
				/>
			)}

			<AssetMovementDialog open={dialogOpen} onOpenChange={setDialogOpen} />
		</div>
	);
}
