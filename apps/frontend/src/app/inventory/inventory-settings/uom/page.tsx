/**
 * Unit of Measure list page for the Inventory settings area.
 *
 * Client component: renders the CRUD table, delete confirmation, and quick-create entry point
 * while keeping all writes routed through tRPC and the shared inventory contract.
 */
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
	CheckCircle2,
	Edit,
	Heart,
	MessageCircle,
	MoreHorizontal,
	Trash,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import {
	AdvancedDataTable,
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
import { NewUomDialog } from "@/features/inventory/components/new-uom-dialog";
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
 * UnitOfMeasurePage renders the inventory settings table for UOM records.
 */
export default function UnitOfMeasurePage() {
	const utils = trpc.useUtils();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [uomToDelete, setUomToDelete] = React.useState<string | null>(null);

	const {
		data: rawUnits = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listUnitsOfMeasure.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: Infinity,
	});

	type UnitOfMeasureRow = Omit<
		(typeof rawUnits)[number],
		"createdAt" | "updatedAt"
	> & {
		createdAt: Date;
		updatedAt: Date;
	};

	const unitsOfMeasure = React.useMemo<UnitOfMeasureRow[]>(
		() =>
			rawUnits.map((unit) => ({
				...unit,
				createdAt: new Date(unit.createdAt),
				updatedAt: new Date(unit.updatedAt),
			})),
		[rawUnits],
	);

	const deleteMutation = trpc.inventory.deleteUnitOfMeasure.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listUnitsOfMeasure.cancel();
			const previous = utils.inventory.listUnitsOfMeasure.getData();
			utils.inventory.listUnitsOfMeasure.setData(undefined, (old) => {
				if (!old) return old;
				return old.filter((unit) => unit.id !== id);
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Unit of measure deleted successfully");
			setIsDeleteDialogOpen(false);
			setUomToDelete(null);
		},
		onError: (error, _variables, context) => {
			if (context?.previous) {
				utils.inventory.listUnitsOfMeasure.setData(undefined, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listUnitsOfMeasure.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (uomToDelete) {
			deleteMutation.mutate({ id: uomToDelete });
		}
	}, [deleteMutation, uomToDelete]);

	const columns = React.useMemo<ColumnDef<UnitOfMeasureRow>[]>(
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
				id: "uomId",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="ID" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/inventory-settings/uom/form?id=${row.original.id}`}
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
				accessorFn: (row) => (row.disabled ? "Disabled" : "Enabled"),
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) =>
					row.original.disabled ? (
						<span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
							Disabled
						</span>
					) : (
						<span className="inline-flex items-center rounded-full bg-[#e8f4ff] px-2.5 py-0.5 text-xs font-medium text-[#1976d2]">
							Enabled
						</span>
					),
				meta: {
					label: "Status",
					variant: "multiSelect",
					options: [
						{ label: "Enabled", value: "Enabled", icon: CheckCircle2 },
						{ label: "Disabled", value: "Disabled", icon: XCircle },
					],
					exportable: true,
				},
				enableColumnFilter: true,
				filterFn: (row, _id, value) => {
					const status = row.original.disabled ? "Disabled" : "Enabled";
					return value.includes(status);
				},
			},
			{
				id: "uomName",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="UOM Name" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.name}
					</span>
				),
				meta: {
					label: "UOM Name",
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
						{unitsOfMeasure.length} of {unitsOfMeasure.length}
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
									href={`/inventory/inventory-settings/uom/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit UOM
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setUomToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
								className="text-destructive focus:text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete UOM
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
		],
		[unitsOfMeasure.length],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<UnitOfMeasureRow>({
		data: unitsOfMeasure,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "age", desc: true }],
		enableRowSelection: true,
		enableMultiRowSelection: true,
		enableGlobalFilter: true,
		onReload: handleReload,
	});

	return (
		<div className="container mx-auto space-y-6 py-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Unit of Measure</h1>
					<p className="text-muted-foreground">
						Manage reusable unit records used across inventory, items, and
						bundles
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
					title="Failed to load units of measure"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={unitsOfMeasure}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={<NewUomDialog />}
					ariaLabel="Unit of measure table"
				/>
			)}

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setUomToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
