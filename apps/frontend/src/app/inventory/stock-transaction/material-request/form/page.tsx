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
import { toDateInputValue } from "../material-request.utils";

type MaterialRequestFormValues = Omit<
	z.input<typeof Inventory.createMaterialRequestSchema>,
	"items"
> & {
	items: Array<
		z.input<typeof Inventory.createMaterialRequestItemSchema> & { id?: string }
	>;
};

/**
 * MaterialRequestFormPage — wraps the form content in a `Suspense` boundary so
 * that `useSearchParams()` inside `MaterialRequestFormContent` does not block
 * the initial render. Client component.
 */
export default function MaterialRequestFormPage() {
	return (
		<Suspense fallback={<MaterialRequestFormFallback />}>
			<MaterialRequestFormContent />
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
function MaterialRequestFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const [isInitialized, setIsInitialized] = useState(!isEditMode);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!isEditMode);
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<MaterialRequestFormValues>({
		resolver: zodResolver(Inventory.createMaterialRequestSchema),
		defaultValues: {
			transactionDate: new Date(),
			purpose: "PURCHASE",
			company: "",
			requiredBy: undefined,
			targetWarehouse: "",
			terms: "",
			termsContent: "",
			letterHead: "",
			printHeading: "",
			items: [
				{
					itemCode: "",
					itemName: "",
					requiredBy: undefined,
					quantity: 1,
					targetWarehouse: "",
					unitOfMeasure: "",
				},
			],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "items",
	});

	const { data: materialRequest, isLoading: isFetchingRequest } =
		trpc.inventory.getMaterialRequestById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	useEffect(() => {
		if (!isInitialized) return;
		const subscription = form.watch(() => {
			setHasUnsavedChanges(true);
		});
		return () => subscription.unsubscribe();
	}, [form, isInitialized]);

	useEffect(() => {
		if (isEditMode && materialRequest) {
			form.reset({
				transactionDate: new Date(materialRequest.transactionDate),
				purpose:
					materialRequest.purpose as MaterialRequestFormValues["purpose"],
				company: materialRequest.company,
				requiredBy: materialRequest.requiredBy
					? new Date(materialRequest.requiredBy)
					: undefined,
				targetWarehouse: materialRequest.targetWarehouse ?? "",
				terms: materialRequest.terms ?? "",
				termsContent: materialRequest.termsContent ?? "",
				letterHead: materialRequest.letterHead ?? "",
				printHeading: materialRequest.printHeading ?? "",
				items:
					materialRequest.items.length > 0
						? materialRequest.items.map((item) => ({
								id: item.id,
								itemCode: item.itemCode,
								itemName: item.itemName ?? "",
								requiredBy: item.requiredBy
									? new Date(item.requiredBy)
									: undefined,
								quantity: item.quantity,
								targetWarehouse: item.targetWarehouse ?? "",
								unitOfMeasure: item.unitOfMeasure ?? "",
							}))
						: [
								{
									itemCode: "",
									itemName: "",
									requiredBy: undefined,
									quantity: 1,
									targetWarehouse: "",
									unitOfMeasure: "",
								},
							],
			});
			setHasUnsavedChanges(false);
			setIsInitialized(true);
		}
	}, [form, isEditMode, materialRequest]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingRequest &&
			!materialRequest &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Material request not found");
			startTransition(() => {
				router.push("/inventory/stock-transaction/material-request");
			});
		}
	}, [isEditMode, isFetchingRequest, materialRequest, router]);

	const createMutation = trpc.inventory.createMaterialRequest.useMutation({
		onSuccess: async () => {
			toast.success("Material request created successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listMaterialRequests.invalidate();
			startTransition(() => {
				router.push("/inventory/stock-transaction/material-request");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateMaterialRequest.useMutation({
		onSuccess: async () => {
			toast.success("Material request updated successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listMaterialRequests.invalidate();
			startTransition(() => {
				router.push("/inventory/stock-transaction/material-request");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: MaterialRequestFormValues) => {
		const normalizedItems = values.items.map((item) => ({
			id: isEditMode ? item.id : undefined,
			itemCode: item.itemCode.trim(),
			itemName: item.itemName?.trim() || undefined,
			requiredBy: item.requiredBy ?? undefined,
			quantity: item.quantity,
			targetWarehouse: item.targetWarehouse?.trim() || undefined,
			unitOfMeasure: item.unitOfMeasure?.trim() || undefined,
		}));

		if (isEditMode && id) {
			updateMutation.mutate({
				id,
				transactionDate: values.transactionDate ?? undefined,
				purpose: values.purpose,
				company: values.company.trim(),
				requiredBy: values.requiredBy ?? undefined,
				targetWarehouse: values.targetWarehouse?.trim() || null,
				terms: values.terms?.trim() || null,
				termsContent: values.termsContent?.trim() || null,
				letterHead: values.letterHead?.trim() || null,
				printHeading: values.printHeading?.trim() || null,
				items: normalizedItems,
			});
			return;
		}

		const parsedCreate = Inventory.createMaterialRequestSchema.safeParse({
			...values,
			company: values.company.trim(),
			targetWarehouse: values.targetWarehouse?.trim() || undefined,
			terms: values.terms?.trim() || undefined,
			termsContent: values.termsContent?.trim() || undefined,
			letterHead: values.letterHead?.trim() || undefined,
			printHeading: values.printHeading?.trim() || undefined,
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

	const watchedTransactionDate = useWatch({
		control: form.control,
		name: "transactionDate",
	}) as Date | undefined;
	const watchedRequiredBy = useWatch({
		control: form.control,
		name: "requiredBy",
	}) as Date | undefined;
	const watchedPurpose = useWatch({ control: form.control, name: "purpose" });

	if (isEditMode && isFetchingRequest) {
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
							? (materialRequest?.series ?? "Edit Material Request")
							: "New Material Request"}
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
							<TabsTrigger value="terms">Terms</TabsTrigger>
							<TabsTrigger value="more-info">More Info</TabsTrigger>
						</TabsList>
					</div>

					{/* ── Details Tab ───────────────────────────────────────────── */}
					<TabsContent
						value="details"
						className="m-0 focus-visible:outline-none"
					>
						<div className="grid gap-6 px-5 pt-5 pb-4 md:grid-cols-2">
							{/* Series (read-only in edit, hidden in create) */}
							{isEditMode && (
								<div className="space-y-2">
									<Label>Series</Label>
									<Input
										value={materialRequest?.series ?? ""}
										readOnly
										className="bg-muted"
									/>
								</div>
							)}

							{/* Transaction Date */}
							<div className="space-y-2">
								<Label htmlFor="transactionDate">Transaction Date</Label>
								<Input
									id="transactionDate"
									type="date"
									value={toDateInputValue(watchedTransactionDate)}
									onChange={(e) =>
										form.setValue(
											"transactionDate",
											e.target.value ? new Date(e.target.value) : undefined,
											{ shouldDirty: true },
										)
									}
								/>
							</div>

							{/* Purpose */}
							<div className="space-y-2">
								<Label htmlFor="purpose">Purpose</Label>
								<Select
									value={watchedPurpose}
									onValueChange={(
										value:
											| "PURCHASE"
											| "MANUFACTURE"
											| "MATERIAL_TRANSFER"
											| "MATERIAL_ISSUE"
											| "CUSTOMER_PROVIDED",
									) => form.setValue("purpose", value, { shouldDirty: true })}
								>
									<SelectTrigger id="purpose">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="PURCHASE">Purchase</SelectItem>
										<SelectItem value="MANUFACTURE">Manufacture</SelectItem>
										<SelectItem value="MATERIAL_TRANSFER">
											Material Transfer
										</SelectItem>
										<SelectItem value="MATERIAL_ISSUE">
											Material Issue
										</SelectItem>
										<SelectItem value="CUSTOMER_PROVIDED">
											Customer Provided
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Required By */}
							<div className="space-y-2">
								<Label htmlFor="requiredBy">Required By</Label>
								<Input
									id="requiredBy"
									type="date"
									value={toDateInputValue(watchedRequiredBy)}
									onChange={(e) =>
										form.setValue(
											"requiredBy",
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

							{/* Target Warehouse */}
							<div className="space-y-2">
								<Label htmlFor="targetWarehouse">Set Target Warehouse</Label>
								<Input
									id="targetWarehouse"
									{...form.register("targetWarehouse")}
									placeholder="e.g. Main Warehouse"
								/>
							</div>
						</div>

						{/* Items Table */}
						<div className="space-y-4 border-t px-5 py-4">
							<div>
								<h2 className="text-xl font-semibold">Items</h2>
							</div>

							<div className="overflow-hidden rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-10" />
											<TableHead className="w-12">No.</TableHead>
											<TableHead>Item Code *</TableHead>
											<TableHead>Item Name</TableHead>
											<TableHead className="w-36">Required By</TableHead>
											<TableHead className="w-28">Quantity *</TableHead>
											<TableHead>Target Warehouse</TableHead>
											<TableHead className="w-32">UOM</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{fields.map((field, index) => (
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
													<Controller
														name={`items.${index}.requiredBy`}
														control={form.control}
														render={({ field }) => (
															<Input
																type="date"
																className="h-9"
																value={toDateInputValue(
																	field.value as Date | undefined,
																)}
																onChange={(e) =>
																	field.onChange(
																		e.target.value
																			? new Date(e.target.value)
																			: undefined,
																	)
																}
															/>
														)}
													/>
												</TableCell>
												<TableCell>
													<Controller
														name={`items.${index}.quantity`}
														control={form.control}
														render={({ field }) => (
															<Input
																type="number"
																step="0.001"
																min="0.001"
																className="h-9"
																value={field.value}
																onChange={(e) =>
																	field.onChange(
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
													<Input
														className="h-9"
														placeholder="Warehouse"
														{...form.register(`items.${index}.targetWarehouse`)}
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
										))}
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
										requiredBy: undefined,
										quantity: 1,
										targetWarehouse: "",
										unitOfMeasure: "",
									})
								}
							>
								<Plus className="mr-1.5 h-4 w-4" />
								Add Row
							</Button>
						</div>
					</TabsContent>

					{/* ── Terms Tab ─────────────────────────────────────────────── */}
					<TabsContent value="terms" className="m-0 focus-visible:outline-none">
						<div className="grid gap-6 px-5 py-5 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="terms">Terms</Label>
								<Input
									id="terms"
									{...form.register("terms")}
									placeholder="Terms reference"
								/>
							</div>

							<div className="md:col-span-2 space-y-2">
								<Label htmlFor="termsContent">Terms and Conditions</Label>
								<Textarea
									id="termsContent"
									rows={6}
									{...form.register("termsContent")}
									placeholder="Enter terms and conditions content..."
								/>
							</div>
						</div>
					</TabsContent>

					{/* ── More Info Tab ──────────────────────────────────────────── */}
					<TabsContent
						value="more-info"
						className="m-0 focus-visible:outline-none"
					>
						<div className="px-5 py-5">
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
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

function MaterialRequestFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
