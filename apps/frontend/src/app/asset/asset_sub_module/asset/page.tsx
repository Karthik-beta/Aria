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
import { Edit, Eye, MoreHorizontal, Trash } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import {
	AdvancedDataTable,
	type BulkAction,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
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
	DRAFT: "bg-gray-100 text-gray-700",
	SUBMITTED: "bg-blue-100 text-blue-700",
	CANCELLED: "bg-red-100 text-red-700",
	PARTIALLY_DEPRECIATED: "bg-amber-100 text-amber-700",
	FULLY_DEPRECIATED: "bg-orange-100 text-orange-700",
	SOLD: "bg-purple-100 text-purple-700",
	SCRAPPED: "bg-zinc-100 text-zinc-700",
	IN_MAINTENANCE: "bg-yellow-100 text-yellow-800",
	OUT_OF_ORDER: "bg-red-200 text-red-800",
};

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

	const { data: rawData, error: queryError } = trpc.asset.listAssets.useQuery(
		undefined,
		{
			refetchOnWindowFocus: false,
			refetchOnMount: false,
			retry: 2,
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
			staleTime: Infinity,
			gcTime: 5 * 60 * 1000,
		},
	);

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
					const badgeClass =
						STATUS_BADGE_CLASS[status] ?? "bg-gray-100 text-gray-700";
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
									<Link href={`/asset/asset_sub_module/asset/${asset.id}`}>
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
			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setAssetToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
			<AdvancedDataTable
				table={table}
				data={assets}
				totalItems={rawData?.totalCount ?? 0}
				enableGlobalSearch
				enableBulkActions
				bulkActions={bulkActions}
				primaryAction={<NewAssetDialog />}
				ariaLabel="Assets table"
				ariaDescription="Manage your fixed assets"
			/>
		</>
	);
}
