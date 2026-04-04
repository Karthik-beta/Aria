"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import {
	Edit,
	Heart,
	Loader2,
	MessageCircle,
	MoreHorizontal,
	Plus,
	Trash,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { AlertModal } from "@/components/modal/alert-modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

type QuickFormValues = z.input<typeof Inventory.createItemManufacturerSchema>;

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

export default function ItemManufacturersPage() {
	const utils = trpc.useUtils();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [manufacturerToDelete, setManufacturerToDelete] = React.useState<
		string | null
	>(null);
	const [isQuickCreateOpen, setIsQuickCreateOpen] = React.useState(false);

	const {
		data: rawManufacturers = [],
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.listItemManufacturers.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: Infinity,
	});

	const { data: selectableItems = [] } =
		trpc.inventory.listBundleItems.useQuery();

	const quickForm = useForm<QuickFormValues>({
		resolver: zodResolver(Inventory.createItemManufacturerSchema),
		defaultValues: {
			itemId: "",
			manufacturer: "",
			manufacturerPartNumber: "",
			isDefault: false,
		},
	});

	React.useEffect(() => {
		if (!isQuickCreateOpen) {
			return;
		}

		const currentItemId = quickForm.getValues("itemId");
		if (!currentItemId && selectableItems.length > 0) {
			quickForm.setValue("itemId", selectableItems[0].id, {
				shouldDirty: false,
			});
		}
	}, [isQuickCreateOpen, quickForm, selectableItems]);

	type ItemManufacturerRow = Omit<
		(typeof rawManufacturers)[number],
		"createdAt" | "updatedAt"
	> & {
		createdAt: Date;
		updatedAt: Date;
	};

	const manufacturers = React.useMemo<ItemManufacturerRow[]>(
		() =>
			rawManufacturers.map((manufacturer) => ({
				...manufacturer,
				createdAt: new Date(manufacturer.createdAt),
				updatedAt: new Date(manufacturer.updatedAt),
			})),
		[rawManufacturers],
	);

	const createMutation = trpc.inventory.createItemManufacturer.useMutation({
		onSuccess: async () => {
			toast.success("Item manufacturer created successfully");
			setIsQuickCreateOpen(false);
			quickForm.reset({
				itemId: selectableItems[0]?.id ?? "",
				manufacturer: "",
				manufacturerPartNumber: "",
				isDefault: false,
			});
			await utils.inventory.listItemManufacturers.invalidate();
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const deleteMutation = trpc.inventory.deleteItemManufacturer.useMutation({
		onMutate: async ({ id }) => {
			await utils.inventory.listItemManufacturers.cancel();
			const previous = utils.inventory.listItemManufacturers.getData();
			utils.inventory.listItemManufacturers.setData(undefined, (old) => {
				if (!old) return old;
				return old.filter((row) => row.id !== id);
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Item manufacturer deleted successfully");
			setIsDeleteDialogOpen(false);
			setManufacturerToDelete(null);
		},
		onError: (error, _vars, context) => {
			if (context?.previous) {
				utils.inventory.listItemManufacturers.setData(
					undefined,
					context.previous,
				);
			}
			toast.error(getToastMessage(error, "delete"));
		},
		onSettled: () => {
			void utils.inventory.listItemManufacturers.invalidate();
		},
	});

	const confirmDelete = React.useCallback(() => {
		if (manufacturerToDelete) {
			deleteMutation.mutate({ id: manufacturerToDelete });
		}
	}, [deleteMutation, manufacturerToDelete]);

	const quickFormItemId = quickForm.watch("itemId");
	const quickFormManufacturer = quickForm.watch("manufacturer");
	const quickFormManufacturerPartNumber = quickForm.watch(
		"manufacturerPartNumber",
	);
	const quickFormIsDefault = quickForm.watch("isDefault");

	const editFullFormHref = React.useMemo(() => {
		const params = new URLSearchParams();
		if (quickFormItemId) {
			params.set("itemId", quickFormItemId);
		}
		if (quickFormManufacturer.trim()) {
			params.set("manufacturer", quickFormManufacturer.trim());
		}
		if (quickFormManufacturerPartNumber.trim()) {
			params.set(
				"manufacturerPartNumber",
				quickFormManufacturerPartNumber.trim(),
			);
		}
		if (quickFormIsDefault) {
			params.set("isDefault", "true");
		}

		const query = params.toString();
		return query
			? `/inventory/items-catalogue/manufacturers/form?${query}`
			: "/inventory/items-catalogue/manufacturers/form";
	}, [
		quickFormIsDefault,
		quickFormItemId,
		quickFormManufacturer,
		quickFormManufacturerPartNumber,
	]);

	const submitQuickCreate = quickForm.handleSubmit((values) => {
		const payload = {
			itemId: values.itemId,
			manufacturer: values.manufacturer.trim(),
			manufacturerPartNumber: values.manufacturerPartNumber.trim(),
			isDefault: values.isDefault ?? false,
		};

		const parsed = Inventory.createItemManufacturerSchema.safeParse(payload);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
			return;
		}

		createMutation.mutate(parsed.data);
	});

	const columns = React.useMemo<ColumnDef<ItemManufacturerRow>[]>(
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
						href={`/inventory/items-catalogue/manufacturers/form?id=${row.original.id}`}
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
				accessorKey: "manufacturer",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Manufacturer" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.manufacturer}
					</span>
				),
				meta: {
					label: "Manufacturer",
					searchable: true,
					exportable: true,
				},
			},
			{
				accessorKey: "manufacturerPartNumber",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Manufacturer Part Number"
					/>
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.manufacturerPartNumber}
					</span>
				),
				meta: {
					label: "Manufacturer Part Number",
					searchable: true,
					exportable: true,
				},
			},
			{
				id: "isDefault",
				accessorFn: (row) => row.isDefault,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Is Default" />
				),
				cell: ({ row }) => (
					<div className="flex items-center">
						<Checkbox
							checked={row.original.isDefault}
							disabled
							aria-label="Is default"
						/>
					</div>
				),
				meta: {
					label: "Is Default",
					exportable: true,
				},
				enableColumnFilter: false,
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
						{manufacturers.length} of {manufacturers.length}
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
									href={`/inventory/items-catalogue/manufacturers/form?id=${row.original.id}`}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit Item Manufacturer
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setManufacturerToDelete(row.original.id);
									setIsDeleteDialogOpen(true);
								}}
								className="text-destructive focus:text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Item Manufacturer
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
				enableColumnFilter: false,
				enableGlobalFilter: false,
			},
		],
		[manufacturers.length],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<ItemManufacturerRow>({
		data: manufacturers,
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
						Item Manufacturers
					</h1>
					<p className="text-muted-foreground">
						Manage manufacturer mappings and part numbers for inventory items
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
					title="Failed to load item manufacturers"
					onRetry={() => void refetch()}
				/>
			)}

			{!isLoading && !queryError && (
				<AdvancedDataTable
					table={table}
					data={manufacturers}
					enableGlobalSearch
					enableExport
					enableBulkActions={false}
					enableVirtualization
					enableColumnResizing
					enableColumnReordering
					primaryAction={
						<Button
							type="button"
							size="sm"
							onClick={() => setIsQuickCreateOpen(true)}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Item Manufacturer
						</Button>
					}
					ariaLabel="Item manufacturers table"
				/>
			)}

			<Dialog
				open={isQuickCreateOpen}
				onOpenChange={(open) => {
					setIsQuickCreateOpen(open);
					if (!open) {
						quickForm.reset({
							itemId: selectableItems[0]?.id ?? "",
							manufacturer: "",
							manufacturerPartNumber: "",
							isDefault: false,
						});
					}
				}}
			>
				<DialogContent className="max-w-[575px] gap-0 overflow-hidden p-0">
					<DialogHeader className="border-b px-5 py-4">
						<DialogTitle>New Item Manufacturer</DialogTitle>
					</DialogHeader>

					<form
						id="quick-create-manufacturer-form"
						onSubmit={submitQuickCreate}
						className="space-y-5 px-5 py-5"
					>
						<div className="space-y-2">
							<Label htmlFor="quick-item-code">Item Code *</Label>
							<Select
								value={quickFormItemId || undefined}
								onValueChange={(value) =>
									quickForm.setValue("itemId", value, { shouldDirty: true })
								}
							>
								<SelectTrigger id="quick-item-code">
									<SelectValue placeholder="Select item code" />
								</SelectTrigger>
								<SelectContent>
									{selectableItems.map((item) => (
										<SelectItem key={item.id} value={item.id}>
											{item.code}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{quickForm.formState.errors.itemId && (
								<p className="text-xs text-destructive">
									{quickForm.formState.errors.itemId.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="quick-manufacturer">Manufacturer *</Label>
							<Input
								id="quick-manufacturer"
								{...quickForm.register("manufacturer")}
								placeholder="Enter manufacturer"
							/>
							{quickForm.formState.errors.manufacturer && (
								<p className="text-xs text-destructive">
									{quickForm.formState.errors.manufacturer.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="quick-manufacturer-part-number">
								Manufacturer Part Number *
							</Label>
							<Input
								id="quick-manufacturer-part-number"
								{...quickForm.register("manufacturerPartNumber")}
								placeholder="Enter part number"
							/>
							{quickForm.formState.errors.manufacturerPartNumber && (
								<p className="text-xs text-destructive">
									{quickForm.formState.errors.manufacturerPartNumber.message}
								</p>
							)}
						</div>

						<div className="flex items-center gap-2">
							<Checkbox
								id="quick-is-default"
								checked={quickFormIsDefault}
								onCheckedChange={(checked) =>
									quickForm.setValue("isDefault", Boolean(checked), {
										shouldDirty: true,
									})
								}
							/>
							<Label htmlFor="quick-is-default">Is Default</Label>
						</div>
					</form>

					<DialogFooter className="flex items-center justify-between border-t px-5 py-4 sm:flex-row sm:justify-between">
						<Button asChild type="button" variant="secondary">
							<Link href={editFullFormHref}>Edit Full Form</Link>
						</Button>
						<Button
							type="submit"
							form="quick-create-manufacturer-form"
							disabled={createMutation.isPending}
						>
							{createMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Save"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => {
					setIsDeleteDialogOpen(false);
					setManufacturerToDelete(null);
				}}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
