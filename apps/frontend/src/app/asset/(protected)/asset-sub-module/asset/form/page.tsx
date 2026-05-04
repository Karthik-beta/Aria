/**
 * Asset Form Page — create and edit assets
 * Reads ?id= param to switch between create/edit modes.
 *
 * When "Calculate Depreciation" is enabled, depreciation detail fields appear
 * in the Options section, mirroring ERPNext behavior:
 * - Depreciation Method, Total Number of Depreciations, Frequency (months),
 *   Expected Value After Useful Life, and Depreciation Start Date become visible.
 * - When an Asset Category is selected, depreciation defaults from the category
 *   are auto-populated into the form fields.
 */

"use client";

import { Asset } from "@aria/types";
import { ChevronDown, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { DEPRECIATION_METHOD_OPTIONS } from "../../asset-category/asset-category.schema";

type AssetFormValues = {
	assetName: string;
	company: string;
	itemCode: string;
	assetCategoryId: string;
	locationId: string;
	custodian: string;
	department: string;
	assetQuantity: number;
	calculateDepreciation: boolean;
	isFullyDepreciated: boolean;
	maintenanceRequired: boolean;
	assetOwner: string;
	status: string;
	netPurchaseAmount: string;
	purchaseDate: string;
	availableForUseDate: string;
	depreciationMethod: string;
	totalNumberOfDepreciations: string;
	frequencyOfDepreciation: string;
	expectedValueAfterUsefulLife: string;
	depreciationStartDate: string;
};

const defaultValues: AssetFormValues = {
	assetName: "",
	company: "",
	itemCode: "",
	assetCategoryId: "",
	locationId: "",
	custodian: "",
	department: "",
	assetQuantity: 1,
	calculateDepreciation: false,
	isFullyDepreciated: false,
	maintenanceRequired: false,
	assetOwner: "COMPANY",
	status: "DRAFT",
	netPurchaseAmount: "",
	purchaseDate: "",
	availableForUseDate: "",
	depreciationMethod: "",
	totalNumberOfDepreciations: "",
	frequencyOfDepreciation: "",
	expectedValueAfterUsefulLife: "",
	depreciationStartDate: "",
};

export default function AssetFormPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const assetId = searchParams.get("id");
	const isEdit = Boolean(assetId);
	const utils = trpc.useUtils();
	const [_isPending, startTransition] = React.useTransition();
	const [categoryOpen, setCategoryOpen] = React.useState(false);
	const [locationOpen, setLocationOpen] = React.useState(false);

	const { data: categoriesData } = trpc.asset.listAssetCategories.useQuery(
		undefined,
		{ staleTime: 30_000 },
	);
	const categories = categoriesData?.items ?? [];
	const { data: locationsData } = trpc.asset.listLocations.useQuery(undefined, {
		staleTime: 30_000,
	});
	const locations = locationsData?.items ?? [];

	const { data: rawAsset, isLoading: isLoadingAsset } =
		trpc.asset.getAssetById.useQuery(
			{ id: assetId ?? "" },
			{ enabled: isEdit && Boolean(assetId) },
		);

	const form = useForm<AssetFormValues>({ defaultValues });

	const watchedCalculateDepreciation = useWatch({
		control: form.control,
		name: "calculateDepreciation",
	});

	const watchedAssetCategoryId = useWatch({
		control: form.control,
		name: "assetCategoryId",
	});

	const selectedCategory = categories.find(
		(c) => c.id === watchedAssetCategoryId,
	);

	React.useEffect(() => {
		if (!rawAsset) return;
		form.reset({
			assetName: rawAsset.assetName,
			company: rawAsset.company,
			itemCode: rawAsset.itemCode ?? "",
			assetCategoryId: rawAsset.assetCategoryId ?? "",
			locationId: rawAsset.locationId ?? "",
			custodian: rawAsset.custodian ?? "",
			department: rawAsset.department ?? "",
			assetQuantity: rawAsset.assetQuantity,
			calculateDepreciation: rawAsset.calculateDepreciation,
			isFullyDepreciated: rawAsset.isFullyDepreciated,
			maintenanceRequired: rawAsset.maintenanceRequired,
			assetOwner: rawAsset.assetOwner,
			status: rawAsset.status,
			netPurchaseAmount:
				rawAsset.netPurchaseAmount != null
					? String(rawAsset.netPurchaseAmount)
					: "",
			purchaseDate: rawAsset.purchaseDate
				? (new Date(rawAsset.purchaseDate).toISOString().split("T")[0] ?? "")
				: "",
			availableForUseDate: rawAsset.availableForUseDate
				? (new Date(rawAsset.availableForUseDate).toISOString().split("T")[0] ??
					"")
				: "",
			depreciationMethod: rawAsset.depreciationMethod ?? "",
			totalNumberOfDepreciations:
				rawAsset.totalNumberOfDepreciations != null
					? String(rawAsset.totalNumberOfDepreciations)
					: "",
			frequencyOfDepreciation:
				rawAsset.frequencyOfDepreciation != null
					? String(rawAsset.frequencyOfDepreciation)
					: "",
			expectedValueAfterUsefulLife:
				rawAsset.expectedValueAfterUsefulLife != null
					? String(rawAsset.expectedValueAfterUsefulLife)
					: "",
			depreciationStartDate: "",
		});
	}, [rawAsset, form]);

	React.useEffect(() => {
		if (selectedCategory && !isEdit) {
			if (selectedCategory.depreciationMethod) {
				form.setValue(
					"depreciationMethod",
					selectedCategory.depreciationMethod,
					{
						shouldDirty: true,
					},
				);
			}
			if (selectedCategory.totalNumberOfDepreciations != null) {
				form.setValue(
					"totalNumberOfDepreciations",
					String(selectedCategory.totalNumberOfDepreciations),
					{ shouldDirty: true },
				);
			}
			if (selectedCategory.frequencyOfDepreciation != null) {
				form.setValue(
					"frequencyOfDepreciation",
					String(selectedCategory.frequencyOfDepreciation),
					{ shouldDirty: true },
				);
			}
			if (selectedCategory.expectedValueAfterUsefulLife != null) {
				form.setValue(
					"expectedValueAfterUsefulLife",
					String(selectedCategory.expectedValueAfterUsefulLife),
					{ shouldDirty: true },
				);
			}
		}
	}, [selectedCategory, isEdit, form]);

	const createMutation = trpc.asset.createAsset.useMutation({
		onSuccess: (newAsset) => {
			void utils.asset.listAssets.invalidate();
			toast.success(`Asset "${newAsset.assetName}" created`);
			startTransition(() =>
				router.push(`/asset/asset-sub-module/asset/${newAsset.id}`),
			);
		},
		onError: (error) => toast.error(getToastMessage(error, "create")),
	});

	const updateMutation = trpc.asset.updateAsset.useMutation({
		onSuccess: (updated) => {
			void utils.asset.listAssets.invalidate();
			toast.success("Asset updated");
			startTransition(() =>
				router.push(`/asset/asset-sub-module/asset/${updated.id}`),
			);
		},
		onError: (error) => toast.error(getToastMessage(error, "update")),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const onSubmit = form.handleSubmit((values) => {
		const common = {
			assetName: values.assetName.trim(),
			company: values.company.trim(),
			itemCode: values.itemCode.trim() || null,
			assetCategoryId: values.assetCategoryId || null,
			locationId: values.locationId || null,
			custodian: values.custodian.trim() || null,
			department: values.department.trim() || null,
			assetQuantity: values.assetQuantity,
			calculateDepreciation: values.calculateDepreciation,
			isFullyDepreciated: values.isFullyDepreciated,
			maintenanceRequired: values.maintenanceRequired,
			assetOwner: values.assetOwner as ReturnType<
				typeof Asset.assetOwnerSchema.parse
			>,
			netPurchaseAmount: values.netPurchaseAmount
				? Number(values.netPurchaseAmount)
				: null,
			purchaseDate: values.purchaseDate ? new Date(values.purchaseDate) : null,
			availableForUseDate: values.availableForUseDate
				? new Date(values.availableForUseDate)
				: null,
			depreciationMethod: values.depreciationMethod || null,
			totalNumberOfDepreciations: values.totalNumberOfDepreciations
				? parseInt(values.totalNumberOfDepreciations, 10)
				: null,
			frequencyOfDepreciation: values.frequencyOfDepreciation
				? parseInt(values.frequencyOfDepreciation, 10)
				: null,
			expectedValueAfterUsefulLife: values.expectedValueAfterUsefulLife
				? Number(values.expectedValueAfterUsefulLife)
				: null,
		};

		if (isEdit && assetId) {
			const parsed = Asset.updateAssetSchema.safeParse({
				id: assetId,
				...common,
				status: values.status as ReturnType<
					typeof Asset.assetStatusSchema.parse
				>,
			});
			if (!parsed.success) {
				toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
				return;
			}
			updateMutation.mutate(parsed.data);
		} else {
			const parsed = Asset.createAssetSchema.safeParse({
				...common,
				status: values.status as ReturnType<
					typeof Asset.assetStatusSchema.parse
				>,
			});
			if (!parsed.success) {
				toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
				return;
			}
			createMutation.mutate(parsed.data);
		}
	});

	const selectedLocation = locations.find(
		(l) => l.id === form.watch("locationId"),
	);

	if (isEdit && isLoadingAsset) {
		return (
			<div className="container mx-auto py-6">
				<p className="text-sm text-muted-foreground">Loading asset…</p>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-3xl py-6 space-y-6">
			<h1 className="text-2xl font-bold">
				{isEdit ? "Edit Asset" : "New Asset"}
			</h1>

			<form onSubmit={onSubmit} className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Basic Information</CardTitle>
						<CardDescription>
							Core identity and classification of the asset
						</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{/* Asset Name */}
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="assetName">
								Asset Name <span className="text-destructive">*</span>
							</Label>
							<Input
								id="assetName"
								placeholder="e.g. Dell Laptop 2024"
								{...form.register("assetName")}
							/>
						</div>

						{/* Company */}
						<div className="space-y-2">
							<Label htmlFor="company">
								Company <span className="text-destructive">*</span>
							</Label>
							<Input
								id="company"
								placeholder="e.g. My Company Ltd."
								{...form.register("company")}
							/>
						</div>

						{/* Item Code */}
						<div className="space-y-2">
							<Label htmlFor="itemCode">Item Code</Label>
							<Input
								id="itemCode"
								placeholder="e.g. ITEM-001"
								{...form.register("itemCode")}
							/>
						</div>

						{/* Asset Category */}
						<div className="space-y-2">
							<Label>Asset Category</Label>
							<Controller
								name="assetCategoryId"
								control={form.control}
								render={({ field }) => (
									<Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
										<PopoverTrigger asChild>
											<Button
												type="button"
												variant="outline"
												className="h-10 w-full justify-between font-normal"
											>
												<span className="truncate">
													{selectedCategory?.name ?? "Select category…"}
												</span>
												<ChevronDown className="h-4 w-4 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverContent
											className="p-0 pointer-events-auto"
											style={{ width: "var(--radix-popover-trigger-width)" }}
										>
											<Command>
												<CommandInput placeholder="Search categories…" />
												<CommandList>
													<CommandEmpty>No categories found</CommandEmpty>
													<CommandGroup>
														{categories.map((cat) => (
															<CommandItem
																key={cat.id}
																onSelect={() => {
																	field.onChange(cat.id);
																	setCategoryOpen(false);
																}}
															>
																{cat.name}
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

						{/* Location */}
						<div className="space-y-2">
							<Label>Location</Label>
							<Controller
								name="locationId"
								control={form.control}
								render={({ field }) => (
									<Popover open={locationOpen} onOpenChange={setLocationOpen}>
										<PopoverTrigger asChild>
											<Button
												type="button"
												variant="outline"
												className="h-10 w-full justify-between font-normal"
											>
												<span className="truncate">
													{selectedLocation?.name ?? "Select location…"}
												</span>
												<ChevronDown className="h-4 w-4 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverContent
											className="p-0 pointer-events-auto"
											style={{ width: "var(--radix-popover-trigger-width)" }}
										>
											<Command>
												<CommandInput placeholder="Search locations…" />
												<CommandList>
													<CommandEmpty>No locations found</CommandEmpty>
													<CommandGroup>
														{locations.map((loc) => (
															<CommandItem
																key={loc.id}
																onSelect={() => {
																	field.onChange(loc.id);
																	setLocationOpen(false);
																}}
															>
																{loc.name}
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

						{/* Custodian */}
						<div className="space-y-2">
							<Label htmlFor="custodian">Custodian</Label>
							<Input
								id="custodian"
								placeholder="Person responsible"
								{...form.register("custodian")}
							/>
						</div>

						{/* Department */}
						<div className="space-y-2">
							<Label htmlFor="department">Department</Label>
							<Input
								id="department"
								placeholder="e.g. Engineering"
								{...form.register("department")}
							/>
						</div>

						{/* Quantity */}
						<div className="space-y-2">
							<Label htmlFor="assetQuantity">Quantity</Label>
							<Input
								id="assetQuantity"
								type="number"
								min={1}
								{...form.register("assetQuantity", { valueAsNumber: true })}
							/>
						</div>

						{/* Status */}
						<div className="space-y-2">
							<Label>Status</Label>
							<Controller
								name="status"
								control={form.control}
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="h-10">
											<SelectValue placeholder="Select status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="DRAFT">Draft</SelectItem>
											<SelectItem value="SUBMITTED">Submitted</SelectItem>
											<SelectItem value="IN_MAINTENANCE">
												In Maintenance
											</SelectItem>
											<SelectItem value="OUT_OF_ORDER">Out of Order</SelectItem>
											<SelectItem value="SOLD">Sold</SelectItem>
											<SelectItem value="SCRAPPED">Scrapped</SelectItem>
											<SelectItem value="CANCELLED">Cancelled</SelectItem>
										</SelectContent>
									</Select>
								)}
							/>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Purchase & Valuation</CardTitle>
					</CardHeader>
					<CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="purchaseDate">Purchase Date</Label>
							<Input
								id="purchaseDate"
								type="date"
								{...form.register("purchaseDate")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="availableForUseDate">Available For Use</Label>
							<Input
								id="availableForUseDate"
								type="date"
								{...form.register("availableForUseDate")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="netPurchaseAmount">Net Purchase Amount</Label>
							<Input
								id="netPurchaseAmount"
								type="number"
								min={0}
								step="0.01"
								placeholder="0.00"
								{...form.register("netPurchaseAmount")}
							/>
						</div>

						<div className="space-y-2">
							<Label>Asset Owner</Label>
							<Controller
								name="assetOwner"
								control={form.control}
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="h-10">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="COMPANY">Company</SelectItem>
											<SelectItem value="SUPPLIER">Supplier</SelectItem>
											<SelectItem value="CUSTOMER">Customer</SelectItem>
										</SelectContent>
									</Select>
								)}
							/>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Options</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center gap-2">
							<Controller
								name="calculateDepreciation"
								control={form.control}
								render={({ field }) => (
									<Checkbox
										id="calculateDepreciation"
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								)}
							/>
							<Label htmlFor="calculateDepreciation" className="cursor-pointer">
								Calculate Depreciation
							</Label>
						</div>

						{watchedCalculateDepreciation && (
							<div className="mt-4 space-y-4 rounded-md border bg-muted/30 p-4">
								<h3 className="text-sm font-medium">Depreciation Details</h3>

								<div className="grid gap-4 sm:grid-cols-2">
									{/* Depreciation Method */}
									<div className="space-y-2">
										<Label htmlFor="depreciationMethod">
											Depreciation Method
										</Label>
										<Controller
											name="depreciationMethod"
											control={form.control}
											render={({ field }) => (
												<Select
													value={field.value}
													onValueChange={field.onChange}
												>
													<SelectTrigger
														className="h-10"
														id="depreciationMethod"
													>
														<SelectValue placeholder="Select method" />
													</SelectTrigger>
													<SelectContent>
														{DEPRECIATION_METHOD_OPTIONS.map((opt) => (
															<SelectItem key={opt.value} value={opt.value}>
																{opt.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											)}
										/>
									</div>

									{/* Total Number of Depreciations */}
									<div className="space-y-2">
										<Label htmlFor="totalNumberOfDepreciations">
											Total Number of Depreciations
										</Label>
										<Input
											id="totalNumberOfDepreciations"
											type="number"
											min={1}
											step={1}
											placeholder="e.g. 60"
											{...form.register("totalNumberOfDepreciations")}
										/>
									</div>

									{/* Frequency of Depreciation */}
									<div className="space-y-2">
										<Label htmlFor="frequencyOfDepreciation">
											Frequency of Depreciation (Months)
										</Label>
										<Input
											id="frequencyOfDepreciation"
											type="number"
											min={1}
											step={1}
											placeholder="e.g. 12"
											{...form.register("frequencyOfDepreciation")}
										/>
									</div>

									{/* Expected Value After Useful Life */}
									<div className="space-y-2">
										<Label htmlFor="expectedValueAfterUsefulLife">
											Expected Value After Useful Life
										</Label>
										<Input
											id="expectedValueAfterUsefulLife"
											type="number"
											min={0}
											step="0.01"
											placeholder="e.g. 1000"
											{...form.register("expectedValueAfterUsefulLife")}
										/>
									</div>

									{/* Depreciation Start Date */}
									<div className="space-y-2">
										<Label htmlFor="depreciationStartDate">
											Depreciation Start Date
										</Label>
										<Input
											id="depreciationStartDate"
											type="date"
											{...form.register("depreciationStartDate")}
										/>
									</div>
								</div>
							</div>
						)}

						<div className="flex items-center gap-2">
							<Controller
								name="isFullyDepreciated"
								control={form.control}
								render={({ field }) => (
									<Checkbox
										id="isFullyDepreciated"
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								)}
							/>
							<Label htmlFor="isFullyDepreciated" className="cursor-pointer">
								Fully Depreciated
							</Label>
						</div>
						<div className="flex items-center gap-2">
							<Controller
								name="maintenanceRequired"
								control={form.control}
								render={({ field }) => (
									<Checkbox
										id="maintenanceRequired"
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								)}
							/>
							<Label htmlFor="maintenanceRequired" className="cursor-pointer">
								Maintenance Required
							</Label>
						</div>
					</CardContent>
				</Card>

				<div className="flex justify-end gap-3">
					<Button type="button" variant="outline" onClick={() => router.back()}>
						Cancel
					</Button>
					<Button type="submit" disabled={isPending}>
						{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{isEdit ? "Update Asset" : "Create Asset"}
					</Button>
				</div>
			</form>
		</div>
	);
}
