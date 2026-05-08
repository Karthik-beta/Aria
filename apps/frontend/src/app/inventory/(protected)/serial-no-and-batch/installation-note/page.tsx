"use client";

import { Inventory } from "@aria/types";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Edit, MoreHorizontal, Plus, RefreshCw, Trash } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDeferredValue } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	buildInstallationNoteListInput,
	formatInstallationNoteStatus,
	formatRelativeAge,
	getInstallationNoteStatusBadgeClass,
	INSTALLATION_NOTE_PAGE_SIZE,
} from "./installation-note.utils";

type InstallationNoteRow = Omit<
	Inventory.InstallationNote,
	"createdAt" | "updatedAt" | "installationDate"
> & {
	createdAt: Date;
	updatedAt: Date;
	installationDate: Date;
};

type StatusFilter = "all" | Inventory.InstallationNoteStatus;

function StatusBadge({ status }: { status: Inventory.InstallationNoteStatus }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				getInstallationNoteStatusBadgeClass(status),
			)}
		>
			{formatInstallationNoteStatus(status)}
		</span>
	);
}

function InstallationNoteRealtimeSubscription({
	onData,
}: {
	onData: (event: { type: "created" | "updated" | "deleted" }) => void;
}) {
	trpc.inventory.onInstallationNotesChanged.useSubscription(undefined, {
		onData,
	});

	return null;
}

export default function InstallationNotePage() {
	const utils = trpc.useUtils();
	const [search, setSearch] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
	const [company, setCompany] = React.useState("");
	const [deliveryNoteId, setDeliveryNoteId] = React.useState("");
	const [sortBy, setSortBy] =
		React.useState<Inventory.InstallationNoteSortBy>("updatedAt");
	const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
		"desc",
	);
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: INSTALLATION_NOTE_PAGE_SIZE,
	});
	const [noteToDelete, setNoteToDelete] = React.useState<string | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	const deferredSearch = useDeferredValue(search);
	const deferredCompany = useDeferredValue(company);

	const resetToFirstPage = React.useCallback(() => {
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);

	const queryInput = React.useMemo(
		() =>
			buildInstallationNoteListInput({
				search: deferredSearch,
				status: statusFilter,
				company: deferredCompany,
				deliveryNoteId,
				pageIndex: pagination.pageIndex,
				pageSize: pagination.pageSize,
				sortBy,
				sortDirection,
			}),
		[
			deferredCompany,
			deferredSearch,
			deliveryNoteId,
			pagination.pageIndex,
			pagination.pageSize,
			sortBy,
			sortDirection,
			statusFilter,
		],
	);

	const {
		data,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listInstallationNotes.useQuery(queryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		placeholderData: (previous) => previous,
	});

	const { data: deliveryNotes = [] } =
		trpc.inventory.listDeliveryNotes.useQuery(undefined, {
			staleTime: 30_000,
		});

	const installationNotes = React.useMemo<InstallationNoteRow[]>(
		() =>
			(data?.items ?? []).map((entry) => ({
				...entry,
				createdAt: new Date(entry.createdAt),
				updatedAt: new Date(entry.updatedAt),
				installationDate: new Date(entry.installationDate),
			})),
		[data?.items],
	);

	const totalCount = data?.totalCount ?? 0;
	const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

	const deleteMutation = trpc.inventory.deleteInstallationNote.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listInstallationNotes.cancel(queryInput);
			const previous =
				utils.inventory.listInstallationNotes.getData(queryInput);
			utils.inventory.listInstallationNotes.setData(queryInput, (current) => {
				if (!current) return current;
				return {
					...current,
					items: current.items.filter((entry) => entry.id !== id),
					totalCount: Math.max(0, current.totalCount - 1),
				};
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Installation note deleted successfully");
			setNoteToDelete(null);
			setIsDeleteDialogOpen(false);
		},
		onError: (error, _variables, context) => {
			if (context?.previous) {
				utils.inventory.listInstallationNotes.setData(
					queryInput,
					context.previous,
				);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listInstallationNotes.invalidate();
		},
	});

	const columns = React.useMemo<ColumnDef<InstallationNoteRow>[]>(
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
							table.toggleAllPageRowsSelected(Boolean(value))
						}
						aria-label="Select all installation notes"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
						aria-label={`Select ${row.original.series}`}
					/>
				),
				size: 40,
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
			{
				accessorKey: "series",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="ID" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/serial-no-and-batch/installation-note/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.series}
					</Link>
				),
				meta: { label: "ID", exportable: true },
			},
			{
				accessorKey: "customer",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Customer" />
				),
				cell: ({ row }) => row.original.customer,
				meta: { label: "Customer", exportable: true },
			},
			{
				accessorKey: "customerName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Name" />
				),
				cell: ({ row }) => row.original.customerName || row.original.customer,
				meta: { label: "Name", exportable: true },
			},
			{
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => <StatusBadge status={row.original.status} />,
				meta: { label: "Status", exportable: true },
			},
			{
				accessorKey: "company",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company" />
				),
				cell: ({ row }) => row.original.company,
				meta: { label: "Company", exportable: true },
			},
			{
				accessorKey: "deliveryNoteSeries",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Delivery Note" />
				),
				cell: ({ row }) => row.original.deliveryNoteSeries ?? "Direct",
				meta: { label: "Delivery Note", exportable: true },
			},
			{
				accessorKey: "installationDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Installation Date" />
				),
				cell: ({ row }) => row.original.installationDate.toLocaleDateString(),
				meta: { label: "Installation Date", exportable: true },
			},
			{
				id: "itemCount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Items" />
				),
				cell: ({ row }) => row.original.items.length,
				meta: { label: "Items", exportable: true },
			},
			{
				id: "updatedAt",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Last Updated" />
				),
				cell: ({ row }) => formatRelativeAge(row.original.updatedAt),
				meta: { label: "Last Updated", exportable: true },
			},
			{
				id: "actions",
				header: () => <span className="sr-only">Actions</span>,
				cell: ({ row }) => (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								aria-label={`Open actions for ${row.original.series}`}
							>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuItem asChild>
								<Link
									href={`/inventory/serial-no-and-batch/installation-note/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Installation Note
								</Link>
							</DropdownMenuItem>
							{row.original.status === "DRAFT" ? (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-destructive focus:text-destructive"
										onClick={() => {
											setNoteToDelete(row.original.id);
											setIsDeleteDialogOpen(true);
										}}
									>
										<Trash className="mr-2 h-4 w-4" />
										Delete Installation Note
									</DropdownMenuItem>
								</>
							) : null}
						</DropdownMenuContent>
					</DropdownMenu>
				),
				size: 60,
			},
		],
		[],
	);

	const { table } = useAdvancedDataTable<InstallationNoteRow>({
		data: installationNotes,
		columns,
		pageCount,
		onPaginationChange: setPagination,
		getRowId: (row) => row.id,
		enableGlobalFilter: false,
	});

	const handleRealtimeData = React.useCallback(
		(_event: { type: "created" | "updated" | "deleted" }) => {
			void utils.inventory.listInstallationNotes.invalidate();
		},
		[utils],
	);

	const confirmDelete = React.useCallback(() => {
		if (!noteToDelete) return;
		deleteMutation.mutate({ id: noteToDelete });
	}, [deleteMutation, noteToDelete]);

	if (queryError) {
		return (
			<div className="flex flex-col gap-6 px-4 py-6 md:px-6">
				<ErrorState
					error={queryError}
					title="Unable to load installation notes"
					onRetry={() => void refetch()}
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 px-4 py-6 md:px-6">
			<InstallationNoteRealtimeSubscription onData={handleRealtimeData} />

			<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Installation Note
					</h1>
					<p className="text-sm text-muted-foreground">
						Track customer installations, serialised deployments, and delivery
						note handoffs.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => void refetch()}>
						<RefreshCw className="mr-2 h-4 w-4" />
						Refresh
					</Button>
					<Button asChild>
						<Link href="/inventory/serial-no-and-batch/installation-note/form">
							<Plus className="mr-2 h-4 w-4" />
							Add Installation Note
						</Link>
					</Button>
				</div>
			</div>

			<div className="rounded-xl border bg-background p-4">
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
					<div className="space-y-2 xl:col-span-2">
						<Label htmlFor="installation-note-search">Search</Label>
						<Input
							id="installation-note-search"
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								resetToFirstPage();
							}}
							placeholder="Series, customer, remarks, serial..."
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="installation-note-status-filter">Status</Label>
						<Select
							value={statusFilter}
							onValueChange={(value: StatusFilter) => {
								setStatusFilter(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="installation-note-status-filter">
								<SelectValue placeholder="All statuses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								{Inventory.installationNoteStatusSchema.options.map(
									(status) => (
										<SelectItem key={status} value={status}>
											{formatInstallationNoteStatus(status)}
										</SelectItem>
									),
								)}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="installation-note-delivery-note">
							Delivery Note
						</Label>
						<Select
							value={deliveryNoteId || "__all"}
							onValueChange={(value) => {
								setDeliveryNoteId(value === "__all" ? "" : value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="installation-note-delivery-note">
								<SelectValue placeholder="All delivery notes" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__all">All delivery notes</SelectItem>
								{deliveryNotes.map((note) => (
									<SelectItem key={note.id} value={note.id}>
										{note.series}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="installation-note-company-filter">Company</Label>
						<Input
							id="installation-note-company-filter"
							value={company}
							onChange={(event) => {
								setCompany(event.target.value);
								resetToFirstPage();
							}}
							placeholder="Filter by company"
						/>
					</div>
				</div>

				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="installation-note-sort-by">Sort By</Label>
						<Select
							value={sortBy}
							onValueChange={(value: Inventory.InstallationNoteSortBy) => {
								setSortBy(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="installation-note-sort-by">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="updatedAt">Last Updated</SelectItem>
								<SelectItem value="createdAt">Created On</SelectItem>
								<SelectItem value="series">ID</SelectItem>
								<SelectItem value="installationDate">
									Installation Date
								</SelectItem>
								<SelectItem value="customer">Customer</SelectItem>
								<SelectItem value="status">Status</SelectItem>
								<SelectItem value="company">Company</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="installation-note-sort-direction">Direction</Label>
						<Select
							value={sortDirection}
							onValueChange={(value: "asc" | "desc") => {
								setSortDirection(value);
								resetToFirstPage();
							}}
						>
							<SelectTrigger id="installation-note-sort-direction">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="desc">Descending</SelectItem>
								<SelectItem value="asc">Ascending</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			{isLoading && (
				<div className="flex items-center justify-center py-12">
					<DataTableSkeleton columnCount={8} rowCount={8} />
				</div>
			)}

			{!isLoading && (
				<AdvancedDataTable
					table={table}
					data={installationNotes}
					enableGlobalSearch={false}
					enableBulkActions={false}
					enableExport={false}
					enableImport={false}
				/>
			)}

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setNoteToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
