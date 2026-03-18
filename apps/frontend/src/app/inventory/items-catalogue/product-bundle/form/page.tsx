"use client";

import type { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Menu, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

type ProductBundleFormValues = Inventory.CreateProductBundleInput;

const productBundleFormSchema = z.object({
	parentItemId: z.string().min(1, "Parent item is required"),
	description: z.string().optional(),
	disabled: z.boolean().default(false),
	bundleItems: z
		.array(
			z.object({
				itemId: z.string().min(1, "Item is required"),
				quantity: z.number().int().min(1, "Quantity must be at least 1"),
				description: z.string().optional(),
				unitOfMeasurementId: z.string().optional(),
			}),
		)
		.min(1, "At least one bundle item is required"),
});

export default function NewProductBundlePage() {
	const router = useRouter();
	const { data: selectableItems = [] } =
		trpc.inventory.listBundleItems.useQuery();
	const { data: unitsOfMeasure = [] } =
		trpc.inventory.listUnitsOfMeasure.useQuery();
	const utils = trpc.useUtils();

	const form = useForm<ProductBundleFormValues>({
		resolver: zodResolver(productBundleFormSchema),
		defaultValues: {
			parentItemId: "",
			description: "",
			disabled: false,
			bundleItems: [
				{
					itemId: "",
					quantity: 1,
					description: "",
					unitOfMeasurementId: undefined,
				},
			],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "bundleItems",
	});

	const createBundleMutation = trpc.inventory.createProductBundle.useMutation({
		onSuccess: async () => {
			toast.success("Product bundle created successfully");
			await utils.inventory.listProductBundles.invalidate();
			router.push("/inventory/product-bundle");
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const onSubmit = (values: ProductBundleFormValues) => {
		createBundleMutation.mutate({
			...values,
			description: values.description?.trim() || undefined,
			bundleItems: values.bundleItems.map((item) => ({
				...item,
				description: item.description?.trim() || undefined,
				unitOfMeasurementId: item.unitOfMeasurementId || undefined,
			})),
		});
	};

	const isSubmitting = createBundleMutation.isPending;
	const itemMap = useMemo(
		() => new Map(selectableItems.map((item) => [item.id, item])),
		[selectableItems],
	);

	useEffect(() => {
		if (selectableItems.length === 0) return;

		const currentParent = form.getValues("parentItemId");
		if (!currentParent) {
			form.setValue("parentItemId", selectableItems[0].id, {
				shouldDirty: false,
			});
		}

		const firstRowItem = form.getValues("bundleItems.0.itemId");
		const preferredBundleItem = selectableItems[1] ?? selectableItems[0];
		if (!firstRowItem && preferredBundleItem) {
			form.setValue("bundleItems.0.itemId", preferredBundleItem.id, {
				shouldDirty: false,
			});
			if (preferredBundleItem.defaultUnitOfMeasureId) {
				form.setValue(
					"bundleItems.0.unitOfMeasurementId",
					preferredBundleItem.defaultUnitOfMeasureId,
					{ shouldDirty: false },
				);
			}
		}
	}, [form, selectableItems]);

	return (
		<div className="flex min-h-screen flex-col bg-[#f8f9fa] px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Menu className="h-5 w-5 text-muted-foreground" />
					<h1 className="text-3xl font-bold tracking-tight">
						New Product Bundle
					</h1>
					{form.formState.isDirty && (
						<Badge className="border-none bg-[#fff3e0] text-[#fb8c00] hover:bg-[#fff3e0]">
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

			<div className="rounded-xl border bg-background">
				<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-[1fr_auto]">
					<div className="space-y-5">
						<div className="space-y-2">
							<Label htmlFor="parentItemId">Parent Item *</Label>
							<Select
								onValueChange={(value) =>
									form.setValue("parentItemId", value, { shouldDirty: true })
								}
								value={form.watch("parentItemId") || undefined}
							>
								<SelectTrigger id="parentItemId" className="h-10">
									<SelectValue placeholder="Select parent item" />
								</SelectTrigger>
								<SelectContent>
									{selectableItems.map((item) => (
										<SelectItem key={item.id} value={item.id}>
											{item.name} ({item.code})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{form.formState.errors.parentItemId && (
								<p className="text-xs text-destructive">
									{form.formState.errors.parentItemId.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								rows={3}
								value={form.watch("description") ?? ""}
								onChange={(event) =>
									form.setValue("description", event.target.value, {
										shouldDirty: true,
									})
								}
							/>
						</div>
					</div>

					<div className="flex items-start">
						<div className="flex items-center gap-2 pt-8">
							<Checkbox
								id="disabled"
								checked={form.watch("disabled")}
								onCheckedChange={(checked) =>
									form.setValue("disabled", Boolean(checked), {
										shouldDirty: true,
									})
								}
							/>
							<Label htmlFor="disabled">Disabled</Label>
						</div>
					</div>
				</div>

				<div className="space-y-4 p-5">
					<div>
						<h2 className="text-2xl font-semibold">Items</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							List items that form the package.
						</p>
					</div>

					<div className="overflow-hidden rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-10" />
									<TableHead className="w-12">No.</TableHead>
									<TableHead>Item *</TableHead>
									<TableHead className="w-30">Qty *</TableHead>
									<TableHead>Description</TableHead>
									<TableHead className="w-45">UOM</TableHead>
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
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
										<TableCell>{index + 1}</TableCell>
										<TableCell>
											<Select
												onValueChange={(value) => {
													form.setValue(`bundleItems.${index}.itemId`, value, {
														shouldDirty: true,
													});
													const matchedItem = itemMap.get(value);
													if (matchedItem?.defaultUnitOfMeasureId) {
														form.setValue(
															`bundleItems.${index}.unitOfMeasurementId`,
															matchedItem.defaultUnitOfMeasureId,
															{ shouldDirty: true },
														);
													}
												}}
												value={
													form.watch(`bundleItems.${index}.itemId`) || undefined
												}
											>
												<SelectTrigger className="h-9">
													<SelectValue placeholder="Select item" />
												</SelectTrigger>
												<SelectContent>
													{selectableItems.map((item) => (
														<SelectItem key={item.id} value={item.id}>
															{item.name} ({item.code})
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</TableCell>
										<TableCell>
											<Input
												type="number"
												step={1}
												min={1}
												className="h-9"
												value={form.watch(`bundleItems.${index}.quantity`)}
												onChange={(event) =>
													form.setValue(
														`bundleItems.${index}.quantity`,
														Math.max(1, Number(event.target.value) || 1),
														{ shouldDirty: true },
													)
												}
											/>
										</TableCell>
										<TableCell>
											<Input
												className="h-9"
												placeholder="Description"
												value={
													form.watch(`bundleItems.${index}.description`) ?? ""
												}
												onChange={(event) =>
													form.setValue(
														`bundleItems.${index}.description`,
														event.target.value,
														{ shouldDirty: true },
													)
												}
											/>
										</TableCell>
										<TableCell>
											<Select
												onValueChange={(value) =>
													form.setValue(
														`bundleItems.${index}.unitOfMeasurementId`,
														value,
														{ shouldDirty: true },
													)
												}
												value={
													form.watch(
														`bundleItems.${index}.unitOfMeasurementId`,
													) || undefined
												}
											>
												<SelectTrigger className="h-9">
													<SelectValue placeholder="Select UOM" />
												</SelectTrigger>
												<SelectContent>
													{unitsOfMeasure.map((uom) => (
														<SelectItem key={uom.id} value={uom.id}>
															{uom.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					{form.formState.errors.bundleItems && (
						<p className="text-xs text-destructive">
							At least one bundle item is required.
						</p>
					)}

					<Button
						variant="outline"
						onClick={() =>
							append({
								itemId: "",
								quantity: 1,
								description: "",
								unitOfMeasurementId: undefined,
							})
						}
					>
						<Plus className="mr-1.5 h-4 w-4" />
						Add Row
					</Button>
				</div>

				<div className="border-t px-5 py-4">
					<h2 className="mb-2 text-3xl font-semibold">About Product Bundle</h2>
					<p className="mb-3 text-sm text-muted-foreground">
						Aggregate group of <span className="font-semibold">Items</span> into
						another <span className="font-semibold">Item</span>. This is useful
						if you are bundling a certain{" "}
						<span className="font-semibold">Items</span> into a package and you
						maintain stock of the packed{" "}
						<span className="font-semibold">Items</span> and not the aggregate{" "}
						<span className="font-semibold">Item</span>.
					</p>
					<p className="mb-2 text-sm text-muted-foreground">
						The package Item will have{" "}
						<span className="font-mono text-violet-600">Is Stock Item</span> as
						No and
						<span className="font-mono text-violet-600">Is Sales Item</span> as
						Yes.
					</p>
					<p className="mb-2 text-xl font-semibold">Example:</p>
					<p className="text-sm text-muted-foreground">
						If you are selling Laptops and Backpacks separately and have a
						special price if the customer buys both, then the Laptop + Backpack
						will be a new Product Bundle Item.
					</p>
				</div>
			</div>
		</div>
	);
}
