"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Edit, MoreHorizontal, Plus, Trash } from "lucide-react";
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
import type { DeliveryTripStatus } from "./delivery-trip.utils";
import {
	DELIVERY_TRIP_STATUS_OPTIONS,
	formatDeliveryTripStatus,
	formatRelativeAge,
	getDeliveryTripStatusBadgeClass,
} from "./delivery-trip.utils";

/**
 * StatusBadge — coloured pill for a `DeliveryTripStatus` value.
 *
 * Pure display component; no side-effects.
 */
function StatusBadge({ status }: { status: DeliveryTripStatus }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				getDeliveryTripStatusBadgeClass(status),
			)}
		>
			{formatDeliveryTripStatus(status)}
		</span>
	);
}

/**
 * DeliveryTripPage — paginated list of all delivery trips.
 *
 * Fetches data via tRPC and renders an `AdvancedDataTable` with inline
 * create, edit, and delete actions. Client component (uses hooks).
 */
export default function DeliveryTripPage() {
	const utils = trpc.useUtils();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [deliveryTripToDelete, setDeliveryTripToDelete] = React.useState<
		string | null
	>(null);

	const {
		data: rawDeliveryTrips = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listDeliveryTrips.useQuery(
		{},
		{
			refetchOnWindowFocus: false,
			retry: 2,
			staleTime: 30_000,
		},
	);

	type DeliveryTripRow = Omit<
		(typeof rawDeliveryTrips)[number],
		"createdAt" | "updatedAt" | "departureTime"
	> & {
		createdAt: Date;
		updatedAt: Date;
		departureTime: Date | null;
	};

	const deliveryTrips = React.useMemo<DeliveryTripRow[]>(
		() =>
			rawDeliveryTrips.map((dt) => ({
				...dt,
				createdAt: new Date(dt.createdAt),
				updatedAt: new Date(dt.updatedAt),
				departureTime: dt.departureTime ? new Date(dt.departureTime) : null,
			})),
		[rawDeliveryTrips],
	);

	const deleteMutation = trpc.inventory.deleteDeliveryTrip.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listDeliveryTrips.cancel();
			const previous = utils.inventory.listDeliveryTrips.getData({});
			utils.inventory.listDeliveryTrips.setData({}, (old) => {
				if (!old) return old;
				return old.filter((dt) => dt.id !== id);
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Delivery trip deleted successfully");
			setIsDeleteDialogOpen(false);
			setDeliveryTripToDelete(null);
		},
		onError: (error, _vars, context) => {
			if (context?.previous) {
				utils.inventory.listDeliveryTrips.setData({}, context.previous);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listDeliveryTrips.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (deliveryTripToDelete) {
			deleteMutation.mutate({ id: deliveryTripToDelete });
		}
	}, [deleteMutation, deliveryTripToDelete]);

	const columns = React.useMemo<ColumnDef<DeliveryTripRow>[]>(
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
					<DataTableColumnHeader column={column} title="Series" />
				),
				cell: ({ row }) => (
					<Link
						href={`/inventory/stock-transaction/delivery-trip/form?id=${row.original.id}`}
						className="font-medium text-primary hover:underline"
					>
						{row.original.series}
					</Link>
				),
				meta: {
					label: "Series",
					searchable: true,
					exportable: true,
				},
			},
			{
				id: "status",
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => <StatusBadge status={row.original.status} />,
				meta: {
					label: "Status",
					variant: "multiSelect",
					options: DELIVERY_TRIP_STATUS_OPTIONS,
					exportable: true,
				},
				enableColumnFilter: true,
				filterFn: (row, _id, value) => {
					return (value as string[]).includes(row.original.status);
				},
			},
			{
				accessorKey: "driver",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Driver" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.driver ?? "—"}
					</span>
				),
				meta: {
					label: "Driver",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "vehicle",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Vehicle" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.vehicle ?? "—"}
					</span>
				),
				meta: {
					label: "Vehicle",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "company",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Company" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.company}
					</span>
				),
				meta: {
					label: "Company",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "departureTime",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Departure" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.departureTime
							? row.original.departureTime.toLocaleString()
							: "—"}
					</span>
				),
				meta: {
					label: "Departure Time",
					variant: "date",
					exportable: true,
				},
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
									href={`/inventory/stock-transaction/delivery-trip/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Delivery Trip
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setDeliveryTripToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
								className="text-destructive focus:text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Delivery Trip
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

	const { table } = useAdvancedDataTable<DeliveryTripRow>({
		data: deliveryTrips,
		columns,
		initialPageSize: 25,
		initialSorting: [{ id: "age", desc: true }],
		enableRowSelection: true,
		enableMultiRowSelection: true,
		enableGlobalFilter: true,
		onReload: handleReload,
	});

	return (
		<div className="container mx-auto py-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Delivery Trips</h1>
					<p className="text-muted-foreground">
						Manage delivery trips for outbound shipments
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
					title="Failed to load delivery trips"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={deliveryTrips}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={
						<Link
							href="/inventory/stock-transaction/delivery-trip/form"
							className={cn(buttonVariants({ variant: "default", size: "sm" }))}
						>
							<Plus className="mr-2 h-4 w-4" />
							New Delivery Trip
						</Link>
					}
					ariaLabel="Delivery trips table"
				/>
			)}

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setDeliveryTripToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
