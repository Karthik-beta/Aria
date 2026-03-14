/**
 * Inventory Item Groups - List Page
 * Enterprise-grade table for Item Groups with full hierarchy display
 */

"use client";

import type { Inventory } from "@aria/types";
import type { ColumnDef } from "@tanstack/react-table";
import {
	Edit,
	Eye,
	FolderTree,
	MoreHorizontal,
	Plus,
	Trash,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
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
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type ItemGroupSubscriptionEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.ItemGroup | { id: string };
};

function ItemGroupRealtimeSubscription({
	onStarted,
	onData,
	onError,
}: {
	onStarted?: () => void;
	onData?: (event: ItemGroupSubscriptionEvent) => void;
	onError?: (err: unknown) => void;
}) {
	trpc.inventory.onItemGroupsChanged.useSubscription(undefined, {
		onStarted,
		onData,
		onError,
	});

	return null;
}

export default function ItemGroupsPage() {
	const utils = trpc.useUtils();

	// State for delete confirmation (optional, if we add delete support)
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [groupToDelete, setGroupToDelete] = React.useState<string | null>(null);
	const [isRealtimeReady, setIsRealtimeReady] = React.useState(false);

	React.useEffect(() => {
		setIsRealtimeReady(true);
		return () => setIsRealtimeReady(false);
	}, []);

	// Fetch all item groups
	const {
		data: rawGroups = [],
		isLoading,
		error: queryError,
	} = trpc.inventory.listItemGroups.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: Infinity,
	});

	// Real-time subscription
	const handleSubscriptionData = React.useCallback(
		(event: ItemGroupSubscriptionEvent) => {
			void utils.inventory.listItemGroups.invalidate();
			if (event.type === "created") toast.success("New item group added");
			else if (event.type === "updated") toast.info("Item group updated");
			else if (event.type === "deleted") toast.info("Item group removed");
		},
		[utils],
	);

	// Delete mutation
	const deleteMutation = trpc.inventory.deleteItemGroup.useMutation({
		onMutate: async (vars) => {
			await utils.inventory.listItemGroups.cancel();
			const previous = utils.inventory.listItemGroups.getData();
			utils.inventory.listItemGroups.setData(undefined, (old) => {
				if (!old) return old;
				return old.filter((g) => g.id !== vars.id);
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Item group deleted successfully");
			setIsDeleteDialogOpen(false);
			setGroupToDelete(null);
		},
		onError: (err, _vars, ctx) => {
			if (ctx?.previous)
				utils.inventory.listItemGroups.setData(undefined, ctx.previous);
			toast.error(getToastMessage(err, "delete"));
		},
		onSettled: () => {
			utils.inventory.listItemGroups.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (groupToDelete) {
			deleteMutation.mutate({ id: groupToDelete });
		}
	}, [groupToDelete, deleteMutation]);

	const handleDelete = React.useCallback((id: string) => {
		setGroupToDelete(id);
		setIsDeleteDialogOpen(true);
	}, []);

	// Transform dates
	const groups = React.useMemo(
		() =>
			rawGroups.map((group) => ({
				...group,
				createdAt: new Date(group.createdAt),
				updatedAt: new Date(group.updatedAt),
			})),
		[rawGroups],
	);

	// Helper function for age display
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

	// Column definitions
	const columns = React.useMemo<ColumnDef<Inventory.ItemGroup>[]>(
		() => [
			// Selection
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

			// ID column (as per screenshot, containing group name)
			{
				accessorKey: "groupName",
				id: "id-col",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="ID" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/items-catalogue/item-group/${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.groupName}
					</Link>
				),
				meta: {
					label: "ID",
					searchable: true,
					exportable: true,
				},
			},

			// Item Group Name column
			{
				accessorKey: "groupName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Group Name" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{row.original.groupName}
					</span>
				),
				meta: {
					label: "Item Group Name",
					searchable: true,
					exportable: true,
				},
			},

			// Parent Item Group column
			{
				accessorKey: "parentGroupName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Parent Item Group" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{row.original.parentGroupName || "-"}
					</span>
				),
				meta: {
					label: "Parent Item Group",
					searchable: true,
					exportable: true,
				},
			},

			// Is Group column
			{
				accessorKey: "isGroup",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Is Group" />
				),
				cell: ({ row }) => <Checkbox checked={row.original.isGroup} disabled />,
				meta: {
					label: "Is Group",
					variant: "multiSelect",
					options: [
						{ label: "Yes", value: "true" },
						{ label: "No", value: "false" },
					],
				},
			},

			// Age column
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

			// Counts column
			{
				id: "counts",
				header: () => (
					<div className="text-right text-muted-foreground text-sm">
						{groups.length} of {groups.length}
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
				size: 80,
			},

			// Actions
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 w-8 p-0">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link
									href={`/inventory/items-catalogue/item-group/${row.original.id}`}
								>
									<Eye className="mr-2 h-4 w-4" />
									View Details
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link
									href={`/inventory/items-catalogue/item-group/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Group
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => handleDelete(row.original.id)}
								className="text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Group
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
			},
		],
		[handleDelete, groups.length, getRelativeAge],
	);

	const handleReload = React.useCallback(async () => {
		await utils.inventory.listItemGroups.refetch();
	}, [utils]);

	const { table } = useAdvancedDataTable({
		data: groups,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "id-col", desc: false }],
		enableRowSelection: true,
		enableMultiRowSelection: true,
		enableGlobalFilter: true,
		onReload: handleReload,
	});

	return (
		<>
			{isRealtimeReady && (
				<ItemGroupRealtimeSubscription onData={handleSubscriptionData} />
			)}
			<div className="container mx-auto py-6 space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Item Groups</h1>
						<p className="text-muted-foreground">
							Manage your item hierarchy and categories
						</p>
					</div>
				</div>

				{isLoading && (
					<div className="flex items-center justify-center py-12">
						<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
					</div>
				)}

				{queryError && !isLoading && (
					<ErrorState
						error={queryError}
						operation="load"
						title="Failed to load item groups"
						onRetry={() => utils.inventory.listItemGroups.refetch()}
					/>
				)}

				{!isLoading && !queryError && (
					<AdvancedDataTable
						table={table}
						data={groups}
						enableGlobalSearch
						enableExport
						enableBulkActions
						enableVirtualization
						enableColumnResizing
						primaryAction={
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm" asChild>
									<Link href="/inventory/items-catalogue/item-group/tree">
										<FolderTree className="mr-2 h-4 w-4" />
										Tree
									</Link>
								</Button>
								<Link
									href="/inventory/items-catalogue/item-group/form"
									className={cn(
										buttonVariants({ variant: "default", size: "sm" }),
									)}
								>
									<Plus className="mr-2 h-4 w-4" />
									Add Group
								</Link>
							</div>
						}
						ariaLabel="Item groups table"
					/>
				)}

				<AlertModal
					isOpen={isDeleteDialogOpen}
					onClose={() => setIsDeleteDialogOpen(false)}
					onConfirm={confirmDelete}
					loading={deleteMutation.isPending}
				/>
			</div>
		</>
	);
}
