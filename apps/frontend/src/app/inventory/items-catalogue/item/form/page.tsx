"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	ArrowLeft,
	ChevronDown,
	List,
	Loader2,
	MoreHorizontal,
	Settings,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export default function ItemFormPage() {
	return (
		<Suspense fallback={<ItemFormFallback />}>
			<ItemFormContent />
		</Suspense>
	);
}

function ItemFormContent() {
	type CreateFormValues = z.input<typeof Inventory.createSchema>;
	const router = useRouter();
	const searchParams = useSearchParams();
	const itemId = searchParams.get("id");
	const isEditMode = Boolean(itemId);
	const queryCode = searchParams.get("code")?.trim() ?? "";
	const queryName = searchParams.get("name")?.trim() || queryCode;
	const queryItemGroupId = searchParams.get("itemGroupId")?.trim() || undefined;
	const queryDefaultUnitOfMeasureId =
		searchParams.get("defaultUnitOfMeasureId")?.trim() || undefined;
	const queryMaintainStock = searchParams.get("maintainStock");
	const queryIsFixedAsset = searchParams.get("isFixedAsset") === "true";
	const [isPending, startTransition] = useTransition();
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!isEditMode);
	const [isInitialized, setIsInitialized] = useState(!isEditMode);
	const [descriptionOpen, setDescriptionOpen] = useState(true);

	// Combobox states
	const [itemGroupOpen, setItemGroupOpen] = useState(false);
	const [unitOfMeasureOpen, setUnitOfMeasureOpen] = useState(false);
	const [itemGroupSearch, _setItemGroupSearch] = useState("");
	const [unitOfMeasureSearch, _setUnitOfMeasureSearch] = useState("");

	// Form setup with zod validation
	const form = useForm<CreateFormValues>({
		resolver: zodResolver(Inventory.createSchema),
		defaultValues: {
			name: queryName,
			code: queryCode,
			quantity: 0,
			description: "",
			disabled: false,
			maintainStock:
				queryMaintainStock === null ? true : queryMaintainStock === "true",
			allowAlternateItem: false,
			hasVariants: false,
			openingStock: 0,
			valuationRate: undefined,
			standardSellingRate: undefined,
			isZeroRated: false,
			isExempt: false,
			taxCode: "",
			itemGroupId: queryItemGroupId,
			defaultUnitOfMeasureId: queryDefaultUnitOfMeasureId,
			shelfLifeInDays: undefined,
			warrantyPeriodInDays: undefined,
			endOfLife: undefined,
			weightPerUnit: undefined,
			weightUom: "",
			allowNegativeStock: false,
			valuationMethod: "",
			defaultMaterialRequestType: "",
			hasBatchNo: false,
			hasSerialNo: false,
			barcodes: [],
			reorderSettings: [],
			isFixedAsset: queryIsFixedAsset,
		},
	});

	// Watch for form changes - only AFTER initialization
	useEffect(() => {
		if (!isInitialized) return;

		const subscription = form.watch(() => {
			setHasUnsavedChanges(true);
		});
		return () => subscription.unsubscribe();
	}, [form, isInitialized]);

	// Fetch item data for edit mode
	const { data: items, isLoading: isFetchingItem } =
		trpc.inventory.listItems.useQuery(undefined, {
			enabled: isEditMode,
		});

	// Fetch item groups
	const { data: itemGroups = [] } = trpc.inventory.listItemGroups.useQuery(
		{ search: itemGroupSearch },
		{ staleTime: 30000 },
	);

	// Fetch units of measure
	const { data: unitsOfMeasure = [] } =
		trpc.inventory.listUnitsOfMeasure.useQuery(
			{ search: unitOfMeasureSearch },
			{ staleTime: 30000 },
		);

	const item = items?.find((i) => i.id === itemId);

	// Initialization and Pre-fill for Edit Mode
	useEffect(() => {
		if (isEditMode && item) {
			form.reset({
				name: item.name,
				code: item.code,
				quantity: item.quantity,
				description: item.description || "",
				disabled: item.disabled,
				maintainStock: item.maintainStock,
				allowAlternateItem: item.allowAlternateItem,
				hasVariants: item.hasVariants,
				openingStock: item.openingStock,
				valuationRate: item.valuationRate ?? undefined,
				standardSellingRate: item.standardSellingRate ?? undefined,
				isZeroRated: item.isZeroRated,
				isExempt: item.isExempt,
				isFixedAsset: item.isFixedAsset,
				taxCode: item.taxCode || "",
				itemGroupId: item.itemGroupId || undefined,
				defaultUnitOfMeasureId: item.defaultUnitOfMeasureId || undefined,
				shelfLifeInDays: item.shelfLifeInDays ?? undefined,
				warrantyPeriodInDays: item.warrantyPeriodInDays ?? undefined,
				endOfLife: item.endOfLife ? new Date(item.endOfLife) : undefined,
				weightPerUnit: item.weightPerUnit ?? undefined,
				weightUom: item.weightUom || "",
				allowNegativeStock: item.allowNegativeStock,
				valuationMethod: item.valuationMethod || "",
				defaultMaterialRequestType: item.defaultMaterialRequestType || "",
				hasBatchNo: item.hasBatchNo,
				hasSerialNo: item.hasSerialNo,
				barcodes: item.barcodes || [],
				reorderSettings: item.reorderSettings || [],
			});
			setHasUnsavedChanges(false);
			setIsInitialized(true);
		}
	}, [item, isEditMode, form]);

	// tRPC utils for cache management
	const utils = trpc.useUtils();

	// Create mutation
	const createMutation = trpc.inventory.createItem.useMutation({
		onSuccess: async (data) => {
			toast.success("Item created successfully!");
			setHasUnsavedChanges(false);
			await utils.inventory.listItems.invalidate();
			startTransition(() => {
				router.push(`/inventory/items-catalogue/item/${data.id}`);
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	// Update mutation
	const updateMutation = trpc.inventory.updateItem.useMutation({
		onSuccess: async (data) => {
			toast.success("Item updated successfully!");
			setHasUnsavedChanges(false);
			await utils.inventory.listItems.invalidate();
			startTransition(() => {
				router.push(`/inventory/items-catalogue/item/${data.id}`);
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	// Handle form submission
	const onSubmit = (data: CreateFormValues) => {
		// Filter out nulls and ensure consistency with what the router/service expects
		const sanitizedData = {
			...data,
			barcodes: data.barcodes?.map((b) => ({
				barcode: b.barcode,
				barcodeType: b.barcodeType ?? undefined,
				uom: b.uom ?? undefined,
			})),
			reorderSettings: data.reorderSettings?.map((r) => ({
				warehouse: r.warehouse,
				reorderLevel: r.reorderLevel,
				reorderQty: r.reorderQty,
				materialRequestType: r.materialRequestType ?? undefined,
			})),
		};

		if (isEditMode && itemId) {
			updateMutation.mutate({
				id: itemId,
				...sanitizedData,
			});
		} else {
			createMutation.mutate(sanitizedData);
		}
	};

	const isSubmitting =
		createMutation.isPending || updateMutation.isPending || isPending;

	// Get selected item group and unit of measure names for display
	const selectedItemGroup = itemGroups.find(
		(g) => g.id === form.watch("itemGroupId"),
	);
	const selectedUnitOfMeasure = unitsOfMeasure.find(
		(u) => u.id === form.watch("defaultUnitOfMeasureId"),
	);

	// Show loading state while fetching item for edit
	if (isEditMode && isFetchingItem) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
					<p className="mt-4 text-sm text-muted-foreground">Loading item...</p>
				</div>
			</div>
		);
	}

	// Item not found state in edit mode
	if (isEditMode && !isFetchingItem && !item) {
		return (
			<div className="container mx-auto py-6">
				<Card>
					<CardHeader>
						<CardTitle>Item Not Found</CardTitle>
						<CardDescription>
							The inventory item you&apos;re trying to edit doesn&apos;t exist
							or has been deleted.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Link
							href="/inventory/items-catalogue/item"
							className={cn(buttonVariants({ variant: "default" }))}
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Inventory
						</Link>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col bg-[#f8f9fa]">
			{/* Main Content Area */}
			<div className="flex-1 px-8 py-4">
				{/* Header with Actions */}
				<div className="mb-6 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-bold tracking-tight">
							{isEditMode ? item?.name : "New Item"}
						</h1>
						{hasUnsavedChanges && (
							<Badge className="bg-[#fff3e0] text-[#fb8c00] border-none font-medium shadow-none hover:bg-[#fff3e0]">
								Not Saved
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" className="h-8">
							View <ChevronDown className="ml-1.5 h-3 w-3" />
						</Button>
						<Button variant="outline" size="sm" className="h-8">
							Actions <ChevronDown className="ml-1.5 h-3 w-3" />
						</Button>
						<Button variant="outline" size="sm" className="h-8">
							Duplicate
						</Button>
						<Button variant="outline" size="icon" className="h-8 w-8">
							<MoreHorizontal className="h-4 w-4" />
						</Button>
						<Button
							size="sm"
							className="h-8 px-6"
							onClick={form.handleSubmit(onSubmit)}
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Save"
							)}
						</Button>
					</div>
				</div>

				{/* Form Container */}
				<div className="rounded-lg border bg-white shadow-sm overflow-hidden">
					<Tabs defaultValue="details" className="w-full">
						{/* Tab List */}
						<div className="border-b px-4 py-2">
							<TabsList>
								{["Details", "Inventory"].map((tab) => (
									<TabsTrigger key={tab} value={tab.toLowerCase()}>
										{tab}
									</TabsTrigger>
								))}
							</TabsList>
						</div>

						{/* Tab Contents */}
						<TabsContent
							value="details"
							className="m-0 focus-visible:outline-none"
						>
							<div className="grid grid-cols-2 gap-x-12 p-8">
								{/* Left Column */}
								<div className="space-y-6">
									<div className="space-y-1.5">
										<Label className="text-xs font-medium text-gray-500">
											Item Code <span className="text-red-500">*</span>
										</Label>
										<Input
											{...form.register("code")}
											className={cn(
												"h-10",
												form.formState.errors.code && "border-red-500",
											)}
										/>
										{form.formState.errors.code && (
											<p className="text-xs text-red-500">
												{form.formState.errors.code.message}
											</p>
										)}
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs font-medium text-gray-500">
											Item Name <span className="text-red-500">*</span>
										</Label>
										<Input
											{...form.register("name")}
											className={cn(
												"h-10",
												form.formState.errors.name && "border-red-500",
											)}
										/>
										{form.formState.errors.name && (
											<p className="text-xs text-red-500">
												{form.formState.errors.name.message}
											</p>
										)}
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs font-medium text-gray-500">
											Item Group <span className="text-red-500">*</span>
										</Label>
										<Controller
											name="itemGroupId"
											control={form.control}
											render={({ field }) => (
												<Popover
													open={itemGroupOpen}
													onOpenChange={setItemGroupOpen}
												>
													<PopoverTrigger asChild>
														<Button
															variant="outline"
															className="h-10 w-full justify-between font-normal"
														>
															{selectedItemGroup?.groupName || ""}
															<ChevronDown className="h-4 w-4 opacity-50" />
														</Button>
													</PopoverTrigger>
													<PopoverContent
														className="p-0 pointer-events-auto"
														style={{
															width: "var(--radix-popover-trigger-width)",
														}}
													>
														<Command>
															<CommandInput placeholder="Search item groups..." />
															<CommandList>
																<CommandEmpty>No results</CommandEmpty>
																<CommandGroup>
																	{itemGroups.map((g) => (
																		<CommandItem
																			key={g.id}
																			onSelect={() => {
																				field.onChange(g.id);
																				setItemGroupOpen(false);
																			}}
																		>
																			{g.groupName}
																		</CommandItem>
																	))}
																</CommandGroup>
															</CommandList>
														</Command>
													</PopoverContent>
												</Popover>
											)}
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs font-medium text-gray-500">
											Tax Code
										</Label>
										<Input {...form.register("taxCode")} className="h-10" />
									</div>
									<div className="pt-2 space-y-4">
										<div className="flex items-center gap-2">
											<Checkbox
												id="isZeroRated"
												onCheckedChange={(checked) =>
													form.setValue("isZeroRated", !!checked)
												}
												checked={form.watch("isZeroRated")}
											/>
											<Label
												htmlFor="isZeroRated"
												className="text-sm font-normal cursor-pointer"
											>
												Is Zero Rated
											</Label>
										</div>
										<div className="flex items-center gap-3">
											<Checkbox
												id="isExempt"
												onCheckedChange={(checked) =>
													form.setValue("isExempt", !!checked)
												}
												checked={form.watch("isExempt")}
											/>
											<Label
												htmlFor="isExempt"
												className="text-sm font-normal cursor-pointer"
											>
												Is Exempt
											</Label>
										</div>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs font-medium text-gray-500">
											Default Unit of Measure{" "}
											<span className="text-red-500">*</span>
										</Label>
										<Controller
											name="defaultUnitOfMeasureId"
											control={form.control}
											render={({ field }) => (
												<Popover
													open={unitOfMeasureOpen}
													onOpenChange={setUnitOfMeasureOpen}
												>
													<PopoverTrigger asChild>
														<Button
															variant="outline"
															className="h-10 w-full justify-between font-normal"
														>
															{selectedUnitOfMeasure?.name || "Nos"}
															<ChevronDown className="h-4 w-4 opacity-50" />
														</Button>
													</PopoverTrigger>
													<PopoverContent
														className="p-0 pointer-events-auto"
														style={{
															width: "var(--radix-popover-trigger-width)",
														}}
													>
														<Command>
															<CommandInput placeholder="Search units..." />
															<CommandList>
																<CommandEmpty>No results</CommandEmpty>
																<CommandGroup>
																	{unitsOfMeasure.map((u) => (
																		<CommandItem
																			key={u.id}
																			onSelect={() => {
																				field.onChange(u.id);
																				setUnitOfMeasureOpen(false);
																			}}
																		>
																			{u.name}
																		</CommandItem>
																	))}
																</CommandGroup>
															</CommandList>
														</Command>
													</PopoverContent>
												</Popover>
											)}
										/>
									</div>
								</div>

								{/* Right Column */}
								<div className="space-y-6">
									<div className="space-y-4">
										<div className="flex items-center gap-3">
											<Checkbox
												id="disabled"
												onCheckedChange={(checked) =>
													form.setValue("disabled", !!checked)
												}
												checked={form.watch("disabled")}
											/>
											<Label
												htmlFor="disabled"
												className="text-sm font-normal cursor-pointer"
											>
												Disabled
											</Label>
										</div>
										<div className="flex items-center gap-3">
											<Checkbox
												id="allowAlt"
												onCheckedChange={(checked) =>
													form.setValue("allowAlternateItem", !!checked)
												}
												checked={form.watch("allowAlternateItem")}
											/>
											<Label
												htmlFor="allowAlt"
												className="text-sm font-normal cursor-pointer"
											>
												Allow Alternative Item
											</Label>
										</div>
										<div className="flex items-center gap-3">
											<Checkbox
												id="maintainStock"
												onCheckedChange={(checked) =>
													form.setValue("maintainStock", !!checked)
												}
												checked={form.watch("maintainStock")}
											/>
											<Label
												htmlFor="maintainStock"
												className="text-sm font-normal cursor-pointer"
											>
												Maintain Stock
											</Label>
										</div>
										<div className="space-y-1">
											<div className="flex items-center gap-3">
												<Checkbox
													id="hasVariants"
													onCheckedChange={(checked) =>
														form.setValue("hasVariants", !!checked)
													}
													checked={form.watch("hasVariants")}
												/>
												<Label
													htmlFor="hasVariants"
													className="text-sm font-normal cursor-pointer"
												>
													Has Variants
												</Label>
											</div>
											<p className="pl-7.5 text-[11px] text-gray-500 leading-tight">
												If this item has variants, then it cannot be selected in
												sales orders etc.
											</p>
										</div>
									</div>

									<div className="space-y-1.5 pt-2">
										<Label className="text-xs font-medium text-gray-500">
											Opening Stock
										</Label>
										<Input
											type="number"
											{...form.register("openingStock", {
												valueAsNumber: true,
											})}
											className="h-10"
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs font-medium text-gray-500">
											Valuation Rate
										</Label>
										<Input
											type="number"
											{...form.register("valuationRate", {
												valueAsNumber: true,
											})}
											className="h-10"
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs font-medium text-gray-500">
											Standard Selling Rate
										</Label>
										<Input
											type="number"
											{...form.register("standardSellingRate", {
												valueAsNumber: true,
											})}
											className="h-10"
										/>
									</div>
									<div className="flex items-center gap-3 pt-2">
										<Checkbox
											id="isFixedAsset"
											onCheckedChange={(checked) =>
												form.setValue("isFixedAsset", !!checked)
											}
											checked={form.watch("isFixedAsset")}
										/>
										<Label
											htmlFor="isFixedAsset"
											className="text-sm font-normal text-gray-700 cursor-pointer"
										>
											Is Fixed Asset
										</Label>
									</div>
								</div>
							</div>

							{/* Collapsible Sections (ERPNext style) */}
							<div className="border-t">
								<Collapsible
									open={descriptionOpen}
									onOpenChange={setDescriptionOpen}
								>
									<CollapsibleTrigger asChild>
										<div className="flex h-12 cursor-pointer items-center px-8 hover:bg-gray-50">
											<span className="text-sm font-semibold text-gray-900">
												Description
											</span>
											<ChevronDown
												className={cn(
													"ml-1 h-4 w-4 text-gray-400 transition-transform",
													descriptionOpen && "rotate-180",
												)}
											/>
										</div>
									</CollapsibleTrigger>
									<CollapsibleContent className="px-8 pb-8 pt-2">
										<textarea
											className="w-full min-h-[160px] p-4 rounded border bg-[#fcfcfc] outline-none text-sm resize-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
											placeholder="Enter detailed description..."
											value={form.watch("description")}
											onChange={(e) =>
												form.setValue("description", e.target.value)
											}
										/>
									</CollapsibleContent>
								</Collapsible>
							</div>
						</TabsContent>

						<TabsContent
							value="inventory"
							className="m-0 focus-visible:outline-none"
						>
							<div className="p-8 space-y-8">
								{/* Inventory Settings Section */}
								<div>
									<h3 className="text-sm font-semibold mb-6">
										Inventory Settings
									</h3>
									<div className="grid grid-cols-2 gap-x-12 gap-y-6">
										<div className="space-y-1.5">
											<Label className="text-xs font-medium text-gray-500">
												Shelf Life In Days
											</Label>
											<Input
												type="number"
												{...form.register("shelfLifeInDays", {
													valueAsNumber: true,
												})}
												className="h-10"
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs font-medium text-gray-500">
												Warranty Period (in days)
											</Label>
											<Input
												type="number"
												{...form.register("warrantyPeriodInDays", {
													valueAsNumber: true,
												})}
												className="h-10"
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs font-medium text-gray-500">
												End of Life
											</Label>
											<Input
												type="date"
												{...form.register("endOfLife", {
													setValueAs: (v) => (v ? new Date(v) : undefined),
												})}
												className="h-10"
												defaultValue={(() => {
													const endOfLife = form.getValues("endOfLife");
													if (endOfLife instanceof Date) {
														return endOfLife.toISOString().split("T")[0];
													}
													if (
														typeof endOfLife === "string" &&
														endOfLife.length > 0
													) {
														return endOfLife;
													}
													return undefined;
												})()}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs font-medium text-gray-500">
												Weight Per Unit
											</Label>
											<Input
												type="number"
												step="0.01"
												{...form.register("weightPerUnit", {
													valueAsNumber: true,
												})}
												className="h-10"
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs font-medium text-gray-500">
												Default Material Request Type
											</Label>
											<select
												{...form.register("defaultMaterialRequestType")}
												className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
											>
												<option value="Purchase">Purchase</option>
												<option value="Material Transfer">
													Material Transfer
												</option>
												<option value="Material Issue">Material Issue</option>
												<option value="Manufacture">Manufacture</option>
												<option value="Customer Provided">
													Customer Provided
												</option>
											</select>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs font-medium text-gray-500">
												Weight UOM
											</Label>
											<Input {...form.register("weightUom")} className="h-10" />
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs font-medium text-gray-500">
												Valuation Method
											</Label>
											<select
												{...form.register("valuationMethod")}
												className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
											>
												<option value="FIFO">FIFO</option>
												<option value="Moving Average">Moving Average</option>
											</select>
										</div>
										<div className="flex items-center gap-3 pt-6">
											<Checkbox
												id="allowNegativeStock"
												onCheckedChange={(checked) =>
													form.setValue("allowNegativeStock", !!checked)
												}
												checked={form.watch("allowNegativeStock")}
											/>
											<Label
												htmlFor="allowNegativeStock"
												className="text-sm font-normal cursor-pointer"
											>
												Allow Negative Stock
											</Label>
										</div>
									</div>
								</div>

								<div className="border-t pt-8">
									<h3 className="text-sm font-semibold mb-6">Barcodes</h3>
									<div className="space-y-4">
										<Label className="text-xs font-medium text-gray-500">
											Barcodes
										</Label>
										<div className="rounded border overflow-hidden">
											<table className="w-full text-xs text-left">
												<thead className="bg-[#f8f9fa] border-b text-gray-500">
													<tr>
														<th className="px-4 py-2 w-10">
															<Checkbox className="h-3 w-3 rounded" />
														</th>
														<th className="px-4 py-2 w-16">No.</th>
														<th className="px-4 py-2">
															Barcode <span className="text-red-500">*</span>
														</th>
														<th className="px-4 py-2">Barcode Type</th>
														<th className="px-4 py-2">UOM</th>
														<th className="px-4 py-2 w-10">
															<Settings className="h-3 w-3" />
														</th>
													</tr>
												</thead>
												<tbody>
													{form.watch("barcodes")?.length === 0 ? (
														<tr>
															<td
																colSpan={6}
																className="p-12 text-center bg-white"
															>
																<div className="flex flex-col items-center gap-2 opacity-50">
																	<List className="h-6 w-6" />
																	<span className="text-[11px]">No Data</span>
																</div>
															</td>
														</tr>
													) : (
														form.watch("barcodes")?.map((_barcode, index) => (
															<tr
																key={`${_barcode.barcode}-${_barcode.barcodeType}-${_barcode.uom}`}
																className="border-b last:border-0"
															>
																<td className="px-4 py-2">
																	<Checkbox className="h-3 w-3 rounded" />
																</td>
																<td className="px-4 py-2">{index + 1}</td>
																<td className="px-4 py-2">
																	<Input
																		className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0"
																		{...form.register(
																			`barcodes.${index}.barcode`,
																		)}
																	/>
																</td>
																<td className="px-4 py-2">
																	<Input
																		className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0"
																		{...form.register(
																			`barcodes.${index}.barcodeType`,
																		)}
																	/>
																</td>
																<td className="px-4 py-2">
																	<Input
																		className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0"
																		{...form.register(`barcodes.${index}.uom`)}
																	/>
																</td>
																<td className="px-4 py-2">
																	<Button
																		variant="ghost"
																		size="icon"
																		className="h-6 w-6 text-red-500"
																		onClick={() => {
																			const barcodes =
																				form.getValues("barcodes") ?? [];
																			form.setValue(
																				"barcodes",
																				barcodes.filter((_, i) => i !== index),
																			);
																		}}
																	>
																		<Trash2 className="h-3 w-3" />
																	</Button>
																</td>
															</tr>
														))
													)}
												</tbody>
											</table>
										</div>
										<Button
											variant="outline"
											size="sm"
											className="h-8 px-4 text-xs font-medium border-gray-300"
											onClick={() => {
												const barcodes = form.getValues("barcodes") || [];
												form.setValue("barcodes", [
													...barcodes,
													{ barcode: "", barcodeType: "", uom: "" },
												]);
											}}
										>
											Add Row
										</Button>
									</div>
								</div>

								<div className="border-t pt-2">
									<Collapsible defaultOpen={false}>
										<CollapsibleTrigger asChild>
											<div className="flex h-12 cursor-pointer items-center hover:bg-gray-50">
												<span className="text-sm font-semibold text-gray-900">
													Auto re-order
												</span>
												<ChevronDown className="ml-1 h-4 w-4 text-gray-400" />
											</div>
										</CollapsibleTrigger>
										<CollapsibleContent className="pb-8 pt-4 space-y-4">
											<div className="space-y-1">
												<p className="text-[13px] text-gray-600">
													Reorder level based on Warehouse
												</p>
												<p className="text-[11px] text-gray-500">
													Will also apply for variants unless overridden
												</p>
											</div>
											<div className="rounded border overflow-hidden">
												<table className="w-full text-xs text-left">
													<thead className="bg-[#f8f9fa] border-b text-gray-500">
														<tr>
															<th className="px-4 py-2 w-10">
																<Checkbox className="h-3 w-3 rounded" />
															</th>
															<th className="px-4 py-2 w-16">No.</th>
															<th className="px-4 py-2">Check in (group)</th>
															<th className="px-4 py-2">
																Request for{" "}
																<span className="text-red-500">*</span>
															</th>
															<th className="px-4 py-2">Re-order Level</th>
															<th className="px-4 py-2">Re-order Qty</th>
															<th className="px-4 py-2">
																Material Request Type{" "}
																<span className="text-red-500">*</span>
															</th>
															<th className="px-4 py-2 w-10">
																<Settings className="h-3 w-3" />
															</th>
														</tr>
													</thead>
													<tbody>
														{form.watch("reorderSettings")?.length === 0 ? (
															<tr>
																<td
																	colSpan={8}
																	className="p-12 text-center bg-white"
																>
																	<div className="flex flex-col items-center gap-2 opacity-50">
																		<List className="h-6 w-6" />
																		<span className="text-[11px]">No Data</span>
																	</div>
																</td>
															</tr>
														) : (
															form
																.watch("reorderSettings")
																?.map((_setting, index) => (
																	<tr
																		key={`${_setting.warehouse}-${_setting.reorderLevel}-${_setting.reorderQty}-${_setting.materialRequestType}`}
																		className="border-b last:border-0"
																	>
																		<td className="px-4 py-2">
																			<Checkbox className="h-3 w-3 rounded" />
																		</td>
																		<td className="px-4 py-2">{index + 1}</td>
																		<td className="px-4 py-2"></td>{" "}
																		{/* Group check placeholder */}
																		<td className="px-4 py-2">
																			<Input
																				className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0"
																				{...form.register(
																					`reorderSettings.${index}.warehouse`,
																				)}
																				placeholder="Warehouse"
																			/>
																		</td>
																		<td className="px-4 py-2">
																			<Input
																				type="number"
																				className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0"
																				{...form.register(
																					`reorderSettings.${index}.reorderLevel`,
																					{
																						valueAsNumber: true,
																					},
																				)}
																			/>
																		</td>
																		<td className="px-4 py-2">
																			<Input
																				type="number"
																				className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0"
																				{...form.register(
																					`reorderSettings.${index}.reorderQty`,
																					{ valueAsNumber: true },
																				)}
																			/>
																		</td>
																		<td className="px-4 py-2">
																			<Input
																				className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 p-0"
																				{...form.register(
																					`reorderSettings.${index}.materialRequestType`,
																				)}
																			/>
																		</td>
																		<td className="px-4 py-2">
																			<Button
																				variant="ghost"
																				size="icon"
																				className="h-6 w-6 text-red-500"
																				onClick={() => {
																					const settings =
																						form.getValues("reorderSettings") ??
																						[];
																					form.setValue(
																						"reorderSettings",
																						settings.filter(
																							(_, i) => i !== index,
																						),
																					);
																				}}
																			>
																				<Trash2 className="h-3 w-3" />
																			</Button>
																		</td>
																	</tr>
																))
														)}
													</tbody>
												</table>
											</div>
											<Button
												variant="outline"
												size="sm"
												className="h-8 px-4 text-xs font-medium border-gray-300"
												onClick={() => {
													const settings =
														form.getValues("reorderSettings") || [];
													form.setValue("reorderSettings", [
														...settings,
														{
															warehouse: "",
															reorderLevel: 0,
															reorderQty: 0,
															materialRequestType: "Purchase",
														},
													]);
												}}
											>
												Add Row
											</Button>
										</CollapsibleContent>
									</Collapsible>
								</div>

								<div className="border-t pt-2">
									<Collapsible defaultOpen={false}>
										<CollapsibleTrigger asChild>
											<div className="flex h-12 cursor-pointer items-center hover:bg-gray-50">
												<span className="text-sm font-semibold text-gray-900">
													Serial Nos and Batches
												</span>
												<ChevronDown className="ml-1 h-4 w-4 text-gray-400" />
											</div>
										</CollapsibleTrigger>
										<CollapsibleContent className="pb-8 pt-4">
											<div className="grid grid-cols-2 gap-12">
												<div className="flex items-center gap-3">
													<Checkbox
														id="hasBatchNo"
														onCheckedChange={(checked) =>
															form.setValue("hasBatchNo", !!checked)
														}
														checked={form.watch("hasBatchNo")}
													/>
													<Label
														htmlFor="hasBatchNo"
														className="text-sm font-normal cursor-pointer"
													>
														Has Batch No
													</Label>
												</div>
												<div className="flex items-center gap-3">
													<Checkbox
														id="hasSerialNo"
														onCheckedChange={(checked) =>
															form.setValue("hasSerialNo", !!checked)
														}
														checked={form.watch("hasSerialNo")}
													/>
													<Label
														htmlFor="hasSerialNo"
														className="text-sm font-normal cursor-pointer"
													>
														Has Serial No
													</Label>
												</div>
											</div>
										</CollapsibleContent>
									</Collapsible>
								</div>
							</div>
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	);
}

function ItemFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
