"use client";

import { Asset } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	ArrowLeft,
	ChevronDown,
	CircleAlert,
	Loader2,
	Scan,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Suspense } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { BarcodeScannerDialog } from "@/components/barcode-scanner-dialog";
import { Badge } from "@/components/ui/badge";
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

function getLastDayOfMonth(date: Date): Date {
	const d = new Date(date);
	d.setMonth(d.getMonth() + 1, 0);
	d.setHours(0, 0, 0, 0);
	return d;
}

const assetFormSchema = z
	.object({
		assetName: z.string().min(1, "Asset name is required").max(255),
		company: z.string().min(1, "Company is required").max(255),
		itemCode: z.string().max(100).optional().nullable(),
		barcode: z.string().max(255).optional().nullable(),
		assetCategoryId: z.string().optional().nullable(),
		locationId: z.string().optional().nullable(),
		custodian: z.string().max(255).optional().nullable(),
		department: z.string().max(255).optional().nullable(),
		assetQuantity: z.number().int().min(1),
		calculateDepreciation: z.boolean(),
		isFullyDepreciated: z.boolean(),
		maintenanceRequired: z.boolean(),
		status: z.string(),
		netPurchaseAmount: z.string().optional().nullable(),
		purchaseDate: z.string().optional().nullable(),
		availableForUseDate: z.string().optional().nullable(),
		purchaseReceipt: z.string().max(255).optional().nullable(),
		purchaseInvoice: z.string().max(255).optional().nullable(),
		policyNumber: z.string().max(255).optional().nullable(),
		insurer: z.string().max(255).optional().nullable(),
		insuredValue: z.string().optional().nullable(),
		insuranceStartDate: z.string().optional().nullable(),
		insuranceEndDate: z.string().optional().nullable(),
		assetOwner: z.string(),
		assetOwnerCompany: z.string().max(255).optional().nullable(),
		supplier: z.string().max(255).optional().nullable(),
		customer: z.string().max(255).optional().nullable(),
		depreciationMethod: z.string().optional().nullable(),
		totalNumberOfDepreciations: z.string().optional().nullable(),
		frequencyOfDepreciation: z.string().optional().nullable(),
		expectedValueAfterUsefulLife: z.string().optional().nullable(),
		depreciationStartDate: z.string().optional().nullable(),
		openingAccumulatedDepreciation: z.string().optional().nullable(),
		openingNumberOfBookedDepreciations: z.string().optional().nullable(),
	})
	.superRefine((data, ctx) => {
		if (!data.calculateDepreciation) return;

		if (!data.depreciationMethod) {
			ctx.addIssue({
				path: ["depreciationMethod"],
				code: z.ZodIssueCode.custom,
				message: "Depreciation method is required",
			});
		}

		const totalDep = data.totalNumberOfDepreciations
			? Number(data.totalNumberOfDepreciations)
			: NaN;
		if (
			data.totalNumberOfDepreciations &&
			(Number.isNaN(totalDep) || totalDep < 1)
		) {
			ctx.addIssue({
				path: ["totalNumberOfDepreciations"],
				code: z.ZodIssueCode.custom,
				message: "Total depreciations must be at least 1",
			});
		}

		const freq = data.frequencyOfDepreciation
			? Number(data.frequencyOfDepreciation)
			: NaN;
		if (data.frequencyOfDepreciation && (Number.isNaN(freq) || freq < 1)) {
			ctx.addIssue({
				path: ["frequencyOfDepreciation"],
				code: z.ZodIssueCode.custom,
				message: "Frequency must be at least 1",
			});
		}

		const expected = data.expectedValueAfterUsefulLife
			? Number(data.expectedValueAfterUsefulLife)
			: NaN;
		const netPurchase = data.netPurchaseAmount
			? Number(data.netPurchaseAmount)
			: NaN;
		if (
			!Number.isNaN(expected) &&
			!Number.isNaN(netPurchase) &&
			expected >= netPurchase
		) {
			ctx.addIssue({
				path: ["expectedValueAfterUsefulLife"],
				code: z.ZodIssueCode.custom,
				message: "Must be less than net purchase amount",
			});
		}

		if (data.depreciationStartDate && data.purchaseDate) {
			const depStart = new Date(data.depreciationStartDate);
			const purchase = new Date(data.purchaseDate);
			if (depStart < purchase) {
				ctx.addIssue({
					path: ["depreciationStartDate"],
					code: z.ZodIssueCode.custom,
					message: "Must be on or after purchase date",
				});
			}
		}

		if (data.depreciationStartDate && data.availableForUseDate) {
			const depStart = new Date(data.depreciationStartDate);
			const available = new Date(data.availableForUseDate);
			if (depStart < available) {
				ctx.addIssue({
					path: ["depreciationStartDate"],
					code: z.ZodIssueCode.custom,
					message: "Must be on or after available for use date",
				});
			}
		}

		const openingAccum = data.openingAccumulatedDepreciation
			? Number(data.openingAccumulatedDepreciation)
			: NaN;
		if (
			!Number.isNaN(openingAccum) &&
			!Number.isNaN(netPurchase) &&
			!Number.isNaN(expected)
		) {
			if (openingAccum > netPurchase - expected) {
				ctx.addIssue({
					path: ["openingAccumulatedDepreciation"],
					code: z.ZodIssueCode.custom,
					message: "Cannot exceed net purchase minus expected salvage value",
				});
			}
		}

		if (
			data.openingAccumulatedDepreciation &&
			Number(data.openingAccumulatedDepreciation) > 0 &&
			!data.openingNumberOfBookedDepreciations
		) {
			ctx.addIssue({
				path: ["openingNumberOfBookedDepreciations"],
				code: z.ZodIssueCode.custom,
				message: "Required when opening accumulated depreciation is set",
			});
		}

		const openingBooked = data.openingNumberOfBookedDepreciations
			? Number(data.openingNumberOfBookedDepreciations)
			: NaN;
		if (
			!Number.isNaN(totalDep) &&
			!Number.isNaN(openingBooked) &&
			totalDep <= openingBooked
		) {
			ctx.addIssue({
				path: ["openingNumberOfBookedDepreciations"],
				code: z.ZodIssueCode.custom,
				message: "Total depreciations must exceed opening booked depreciations",
			});
		}
	});

type AssetFormValues = z.input<typeof assetFormSchema>;

const defaultFormValues: AssetFormValues = {
	assetName: "",
	company: "",
	itemCode: "",
	barcode: "",
	assetCategoryId: "",
	locationId: "",
	custodian: "",
	department: "",
	assetQuantity: 1,
	calculateDepreciation: false,
	isFullyDepreciated: false,
	maintenanceRequired: false,
	status: "DRAFT",
	netPurchaseAmount: "",
	purchaseDate: "",
	availableForUseDate: "",
	purchaseReceipt: "",
	purchaseInvoice: "",
	policyNumber: "",
	insurer: "",
	insuredValue: "",
	insuranceStartDate: "",
	insuranceEndDate: "",
	assetOwner: "COMPANY",
	assetOwnerCompany: "",
	supplier: "",
	customer: "",
	depreciationMethod: "",
	totalNumberOfDepreciations: "",
	frequencyOfDepreciation: "",
	expectedValueAfterUsefulLife: "",
	depreciationStartDate: "",
	openingAccumulatedDepreciation: "",
	openingNumberOfBookedDepreciations: "",
};

export default function AssetFormPage() {
	return (
		<Suspense
			fallback={
				<div className="flex h-[60vh] items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			}
		>
			<AssetFormContent />
		</Suspense>
	);
}

function AssetFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const assetId = searchParams.get("id");
	const isEdit = Boolean(assetId);
	const utils = trpc.useUtils();
	const [_isPending, startTransition] = React.useTransition();
	const [categoryOpen, setCategoryOpen] = React.useState(false);
	const [locationOpen, setLocationOpen] = React.useState(false);
	const [scannerOpen, setScannerOpen] = React.useState(false);
	const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
	const [initialized, setInitialized] = React.useState(false);

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

	const urlDefaults = React.useMemo((): Partial<AssetFormValues> => {
		if (isEdit) return {};
		const defaults: Partial<AssetFormValues> = {};
		const assetName = searchParams.get("assetName");
		const company = searchParams.get("company");
		const assetCategoryId = searchParams.get("assetCategoryId");
		const locationId = searchParams.get("locationId");
		if (assetName) defaults.assetName = assetName;
		if (company) defaults.company = company;
		if (assetCategoryId) defaults.assetCategoryId = assetCategoryId;
		if (locationId) defaults.locationId = locationId;
		return defaults;
	}, [isEdit, searchParams]);

	const form = useForm<AssetFormValues>({
		resolver: zodResolver(assetFormSchema),
		defaultValues: { ...defaultFormValues, ...urlDefaults },
	});

	React.useEffect(() => {
		if (!isEdit) {
			setInitialized(true);
		}
	}, [isEdit]);

	React.useEffect(() => {
		if (!rawAsset) return;
		form.reset({
			assetName: rawAsset.assetName,
			company: rawAsset.company,
			itemCode: rawAsset.itemCode ?? "",
			barcode: rawAsset.barcode ?? "",
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
			purchaseReceipt: rawAsset.purchaseReceipt ?? "",
			purchaseInvoice: rawAsset.purchaseInvoice ?? "",
			policyNumber: rawAsset.policyNumber ?? "",
			insurer: rawAsset.insurer ?? "",
			insuredValue:
				rawAsset.insuredValue != null ? String(rawAsset.insuredValue) : "",
			insuranceStartDate: rawAsset.insuranceStartDate
				? (new Date(rawAsset.insuranceStartDate).toISOString().split("T")[0] ??
					"")
				: "",
			insuranceEndDate: rawAsset.insuranceEndDate
				? (new Date(rawAsset.insuranceEndDate).toISOString().split("T")[0] ??
					"")
				: "",
			assetOwnerCompany: rawAsset.assetOwnerCompany ?? "",
			supplier: rawAsset.supplier ?? "",
			customer: rawAsset.customer ?? "",
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
			depreciationStartDate: rawAsset.depreciationStartDate
				? (new Date(rawAsset.depreciationStartDate)
						.toISOString()
						.split("T")[0] ?? "")
				: "",
			openingAccumulatedDepreciation:
				rawAsset.openingAccumulatedDepreciation != null
					? String(rawAsset.openingAccumulatedDepreciation)
					: "",
			openingNumberOfBookedDepreciations:
				rawAsset.openingNumberOfBookedDepreciations != null
					? String(rawAsset.openingNumberOfBookedDepreciations)
					: "",
		});
		setInitialized(true);
	}, [rawAsset, form]);

	const watchedCalculateDepreciation = useWatch({
		control: form.control,
		name: "calculateDepreciation",
	});

	const watchedAssetCategoryId = useWatch({
		control: form.control,
		name: "assetCategoryId",
	});

	const watchedAvailableForUseDate = useWatch({
		control: form.control,
		name: "availableForUseDate",
	});

	const watchedAssetOwner = useWatch({
		control: form.control,
		name: "assetOwner",
	});

	const selectedCategory = categories.find(
		(c) => c.id === watchedAssetCategoryId,
	);

	React.useEffect(() => {
		if (selectedCategory) {
			if (selectedCategory.depreciationMethod) {
				form.setValue(
					"depreciationMethod",
					selectedCategory.depreciationMethod,
					{ shouldDirty: true },
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
	}, [selectedCategory, form]);

	React.useEffect(() => {
		if (watchedCalculateDepreciation && watchedAvailableForUseDate) {
			const lastDay = getLastDayOfMonth(new Date(watchedAvailableForUseDate));
			const formatted = lastDay.toISOString().split("T")[0];
			if (formatted) {
				form.setValue("depreciationStartDate", formatted, {
					shouldDirty: true,
				});
			}
		}
	}, [watchedCalculateDepreciation, watchedAvailableForUseDate, form]);

	React.useEffect(() => {
		if (!initialized) return;
		const subscription = form.watch(() => {
			setHasUnsavedChanges(true);
		});
		return () => subscription.unsubscribe();
	}, [form, initialized]);

	const createMutation = trpc.asset.createAsset.useMutation({
		onSuccess: (newAsset) => {
			setHasUnsavedChanges(false);
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
			setHasUnsavedChanges(false);
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
			itemCode: values.itemCode?.trim() || null,
			barcode: values.barcode?.trim() || null,
			assetCategoryId: values.assetCategoryId || null,
			locationId: values.locationId || null,
			custodian: values.custodian?.trim() || null,
			department: values.department?.trim() || null,
			assetQuantity: values.assetQuantity,
			calculateDepreciation: values.calculateDepreciation,
			isFullyDepreciated: values.isFullyDepreciated,
			maintenanceRequired: values.maintenanceRequired,
			assetOwner: values.assetOwner as Asset.AssetOwner,
			assetOwnerCompany:
				values.assetOwner === "COMPANY"
					? values.assetOwnerCompany?.trim() || null
					: null,
			supplier:
				values.assetOwner === "SUPPLIER"
					? values.supplier?.trim() || null
					: null,
			customer:
				values.assetOwner === "CUSTOMER"
					? values.customer?.trim() || null
					: null,
			purchaseReceipt: values.purchaseReceipt?.trim() || null,
			purchaseInvoice: values.purchaseInvoice?.trim() || null,
			policyNumber: values.policyNumber?.trim() || null,
			insurer: values.insurer?.trim() || null,
			insuredValue: values.insuredValue ? Number(values.insuredValue) : null,
			insuranceStartDate: values.insuranceStartDate
				? new Date(values.insuranceStartDate)
				: null,
			insuranceEndDate: values.insuranceEndDate
				? new Date(values.insuranceEndDate)
				: null,
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
			depreciationStartDate: values.depreciationStartDate
				? new Date(values.depreciationStartDate)
				: null,
			openingAccumulatedDepreciation: values.openingAccumulatedDepreciation
				? Number(values.openingAccumulatedDepreciation)
				: null,
			openingNumberOfBookedDepreciations:
				values.openingNumberOfBookedDepreciations
					? parseInt(values.openingNumberOfBookedDepreciations, 10)
					: null,
		};

		if (isEdit && assetId) {
			const parsed = Asset.updateAssetSchema.safeParse({
				id: assetId,
				...common,
				status: values.status as Asset.AssetStatus,
			});
			if (!parsed.success) {
				toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
				return;
			}
			updateMutation.mutate(parsed.data);
		} else {
			const parsed = Asset.createAssetSchema.safeParse({
				...common,
				status: "DRAFT",
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

	const formErrors = form.formState.errors;

	if (isEdit && isLoadingAsset) {
		return (
			<div className="flex h-[60vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (isEdit && !isLoadingAsset && !rawAsset) {
		return (
			<div className="container mx-auto max-w-3xl py-6">
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<CircleAlert className="mb-4 h-12 w-12 text-muted-foreground" />
						<h2 className="mb-2 text-lg font-semibold">Asset Not Found</h2>
						<p className="mb-4 text-sm text-muted-foreground">
							The asset you are looking for does not exist or has been removed.
						</p>
						<Button asChild variant="outline">
							<Link href="/asset/asset-sub-module/asset">Back to Assets</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-3xl py-6 space-y-6">
			<div className="flex items-center gap-3">
				<Button variant="ghost" size="icon" asChild>
					<Link href="/asset/asset-sub-module/asset">
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<h1 className="text-2xl font-bold">
					{isEdit ? "Edit Asset" : "New Asset"}
				</h1>
				{hasUnsavedChanges && (
					<Badge
						variant="outline"
						className="text-orange-600 border-orange-300"
					>
						Unsaved Changes
					</Badge>
				)}
			</div>

			<form onSubmit={onSubmit} className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Basic Information</CardTitle>
						<CardDescription>
							Core identity and classification of the asset
						</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="assetName">
								Asset Name <span className="text-destructive">*</span>
							</Label>
							<Input
								id="assetName"
								placeholder="e.g. Dell Laptop 2024"
								className={formErrors.assetName ? "border-destructive" : ""}
								{...form.register("assetName")}
							/>
							{formErrors.assetName && (
								<p className="text-sm text-destructive">
									{formErrors.assetName.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="company">
								Company <span className="text-destructive">*</span>
							</Label>
							<Input
								id="company"
								placeholder="e.g. My Company Ltd."
								className={formErrors.company ? "border-destructive" : ""}
								{...form.register("company")}
							/>
							{formErrors.company && (
								<p className="text-sm text-destructive">
									{formErrors.company.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="itemCode">Item Code</Label>
							<Input
								id="itemCode"
								placeholder="e.g. ITEM-001"
								{...form.register("itemCode")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="barcode">Barcode / QR Code</Label>
							<div className="flex gap-2">
								<Input
									id="barcode"
									placeholder="e.g. 1234567890"
									className="flex-1"
									{...form.register("barcode")}
								/>
								<Button
									type="button"
									variant="outline"
									onClick={() => setScannerOpen(true)}
									className="shrink-0"
								>
									<Scan className="h-4 w-4 mr-2" />
									Scan
								</Button>
							</div>
						</div>

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
												className={`h-10 w-full justify-between font-normal ${formErrors.assetCategoryId ? "border-destructive" : ""}`}
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

						<div className="space-y-2">
							<Label htmlFor="custodian">Custodian</Label>
							<Input
								id="custodian"
								placeholder="Person responsible"
								{...form.register("custodian")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="department">Department</Label>
							<Input
								id="department"
								placeholder="e.g. Engineering"
								{...form.register("department")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="assetQuantity">Quantity</Label>
							<Input
								id="assetQuantity"
								type="number"
								min={1}
								className={formErrors.assetQuantity ? "border-destructive" : ""}
								{...form.register("assetQuantity", { valueAsNumber: true })}
							/>
							{formErrors.assetQuantity && (
								<p className="text-sm text-destructive">
									{formErrors.assetQuantity.message}
								</p>
							)}
						</div>

						{isEdit && (
							<div className="space-y-2">
								<Label>Status</Label>
								<Input value={rawAsset?.status ?? "DRAFT"} disabled readOnly />
							</div>
						)}
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
								className={
									formErrors.netPurchaseAmount ? "border-destructive" : ""
								}
								{...form.register("netPurchaseAmount")}
							/>
							{formErrors.netPurchaseAmount && (
								<p className="text-sm text-destructive">
									{formErrors.netPurchaseAmount.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="purchaseReceipt">Purchase Receipt</Label>
							<Input
								id="purchaseReceipt"
								placeholder="e.g. PR-00001"
								{...form.register("purchaseReceipt")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="purchaseInvoice">Purchase Invoice</Label>
							<Input
								id="purchaseInvoice"
								placeholder="e.g. PI-00001"
								{...form.register("purchaseInvoice")}
							/>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Insurance</CardTitle>
						<CardDescription>Insurance details for the asset</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="policyNumber">Policy Number</Label>
							<Input
								id="policyNumber"
								placeholder="e.g. POL-12345"
								{...form.register("policyNumber")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="insurer">Insurer</Label>
							<Input
								id="insurer"
								placeholder="e.g. ABC Insurance Co."
								{...form.register("insurer")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="insuredValue">Insured Value</Label>
							<Input
								id="insuredValue"
								type="number"
								min={0}
								step="0.01"
								placeholder="0.00"
								{...form.register("insuredValue")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="insuranceStartDate">Insurance Start Date</Label>
							<Input
								id="insuranceStartDate"
								type="date"
								{...form.register("insuranceStartDate")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="insuranceEndDate">Insurance End Date</Label>
							<Input
								id="insuranceEndDate"
								type="date"
								{...form.register("insuranceEndDate")}
							/>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Ownership</CardTitle>
						<CardDescription>
							Asset ownership and related parties
						</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

						{watchedAssetOwner === "COMPANY" && (
							<div className="space-y-2">
								<Label htmlFor="assetOwnerCompany">Company Name</Label>
								<Input
									id="assetOwnerCompany"
									placeholder="Owner company name"
									{...form.register("assetOwnerCompany")}
								/>
							</div>
						)}

						{watchedAssetOwner === "SUPPLIER" && (
							<div className="space-y-2">
								<Label htmlFor="supplier">Supplier</Label>
								<Input
									id="supplier"
									placeholder="Supplier name"
									{...form.register("supplier")}
								/>
							</div>
						)}

						{watchedAssetOwner === "CUSTOMER" && (
							<div className="space-y-2">
								<Label htmlFor="customer">Customer</Label>
								<Input
									id="customer"
									placeholder="Customer name"
									{...form.register("customer")}
								/>
							</div>
						)}
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
									<div className="space-y-2">
										<Label htmlFor="depreciationMethod">
											Depreciation Method{" "}
											<span className="text-destructive">*</span>
										</Label>
										<Controller
											name="depreciationMethod"
											control={form.control}
											render={({ field }) => (
												<Select
													value={field.value ?? ""}
													onValueChange={field.onChange}
												>
													<SelectTrigger
														className={`h-10 ${formErrors.depreciationMethod ? "border-destructive" : ""}`}
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
										{formErrors.depreciationMethod && (
											<p className="text-sm text-destructive">
												{formErrors.depreciationMethod.message}
											</p>
										)}
									</div>

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
											className={
												formErrors.totalNumberOfDepreciations
													? "border-destructive"
													: ""
											}
											{...form.register("totalNumberOfDepreciations")}
										/>
										{formErrors.totalNumberOfDepreciations && (
											<p className="text-sm text-destructive">
												{formErrors.totalNumberOfDepreciations.message}
											</p>
										)}
									</div>

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
											className={
												formErrors.frequencyOfDepreciation
													? "border-destructive"
													: ""
											}
											{...form.register("frequencyOfDepreciation")}
										/>
										{formErrors.frequencyOfDepreciation && (
											<p className="text-sm text-destructive">
												{formErrors.frequencyOfDepreciation.message}
											</p>
										)}
									</div>

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
											className={
												formErrors.expectedValueAfterUsefulLife
													? "border-destructive"
													: ""
											}
											{...form.register("expectedValueAfterUsefulLife")}
										/>
										{formErrors.expectedValueAfterUsefulLife && (
											<p className="text-sm text-destructive">
												{formErrors.expectedValueAfterUsefulLife.message}
											</p>
										)}
									</div>

									<div className="space-y-2">
										<Label htmlFor="depreciationStartDate">
											Depreciation Start Date
										</Label>
										<Input
											id="depreciationStartDate"
											type="date"
											className={
												formErrors.depreciationStartDate
													? "border-destructive"
													: ""
											}
											{...form.register("depreciationStartDate")}
										/>
										{formErrors.depreciationStartDate && (
											<p className="text-sm text-destructive">
												{formErrors.depreciationStartDate.message}
											</p>
										)}
									</div>

									<div className="space-y-2">
										<Label htmlFor="openingAccumulatedDepreciation">
											Opening Accumulated Depreciation
										</Label>
										<Input
											id="openingAccumulatedDepreciation"
											type="number"
											min={0}
											step="0.01"
											placeholder="0.00"
											className={
												formErrors.openingAccumulatedDepreciation
													? "border-destructive"
													: ""
											}
											{...form.register("openingAccumulatedDepreciation")}
										/>
										{formErrors.openingAccumulatedDepreciation && (
											<p className="text-sm text-destructive">
												{formErrors.openingAccumulatedDepreciation.message}
											</p>
										)}
									</div>

									<div className="space-y-2">
										<Label htmlFor="openingNumberOfBookedDepreciations">
											Opening Number of Booked Depreciations
										</Label>
										<Input
											id="openingNumberOfBookedDepreciations"
											type="number"
											min={0}
											step={1}
											placeholder="0"
											className={
												formErrors.openingNumberOfBookedDepreciations
													? "border-destructive"
													: ""
											}
											{...form.register("openingNumberOfBookedDepreciations")}
										/>
										{formErrors.openingNumberOfBookedDepreciations && (
											<p className="text-sm text-destructive">
												{formErrors.openingNumberOfBookedDepreciations.message}
											</p>
										)}
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

			<BarcodeScannerDialog
				isOpen={scannerOpen}
				onClose={() => setScannerOpen(false)}
				onScanSuccess={(code) => {
					form.setValue("barcode", code, { shouldDirty: true });
				}}
			/>
		</div>
	);
}
