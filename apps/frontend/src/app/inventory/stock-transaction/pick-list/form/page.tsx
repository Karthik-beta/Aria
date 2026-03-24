"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
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
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import {
	PICK_LIST_PURPOSE_OPTIONS,
	PICK_LIST_STATUS_OPTIONS,
} from "../pick-list.utils";

type PickListFormValues = Omit<
	z.input<typeof Inventory.createPickListSchema>,
	"items"
> & {
	items: Array<
		z.input<typeof Inventory.createPickListItemSchema> & { id?: string }
	>;
};

export default function PickListFormPage() {
	return (
		<Suspense fallback={<PickListFormFallback />}>
			<PickListFormContent />
		</Suspense>
	);
}

function PickListFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}

function PickListFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<PickListFormValues>({
		resolver: zodResolver(Inventory.createPickListSchema),
		defaultValues: {
			company: "",
			customer: "",
			purpose: "MATERIAL_TRANSFER_FOR_MANUFACTURE",
			status: "DRAFT",
			workOrder: "",
			warehouse: "",
			scanBarcode: "",
			considerRejectedWarehouses: false,
			pickManually: false,
			ignorePricingRule: false,
			scanMode: false,
			promptQty: false,
			groupSameItems: false,
			items: [],
		},
	});

	const {
		fields: itemFields,
		append: appendItem,
		remove: removeItem,
	} = useFieldArray({ control: form.control, name: "items" });

	const { data: pickList, isLoading: isFetchingPickList } =
		trpc.inventory.getPickListById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	useEffect(() => {
		if (!isEditMode || !pickList) return;
		form.reset({
			company: pickList.company,
			customer: pickList.customer ?? "",
			purpose: pickList.purpose,
			status: pickList.status,
			workOrder: pickList.workOrder ?? "",
			warehouse: pickList.warehouse ?? "",
			scanBarcode: pickList.scanBarcode ?? "",
			considerRejectedWarehouses: pickList.considerRejectedWarehouses,
			pickManually: pickList.pickManually,
			ignorePricingRule: pickList.ignorePricingRule,
			scanMode: pickList.scanMode,
			promptQty: pickList.promptQty,
			groupSameItems: pickList.groupSameItems,
			items: pickList.items.map((item) => ({
				id: item.id,
				item: item.item,
				warehouse: item.warehouse ?? "",
				qty: item.qty,
				stockQty: item.stockQty ?? undefined,
				pickedQty: item.pickedQty ?? undefined,
			})),
		});
	}, [form, isEditMode, pickList]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingPickList &&
			!pickList &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Pick list not found");
			startTransition(() => {
				router.push("/inventory/stock-transaction/pick-list");
			});
		}
	}, [isEditMode, isFetchingPickList, pickList, router]);

	const createMutation = trpc.inventory.createPickList.useMutation({
		onSuccess: async () => {
			toast.success("Pick list created successfully");
			await utils.inventory.listPickLists.invalidate();
			startTransition(() => {
				router.push("/inventory/stock-transaction/pick-list");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updatePickList.useMutation({
		onSuccess: async () => {
			toast.success("Pick list updated successfully");
			await utils.inventory.listPickLists.invalidate();
			startTransition(() => {
				router.push("/inventory/stock-transaction/pick-list");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: PickListFormValues) => {
		const normalizedItems = values.items.map((item) => ({
			id: isEditMode ? item.id : undefined,
			item: item.item.trim(),
			warehouse: item.warehouse?.trim() || undefined,
			qty: item.qty,
			stockQty: item.stockQty,
			pickedQty: item.pickedQty,
		}));

		if (isEditMode && id) {
			updateMutation.mutate({
				id,
				company: values.company.trim() || undefined,
				customer: values.customer?.trim() || null,
				purpose: values.purpose,
				status: values.status,
				workOrder: values.workOrder?.trim() || null,
				warehouse: values.warehouse?.trim() || null,
				scanBarcode: values.scanBarcode?.trim() || null,
				considerRejectedWarehouses: values.considerRejectedWarehouses,
				pickManually: values.pickManually,
				ignorePricingRule: values.ignorePricingRule,
				scanMode: values.scanMode,
				promptQty: values.promptQty,
				groupSameItems: values.groupSameItems,
				items: normalizedItems,
			});
			return;
		}

		const parsedCreate = Inventory.createPickListSchema.safeParse({
			...values,
			company: values.company.trim(),
			customer: values.customer?.trim() || undefined,
			workOrder: values.workOrder?.trim() || undefined,
			warehouse: values.warehouse?.trim() || undefined,
			scanBarcode: values.scanBarcode?.trim() || undefined,
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

	const handleGetItemLocations = () => {
		toast.info("Feature coming soon");
	};

	if (isEditMode && isFetchingPickList) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col bg-muted/20 px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">
						{isEditMode
							? (pickList?.series ?? "Edit Pick List")
							: "New Pick List"}
					</h1>
					{form.formState.isDirty && (
						<Badge className="border-none bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-300">
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

			<div className="overflow-hidden rounded-lg border bg-background shadow-sm">
				<Tabs defaultValue="details" className="w-full">
					<div className="border-b px-4 py-2">
						<TabsList>
							<TabsTrigger value="details">Details</TabsTrigger>
							<TabsTrigger value="settings">Settings</TabsTrigger>
						</TabsList>
					</div>

					{/* ── Details tab ── */}
					<TabsContent
						value="details"
						className="m-0 focus-visible:outline-none"
					>
						<div className="grid gap-6 px-5 pb-4 pt-5 md:grid-cols-3">
							{isEditMode && (
								<div className="space-y-2">
									<Label>Series</Label>
									<Input
										value={pickList?.series ?? ""}
										readOnly
										className="bg-muted"
									/>
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="company">Company *</Label>
								<Input id="company" {...form.register("company")} />
								{form.formState.errors.company && (
									<p className="text-xs text-destructive">
										{form.formState.errors.company.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="customer">Customer</Label>
								<Input
									id="customer"
									placeholder="Optional"
									{...form.register("customer")}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="purpose">Purpose</Label>
								<Controller
									name="purpose"
									control={form.control}
									render={({ field }) => (
										<Select
											value={field.value ?? "MATERIAL_TRANSFER_FOR_MANUFACTURE"}
											onValueChange={field.onChange}
										>
											<SelectTrigger id="purpose">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{PICK_LIST_PURPOSE_OPTIONS.map((opt) => (
													<SelectItem key={opt.value} value={opt.value}>
														{opt.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="status">Status</Label>
								<Controller
									name="status"
									control={form.control}
									render={({ field }) => (
										<Select
											value={field.value ?? "DRAFT"}
											onValueChange={field.onChange}
										>
											<SelectTrigger id="status">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{PICK_LIST_STATUS_OPTIONS.map((opt) => (
													<SelectItem key={opt.value} value={opt.value}>
														{opt.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="warehouse">Warehouse</Label>
								<Input
									id="warehouse"
									placeholder="Optional"
									{...form.register("warehouse")}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="workOrder">Work Order</Label>
								<Input
									id="workOrder"
									placeholder="Optional"
									{...form.register("workOrder")}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="scanBarcode">Scan Barcode</Label>
								<Input
									id="scanBarcode"
									placeholder="Optional"
									{...form.register("scanBarcode")}
								/>
							</div>
						</div>

						{/* ── Items section ── */}
						<div className="space-y-4 border-t px-5 py-4">
							<div className="flex items-center justify-between">
								<h2 className="text-xl font-semibold">Items</h2>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleGetItemLocations}
								>
									<MapPin className="mr-2 h-4 w-4" />
									Get Item Locations
								</Button>
							</div>

							<div className="overflow-x-auto rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-10" />
											<TableHead className="w-12">No.</TableHead>
											<TableHead>Item *</TableHead>
											<TableHead>Warehouse</TableHead>
											<TableHead className="w-28">Qty *</TableHead>
											<TableHead className="w-28">Stock Qty</TableHead>
											<TableHead className="w-28">Picked Qty</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{itemFields.length === 0 && (
											<TableRow>
												<TableCell
													colSpan={7}
													className="py-8 text-center text-sm text-muted-foreground"
												>
													No items added. Click &ldquo;Add Item&rdquo; to get
													started.
												</TableCell>
											</TableRow>
										)}
										{itemFields.map((field, index) => (
											<TableRow key={field.id}>
												<TableCell>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="h-7 w-7"
														onClick={() => removeItem(index)}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</TableCell>
												<TableCell>{index + 1}</TableCell>
												<TableCell>
													<Input
														className="h-9"
														placeholder="Item"
														{...form.register(`items.${index}.item`)}
													/>
													{form.formState.errors.items?.[index]?.item && (
														<p className="mt-1 text-xs text-destructive">
															{form.formState.errors.items[index].item?.message}
														</p>
													)}
												</TableCell>
												<TableCell>
													<Input
														className="h-9"
														placeholder="Warehouse"
														{...form.register(`items.${index}.warehouse`)}
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
													<Controller
														name={`items.${index}.stockQty`}
														control={form.control}
														render={({ field: f }) => (
															<Input
																type="number"
																step="0.001"
																min="0"
																className="h-9"
																value={f.value ?? ""}
																onChange={(e) =>
																	f.onChange(
																		e.target.value
																			? Math.max(0, Number(e.target.value))
																			: undefined,
																	)
																}
															/>
														)}
													/>
												</TableCell>
												<TableCell>
													<Controller
														name={`items.${index}.pickedQty`}
														control={form.control}
														render={({ field: f }) => (
															<Input
																type="number"
																step="0.001"
																min="0"
																className="h-9"
																value={f.value ?? ""}
																onChange={(e) =>
																	f.onChange(
																		e.target.value
																			? Math.max(0, Number(e.target.value))
																			: undefined,
																	)
																}
															/>
														)}
													/>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() =>
									appendItem({
										item: "",
										warehouse: "",
										qty: 1,
										stockQty: undefined,
										pickedQty: undefined,
									})
								}
							>
								<Plus className="mr-2 h-4 w-4" />
								Add Item
							</Button>
						</div>
					</TabsContent>

					{/* ── Settings tab ── */}
					<TabsContent
						value="settings"
						className="m-0 focus-visible:outline-none"
					>
						<div className="grid gap-6 px-5 py-5 md:grid-cols-2 lg:grid-cols-3">
							<div className="flex items-center gap-2">
								<Controller
									name="considerRejectedWarehouses"
									control={form.control}
									render={({ field }) => (
										<Checkbox
											id="considerRejectedWarehouses"
											checked={field.value}
											onCheckedChange={(checked) =>
												field.onChange(checked === true)
											}
										/>
									)}
								/>
								<Label htmlFor="considerRejectedWarehouses">
									Consider Rejected Warehouses
								</Label>
							</div>

							<div className="flex items-center gap-2">
								<Controller
									name="pickManually"
									control={form.control}
									render={({ field }) => (
										<Checkbox
											id="pickManually"
											checked={field.value}
											onCheckedChange={(checked) =>
												field.onChange(checked === true)
											}
										/>
									)}
								/>
								<Label htmlFor="pickManually">Pick Manually</Label>
							</div>

							<div className="flex items-center gap-2">
								<Controller
									name="ignorePricingRule"
									control={form.control}
									render={({ field }) => (
										<Checkbox
											id="ignorePricingRule"
											checked={field.value}
											onCheckedChange={(checked) =>
												field.onChange(checked === true)
											}
										/>
									)}
								/>
								<Label htmlFor="ignorePricingRule">Ignore Pricing Rule</Label>
							</div>

							<div className="flex items-center gap-2">
								<Controller
									name="scanMode"
									control={form.control}
									render={({ field }) => (
										<Checkbox
											id="scanMode"
											checked={field.value}
											onCheckedChange={(checked) =>
												field.onChange(checked === true)
											}
										/>
									)}
								/>
								<Label htmlFor="scanMode">Scan Mode</Label>
							</div>

							<div className="flex items-center gap-2">
								<Controller
									name="promptQty"
									control={form.control}
									render={({ field }) => (
										<Checkbox
											id="promptQty"
											checked={field.value}
											onCheckedChange={(checked) =>
												field.onChange(checked === true)
											}
										/>
									)}
								/>
								<Label htmlFor="promptQty">Prompt Qty</Label>
							</div>

							<div className="flex items-center gap-2">
								<Controller
									name="groupSameItems"
									control={form.control}
									render={({ field }) => (
										<Checkbox
											id="groupSameItems"
											checked={field.value}
											onCheckedChange={(checked) =>
												field.onChange(checked === true)
											}
										/>
									)}
								/>
								<Label htmlFor="groupSameItems">Group Same Items</Label>
							</div>
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
