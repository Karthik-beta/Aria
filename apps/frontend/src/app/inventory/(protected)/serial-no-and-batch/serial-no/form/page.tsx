"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import {
	getSerialNoFormDefaults,
	type SerialNoFormValues,
	serialNoFormSchema,
} from "../serial-no.schema";
import {
	formatSerialNoStatus,
	getSerialNoStatusBadgeClass,
	toDateInputValue,
	toSerialNoMutationInput,
} from "../serial-no.utils";

function StatusBadge({ status }: { status: Inventory.SerialNoStatus }) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSerialNoStatusBadgeClass(status)}`}
		>
			{formatSerialNoStatus(status)}
		</span>
	);
}

export default function SerialNoFormPage() {
	return (
		<Suspense fallback={<SerialNoFormFallback />}>
			<SerialNoFormContent />
		</Suspense>
	);
}

function SerialNoFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<SerialNoFormValues>({
		resolver: zodResolver(serialNoFormSchema),
		defaultValues: getSerialNoFormDefaults(),
	});

	const { data: serialNo, isLoading: isFetchingSerialNo } =
		trpc.inventory.getSerialNoById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	const { data: rawItems = [] } = trpc.inventory.listItems.useQuery(undefined, {
		staleTime: 30_000,
	});
	const { data: warehouseOptions } = trpc.inventory.listWarehouses.useQuery(
		{ take: 250 },
		{ staleTime: 30_000 },
	);
	const { data: purchaseReceipts = [] } =
		trpc.inventory.listPurchaseReceipts.useQuery(
			{ take: 250 },
			{ staleTime: 30_000 },
		);
	const { data: deliveryNotes = [] } =
		trpc.inventory.listDeliveryNotes.useQuery(undefined, { staleTime: 30_000 });
	const { data: stockEntries = [] } = trpc.inventory.listStockEntries.useQuery(
		undefined,
		{ staleTime: 30_000 },
	);
	const { data: pickLists = [] } = trpc.inventory.listPickLists.useQuery(
		{ take: 250 },
		{ staleTime: 30_000 },
	);

	const itemOptions = useMemo(
		() => rawItems.filter((item) => item.hasSerialNo && !item.disabled),
		[rawItems],
	);

	useEffect(() => {
		if (!isEditMode || !serialNo) return;

		form.reset({
			serialNo: serialNo.serialNo,
			itemId: serialNo.itemId,
			company: serialNo.company,
			status: serialNo.status,
			currentWarehouseId: serialNo.currentWarehouseId ?? "",
			purchaseReceiptId: serialNo.purchaseReceiptId ?? "",
			deliveryNoteId: serialNo.deliveryNoteId ?? "",
			stockEntryId: serialNo.stockEntryId ?? "",
			pickListId: serialNo.pickListId ?? "",
			workOrder: serialNo.workOrder ?? "",
			purchaseDate: toDateInputValue(serialNo.purchaseDate),
			warrantyExpiryDate: toDateInputValue(serialNo.warrantyExpiryDate),
			serviceContractExpiryDate: toDateInputValue(
				serialNo.serviceContractExpiryDate,
			),
			maintenanceStatus: serialNo.maintenanceStatus ?? "",
			notes: serialNo.notes ?? "",
			isDisabled: serialNo.isDisabled,
		});
	}, [form, isEditMode, serialNo]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingSerialNo &&
			!serialNo &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Serial number not found");
			startTransition(() => {
				router.push("/inventory/serial-no-and-batch/serial-no");
			});
		}
	}, [isEditMode, isFetchingSerialNo, router, serialNo]);

	const selectedItemId = useWatch({ control: form.control, name: "itemId" });
	const selectedWarehouseId = useWatch({
		control: form.control,
		name: "currentWarehouseId",
	});
	const selectedStatus = useWatch({ control: form.control, name: "status" });
	const isDisabled = useWatch({ control: form.control, name: "isDisabled" });

	const selectedItem = useMemo(
		() => itemOptions.find((item) => item.id === selectedItemId),
		[itemOptions, selectedItemId],
	);
	const selectedWarehouse = useMemo(
		() =>
			(warehouseOptions?.items ?? []).find(
				(warehouse) => warehouse.id === selectedWarehouseId,
			),
		[selectedWarehouseId, warehouseOptions?.items],
	);

	useEffect(() => {
		if (!selectedWarehouse) return;
		if (form.getValues("company").trim().length > 0) return;
		form.setValue("company", selectedWarehouse.company, {
			shouldDirty: true,
		});
	}, [form, selectedWarehouse]);

	const createMutation = trpc.inventory.createSerialNo.useMutation({
		onSuccess: async () => {
			toast.success("Serial number created successfully");
			await utils.inventory.listSerialNos.invalidate();
			startTransition(() => {
				router.push("/inventory/serial-no-and-batch/serial-no");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateSerialNo.useMutation({
		onSuccess: async () => {
			toast.success("Serial number updated successfully");
			await utils.inventory.listSerialNos.invalidate();
			if (id) {
				await utils.inventory.getSerialNoById.invalidate({ id });
			}
			startTransition(() => {
				router.push("/inventory/serial-no-and-batch/serial-no");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: SerialNoFormValues) => {
		const payload = toSerialNoMutationInput(values);

		if (isEditMode && id) {
			const parsed = Inventory.updateSerialNoSchema.safeParse({
				id,
				...payload,
			});
			if (!parsed.success) {
				toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
				return;
			}

			updateMutation.mutate(parsed.data);
			return;
		}

		const parsed = Inventory.createSerialNoSchema.safeParse(payload);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
			return;
		}

		createMutation.mutate(parsed.data);
	};

	const isSubmitting =
		createMutation.isPending || updateMutation.isPending || isPending;

	if (isEditMode && isFetchingSerialNo) {
		return <SerialNoFormFallback />;
	}

	const title = isEditMode && serialNo ? serialNo.serialNo : "New Serial No";

	return (
		<div className="flex min-h-screen flex-col gap-4 bg-muted/30 px-4 py-4 md:px-6">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
					{form.formState.isDirty && (
						<Badge variant="secondary">Not Saved</Badge>
					)}
					{isEditMode && serialNo ? (
						<StatusBadge status={selectedStatus ?? "DRAFT"} />
					) : null}
				</div>
				<Button
					onClick={form.handleSubmit(onSubmit)}
					disabled={isSubmitting}
					className="h-9 px-6"
				>
					{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
				</Button>
			</div>

			<div className="rounded-xl border bg-background">
				<div className="border-b px-5 py-5">
					<h2 className="text-xl font-semibold">Serial Master</h2>
					<p className="text-sm text-muted-foreground">
						Define the serialized item, ownership, lifecycle status, and trace
						links.
					</p>
				</div>

				<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="serialNo">
							Serial No <span className="text-destructive">*</span>
						</Label>
						<Input
							id="serialNo"
							placeholder="Enter serial number"
							{...form.register("serialNo")}
						/>
						{form.formState.errors.serialNo && (
							<p className="text-xs text-destructive">
								{form.formState.errors.serialNo.message}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="itemId">
							Item <span className="text-destructive">*</span>
						</Label>
						<Select
							value={selectedItemId || undefined}
							onValueChange={(value) =>
								form.setValue("itemId", value, { shouldDirty: true })
							}
						>
							<SelectTrigger id="itemId">
								<SelectValue placeholder="Select serialized item" />
							</SelectTrigger>
							<SelectContent>
								{itemOptions.map((item) => (
									<SelectItem key={item.id} value={item.id}>
										{item.code}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{form.formState.errors.itemId && (
							<p className="text-xs text-destructive">
								{form.formState.errors.itemId.message}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="itemName">Item Name</Label>
						<Input
							id="itemName"
							value={selectedItem?.name ?? serialNo?.itemName ?? ""}
							readOnly
							placeholder="Selected item name"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="company">
							Company <span className="text-destructive">*</span>
						</Label>
						<Input
							id="company"
							placeholder="Enter company"
							{...form.register("company")}
						/>
						{form.formState.errors.company && (
							<p className="text-xs text-destructive">
								{form.formState.errors.company.message}
							</p>
						)}
					</div>
				</div>

				<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="status">Status</Label>
						<Select
							value={selectedStatus}
							onValueChange={(value: Inventory.SerialNoStatus) =>
								form.setValue("status", value, { shouldDirty: true })
							}
						>
							<SelectTrigger id="status">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Inventory.serialNoStatusSchema.options.map((status) => (
									<SelectItem key={status} value={status}>
										{formatSerialNoStatus(status)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="currentWarehouseId">Current Warehouse</Label>
						<Select
							value={selectedWarehouseId || "__none"}
							onValueChange={(value) =>
								form.setValue(
									"currentWarehouseId",
									value === "__none" ? "" : value,
									{ shouldDirty: true },
								)
							}
						>
							<SelectTrigger id="currentWarehouseId">
								<SelectValue placeholder="Select warehouse" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none">No warehouse</SelectItem>
								{(warehouseOptions?.items ?? []).map((warehouse) => (
									<SelectItem key={warehouse.id} value={warehouse.id}>
										{warehouse.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="workOrder">Work Order</Label>
						<Input
							id="workOrder"
							placeholder="Optional work order reference"
							{...form.register("workOrder")}
						/>
					</div>

					<div className="flex items-center gap-2 pt-7">
						<Checkbox
							id="isDisabled"
							checked={isDisabled}
							onCheckedChange={(checked) =>
								form.setValue("isDisabled", Boolean(checked), {
									shouldDirty: true,
								})
							}
						/>
						<Label htmlFor="isDisabled">Disable this serial number</Label>
					</div>
				</div>

				<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-3">
					<div className="space-y-2">
						<Label htmlFor="purchaseDate">Purchase Date</Label>
						<Input
							id="purchaseDate"
							type="date"
							{...form.register("purchaseDate")}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="warrantyExpiryDate">Warranty Expiry</Label>
						<Input
							id="warrantyExpiryDate"
							type="date"
							{...form.register("warrantyExpiryDate")}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="serviceContractExpiryDate">
							Service Contract Expiry
						</Label>
						<Input
							id="serviceContractExpiryDate"
							type="date"
							{...form.register("serviceContractExpiryDate")}
						/>
					</div>

					<div className="space-y-2 md:col-span-3">
						<Label htmlFor="maintenanceStatus">Maintenance Status</Label>
						<Input
							id="maintenanceStatus"
							placeholder="Optional maintenance state"
							{...form.register("maintenanceStatus")}
						/>
					</div>
				</div>

				<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="purchaseReceiptId">Purchase Receipt</Label>
						<Select
							value={form.getValues("purchaseReceiptId") || "__none"}
							onValueChange={(value) =>
								form.setValue(
									"purchaseReceiptId",
									value === "__none" ? "" : value,
									{ shouldDirty: true },
								)
							}
						>
							<SelectTrigger id="purchaseReceiptId">
								<SelectValue placeholder="Link purchase receipt" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none">No purchase receipt</SelectItem>
								{purchaseReceipts.map((receipt) => (
									<SelectItem key={receipt.id} value={receipt.id}>
										{receipt.series}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="deliveryNoteId">Delivery Note</Label>
						<Select
							value={form.getValues("deliveryNoteId") || "__none"}
							onValueChange={(value) =>
								form.setValue(
									"deliveryNoteId",
									value === "__none" ? "" : value,
									{ shouldDirty: true },
								)
							}
						>
							<SelectTrigger id="deliveryNoteId">
								<SelectValue placeholder="Link delivery note" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none">No delivery note</SelectItem>
								{deliveryNotes.map((note) => (
									<SelectItem key={note.id} value={note.id}>
										{note.series}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="stockEntryId">Stock Entry</Label>
						<Select
							value={form.getValues("stockEntryId") || "__none"}
							onValueChange={(value) =>
								form.setValue("stockEntryId", value === "__none" ? "" : value, {
									shouldDirty: true,
								})
							}
						>
							<SelectTrigger id="stockEntryId">
								<SelectValue placeholder="Link stock entry" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none">No stock entry</SelectItem>
								{stockEntries.map((entry) => (
									<SelectItem key={entry.id} value={entry.id}>
										{entry.series}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="pickListId">Pick List</Label>
						<Select
							value={form.getValues("pickListId") || "__none"}
							onValueChange={(value) =>
								form.setValue("pickListId", value === "__none" ? "" : value, {
									shouldDirty: true,
								})
							}
						>
							<SelectTrigger id="pickListId">
								<SelectValue placeholder="Link pick list" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none">No pick list</SelectItem>
								{pickLists.map((pickList) => (
									<SelectItem key={pickList.id} value={pickList.id}>
										{pickList.series}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="grid gap-6 px-5 py-5">
					<div className="space-y-2">
						<Label htmlFor="notes">Notes</Label>
						<Textarea
							id="notes"
							rows={5}
							placeholder="Add contextual notes for this serial number"
							{...form.register("notes")}
						/>
					</div>

					{serialNo ? (
						<div className="rounded-lg border bg-muted/20 p-4">
							<div className="mb-3 flex items-center justify-between">
								<h3 className="font-semibold">Lifecycle History</h3>
								<span className="text-xs text-muted-foreground">
									{serialNo.history.length} event
									{serialNo.history.length === 1 ? "" : "s"}
								</span>
							</div>
							<div className="space-y-3">
								{serialNo.history.map((entry) => (
									<div
										key={entry.id}
										className="rounded-md border bg-background p-3"
									>
										<div className="flex flex-wrap items-center gap-2">
											<Badge variant="outline">{entry.eventType}</Badge>
											{entry.toStatus ? (
												<StatusBadge status={entry.toStatus} />
											) : null}
											<span className="text-xs text-muted-foreground">
												{new Date(entry.createdAt).toLocaleString()}
											</span>
										</div>
										<div className="mt-2 text-sm text-muted-foreground">
											{entry.transactionLabel ?? "Manual update"}
											{entry.warehouseName ? ` • ${entry.warehouseName}` : ""}
										</div>
										{entry.notes ? (
											<p className="mt-2 text-sm">{entry.notes}</p>
										) : null}
									</div>
								))}
							</div>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

function SerialNoFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading serial number...
			</div>
		</div>
	);
}
