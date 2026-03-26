"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Form values used by react-hook-form (covers create + update in one shape) */
type PackingSlipFormValues = Omit<
	z.input<typeof Inventory.createPackingSlipSchema>,
	"items"
> & {
	items: Array<
		z.input<typeof Inventory.createPackingSlipItemSchema> & { id?: string }
	>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE_CLASS: Record<string, string> = {
	DRAFT:
		"border-none bg-zinc-100 text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300",
	SUBMITTED:
		"border-none bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900 dark:text-green-300",
	CANCELLED:
		"border-none bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900 dark:text-red-300",
};

const STATUS_LABEL: Record<string, string> = {
	DRAFT: "Draft",
	SUBMITTED: "Submitted",
	CANCELLED: "Cancelled",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PackingSlipFormPage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			}
		>
			<PackingSlipFormContent />
		</Suspense>
	);
}

// ── Form content ──────────────────────────────────────────────────────────────

/**
 * PackingSlipFormContent — create/edit form for a single packing slip.
 *
 * Reads `?id=` from the URL to determine create vs. edit mode.
 * On delivery note change the form auto-populates unpacked items from
 * the delivery note. The "From Package No." field shows the
 * recommended next case number via `getRecommendedCaseNo`.
 *
 * Client component: uses hooks and browser APIs.
 */
function PackingSlipFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<PackingSlipFormValues>({
		resolver: zodResolver(Inventory.createPackingSlipSchema),
		defaultValues: {
			deliveryNoteId: "",
			fromCaseNo: 1,
			toCaseNo: undefined,
			grossWeightPkg: undefined,
			grossWeightUom: null,
			letterHead: null,
			items: [],
		},
	});

	const {
		fields: itemFields,
		append: appendItem,
		remove: removeItem,
		replace: replaceItems,
	} = useFieldArray({ control: form.control, name: "items" });

	// ── Load existing record in edit mode ─────────────────────────────────────

	const { data: packingSlip, isLoading: isFetchingSlip } =
		trpc.inventory.getPackingSlipById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	useEffect(() => {
		if (!isEditMode || !packingSlip) return;
		form.reset({
			deliveryNoteId: packingSlip.deliveryNoteId,
			fromCaseNo: packingSlip.fromCaseNo,
			toCaseNo: packingSlip.toCaseNo ?? undefined,
			grossWeightPkg: packingSlip.grossWeightPkg ?? undefined,
			grossWeightUom: packingSlip.grossWeightUom ?? null,
			letterHead: packingSlip.letterHead ?? null,
			items: packingSlip.items.map((item) => ({
				id: item.id,
				deliveryNoteItemId: item.deliveryNoteItemId,
				itemCode: item.itemCode,
				itemName: item.itemName ?? null,
				description: item.description ?? null,
				qty: item.qty,
				netWeight: item.netWeight ?? 0,
				weightUom: item.weightUom ?? null,
				batchNo: item.batchNo ?? null,
			})),
		});
	}, [form, isEditMode, packingSlip]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingSlip &&
			!packingSlip &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Packing slip not found");
			startTransition(() => {
				router.push("/inventory/inventory-tools/packing-slip");
			});
		}
	}, [isEditMode, isFetchingSlip, packingSlip, router]);

	// ── Auto-populate items when delivery note is selected ────────────────────

	const watchedDeliveryNoteId = form.watch("deliveryNoteId");

	const { data: deliveryNote, isLoading: isFetchingDN } =
		trpc.inventory.getDeliveryNoteById.useQuery(
			{ id: watchedDeliveryNoteId },
			{ enabled: !isEditMode && watchedDeliveryNoteId.trim().length > 0 },
		);

	useEffect(() => {
		if (isEditMode || !deliveryNote) return;
		const unpackedItems = deliveryNote.items.filter(
			(item) => (item.quantity ?? 0) - (item.packedQty ?? 0) > 0,
		);
		replaceItems(
			unpackedItems.map((item) => ({
				deliveryNoteItemId: item.id,
				itemCode: item.itemCode ?? "",
				itemName: item.itemName ?? null,
				description: item.description ?? null,
				qty: (item.quantity ?? 0) - (item.packedQty ?? 0),
				netWeight: 0,
				weightUom: null,
				batchNo: null,
			})),
		);
	}, [deliveryNote, isEditMode, replaceItems]);

	// ── Recommend next case number ────────────────────────────────────────────

	const { data: recommendedCaseNo } =
		trpc.inventory.getRecommendedCaseNo.useQuery(
			{ deliveryNoteId: watchedDeliveryNoteId },
			{
				enabled: !isEditMode && watchedDeliveryNoteId.trim().length > 0,
				staleTime: 5_000,
			},
		);

	useEffect(() => {
		if (
			isEditMode ||
			recommendedCaseNo === undefined ||
			recommendedCaseNo === null
		)
			return;
		const currentFrom = form.getValues("fromCaseNo");
		if (currentFrom === 1) {
			form.setValue("fromCaseNo", recommendedCaseNo, { shouldValidate: false });
		}
	}, [recommendedCaseNo, isEditMode, form]);

	// ── Mutations ─────────────────────────────────────────────────────────────

	const createMutation = trpc.inventory.createPackingSlip.useMutation({
		onSuccess: async () => {
			toast.success("Packing slip created");
			await utils.inventory.listPackingSlips.invalidate();
			startTransition(() => {
				router.push("/inventory/inventory-tools/packing-slip");
			});
		},
		onError: (error) => toast.error(getToastMessage(error, "create")),
	});

	const updateMutation = trpc.inventory.updatePackingSlip.useMutation({
		onSuccess: async () => {
			toast.success("Packing slip updated");
			await utils.inventory.listPackingSlips.invalidate();
			startTransition(() => {
				router.push("/inventory/inventory-tools/packing-slip");
			});
		},
		onError: (error) => toast.error(getToastMessage(error, "update")),
	});

	const submitSlipMutation = trpc.inventory.submitPackingSlip.useMutation({
		onSuccess: async () => {
			toast.success("Packing slip submitted");
			await utils.inventory.listPackingSlips.invalidate();
			await utils.inventory.getPackingSlipById.invalidate({ id: id ?? "" });
		},
		onError: (error) => toast.error(getToastMessage(error, "submit")),
	});

	const cancelSlipMutation = trpc.inventory.cancelPackingSlip.useMutation({
		onSuccess: async () => {
			toast.success("Packing slip cancelled");
			await utils.inventory.listPackingSlips.invalidate();
			await utils.inventory.getPackingSlipById.invalidate({ id: id ?? "" });
		},
		onError: (error) => toast.error(getToastMessage(error, "cancel")),
	});

	// ── Submit handler ────────────────────────────────────────────────────────

	const onSubmit = (values: PackingSlipFormValues) => {
		const normalizedItems = values.items.map((item) => ({
			id: isEditMode ? item.id : undefined,
			deliveryNoteItemId: item.deliveryNoteItemId,
			itemCode: item.itemCode.trim(),
			itemName: item.itemName?.trim() || null,
			description: item.description?.trim() || null,
			qty: item.qty,
			netWeight: item.netWeight ?? 0,
			weightUom: item.weightUom?.trim() || null,
			batchNo: item.batchNo?.trim() || null,
		}));

		if (isEditMode && id) {
			updateMutation.mutate({
				id,
				fromCaseNo: values.fromCaseNo,
				toCaseNo: values.toCaseNo ?? undefined,
				grossWeightPkg: values.grossWeightPkg ?? undefined,
				grossWeightUom: values.grossWeightUom ?? null,
				letterHead: values.letterHead ?? null,
				items: normalizedItems,
			});
			return;
		}

		createMutation.mutate({
			deliveryNoteId: values.deliveryNoteId.trim(),
			fromCaseNo: values.fromCaseNo,
			toCaseNo: values.toCaseNo ?? undefined,
			grossWeightPkg: values.grossWeightPkg ?? undefined,
			grossWeightUom: values.grossWeightUom ?? null,
			letterHead: values.letterHead ?? null,
			items: normalizedItems,
		});
	};

	// ── Derived state ─────────────────────────────────────────────────────────

	const isReadonly =
		isEditMode &&
		(packingSlip?.status === "SUBMITTED" ||
			packingSlip?.status === "CANCELLED");

	const isSubmitting =
		createMutation.isPending ||
		updateMutation.isPending ||
		submitSlipMutation.isPending ||
		cancelSlipMutation.isPending ||
		isPending;

	const currentStatus = packingSlip?.status;

	// ── Loading skeleton ──────────────────────────────────────────────────────

	if (isEditMode && isFetchingSlip) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<div className="flex min-h-screen flex-col bg-muted/20 px-4 py-4 md:px-6">
			{/* ── Header ── */}
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">
						{isEditMode
							? (packingSlip?.series ?? "Edit Packing Slip")
							: "New Packing Slip"}
					</h1>
					{currentStatus && (
						<Badge className={STATUS_BADGE_CLASS[currentStatus] ?? ""}>
							{STATUS_LABEL[currentStatus] ?? currentStatus}
						</Badge>
					)}
					{!isReadonly && form.formState.isDirty && (
						<Badge className="border-none bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-300">
							Not Saved
						</Badge>
					)}
				</div>

				<div className="flex items-center gap-2">
					{isEditMode && currentStatus === "DRAFT" && (
						<Button
							variant="outline"
							size="sm"
							disabled={isSubmitting}
							onClick={() => {
								if (id) submitSlipMutation.mutate({ id });
							}}
						>
							{submitSlipMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Submit"
							)}
						</Button>
					)}
					{isEditMode && currentStatus === "SUBMITTED" && (
						<Button
							variant="outline"
							size="sm"
							disabled={isSubmitting}
							onClick={() => {
								if (id) cancelSlipMutation.mutate({ id });
							}}
						>
							{cancelSlipMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Cancel Slip"
							)}
						</Button>
					)}
					{!isReadonly && (
						<Button
							onClick={form.handleSubmit(onSubmit)}
							disabled={isSubmitting}
							className="h-9 px-6"
						>
							{isSubmitting ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Save"
							)}
						</Button>
					)}
				</div>
			</div>

			{/* ── Form card ── */}
			<div className="overflow-hidden rounded-lg border bg-background shadow-sm">
				<Tabs defaultValue="details" className="w-full">
					<div className="border-b px-4 py-2">
						<TabsList>
							<TabsTrigger value="details">Details</TabsTrigger>
							<TabsTrigger value="items">
								Items
								{itemFields.length > 0 && (
									<span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
										{itemFields.length}
									</span>
								)}
							</TabsTrigger>
						</TabsList>
					</div>

					{/* ── Details tab ── */}
					<TabsContent
						value="details"
						className="m-0 focus-visible:outline-none"
					>
						<div className="grid gap-6 px-5 pb-4 pt-5 md:grid-cols-3">
							{/* Series (readonly, edit mode only) */}
							{isEditMode && (
								<div className="space-y-2">
									<Label>Series</Label>
									<Input
										value={packingSlip?.series ?? ""}
										readOnly
										className="bg-muted"
									/>
								</div>
							)}

							{/* Delivery Note */}
							<div className="space-y-2">
								<Label htmlFor="deliveryNoteId">
									Delivery Note <span className="text-destructive">*</span>
								</Label>
								<div className="relative">
									<Input
										id="deliveryNoteId"
										placeholder="e.g. DN-2025-00001"
										disabled={isEditMode || isReadonly}
										{...form.register("deliveryNoteId")}
										className={
											isEditMode || isReadonly ? "bg-muted" : undefined
										}
									/>
									{!isEditMode && isFetchingDN && (
										<Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
									)}
								</div>
								{form.formState.errors.deliveryNoteId && (
									<p className="text-xs text-destructive">
										{form.formState.errors.deliveryNoteId.message}
									</p>
								)}
								{!isEditMode && deliveryNote && (
									<p className="text-xs text-muted-foreground">
										{`Customer: ${deliveryNote.customer}`} &mdash;{" "}
										{deliveryNote.items.length} item(s)
									</p>
								)}
							</div>

							{/* From Package No. */}
							<div className="space-y-2">
								<Label htmlFor="fromCaseNo">
									From Package No. <span className="text-destructive">*</span>
								</Label>
								<Input
									id="fromCaseNo"
									type="number"
									min={1}
									step={1}
									disabled={isReadonly}
									{...form.register("fromCaseNo", { valueAsNumber: true })}
									className={isReadonly ? "bg-muted" : undefined}
								/>
								{form.formState.errors.fromCaseNo && (
									<p className="text-xs text-destructive">
										{form.formState.errors.fromCaseNo.message}
									</p>
								)}
							</div>

							{/* To Package No. */}
							<div className="space-y-2">
								<Label htmlFor="toCaseNo">To Package No.</Label>
								<Input
									id="toCaseNo"
									type="number"
									min={1}
									step={1}
									placeholder="Optional"
									disabled={isReadonly}
									{...form.register("toCaseNo", {
										setValueAs: (v) =>
											v === "" || v === null ? undefined : Number(v),
									})}
									className={isReadonly ? "bg-muted" : undefined}
								/>
								{form.formState.errors.toCaseNo && (
									<p className="text-xs text-destructive">
										{String(form.formState.errors.toCaseNo.message ?? "")}
									</p>
								)}
							</div>

							{/* Gross Weight */}
							<div className="space-y-2">
								<Label htmlFor="grossWeightPkg">Gross Weight</Label>
								<Input
									id="grossWeightPkg"
									type="number"
									min={0}
									step={0.001}
									placeholder="Optional"
									disabled={isReadonly}
									{...form.register("grossWeightPkg", {
										setValueAs: (v) =>
											v === "" || v === null ? undefined : Number(v),
									})}
									className={isReadonly ? "bg-muted" : undefined}
								/>
							</div>

							{/* Gross Weight UOM */}
							<div className="space-y-2">
								<Label htmlFor="grossWeightUom">Weight UOM</Label>
								<Input
									id="grossWeightUom"
									placeholder="e.g. kg"
									disabled={isReadonly}
									{...form.register("grossWeightUom")}
									className={isReadonly ? "bg-muted" : undefined}
								/>
							</div>

							{/* Letter Head */}
							<div className="space-y-2">
								<Label htmlFor="letterHead">Letter Head</Label>
								<Input
									id="letterHead"
									placeholder="Optional"
									disabled={isReadonly}
									{...form.register("letterHead")}
									className={isReadonly ? "bg-muted" : undefined}
								/>
							</div>
						</div>
					</TabsContent>

					{/* ── Items tab ── */}
					<TabsContent value="items" className="m-0 focus-visible:outline-none">
						<div className="px-5 pb-4 pt-5">
							<div className="overflow-x-auto rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-[180px]">Item Code</TableHead>
											<TableHead className="min-w-[160px]">Item Name</TableHead>
											<TableHead className="min-w-[120px]">
												Description
											</TableHead>
											<TableHead className="w-[90px]">Qty</TableHead>
											<TableHead className="w-[110px]">Net Weight</TableHead>
											<TableHead className="w-[80px]">UOM</TableHead>
											<TableHead className="w-[120px]">Batch No.</TableHead>
											<TableHead className="w-[60px]" />
										</TableRow>
									</TableHeader>
									<TableBody>
										{itemFields.length === 0 && (
											<TableRow>
												<TableCell
													colSpan={8}
													className="py-8 text-center text-sm text-muted-foreground"
												>
													{isEditMode
														? "No items"
														: "Enter a Delivery Note above to auto-populate items"}
												</TableCell>
											</TableRow>
										)}
										{itemFields.map((field, index) => (
											<TableRow key={field.id}>
												{/* Item Code */}
												<TableCell>
													<Input
														readOnly={isReadonly}
														className={
															isReadonly ? "bg-muted text-sm" : "text-sm"
														}
														{...form.register(`items.${index}.itemCode`)}
													/>
													{form.formState.errors.items?.[index]?.itemCode && (
														<p className="mt-0.5 text-xs text-destructive">
															{
																form.formState.errors.items[index]?.itemCode
																	?.message
															}
														</p>
													)}
												</TableCell>

												{/* Item Name */}
												<TableCell>
													<Input
														readOnly={isReadonly}
														className={
															isReadonly ? "bg-muted text-sm" : "text-sm"
														}
														placeholder="Optional"
														{...form.register(`items.${index}.itemName`)}
													/>
												</TableCell>

												{/* Description */}
												<TableCell>
													<Input
														readOnly={isReadonly}
														className={
															isReadonly ? "bg-muted text-sm" : "text-sm"
														}
														placeholder="Optional"
														{...form.register(`items.${index}.description`)}
													/>
												</TableCell>

												{/* Qty */}
												<TableCell>
													<Input
														type="number"
														min={0.001}
														step={0.001}
														readOnly={isReadonly}
														className={
															isReadonly ? "bg-muted text-sm" : "text-sm"
														}
														{...form.register(`items.${index}.qty`, {
															valueAsNumber: true,
														})}
													/>
													{form.formState.errors.items?.[index]?.qty && (
														<p className="mt-0.5 text-xs text-destructive">
															{form.formState.errors.items[index]?.qty?.message}
														</p>
													)}
												</TableCell>

												{/* Net Weight */}
												<TableCell>
													<Input
														type="number"
														min={0}
														step={0.001}
														readOnly={isReadonly}
														className={
															isReadonly ? "bg-muted text-sm" : "text-sm"
														}
														placeholder="0"
														{...form.register(`items.${index}.netWeight`, {
															setValueAs: (v) =>
																v === "" || v === null ? 0 : Number(v),
														})}
													/>
												</TableCell>

												{/* Weight UOM */}
												<TableCell>
													<Input
														readOnly={isReadonly}
														className={
															isReadonly ? "bg-muted text-sm" : "text-sm"
														}
														placeholder="kg"
														{...form.register(`items.${index}.weightUom`)}
													/>
												</TableCell>

												{/* Batch No. */}
												<TableCell>
													<Input
														readOnly={isReadonly}
														className={
															isReadonly ? "bg-muted text-sm" : "text-sm"
														}
														placeholder="Optional"
														{...form.register(`items.${index}.batchNo`)}
													/>
												</TableCell>

												{/* Remove row */}
												<TableCell>
													{!isReadonly && (
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-8 w-8 p-0 text-destructive hover:text-destructive"
															onClick={() => removeItem(index)}
															aria-label={`Remove item ${index + 1}`}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							{!isReadonly && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="mt-3"
									onClick={() =>
										appendItem({
											deliveryNoteItemId: "",
											itemCode: "",
											itemName: null,
											description: null,
											qty: 1,
											netWeight: 0,
											weightUom: null,
											batchNo: null,
										})
									}
								>
									<Plus className="mr-2 h-4 w-4" />
									Add Row
								</Button>
							)}

							{form.formState.errors.items?.message && (
								<p className="mt-2 text-sm text-destructive">
									{form.formState.errors.items.message}
								</p>
							)}
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
