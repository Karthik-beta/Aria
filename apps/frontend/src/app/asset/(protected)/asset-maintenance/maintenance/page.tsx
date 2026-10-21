/**
 * Asset Maintenance List Page
 *
 * Displays all asset maintenance records in a paginated, filterable table
 * with full CRUD operations. Supports real-time updates via tRPC WebSocket
 * subscription.
 *
 * Business logic mirrors ERPNext Asset Maintenance:
 * - One AssetMaintenance record per asset (unique per assetId).
 * - Each record has maintenance tasks with independent periodicity schedules.
 * - A record is considered OVERDUE when any of its tasks has an OVERDUE status.
 *
 * Client component: uses hooks for data fetching, pagination, and mutations.
 */
"use client";

import type { Asset } from "@aria/types";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Edit, MoreHorizontal, Plus, Settings, Trash } from "lucide-react";
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
import { useCanManageAssets } from "@/hooks/use-can-manage-assets";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	buildAssetMaintenanceListInput,
	formatMaintenanceStatus,
	getRelativeAge,
	MAINTENANCE_PAGE_SIZE,
} from "./asset-maintenance.utils";

type MaintenanceRow = Omit<
	Asset.AssetMaintenanceRecord,
	"createdAt" | "updatedAt"
> & {
	createdAt: Date;
	updatedAt: Date;
	tasks: Array<
		Omit<Asset.AssetMaintenanceTaskItem, "createdAt" | "updatedAt"> & {
			createdAt: Date;
			updatedAt: Date;
		}
	>;
};

type AssetMaintenancesChangedEvent = {
	type: "created" | "updated" | "deleted" | "log_completed";
	data: Asset.AssetMaintenanceRecord | { id: string };
};

function AssetMaintenancesRealtimeSubscription({
	onData,
}: {
	onData: (event: AssetMaintenancesChangedEvent) => void;
}) {
	trpc.asset.onAssetMaintenancesChanged.useSubscription(undefined, {
		onData,
	});
	return null;
}

function getOverallStatus(
	tasks: MaintenanceRow["tasks"],
): Asset.AssetMaintenanceStatus {
	if (tasks.some((t) => t.maintenanceStatus === "OVERDUE")) return "OVERDUE";
	if (tasks.every((t) => t.maintenanceStatus === "CANCELLED"))
		return "CANCELLED";
	return "PLANNED";
}

export default function AssetMaintenancePage() {
	const canManageAssets = useCanManageAssets();
	const utils = trpc.useUtils();

	const [search, setSearch] = React.useState("");
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: MAINTENANCE_PAGE_SIZE,
	});
	const [recordToDelete, setRecordToDelete] = React.useState<string | null>(
		null,
	);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	const deferredSearch = useDeferredValue(search);

	const resetToFirstPage = React.useCallback(() => {
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	const queryInput = React.useMemo(
		() =>
			buildAssetMaintenanceListInput({
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
	} = trpc.asset.listAssetMaintenances.useQuery(queryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const rawItems = data?.items ?? [];

	const skeletonRowKeys = React.useMemo(
		() => Array.from({ length: 8 }, () => crypto.randomUUID()),
		[],
	);
	const totalCount = data?.totalCount ?? 0;

	const records = React.useMemo<MaintenanceRow[]>(
		() =>
			rawItems.map((record) => ({
				...record,
				createdAt: new Date(record.createdAt),
				updatedAt: new Date(record.updatedAt),
				tasks: record.tasks.map((t) => ({
					...t,
					startDate: new Date(t.startDate),
					endDate: t.endDate ? new Date(t.endDate) : null,
					nextDueDate: t.nextDueDate ? new Date(t.nextDueDate) : null,
					lastCompletionDate: t.lastCompletionDate
						? new Date(t.lastCompletionDate)
						: null,
					createdAt: new Date(t.createdAt),
					updatedAt: new Date(t.updatedAt),
				})),
			})),
		[rawItems],
	);

	const handleSubscriptionData = React.useCallback(
		(_event: AssetMaintenancesChangedEvent) => {
			void utils.asset.listAssetMaintenances.invalidate();
		},
		[utils],
	);

	const deleteMutation = trpc.asset.deleteAssetMaintenance.useMutation({
		onMutate: async (vars) => {
			await utils.asset.listAssetMaintenances.cancel();
			const previous = utils.asset.listAssetMaintenances.getData(queryInput);
			utils.asset.listAssetMaintenances.setData(queryInput, (old) => {
				if (!old) return old;
				return {
					...old,
					items: old.items.filter((r) => r.id !== vars.id),
					totalCount: old.totalCount - 1,
				};
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Asset maintenance deleted successfully");
			setIsDeleteDialogOpen(false);
			setRecordToDelete(null);
		},
		onError: (err, _vars, ctx) => {
			if (ctx?.previous) {
				utils.asset.listAssetMaintenances.setData(queryInput, ctx.previous);
			}
			toast.error(getToastMessage(err, "delete"));
		},
		onSettled: () => {
			void utils.asset.listAssetMaintenances.invalidate(queryInput);
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (recordToDelete) {
			deleteMutation.mutate({ id: recordToDelete });
		}
	}, [recordToDelete, deleteMutation]);

	const handleDelete = React.useCallback((id: string) => {
		setRecordToDelete(id);
		setIsDeleteDialogOpen(true);
	}, []);

	const prevQueryErrorRef = React.useRef<unknown>(null);
	React.useEffect(() => {
		if (queryError && queryError !== prevQueryErrorRef.current) {
			prevQueryErrorRef.current = queryError;
			toast.error(getToastMessage(queryError, "load"));
		}
	}, [queryError]);

	const columns = React.useMemo<ColumnDef<MaintenanceRow>[]>(() => {
		const allColumns: ColumnDef<MaintenanceRow>[] = [
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
				accessorKey: "assetName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Asset" />
				),
				cell: ({ row }) =>
					canManageAssets ? (
						<Link
							href={`/asset/asset-maintenance/form?id=${row.original.id}`}
							className="font-medium text-primary hover:underline"
						>
							{row.original.assetName}
						</Link>
					) : (
						<span className="font-medium">{row.original.assetName}</span>
					),
				meta: {
					label: "Asset",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "company",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-foreground">
						{row.original.company}
					</span>
				),
				meta: {
					label: "Company",
					exportable: true,
				},
			},
			{
				accessorKey: "maintenanceTeamName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Maintenance Team" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-foreground">
						{row.original.maintenanceTeamName}
					</span>
				),
				meta: {
					label: "Maintenance Team",
					exportable: true,
				},
			},
			{
				id: "taskCount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Tasks" />
				),
				cell: ({ row }) => (
					<span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
						{row.original.tasks.length}
					</span>
				),
				meta: {
					label: "Tasks",
					exportable: false,
				},
			},
			{
				id: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => {
					const status = getOverallStatus(row.original.tasks);
					const statusStyles: Record<Asset.AssetMaintenanceStatus, string> = {
						PLANNED:
							"bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
						OVERDUE:
							"bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
						CANCELLED:
							"bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground",
					};
					return (
						<span
							className={cn(
								"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
								statusStyles[status],
							)}
						>
							{formatMaintenanceStatus(status)}
						</span>
					);
				},
				meta: {
					label: "Status",
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
								aria-label={`Open actions for ${row.original.assetName}`}
							>
								<span className="sr-only">
									Open actions for {row.original.assetName}
								</span>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link
									href={`/asset/asset-maintenance/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Maintenance
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => handleDelete(row.original.id)}
								className="text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Maintenance
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
			},
		];
		return canManageAssets
			? allColumns
			: allColumns.filter((column) => column.id !== "actions");
	}, [handleDelete, canManageAssets]);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

	const tableResetKey = `${deferredSearch}`;

	return (
		<>
			<AssetMaintenancesRealtimeSubscription onData={handleSubscriptionData} />

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setRecordToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>

			<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">
							Asset Maintenance
						</h1>
						<p className="text-muted-foreground">
							Manage maintenance schedules for your assets
						</p>
					</div>
				</div>

				{/* Filters */}
				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<Label className="text-xs text-muted-foreground">Search</Label>
						<Input
							placeholder="Search assets…"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								resetToFirstPage();
							}}
							className="h-8 w-56"
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
												<Skeleton className="h-4 w-24" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-20" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-24" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-12" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-16" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-8" />
											</th>
										</tr>
									</thead>
									<tbody>
										{skeletonRowKeys.map((key) => (
											<tr key={key} className="border-t">
												<td className="p-3">
													<Skeleton className="h-4 w-4" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-24" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-20" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-24" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-12" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-16" />
												</td>
												<td className="p-3">
													<Skeleton className="h-8 w-8" />
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
						<div className="flex items-center justify-between">
							<Skeleton className="h-4 w-32" />
							<div className="flex gap-2">
								<Skeleton className="h-8 w-20" />
								<Skeleton className="h-8 w-20" />
								<Skeleton className="h-8 w-20" />
							</div>
						</div>
					</div>
				)}

				{queryError && !isLoading && (
					<ErrorState
						error={queryError}
						operation="load"
						title="Failed to load asset maintenance records"
						onRetry={() =>
							void utils.asset.listAssetMaintenances.invalidate(queryInput)
						}
					/>
				)}

				{!isLoading && !queryError && (
					<AssetMaintenanceTable
						key={tableResetKey}
						data={records}
						columns={columns}
						pageCount={pageCount}
						totalCount={totalCount}
						onPaginationChange={setPagination}
						onReload={handleReload}
						search={search}
						canManageAssets={canManageAssets}
					/>
				)}
			</div>
		</>
	);
}

function AssetMaintenanceTable(props: {
	data: readonly MaintenanceRow[];
	columns: ColumnDef<MaintenanceRow, unknown>[];
	pageCount: number;
	totalCount: number;
	onPaginationChange: (pagination: PaginationState) => void;
	onReload: () => void | Promise<void>;
	search: string;
	canManageAssets: boolean;
}) {
	const { table } = useAdvancedDataTable<MaintenanceRow>({
		data: props.data,
		columns: props.columns,
		pageCount: props.pageCount,
		initialPageSize: MAINTENANCE_PAGE_SIZE,
		initialSorting: [{ id: "assetName", desc: false }],
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
			ariaLabel="Asset maintenance table"
			primaryAction={
				props.canManageAssets ? (
					<Link
						href="/asset/asset-maintenance/form"
						className={cn(buttonVariants({ variant: "default", size: "sm" }))}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Maintenance
					</Link>
				) : undefined
			}
			emptyState={
				<div className="flex flex-col items-center gap-2 py-12">
					<Settings className="h-10 w-10 text-muted-foreground/40" />
					<p className="text-sm text-muted-foreground">
						{props.search
							? "No records match your filters"
							: "No asset maintenance records yet"}
					</p>
					{props.canManageAssets && !props.search && (
						<Link
							href="/asset/asset-maintenance/form"
							className={cn(
								buttonVariants({
									variant: "outline",
									size: "sm",
								}),
								"mt-1",
							)}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add your first maintenance
						</Link>
					)}
				</div>
			}
		/>
	);
}
