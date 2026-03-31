"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { toDateInputValue } from "../stock-entry.utils";

type StockEntryFormValues = Omit<
	z.input<typeof Inventory.createStockEntrySchema>,
	"items"
> & {
	items: Array<
		z.input<typeof Inventory.createStockEntryItemSchema> & { id?: string }
	>;
};

/**
 * StockEntryFormPage — wraps the form content in a `Suspense` boundary so
 * that `useSearchParams()` inside `StockEntryFormContent` does not block the
 * initial render. Client component.
 */
export default function StockEntryFormPage() {
	return (
		<Suspense fallback={<StockEntryFormFallback />}>
			<StockEntryFormContent />
		</Suspense>
	);
}

/**
 * Internal form component that reads the `?id=` search param to determine
 * whether it is in create or edit mode. Handles data-fetching, form state
 * (react-hook-form + Zod), submit, and unsaved-changes tracking.
 *
 * Client component: uses hooks and browser APIs.
 */
function StockEntryFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const [isInitialized, setIsInitialized] = useState(!isEditMode);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<StockEntryFormValues>({
		resolver: zodResolver(Inventory.createStockEntrySchema),
		defaultValues: {
			stockEntryType: "MATERIAL_RECEIPT",
			postingDate: new Date(),
			company: "",
			project: "",
			defaultSourceWarehouse: "",
			defaultTargetWarehouse: "",
			isOpening: false,
			remarks: "",
			printHeading: "",
			letterHead: "",
			inspectionRequired: false,
			items: [
				{
					itemCode: "",
					itemName: "",
					sourceWarehouse: "",
					targetWarehouse: "",
					qty: 1,
					basicRate: 0,
					unitOfMeasure: "",
				},
			],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "items",
	});

	const { data: stockEntry, isLoading: isFetchingEntry } =
		trpc.inventory.getStockEntryById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	useEffect(() => {
		if (!isInitialized) return;
		const subscription = form.watch(() => {
			setHasUnsavedChanges(true);
		});
		return () => subscription.unsubscribe();
	}, [isInitialized, form.watch]);

	useEffect(() => {
		if (isEditMode && stockEntry) {
			form.reset({
				stockEntryType:
					stockEntry.stockEntryType as StockEntryFormValues["stockEntryType"],
				postingDate: new Date(stockEntry.postingDate),
				company: stockEntry.company,
				project: stockEntry.project ?? "",
				defaultSourceWarehouse: stockEntry.defaultSourceWarehouse ?? "",
				defaultTargetWarehouse: stockEntry.defaultTargetWarehouse ?? "",
				isOpening: stockEntry.isOpening,
				remarks: stockEntry.remarks ?? "",
				printHeading: stockEntry.printHeading ?? "",
				letterHead: stockEntry.letterHead ?? "",
				inspectionRequired: stockEntry.inspectionRequired,
				items:
					stockEntry.items.length > 0
						? stockEntry.items.map((item) => ({
								id: item.id,
								itemCode: item.itemCode,
								itemName: item.itemName ?? "",
								sourceWarehouse: item.sourceWarehouse ?? "",
								targetWarehouse: item.targetWarehouse ?? "",
								qty: item.qty,
								basicRate: item.basicRate,
								unitOfMeasure: item.unitOfMeasure ?? "",
							}))
						: [
								{
									itemCode: "",
									itemName: "",
									sourceWarehouse: "",
									targetWarehouse: "",
									qty: 1,
									basicRate: 0,
									unitOfMeasure: "",
								},
							],
			});
			setHasUnsavedChanges(false);
			setIsInitialized(true);
		}
	}, [form, isEditMode, stockEntry]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingEntry &&
			!stockEntry &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Stock entry not found");
			startTransition(() => {
				router.push("/inventory/stock-transaction/stock-entry");
			});
		}
	}, [isEditMode, isFetchingEntry, stockEntry, router]);

	const createMutation = trpc.inventory.createStockEntry.useMutation({
		onSuccess: async () => {
			toast.success("Stock entry created successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listStockEntries.invalidate();
			startTransition(() => {
				router.push("/inventory/stock-transaction/stock-entry");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateStockEntry.useMutation({
		onSuccess: async () => {
			toast.success("Stock entry updated successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listStockEntries.invalidate();
			startTransition(() => {
				router.push("/inventory/stock-transaction/stock-entry");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: StockEntryFormValues) => {
		const normalizedItems = values.items.map((item) => ({
			id: isEditMode ? item.id : undefined,
			itemCode: item.itemCode.trim(),
			itemName: item.itemName?.trim() || undefined,
			sourceWarehouse: item.sourceWarehouse?.trim() || undefined,
			targetWarehouse: item.targetWarehouse?.trim() || undefined,
			qty: item.qty,
			basicRate: item.basicRate ?? 0,
			unitOfMeasure: item.unitOfMeasure?.trim() || undefined,
		}));

		if (isEditMode && id) {
			updateMutation.mutate({
				id,
				stockEntryType: values.stockEntryType,
				postingDate: values.postingDate ?? undefined,
				company: values.company.trim(),
				project: values.project?.trim() || null,
				defaultSourceWarehouse: values.defaultSourceWarehouse?.trim() || null,
				defaultTargetWarehouse: values.defaultTargetWarehouse?.trim() || null,
				isOpening: values.isOpening,
				remarks: values.remarks?.trim() || null,
				printHeading: values.printHeading?.trim() || null,
				letterHead: values.letterHead?.trim() || null,
				inspectionRequired: values.inspectionRequired,
				items: normalizedItems,
			});
			return;
		}

		const parsedCreate = Inventory.createStockEntrySchema.safeParse({
			...values,
			company: values.company.trim(),
			project: values.project?.trim() || undefined,
			defaultSourceWarehouse:
				values.defaultSourceWarehouse?.trim() || undefined,
			defaultTargetWarehouse:
				values.defaultTargetWarehouse?.trim() || undefined,
			remarks: values.remarks?.trim() || undefined,
			printHeading: values.printHeading?.trim() || undefined,
			letterHead: values.letterHead?.trim() || undefined,
			items: normalizedItems,
		});

		if (!parsedCreate.success) {
			toast.error(
				parsedCreate.error.issues[0]?.message ?? "Invalid form values",
			);
			return;
		}

		createMutation.mutate(parsedCreate.data);
	};

	const isSubmitting =
		createMutation.isPending || updateMutation.isPending || isPending;

	const watchedPostingDate = useWatch({
		control: form.control,
		name: "postingDate",
	}) as Date | undefined;
	const watchedStockEntryType = useWatch({
		control: form.control,
		name: "stockEntryType",
	});
	const watchedIsOpening = useWatch({
		control: form.control,
		name: "isOpening",
	});
	const watchedInspectionRequired = useWatch({
		control: form.control,
		name: "inspectionRequired",
	});
	const watchedItems = useWatch({
		control: form.control,
		name: "items",
	});

	if (isEditMode && isFetchingEntry) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col bg-[#f8f9fa] px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">
						{isEditMode
							? (stockEntry?.series ?? "Edit Stock Entry")
							: "New Stock Entry"}
					</h1>
					{hasUnsavedChanges && (
						<Badge className="border-none bg-orange-50 text-orange-600 hover:bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400">
							Not Saved
						</Badge>
					)}
				</div>
				<Button
					onClick={form.handleSubmit(onSubmit)}
					disabled={isSubmitting}
					className="h-9 px-6"
				>
					{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
				</Button>
			</div>

			<div className="rounded-lg border bg-white shadow-sm overflow-hidden">
				<Tabs defaultValue="details" className="w-full">
					<div className="border-b px-4 py-2">
						<TabsList>
							<TabsTrigger value="details">Details</TabsTrigger>
							<TabsTrigger value="accounting-dimensions">
								Accounting Dimensions
							</TabsTrigger>
							<TabsTrigger value="other-info">Other Info</TabsTrigger>
						</TabsList>
					</div>

					{/* ── Details Tab ───────────────────────────────────────────── */}
					<TabsContent
						value="details"
						className="m-0 focus-visible:outline-none"
					>
						<div className="grid gap-6 px-5 pt-5 pb-4 md:grid-cols-2">
							{/* Series (read-only in edit) */}
							{isEditMode && (
								<div className="space-y-2">
									<Label>Series</Label>
									<Input
										value={stockEntry?.series ?? ""}
										readOnly
										className="bg-muted"
									/>
								</div>
							)}

							{/* Stock Entry Type */}
							<div className="space-y-2">
								<Label htmlFor="stockEntryType">Stock Entry Type *</Label>
								<Select
									value={watchedStockEntryType}
									onValueChange={(
										value:
											| "MATERIAL_RECEIPT"
											| "MATERIAL_ISSUE"
											| "MATERIAL_TRANSFER"
											| "MATERIAL_TRANSFER_FOR_MANUFACTURE"
											| "MANUFACTURE"
											| "REPACK"
											| "SEND_TO_SUBCONTRACTOR",
									) =>
										form.setValue("stockEntryType", value, {
											shouldDirty: true,
										})
									}
								>
									<SelectTrigger id="stockEntryType">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="MATERIAL_RECEIPT">
											Material Receipt
										</SelectItem>
										<SelectItem value="MATERIAL_ISSUE">
											Material Issue
										</SelectItem>
										<SelectItem value="MATERIAL_TRANSFER">
											Material Transfer
										</SelectItem>
										<SelectItem value="MATERIAL_TRANSFER_FOR_MANUFACTURE">
											Material Transfer for Manufacture
										</SelectItem>
										<SelectItem value="MANUFACTURE">Manufacture</SelectItem>
										<SelectItem value="REPACK">Repack</SelectItem>
										<SelectItem value="SEND_TO_SUBCONTRACTOR">
											Send to Subcontractor
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Posting Date */}
							<div className="space-y-2">
								<Label htmlFor="postingDate">Posting Date</Label>
								<Input
									id="postingDate"
									type="date"
									value={toDateInputValue(watchedPostingDate)}
									onChange={(e) =>
										form.setValue(
											"postingDate",
											e.target.value ? new Date(e.target.value) : undefined,
											{ shouldDirty: true },
										)
									}
								/>
							</div>

							{/* Company */}
							<div className="space-y-2">
								<Label htmlFor="company">Company *</Label>
								<Input
									id="company"
									{...form.register("company")}
									placeholder="Company name"
								/>
								{form.formState.errors.company && (
									<p className="text-xs text-destructive">
										{form.formState.errors.company.message}
									</p>
								)}
							</div>

							{/* Default Source Warehouse */}
							<div className="space-y-2">
								<Label htmlFor="defaultSourceWarehouse">
									Default Source Warehouse
								</Label>
								<Input
									id="defaultSourceWarehouse"
									{...form.register("defaultSourceWarehouse")}
									placeholder="e.g. Main Warehouse"
								/>
							</div>

							{/* Default Target Warehouse */}
							<div className="space-y-2">
								<Label htmlFor="defaultTargetWarehouse">
									Default Target Warehouse
								</Label>
								<Input
									id="defaultTargetWarehouse"
									{...form.register("defaultTargetWarehouse")}
									placeholder="e.g. Finished Goods"
								/>
							</div>

							{/* Inspection Required */}
							<div className="flex items-center gap-2 pt-6">
								<Checkbox
									id="inspectionRequired"
									checked={watchedInspectionRequired}
									onCheckedChange={(checked) =>
										form.setValue("inspectionRequired", checked === true, {
											shouldDirty: true,
										})
									}
								/>
								<Label htmlFor="inspectionRequired" className="cursor-pointer">
									Inspection Required
								</Label>
							</div>
						</div>

						{/* Items Table */}
						<div className="space-y-4 border-t px-5 py-4">
							<div>
								<h2 className="text-xl font-semibold">Items</h2>
							</div>

							<div className="overflow-x-auto rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-10" />
											<TableHead className="w-12">No.</TableHead>
											<TableHead>Item Code *</TableHead>
											<TableHead>Item Name</TableHead>
											<TableHead>Source Warehouse</TableHead>
											<TableHead>Target Warehouse</TableHead>
											<TableHead className="w-28">Qty *</TableHead>
											<TableHead className="w-32">Basic Rate</TableHead>
											<TableHead className="w-32">Amount</TableHead>
											<TableHead className="w-28">UOM</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{fields.map((field, index) => {
											const qty = watchedItems?.[index]?.qty ?? 0;
											const rate = watchedItems?.[index]?.basicRate ?? 0;
											const amount = qty * rate;

											return (
												<TableRow key={field.id}>
													<TableCell>
														<Button
															variant="ghost"
															size="icon"
															className="h-7 w-7"
															onClick={() => remove(index)}
															disabled={fields.length === 1}
															type="button"
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</TableCell>
													<TableCell>{index + 1}</TableCell>
													<TableCell>
														<Input
															className="h-9"
															placeholder="Item code"
															{...form.register(`items.${index}.itemCode`)}
														/>
														{form.formState.errors.items?.[index]?.itemCode && (
															<p className="mt-0.5 text-xs text-destructive">
																{
																	form.formState.errors.items[index].itemCode
																		?.message
																}
															</p>
														)}
													</TableCell>
													<TableCell>
														<Input
															className="h-9"
															placeholder="Item name"
															{...form.register(`items.${index}.itemName`)}
														/>
													</TableCell>
													<TableCell>
														<Input
															className="h-9"
															placeholder="Source warehouse"
															{...form.register(
																`items.${index}.sourceWarehouse`,
															)}
														/>
													</TableCell>
													<TableCell>
														<Input
															className="h-9"
															placeholder="Target warehouse"
															{...form.register(
																`items.${index}.targetWarehouse`,
															)}
														/>
													</TableCell>
													<TableCell>
														<Controller
															name={`items.${index}.qty`}
															control={form.control}
															render={({ field: f }) => (
																<Input
																	type="number"
																	step="0.001"
																	min="0.001"
																	className="h-9"
																	value={f.value}
																	onChange={(e) =>
																		f.onChange(
																			Math.max(
																				0.001,
																				Number(e.target.value) || 0.001,
																			),
																		)
																	}
																/>
															)}
														/>
													</TableCell>
													<TableCell>
														<Controller
															name={`items.${index}.basicRate`}
															control={form.control}
															render={({ field: f }) => (
																<Input
																	type="number"
																	step="0.01"
																	min="0"
																	className="h-9"
																	value={f.value}
																	onChange={(e) =>
																		f.onChange(
																			Math.max(0, Number(e.target.value) || 0),
																		)
																	}
																/>
															)}
														/>
													</TableCell>
													<TableCell>
														<Input
															className="h-9 bg-muted"
															readOnly
															value={amount.toFixed(2)}
															tabIndex={-1}
														/>
													</TableCell>
													<TableCell>
														<Input
															className="h-9"
															placeholder="e.g. Nos"
															{...form.register(`items.${index}.unitOfMeasure`)}
														/>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>

							{form.formState.errors.items &&
								!Array.isArray(form.formState.errors.items) && (
									<p className="text-xs text-destructive">
										{form.formState.errors.items.message}
									</p>
								)}

							<Button
								type="button"
								variant="outline"
								onClick={() =>
									append({
										itemCode: "",
										itemName: "",
										sourceWarehouse: "",
										targetWarehouse: "",
										qty: 1,
										basicRate: 0,
										unitOfMeasure: "",
									})
								}
							>
								<Plus className="mr-1.5 h-4 w-4" />
								Add Row
							</Button>
						</div>
					</TabsContent>

					{/* ── Accounting Dimensions Tab ─────────────────────────────── */}
					<TabsContent
						value="accounting-dimensions"
						className="m-0 focus-visible:outline-none"
					>
						<div className="grid gap-6 px-5 py-5 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="project">Project</Label>
								<Input
									id="project"
									{...form.register("project")}
									placeholder="Project name or code"
								/>
							</div>
						</div>
					</TabsContent>

					{/* ── Other Info Tab ────────────────────────────────────────── */}
					<TabsContent
						value="other-info"
						className="m-0 focus-visible:outline-none"
					>
						<div className="px-5 py-5 space-y-6">
							<div>
								<h2 className="mb-4 text-base font-semibold text-muted-foreground uppercase tracking-wide">
									Printing Details
								</h2>
								<div className="grid gap-6 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="letterHead">Letter Head</Label>
										<Input
											id="letterHead"
											{...form.register("letterHead")}
											placeholder="Letter head name"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="printHeading">Print Heading</Label>
										<Input
											id="printHeading"
											{...form.register("printHeading")}
											placeholder="Print heading"
										/>
									</div>
								</div>
							</div>

							<div>
								<h2 className="mb-4 text-base font-semibold text-muted-foreground uppercase tracking-wide">
									More Information
								</h2>
								<div className="grid gap-6 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="isOpening">Is Opening</Label>
										<Select
											value={watchedIsOpening ? "yes" : "no"}
											onValueChange={(value) =>
												form.setValue("isOpening", value === "yes", {
													shouldDirty: true,
												})
											}
										>
											<SelectTrigger id="isOpening">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="no">No</SelectItem>
												<SelectItem value="yes">Yes</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="md:col-span-2 space-y-2">
										<Label htmlFor="remarks">Remarks</Label>
										<Textarea
											id="remarks"
											rows={4}
											{...form.register("remarks")}
											placeholder="Enter any remarks..."
										/>
									</div>
								</div>
							</div>
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

function StockEntryFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
