/**
 * Item Attribute list page for the Inventory settings area.
 *
 * Client component: renders the CRUD table, delete confirmation, and quick-create entry point.
 * Each attribute row shows its status (Enabled / Disabled) and the number of child values.
 */
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
	Edit,
	Heart,
	MessageCircle,
	MoreHorizontal,
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
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { NewItemAttributeDialog } from "@/features/inventory/components/new-item-attribute-dialog";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

function getRelativeAge(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffYears >= 1) return `${diffYears} y`;
	if (diffMonths >= 1) return `${diffMonths} m`;
	if (diffDays >= 1) return `${diffDays} d`;
	return "Today";
}

/**
 * ItemAttributePage renders the inventory settings table for Item Attribute records.
 */
export default function ItemAttributePage() {
	const utils = trpc.useUtils();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [attributeToDelete, setAttributeToDelete] = React.useState<
		string | null
	>(null);

	const {
		data: rawAttributes = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listItemAttributes.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: Infinity,
	});

	type AttributeRow = Omit<
		(typeof rawAttributes)[number],
		"createdAt" | "updatedAt"
	> & {
		createdAt: Date;
		updatedAt: Date;
	};

	const attributes = React.useMemo<AttributeRow[]>(
		() =>
			rawAttributes.map((attr) => ({
				...attr,
				createdAt: new Date(attr.createdAt),
				updatedAt: new Date(attr.updatedAt),
			})),
		[rawAttributes],
	);

	const deleteMutation = trpc.inventory.deleteItemAttribute.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listItemAttributes.cancel();
			const previous = utils.inventory.listItemAttributes.getData();
			utils.inventory.listItemAttributes.setData(undefined, (old) => {
				if (!old) return old;
				return old.filter((attr) => attr.id !== id);
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Item Attribute deleted successfully");
			setIsDeleteDialogOpen(false);
			setAttributeToDelete(null);
		},
		onError: (error, _variables, context) => {
			if (context?.previous) {
				utils.inventory.listItemAttributes.setData(undefined, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listItemAttributes.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (attributeToDelete) {
			deleteMutation.mutate({ id: attributeToDelete });
		}
	}, [deleteMutation, attributeToDelete]);

	const columns = React.useMemo<ColumnDef<AttributeRow>[]>(
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
						aria-label={`Select ${row.original.name}`}
					/>
				),
				size: 40,
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
			{
				id: "attributeId",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="ID" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/inventory-settings/item-attribute/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.name}
					</Link>
				),
				meta: {
					label: "ID",
					searchable: true,
					exportable: true,
				},
			},
			{
				id: "status",
				accessorKey: "disabled",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) =>
					row.original.disabled ? (
						<Badge variant="outline" className="text-muted-foreground">
							Disabled
						</Badge>
					) : (
						<Badge
							variant="outline"
							className="border-green-500 text-green-600"
						>
							Enabled
						</Badge>
					),
				meta: {
					label: "Status",
					exportable: true,
				},
			},
			{
				id: "attributeName",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Attribute Name" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.name}
					</span>
				),
				meta: {
					label: "Attribute Name",
					searchable: true,
					exportable: true,
				},
			},
			{
				id: "valuesCount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Values" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.attributeValues.length}
					</span>
				),
				meta: {
					label: "Values",
					exportable: false,
				},
				enableSorting: false,
				enableColumnFilter: false,
			},
			{
				id: "age",
				accessorFn: (row) => row.updatedAt,
				header: () => <span className="text-muted-foreground"></span>,
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{getRelativeAge(row.original.updatedAt)}
					</span>
				),
				meta: {
					label: "Age",
					variant: "date",
					exportable: true,
				},
				size: 50,
			},
			{
				id: "counts",
				header: () => (
					<div className="text-right text-muted-foreground text-sm">
						{attributes.length} of {attributes.length}
					</div>
				),
				cell: () => (
					<div className="flex items-center justify-end gap-2 text-muted-foreground text-sm">
						<MessageCircle className="h-4 w-4" />
						<span>0</span>
						<Heart className="h-4 w-4" />
					</div>
				),
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
				size: 80,
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
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
								<Link
									href={`/inventory/inventory-settings/item-attribute/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Item Attribute
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setAttributeToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
								className="text-destructive focus:text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Item Attribute
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
		],
		[attributes.length],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<AttributeRow>({
		data: attributes,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "age", desc: true }],
		enableRowSelection: true,
		enableMultiRowSelection: true,
		enableGlobalFilter: true,
		onReload: handleReload,
	});

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Item Attribute</h1>
					<p className="text-muted-foreground">
						Manage item attributes used to define product variant dimensions
						such as Colour or Size
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
					title="Failed to load item attributes"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={attributes}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={<NewItemAttributeDialog />}
					ariaLabel="Item Attribute table"
				/>
			)}

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setAttributeToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
