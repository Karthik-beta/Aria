/**
 * Asset Category Form Page — create and edit asset categories.
 *
 * Reads ?id= param to switch between create/edit modes.
 *
 * Business logic mirrors ERPNext Asset Category:
 * - When Non Depreciable Category is checked, depreciation fields are hidden
 *   and cleared (mirroring ERPNext's non_depreciable_category toggle).
 * - Depreciation Method, Total Number of Depreciations, and Frequency of
 *   Depreciation are required when the category is depreciable.
 * - Enable CWIP Accounting is independent of depreciation settings.
 *
 * Client component: uses hooks for form state and tRPC mutations.
 */
"use client";

import { Asset } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { AssetWriteAccessNotice } from "@/components/asset/asset-write-access-notice";
import {
	DEPRECIATION_METHOD_DOCS,
	DepreciationMethodInlineCard,
	DepreciationMethodLabel,
} from "@/components/asset/depreciation-method-doc-guide";
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
import { useCanManageAssets } from "@/hooks/use-can-manage-assets";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import {
	type AssetCategoryFormValues,
	assetCategoryFormSchema,
	DEPRECIATION_METHOD_OPTIONS,
	getAssetCategoryFormDefaults,
} from "../asset-category.schema";
import { toAssetCategoryMutationInput } from "../asset-category.utils";

export default function AssetCategoryFormPage() {
	const canManageAssets = useCanManageAssets();

	if (!canManageAssets) {
		return (
			<AssetWriteAccessNotice
				backHref="/asset/asset-sub-module/asset-category"
				backLabel="Back to asset categories"
			/>
		);
	}

	return (
		<Suspense fallback={<AssetCategoryFormFallback />}>
			<AssetCategoryFormContent />
		</Suspense>
	);
}

function AssetCategoryFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}

function AssetCategoryFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<AssetCategoryFormValues>({
		resolver: zodResolver(assetCategoryFormSchema),
		defaultValues: getAssetCategoryFormDefaults(),
	});
	const financeBookFields = useFieldArray({
		control: form.control,
		name: "financeBooks",
	});
	const accountFields = useFieldArray({
		control: form.control,
		name: "accounts",
	});
	const { data: financeBookData } = trpc.asset.listFinanceBooks.useQuery({
		take: 250,
	});
	const { data: companyData } = trpc.company.listCompanies.useQuery({
		take: 250,
	});

	// Fetch category details in edit mode
	const { data: category, isLoading: isFetchingCategory } =
		trpc.asset.getAssetCategoryById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	// Hydrate form in edit mode
	useEffect(() => {
		if (!isEditMode || !category) return;
		if (form.formState.isDirty) return;

		form.reset({
			name: category.name,
			nonDepreciableCategory: category.nonDepreciableCategory,
			enableCwipAccounting: category.enableCwipAccounting,
			depreciationMethod: category.depreciationMethod ?? "",
			totalNumberOfDepreciations: category.totalNumberOfDepreciations ?? null,
			frequencyOfDepreciation: category.frequencyOfDepreciation ?? null,
			dailyProrataBased: category.dailyProrataBased ?? null,
			shiftBased: category.shiftBased ?? null,
			rateOfDepreciation: category.rateOfDepreciation ?? null,
			expectedValueAfterUsefulLife:
				category.expectedValueAfterUsefulLife ?? null,
			financeBooks: category.financeBooks ?? [],
			accounts: category.accounts ?? [],
		});
	}, [form, isEditMode, category]);

	// Redirect to list if category not found
	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingCategory &&
			!category &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Asset category not found");
			startTransition(() => {
				router.push("/asset/asset-sub-module/asset-category");
			});
		}
	}, [isEditMode, isFetchingCategory, category, router]);

	const createMutation = trpc.asset.createAssetCategory.useMutation({
		onSuccess: async (data) => {
			toast.success("Asset category created successfully");
			await utils.asset.listAssetCategories.invalidate();
			startTransition(() => {
				router.push(
					`/asset/asset-sub-module/asset-category/form?id=${data.id}`,
				);
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.asset.updateAssetCategory.useMutation({
		onSuccess: async () => {
			toast.success("Asset category updated successfully");
			await utils.asset.listAssetCategories.invalidate();
			if (id) {
				await utils.asset.getAssetCategoryById.invalidate({ id });
			}
			form.reset(form.getValues()); // clear dirty state
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: AssetCategoryFormValues) => {
		const payload = toAssetCategoryMutationInput(values);

		if (isEditMode && id) {
			const parsed = Asset.updateAssetCategorySchema.safeParse({
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

		const parsed = Asset.createAssetCategorySchema.safeParse(payload);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
			return;
		}
		createMutation.mutate(parsed.data);
	};

	const isSubmitting =
		createMutation.isPending || updateMutation.isPending || isPending;
	const hasUnsavedChanges = form.formState.isDirty;

	const nonDepreciableCategory = useWatch({
		control: form.control,
		name: "nonDepreciableCategory",
	});
	const depreciationMethod = useWatch({
		control: form.control,
		name: "depreciationMethod",
	});

	// When non-depreciable is toggled on, clear all depreciation fields
	const prevNonDepreciableRef = useRef(nonDepreciableCategory);
	useEffect(() => {
		if (nonDepreciableCategory && !prevNonDepreciableRef.current) {
			form.setValue("depreciationMethod", "", { shouldDirty: true });
			form.setValue("totalNumberOfDepreciations", null, {
				shouldDirty: true,
			});
			form.setValue("frequencyOfDepreciation", null, {
				shouldDirty: true,
			});
			form.setValue("dailyProrataBased", null, { shouldDirty: true });
			form.setValue("shiftBased", null, { shouldDirty: true });
			form.setValue("rateOfDepreciation", null, { shouldDirty: true });
			form.setValue("expectedValueAfterUsefulLife", null, {
				shouldDirty: true,
			});
		}
		prevNonDepreciableRef.current = nonDepreciableCategory;
	}, [nonDepreciableCategory, form]);

	if (isEditMode && isFetchingCategory) {
		return <AssetCategoryFormFallback />;
	}

	const title = isEditMode && category ? category.name : "New Asset Category";

	return (
		<div className="flex min-h-screen flex-col bg-muted px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
					{hasUnsavedChanges && <Badge variant="secondary">Not Saved</Badge>}
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={() => {
							startTransition(() => {
								router.push("/asset/asset-sub-module/asset-category");
							});
						}}
						disabled={isSubmitting}
					>
						Back to List
					</Button>
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
				</div>
			</div>

			<div className="rounded-xl border bg-background">
				{/* Category Details section */}
				<div className="border-b px-5 py-5">
					<h2 className="text-xl font-semibold">Category Details</h2>
				</div>

				<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-2">
					{/* Category Name */}
					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="name">
							Category Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="name"
							placeholder="Enter category name"
							{...form.register("name")}
						/>
						{form.formState.errors.name && (
							<p className="text-xs text-destructive">
								{form.formState.errors.name.message}
							</p>
						)}
					</div>
				</div>

				{/* Depreciation Options section */}
				<div className="border-b px-5 py-5">
					<h2 className="text-xl font-semibold">Depreciation Options</h2>
				</div>

				<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-2">
					{/* Non Depreciable Category */}
					<div className="space-y-4">
						<div className="flex items-start gap-2">
							<Checkbox
								id="nonDepreciableCategory"
								checked={nonDepreciableCategory}
								onCheckedChange={(checked) =>
									form.setValue("nonDepreciableCategory", Boolean(checked), {
										shouldDirty: true,
									})
								}
							/>
							<div className="space-y-1">
								<Label htmlFor="nonDepreciableCategory">
									Non Depreciable Category
								</Label>
								<p className="text-sm text-muted-foreground">
									Assets in this category will not be depreciated.
								</p>
							</div>
						</div>
					</div>

					{/* Enable CWIP Accounting */}
					<div className="space-y-4">
						<div className="flex items-start gap-2">
							<EnableCwipCheckbox form={form} />
							<div className="space-y-1">
								<Label htmlFor="enableCwipAccounting">
									Enable Capital Work in Progress Accounting
								</Label>
								<p className="text-sm text-muted-foreground">
									When enabled, asset purchases will be posted to a CWIP account
									until available for use.
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Depreciation Settings section (only for depreciable categories) */}
				{!nonDepreciableCategory && (
					<>
						<div className="border-b px-5 py-5">
							<h2 className="text-xl font-semibold">Depreciation Settings</h2>
						</div>

						<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-2">
							{/* Depreciation Method */}
							<div className="space-y-2">
								<DepreciationMethodLabel
									htmlFor="depreciationMethod"
									required
								/>
								<Select
									value={depreciationMethod || "__none"}
									onValueChange={(value) =>
										form.setValue(
											"depreciationMethod",
											value === "__none" ? "" : value,
											{ shouldDirty: true },
										)
									}
								>
									<SelectTrigger id="depreciationMethod">
										<SelectValue placeholder="Select depreciation method" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__none">Select method</SelectItem>
										{DEPRECIATION_METHOD_OPTIONS.map((opt) => {
											const doc =
												DEPRECIATION_METHOD_DOCS[
													opt.value as Asset.DepreciationMethod
												];
											return (
												<SelectItem key={opt.value} value={opt.value}>
													<div className="flex flex-col gap-0.5 py-0.5">
														<span className="font-medium">{opt.label}</span>
														{doc?.subtitle && (
															<span className="text-[11px] text-muted-foreground font-normal">
																{doc.subtitle}
															</span>
														)}
													</div>
												</SelectItem>
											);
										})}
									</SelectContent>
								</Select>
								<DepreciationMethodInlineCard
									selectedMethod={depreciationMethod}
								/>
								{form.formState.errors.depreciationMethod && (
									<p className="text-xs text-destructive">
										{form.formState.errors.depreciationMethod.message}
									</p>
								)}
							</div>

							{/* Total Number of Depreciations */}
							<TotalDepreciationsInput form={form} />

							{/* Frequency of Depreciation */}
							<FrequencyOfDepreciationInput form={form} />

							{/* Expected Value After Useful Life (Salvage Value) */}
							<ExpectedValueAfterUsefulLifeInput form={form} />

							{/* Rate of Depreciation (for WDV only) */}
							{depreciationMethod === "WRITTEN_DOWN_VALUE" && (
								<RateOfDepreciationInput form={form} />
							)}

							{/* Daily Prorata Based (for Straight Line and WDV) */}
							{(depreciationMethod === "STRAIGHT_LINE" ||
								depreciationMethod === "WRITTEN_DOWN_VALUE") && (
								<DailyProrataBasedInput form={form} />
							)}

							{/* Shift Based (for Straight Line only) */}
							{depreciationMethod === "STRAIGHT_LINE" && (
								<ShiftBasedInput form={form} />
							)}
						</div>
					</>
				)}

				{!nonDepreciableCategory && (
					<>
						<div className="flex items-center justify-between border-b px-5 py-5">
							<div>
								<h2 className="text-xl font-semibold">Finance Book Defaults</h2>
								<p className="text-sm text-muted-foreground">
									Each book produces an independent depreciation schedule.
								</p>
							</div>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									const first = financeBookData?.items[0];
									if (!first) {
										toast.error("Create a finance book first");
										return;
									}
									financeBookFields.append({
										financeBookId: first.id,
										depreciationMethod: "STRAIGHT_LINE",
										totalNumberOfDepreciations: 60,
										frequencyOfDepreciation: 1,
										dailyProrataBased: false,
										shiftBased: false,
										rateOfDepreciation: null,
										expectedValueAfterUsefulLife: null,
									});
								}}
							>
								<Plus className="mr-2 h-4 w-4" /> Add Book
							</Button>
						</div>
						<div className="space-y-4 border-b px-5 py-5">
							{financeBookFields.fields.map((field, index) => (
								<div
									key={field.id}
									className="grid gap-4 rounded-lg border p-4 md:grid-cols-5"
								>
									<div className="space-y-2 md:col-span-2">
										<Label htmlFor={`financeBooks.${index}.financeBookId`}>
											Finance Book
										</Label>
										<select
											className="h-9 w-full rounded-md border bg-background px-3"
											{...form.register(`financeBooks.${index}.financeBookId`)}
										>
											{financeBookData?.items.map((book) => (
												<option key={book.id} value={book.id}>
													{book.name}
												</option>
											))}
										</select>
									</div>
									<div className="space-y-2">
										<Label>Method</Label>
										<select
											className="h-9 w-full rounded-md border bg-background px-3"
											{...form.register(
												`financeBooks.${index}.depreciationMethod`,
											)}
										>
											{DEPRECIATION_METHOD_OPTIONS.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</select>
									</div>
									<div className="space-y-2">
										<Label>Periods</Label>
										<Input
											type="number"
											min={1}
											{...form.register(
												`financeBooks.${index}.totalNumberOfDepreciations`,
												{ valueAsNumber: true },
											)}
										/>
									</div>
									<div className="flex items-end gap-2">
										<div className="flex-1 space-y-2">
											<Label>Frequency (months)</Label>
											<Input
												type="number"
												min={1}
												{...form.register(
													`financeBooks.${index}.frequencyOfDepreciation`,
													{ valueAsNumber: true },
												)}
											/>
										</div>
										<Button
											type="button"
											size="icon"
											variant="ghost"
											aria-label="Remove finance book"
											onClick={() => financeBookFields.remove(index)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							))}
						</div>
					</>
				)}

				<div className="flex items-center justify-between border-b px-5 py-5">
					<div>
						<h2 className="text-xl font-semibold">Company Account Mappings</h2>
						<p className="text-sm text-muted-foreground">
							Category accounts override company depreciation defaults.
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							const first = companyData?.items[0];
							if (!first) {
								toast.error("Create a company first");
								return;
							}
							accountFields.append({
								companyId: first.id,
								fixedAssetAccount: "",
								accumulatedDepreciationAccount: "",
								depreciationExpenseAccount: "",
								capitalWorkInProgressAccount: "",
							});
						}}
					>
						<Plus className="mr-2 h-4 w-4" /> Add Mapping
					</Button>
				</div>
				<div className="space-y-4 border-b px-5 py-5">
					{accountFields.fields.map((field, index) => (
						<div
							key={field.id}
							className="grid gap-4 rounded-lg border p-4 md:grid-cols-3"
						>
							<div className="space-y-2">
								<Label>Company</Label>
								<select
									className="h-9 w-full rounded-md border bg-background px-3"
									{...form.register(`accounts.${index}.companyId`)}
								>
									{companyData?.items.map((company) => (
										<option key={company.id} value={company.id}>
											{company.name}
										</option>
									))}
								</select>
							</div>
							<div className="space-y-2">
								<Label>Fixed Asset Account</Label>
								<Input
									{...form.register(`accounts.${index}.fixedAssetAccount`)}
								/>
							</div>
							<div className="space-y-2">
								<Label>Accumulated Depreciation</Label>
								<Input
									{...form.register(
										`accounts.${index}.accumulatedDepreciationAccount`,
									)}
								/>
							</div>
							<div className="space-y-2">
								<Label>Depreciation Expense</Label>
								<Input
									{...form.register(
										`accounts.${index}.depreciationExpenseAccount`,
									)}
								/>
							</div>
							<div className="space-y-2">
								<Label>CWIP Account</Label>
								<Input
									{...form.register(
										`accounts.${index}.capitalWorkInProgressAccount`,
									)}
								/>
							</div>
							<div className="flex items-end justify-end">
								<Button
									type="button"
									size="icon"
									variant="ghost"
									aria-label="Remove company mapping"
									onClick={() => accountFields.remove(index)}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>
					))}
				</div>

				{/* Summary footer */}
				<div className="px-5 py-4">
					<div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
						Category type:{" "}
						<span className="font-medium text-foreground">
							{nonDepreciableCategory ? "Non-Depreciable" : "Depreciable"}
						</span>
						{!nonDepreciableCategory && depreciationMethod && (
							<>
								{" "}
								—{" "}
								<span className="font-medium text-foreground">
									{DEPRECIATION_METHOD_OPTIONS.find(
										(opt) => opt.value === depreciationMethod,
									)?.label ?? depreciationMethod}
								</span>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

// Extracted subcomponents to avoid complex inline expressions with form

function EnableCwipCheckbox({
	form,
}: {
	form: ReturnType<typeof useForm<AssetCategoryFormValues>>;
}) {
	const enableCwipAccounting = useWatch({
		control: form.control,
		name: "enableCwipAccounting",
	});
	return (
		<Checkbox
			id="enableCwipAccounting"
			checked={enableCwipAccounting}
			onCheckedChange={(checked) =>
				form.setValue("enableCwipAccounting", Boolean(checked), {
					shouldDirty: true,
				})
			}
		/>
	);
}

function TotalDepreciationsInput({
	form,
}: {
	form: ReturnType<typeof useForm<AssetCategoryFormValues>>;
}) {
	const value = useWatch({
		control: form.control,
		name: "totalNumberOfDepreciations",
	});
	return (
		<div className="space-y-2">
			<Label htmlFor="totalNumberOfDepreciations">
				Total Number of Depreciations{" "}
				<span className="text-destructive">*</span>
			</Label>
			<Input
				id="totalNumberOfDepreciations"
				type="number"
				min={1}
				step={1}
				placeholder="e.g. 60"
				value={value ?? ""}
				onChange={(e) => {
					const num = parseInt(e.target.value, 10);
					form.setValue(
						"totalNumberOfDepreciations",
						Number.isNaN(num) ? null : Math.max(1, num),
						{ shouldDirty: true },
					);
				}}
			/>
			{form.formState.errors.totalNumberOfDepreciations && (
				<p className="text-xs text-destructive">
					{form.formState.errors.totalNumberOfDepreciations.message}
				</p>
			)}
			<p className="text-xs text-muted-foreground">
				Number of times the asset will be depreciated.
			</p>
		</div>
	);
}

function FrequencyOfDepreciationInput({
	form,
}: {
	form: ReturnType<typeof useForm<AssetCategoryFormValues>>;
}) {
	const value = useWatch({
		control: form.control,
		name: "frequencyOfDepreciation",
	});
	return (
		<div className="space-y-2">
			<Label htmlFor="frequencyOfDepreciation">
				Frequency of Depreciation (Months){" "}
				<span className="text-destructive">*</span>
			</Label>
			<Input
				id="frequencyOfDepreciation"
				type="number"
				min={1}
				step={1}
				placeholder="e.g. 12"
				value={value ?? ""}
				onChange={(e) => {
					const num = parseInt(e.target.value, 10);
					form.setValue(
						"frequencyOfDepreciation",
						Number.isNaN(num) ? null : Math.max(1, num),
						{ shouldDirty: true },
					);
				}}
			/>
			{form.formState.errors.frequencyOfDepreciation && (
				<p className="text-xs text-destructive">
					{form.formState.errors.frequencyOfDepreciation.message}
				</p>
			)}
			<p className="text-xs text-muted-foreground">
				How often (in months) depreciation is booked.
			</p>
		</div>
	);
}

function ExpectedValueAfterUsefulLifeInput({
	form,
}: {
	form: ReturnType<typeof useForm<AssetCategoryFormValues>>;
}) {
	const value = useWatch({
		control: form.control,
		name: "expectedValueAfterUsefulLife",
	});
	return (
		<div className="space-y-2">
			<Label htmlFor="expectedValueAfterUsefulLife">
				Expected Value After Useful Life (Salvage Value)
			</Label>
			<Input
				id="expectedValueAfterUsefulLife"
				type="number"
				min={0}
				step={0.01}
				placeholder="e.g. 1000"
				value={value ?? ""}
				onChange={(e) => {
					const num = parseFloat(e.target.value);
					form.setValue(
						"expectedValueAfterUsefulLife",
						Number.isNaN(num) ? null : Math.max(0, num),
						{ shouldDirty: true },
					);
				}}
			/>
			{form.formState.errors.expectedValueAfterUsefulLife && (
				<p className="text-xs text-destructive">
					{form.formState.errors.expectedValueAfterUsefulLife.message}
				</p>
			)}
			<p className="text-xs text-muted-foreground">
				The estimated value of the asset at the end of its useful life.
			</p>
		</div>
	);
}

function RateOfDepreciationInput({
	form,
}: {
	form: ReturnType<typeof useForm<AssetCategoryFormValues>>;
}) {
	const value = useWatch({
		control: form.control,
		name: "rateOfDepreciation",
	});
	return (
		<div className="space-y-2">
			<Label htmlFor="rateOfDepreciation">Rate of Depreciation (%)</Label>
			<Input
				id="rateOfDepreciation"
				type="number"
				min={0}
				max={100}
				step={0.01}
				placeholder="e.g. 15"
				value={value ?? ""}
				onChange={(e) => {
					const num = parseFloat(e.target.value);
					form.setValue(
						"rateOfDepreciation",
						Number.isNaN(num) ? null : Math.max(0, Math.min(100, num)),
						{ shouldDirty: true },
					);
				}}
			/>
			{form.formState.errors.rateOfDepreciation && (
				<p className="text-xs text-destructive">
					{form.formState.errors.rateOfDepreciation.message}
				</p>
			)}
			<p className="text-xs text-muted-foreground">
				Annual depreciation rate. If not set, it is calculated from the salvage
				value.
			</p>
		</div>
	);
}

function DailyProrataBasedInput({
	form,
}: {
	form: ReturnType<typeof useForm<AssetCategoryFormValues>>;
}) {
	const value = useWatch({
		control: form.control,
		name: "dailyProrataBased",
	});
	return (
		<div className="space-y-2">
			<div className="flex items-start gap-2">
				<Checkbox
					id="dailyProrataBased"
					checked={value ?? false}
					onCheckedChange={(checked) =>
						form.setValue("dailyProrataBased", Boolean(checked) ?? null, {
							shouldDirty: true,
						})
					}
				/>
				<div className="space-y-1">
					<Label htmlFor="dailyProrataBased">
						Depreciate Based on Daily Pro-Rata
					</Label>
					<p className="text-sm text-muted-foreground">
						Calculate depreciation based on the actual number of days in each
						period rather than on a fixed monthly basis.
					</p>
				</div>
			</div>
		</div>
	);
}

function ShiftBasedInput({
	form,
}: {
	form: ReturnType<typeof useForm<AssetCategoryFormValues>>;
}) {
	const value = useWatch({
		control: form.control,
		name: "shiftBased",
	});
	return (
		<div className="space-y-2">
			<div className="flex items-start gap-2">
				<Checkbox
					id="shiftBased"
					checked={value ?? false}
					onCheckedChange={(checked) =>
						form.setValue("shiftBased", Boolean(checked) ?? null, {
							shouldDirty: true,
						})
					}
				/>
				<div className="space-y-1">
					<Label htmlFor="shiftBased">Depreciate Based on Shifts</Label>
					<p className="text-sm text-muted-foreground">
						Apply different depreciation amounts based on asset shift factors.
						Requires shift allocation setup.
					</p>
				</div>
			</div>
		</div>
	);
}
