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
import { Edit, Eye, MoreHorizontal, Scan, Trash } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
	AdvancedDataTable,
	type BulkAction,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { BarcodeScannerDialog } from "@/components/barcode-scanner-dialog";
import { AlertModal } from "@/components/modal/alert-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
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

const STATUS_BADGE_CLASS: Record<string, string> = {
	DRAFT:
		"bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground",
	SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
	CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
	PARTIALLY_DEPRECIATED:
		"bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
	FULLY_DEPRECIATED:
		"bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
	SOLD: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
	SCRAPPED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
	IN_MAINTENANCE:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
	OUT_OF_ORDER: "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

function formatStatus(status: string): string {
	return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AssetListPage() {
	const utils = trpc.useUtils();
	const router = useRouter();
	const [scannerOpen, setScannerOpen] = React.useState(false);
	const [_isPending, startTransition] = React.useTransition();

	const handleScanSuccess = React.useCallback(
		async (scannedCode: string) => {
			const promise = utils.asset.getAssetByBarcode
				.fetch({ barcode: scannedCode })
				.then((asset) => {
					if (!asset) {
						throw new Error(`No asset found with barcode "${scannedCode}"`);
					}
					startTransition(() => {
						router.push(`/asset/asset-sub-module/asset/${asset.id}`);
					});
					return asset;
				});

			toast.promise(promise, {
				loading: "Looking up asset by barcode...",
				success: (asset) => `Asset "${asset.assetName}" found! Redirecting...`,
				error: (err: unknown) => {
					// Use custom error message if provided by backend, otherwise default
					const errMsg =
						(err as Error)?.message ||
						`No asset found with barcode "${scannedCode}"`;
					return errMsg.includes("not found")
						? `No asset found with barcode "${scannedCode}"`
						: errMsg;
				},
			});
		},
		[utils, router],
	);

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

	const skeletonRowKeys = React.useMemo(
		() => Array.from({ length: 8 }, () => crypto.randomUUID()),
		[],
	);

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
						href={`/asset/asset-sub-module/asset/${row.original.id}`}
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
					const badgeClass =
						STATUS_BADGE_CLASS[status] ??
						"bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground";
					return (
						<Badge className={`${badgeClass} border-0 text-xs font-medium`}>
							{formatStatus(status)}
						</Badge>
					);
				},
				meta: {
					label: "Status",
					variant: "multiSelect",
					options: Object.keys(STATUS_BADGE_CLASS).map((s) => ({
						label: formatStatus(s),
						value: s,
					})),
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: true,
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
				id: "custodian",
				accessorFn: (row) => row.custodianName ?? "",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Custodian" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.custodianName ?? "—"}
					</span>
				),
				meta: {
					label: "Custodian",
					placeholder: "Search by custodian...",
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
										href={`/asset/asset-sub-module/asset/form?id=${asset.id}`}
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
		[handleDelete, getRelativeAge],
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
												<Skeleton className="h-4 w-16" />
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
												<Skeleton className="h-4 w-24" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-12" />
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
													<Skeleton className="h-4 w-16" />
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
													<Skeleton className="h-4 w-24" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-12" />
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
						primaryAction={
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setScannerOpen(true)}
								>
									<Scan className="mr-2 h-4 w-4" />
									Scan Barcode
								</Button>
								<NewAssetDialog />
							</div>
						}
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

				<BarcodeScannerDialog
					isOpen={scannerOpen}
					onClose={() => setScannerOpen(false)}
					onScanSuccess={handleScanSuccess}
				/>
			</div>
		</>
	);
}
