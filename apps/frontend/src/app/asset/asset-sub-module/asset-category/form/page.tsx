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
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useTransition } from "react";
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
		}
		prevNonDepreciableRef.current = nonDepreciableCategory;
	}, [nonDepreciableCategory, form]);

	if (isEditMode && isFetchingCategory) {
		return <AssetCategoryFormFallback />;
	}

	const title = isEditMode && category ? category.name : "New Asset Category";

	return (
		<div className="flex min-h-screen flex-col bg-[#f8f9fa] px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
					{hasUnsavedChanges && (
						<Badge className="border-none bg-[#fff3e0] text-[#fb8c00] hover:bg-[#fff3e0]">
							Not Saved
						</Badge>
					)}
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
								<Label htmlFor="depreciationMethod">
									Depreciation Method{" "}
									<span className="text-destructive">*</span>
								</Label>
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
										{DEPRECIATION_METHOD_OPTIONS.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
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
						</div>
					</>
				)}

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
