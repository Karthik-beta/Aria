"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

// ---------------------------------------------------------------------------
// Local form schema
// ---------------------------------------------------------------------------

const attributeValueRowSchema = z.object({
	id: z.string().optional(),
	attributeValue: z
		.string()
		.min(1, "Attribute value is required")
		.max(255)
		.trim(),
	abbreviation: z.string().min(1, "Abbreviation is required").max(50).trim(),
});

const itemAttributeFormSchema = z
	.object({
		name: z.string().min(1, "Attribute Name is required").max(255).trim(),
		disabled: z.boolean(),
		numericValues: z.boolean(),
		fromRange: z.number(),
		toRange: z.number(),
		increment: z.number(),
		attributeValues: z.array(attributeValueRowSchema),
	})
	.superRefine((data, ctx) => {
		if (data.numericValues) {
			if (data.fromRange >= data.toRange) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "From Range must be less than To Range",
					path: ["fromRange"],
				});
			}
			if (data.increment <= 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Increment must be greater than 0",
					path: ["increment"],
				});
			}
		}
	});

type ItemAttributeFormValues = z.infer<typeof itemAttributeFormSchema>;

// ---------------------------------------------------------------------------
// Page entry-point
// ---------------------------------------------------------------------------

/**
 * ItemAttributeFormPage renders the create/edit form for a single Item Attribute record.
 *
 * The form includes a child table managed via `useFieldArray` so the user can
 * add, edit, and remove attribute values inline.
 */
export default function ItemAttributeFormPage() {
	return (
		<Suspense fallback={<ItemAttributeFormFallback />}>
			<ItemAttributeFormContent />
		</Suspense>
	);
}

// ---------------------------------------------------------------------------
// Inner content (needs Suspense because it uses useSearchParams)
// ---------------------------------------------------------------------------

function ItemAttributeFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const [isInitialized, setIsInitialized] = useState(!isEditMode);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!isEditMode);
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();
	const queryName = searchParams.get("name")?.trim() ?? "";

	const form = useForm<ItemAttributeFormValues>({
		resolver: zodResolver(itemAttributeFormSchema),
		defaultValues: {
			name: queryName,
			disabled: false,
			numericValues: false,
			fromRange: 0,
			toRange: 0,
			increment: 0,
			attributeValues: [],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "attributeValues",
	});

	// ---- Fetch existing attribute when editing ----
	const { data: attribute, isLoading: isFetchingAttribute } =
		trpc.inventory.getItemAttributeById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	// ---- Watch for unsaved changes after initialization ----
	useEffect(() => {
		if (!isInitialized) return;
		const subscription = form.watch(() => {
			setHasUnsavedChanges(true);
		});
		return () => subscription.unsubscribe();
	}, [form, isInitialized]);

	// ---- Populate form when editing ----
	useEffect(() => {
		if (!isEditMode || !attribute) return;
		if (form.formState.isDirty) return; // Don't overwrite user edits on refetch

		form.reset({
			name: attribute.name,
			disabled: attribute.disabled,
			numericValues: attribute.numericValues,
			fromRange: attribute.fromRange,
			toRange: attribute.toRange,
			increment: attribute.increment,
			attributeValues: attribute.attributeValues.map((v) => ({
				id: v.id,
				attributeValue: v.attributeValue,
				abbreviation: v.abbreviation,
			})),
		});
		setHasUnsavedChanges(false);
		setIsInitialized(true);
	}, [form, isEditMode, attribute]);

	// ---- Redirect when attribute not found ----
	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingAttribute &&
			!attribute &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Item Attribute not found");
			startTransition(() => {
				router.push("/inventory/inventory-settings/item-attribute");
			});
		}
	}, [isEditMode, isFetchingAttribute, router, attribute]);

	// ---- Mutations ----
	const createMutation = trpc.inventory.createItemAttribute.useMutation({
		onSuccess: async () => {
			toast.success("Item Attribute created successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listItemAttributes.invalidate();
			startTransition(() => {
				router.push("/inventory/inventory-settings/item-attribute");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateItemAttribute.useMutation({
		onSuccess: async () => {
			toast.success("Item Attribute updated successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listItemAttributes.invalidate();
			if (id) {
				await utils.inventory.getItemAttributeById.invalidate({ id });
			}
			startTransition(() => {
				router.push("/inventory/inventory-settings/item-attribute");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: ItemAttributeFormValues) => {
		const normalizedValues = values.attributeValues.map((v) => ({
			...(v.id ? { id: v.id } : {}),
			attributeValue: v.attributeValue.trim(),
			abbreviation: v.abbreviation.trim(),
			// position is managed server-side from array order
		}));

		if (isEditMode && id) {
			const parsedUpdate = Inventory.updateItemAttributeSchema.safeParse({
				id,
				name: values.name.trim(),
				disabled: values.disabled,
				numericValues: values.numericValues,
				fromRange: values.fromRange,
				toRange: values.toRange,
				increment: values.increment,
				attributeValues: normalizedValues,
			});

			if (!parsedUpdate.success) {
				toast.error(
					parsedUpdate.error.issues[0]?.message ?? "Invalid form values",
				);
				return;
			}

			updateMutation.mutate(parsedUpdate.data);
			return;
		}

		const parsedCreate = Inventory.createItemAttributeSchema.safeParse({
			name: values.name.trim(),
			disabled: values.disabled,
			numericValues: values.numericValues,
			fromRange: values.fromRange,
			toRange: values.toRange,
			increment: values.increment,
			attributeValues: normalizedValues,
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

	if (isEditMode && isFetchingAttribute) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	const title = isEditMode && attribute ? attribute.name : "New Item Attribute";

	return (
		<div className="flex min-h-screen flex-col bg-muted px-4 py-4 md:px-6">
			{/* ---- Header ---- */}
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
					{hasUnsavedChanges && <Badge variant="secondary">Not Saved</Badge>}
				</div>
				<Button
					onClick={form.handleSubmit(onSubmit)}
					disabled={isSubmitting}
					className="h-9 px-6"
				>
					{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
				</Button>
			</div>

			{/* ---- Scalar fields ---- */}
			<div className="rounded-xl border bg-background mb-4">
				<div className="space-y-6 px-5 py-5">
					{/* Attribute Name */}
					<div className="space-y-2">
						<Label htmlFor="name">
							Attribute Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="name"
							placeholder="Enter attribute name"
							{...form.register("name")}
						/>
						{form.formState.errors.name && (
							<p className="text-xs text-destructive">
								{form.formState.errors.name.message}
							</p>
						)}
					</div>

					{/* Checkboxes row */}
					<div className="flex flex-wrap gap-6">
						{/* Disabled */}
						<div className="flex items-center gap-2">
							<Checkbox
								id="disabled"
								checked={form.watch("disabled")}
								onCheckedChange={(checked) =>
									form.setValue("disabled", Boolean(checked), {
										shouldDirty: true,
									})
								}
							/>
							<Label htmlFor="disabled" className="cursor-pointer">
								Disabled
							</Label>
						</div>

						{/* Numeric Values */}
						<div className="flex items-center gap-2">
							<Checkbox
								id="numericValues"
								checked={form.watch("numericValues")}
								onCheckedChange={(checked) =>
									form.setValue("numericValues", Boolean(checked), {
										shouldDirty: true,
									})
								}
							/>
							<Label htmlFor="numericValues" className="cursor-pointer">
								Numeric Values
							</Label>
						</div>
					</div>
				</div>
			</div>

			{/* ---- Numeric Range fields (visible when numericValues is true) ---- */}
			{form.watch("numericValues") && (
				<div className="rounded-xl border bg-background mb-4">
					<div className="px-5 py-4 border-b">
						<h2 className="text-base font-semibold">Numeric Range</h2>
					</div>
					<div className="space-y-6 px-5 py-5">
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
							{/* From Range */}
							<div className="space-y-2">
								<Label htmlFor="fromRange">
									From Range <span className="text-destructive">*</span>
								</Label>
								<Input
									id="fromRange"
									type="number"
									step="any"
									placeholder="0"
									{...form.register("fromRange", { valueAsNumber: true })}
								/>
								{form.formState.errors.fromRange && (
									<p className="text-xs text-destructive">
										{form.formState.errors.fromRange.message}
									</p>
								)}
							</div>

							{/* To Range */}
							<div className="space-y-2">
								<Label htmlFor="toRange">
									To Range <span className="text-destructive">*</span>
								</Label>
								<Input
									id="toRange"
									type="number"
									step="any"
									placeholder="0"
									{...form.register("toRange", { valueAsNumber: true })}
								/>
								{form.formState.errors.toRange && (
									<p className="text-xs text-destructive">
										{form.formState.errors.toRange.message}
									</p>
								)}
							</div>

							{/* Increment */}
							<div className="space-y-2">
								<Label htmlFor="increment">
									Increment <span className="text-destructive">*</span>
								</Label>
								<Input
									id="increment"
									type="number"
									step="any"
									placeholder="0"
									{...form.register("increment", { valueAsNumber: true })}
								/>
								{form.formState.errors.increment && (
									<p className="text-xs text-destructive">
										{form.formState.errors.increment.message}
									</p>
								)}
							</div>
						</div>
						{form.formState.errors.root && (
							<p className="text-xs text-destructive">
								{form.formState.errors.root.message}
							</p>
						)}
					</div>
				</div>
			)}

			{/* ---- Attribute Values child table (hidden when numericValues is true) ---- */}
			{!form.watch("numericValues") && (
				<div className="rounded-xl border bg-background">
					<div className="px-5 py-4 border-b flex items-center justify-between">
						<h2 className="text-base font-semibold">Attribute Values</h2>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => append({ attributeValue: "", abbreviation: "" })}
						>
							<Plus className="mr-1 h-4 w-4" />
							Add Row
						</Button>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b bg-muted/50">
									<th className="w-12 px-4 py-3 text-left font-medium text-muted-foreground">
										No.
									</th>
									<th className="px-4 py-3 text-left font-medium text-muted-foreground">
										Attribute Value <span className="text-destructive">*</span>
									</th>
									<th className="w-48 px-4 py-3 text-left font-medium text-muted-foreground">
										Abbreviation <span className="text-destructive">*</span>
									</th>
									<th className="w-12 px-4 py-3" />
								</tr>
							</thead>
							<tbody>
								{fields.length === 0 && (
									<tr>
										<td
											colSpan={4}
											className="px-4 py-8 text-center text-sm text-muted-foreground"
										>
											No attribute values added yet. Click &ldquo;Add Row&rdquo;
											to add one.
										</td>
									</tr>
								)}
								{fields.map((field, index) => (
									<tr key={field.id} className="border-b last:border-0">
										<td className="px-4 py-2 text-muted-foreground">
											{index + 1}
										</td>
										<td className="px-4 py-2">
											<Input
												placeholder="e.g. Red"
												{...form.register(
													`attributeValues.${index}.attributeValue`,
												)}
											/>
											{form.formState.errors.attributeValues?.[index]
												?.attributeValue && (
												<p className="mt-1 text-xs text-destructive">
													{
														form.formState.errors.attributeValues[index]
															?.attributeValue?.message
													}
												</p>
											)}
										</td>
										<td className="px-4 py-2">
											<Input
												placeholder="e.g. R"
												{...form.register(
													`attributeValues.${index}.abbreviation`,
												)}
											/>
											{form.formState.errors.attributeValues?.[index]
												?.abbreviation && (
												<p className="mt-1 text-xs text-destructive">
													{
														form.formState.errors.attributeValues[index]
															?.abbreviation?.message
													}
												</p>
											)}
										</td>
										<td className="px-4 py-2">
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-muted-foreground hover:text-destructive"
												onClick={() => remove(index)}
												aria-label={`Remove row ${index + 1}`}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}

function ItemAttributeFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
