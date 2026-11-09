/**
 * Company List Page
 * Enterprise-grade table with full CRUD operations using tRPC + Advanced Data Table
 */

"use client";

import type { Company } from "@aria/types";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { Building2, Edit, Eye, MoreHorizontal, Trash } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import {
	AdvancedDataTable,
	type BulkAction,
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
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

type CompanySubscriptionEvent = {
	type: "created" | "updated" | "deleted";
	data: Company.CompanyItem | { id: string };
};

function CompanyRealtimeSubscription({
	onStarted,
	onData,
	onError,
}: {
	onStarted?: () => void;
	onData?: (event: CompanySubscriptionEvent) => void;
	onError?: (err: unknown) => void;
}) {
	trpc.company.onCompaniesChanged.useSubscription(undefined, {
		onStarted,
		onData,
		onError,
	});

	return null;
}

export default function CompanyListPage() {
	const utils = trpc.useUtils();

	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [companyToDelete, setCompanyToDelete] = React.useState<string | null>(
		null,
	);

	const handleDeleteRef = React.useRef<(id: string) => void>(() => {});
	handleDeleteRef.current = (id: string) => {
		setCompanyToDelete(id);
		setIsDeleteDialogOpen(true);
	};

	const handleDelete = React.useCallback((id: string) => {
		handleDeleteRef.current?.(id);
	}, []);

	const {
		data: rawData,
		isLoading,
		error: queryError,
	} = trpc.company.listCompanies.useQuery(undefined, {
		refetchOnWindowFocus: false,
		refetchOnMount: false,
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
		staleTime: Infinity,
		gcTime: 5 * 60 * 1000,
	});

	const rawCompanies = rawData?.items ?? [];

	const skeletonRowKeys = React.useMemo(
		() => Array.from({ length: 8 }, () => crypto.randomUUID()),
		[],
	);

	type CompanyRow = (typeof rawCompanies)[number];
	const companies: CompanyRow[] = rawCompanies;

	const errorCountRef = React.useRef(0);
	const lastErrorTimeRef = React.useRef(0);

	const handleSubscriptionData = React.useCallback(
		(_event: CompanySubscriptionEvent) => {
			void utils.company.listCompanies.invalidate();
		},
		[utils],
	);

	const handleSubscriptionError = React.useCallback((_error: unknown) => {
		errorCountRef.current += 1;
		const now = Date.now();
		const timeSinceLastError = now - lastErrorTimeRef.current;
		lastErrorTimeRef.current = now;
		if (errorCountRef.current >= 3 && timeSinceLastError < 5000) {
			toast.error("Real-time updates temporarily unavailable");
		}
	}, []);

	const handleSubscriptionStarted = React.useCallback(() => {
		errorCountRef.current = 0;
	}, []);

	const prevQueryErrorRef = React.useRef<unknown>(null);
	React.useEffect(() => {
		if (queryError && queryError !== prevQueryErrorRef.current) {
			prevQueryErrorRef.current = queryError;
			toast.error(getToastMessage(queryError, "load"));
		}
	}, [queryError]);

	const deleteMutation = trpc.company.deleteCompany.useMutation({
		onMutate: async (variables) => {
			await utils.company.listCompanies.cancel();
			const previous = utils.company.listCompanies.getData();
			utils.company.listCompanies.setData(undefined, (old) => {
				if (!old) return old;
				return {
					...old,
					items: old.items.filter((c) => c.id !== variables.id),
					totalCount: old.totalCount - 1,
				};
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Company deleted successfully");
			setIsDeleteDialogOpen(false);
			setCompanyToDelete(null);
		},
		onError: (error, _variables, context) => {
			if (context?.previous) {
				utils.company.listCompanies.setData(undefined, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.company.listCompanies.invalidate();
		},
	});

	const bulkDeleteMutation = trpc.company.deleteManyCompanies.useMutation({
		onMutate: async (variables) => {
			await utils.company.listCompanies.cancel();
			const previous = utils.company.listCompanies.getData();
			utils.company.listCompanies.setData(undefined, (old) => {
				if (!old) return old;
				return {
					...old,
					items: old.items.filter((c) => !variables.ids.includes(c.id)),
					totalCount: old.totalCount - variables.ids.length,
				};
			});
			return { previous };
		},
		onSuccess: (result) => {
			toast.success(`Successfully deleted ${result.count} company(ies)`);
		},
		onError: (error, _variables, context) => {
			if (context?.previous) {
				utils.company.listCompanies.setData(undefined, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.company.listCompanies.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (companyToDelete) {
			deleteMutation.mutate({ id: companyToDelete });
		}
	}, [companyToDelete, deleteMutation]);

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

	const columns = React.useMemo<ColumnDef<CompanyRow>[]>(
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
				size: 40,
				enableSorting: false,
				enableHiding: false,
				enableResizing: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
			{
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company Name" />
				),
				cell: ({ row }) => (
					<Link
						href={`/admin/company/${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.getValue("name")}
					</Link>
				),
				meta: {
					label: "Company Name",
					placeholder: "Search by name...",
					variant: "text",
					searchable: true,
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: true,
				enableGlobalFilter: true,
			},
			{
				accessorKey: "abbreviation",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Abbr" />
				),
				cell: ({ row }) => (
					<span className="font-mono text-xs text-muted-foreground">
						{row.getValue("abbreviation") ?? "—"}
					</span>
				),
				meta: {
					label: "Abbreviation",
					placeholder: "Search by abbr...",
					variant: "text",
					searchable: true,
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: true,
				enableGlobalFilter: true,
			},
			{
				accessorKey: "country",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Country" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.getValue("country") ?? "—"}
					</span>
				),
				meta: {
					label: "Country",
					placeholder: "Search by country...",
					variant: "text",
					searchable: true,
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: true,
				enableGlobalFilter: true,
			},
			{
				accessorKey: "currency",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Currency" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.getValue("currency") ?? "—"}
					</span>
				),
				meta: {
					label: "Currency",
					variant: "text",
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: true,
			},
			{
				id: "isGroup",
				accessorFn: (row) => row.isGroup,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Type" />
				),
				cell: ({ row }) => (
					<Badge
						className={
							row.original.isGroup
								? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0 text-xs font-medium"
								: "bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground border-0 text-xs font-medium"
						}
					>
						{row.original.isGroup ? "Group" : "Company"}
					</Badge>
				),
				meta: {
					label: "Type",
					variant: "multiSelect",
					options: [
						{ label: "Group", value: "true" },
						{ label: "Company", value: "false" },
					],
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: true,
			},
			{
				id: "status",
				accessorFn: (row) => (row.disabled ? "Disabled" : "Active"),
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => (
					<Badge
						className={
							row.original.disabled
								? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0 text-xs font-medium"
								: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0 text-xs font-medium"
						}
					>
						{row.original.disabled ? "Disabled" : "Active"}
					</Badge>
				),
				meta: {
					label: "Status",
					variant: "multiSelect",
					options: [
						{ label: "Active", value: "Active" },
						{ label: "Disabled", value: "Disabled" },
					],
					exportable: true,
				},
				enableSorting: true,
				enableColumnFilter: true,
			},
			{
				id: "age",
				accessorFn: (row) => row.createdAt,
				header: () => <span className="text-muted-foreground" />,
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{getRelativeAge(new Date(row.original.createdAt))}
					</span>
				),
				meta: {
					label: "Age",
					variant: "date",
					exportable: true,
				},
				enableSorting: true,
				size: 50,
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => {
					const company = row.original;
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
									<Link href={`/admin/company/${company.id}`}>
										<Eye className="mr-2 h-4 w-4" />
										View Details
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link href={`/admin/company/form?id=${company.id}`}>
										<Edit className="mr-2 h-4 w-4" />
										Edit Company
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => handleDelete(company.id)}
									className="text-destructive focus:text-destructive"
								>
									<Trash className="mr-2 h-4 w-4" />
									Delete Company
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
		[handleDelete, getRelativeAge],
	);

	const handleBulkDelete = React.useCallback(
		async (rows: readonly Row<CompanyRow>[]) => {
			const ids = rows.map((r) => r.original.id);
			try {
				await bulkDeleteMutation.mutateAsync({ ids });
			} catch {
				// Error toast is handled in the mutation lifecycle
			}
		},
		[bulkDeleteMutation],
	);

	const bulkActions = React.useMemo<BulkAction<CompanyRow>[]>(
		() => [
			{
				label: "Delete Selected",
				icon: <Trash className="h-4 w-4" />,
				action: handleBulkDelete,
				variant: "destructive",
				requiresConfirmation: true,
				confirmationMessage:
					"This will permanently delete the selected companies. This action cannot be undone.",
			},
		],
		[handleBulkDelete],
	);

	const handleReload = React.useCallback(async () => {
		await utils.company.listCompanies.refetch();
	}, [utils]);

	const { table } = useAdvancedDataTable({
		data: companies,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "name", desc: false }],
		enableRowSelection: true,
		enableMultiRowSelection: true,
		enableGlobalFilter: true,
		onReload: handleReload,
	});

	return (
		<>
			<CompanyRealtimeSubscription
				onStarted={handleSubscriptionStarted}
				onData={handleSubscriptionData}
				onError={handleSubscriptionError}
			/>

			<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div>
							<h1 className="text-3xl font-bold tracking-tight">Companies</h1>
							<p className="text-muted-foreground">
								Manage your companies and organizational structure
							</p>
						</div>
					</div>
				</div>

				{/* Loading State */}
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
												<Skeleton className="h-4 w-16" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-24" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-16" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-16" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-16" />
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
										{skeletonRowKeys.map((key) => (
											<tr key={key} className="border-t">
												<td className="p-3">
													<Skeleton className="h-4 w-4" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-32" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-16" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-24" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-16" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-16" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-16" />
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

				{/* Error State */}
				{queryError && !isLoading && (
					<ErrorState
						error={queryError}
						operation="load"
						title="Failed to load companies"
						onRetry={() => utils.company.listCompanies.refetch()}
					/>
				)}

				{/* Advanced Data Table */}
				{!isLoading && !queryError && (
					<AdvancedDataTable
						table={table}
						data={companies}
						enableGlobalSearch
						enableExport
						enableImport={false}
						enableBulkActions
						enableVirtualization
						enableColumnResizing
						enableColumnReordering
						exportFormats={["csv", "excel", "json", "pdf"]}
						bulkActions={bulkActions}
						primaryAction={
							<Button asChild>
								<Link href="/admin/company/form">
									<Building2 className="mr-2 h-4 w-4" />
									New Company
								</Link>
							</Button>
						}
						ariaLabel="Companies table"
						ariaDescription="A table of all companies with advanced filtering, sorting, and bulk actions"
					/>
				)}

				{/* Delete Confirmation */}
				<AlertModal
					isOpen={isDeleteDialogOpen}
					onClose={() => {
						setIsDeleteDialogOpen(false);
						setCompanyToDelete(null);
					}}
					onConfirm={confirmDelete}
					loading={deleteMutation.isPending}
				/>
			</div>
		</>
	);
}
