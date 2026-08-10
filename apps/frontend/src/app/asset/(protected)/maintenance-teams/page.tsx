/**
 * Asset Maintenance Team List Page
 *
 * Displays all maintenance teams in a paginated, filterable table with full
 * CRUD operations. Supports real-time updates via tRPC WebSocket subscription.
 *
 * Business logic mirrors ERPNext Asset Maintenance Team behaviour:
 * - Each team has a name, optional manager, company, and a list of members.
 * - Each member has a team member identifier, full name, and maintenance role.
 * - Teams with at least one member are required (enforced by creation schema).
 *
 * Client component: uses hooks for data fetching, pagination, and mutations.
 */
"use client";

import type { Asset } from "@aria/types";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Edit, MoreHorizontal, Plus, Trash, Users } from "lucide-react";
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
import { useAssetWriteAccess } from "@/hooks/use-asset-write-access";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	buildMaintenanceTeamListInput,
	getRelativeAge,
	TEAM_PAGE_SIZE,
} from "./maintenance-team.utils";

type TeamRow = Omit<Asset.AssetMaintenanceTeam, "createdAt" | "updatedAt"> & {
	createdAt: Date;
	updatedAt: Date;
	members: Array<
		Omit<Asset.AssetMaintenanceTeamMember, "createdAt" | "updatedAt"> & {
			createdAt: Date;
			updatedAt: Date;
		}
	>;
};

type MaintenanceTeamsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Asset.AssetMaintenanceTeam | { id: string };
};

function MaintenanceTeamsRealtimeSubscription({
	onData,
}: {
	onData: (event: MaintenanceTeamsChangedEvent) => void;
}) {
	trpc.asset.onMaintenanceTeamsChanged.useSubscription(undefined, {
		onData,
	});
	return null;
}

export default function MaintenanceTeamPage() {
	const utils = trpc.useUtils();
	const canWrite = useAssetWriteAccess();

	const [search, setSearch] = React.useState("");
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: TEAM_PAGE_SIZE,
	});
	const [teamToDelete, setTeamToDelete] = React.useState<string | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	const deferredSearch = useDeferredValue(search);

	const resetToFirstPage = React.useCallback(() => {
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	const queryInput = React.useMemo(
		() =>
			buildMaintenanceTeamListInput({
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
	} = trpc.asset.listMaintenanceTeams.useQuery(queryInput, {
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

	const teams = React.useMemo<TeamRow[]>(
		() =>
			rawItems.map((team) => ({
				...team,
				createdAt: new Date(team.createdAt),
				updatedAt: new Date(team.updatedAt),
				members: team.members.map((m) => ({
					...m,
					createdAt: new Date(m.createdAt),
					updatedAt: new Date(m.updatedAt),
				})),
			})),
		[rawItems],
	);

	const handleSubscriptionData = React.useCallback(
		(_event: MaintenanceTeamsChangedEvent) => {
			void utils.asset.listMaintenanceTeams.invalidate();
		},
		[utils],
	);

	const deleteMutation = trpc.asset.deleteMaintenanceTeam.useMutation({
		onMutate: async (vars) => {
			await utils.asset.listMaintenanceTeams.cancel();
			const previous = utils.asset.listMaintenanceTeams.getData(queryInput);
			utils.asset.listMaintenanceTeams.setData(queryInput, (old) => {
				if (!old) return old;
				return {
					...old,
					items: old.items.filter((t) => t.id !== vars.id),
					totalCount: old.totalCount - 1,
				};
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Maintenance team deleted successfully");
			setIsDeleteDialogOpen(false);
			setTeamToDelete(null);
		},
		onError: (err, _vars, ctx) => {
			if (ctx?.previous) {
				utils.asset.listMaintenanceTeams.setData(queryInput, ctx.previous);
			}
			toast.error(getToastMessage(err, "delete"));
		},
		onSettled: () => {
			void utils.asset.listMaintenanceTeams.invalidate(queryInput);
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (teamToDelete) {
			deleteMutation.mutate({ id: teamToDelete });
		}
	}, [teamToDelete, deleteMutation]);

	const handleDelete = React.useCallback((id: string) => {
		setTeamToDelete(id);
		setIsDeleteDialogOpen(true);
	}, []);

	const prevQueryErrorRef = React.useRef<unknown>(null);
	React.useEffect(() => {
		if (queryError && queryError !== prevQueryErrorRef.current) {
			prevQueryErrorRef.current = queryError;
			toast.error(getToastMessage(queryError, "load"));
		}
	}, [queryError]);

	const columns = React.useMemo<ColumnDef<TeamRow>[]>(
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
					<DataTableColumnHeader column={column} title="Team Name" />
				),
				cell: ({ row }) =>
					canWrite ? (
						<Link
							href={`/asset/maintenance-teams/form?id=${row.original.id}`}
							className="font-medium text-primary hover:underline"
						>
							{row.original.name}
						</Link>
					) : (
						<span className="font-medium">{row.original.name}</span>
					),
				meta: {
					label: "Team Name",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "maintenanceManagerName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Maintenance Manager" />
				),
				cell: ({ row }) =>
					row.original.maintenanceManagerName ? (
						<span className="text-sm text-foreground">
							{row.original.maintenanceManagerName}
						</span>
					) : (
						<span className="text-sm text-muted-foreground">—</span>
					),
				meta: {
					label: "Maintenance Manager",
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
				id: "memberCount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Members" />
				),
				cell: ({ row }) => (
					<span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
						{row.original.members.length}
					</span>
				),
				meta: {
					label: "Members",
					exportable: false,
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
				cell: ({ row }) =>
					canWrite ? (
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
										href={`/asset/maintenance-teams/form?id=${row.original.id}`}
									>
										<Edit className="mr-2 h-4 w-4" />
										Edit Team
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => handleDelete(row.original.id)}
									className="text-destructive"
								>
									<Trash className="mr-2 h-4 w-4" />
									Delete Team
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : null,
				enableSorting: false,
			},
		],
		[canWrite, handleDelete],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

	const tableResetKey = `${deferredSearch}`;

	return (
		<>
			<MaintenanceTeamsRealtimeSubscription onData={handleSubscriptionData} />

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setTeamToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>

			<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">
							Asset Maintenance Teams
						</h1>
						<p className="text-muted-foreground">
							Manage teams responsible for asset maintenance
						</p>
					</div>
				</div>

				{/* Filters */}
				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<Label className="text-xs text-muted-foreground">Search</Label>
						<Input
							placeholder="Search teams…"
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
												<Skeleton className="h-4 w-32" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-20" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-12" />
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
										{skeletonRowKeys.map((key) => (
											<tr key={key} className="border-t">
												<td className="p-3">
													<Skeleton className="h-4 w-4" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-24" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-32" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-20" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-12" />
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
						title="Failed to load maintenance teams"
						onRetry={() =>
							void utils.asset.listMaintenanceTeams.invalidate(queryInput)
						}
					/>
				)}

				{!isLoading && !queryError && (
					<MaintenanceTeamTable
						key={tableResetKey}
						data={teams}
						columns={columns}
						pageCount={pageCount}
						totalCount={totalCount}
						onPaginationChange={setPagination}
						onReload={handleReload}
						search={search}
						canWrite={canWrite}
					/>
				)}
			</div>
		</>
	);
}

function MaintenanceTeamTable(props: {
	data: readonly TeamRow[];
	columns: ColumnDef<TeamRow, unknown>[];
	pageCount: number;
	totalCount: number;
	onPaginationChange: (pagination: PaginationState) => void;
	onReload: () => void | Promise<void>;
	search: string;
	canWrite: boolean;
}) {
	const { table } = useAdvancedDataTable<TeamRow>({
		data: props.data,
		columns: props.columns,
		pageCount: props.pageCount,
		initialPageSize: TEAM_PAGE_SIZE,
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
			ariaLabel="Asset maintenance team table"
			primaryAction={
				props.canWrite ? (
					<Link
						href="/asset/maintenance-teams/form"
						className={cn(buttonVariants({ variant: "default", size: "sm" }))}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Team
					</Link>
				) : undefined
			}
			emptyState={
				<div className="flex flex-col items-center gap-2 py-12">
					<Users className="h-10 w-10 text-muted-foreground/40" />
					<p className="text-sm text-muted-foreground">
						{props.search
							? "No teams match your filters"
							: "No maintenance teams yet"}
					</p>
					{!props.search && props.canWrite && (
						<Link
							href="/asset/maintenance-teams/form"
							className={cn(
								buttonVariants({
									variant: "outline",
									size: "sm",
								}),
								"mt-1",
							)}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add your first team
						</Link>
					)}
				</div>
			}
		/>
	);
}
