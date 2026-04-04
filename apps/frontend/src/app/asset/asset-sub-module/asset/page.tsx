/**
 * Asset Management - Asset List Page
 * Enterprise-grade table with full CRUD operations using tRPC + Advanced Data Table
 *
 * Navigation Pattern: Uses Next.js Link components for navigation (no router.push memory leaks)
 * CRUD Pattern: Quick-create dialog for common asset entry, full page form for deeper flows,
 * inline delete with confirmation
 */

"use client";

import type { Asset } from "@aria/types";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
	CheckCircle2,
	Edit,
	Eye,
	MoreHorizontal,
	Package,
	Trash,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import {
	AdvancedDataTable,
	type BulkAction,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { AlertModal } from "@/components/modal/alert-modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-display";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { NewAssetDialog } from "@/features/asset/components/new-asset-dialog";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

type AssetSubscriptionEvent = {
	type: "created" | "updated" | "deleted";
	data: Asset.AssetItem | { id: string };
};

function AssetRealtimeSubscription({
	onStarted,
	onData,
	onError,
}: {
	onStarted?: () => void;
	onData?: (event: AssetSubscriptionEvent) => void;
	onError?: (err: unknown) => void;
}) {
	trpc.asset.onAssetsChanged.useSubscription(undefined, {
		onStarted,
		onData,
		onError,
	});

	return null;
}

function formatStatus(status: string): string {
	return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AssetListPage() {
	const utils = trpc.useUtils();

	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [assetToDelete, setAssetToDelete] = React.useState<string | null>(null);

	const handleDeleteRef = React.useRef<(id: string) => void>(() => {});
	handleDeleteRef.current = (id: string) => {
		setAssetToDelete(id);
		setIsDeleteDialogOpen(true);
	};

	const handleDelete = React.useCallback((id: string) => {
		handleDeleteRef.current?.(id);
	}, []);

	const {
		data: rawData,
		isLoading,
		error: queryError,
	} = trpc.asset.listAssets.useQuery(undefined, {
		refetchOnWindowFocus: false,
		refetchOnMount: false,
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
		staleTime: Infinity,
		gcTime: 5 * 60 * 1000,
	});

	const rawAssets = rawData?.items ?? [];
	type AssetRow = (typeof rawAssets)[number];
	const assets: AssetRow[] = rawAssets;

	const errorCountRef = React.useRef(0);
	const lastErrorTimeRef = React.useRef(0);

	const handleSubscriptionData = React.useCallback(
		(_event: AssetSubscriptionEvent) => {
			void utils.asset.listAssets.invalidate();
		},
		[utils],
	);

	const handleSubscriptionError = React.useCallback((_error: unknown) => {
		errorCountRef.current += 1;
		const now = Date.now();
		const timeSinceLastError = now - lastErrorTimeRef.current;
		lastErrorTimeRef.current = now;
		if (errorCountRef.current >= 3 && timeSinceLastError < 5000) {
			toast.error("Real-time updates temporarily unavailable");
		}
	}, []);

	const handleSubscriptionStarted = React.useCallback(() => {
		errorCountRef.current = 0;
	}, []);

	const prevQueryErrorRef = React.useRef<unknown>(null);
	React.useEffect(() => {
		if (queryError && queryError !== prevQueryErrorRef.current) {
			prevQueryErrorRef.current = queryError;
			toast.error(getToastMessage(queryError, "load"));
		}
	}, [queryError]);

	const deleteMutation = trpc.asset.deleteAsset.useMutation({
		onMutate: async (variables) => {
			await utils.asset.listAssets.cancel();
			const previous = utils.asset.listAssets.getData();
			utils.asset.listAssets.setData(undefined, (old) => {
				if (!old) return old;
				return {
					...old,
					items: old.items.filter((a) => a.id !== variables.id),
					totalCount: old.totalCount - 1,
				};
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Asset deleted successfully");
			setIsDeleteDialogOpen(false);
			setAssetToDelete(null);
		},
		onError: (error, _variables, context) => {
			if (context?.previous) {
				utils.asset.listAssets.setData(undefined, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.asset.listAssets.invalidate();
		},
	});

	const bulkDeleteMutation = trpc.asset.deleteManyAssets.useMutation({
		onMutate: async (variables) => {
			await utils.asset.listAssets.cancel();
			const previous = utils.asset.listAssets.getData();
			utils.asset.listAssets.setData(undefined, (old) => {
				if (!old) return old;
				return {
					...old,
					items: old.items.filter((a) => !variables.ids.includes(a.id)),
					totalCount: old.totalCount - variables.ids.length,
				};
			});
			return { previous };
		},
		onSuccess: (result) => {
			toast.success(`Successfully deleted ${result.count} asset(s)`);
		},
		onError: (error, _variables, context) => {
			if (context?.previous) {
				utils.asset.listAssets.setData(undefined, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.asset.listAssets.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (assetToDelete) {
			deleteMutation.mutate({ id: assetToDelete });
		}
	}, [assetToDelete, deleteMutation]);

	const getRelativeAge = React.useCallback((date: Date): string => {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffMonths = Math.floor(diffDays / 30);
		const diffYears = Math.floor(diffDays / 365);
		if (diffYears >= 1) return `${diffYears}y`;
		if (diffMonths >= 1) return `${diffMonths}m`;
		if (diffDays >= 1) return `${diffDays}d`;
		return "Today";
	}, []);

	const columns = React.useMemo<ColumnDef<AssetRow>[]>(
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
						aria-label="Select all rows on this page"
						className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
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
				enableHiding: false,
				enableResizing: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
			{
				accessorKey: "series",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Series" />
				),
				cell: ({ row }) => (
					<span className="font-mono text-xs text-muted-foreground">
						{row.getValue("series")}
					</span>
				),
				meta: {
					label: "Series",
					placeholder: "Search by series...",
					variant: "text",
					searchable: true,
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: true,
				enableGlobalFilter: true,
			},
			{
				accessorKey: "assetName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Asset Name" />
				),
				cell: ({ row }) => (
					<Link
						href={`/asset/asset_sub_module/asset/${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.getValue("assetName")}
					</Link>
				),
				meta: {
					label: "Asset Name",
					placeholder: "Search by name...",
					variant: "text",
					searchable: true,
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: true,
				enableGlobalFilter: true,
			},
			{
				id: "status",
				accessorFn: (row) => row.status,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => {
					const status = row.original.status;
					const statusDisplay = formatStatus(status);
					const statusColor =
						status === "DRAFT"
							? "text-muted-foreground"
							: status === "SUBMITTED"
								? "text-blue-600"
								: status === "CANCELLED"
									? "text-red-600"
									: status === "SOLD"
										? "text-purple-600"
										: status === "SCRAPPED"
											? "text-zinc-600"
											: status === "IN_MAINTENANCE"
												? "text-yellow-600"
												: status === "OUT_OF_ORDER"
													? "text-red-700"
													: "text-primary";

					return (
						<span className={`${statusColor} text-sm font-medium`}>
							{statusDisplay}
						</span>
					);
				},
				meta: {
					label: "Status",
					variant: "multiSelect",
					options: [
						{ label: "Draft", value: "DRAFT", icon: Package },
						{ label: "Submitted", value: "SUBMITTED", icon: CheckCircle2 },
						{ label: "Cancelled", value: "CANCELLED", icon: XCircle },
						{
							label: "Partially Depreciated",
							value: "PARTIALLY_DEPRECIATED",
							icon: Package,
						},
						{
							label: "Fully Depreciated",
							value: "FULLY_DEPRECIATED",
							icon: Package,
						},
						{ label: "Sold", value: "SOLD", icon: CheckCircle2 },
						{ label: "Scrapped", value: "SCRAPPED", icon: XCircle },
						{
							label: "In Maintenance",
							value: "IN_MAINTENANCE",
							icon: Package,
						},
						{
							label: "Out Of Order",
							value: "OUT_OF_ORDER",
							icon: XCircle,
						},
					],
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: true,
				filterFn: (row, _id, value) => {
					return value.includes(row.original.status);
				},
			},
			{
				id: "assetCategoryName",
				accessorFn: (row) => row.assetCategoryName ?? "",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Category" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.assetCategoryName ?? "—"}
					</span>
				),
				meta: {
					label: "Category",
					placeholder: "Search by category...",
					variant: "text",
					searchable: true,
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: true,
				enableGlobalFilter: true,
			},
			{
				id: "locationName",
				accessorFn: (row) => row.locationName ?? "",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Location" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.locationName ?? "—"}
					</span>
				),
				meta: {
					label: "Location",
					placeholder: "Search by location...",
					variant: "text",
					searchable: true,
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: true,
				enableGlobalFilter: true,
			},
			{
				id: "age",
				accessorFn: (row) => row.createdAt,
				header: () => <span className="text-muted-foreground" />,
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{getRelativeAge(new Date(row.original.createdAt))}
					</span>
				),
				meta: {
					label: "Age",
					variant: "date",
					exportable: true,
				},
				enableSorting: true,
				size: 50,
			},
			{
				id: "counts",
				header: () => (
					<div className="text-right text-muted-foreground text-sm">
						{assets.length} of {assets.length}
					</div>
				),
				cell: () => (
					<div className="flex items-center justify-end gap-2 text-muted-foreground text-sm">
						<span className="flex items-center gap-1">
							<svg
								className="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.5}
							>
								<title>Comments count</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
								/>
							</svg>
							0
						</span>
						<span>·</span>
					</div>
				),
				enableSorting: false,
				enableHiding: false,
				enableResizing: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
				size: 80,
			},
			{
				id: "counts",
				header: () => (
					<div className="text-right text-muted-foreground text-sm">
						{assets.length} of {assets.length}
					</div>
				),
				cell: () => (
					<div className="flex items-center justify-end gap-2 text-muted-foreground text-sm">
						<span className="flex items-center gap-1">
							<svg
								className="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.5}
							>
								<title>Comments count</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
								/>
							</svg>
							0
						</span>
						<span>·</span>
					</div>
				),
				enableSorting: false,
				enableHiding: false,
				enableResizing: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
				size: 80,
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => {
					const asset = row.original;
					return (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" className="h-8 w-8 p-0">
									<span className="sr-only">Open menu</span>
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Actions</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link href={`/asset/asset-sub-module/asset/${asset.id}`}>
										<Eye className="mr-2 h-4 w-4" />
										View Details
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link
										href={`/asset/asset_sub_module/asset/form?id=${asset.id}`}
									>
										<Edit className="mr-2 h-4 w-4" />
										Edit Asset
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => handleDelete(asset.id)}
									className="text-destructive focus:text-destructive"
								>
									<Trash className="mr-2 h-4 w-4" />
									Delete Asset
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
				enableSorting: false,
				enableHiding: false,
				enableResizing: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
		],
		[handleDelete, getRelativeAge, assets.length],
	);

	const handleBulkDelete = React.useCallback(
		async (rows: readonly Row<AssetRow>[]) => {
			const ids = rows.map((r) => r.original.id);
			try {
				await bulkDeleteMutation.mutateAsync({ ids });
			} catch {
				// Error toast is handled in the mutation lifecycle
			}
		},
		[bulkDeleteMutation],
	);

	const bulkActions = React.useMemo<BulkAction<AssetRow>[]>(
		() => [
			{
				label: "Delete Selected",
				icon: <Trash className="h-4 w-4" />,
				action: handleBulkDelete,
				variant: "destructive",
				requiresConfirmation: true,
				confirmationMessage:
					"This will permanently delete the selected assets. This action cannot be undone.",
			},
		],
		[handleBulkDelete],
	);

	const handleReload = React.useCallback(async () => {
		await utils.asset.listAssets.refetch();
	}, [utils]);

	const { table } = useAdvancedDataTable({
		data: assets,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "age", desc: true }],
		enableRowSelection: true,
		enableMultiRowSelection: true,
		enableGlobalFilter: true,
		onReload: handleReload,
	});

	return (
		<>
			<AssetRealtimeSubscription
				onStarted={handleSubscriptionStarted}
				onData={handleSubscriptionData}
				onError={handleSubscriptionError}
			/>

			<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div>
							<h1 className="text-3xl font-bold tracking-tight">Assets</h1>
							<p className="text-muted-foreground">
								Manage your fixed assets with advanced filtering, sorting, and
								bulk operations
							</p>
						</div>
					</div>
				</div>

				{/* Loading State */}
				{isLoading && (
					<div className="flex items-center justify-center py-12">
						<div className="flex flex-col items-center gap-4">
							<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
							<p className="text-sm text-muted-foreground">Loading assets...</p>
						</div>
					</div>
				)}

				{/* Error State */}
				{queryError && !isLoading && (
					<ErrorState
						error={queryError}
						operation="load"
						title="Failed to load assets"
						onRetry={() => utils.asset.listAssets.refetch()}
					/>
				)}

				{/* Advanced Data Table */}
				{!isLoading && !queryError && (
					<AdvancedDataTable
						table={table}
						data={assets}
						enableGlobalSearch
						enableExport
						enableImport={false}
						enableBulkActions
						enableVirtualization
						enableColumnResizing
						enableColumnReordering
						exportFormats={["csv", "excel", "json", "pdf"]}
						bulkActions={bulkActions}
						primaryAction={<NewAssetDialog />}
						ariaLabel="Assets table"
						ariaDescription="A table of all assets with advanced filtering, sorting, and bulk actions"
					/>
				)}

				{/* Delete Confirmation */}
				<AlertModal
					isOpen={isDeleteDialogOpen}
					onClose={() => {
						setIsDeleteDialogOpen(false);
						setAssetToDelete(null);
					}}
					onConfirm={confirmDelete}
					loading={deleteMutation.isPending}
				/>
			</div>
		</>
	);
}
