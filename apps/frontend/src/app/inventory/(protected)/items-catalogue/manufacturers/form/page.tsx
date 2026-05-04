"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

type ItemManufacturerFormValues = z.input<
	typeof Inventory.createItemManufacturerSchema
>;

const editItemManufacturerFormSchema = Inventory.updateItemManufacturerSchema
	.omit({ id: true })
	.extend({
		itemId: Inventory.createItemManufacturerSchema.shape.itemId,
		manufacturer: Inventory.createItemManufacturerSchema.shape.manufacturer,
		manufacturerPartNumber:
			Inventory.createItemManufacturerSchema.shape.manufacturerPartNumber,
		isDefault: Inventory.createItemManufacturerSchema.shape.isDefault,
	});

export default function ItemManufacturerFormPage() {
	return (
		<Suspense fallback={<ItemManufacturerFormFallback />}>
			<ItemManufacturerFormContent />
		</Suspense>
	);
}

function ItemManufacturerFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const hasHandledMissingManufacturerRef = useRef(false);
	const utils = trpc.useUtils();
	const formSchema = useMemo(
		() =>
			isEditMode
				? editItemManufacturerFormSchema
				: Inventory.createItemManufacturerSchema,
		[isEditMode],
	);
	const queryItemId = searchParams.get("itemId") ?? "";
	const queryManufacturer = searchParams.get("manufacturer") ?? "";
	const queryManufacturerPartNumber =
		searchParams.get("manufacturerPartNumber") ?? "";
	const queryIsDefault = searchParams.get("isDefault") === "true";

	const form = useForm<ItemManufacturerFormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			itemId: queryItemId,
			manufacturer: queryManufacturer,
			manufacturerPartNumber: queryManufacturerPartNumber,
			isDefault: queryIsDefault,
		},
	});

	const { data: selectableItems = [] } =
		trpc.inventory.listBundleItems.useQuery();
	const { data: itemManufacturer, isLoading: isFetchingItemManufacturer } =
		trpc.inventory.getItemManufacturerById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	const selectedItemId = form.watch("itemId");
	const selectedItem = useMemo(
		() => selectableItems.find((item) => item.id === selectedItemId),
		[selectableItems, selectedItemId],
	);

	useEffect(() => {
		if (!isEditMode || !itemManufacturer) return;

		form.reset({
			itemId: itemManufacturer.itemId,
			manufacturer: itemManufacturer.manufacturer,
			manufacturerPartNumber: itemManufacturer.manufacturerPartNumber,
			isDefault: itemManufacturer.isDefault,
		});
	}, [form, isEditMode, itemManufacturer]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingItemManufacturer &&
			!itemManufacturer &&
			!hasHandledMissingManufacturerRef.current
		) {
			hasHandledMissingManufacturerRef.current = true;
			toast.error("Item manufacturer not found");
			startTransition(() => {
				router.push("/inventory/items-catalogue/manufacturers");
			});
		}
	}, [isEditMode, isFetchingItemManufacturer, itemManufacturer, router]);

	useEffect(() => {
		if (isEditMode) return;
		if (selectableItems.length === 0) return;

		const currentItemId = form.getValues("itemId");
		if (!currentItemId) {
			form.setValue("itemId", selectableItems[0].id, {
				shouldDirty: false,
			});
		}
	}, [form, isEditMode, selectableItems]);

	const createMutation = trpc.inventory.createItemManufacturer.useMutation({
		onSuccess: async () => {
			toast.success("Item manufacturer created successfully");
			await utils.inventory.listItemManufacturers.invalidate();
			startTransition(() => {
				router.push("/inventory/items-catalogue/manufacturers");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateItemManufacturer.useMutation({
		onSuccess: async () => {
			toast.success("Item manufacturer updated successfully");
			await utils.inventory.listItemManufacturers.invalidate();
			if (id) {
				await utils.inventory.getItemManufacturerById.invalidate({ id });
			}
			startTransition(() => {
				router.push("/inventory/items-catalogue/manufacturers");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: ItemManufacturerFormValues) => {
		const payload = {
			itemId: values.itemId,
			manufacturer: values.manufacturer.trim(),
			manufacturerPartNumber: values.manufacturerPartNumber.trim(),
			isDefault: values.isDefault ?? false,
		};

		if (isEditMode && id) {
			updateMutation.mutate({
				id,
				...payload,
			});
			return;
		}

		const parsedCreate =
			Inventory.createItemManufacturerSchema.safeParse(payload);
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
	const hasUnsavedChanges = form.formState.isDirty;

	if (isEditMode && isFetchingItemManufacturer) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	const title =
		isEditMode && itemManufacturer
			? itemManufacturer.manufacturer
			: "New Item Manufacturer";

	const itemName = selectedItem?.name ?? itemManufacturer?.itemName ?? "";
	const itemDescription =
		selectedItem?.description ?? itemManufacturer?.itemDescription ?? "";

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
						<Label htmlFor="itemName">Item Name</Label>
						<Input
							id="itemName"
							value={itemName}
							readOnly
							placeholder="Auto-filled from selected item"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="manufacturer">Manufacturer *</Label>
						<Input
							id="manufacturer"
							{...form.register("manufacturer")}
							placeholder="Enter manufacturer"
						/>
						{form.formState.errors.manufacturer && (
							<p className="text-xs text-destructive">
								{form.formState.errors.manufacturer.message}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="itemDescription">Description</Label>
						<Input
							id="itemDescription"
							value={itemDescription}
							readOnly
							placeholder="Auto-filled from selected item"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="manufacturerPartNumber">
							Manufacturer Part Number *
						</Label>
						<Input
							id="manufacturerPartNumber"
							{...form.register("manufacturerPartNumber")}
							placeholder="Enter manufacturer part number"
						/>
						{form.formState.errors.manufacturerPartNumber && (
							<p className="text-xs text-destructive">
								{form.formState.errors.manufacturerPartNumber.message}
							</p>
						)}
					</div>
				</div>

				<div className="border-t px-5 py-4">
					<div className="flex items-center gap-2">
						<Checkbox
							id="isDefault"
							checked={form.watch("isDefault")}
							onCheckedChange={(checked) =>
								form.setValue("isDefault", Boolean(checked), {
									shouldDirty: true,
								})
							}
						/>
						<Label htmlFor="isDefault">Is Default</Label>
					</div>
				</div>
			</div>
		</div>
	);
}

function ItemManufacturerFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
