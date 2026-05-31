/**
 * Asset Category List Page
 *
 * Displays all asset categories in a paginated, filterable table with full
 * CRUD operations. Supports real-time updates via tRPC WebSocket subscription.
 *
 * Business logic mirrors ERPNext Asset Category behaviour:
 * - Non-depreciable categories omit depreciation settings.
 * - CWIP accounting flag is tracked per category.
 *
 * Client component: uses hooks for data fetching, pagination, and mutations.
 */
"use client";

import type { Asset } from "@aria/types";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Edit, Layers, MoreHorizontal, Plus, Trash } from "lucide-react";
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
	buildAssetCategoryListInput,
	CATEGORY_PAGE_SIZE,
	getDepreciationMethodLabel,
	getRelativeAge,
} from "./asset-category.utils";

type CategoryRow = Omit<Asset.AssetCategory, "createdAt" | "updatedAt"> & {
	createdAt: Date;
	updatedAt: Date;
};

type AssetCategoriesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Asset.AssetCategory | { id: string };
};

function AssetCategoriesRealtimeSubscription({
	onData,
}: {
	onData: (event: AssetCategoriesChangedEvent) => void;
}) {
	trpc.asset.onAssetCategoriesChanged.useSubscription(undefined, {
		onData,
	});
	return null;
}

export default function AssetCategoryPage() {
	const utils = trpc.useUtils();

	const [search, setSearch] = React.useState("");
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: CATEGORY_PAGE_SIZE,
	});
	const [categoryToDelete, setCategoryToDelete] = React.useState<string | null>(
		null,
	);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	const deferredSearch = useDeferredValue(search);

	const resetToFirstPage = React.useCallback(() => {
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	const queryInput = React.useMemo(
		() =>
			buildAssetCategoryListInput({
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
	} = trpc.asset.listAssetCategories.useQuery(queryInput, {
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

	const categories = React.useMemo<CategoryRow[]>(
		() =>
			rawItems.map((cat) => ({
				...cat,
				createdAt: new Date(cat.createdAt),
				updatedAt: new Date(cat.updatedAt),
			})),
		[rawItems],
	);

	const handleSubscriptionData = React.useCallback(
		(_event: AssetCategoriesChangedEvent) => {
			void utils.asset.listAssetCategories.invalidate();
		},
		[utils],
	);

	const deleteMutation = trpc.asset.deleteAssetCategory.useMutation({
		onMutate: async (vars) => {
			await utils.asset.listAssetCategories.cancel();
			const previous = utils.asset.listAssetCategories.getData(queryInput);
			utils.asset.listAssetCategories.setData(queryInput, (old) => {
				if (!old) return old;
				return {
					...old,
					items: old.items.filter((cat) => cat.id !== vars.id),
					totalCount: old.totalCount - 1,
				};
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Asset category deleted successfully");
			setIsDeleteDialogOpen(false);
			setCategoryToDelete(null);
		},
		onError: (err, _vars, ctx) => {
			if (ctx?.previous) {
				utils.asset.listAssetCategories.setData(queryInput, ctx.previous);
			}
			toast.error(getToastMessage(err, "delete"));
		},
		onSettled: () => {
			void utils.asset.listAssetCategories.invalidate(queryInput);
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (categoryToDelete) {
			deleteMutation.mutate({ id: categoryToDelete });
		}
	}, [categoryToDelete, deleteMutation]);

	const handleDelete = React.useCallback((id: string) => {
		setCategoryToDelete(id);
		setIsDeleteDialogOpen(true);
	}, []);

	const prevQueryErrorRef = React.useRef<unknown>(null);
	React.useEffect(() => {
		if (queryError && queryError !== prevQueryErrorRef.current) {
			prevQueryErrorRef.current = queryError;
			toast.error(getToastMessage(queryError, "load"));
		}
	}, [queryError]);

	const columns = React.useMemo<ColumnDef<CategoryRow>[]>(
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
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Category Name" />
				),
				cell: ({ row }) => (
					<Link
						href={`/asset/asset-sub-module/asset-category/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.name}
					</Link>
				),
				meta: {
					label: "Category Name",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "depreciationMethod",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Depreciation Method" />
				),
				cell: ({ row }) =>
					row.original.nonDepreciableCategory ? (
						<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground dark:bg-muted dark:text-muted-foreground">
							Non-Depreciable
						</span>
					) : (
						<span className="text-sm text-foreground">
							{getDepreciationMethodLabel(row.original.depreciationMethod)}
						</span>
					),
				meta: {
					label: "Depreciation Method",
					exportable: true,
				},
			},
			{
				accessorKey: "enableCwipAccounting",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="CWIP" />
				),
				cell: ({ row }) => (
					<span
						className={cn(
							"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
							row.original.enableCwipAccounting
								? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
								: "bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground",
						)}
					>
						{row.original.enableCwipAccounting ? "Enabled" : "Disabled"}
					</span>
				),
				meta: {
					label: "CWIP Accounting",
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
								aria-label={`Open actions for ${row.original.name}`}
							>
								<span className="sr-only">
									Open actions for {row.original.name}
								</span>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link
									href={`/asset/asset-sub-module/asset-category/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Category
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => handleDelete(row.original.id)}
								className="text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Category
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
			},
		],
		[handleDelete],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

	const tableResetKey = `${deferredSearch}`;

	return (
		<>
			<AssetCategoriesRealtimeSubscription onData={handleSubscriptionData} />

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setCategoryToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>

			<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">
							Asset Categories
						</h1>
						<p className="text-muted-foreground">
							Manage asset categories and depreciation defaults
						</p>
					</div>
				</div>

				{/* Filters */}
				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<Label className="text-xs text-muted-foreground">Search</Label>
						<Input
							placeholder="Search categories…"
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
												<Skeleton className="h-4 w-32" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-24" />
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
													<Skeleton className="h-4 w-32" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-24" />
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
						title="Failed to load asset categories"
						onRetry={() =>
							void utils.asset.listAssetCategories.invalidate(queryInput)
						}
					/>
				)}

				{!isLoading && !queryError && (
					<AssetCategoryTable
						key={tableResetKey}
						data={categories}
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

function AssetCategoryTable(props: {
	data: readonly CategoryRow[];
	columns: ColumnDef<CategoryRow, unknown>[];
	pageCount: number;
	totalCount: number;
	onPaginationChange: (pagination: PaginationState) => void;
	onReload: () => void | Promise<void>;
	search: string;
}) {
	const { table } = useAdvancedDataTable<CategoryRow>({
		data: props.data,
		columns: props.columns,
		pageCount: props.pageCount,
		initialPageSize: CATEGORY_PAGE_SIZE,
		initialSorting: [{ id: "name", desc: false }],
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
			ariaLabel="Asset category table"
			primaryAction={
				<Link
					href="/asset/asset-sub-module/asset-category/form"
					className={cn(buttonVariants({ variant: "default", size: "sm" }))}
				>
					<Plus className="mr-2 h-4 w-4" />
					Add Category
				</Link>
			}
			emptyState={
				<div className="flex flex-col items-center gap-2 py-12">
					<Layers className="h-10 w-10 text-muted-foreground/40" />
					<p className="text-sm text-muted-foreground">
						{props.search
							? "No categories match your filters"
							: "No asset categories yet"}
					</p>
					{!props.search && (
						<Link
							href="/asset/asset-sub-module/asset-category/form"
							className={cn(
								buttonVariants({
									variant: "outline",
									size: "sm",
								}),
								"mt-1",
							)}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add your first category
						</Link>
					)}
				</div>
			}
		/>
	);
}
