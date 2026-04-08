/**
 * Inventory Items Catalogue - List Page
 * Enterprise-grade table with full CRUD operations using tRPC + Advanced Data Table
 *
 * Navigation Pattern: Uses Next.js Link components for navigation (no router.push memory leaks)
 * CRUD Pattern: Quick-create dialog for common item entry, full page for deeper create/edit flows,
 * inline delete with confirmation
 */

"use client";

import type { Inventory } from "@aria/types";
import type {
	ColumnDef,
	PaginationState,
	Row,
	SortingState,
} from "@tanstack/react-table";
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
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { NewItemDialog } from "@/features/inventory/components/new-item-dialog";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

type InventorySubscriptionEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.Item | { id: string };
};

type InventoryItemCatalogueRecord = Omit<
	Inventory.ItemCatalogueListItem,
	"createdAt" | "updatedAt"
> & {
	createdAt: string;
	updatedAt: string;
};

type InventoryItemCatalogueQueryResult = {
	items: InventoryItemCatalogueRecord[];
	totalCount: number;
};

type InventoryItemRow = Omit<
	Inventory.ItemCatalogueListItem,
	"createdAt" | "updatedAt"
> & {
	createdAt: Date;
	updatedAt: Date;
};

const ITEM_PAGE_SIZE = 25;
const DEFAULT_SORTING: SortingState = [{ id: "updatedAt", desc: true }];

function resolveCatalogueSort(
	sorting: SortingState,
): Pick<Inventory.ListItemsInput, "sortBy" | "sortDirection"> {
	const activeSort = sorting[0];

	if (!activeSort) {
		return { sortBy: "updatedAt", sortDirection: "desc" };
	}

	const sortDirection = activeSort.desc ? "desc" : "asc";

	switch (activeSort.id) {
		case "name":
		case "code":
		case "itemGroupName":
		case "createdAt":
		case "updatedAt":
			return {
				sortBy: activeSort.id,
				sortDirection,
			};
		default:
			return { sortBy: "updatedAt", sortDirection: "desc" };
	}
}

function InventoryRealtimeSubscription({
	onStarted,
	onData,
	onError,
}: {
	onStarted?: () => void;
	onData?: (event: InventorySubscriptionEvent) => void;
	onError?: (err: unknown) => void;
}) {
	trpc.inventory.onItemsChanged.useSubscription(undefined, {
		onStarted,
		onData,
		onError,
	});

	return null;
}

export default function InventoryItemsPage() {
	const utils = trpc.useUtils();
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: ITEM_PAGE_SIZE,
	});
	const [sorting, setSorting] = React.useState<SortingState>(DEFAULT_SORTING);
	const [globalSearch, setGlobalSearch] = React.useState("");

	const handlePaginationChange = React.useCallback(
		(nextPagination: PaginationState) => {
			setPagination(nextPagination);
		},
		[],
	);

	const handleSortingChange = React.useCallback((nextSorting: SortingState) => {
		setSorting(nextSorting);
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	const handleGlobalFilterChange = React.useCallback((value: string) => {
		setGlobalSearch(value);
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	// State for delete confirmation only
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [itemToDelete, setItemToDelete] = React.useState<string | null>(null);

	// Stable delete handler using ref pattern - prevents columns re-memoization
	const handleDeleteRef = React.useRef<(id: string) => void>(() => {
		// Initial no-op function
	});
	handleDeleteRef.current = (id: string) => {
		setItemToDelete(id);
		setIsDeleteDialogOpen(true);
	};

	// Wrapped in useCallback for external use
	const handleDelete = React.useCallback((id: string) => {
		handleDeleteRef.current?.(id);
	}, []);

	const queryInput = React.useMemo<Inventory.ListItemsInput>(
		() => ({
			skip: pagination.pageIndex * pagination.pageSize,
			take: pagination.pageSize,
			search: globalSearch.trim() || undefined,
			...resolveCatalogueSort(sorting),
		}),
		[globalSearch, pagination.pageIndex, pagination.pageSize, sorting],
	);

	const {
		data,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listItemCatalogue.useQuery(queryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
		placeholderData: (
			previous: InventoryItemCatalogueQueryResult | undefined,
		) => previous,
	});

	const totalCount = data?.totalCount ?? 0;
	const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

	const items = React.useMemo(
		() =>
			(data?.items ?? []).map((item) => ({
				...item,
				createdAt: new Date(item.createdAt),
				updatedAt: new Date(item.updatedAt),
			})),
		[data?.items],
	);

	// Real-time subscription for CRUD events
	// Following official tRPC patterns: use subscription callbacks directly
	// https://trpc.io/docs/client/react/useSubscription
	const errorCountRef = React.useRef(0);
	const lastErrorTimeRef = React.useRef(0);

	// Callback to handle subscription data
	// Following official tRPC pattern: no manual mount checks needed with React 18+
	const handleSubscriptionData = React.useCallback(
		(event: InventorySubscriptionEvent) => {
			void utils.inventory.listItemCatalogue.invalidate(queryInput);

			// Show appropriate toast notification
			if (event.type === "created") {
				toast.success("New item added to inventory");
			} else if (event.type === "updated") {
				toast.info("Item updated");
			} else if (event.type === "deleted") {
				toast.info("Item removed from inventory");
			}
		},
		[queryInput, utils],
	);

	const handleSubscriptionError = React.useCallback((_error: unknown) => {
		errorCountRef.current += 1;
		const now = Date.now();
		const timeSinceLastError = now - lastErrorTimeRef.current;
		lastErrorTimeRef.current = now;

		// Only show error toast for persistent connection issues (3+ consecutive failures within 5 seconds)
		if (errorCountRef.current >= 3 && timeSinceLastError < 5000) {
			toast.error("Real-time updates temporarily unavailable");
		}
	}, []);

	const handleSubscriptionStarted = React.useCallback(() => {
		errorCountRef.current = 0; // Reset error count on successful connection
	}, []);

	// Show error toast if query fails (only once per error)
	// Following official TanStack Query pattern: no manual mount checks needed
	const prevQueryErrorRef = React.useRef<unknown>(null);
	React.useEffect(() => {
		if (queryError && queryError !== prevQueryErrorRef.current) {
			prevQueryErrorRef.current = queryError;
			toast.error(getToastMessage(queryError, "load"));
		}
	}, [queryError]);

	// Delete mutation with optimistic updates
	// Following official TanStack Query v5 pattern
	// https://tanstack.com/query/v5/docs/framework/react/guides/mutations
	const deleteMutation = trpc.inventory.deleteItem.useMutation({
		onMutate: async (variables) => {
			// Cancel outgoing refetches to avoid overwriting optimistic update
			await utils.inventory.listItemCatalogue.cancel(queryInput);

			// Snapshot the previous value
			const previousItems =
				utils.inventory.listItemCatalogue.getData(queryInput);

			// Optimistically update the cache
			utils.inventory.listItemCatalogue.setData(
				queryInput,
				(old: InventoryItemCatalogueQueryResult | undefined) => {
					if (!old) return old;
					return {
						...old,
						items: old.items.filter(
							(item: InventoryItemCatalogueRecord) => item.id !== variables.id,
						),
						totalCount: Math.max(0, old.totalCount - 1),
					};
				},
			);

			// Return context with snapshot for rollback
			return { previousItems };
		},
		onSuccess: () => {
			toast.success("Item deleted successfully");
			setIsDeleteDialogOpen(false);
			setItemToDelete(null);
		},
		onError: (error, _variables, context) => {
			// Rollback on error
			if (context?.previousItems) {
				utils.inventory.listItemCatalogue.setData(
					queryInput,
					context.previousItems,
				);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listItemCatalogue.invalidate(queryInput);
			void utils.inventory.listItems.invalidate();
		},
	});

	// Bulk delete mutation with optimistic updates
	// Following official TanStack Query v5 pattern
	const bulkDeleteMutation = trpc.inventory.deleteItems.useMutation({
		onMutate: async (variables) => {
			// Cancel outgoing refetches
			await utils.inventory.listItemCatalogue.cancel(queryInput);

			// Snapshot the previous value
			const previousItems =
				utils.inventory.listItemCatalogue.getData(queryInput);

			// Optimistically remove selected items
			utils.inventory.listItemCatalogue.setData(
				queryInput,
				(old: InventoryItemCatalogueQueryResult | undefined) => {
					if (!old) return old;
					return {
						...old,
						items: old.items.filter(
							(item: InventoryItemCatalogueRecord) =>
								!variables.ids.includes(item.id),
						),
						totalCount: Math.max(0, old.totalCount - variables.ids.length),
					};
				},
			);

			return { previousItems };
		},
		onSuccess: (result) => {
			toast.success(`Successfully deleted ${result.count} item(s)`);
		},
		onError: (error, _variables, context) => {
			// Rollback on error
			if (context?.previousItems) {
				utils.inventory.listItemCatalogue.setData(
					queryInput,
					context.previousItems,
				);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listItemCatalogue.invalidate(queryInput);
			void utils.inventory.listItems.invalidate();
		},
	});

	// Confirm delete callback
	const confirmDelete = React.useCallback(() => {
		if (itemToDelete) {
			deleteMutation.mutate({ id: itemToDelete });
		}
	}, [itemToDelete, deleteMutation]);

	// Helper function to get relative time display (1y, 2y, etc.)
	const getRelativeAge = React.useCallback((date: Date): string => {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffMonths = Math.floor(diffDays / 30);
		const diffYears = Math.floor(diffDays / 365);

		if (diffYears >= 1) {
			return `${diffYears}y`;
		}
		if (diffMonths >= 1) {
			return `${diffMonths}m`;
		}
		if (diffDays >= 1) {
			return `${diffDays}d`;
		}
		return "Today";
	}, []);

	// Column definitions - Completely stable, no external dependencies
	// According to TanStack Table docs: columns should be wrapped in useMemo with empty deps
	const columns = React.useMemo<ColumnDef<InventoryItemRow>[]>(
		() => [
			// Selection column - uses table instance passed via context by TanStack Table
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
				size: 40, // Fixed width for checkbox column
				enableSorting: false,
				enableHiding: false,
				enableResizing: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},

			// Name column
			{
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Name" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/items-catalogue/item/${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.getValue("name")}
					</Link>
				),
				meta: {
					label: "Item Name",
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: false,
				enableGlobalFilter: true,
			},

			// Status column (Enabled/Template based on disabled field)
			{
				id: "status",
				accessorFn: (row) =>
					row.disabled ? "Disabled" : row.hasVariants ? "Template" : "Enabled",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => {
					const disabled = row.original.disabled;
					const hasVariants = row.original.hasVariants;

					if (disabled) {
						return (
							<span className="text-muted-foreground text-sm">Disabled</span>
						);
					}

					if (hasVariants) {
						return (
							<span className="text-amber-600 text-sm font-medium">
								Template
							</span>
						);
					}

					return (
						<span className="text-primary text-sm font-medium">Enabled</span>
					);
				},
				meta: {
					label: "Status",
					exportable: true,
				},
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},

			// Item Group column
			{
				accessorKey: "itemGroupName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Group" />
				),
				cell: ({ row }) => {
					const groupName = row.original.itemGroupName;
					return (
						<span className="text-sm text-muted-foreground">
							{groupName || "-"}
						</span>
					);
				},
				meta: {
					label: "Item Group",
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: false,
				enableGlobalFilter: true,
			},

			// Item Code column
			{
				accessorKey: "code",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Code" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.getValue("code")}
					</span>
				),
				meta: {
					label: "Item Code",
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: false,
				enableGlobalFilter: true,
			},

			// ID column
			{
				accessorKey: "id",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="ID" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.getValue("id")}
					</span>
				),
				meta: {
					label: "ID",
					exportable: true,
				},
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},

			// Age column (relative time since creation)
			{
				accessorKey: "createdAt",
				header: () => <span className="text-muted-foreground"></span>,
				cell: ({ row }) => {
					return (
						<span className="text-sm text-muted-foreground">
							{getRelativeAge(row.original.createdAt)}
						</span>
					);
				},
				meta: {
					label: "Age",
					variant: "date",
					exportable: true,
				},
				enableSorting: true,
				size: 50,
			},

			// Count column (placeholder for comments/count)
			{
				id: "counts",
				header: () => (
					<div className="text-right text-muted-foreground text-sm">
						{items.length} of {totalCount}
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

			// Actions column
			{
				id: "actions",
				header: "",
				cell: ({ row }) => {
					const item = row.original;

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
									<Link href={`/inventory/items-catalogue/item/${item.id}`}>
										<Eye className="mr-2 h-4 w-4" />
										View Details
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link
										href={`/inventory/items-catalogue/item/form?id=${item.id}`}
									>
										<Edit className="mr-2 h-4 w-4" />
										Edit Item
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => handleDelete(item.id)}
									className="text-destructive focus:text-destructive"
								>
									<Trash className="mr-2 h-4 w-4" />
									Delete Item
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
		[handleDelete, items.length, totalCount, getRelativeAge],
	);

	// Bulk delete handler - Memoized separately to prevent recreating bulk actions
	const handleBulkDelete = React.useCallback(
		async (rows: readonly Row<InventoryItemRow>[]) => {
			const ids = rows.map((r) => r.original.id);

			try {
				await bulkDeleteMutation.mutateAsync({ ids });
			} catch {
				// Error toast is handled in the mutation lifecycle
			}
		},
		[bulkDeleteMutation],
	);

	// Bulk actions - Memoized with stable handler reference
	const bulkActions = React.useMemo<BulkAction<InventoryItemRow>[]>(
		() => [
			{
				label: "Delete Selected",
				icon: <Trash className="h-4 w-4" />,
				action: handleBulkDelete,
				variant: "destructive",
				requiresConfirmation: true,
				confirmationMessage:
					"This will permanently delete the selected inventory items. This action cannot be undone.",
			},
		],
		[handleBulkDelete],
	);

	// Reload handler - Memoized to prevent table re-initialization
	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable({
		data: items,
		columns,
		pageCount,
		initialPageSize: ITEM_PAGE_SIZE,
		initialSorting: DEFAULT_SORTING,
		enableRowSelection: true,
		enableMultiRowSelection: true,
		enableGlobalFilter: true,
		manualFiltering: true,
		manualSorting: true,
		onPaginationChange: handlePaginationChange,
		onSortingChange: handleSortingChange,
		onGlobalFilterChange: handleGlobalFilterChange,
		onReload: handleReload,
	});

	return (
		<>
			<InventoryRealtimeSubscription
				onStarted={handleSubscriptionStarted}
				onData={handleSubscriptionData}
				onError={handleSubscriptionError}
			/>

			<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div>
							<h1 className="text-3xl font-bold tracking-tight">
								Inventory Items
							</h1>
							<p className="text-muted-foreground">
								Manage your inventory items with advanced filtering, sorting,
								and bulk operations
							</p>
						</div>
					</div>
				</div>

				{/* Loading State */}
				{isLoading && (
					<div className="flex items-center justify-center py-12">
						<div className="flex flex-col items-center gap-4">
							<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
							<p className="text-sm text-muted-foreground">
								Loading inventory items...
							</p>
						</div>
					</div>
				)}

				{/* Error State - Shows user-friendly error message */}
				{queryError && !isLoading && (
					<ErrorState
						error={queryError}
						operation="load"
						title="Failed to load inventory items"
						onRetry={() => void refetch()}
					/>
				)}

				{/* Advanced Data Table - Only render when data is loaded */}
				{!isLoading && !queryError && (
					<AdvancedDataTable
						table={table}
						data={items}
						totalItems={totalCount}
						enableGlobalSearch
						enableExport
						enableImport={false}
						enableBulkActions
						enableVirtualization
						enableColumnResizing
						enableColumnReordering
						exportFormats={["csv", "excel", "json", "pdf"]}
						bulkActions={bulkActions}
						primaryAction={<NewItemDialog />}
						ariaLabel="Inventory items table"
						ariaDescription="A table of all inventory items with advanced filtering, sorting, and bulk actions"
					/>
				)}

				{/* Delete Confirmation */}
				<AlertModal
					isOpen={isDeleteDialogOpen}
					onClose={() => {
						setIsDeleteDialogOpen(false);
						setItemToDelete(null);
					}}
					onConfirm={confirmDelete}
					loading={deleteMutation.isPending}
				/>
			</div>
		</>
	);
}
