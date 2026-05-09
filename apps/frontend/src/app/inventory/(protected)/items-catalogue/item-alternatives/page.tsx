"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
	Edit,
	Heart,
	MessageCircle,
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
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

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

export default function ItemAlternativesPage() {
	const utils = trpc.useUtils();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [alternativeToDelete, setAlternativeToDelete] = React.useState<
		string | null
	>(null);

	const {
		data: rawAlternatives = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listItemAlternatives.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: Infinity,
	});

	type ItemAlternativeRow = Omit<
		(typeof rawAlternatives)[number],
		"createdAt" | "updatedAt"
	> & {
		createdAt: Date;
		updatedAt: Date;
	};

	const alternatives = React.useMemo<ItemAlternativeRow[]>(
		() =>
			rawAlternatives.map((alternative) => ({
				...alternative,
				createdAt: new Date(alternative.createdAt),
				updatedAt: new Date(alternative.updatedAt),
			})),
		[rawAlternatives],
	);

	const skeletonRowKeys = React.useMemo(
		() => Array.from({ length: 8 }, () => crypto.randomUUID()),
		[],
	);

	const deleteMutation = trpc.inventory.deleteItemAlternative.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listItemAlternatives.cancel();
			const previous = utils.inventory.listItemAlternatives.getData();
			utils.inventory.listItemAlternatives.setData(undefined, (old) => {
				if (!old) return old;
				return old.filter((row) => row.id !== id);
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Item alternative deleted successfully");
			setIsDeleteDialogOpen(false);
			setAlternativeToDelete(null);
		},
		onError: (error, _vars, context) => {
			if (context?.previous) {
				utils.inventory.listItemAlternatives.setData(
					undefined,
					context.previous,
				);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listItemAlternatives.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (alternativeToDelete) {
			deleteMutation.mutate({ id: alternativeToDelete });
		}
	}, [alternativeToDelete, deleteMutation]);

	const columns = React.useMemo<ColumnDef<ItemAlternativeRow>[]>(
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
						aria-label={`Select ${row.original.itemCode}`}
					/>
				),
				size: 40,
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
			{
				accessorKey: "itemCode",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Item Code" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/items-catalogue/item-alternatives/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.itemCode}
					</Link>
				),
				meta: {
					label: "Item Code",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "alternativeItemCode",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Alternative Item Code"
					/>
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.alternativeItemCode}
					</span>
				),
				meta: {
					label: "Alternative Item Code",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "id",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="ID" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.id}
					</span>
				),
				meta: {
					label: "ID",
					searchable: true,
					exportable: true,
				},
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
						{alternatives.length} of {alternatives.length}
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
									href={`/inventory/items-catalogue/item-alternatives/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Item Alternative
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setAlternativeToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
								className="text-destructive focus:text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Item Alternative
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
		],
		[alternatives.length],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<ItemAlternativeRow>({
		data: alternatives,
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
					<h1 className="text-3xl font-bold tracking-tight">
						Item Alternatives
					</h1>
					<p className="text-muted-foreground">
						Manage substitute item mappings for inventory operations
					</p>
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
											<Skeleton className="h-4 w-28" />
										</th>
										<th className="p-3">
											<Skeleton className="h-4 w-32" />
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
												<Skeleton className="h-4 w-28" />
											</td>
											<td className="p-3">
												<Skeleton className="h-4 w-32" />
											</td>
											<td className="p-3">
												<Skeleton className="h-4 w-12" />
											</td>
											<td className="p-3">
												<Skeleton className="h-4 w-8" />
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
					title="Failed to load item alternatives"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={alternatives}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={
						<Link
							href="/inventory/items-catalogue/item-alternatives/form"
							className={cn(buttonVariants({ variant: "default", size: "sm" }))}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Item Alternative
						</Link>
					}
					ariaLabel="Item alternatives table"
				/>
			)}

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setAlternativeToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
