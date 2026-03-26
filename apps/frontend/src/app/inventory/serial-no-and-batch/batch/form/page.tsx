"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
	type BatchFormValues,
	batchFormSchema,
	getBatchFormDefaults,
} from "../batch.schema";
import {
	formatBatchStatus,
	getBatchStatusBadgeClass,
	toBatchMutationInput,
	toDateInputValue,
} from "../batch.utils";

function StatusBadge({ status }: { status: Inventory.BatchStatus }) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getBatchStatusBadgeClass(status)}`}
		>
			{formatBatchStatus(status)}
		</span>
	);
}

export default function BatchFormPage() {
	return (
		<Suspense fallback={<BatchFormFallback />}>
			<BatchFormContent />
		</Suspense>
	);
}

function BatchFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<BatchFormValues>({
		resolver: zodResolver(batchFormSchema),
		defaultValues: getBatchFormDefaults(),
	});

	const { data: batch, isLoading: isFetchingBatch } =
		trpc.inventory.getBatchById.useQuery(
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

	const itemOptions = useMemo(
		() => rawItems.filter((item) => item.hasBatchNo && !item.disabled),
		[rawItems],
	);

	useEffect(() => {
		if (!isEditMode || !batch) return;

		form.reset({
			batchId: batch.batchId,
			itemId: batch.itemId,
			company: batch.company,
			currentWarehouseId: batch.currentWarehouseId ?? "",
			purchaseReceiptId: batch.purchaseReceiptId ?? "",
			deliveryNoteId: batch.deliveryNoteId ?? "",
			stockEntryId: batch.stockEntryId ?? "",
			useBatchWiseValuation: batch.useBatchWiseValuation,
			manufacturingDate: toDateInputValue(batch.manufacturingDate),
			expiryDate: toDateInputValue(batch.expiryDate),
			description: batch.description ?? "",
			quantity: batch.quantity,
			isDisabled: batch.isDisabled,
		});
	}, [batch, form, isEditMode]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingBatch &&
			!batch &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Batch not found");
			startTransition(() => {
				router.push("/inventory/serial-no-and-batch/batch");
			});
		}
	}, [batch, isEditMode, isFetchingBatch, router]);

	const selectedItemId = useWatch({ control: form.control, name: "itemId" });
	const selectedWarehouseId = useWatch({
		control: form.control,
		name: "currentWarehouseId",
	});
	const selectedPurchaseReceiptId = useWatch({
		control: form.control,
		name: "purchaseReceiptId",
	});
	const selectedDeliveryNoteId = useWatch({
		control: form.control,
		name: "deliveryNoteId",
	});
	const selectedStockEntryId = useWatch({
		control: form.control,
		name: "stockEntryId",
	});
	const companyValue = useWatch({ control: form.control, name: "company" });
	const isDisabled = useWatch({ control: form.control, name: "isDisabled" });
	const useBatchWiseValuation = useWatch({
		control: form.control,
		name: "useBatchWiseValuation",
	});

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
	const lastAutoFilledWarehouseRef = useRef<string | null>(null);

	useEffect(() => {
		if (!selectedWarehouse) {
			lastAutoFilledWarehouseRef.current = null;
			return;
		}

		if (companyValue.trim().length > 0) return;
		if (lastAutoFilledWarehouseRef.current === selectedWarehouse.id) return;

		lastAutoFilledWarehouseRef.current = selectedWarehouse.id;
		form.setValue("company", selectedWarehouse.company, {
			shouldDirty: true,
			shouldValidate: true,
		});
	}, [companyValue, form, selectedWarehouse]);

	const createMutation = trpc.inventory.createBatch.useMutation({
		onSuccess: async () => {
			toast.success("Batch created successfully");
			await utils.inventory.listBatches.invalidate();
			startTransition(() => {
				router.push("/inventory/serial-no-and-batch/batch");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateBatch.useMutation({
		onSuccess: async () => {
			toast.success("Batch updated successfully");
			await utils.inventory.listBatches.invalidate();
			if (id) {
				await utils.inventory.getBatchById.invalidate({ id });
			}
			startTransition(() => {
				router.push("/inventory/serial-no-and-batch/batch");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: BatchFormValues) => {
		const payload = toBatchMutationInput(values);

		if (isEditMode && id) {
			const parsed = Inventory.updateBatchSchema.safeParse({
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

		const parsed = Inventory.createBatchSchema.safeParse(payload);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
			return;
		}

		createMutation.mutate(parsed.data);
	};

	const isSubmitting =
		createMutation.isPending || updateMutation.isPending || isPending;

	if (isEditMode && isFetchingBatch) {
		return <BatchFormFallback />;
	}

	const title = isEditMode && batch ? batch.batchId : "New Batch";

	return (
		<div className="flex min-h-screen flex-col gap-4 bg-muted/30 px-4 py-4 md:px-6">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
					{form.formState.isDirty && (
						<Badge variant="secondary">Not Saved</Badge>
					)}
					{isEditMode && batch ? <StatusBadge status={batch.status} /> : null}
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
					<h2 className="text-xl font-semibold">Batch Details</h2>
					<p className="text-sm text-muted-foreground">
						Maintain the batch identifier, traceability links, quantity on hand,
						and lifecycle dates.
					</p>
				</div>

				<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="batchId">
							Batch ID <span className="text-destructive">*</span>
						</Label>
						<Input
							id="batchId"
							placeholder="Enter batch ID"
							{...form.register("batchId")}
						/>
						{form.formState.errors.batchId && (
							<p className="text-xs text-destructive">
								{form.formState.errors.batchId.message}
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
								<SelectValue placeholder="Select batched item" />
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
							value={selectedItem?.name ?? batch?.itemName ?? ""}
							readOnly
							placeholder="Selected item name"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="company">
							Company <span className="text-destructive">*</span>
						</Label>
						<Controller
							control={form.control}
							name="company"
							render={({ field }) => (
								<Input
									id="company"
									placeholder="Enter company"
									{...field}
									value={field.value ?? ""}
								/>
							)}
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
						<Label htmlFor="quantity">Batch Quantity</Label>
						<Input
							id="quantity"
							type="number"
							min={0}
							step="0.001"
							{...form.register("quantity", {
								setValueAs: (value) => (value === "" ? 0 : Number(value)),
							})}
						/>
						{form.formState.errors.quantity && (
							<p className="text-xs text-destructive">
								{form.formState.errors.quantity.message}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="manufacturingDate">Manufacturing Date</Label>
						<Input
							id="manufacturingDate"
							type="date"
							{...form.register("manufacturingDate")}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="expiryDate">Expiry Date</Label>
						<Input
							id="expiryDate"
							type="date"
							{...form.register("expiryDate")}
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
						<Label htmlFor="isDisabled">Disable this batch</Label>
					</div>

					<div className="flex items-center gap-2 pt-7">
						<Checkbox
							id="useBatchWiseValuation"
							checked={useBatchWiseValuation}
							onCheckedChange={(checked) =>
								form.setValue("useBatchWiseValuation", Boolean(checked), {
									shouldDirty: true,
								})
							}
						/>
						<Label htmlFor="useBatchWiseValuation">
							Use batch-wise valuation
						</Label>
					</div>
				</div>

				<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-3">
					<div className="space-y-2">
						<Label htmlFor="purchaseReceiptId">Purchase Receipt</Label>
						<Select
							value={selectedPurchaseReceiptId || "__none"}
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
							value={selectedDeliveryNoteId || "__none"}
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
							value={selectedStockEntryId || "__none"}
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
				</div>

				<div className="grid gap-6 px-5 py-5">
					<div className="space-y-2">
						<Label htmlFor="description">Batch Description</Label>
						<Textarea
							id="description"
							rows={5}
							placeholder="Add contextual notes for this batch"
							{...form.register("description")}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

function BatchFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading batch...
			</div>
		</div>
	);
}
