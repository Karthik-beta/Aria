/**
 * Asset Location List Page
 *
 * Displays all asset locations in a paginated, filterable table with full CRUD
 * operations. Supports real-time updates via tRPC WebSocket subscription.
 *
 * Client component: uses hooks for data fetching, pagination, and mutations.
 */
"use client";

import type { Asset } from "@aria/types";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import {
	Edit,
	ListTree,
	MapPin,
	MoreHorizontal,
	Plus,
	Table2,
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { useCanManageAssets } from "@/hooks/use-can-manage-assets";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	buildLocationListInput,
	formatArea,
	getLocationGroupLabel,
	getRelativeAge,
	LOCATION_PAGE_SIZE,
	LOCATION_VIEW_STORAGE_KEY,
	type LocationView,
} from "./location.utils";
import { LocationTreeView } from "./location-tree-view";

type LocationRow = Omit<Asset.Location, "createdAt" | "updatedAt"> & {
	createdAt: Date;
	updatedAt: Date;
};

type GroupFilter = "all" | "group" | "leaf";

type LocationSubscriptionEvent = {
	type: "created" | "updated" | "deleted";
	data: Asset.Location | { id: string };
};

function LocationRealtimeSubscription({
	onData,
}: {
	onData: (event: LocationSubscriptionEvent) => void;
}) {
	trpc.asset.onLocationsChanged.useSubscription(undefined, {
		onData,
	});
	return null;
}

export default function LocationPage() {
	const canManageAssets = useCanManageAssets();
	const utils = trpc.useUtils();

	const [search, setSearch] = React.useState("");
	const [groupFilter, setGroupFilter] = React.useState<GroupFilter>("all");
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: LOCATION_PAGE_SIZE,
	});
	const [locationToDelete, setLocationToDelete] = React.useState<string | null>(
		null,
	);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	const [view, setView] = React.useState<LocationView>("table");

	// Restore the last chosen view (the table stays the default).
	React.useEffect(() => {
		try {
			if (window.localStorage.getItem(LOCATION_VIEW_STORAGE_KEY) === "tree") {
				setView("tree");
			}
		} catch {
			// Storage can be unavailable (private mode); keep the default.
		}
	}, []);

	const changeView = React.useCallback((next: LocationView) => {
		setView(next);
		try {
			window.localStorage.setItem(LOCATION_VIEW_STORAGE_KEY, next);
		} catch {
			// Ignore storage failures.
		}
	}, []);

	const deferredSearch = useDeferredValue(search);

	const resetToFirstPage = React.useCallback(() => {
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	const queryInput = React.useMemo(
		() =>
			buildLocationListInput({
				search: deferredSearch,
				group: groupFilter,
				pageIndex: pagination.pageIndex,
				pageSize: pagination.pageSize,
			}),
		[deferredSearch, groupFilter, pagination],
	);

	const {
		data,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.asset.listLocations.useQuery(queryInput, {
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

	const locations = React.useMemo<LocationRow[]>(
		() =>
			rawItems.map((loc) => ({
				...loc,
				createdAt: new Date(loc.createdAt),
				updatedAt: new Date(loc.updatedAt),
			})),
		[rawItems],
	);

	const handleSubscriptionData = React.useCallback(
		(_event: LocationSubscriptionEvent) => {
			void utils.asset.listLocations.invalidate();
			void utils.asset.listLocationChildren.invalidate();
		},
		[utils],
	);

	const deleteMutation = trpc.asset.deleteLocation.useMutation({
		onMutate: async (vars) => {
			await utils.asset.listLocations.cancel();
			const previous = utils.asset.listLocations.getData(queryInput);
			utils.asset.listLocations.setData(queryInput, (old) => {
				if (!old) return old;
				return {
					...old,
					items: old.items.filter((loc) => loc.id !== vars.id),
					totalCount: old.totalCount - 1,
				};
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Location deleted successfully");
			setIsDeleteDialogOpen(false);
			setLocationToDelete(null);
		},
		onError: (err, _vars, ctx) => {
			if (ctx?.previous) {
				utils.asset.listLocations.setData(queryInput, ctx.previous);
			}
			setIsDeleteDialogOpen(false);
			setLocationToDelete(null);
			toast.error(getToastMessage(err, "delete"));
		},
		onSettled: () => {
			void utils.asset.listLocations.invalidate(queryInput);
			void utils.asset.listLocationChildren.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (locationToDelete) {
			deleteMutation.mutate({ id: locationToDelete });
		}
	}, [locationToDelete, deleteMutation]);

	const handleDelete = React.useCallback((id: string) => {
		setLocationToDelete(id);
		setIsDeleteDialogOpen(true);
	}, []);

	const prevQueryErrorRef = React.useRef<unknown>(null);
	React.useEffect(() => {
		if (queryError && queryError !== prevQueryErrorRef.current) {
			prevQueryErrorRef.current = queryError;
			toast.error(getToastMessage(queryError, "load"));
		}
	}, [queryError]);

	const columns = React.useMemo<ColumnDef<LocationRow>[]>(() => {
		const allColumns: ColumnDef<LocationRow>[] = [
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
					<DataTableColumnHeader column={column} title="Location Name" />
				),
				cell: ({ row }) =>
					canManageAssets ? (
						<Link
							href={`/asset/asset-sub-module/location/form?id=${row.original.id}`}
							className="font-medium text-primary hover:underline"
						>
							{row.original.name}
						</Link>
					) : (
						<span className="font-medium">{row.original.name}</span>
					),
				meta: { label: "Location Name", searchable: true, exportable: true },
			},
			{
				accessorKey: "parentLocationName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Parent Location" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{row.original.parentLocationName ?? "-"}
					</span>
				),
				meta: {
					label: "Parent Location",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "isGroup",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Type" />
				),
				cell: ({ row }) => (
					<span
						className={cn(
							"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
							row.original.isGroup
								? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
								: "bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground",
						)}
					>
						{getLocationGroupLabel(row.original.isGroup)}
					</span>
				),
				meta: {
					label: "Type",
					variant: "multiSelect",
					options: [
						{ label: "Group", value: "true" },
						{ label: "Leaf", value: "false" },
					],
				},
			},
			{
				accessorKey: "area",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Area" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{formatArea(row.original.area)}
					</span>
				),
				meta: { label: "Area", exportable: true },
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
									href={`/asset/asset-sub-module/location/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Location
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => handleDelete(row.original.id)}
								className="text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Location
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

	// Remounts the table when filters change to reset internal page index
	const tableResetKey = `${groupFilter}-${deferredSearch}`;

	return (
		<>
			<LocationRealtimeSubscription onData={handleSubscriptionData} />

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setLocationToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>

			<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Locations</h1>
						<p className="text-muted-foreground">
							Manage asset locations and site hierarchy
						</p>
					</div>
					<div className="flex items-center gap-1 rounded-md border p-0.5">
						<Button
							variant={view === "table" ? "secondary" : "ghost"}
							size="sm"
							aria-pressed={view === "table"}
							onClick={() => changeView("table")}
						>
							<Table2 className="mr-2 h-4 w-4" />
							Table
						</Button>
						<Button
							variant={view === "tree" ? "secondary" : "ghost"}
							size="sm"
							aria-pressed={view === "tree"}
							onClick={() => changeView("tree")}
						>
							<ListTree className="mr-2 h-4 w-4" />
							Tree
						</Button>
					</div>
				</div>

				{view === "tree" && (
					<>
						{canManageAssets && (
							<div>
								<Link
									href="/asset/asset-sub-module/location/form"
									className={cn(
										buttonVariants({ variant: "default", size: "sm" }),
									)}
								>
									<Plus className="mr-2 h-4 w-4" />
									Add Location
								</Link>
							</div>
						)}
						<LocationTreeView
							canManageAssets={canManageAssets}
							onDelete={handleDelete}
						/>
					</>
				)}

				{/* Filters */}
				{view === "table" && (
					<div className="flex flex-wrap items-end gap-3">
						<div className="flex flex-col gap-1">
							<Label className="text-xs text-muted-foreground">Search</Label>
							<Input
								placeholder="Search locations…"
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									resetToFirstPage();
								}}
								className="h-8 w-56"
							/>
						</div>

						<div className="flex flex-col gap-1">
							<Label className="text-xs text-muted-foreground">Type</Label>
							<Select
								value={groupFilter}
								onValueChange={(v) => {
									setGroupFilter(v as GroupFilter);
									resetToFirstPage();
								}}
							>
								<SelectTrigger className="h-8 w-36">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Types</SelectItem>
									<SelectItem value="group">Group</SelectItem>
									<SelectItem value="leaf">Leaf</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				)}

				{view === "table" && isLoading && (
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

				{view === "table" && queryError && !isLoading && (
					<ErrorState
						error={queryError}
						operation="load"
						title="Failed to load locations"
						onRetry={() =>
							void utils.asset.listLocations.invalidate(queryInput)
						}
					/>
				)}

				{view === "table" && !isLoading && !queryError && (
					<LocationTable
						key={tableResetKey}
						data={locations}
						columns={columns}
						pageCount={pageCount}
						totalCount={totalCount}
						onPaginationChange={setPagination}
						onReload={handleReload}
						search={search}
						groupFilter={groupFilter}
						canManageAssets={canManageAssets}
					/>
				)}
			</div>
		</>
	);
}

function LocationTable(props: {
	data: readonly LocationRow[];
	columns: ColumnDef<LocationRow, unknown>[];
	pageCount: number;
	totalCount: number;
	onPaginationChange: (pagination: PaginationState) => void;
	onReload: () => void | Promise<void>;
	search: string;
	groupFilter: GroupFilter;
	canManageAssets: boolean;
}) {
	const { table } = useAdvancedDataTable<LocationRow>({
		data: props.data,
		columns: props.columns,
		pageCount: props.pageCount,
		initialPageSize: LOCATION_PAGE_SIZE,
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
			ariaLabel="Location table"
			primaryAction={
				props.canManageAssets ? (
					<Link
						href="/asset/asset-sub-module/location/form"
						className={cn(buttonVariants({ variant: "default", size: "sm" }))}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Location
					</Link>
				) : undefined
			}
			emptyState={
				<div className="flex flex-col items-center gap-2 py-12">
					<MapPin className="h-10 w-10 text-muted-foreground/40" />
					<p className="text-sm text-muted-foreground">
						{props.search || props.groupFilter !== "all"
							? "No locations match your filters"
							: "No locations yet"}
					</p>
					{props.canManageAssets &&
						!props.search &&
						props.groupFilter === "all" && (
							<Link
								href="/asset/asset-sub-module/location/form"
								className={cn(
									buttonVariants({ variant: "outline", size: "sm" }),
									"mt-1",
								)}
							>
								<Plus className="mr-2 h-4 w-4" />
								Add your first location
							</Link>
						)}
				</div>
			}
		/>
	);
}
