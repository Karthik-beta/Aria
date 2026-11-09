"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

const uomFormSchema = z.object({
	name: z.string().min(1, "UOM Name is required").max(255).trim(),
	enabled: z.boolean().default(true),
	isWholeNumber: z.boolean().default(true),
});

type UomFormValues = z.input<typeof uomFormSchema>;

/**
 * UnitOfMeasureFormPage renders the create/edit form for a single UOM record.
 */
export default function UnitOfMeasureFormPage() {
	return (
		<Suspense fallback={<UnitOfMeasureFormFallback />}>
			<UnitOfMeasureFormContent />
		</Suspense>
	);
}

function UnitOfMeasureFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const [isInitialized, setIsInitialized] = useState(!isEditMode);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!isEditMode);
	const hasHandledMissingUomRef = useRef(false);
	const utils = trpc.useUtils();
	const queryName = searchParams.get("name")?.trim() || "";

	const form = useForm<UomFormValues>({
		resolver: zodResolver(uomFormSchema),
		defaultValues: {
			name: queryName,
			enabled: true,
			isWholeNumber: true,
		},
	});

	const { data: uom, isLoading: isFetchingUom } =
		trpc.inventory.getUnitOfMeasureById.useQuery(
			{ id: id ?? "" },
			{
				enabled: isEditMode,
			},
		);

	useEffect(() => {
		if (!isInitialized) return;
		const subscription = form.watch(() => {
			setHasUnsavedChanges(true);
		});
		return () => subscription.unsubscribe();
	}, [form, isInitialized]);

	useEffect(() => {
		if (!isEditMode || !uom) return;
		if (form.formState.isDirty) return; // Don't overwrite user edits on refetch

		form.reset({
			name: uom.name,
			enabled: !uom.disabled,
			isWholeNumber: uom.isWholeNumber,
		});
		setHasUnsavedChanges(false);
		setIsInitialized(true);
	}, [form, isEditMode, uom]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingUom &&
			!uom &&
			!hasHandledMissingUomRef.current
		) {
			hasHandledMissingUomRef.current = true;
			toast.error("Unit of measure not found");
			startTransition(() => {
				router.push("/inventory/inventory-settings/uom");
			});
		}
	}, [isEditMode, isFetchingUom, router, uom]);

	const createMutation = trpc.inventory.createUnitOfMeasure.useMutation({
		onSuccess: async () => {
			toast.success("Unit of measure created successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listUnitsOfMeasure.invalidate();
			startTransition(() => {
				router.push("/inventory/inventory-settings/uom");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateUnitOfMeasure.useMutation({
		onSuccess: async () => {
			toast.success("Unit of measure updated successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listUnitsOfMeasure.invalidate();
			if (id) {
				await utils.inventory.getUnitOfMeasureById.invalidate({ id });
			}
			startTransition(() => {
				router.push("/inventory/inventory-settings/uom");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: UomFormValues) => {
		const payload = {
			name: values.name.trim(),
			disabled: !values.enabled,
			isWholeNumber: values.isWholeNumber,
		};

		if (isEditMode && id) {
			const parsedUpdate = Inventory.updateUnitOfMeasureSchema.safeParse({
				id,
				...payload,
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

		const parsedCreate = Inventory.createUnitOfMeasureSchema.safeParse(payload);
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

	if (isEditMode && isFetchingUom) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	const title = isEditMode && uom ? uom.name : "New UOM";

	return (
		<div className="flex min-h-screen flex-col bg-muted px-4 py-4 md:px-6">
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

			<div className="rounded-xl border bg-background">
				<div className="space-y-6 px-5 py-5">
					<div className="flex items-center gap-2">
						<Checkbox
							id="enabled"
							checked={form.watch("enabled")}
							onCheckedChange={(checked) =>
								form.setValue("enabled", Boolean(checked), {
									shouldDirty: true,
								})
							}
						/>
						<Label htmlFor="enabled" className="cursor-pointer">
							Enabled
						</Label>
					</div>

					<div className="space-y-2">
						<Label htmlFor="name">
							UOM Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="name"
							placeholder="Enter UOM name"
							{...form.register("name")}
						/>
						{form.formState.errors.name && (
							<p className="text-xs text-destructive">
								{form.formState.errors.name.message}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Checkbox
								id="isWholeNumber"
								checked={form.watch("isWholeNumber")}
								onCheckedChange={(checked) =>
									form.setValue("isWholeNumber", Boolean(checked), {
										shouldDirty: true,
									})
								}
							/>
							<Label htmlFor="isWholeNumber" className="cursor-pointer">
								Must be Whole Number
							</Label>
						</div>
						<p className="text-sm text-muted-foreground">
							Check this to disallow fractions. (for Nos)
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

function UnitOfMeasureFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
