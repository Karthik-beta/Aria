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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

const brandFormSchema = z.object({
	name: z.string().min(1, "Brand Name is required").max(255).trim(),
	description: z.string().max(1000).trim().optional(),
});

type BrandFormValues = z.input<typeof brandFormSchema>;

/**
 * BrandFormPage renders the create/edit form for a single Brand record.
 */
export default function BrandFormPage() {
	return (
		<Suspense fallback={<BrandFormFallback />}>
			<BrandFormContent />
		</Suspense>
	);
}

function BrandFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const [isInitialized, setIsInitialized] = useState(!isEditMode);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!isEditMode);
	const hasHandledMissingBrandRef = useRef(false);
	const utils = trpc.useUtils();
	const queryName = searchParams.get("name")?.trim() ?? "";

	const form = useForm<BrandFormValues>({
		resolver: zodResolver(brandFormSchema),
		defaultValues: {
			name: queryName,
			description: "",
		},
	});

	const { data: brand, isLoading: isFetchingBrand } =
		trpc.inventory.getBrandById.useQuery(
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
		if (!isEditMode || !brand) return;
		if (form.formState.isDirty) return; // Don't overwrite user edits on refetch

		form.reset({
			name: brand.name,
			description: brand.description ?? "",
		});
		setHasUnsavedChanges(false);
		setIsInitialized(true);
	}, [form, isEditMode, brand]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingBrand &&
			!brand &&
			!hasHandledMissingBrandRef.current
		) {
			hasHandledMissingBrandRef.current = true;
			toast.error("Brand not found");
			startTransition(() => {
				router.push("/inventory/inventory-settings/brand");
			});
		}
	}, [isEditMode, isFetchingBrand, router, brand]);

	const createMutation = trpc.inventory.createBrand.useMutation({
		onSuccess: async () => {
			toast.success("Brand created successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listBrands.invalidate();
			startTransition(() => {
				router.push("/inventory/inventory-settings/brand");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateBrand.useMutation({
		onSuccess: async () => {
			toast.success("Brand updated successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listBrands.invalidate();
			if (id) {
				await utils.inventory.getBrandById.invalidate({ id });
			}
			startTransition(() => {
				router.push("/inventory/inventory-settings/brand");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: BrandFormValues) => {
		const payload = {
			name: values.name.trim(),
			description: values.description?.trim() || null,
		};

		if (isEditMode && id) {
			const parsedUpdate = Inventory.updateBrandSchema.safeParse({
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

		const parsedCreate = Inventory.createBrandSchema.safeParse(payload);
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

	if (isEditMode && isFetchingBrand) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	const title = isEditMode && brand ? brand.name : "New Brand";

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
					<div className="space-y-2">
						<Label htmlFor="name">
							Brand Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="name"
							placeholder="Enter brand name"
							{...form.register("name")}
						/>
						{form.formState.errors.name && (
							<p className="text-xs text-destructive">
								{form.formState.errors.name.message}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							placeholder="Enter an optional description"
							rows={3}
							{...form.register("description")}
						/>
						{form.formState.errors.description && (
							<p className="text-xs text-destructive">
								{form.formState.errors.description.message}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function BrandFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
