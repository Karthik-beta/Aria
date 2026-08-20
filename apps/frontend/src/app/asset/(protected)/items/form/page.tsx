"use client";

import type { AppRouter } from "@aria/api-contract";
import {
	Asset,
	assetFinanceBookFormFromPersisted,
	assetFinanceBookInputFromForm,
	endOfMonthDateOnly,
	normalizeDateOnly,
	parseAssetFinanceBookShiftAllocations,
} from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { TRPCClientError } from "@trpc/client";
import {
	ArrowLeft,
	ChevronDown,
	CircleAlert,
	Loader2,
	Plus,
	Scan,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Suspense } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
	DEPRECIATION_METHOD_DOCS,
	DepreciationMethodInlineCard,
	DepreciationMethodLabel,
} from "@/components/asset/depreciation-method-doc-guide";
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
import { dateInputValue } from "@/lib/asset-date-only";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { DEPRECIATION_METHOD_OPTIONS } from "../../categories/asset-category.schema";

function isTRPCClientError(
	error: unknown,
): error is TRPCClientError<AppRouter> {
	return error instanceof TRPCClientError;
}

export const assetFormSchema = z
	.object({
		assetName: z.string().min(1, "Asset name is required").max(255),
		assetType: Asset.assetTypeSchema.default("EXISTING_ASSET"),
		companyId: z.string().min(1, "Company is required").max(255),
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
		purchaseDate: z.iso.date().optional().nullable(),
		availableForUseDate: z.iso.date().optional().nullable(),
		purchaseReceipt: z.string().max(255).optional().nullable(),
		purchaseInvoice: z.string().max(255).optional().nullable(),
		policyNumber: z.string().max(255).optional().nullable(),
		insurer: z.string().max(255).optional().nullable(),
		insuredValue: z.string().optional().nullable(),
		insuranceStartDate: z.iso.date().optional().nullable(),
		insuranceEndDate: z.iso.date().optional().nullable(),
		assetOwner: z.string(),
		assetOwnerCompany: z.string().max(255).optional().nullable(),
		supplier: z.string().max(255).optional().nullable(),
		customer: z.string().max(255).optional().nullable(),
		depreciationMethod: z.string().optional().nullable(),
		totalNumberOfDepreciations: z.string().optional().nullable(),
		frequencyOfDepreciation: z.string().optional().nullable(),
		expectedValueAfterUsefulLife: z.string().optional().nullable(),
		depreciationStartDate: z.iso.date().optional().nullable(),
		openingAccumulatedDepreciation: z.string().optional().nullable(),
		openingNumberOfBookedDepreciations: z.string().optional().nullable(),
		financeBooks: z
			.array(
				z.object({
					financeBookId: z.string().min(1),
					depreciationMethod: Asset.depreciationMethodSchema,
					totalNumberOfDepreciations: z.string().min(1),
					frequencyOfDepreciation: z.string().min(1),
					depreciationStartDate: z.iso.date(),
					dailyProrataBased: z.boolean().default(false),
					shiftBased: z.boolean().default(false),
					precision: z.string().default("2"),
					ratePrecision: z.string().default("2"),
					calculateUsingTotalDays: z.boolean().default(false),
					rateOfDepreciation: z.string().optional(),
					shiftAllocations: z.string().optional(),
					expectedValueAfterUsefulLife: z.string().optional(),
					openingAccumulatedDepreciation: z.string().optional(),
					openingNumberOfBookedDepreciations: z.string().optional(),
					manualEntriesText: z.string().optional(),
				}),
			)
			.default([]),
	})
	.superRefine((data, ctx) => {
		if (data.purchaseDate && data.availableForUseDate) {
			if (
				normalizeDateOnly(data.availableForUseDate) <
				normalizeDateOnly(data.purchaseDate)
			) {
				ctx.addIssue({
					path: ["availableForUseDate"],
					code: z.ZodIssueCode.custom,
					message: "Available for use date must be on or after purchase date",
				});
			}
		}

		if (!data.calculateDepreciation) return;
		for (const [index, book] of data.financeBooks.entries()) {
			if (
				book.depreciationMethod === "MANUAL" &&
				!book.manualEntriesText?.trim()
			) {
				ctx.addIssue({
					path: ["financeBooks", index, "manualEntriesText"],
					code: z.ZodIssueCode.custom,
					message: "Manual schedules require date:amount rows",
				});
			}

			const addBookIssue = (field: string, message: string) => {
				ctx.addIssue({
					path: ["financeBooks", index, field],
					code: z.ZodIssueCode.custom,
					message,
				});
			};
			const precision = Number(book.precision || "2");
			if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
				addBookIssue(
					"precision",
					"Currency precision must be an integer between 0 and 6",
				);
			}
			const ratePrecision = Number(book.ratePrecision || "2");
			if (
				!Number.isInteger(ratePrecision) ||
				ratePrecision < 0 ||
				ratePrecision > 6
			) {
				addBookIssue(
					"ratePrecision",
					"Rate precision must be an integer between 0 and 6",
				);
			}
			if (
				book.rateOfDepreciation?.trim() &&
				book.depreciationMethod !== "WRITTEN_DOWN_VALUE"
			) {
				addBookIssue(
					"rateOfDepreciation",
					"Rate of depreciation is supported only for written-down value",
				);
			} else if (book.rateOfDepreciation?.trim()) {
				const rate = Number(book.rateOfDepreciation);
				if (!Number.isFinite(rate) || rate < 0) {
					addBookIssue(
						"rateOfDepreciation",
						"Rate of depreciation must be a non-negative number",
					);
				}
			}

			let shiftAllocations: Asset.AssetShiftAllocation[] = [];
			try {
				shiftAllocations = parseAssetFinanceBookShiftAllocations(
					book.shiftAllocations,
				);
			} catch (error) {
				addBookIssue(
					"shiftAllocations",
					error instanceof Error ? error.message : "Invalid shift allocations",
				);
			}
			const totalPeriods = Number(book.totalNumberOfDepreciations);
			const allocationIndices = new Set<number>();
			for (const [allocationIndex, allocation] of shiftAllocations.entries()) {
				if (
					!Number.isInteger(totalPeriods) ||
					allocation.periodIndex >= totalPeriods
				) {
					addBookIssue(
						"shiftAllocations",
						`Shift allocation ${allocationIndex + 1} must use a configured period`,
					);
				}
				if (allocationIndices.has(allocation.periodIndex)) {
					addBookIssue(
						"shiftAllocations",
						`Shift allocation period ${allocation.periodIndex} is duplicated`,
					);
				}
				allocationIndices.add(allocation.periodIndex);
			}
			if (
				book.calculateUsingTotalDays &&
				(book.depreciationMethod !== "STRAIGHT_LINE" || !book.dailyProrataBased)
			) {
				addBookIssue(
					"calculateUsingTotalDays",
					"Total-days calculation requires daily straight-line depreciation",
				);
			}
			if (
				book.shiftBased &&
				(book.depreciationMethod !== "STRAIGHT_LINE" ||
					shiftAllocations.length !== totalPeriods)
			) {
				addBookIssue(
					"shiftAllocations",
					"Shift-based depreciation requires one allocation for every period",
				);
			}
			if (!book.shiftBased && shiftAllocations.length > 0) {
				addBookIssue(
					"shiftAllocations",
					"Shift allocations require shift-based depreciation",
				);
			}
			if (
				shiftAllocations.length > 0 &&
				book.depreciationMethod !== "STRAIGHT_LINE"
			) {
				addBookIssue(
					"shiftAllocations",
					"Shift allocations are supported only for straight-line depreciation",
				);
			}
		}

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
			if (
				normalizeDateOnly(data.depreciationStartDate) <
				normalizeDateOnly(data.purchaseDate)
			) {
				ctx.addIssue({
					path: ["depreciationStartDate"],
					code: z.ZodIssueCode.custom,
					message: "Must be on or after purchase date",
				});
			}
		}

		if (data.depreciationStartDate && data.availableForUseDate) {
			if (
				normalizeDateOnly(data.depreciationStartDate) <
				normalizeDateOnly(data.availableForUseDate)
			) {
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
	assetType: "EXISTING_ASSET",
	companyId: "",
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
	financeBooks: [],
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
	const [companyOpen, setCompanyOpen] = React.useState(false);
	const [scannerOpen, setScannerOpen] = React.useState(false);

	const { data: categoriesData } = trpc.asset.listAssetCategories.useQuery(
		undefined,
		{ staleTime: 30_000 },
	);
	const categories = categoriesData?.items ?? [];
	const { data: locationsData } = trpc.asset.listLocations.useQuery(undefined, {
		staleTime: 30_000,
	});
	const locations = locationsData?.items ?? [];
	const { data: companiesData } = trpc.company.listCompanies.useQuery(
		undefined,
		{
			staleTime: 30_000,
		},
	);
	const companies = companiesData?.items ?? [];
	const { data: financeBooksData } = trpc.asset.listFinanceBooks.useQuery(
		{ take: 250 },
		{ staleTime: 30_000 },
	);

	const { data: rawAsset, isLoading: isLoadingAsset } =
		trpc.asset.getAssetById.useQuery(
			{ id: assetId ?? "" },
			{ enabled: isEdit && Boolean(assetId) },
		);

	const urlDefaults = React.useMemo((): Partial<AssetFormValues> => {
		if (isEdit) return {};
		const defaults: Partial<AssetFormValues> = {};
		const assetName = searchParams.get("assetName");
		const companyId = searchParams.get("companyId");
		const assetCategoryId = searchParams.get("assetCategoryId");
		const locationId = searchParams.get("locationId");
		if (assetName) defaults.assetName = assetName;
		if (companyId) defaults.companyId = companyId;
		if (assetCategoryId) defaults.assetCategoryId = assetCategoryId;
		if (locationId) defaults.locationId = locationId;
		return defaults;
	}, [isEdit, searchParams]);

	const form = useForm<AssetFormValues>({
		resolver: zodResolver(assetFormSchema),
		defaultValues: { ...defaultFormValues, ...urlDefaults },
	});
	const financeBookFields = useFieldArray({
		control: form.control,
		name: "financeBooks",
	});
	const { isDirty: hasUnsavedChanges } = form.formState;

	React.useEffect(() => {
		if (!rawAsset) return;
		form.reset({
			assetName: rawAsset.assetName,
			assetType: rawAsset.assetType ?? "EXISTING_ASSET",
			companyId: rawAsset.companyId,
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
			purchaseDate: dateInputValue(rawAsset.purchaseDate),
			availableForUseDate: dateInputValue(rawAsset.availableForUseDate),
			purchaseReceipt: rawAsset.purchaseReceipt ?? "",
			purchaseInvoice: rawAsset.purchaseInvoice ?? "",
			policyNumber: rawAsset.policyNumber ?? "",
			insurer: rawAsset.insurer ?? "",
			insuredValue:
				rawAsset.insuredValue != null ? String(rawAsset.insuredValue) : "",
			insuranceStartDate: dateInputValue(rawAsset.insuranceStartDate),
			insuranceEndDate: dateInputValue(rawAsset.insuranceEndDate),
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
			depreciationStartDate: dateInputValue(rawAsset.depreciationStartDate),
			openingAccumulatedDepreciation:
				rawAsset.openingAccumulatedDepreciation != null
					? String(rawAsset.openingAccumulatedDepreciation)
					: "",
			openingNumberOfBookedDepreciations:
				rawAsset.openingNumberOfBookedDepreciations != null
					? String(rawAsset.openingNumberOfBookedDepreciations)
					: "",
			financeBooks: (rawAsset.financeBooks ?? []).map(
				assetFinanceBookFormFromPersisted,
			),
		});
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
	const watchedAssetType = useWatch({
		control: form.control,
		name: "assetType",
	});
	const watchedStatus = useWatch({
		control: form.control,
		name: "status",
	});

	const selectedCategory = categories.find(
		(c) => c.id === watchedAssetCategoryId,
	);

	React.useEffect(() => {
		if (isEdit || !selectedCategory) return;

		const currentValues = form.getValues();
		const currentDefaults = (form.formState.defaultValues ??
			currentValues) as AssetFormValues;
		const nextDefaults = { ...currentDefaults };
		let changed = false;
		const applyCategoryDefault = (
			field:
				| "depreciationMethod"
				| "totalNumberOfDepreciations"
				| "frequencyOfDepreciation"
				| "expectedValueAfterUsefulLife",
			value: string | number | null | undefined,
		) => {
			if (value == null) return;
			const fieldState = form.getFieldState(field);
			if (fieldState.isDirty || fieldState.isTouched) return;
			const current = currentValues[field];
			if (typeof current === "string" && current.trim()) return;
			nextDefaults[field] = String(value);
			changed = true;
		};

		applyCategoryDefault(
			"depreciationMethod",
			selectedCategory.depreciationMethod,
		);
		applyCategoryDefault(
			"totalNumberOfDepreciations",
			selectedCategory.totalNumberOfDepreciations,
		);
		applyCategoryDefault(
			"frequencyOfDepreciation",
			selectedCategory.frequencyOfDepreciation,
		);
		applyCategoryDefault(
			"expectedValueAfterUsefulLife",
			selectedCategory.expectedValueAfterUsefulLife,
		);

		if (changed) {
			form.reset(nextDefaults, {
				keepDirtyValues: true,
				keepDirty: true,
				keepTouched: true,
			});
		}
	}, [isEdit, selectedCategory, form]);

	React.useEffect(() => {
		if (isEdit || !watchedCalculateDepreciation || !watchedAvailableForUseDate)
			return;

		const fieldState = form.getFieldState("depreciationStartDate");
		const current = form.getValues("depreciationStartDate");
		if (fieldState.isDirty || fieldState.isTouched || current?.trim()) return;

		const formatted = dateInputValue(
			endOfMonthDateOnly(watchedAvailableForUseDate),
		);
		if (!formatted) return;

		const currentDefaults = (form.formState.defaultValues ??
			form.getValues()) as AssetFormValues;
		form.reset(
			{ ...currentDefaults, depreciationStartDate: formatted },
			{ keepDirtyValues: true, keepDirty: true, keepTouched: true },
		);
	}, [watchedCalculateDepreciation, watchedAvailableForUseDate, form, isEdit]);

	const createMutation = trpc.asset.createAsset.useMutation({
		onSuccess: (newAsset) => {
			void utils.asset.listAssets.invalidate();
			toast.success(`Asset "${newAsset.assetName}" created`);
			startTransition(() => router.push(`/asset/items/${newAsset.id}`));
		},
		onError: (error) => toast.error(getToastMessage(error, "create")),
	});

	const updateMutation = trpc.asset.updateAsset.useMutation({
		onSuccess: (updated) => {
			void utils.asset.listAssets.invalidate();
			toast.success("Asset updated");
			startTransition(() => router.push(`/asset/items/${updated.id}`));
		},
		onError: (error) => toast.error(getToastMessage(error, "update")),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const onSubmit = form.handleSubmit((values) => {
		let financeBooks: Asset.AssetFinanceBookInput[];
		try {
			financeBooks = (values.financeBooks ?? []).map(
				assetFinanceBookInputFromForm,
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Invalid shift allocations",
			);
			return;
		}

		const common = {
			assetName: values.assetName.trim(),
			assetType: values.assetType as Asset.AssetType,
			companyId: values.companyId,
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
			insuranceStartDate: values.insuranceStartDate || null,
			insuranceEndDate: values.insuranceEndDate || null,
			netPurchaseAmount: values.netPurchaseAmount
				? Number(values.netPurchaseAmount)
				: null,
			purchaseDate: values.purchaseDate || null,
			availableForUseDate: values.availableForUseDate || null,
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
			depreciationStartDate: values.depreciationStartDate || null,
			openingAccumulatedDepreciation: values.openingAccumulatedDepreciation
				? Number(values.openingAccumulatedDepreciation)
				: null,
			openingNumberOfBookedDepreciations:
				values.openingNumberOfBookedDepreciations
					? parseInt(values.openingNumberOfBookedDepreciations, 10)
					: null,
			financeBooks,
		};

		if (isEdit && assetId) {
			const updatePayload =
				values.status === "DRAFT"
					? common
					: {
							assetName: common.assetName,
							itemCode: common.itemCode,
							barcode: common.barcode,
							locationId: common.locationId,
							custodian: common.custodian,
							department: common.department,
							assetQuantity: common.assetQuantity,
							maintenanceRequired: common.maintenanceRequired,
							assetOwner: common.assetOwner,
							assetOwnerCompany: common.assetOwnerCompany,
							supplier: common.supplier,
							customer: common.customer,
							purchaseReceipt: common.purchaseReceipt,
							purchaseInvoice: common.purchaseInvoice,
							policyNumber: common.policyNumber,
							insurer: common.insurer,
							insuredValue: common.insuredValue,
							insuranceStartDate: common.insuranceStartDate,
							insuranceEndDate: common.insuranceEndDate,
						};
			const parsed = Asset.updateAssetSchema.safeParse({
				id: assetId,
				...updatePayload,
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

	const handleBarcodeScanSuccess = React.useCallback(
		(code: string) => {
			const promise = (async () => {
				try {
					const existingAsset = await utils.asset.getAssetByBarcode.fetch({
						barcode: code,
					});
					if (existingAsset.id !== assetId) {
						throw new Error(
							`Barcode "${code}" is already registered to asset "${existingAsset.assetName}"`,
						);
					}

					form.setValue("barcode", code, { shouldDirty: true });
					return { isAvailable: false };
				} catch (error) {
					if (isTRPCClientError(error) && error.data?.code === "NOT_FOUND") {
						form.setValue("barcode", code, { shouldDirty: true });
						return { isAvailable: true };
					}

					throw error;
				}
			})();

			toast.promise(promise, {
				loading: "Verifying barcode uniqueness...",
				success: ({ isAvailable }) =>
					isAvailable
						? "Barcode is unique and available."
						: "Barcode verified for this asset.",
				error: (error: unknown) =>
					error instanceof Error
						? error.message
						: "Unable to verify barcode availability.",
			});
		},
		[assetId, form, utils],
	);

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
			<div className="container mx-auto max-w-3xl px-4 md:px-6 py-6">
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<CircleAlert className="mb-4 h-12 w-12 text-muted-foreground" />
						<h2 className="mb-2 text-lg font-semibold">Asset Not Found</h2>
						<p className="mb-4 text-sm text-muted-foreground">
							The asset you are looking for does not exist or has been removed.
						</p>
						<Button asChild variant="outline">
							<Link href="/asset/items">Back to Assets</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-3xl px-4 md:px-6 py-6 space-y-6">
			<div className="flex items-center gap-3">
				<Button variant="ghost" size="icon" asChild>
					<Link href="/asset/items">
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
							<Label htmlFor="assetType">Asset Type</Label>
							<select
								id="assetType"
								aria-label="Asset Type"
								disabled={watchedStatus !== "DRAFT"}
								className="h-10 w-full rounded-md border bg-background px-3"
								{...form.register("assetType")}
							>
								<option value="EXISTING_ASSET">Existing Asset</option>
								<option value="COMPOSITE_ASSET">Composite Asset</option>
								<option value="COMPOSITE_COMPONENT">Composite Component</option>
							</select>
							<p className="text-xs text-muted-foreground">
								{watchedAssetType === "COMPOSITE_ASSET"
									? "A submitted capitalization is required before lifecycle submission."
									: watchedAssetType === "COMPOSITE_COMPONENT"
										? "Available-for-use may be omitted; the server uses the purchase date for depreciation."
										: "Existing assets use the configured purchase and available-for-use dates."}
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="company">
								Company <span className="text-destructive">*</span>
							</Label>
							<Controller
								name="companyId"
								control={form.control}
								render={({ field }) => (
									<Popover open={companyOpen} onOpenChange={setCompanyOpen}>
										<PopoverTrigger asChild>
											<Button
												id="company"
												type="button"
												variant="outline"
												className={`h-10 w-full justify-between font-normal ${formErrors.companyId ? "border-destructive" : ""}`}
											>
												<span className="truncate">
													{companies.find(
														(company) => company.id === field.value,
													)?.name || "Select company…"}
												</span>
												<ChevronDown className="h-4 w-4 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverContent
											className="p-0 pointer-events-auto"
											style={{ width: "var(--radix-popover-trigger-width)" }}
										>
											<Command>
												<CommandInput placeholder="Search companies…" />
												<CommandList>
													<CommandEmpty>No companies found</CommandEmpty>
													<CommandGroup>
														{companies.map((comp) => (
															<CommandItem
																key={comp.id}
																onSelect={() => {
																	field.onChange(comp.id);
																	setCompanyOpen(false);
																}}
															>
																{comp.name}
															</CommandItem>
														))}
													</CommandGroup>
												</CommandList>
											</Command>
										</PopoverContent>
									</Popover>
								)}
							/>
							{formErrors.companyId && (
								<p className="text-sm text-destructive">
									{formErrors.companyId.message}
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
										<DepreciationMethodLabel
											htmlFor="depreciationMethod"
											required
										/>
										<Controller
											name="depreciationMethod"
											control={form.control}
											render={({ field }) => (
												<>
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
															{DEPRECIATION_METHOD_OPTIONS.map((opt) => {
																const doc =
																	DEPRECIATION_METHOD_DOCS[
																		opt.value as Asset.DepreciationMethod
																	];
																return (
																	<SelectItem key={opt.value} value={opt.value}>
																		<div className="flex flex-col gap-0.5 py-0.5">
																			<span className="font-medium">
																				{opt.label}
																			</span>
																			{doc?.subtitle && (
																				<span className="text-[11px] text-muted-foreground font-normal">
																					{doc.subtitle}
																				</span>
																			)}
																		</div>
																	</SelectItem>
																);
															})}
														</SelectContent>
													</Select>
													<DepreciationMethodInlineCard
														selectedMethod={field.value}
													/>
												</>
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

								<div className="mt-5 flex items-center justify-between border-t pt-4">
									<div>
										<h4 className="text-sm font-medium">Per-book schedules</h4>
										<p className="text-xs text-muted-foreground">
											Leave empty to inherit the category and company defaults.
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={watchedStatus !== "DRAFT"}
										onClick={() => {
											const book = financeBooksData?.items[0];
											if (!book) {
												toast.error("Create a finance book first");
												return;
											}
											financeBookFields.append({
												financeBookId: book.id,
												depreciationMethod: "STRAIGHT_LINE",
												totalNumberOfDepreciations: "60",
												frequencyOfDepreciation: "1",
												depreciationStartDate:
													form.getValues("depreciationStartDate") || "",
												dailyProrataBased: false,
												shiftBased: false,
												precision: "2",
												ratePrecision: "2",
												calculateUsingTotalDays: false,
												rateOfDepreciation: "",
												shiftAllocations: "",
												expectedValueAfterUsefulLife: "0",
												openingAccumulatedDepreciation: "0",
												openingNumberOfBookedDepreciations: "0",
												manualEntriesText: "",
											});
										}}
									>
										<Plus className="mr-2 h-4 w-4" /> Add Book
									</Button>
								</div>
								<div className="space-y-3">
									{financeBookFields.fields.map((field, index) => (
										<div
											key={field.id}
											className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-6"
										>
											<div className="space-y-1 sm:col-span-2">
												<Label>Finance Book</Label>
												<select
													disabled={watchedStatus !== "DRAFT"}
													className="h-9 w-full rounded-md border bg-background px-3"
													{...form.register(
														`financeBooks.${index}.financeBookId`,
													)}
												>
													{financeBooksData?.items.map((book) => (
														<option key={book.id} value={book.id}>
															{book.name}
														</option>
													))}
												</select>
											</div>
											<div className="space-y-1 sm:col-span-2">
												<Label>Method</Label>
												<select
													disabled={watchedStatus !== "DRAFT"}
													className="h-9 w-full rounded-md border bg-background px-3"
													{...form.register(
														`financeBooks.${index}.depreciationMethod`,
													)}
												>
													{DEPRECIATION_METHOD_OPTIONS.map((option) => (
														<option key={option.value} value={option.value}>
															{option.label}
														</option>
													))}
												</select>
											</div>
											<div className="space-y-1">
												<Label
													htmlFor={`financeBooks-${index}-totalNumberOfDepreciations`}
												>
													Periods
												</Label>
												<Input
													id={`financeBooks-${index}-totalNumberOfDepreciations`}
													disabled={watchedStatus !== "DRAFT"}
													type="number"
													min={1}
													{...form.register(
														`financeBooks.${index}.totalNumberOfDepreciations`,
													)}
												/>
											</div>
											<div className="flex items-end gap-2">
												<div className="flex-1 space-y-1">
													<Label>Months</Label>
													<Input
														disabled={watchedStatus !== "DRAFT"}
														type="number"
														min={1}
														{...form.register(
															`financeBooks.${index}.frequencyOfDepreciation`,
														)}
													/>
												</div>
												<Button
													disabled={watchedStatus !== "DRAFT"}
													type="button"
													size="icon"
													variant="ghost"
													aria-label="Remove finance book"
													onClick={() => financeBookFields.remove(index)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
											<div className="space-y-1 sm:col-span-2">
												<Label>Start Date</Label>
												<Input
													disabled={watchedStatus !== "DRAFT"}
													type="date"
													{...form.register(
														`financeBooks.${index}.depreciationStartDate`,
													)}
												/>
											</div>
											<div className="space-y-1">
												<Label>Salvage</Label>
												<Input
													disabled={watchedStatus !== "DRAFT"}
													type="number"
													min={0}
													{...form.register(
														`financeBooks.${index}.expectedValueAfterUsefulLife`,
													)}
												/>
											</div>
											<div className="space-y-1">
												<Label>Opening Accum.</Label>
												<Input
													disabled={watchedStatus !== "DRAFT"}
													type="number"
													min={0}
													{...form.register(
														`financeBooks.${index}.openingAccumulatedDepreciation`,
													)}
												/>
											</div>
											<div className="space-y-1">
												<Label>Booked</Label>
												<Input
													disabled={watchedStatus !== "DRAFT"}
													type="number"
													min={0}
													{...form.register(
														`financeBooks.${index}.openingNumberOfBookedDepreciations`,
													)}
												/>
											</div>
											<div className="flex items-center gap-2 sm:col-span-2">
												<Controller
													name={`financeBooks.${index}.dailyProrataBased`}
													control={form.control}
													render={({ field: optionField }) => (
														<Checkbox
															id={`financeBooks-${index}-dailyProrataBased`}
															checked={Boolean(optionField.value)}
															onCheckedChange={optionField.onChange}
															disabled={watchedStatus !== "DRAFT"}
														/>
													)}
												/>
												<Label
													htmlFor={`financeBooks-${index}-dailyProrataBased`}
													className="cursor-pointer"
												>
													Daily Prorata Based
												</Label>
											</div>
											<div className="flex items-center gap-2 sm:col-span-2">
												<Controller
													name={`financeBooks.${index}.shiftBased`}
													control={form.control}
													render={({ field: optionField }) => (
														<Checkbox
															id={`financeBooks-${index}-shiftBased`}
															checked={Boolean(optionField.value)}
															onCheckedChange={optionField.onChange}
															disabled={watchedStatus !== "DRAFT"}
														/>
													)}
												/>
												<Label
													htmlFor={`financeBooks-${index}-shiftBased`}
													className="cursor-pointer"
												>
													Shift Based
												</Label>
											</div>
											<div className="space-y-1">
												<Label htmlFor={`financeBooks-${index}-precision`}>
													Currency Precision
												</Label>
												<Input
													id={`financeBooks-${index}-precision`}
													disabled={watchedStatus !== "DRAFT"}
													type="number"
													min={0}
													max={6}
													{...form.register(`financeBooks.${index}.precision`)}
												/>
											</div>
											<div className="space-y-1">
												<Label htmlFor={`financeBooks-${index}-ratePrecision`}>
													Rate Precision
												</Label>
												<Input
													id={`financeBooks-${index}-ratePrecision`}
													disabled={watchedStatus !== "DRAFT"}
													type="number"
													min={0}
													max={6}
													{...form.register(
														`financeBooks.${index}.ratePrecision`,
													)}
												/>
											</div>
											{form.watch(
												`financeBooks.${index}.depreciationMethod`,
											) === "WRITTEN_DOWN_VALUE" && (
												<div className="space-y-1">
													<Label
														htmlFor={`financeBooks-${index}-rateOfDepreciation`}
													>
														Rate of Depreciation
													</Label>
													<Input
														id={`financeBooks-${index}-rateOfDepreciation`}
														disabled={watchedStatus !== "DRAFT"}
														type="number"
														min={0}
														step="0.01"
														{...form.register(
															`financeBooks.${index}.rateOfDepreciation`,
														)}
													/>
												</div>
											)}
											<div className="flex items-center gap-2 sm:col-span-2">
												<Controller
													name={`financeBooks.${index}.calculateUsingTotalDays`}
													control={form.control}
													render={({ field: optionField }) => (
														<Checkbox
															id={`financeBooks-${index}-calculateUsingTotalDays`}
															checked={Boolean(optionField.value)}
															onCheckedChange={optionField.onChange}
															disabled={watchedStatus !== "DRAFT"}
														/>
													)}
												/>
												<Label
													htmlFor={`financeBooks-${index}-calculateUsingTotalDays`}
													className="cursor-pointer"
												>
													Calculate Using Total Days
												</Label>
											</div>
											<div className="space-y-1 sm:col-span-4">
												<Label
													htmlFor={`financeBooks-${index}-shiftAllocations`}
												>
													Shift Allocations
												</Label>
												<Input
													id={`financeBooks-${index}-shiftAllocations`}
													disabled={watchedStatus !== "DRAFT"}
													placeholder='[{"periodIndex":0,"shift":"DAY","factor":1}]'
													{...form.register(
														`financeBooks.${index}.shiftAllocations`,
													)}
												/>
												<p className="text-xs text-muted-foreground">
													Use a JSON array of periodIndex, shift, and factor
													objects. Shift names may contain punctuation.
												</p>
											</div>
											{form.watch(
												`financeBooks.${index}.depreciationMethod`,
											) === "MANUAL" && (
												<div className="space-y-1 sm:col-span-3">
													<Label>Manual schedule rows</Label>
													<Input
														disabled={watchedStatus !== "DRAFT"}
														placeholder="2026-07-31:1000, 2026-08-31:1000"
														{...form.register(
															`financeBooks.${index}.manualEntriesText`,
														)}
													/>
													<p className="text-xs text-muted-foreground">
														Enter date:amount pairs separated by commas or new
														lines.
													</p>
												</div>
											)}
										</div>
									))}
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
				onScanSuccess={handleBarcodeScanSuccess}
			/>
		</div>
	);
}
