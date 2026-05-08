"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
	CheckCircle2,
	Edit,
	MoreHorizontal,
	Plus,
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

function formatCalculationType(value: "FIXED" | "NET_TOTAL" | "NET_WEIGHT") {
	if (value === "FIXED") return "Fixed";
	if (value === "NET_TOTAL") return "Net Total";
	return "Net Weight";
}

export default function ShippingRulesPage() {
	const utils = trpc.useUtils();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [ruleToDelete, setRuleToDelete] = React.useState<string | null>(null);

	const {
		data: rawRules = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listShippingRules.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: Infinity,
	});

	type ShippingRuleRow = Omit<
		(typeof rawRules)[number],
		"createdAt" | "updatedAt"
	> & {
		createdAt: Date;
		updatedAt: Date;
	};

	const rules = React.useMemo<ShippingRuleRow[]>(
		() =>
			rawRules.map((rule) => ({
				...rule,
				createdAt: new Date(rule.createdAt),
				updatedAt: new Date(rule.updatedAt),
			})),
		[rawRules],
	);

	const deleteMutation = trpc.inventory.deleteShippingRule.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listShippingRules.cancel();
			const previous = utils.inventory.listShippingRules.getData();
			utils.inventory.listShippingRules.setData(undefined, (old) => {
				if (!old) return old;
				return old.filter((rule) => rule.id !== id);
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Shipping rule deleted successfully");
			setIsDeleteDialogOpen(false);
			setRuleToDelete(null);
		},
		onError: (error, _vars, context) => {
			if (context?.previous) {
				utils.inventory.listShippingRules.setData(undefined, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listShippingRules.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (ruleToDelete) {
			deleteMutation.mutate({ id: ruleToDelete });
		}
	}, [deleteMutation, ruleToDelete]);

	const columns = React.useMemo<ColumnDef<ShippingRuleRow>[]>(
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
						aria-label={`Select ${row.original.shippingRuleLabel}`}
					/>
				),
				size: 40,
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
			{
				accessorKey: "shippingRuleLabel",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Label" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/items-catalogue/shipping-rules/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.shippingRuleLabel}
					</Link>
				),
				meta: {
					label: "Label",
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
						<span className="text-muted-foreground text-sm">Disabled</span>
					) : (
						<span className="text-primary text-sm font-medium">Enabled</span>
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
				accessorKey: "calculateBasedOn",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Calculate Based On" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatCalculationType(row.original.calculateBasedOn)}
					</span>
				),
				meta: {
					label: "Calculate Based On",
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
									href={`/inventory/items-catalogue/shipping-rules/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Shipping Rule
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setRuleToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
								className="text-destructive focus:text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Shipping Rule
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
		],
		[],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<ShippingRuleRow>({
		data: rules,
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
					<h1 className="text-3xl font-bold tracking-tight">Shipping Rules</h1>
					<p className="text-muted-foreground">
						Manage shipping charge rules for buying and selling operations
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
							<Skeleton className="h-10 w-36" />
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
											<Skeleton className="h-4 w-16" />
										</th>
										<th className="p-3">
											<Skeleton className="h-4 w-28" />
										</th>
										<th className="p-3">
											<Skeleton className="h-4 w-12" />
										</th>
										<th className="p-3">
											<Skeleton className="h-4 w-8" />
										</th>
									</tr>
								</thead>
								<tbody>
									{Array.from({ length: 8 }).map((_, i) => (
										<tr key={i} className="border-t">
											<td className="p-3">
												<Skeleton className="h-4 w-4" />
											</td>
											<td className="p-3">
												<Skeleton className="h-4 w-24" />
											</td>
											<td className="p-3">
												<Skeleton className="h-4 w-16" />
											</td>
											<td className="p-3">
												<Skeleton className="h-4 w-28" />
											</td>
											<td className="p-3">
												<Skeleton className="h-4 w-12" />
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
					title="Failed to load shipping rules"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={rules}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={
						<Link
							href="/inventory/items-catalogue/shipping-rules/form"
							className={cn(buttonVariants({ variant: "default", size: "sm" }))}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Shipping Rule
						</Link>
					}
					ariaLabel="Shipping rules table"
				/>
			)}

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setRuleToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
