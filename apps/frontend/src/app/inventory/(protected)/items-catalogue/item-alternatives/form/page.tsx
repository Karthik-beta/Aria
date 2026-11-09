"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type ItemAlternativeFormValues = z.input<
	typeof Inventory.createItemAlternativeSchema
>;

export default function ItemAlternativeFormPage() {
	return (
		<Suspense fallback={<ItemAlternativeFormFallback />}>
			<ItemAlternativeFormContent />
		</Suspense>
	);
}

function ItemAlternativeFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const [isInitialized, setIsInitialized] = useState(!isEditMode);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!isEditMode);
	const hasHandledMissingAlternativeRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<ItemAlternativeFormValues>({
		resolver: zodResolver(Inventory.createItemAlternativeSchema),
		defaultValues: {
			itemId: "",
			alternativeItemId: "",
			twoWay: false,
		},
	});

	const { data: selectableItems = [] } =
		trpc.inventory.listBundleItems.useQuery();
	const { data: itemAlternative, isLoading: isFetchingAlternative } =
		trpc.inventory.getItemAlternativeById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);
	const selectedItemId = form.watch("itemId");
	const alternativeSelectableItems = selectableItems.filter(
		(item) => item.id !== selectedItemId,
	);

	useEffect(() => {
		if (!isInitialized) return;
		const subscription = form.watch(() => {
			setHasUnsavedChanges(true);
		});
		return () => subscription.unsubscribe();
	}, [form, isInitialized]);

	useEffect(() => {
		if (!isEditMode || !itemAlternative) return;

		form.reset({
			itemId: itemAlternative.itemId,
			alternativeItemId: itemAlternative.alternativeItemId,
			twoWay: itemAlternative.twoWay ?? false,
		});
		setHasUnsavedChanges(false);
		setIsInitialized(true);
	}, [form, isEditMode, itemAlternative]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingAlternative &&
			!itemAlternative &&
			!hasHandledMissingAlternativeRef.current
		) {
			hasHandledMissingAlternativeRef.current = true;
			toast.error("Item alternative not found");
			startTransition(() => {
				router.push("/inventory/items-catalogue/item-alternatives");
			});
		}
	}, [isEditMode, isFetchingAlternative, itemAlternative, router]);

	useEffect(() => {
		if (isEditMode || selectableItems.length === 0) return;

		const currentItemId = form.getValues("itemId");
		const nextItemId = currentItemId || selectableItems[0].id;
		if (!currentItemId) {
			form.setValue("itemId", nextItemId, {
				shouldDirty: false,
			});
		}

		const currentAlternativeId = form.getValues("alternativeItemId");
		const preferredAlternative = selectableItems.find(
			(item) => item.id !== nextItemId,
		);
		if (!currentAlternativeId && preferredAlternative) {
			form.setValue("alternativeItemId", preferredAlternative.id, {
				shouldDirty: false,
			});
		}
	}, [form, isEditMode, selectableItems]);

	useEffect(() => {
		if (isEditMode) return;
		if (!selectedItemId) return;

		if (form.getValues("alternativeItemId") === selectedItemId) {
			form.setValue("alternativeItemId", "", {
				shouldDirty: false,
			});
		}
	}, [form, isEditMode, selectedItemId]);

	const createMutation = trpc.inventory.createItemAlternative.useMutation({
		onSuccess: async () => {
			toast.success("Item alternative created successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listItemAlternatives.invalidate();
			startTransition(() => {
				router.push("/inventory/items-catalogue/item-alternatives");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateItemAlternative.useMutation({
		onSuccess: async () => {
			toast.success("Item alternative updated successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listItemAlternatives.invalidate();
			if (id) {
				await utils.inventory.getItemAlternativeById.invalidate({ id });
			}
			startTransition(() => {
				router.push("/inventory/items-catalogue/item-alternatives");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: ItemAlternativeFormValues) => {
		const payload = {
			itemId: values.itemId,
			alternativeItemId: values.alternativeItemId,
			twoWay: values.twoWay ?? false,
		};

		if (isEditMode && id) {
			updateMutation.mutate({ id, ...payload });
			return;
		}

		const parsedCreate =
			Inventory.createItemAlternativeSchema.safeParse(payload);
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

	if (isEditMode && isFetchingAlternative) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	const title =
		isEditMode && itemAlternative
			? `${itemAlternative.itemCode} -> ${itemAlternative.alternativeItemCode}`
			: "New Item Alternative";

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
				<div className="grid gap-6 px-5 py-5 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="itemId">Item Code *</Label>
						<Select
							value={selectedItemId || undefined}
							onValueChange={(value) =>
								form.setValue("itemId", value, { shouldDirty: true })
							}
						>
							<SelectTrigger id="itemId">
								<SelectValue placeholder="Select item code" />
							</SelectTrigger>
							<SelectContent>
								{selectableItems.map((item) => (
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
						<Label htmlFor="alternativeItemId">Alternative Item Code *</Label>
						<Select
							value={form.watch("alternativeItemId") || undefined}
							onValueChange={(value) =>
								form.setValue("alternativeItemId", value, {
									shouldDirty: true,
								})
							}
						>
							<SelectTrigger id="alternativeItemId">
								<SelectValue placeholder="Select alternative item code" />
							</SelectTrigger>
							<SelectContent>
								{alternativeSelectableItems.map((item) => (
									<SelectItem key={item.id} value={item.id}>
										{item.code}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{form.formState.errors.alternativeItemId && (
							<p className="text-xs text-destructive">
								{form.formState.errors.alternativeItemId.message}
							</p>
						)}
					</div>
				</div>

				<div className="border-t px-5 py-4">
					<div className="flex items-center gap-2">
						<Checkbox
							id="twoWay"
							checked={form.watch("twoWay")}
							onCheckedChange={(checked) =>
								form.setValue("twoWay", Boolean(checked), {
									shouldDirty: true,
								})
							}
						/>
						<Label htmlFor="twoWay">Two-way</Label>
					</div>
				</div>
			</div>
		</div>
	);
}

function ItemAlternativeFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
