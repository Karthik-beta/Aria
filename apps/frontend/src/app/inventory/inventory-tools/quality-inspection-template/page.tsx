/**
 * Quality Inspection Template list page.
 *
 * Renders a paginated table of all QI templates with inline delete,
 * bulk delete, and a link to create or edit a template.
 * Client component: uses hooks for tRPC queries and mutations.
 */
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Edit, MoreHorizontal, Plus, Trash } from "lucide-react";
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

function formatRelativeAge(date: Date): string {
	const diffMs = Date.now() - date.getTime();
	const diffDays = Math.floor(diffMs / 86_400_000);
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);
	if (diffYears >= 1) return `${diffYears} y`;
	if (diffMonths >= 1) return `${diffMonths} m`;
	if (diffDays >= 1) return `${diffDays} d`;
	return "Today";
}

/**
 * QualityInspectionTemplatePage — paginated list of all QI templates.
 *
 * Fetches data via tRPC, renders an AdvancedDataTable with create, edit,
 * and delete actions. Client component (uses hooks).
 */
export default function QualityInspectionTemplatePage() {
	const utils = trpc.useUtils();
	const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
	const [templateToDelete, setTemplateToDelete] = React.useState<string | null>(
		null,
	);
	const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);

	const {
		data: rawTemplates = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listQiTemplates.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	type TemplateRow = Omit<
		(typeof rawTemplates)[number],
		"createdAt" | "updatedAt"
	> & { createdAt: Date; updatedAt: Date };

	const templates = React.useMemo<TemplateRow[]>(
		() =>
			rawTemplates.map((t) => ({
				...t,
				createdAt: new Date(t.createdAt),
				updatedAt: new Date(t.updatedAt),
			})),
		[rawTemplates],
	);

	const deleteMutation = trpc.inventory.deleteQiTemplate.useMutation({
		onSuccess: () => {
			toast.success("Template deleted");
			setDeleteDialogOpen(false);
			setTemplateToDelete(null);
			void utils.inventory.listQiTemplates.invalidate();
		},
		onError: (err) => toast.error(getToastMessage(err, "delete")),
	});

	const bulkDeleteMutation = trpc.inventory.deleteManyQiTemplates.useMutation({
		onSuccess: ({ count }) => {
			toast.success(`${count} template${count === 1 ? "" : "s"} deleted`);
			setBulkDeleteDialogOpen(false);
			table.resetRowSelection();
			void utils.inventory.listQiTemplates.invalidate();
		},
		onError: (err) => toast.error(getToastMessage(err, "delete")),
	});

	const confirmDelete = React.useCallback(() => {
		if (templateToDelete) deleteMutation.mutate({ id: templateToDelete });
	}, [deleteMutation, templateToDelete]);

	const columns = React.useMemo<ColumnDef<TemplateRow>[]>(
		() => [
			{
				id: "select",
				header: ({ table }) => (
					<Checkbox
						checked={
							table.getIsAllPageRowsSelected() ||
							(table.getIsSomePageRowsSelected() ? "indeterminate" : false)
						}
						onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
						aria-label="Select all"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(v) => row.toggleSelected(!!v)}
						aria-label={`Select ${row.original.name}`}
					/>
				),
				size: 40,
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
			{
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Template Name" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/inventory-tools/quality-inspection-template/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.name}
					</Link>
				),
				meta: { label: "Template Name", searchable: true, exportable: true },
			},
			{
				id: "parameters",
				accessorFn: (row) => row.items.length,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Parameters" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.items.length}
					</span>
				),
				meta: { label: "Parameters", exportable: true },
				size: 100,
			},
			{
				id: "age",
				accessorFn: (row) => row.updatedAt,
				header: () => <span className="text-muted-foreground"></span>,
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatRelativeAge(row.original.updatedAt)}
					</span>
				),
				meta: { label: "Age", variant: "date", exportable: true },
				size: 50,
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
									href={`/inventory/inventory-tools/quality-inspection-template/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									View / Edit
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => {
									setTemplateToDelete(row.original.id);
									setDeleteDialogOpen(true);
								}}
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				size: 50,
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
		],
		[],
	);

	const { table } = useAdvancedDataTable({ data: templates, columns });

	const selectedIds = table
		.getSelectedRowModel()
		.rows.map((r) => r.original.id);

	if (queryError && !isLoading) {
		return (
			<ErrorState
				error={queryError}
				operation="load"
				title="Failed to load templates"
				onRetry={() => void refetch()}
			/>
		);
	}

	return (
		<div className="space-y-4 p-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<ClipboardList className="h-5 w-5 text-muted-foreground" />
					<h1 className="text-xl font-semibold">
						Quality Inspection Templates
					</h1>
				</div>
				<div className="flex items-center gap-2">
					{selectedIds.length > 0 && (
						<Button
							variant="destructive"
							size="sm"
							onClick={() => setBulkDeleteDialogOpen(true)}
						>
							<Trash className="mr-2 h-4 w-4" />
							Delete ({selectedIds.length})
						</Button>
					)}
					<Link
						href="/inventory/inventory-tools/quality-inspection-template/form"
						className={cn(buttonVariants({ size: "sm" }))}
					>
						<Plus className="mr-2 h-4 w-4" />
						New Template
					</Link>
				</div>
			</div>

			<AdvancedDataTable
				table={table}
				data={templates}
				enableGlobalSearch
				enableColumnResizing
				enableColumnReordering
				ariaLabel="Quality inspection templates table"
			/>

			<AlertModal
				isOpen={deleteDialogOpen}
				onClose={() => {
					setDeleteDialogOpen(false);
					setTemplateToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>

			<AlertModal
				isOpen={bulkDeleteDialogOpen}
				onClose={() => setBulkDeleteDialogOpen(false)}
				onConfirm={() => bulkDeleteMutation.mutate({ ids: selectedIds })}
				loading={bulkDeleteMutation.isPending}
			/>
		</div>
	);
}
