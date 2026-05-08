"use client";

import type { Asset } from "@aria/types";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import {
	Edit,
	MoreHorizontal,
	Plus,
	RotateCcw,
	Scale,
	Send,
	Trash,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDeferredValue } from "react";
import { toast } from "sonner";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { AlertModal } from "@/components/modal/alert-modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	ASSET_VALUE_ADJUSTMENT_PAGE_SIZE,
	buildAssetValueAdjustmentListInput,
	formatAdjustmentDirection,
	formatAdjustmentStatus,
	formatCurrency,
	formatDate,
	getAdjustmentStatusClassName,
	getDirectionClassName,
	getRelativeAge,
} from "./value-adjustment.utils";

type AdjustmentRow = Omit<
	Asset.AssetValueAdjustmentItem,
	| "adjustmentDate"
	| "submittedAt"
	| "cancelledAt"
	| "createdAt"
	| "updatedAt"
	| "revaluationEntry"
	| "depreciationSchedule"
> & {
	adjustmentDate: Date;
	submittedAt: Date | null;
	cancelledAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	revaluationEntry: Asset.AssetRevaluationEntry | null;
	depreciationSchedule: Asset.AssetDepreciationSchedule | null;
};

type AssetValueAdjustmentsChangedEvent = {
	type: "created" | "updated" | "submitted" | "cancelled" | "deleted";
	data: Asset.AssetValueAdjustmentItem | { id: string };
};

type PendingAction = {
	type: "delete" | "cancel";
	id: string;
} | null;

function AssetValueAdjustmentsRealtimeSubscription({
	onData,
}: {
	onData: (event: AssetValueAdjustmentsChangedEvent) => void;
}) {
	trpc.asset.onAssetValueAdjustmentsChanged.useSubscription(undefined, {
		onData,
	});
	return null;
}

export default function AssetValueAdjustmentPage() {
	const utils = trpc.useUtils();
	const [search, setSearch] = React.useState("");
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: ASSET_VALUE_ADJUSTMENT_PAGE_SIZE,
	});
	const [pendingAction, setPendingAction] = React.useState<PendingAction>(null);

	const deferredSearch = useDeferredValue(search);

	const resetToFirstPage = React.useCallback(() => {
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	const queryInput = React.useMemo(
		() =>
			buildAssetValueAdjustmentListInput({
				search: deferredSearch,
				pageIndex: pagination.pageIndex,
				pageSize: pagination.pageSize,
			}),
		[deferredSearch, pagination],
	);

	const {
		data,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.asset.listAssetValueAdjustments.useQuery(queryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const deleteMutation = trpc.asset.deleteAssetValueAdjustment.useMutation({
		onSuccess: async () => {
			toast.success("Asset value adjustment deleted successfully");
			setPendingAction(null);
			await utils.asset.listAssetValueAdjustments.invalidate(queryInput);
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "delete"));
		},
	});

	const cancelMutation = trpc.asset.cancelAssetValueAdjustment.useMutation({
		onSuccess: async () => {
			toast.success("Asset value adjustment cancelled successfully");
			setPendingAction(null);
			await Promise.all([
				utils.asset.listAssetValueAdjustments.invalidate(queryInput),
				utils.asset.listAssets.invalidate(),
			]);
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "cancel"));
		},
	});

	const submitMutation = trpc.asset.submitAssetValueAdjustment.useMutation({
		onSuccess: async () => {
			toast.success("Asset value adjustment submitted successfully");
			await Promise.all([
				utils.asset.listAssetValueAdjustments.invalidate(queryInput),
				utils.asset.listAssets.invalidate(),
			]);
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "submit"));
		},
	});

	const rawItems = data?.items ?? [];
	const totalCount = data?.totalCount ?? 0;

	const adjustments = React.useMemo<AdjustmentRow[]>(
		() =>
			rawItems.map((item) => ({
				...item,
				adjustmentDate: new Date(item.adjustmentDate),
				submittedAt: item.submittedAt ? new Date(item.submittedAt) : null,
				cancelledAt: item.cancelledAt ? new Date(item.cancelledAt) : null,
				createdAt: new Date(item.createdAt),
				updatedAt: new Date(item.updatedAt),
				revaluationEntry: item.revaluationEntry
					? {
							...item.revaluationEntry,
							postingDate: new Date(item.revaluationEntry.postingDate),
							reversedAt: item.revaluationEntry.reversedAt
								? new Date(item.revaluationEntry.reversedAt)
								: null,
							createdAt: new Date(item.revaluationEntry.createdAt),
							updatedAt: new Date(item.revaluationEntry.updatedAt),
							lines: item.revaluationEntry.lines.map((line) => ({
								...line,
								createdAt: new Date(line.createdAt),
								updatedAt: new Date(line.updatedAt),
							})),
						}
					: null,
				depreciationSchedule: item.depreciationSchedule
					? {
							...item.depreciationSchedule,
							startDate: new Date(item.depreciationSchedule.startDate),
							createdAt: new Date(item.depreciationSchedule.createdAt),
							updatedAt: new Date(item.depreciationSchedule.updatedAt),
							entries: item.depreciationSchedule.entries.map((entry) => ({
								...entry,
								scheduleDate: new Date(entry.scheduleDate),
								createdAt: new Date(entry.createdAt),
								updatedAt: new Date(entry.updatedAt),
							})),
						}
					: null,
			})),
		[rawItems],
	);

	const handleSubscriptionData = React.useCallback(
		(_event: AssetValueAdjustmentsChangedEvent) => {
			void utils.asset.listAssetValueAdjustments.invalidate();
		},
		[utils],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const handleConfirmAction = React.useCallback(() => {
		if (!pendingAction) {
			return;
		}

		if (pendingAction.type === "delete") {
			deleteMutation.mutate({ id: pendingAction.id });
			return;
		}

		cancelMutation.mutate({ id: pendingAction.id });
	}, [cancelMutation, deleteMutation, pendingAction]);

	const prevQueryErrorRef = React.useRef<unknown>(null);
	React.useEffect(() => {
		if (queryError && queryError !== prevQueryErrorRef.current) {
			prevQueryErrorRef.current = queryError;
			toast.error(getToastMessage(queryError, "load"));
		}
	}, [queryError]);

	const columns = React.useMemo<ColumnDef<AdjustmentRow>[]>(
		() => [
			{
				id: "select",
				header: ({ table }) => (
					<Checkbox
						checked={
							table.getIsAllPageRowsSelected() ||
							(table.getIsSomePageRowsSelected() ? "indeterminate" : false)
						}
						onCheckedChange={(value) =>
							table.toggleAllPageRowsSelected(!!value)
						}
						aria-label="Select all"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(!!value)}
						aria-label="Select row"
					/>
				),
				size: 40,
				enableSorting: false,
			},
			{
				accessorKey: "series",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Adjustment" />
				),
				cell: ({ row }) => (
					<Link
						href={`/asset/asset-maintenance/value-adjustment/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.series}
					</Link>
				),
				meta: {
					label: "Adjustment",
					searchable: true,
					exportable: true,
				},
			},
			{
				id: "asset",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Asset" />
				),
				cell: ({ row }) => (
					<div className="flex flex-col">
						<span className="font-medium text-foreground">
							{row.original.assetName}
						</span>
						<span className="text-xs text-muted-foreground">
							{row.original.assetSeries}
						</span>
					</div>
				),
				meta: {
					label: "Asset",
					exportable: true,
				},
			},
			{
				accessorKey: "company",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company" />
				),
				cell: ({ row }) => row.original.company,
				meta: {
					label: "Company",
					exportable: true,
				},
			},
			{
				accessorKey: "adjustmentDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Adjustment Date" />
				),
				cell: ({ row }) => formatDate(row.original.adjustmentDate),
				meta: {
					label: "Adjustment Date",
					exportable: true,
				},
			},
			{
				id: "values",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Carrying Value" />
				),
				cell: ({ row }) => (
					<div className="flex flex-col text-sm">
						<span>{formatCurrency(row.original.currentAssetValue)}</span>
						<span className="text-xs text-muted-foreground">
							to {formatCurrency(row.original.newAssetValue)}
						</span>
					</div>
				),
				meta: {
					label: "Carrying Value",
					exportable: true,
				},
			},
			{
				accessorKey: "differenceAmount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Difference" />
				),
				cell: ({ row }) =>
					formatCurrency(Math.abs(row.original.differenceAmount)),
				meta: {
					label: "Difference",
					exportable: true,
				},
			},
			{
				accessorKey: "direction",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Direction" />
				),
				cell: ({ row }) => (
					<span
						className={cn(
							"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
							getDirectionClassName(row.original.direction),
						)}
					>
						{formatAdjustmentDirection(row.original.direction)}
					</span>
				),
				meta: {
					label: "Direction",
					exportable: true,
				},
			},
			{
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => (
					<span
						className={cn(
							"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
							getAdjustmentStatusClassName(row.original.status),
						)}
					>
						{formatAdjustmentStatus(row.original.status)}
					</span>
				),
				meta: {
					label: "Status",
					exportable: true,
				},
			},
			{
				id: "journalEntry",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Revaluation Entry" />
				),
				cell: ({ row }) =>
					row.original.revaluationEntry?.series ? (
						<span className="text-sm text-foreground">
							{row.original.revaluationEntry.series}
						</span>
					) : (
						<span className="text-sm text-muted-foreground">Pending</span>
					),
				meta: {
					label: "Revaluation Entry",
					exportable: true,
				},
			},
			{
				id: "age",
				header: () => null,
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{getRelativeAge(row.original.createdAt)}
					</span>
				),
				size: 50,
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="h-8 w-8 p-0"
								aria-label={`Open actions for ${row.original.series}`}
							>
								<span className="sr-only">
									Open actions for {row.original.series}
								</span>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link
									href={`/asset/asset-maintenance/value-adjustment/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									{row.original.status === "DRAFT"
										? "Edit Draft"
										: "View Adjustment"}
								</Link>
							</DropdownMenuItem>
							{row.original.status === "DRAFT" && (
								<DropdownMenuItem
									onClick={() => submitMutation.mutate({ id: row.original.id })}
								>
									<Send className="mr-2 h-4 w-4" />
									Submit Adjustment
								</DropdownMenuItem>
							)}
							{row.original.status === "SUBMITTED" && (
								<DropdownMenuItem
									onClick={() =>
										setPendingAction({ type: "cancel", id: row.original.id })
									}
									className="text-amber-700"
								>
									<RotateCcw className="mr-2 h-4 w-4" />
									Cancel Adjustment
								</DropdownMenuItem>
							)}
							{row.original.status === "DRAFT" && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() =>
											setPendingAction({ type: "delete", id: row.original.id })
										}
										className="text-destructive"
									>
										<Trash className="mr-2 h-4 w-4" />
										Delete Draft
									</DropdownMenuItem>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
			},
		],
		[submitMutation],
	);

	const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));
	const tableResetKey = `${deferredSearch}`;
	const isDialogLoading = deleteMutation.isPending || cancelMutation.isPending;

	return (
		<>
			<AssetValueAdjustmentsRealtimeSubscription
				onData={handleSubscriptionData}
			/>

			<AlertModal
				isOpen={pendingAction !== null}
				onClose={() => setPendingAction(null)}
				onConfirm={handleConfirmAction}
				loading={isDialogLoading}
			/>

			<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">
							Asset Value Adjustment
						</h1>
						<p className="text-muted-foreground">
							Adjust carrying values, generate revaluation entries, and
							reschedule depreciation.
						</p>
					</div>
				</div>

				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<Label className="text-xs text-muted-foreground">Search</Label>
						<Input
							placeholder="Search adjustments…"
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								resetToFirstPage();
							}}
							className="h-8 w-64"
						/>
					</div>
				</div>

				{isLoading && (
					<div className="flex flex-1 flex-col gap-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								<Skeleton className="h-4 w-48" />
								<Skeleton className="h-4 w-32" />
							</div>
							<div className="flex gap-2">
								<Skeleton className="h-10 w-24" />
								<Skeleton className="h-10 w-32" />
							</div>
						</div>
						<Skeleton className="h-10 w-full" />
						<div className="rounded-lg border bg-background">
							<div className="w-full overflow-auto">
								<table className="w-full">
									<thead className="bg-muted/95">
										<tr>
											<th className="p-3">
												<Skeleton className="h-4 w-4" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-20" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-32" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-20" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-24" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-24" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-16" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-16" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-20" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-24" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-8" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-8" />
											</th>
										</tr>
									</thead>
									<tbody>
										{Array.from({ length: 8 }).map((_, i) => (
											<tr key={i} className="border-t">
												<td className="p-3">
													<Skeleton className="h-4 w-4" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-20" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-32" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-20" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-24" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-24" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-16" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-16" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-20" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-24" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-8" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-8" />
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
						<div className="flex items-center justify-between">
							<Skeleton className="h-7 w-40" />
							<div className="flex items-center gap-4">
								<Skeleton className="h-7 w-24" />
								<Skeleton className="h-7 w-[4.5rem]" />
								<Skeleton className="h-7 w-20" />
								<div className="flex gap-2">
									<Skeleton className="size-7" />
									<Skeleton className="size-7" />
									<Skeleton className="size-7" />
								</div>
							</div>
						</div>
					</div>
				)}

				{queryError && !isLoading && (
					<ErrorState
						error={queryError}
						operation="load"
						title="Failed to load asset value adjustments"
						onRetry={() =>
							void utils.asset.listAssetValueAdjustments.invalidate(queryInput)
						}
					/>
				)}

				{!isLoading && !queryError && (
					<AssetValueAdjustmentTable
						key={tableResetKey}
						data={adjustments}
						columns={columns}
						pageCount={pageCount}
						totalCount={totalCount}
						onPaginationChange={setPagination}
						onReload={handleReload}
						search={search}
					/>
				)}
			</div>
		</>
	);
}

function AssetValueAdjustmentTable(props: {
	data: readonly AdjustmentRow[];
	columns: ColumnDef<AdjustmentRow, unknown>[];
	pageCount: number;
	totalCount: number;
	onPaginationChange: (pagination: PaginationState) => void;
	onReload: () => void | Promise<void>;
	search: string;
}) {
	const { table } = useAdvancedDataTable<AdjustmentRow>({
		data: props.data,
		columns: props.columns,
		pageCount: props.pageCount,
		initialPageSize: ASSET_VALUE_ADJUSTMENT_PAGE_SIZE,
		initialSorting: [{ id: "adjustmentDate", desc: true }],
		enableRowSelection: true,
		enableMultiRowSelection: true,
		enableGlobalFilter: false,
		onPaginationChange: props.onPaginationChange,
		onReload: props.onReload,
	});

	return (
		<AdvancedDataTable
			table={table}
			data={props.data}
			totalItems={props.totalCount}
			enableGlobalSearch={false}
			enableExport
			enableBulkActions
			enableVirtualization
			enableColumnResizing
			ariaLabel="Asset value adjustment table"
			primaryAction={
				<Link
					href="/asset/asset-maintenance/value-adjustment/form"
					className={cn(buttonVariants({ variant: "default", size: "sm" }))}
				>
					<Plus className="mr-2 h-4 w-4" />
					New Adjustment
				</Link>
			}
			emptyState={
				<div className="flex flex-col items-center gap-2 py-12">
					<Scale className="h-10 w-10 text-muted-foreground/40" />
					<p className="text-sm text-muted-foreground">
						{props.search
							? "No adjustments match your filters"
							: "No asset value adjustments yet"}
					</p>
					{!props.search && (
						<Link
							href="/asset/asset-maintenance/value-adjustment/form"
							className={cn(
								buttonVariants({
									variant: "outline",
									size: "sm",
								}),
								"mt-1",
							)}
						>
							<Plus className="mr-2 h-4 w-4" />
							Create your first adjustment
						</Link>
					)}
				</div>
			}
		/>
	);
}
