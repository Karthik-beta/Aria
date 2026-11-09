"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import {
	formatCurrency,
	PURCHASE_RECEIPT_STATUS_OPTIONS,
	toDateInputValue,
} from "../purchase-receipt.utils";

type PurchaseReceiptFormValues = Omit<
	z.input<typeof Inventory.createPurchaseReceiptSchema>,
	"items" | "taxes"
> & {
	items: Array<
		z.input<typeof Inventory.createPurchaseReceiptItemSchema> & { id?: string }
	>;
	taxes?: Array<
		z.input<typeof Inventory.createPurchaseReceiptTaxSchema> & { id?: string }
	>;
};

const SERIES_PATTERN_OPTIONS = ["MAT-PRE-.YYYY.-"];

function toTimeInputValue(value: string | undefined | null): string {
	if (!value) return "";
	const [hours, minutes] = value.split(":");
	if (!hours || !minutes) return "";
	return `${hours}:${minutes}`;
}

export default function PurchaseReceiptFormPage() {
	return (
		<Suspense fallback={<PurchaseReceiptFormFallback />}>
			<PurchaseReceiptFormContent />
		</Suspense>
	);
}

function PurchaseReceiptFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<PurchaseReceiptFormValues>({
		resolver: zodResolver(Inventory.createPurchaseReceiptSchema),
		defaultValues: {
			seriesPattern: "MAT-PRE-.YYYY.-",
			postingDate: new Date(),
			postingTime: "09:00",
			editPostingDateTime: false,
			supplier: "",
			company: "",
			status: "DRAFT",
			isReturn: false,
			applyPutawayRule: false,
			supplierDeliveryNote: "",
			acceptedWarehouse: "",
			rejectedWarehouse: "",
			isSubcontracted: false,
			currency: "INR",
			priceList: "",
			disableRoundedTotal: false,
			supplierAddress: "",
			contactPerson: "",
			shippingAddressTemplate: "",
			companyTRN: "",
			billingAddress: "",
			terms: "",
			termsContent: "",
			letterHead: "",
			printHeading: "",
			groupSameItems: false,
			permitNumber: "",
			recoverableStandardRatedExpenses: 0,
			reverseChargeApplicable: "N",
			transporterName: "",
			vehicleNumber: "",
			vehicleDate: undefined,
			instructions: "",
			remarks: "",
			isInternalSupplier: false,
			items: [
				{
					itemCode: "",
					itemName: "",
					description: "",
					acceptedQuantity: 1,
					rejectedQuantity: 0,
					rate: 0,
					uom: "",
					acceptedWarehouse: "",
					rejectedWarehouse: "",
				},
			],
			taxes: [],
		},
	});

	const {
		fields: itemFields,
		append: appendItem,
		remove: removeItem,
	} = useFieldArray({
		control: form.control,
		name: "items",
	});

	const {
		fields: taxFields,
		append: appendTax,
		remove: removeTax,
	} = useFieldArray({
		control: form.control,
		name: "taxes",
	});

	const { data: purchaseReceipt, isLoading: isFetchingReceipt } =
		trpc.inventory.getPurchaseReceiptById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	useEffect(() => {
		if (!isEditMode || !purchaseReceipt) return;
		form.reset({
			seriesPattern: purchaseReceipt.seriesPattern,
			postingDate: new Date(purchaseReceipt.postingDate),
			postingTime: purchaseReceipt.postingTime,
			editPostingDateTime: purchaseReceipt.editPostingDateTime,
			supplier: purchaseReceipt.supplier,
			company: purchaseReceipt.company,
			status: purchaseReceipt.status,
			isReturn: purchaseReceipt.isReturn,
			applyPutawayRule: purchaseReceipt.applyPutawayRule,
			supplierDeliveryNote: purchaseReceipt.supplierDeliveryNote ?? "",
			acceptedWarehouse: purchaseReceipt.acceptedWarehouse ?? "",
			rejectedWarehouse: purchaseReceipt.rejectedWarehouse ?? "",
			isSubcontracted: purchaseReceipt.isSubcontracted,
			currency: purchaseReceipt.currency ?? "",
			priceList: purchaseReceipt.priceList ?? "",
			disableRoundedTotal: purchaseReceipt.disableRoundedTotal,
			supplierAddress: purchaseReceipt.supplierAddress ?? "",
			contactPerson: purchaseReceipt.contactPerson ?? "",
			shippingAddressTemplate: purchaseReceipt.shippingAddressTemplate ?? "",
			companyTRN: purchaseReceipt.companyTRN ?? "",
			billingAddress: purchaseReceipt.billingAddress ?? "",
			terms: purchaseReceipt.terms ?? "",
			termsContent: purchaseReceipt.termsContent ?? "",
			letterHead: purchaseReceipt.letterHead ?? "",
			printHeading: purchaseReceipt.printHeading ?? "",
			groupSameItems: purchaseReceipt.groupSameItems,
			permitNumber: purchaseReceipt.permitNumber ?? "",
			recoverableStandardRatedExpenses:
				purchaseReceipt.recoverableStandardRatedExpenses ?? 0,
			reverseChargeApplicable: purchaseReceipt.reverseChargeApplicable,
			transporterName: purchaseReceipt.transporterName ?? "",
			vehicleNumber: purchaseReceipt.vehicleNumber ?? "",
			vehicleDate: purchaseReceipt.vehicleDate
				? new Date(purchaseReceipt.vehicleDate)
				: undefined,
			instructions: purchaseReceipt.instructions ?? "",
			remarks: purchaseReceipt.remarks ?? "",
			isInternalSupplier: purchaseReceipt.isInternalSupplier,
			items:
				purchaseReceipt.items.length > 0
					? purchaseReceipt.items.map((item) => ({
							id: item.id,
							itemCode: item.itemCode,
							itemName: item.itemName ?? "",
							description: item.description ?? "",
							acceptedQuantity: item.acceptedQuantity,
							rejectedQuantity: item.rejectedQuantity,
							rate: item.rate,
							uom: item.uom ?? "",
							acceptedWarehouse: item.acceptedWarehouse ?? "",
							rejectedWarehouse: item.rejectedWarehouse ?? "",
						}))
					: [
							{
								itemCode: "",
								itemName: "",
								description: "",
								acceptedQuantity: 1,
								rejectedQuantity: 0,
								rate: 0,
								uom: "",
								acceptedWarehouse: "",
								rejectedWarehouse: "",
							},
						],
			taxes: purchaseReceipt.taxes.map((tax) => ({
				id: tax.id,
				type: tax.type,
				accountHead: tax.accountHead,
				taxRate: tax.taxRate,
				amount: tax.amount,
			})),
		});
	}, [form, isEditMode, purchaseReceipt]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingReceipt &&
			!purchaseReceipt &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Purchase receipt not found");
			startTransition(() => {
				router.push("/inventory/stock-transaction/purchase-receipt");
			});
		}
	}, [isEditMode, isFetchingReceipt, purchaseReceipt, router]);

	const createMutation = trpc.inventory.createPurchaseReceipt.useMutation({
		onSuccess: async () => {
			toast.success("Purchase receipt created successfully");
			await utils.inventory.listPurchaseReceipts.invalidate();
			startTransition(() => {
				router.push("/inventory/stock-transaction/purchase-receipt");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updatePurchaseReceipt.useMutation({
		onSuccess: async () => {
			toast.success("Purchase receipt updated successfully");
			await utils.inventory.listPurchaseReceipts.invalidate();
			startTransition(() => {
				router.push("/inventory/stock-transaction/purchase-receipt");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: PurchaseReceiptFormValues) => {
		const normalizedItems = values.items.map((item) => ({
			id: isEditMode ? item.id : undefined,
			itemCode: item.itemCode.trim(),
			itemName: item.itemName?.trim() || undefined,
			description: item.description?.trim() || undefined,
			acceptedQuantity: item.acceptedQuantity,
			rejectedQuantity: item.rejectedQuantity ?? 0,
			rate: item.rate ?? 0,
			uom: item.uom?.trim() || undefined,
			acceptedWarehouse: item.acceptedWarehouse?.trim() || undefined,
			rejectedWarehouse: item.rejectedWarehouse?.trim() || undefined,
		}));
		const normalizedTaxes = (values.taxes ?? []).map((tax) => ({
			id: isEditMode ? tax.id : undefined,
			type: tax.type.trim(),
			accountHead: tax.accountHead.trim(),
			taxRate: tax.taxRate ?? 0,
			amount: tax.amount,
		}));

		if (isEditMode && id) {
			updateMutation.mutate({
				id,
				seriesPattern: values.seriesPattern?.trim() || null,
				postingDate: values.postingDate ?? undefined,
				postingTime: values.postingTime?.trim() || null,
				editPostingDateTime: values.editPostingDateTime,
				supplier: values.supplier.trim() || undefined,
				company: values.company.trim() || undefined,
				status: values.status,
				isReturn: values.isReturn,
				applyPutawayRule: values.applyPutawayRule,
				supplierDeliveryNote: values.supplierDeliveryNote?.trim() || null,
				acceptedWarehouse: values.acceptedWarehouse?.trim() || null,
				rejectedWarehouse: values.rejectedWarehouse?.trim() || null,
				isSubcontracted: values.isSubcontracted,
				currency: values.currency?.trim() || null,
				priceList: values.priceList?.trim() || null,
				disableRoundedTotal: values.disableRoundedTotal,
				supplierAddress: values.supplierAddress?.trim() || null,
				contactPerson: values.contactPerson?.trim() || null,
				shippingAddressTemplate: values.shippingAddressTemplate?.trim() || null,
				companyTRN: values.companyTRN?.trim() || null,
				billingAddress: values.billingAddress?.trim() || null,
				terms: values.terms?.trim() || null,
				termsContent: values.termsContent?.trim() || null,
				letterHead: values.letterHead?.trim() || null,
				printHeading: values.printHeading?.trim() || null,
				groupSameItems: values.groupSameItems,
				permitNumber: values.permitNumber?.trim() || null,
				recoverableStandardRatedExpenses:
					values.recoverableStandardRatedExpenses ?? 0,
				reverseChargeApplicable: values.reverseChargeApplicable,
				transporterName: values.transporterName?.trim() || null,
				vehicleNumber: values.vehicleNumber?.trim() || null,
				vehicleDate: values.vehicleDate ?? null,
				instructions: values.instructions?.trim() || null,
				remarks: values.remarks?.trim() || null,
				isInternalSupplier: values.isInternalSupplier,
				items: normalizedItems,
				taxes: normalizedTaxes,
			});
			return;
		}

		const parsedCreate = Inventory.createPurchaseReceiptSchema.safeParse({
			...values,
			seriesPattern: values.seriesPattern?.trim() || undefined,
			postingTime: values.postingTime?.trim() || undefined,
			supplier: values.supplier.trim(),
			company: values.company.trim(),
			supplierDeliveryNote: values.supplierDeliveryNote?.trim() || undefined,
			acceptedWarehouse: values.acceptedWarehouse?.trim() || undefined,
			rejectedWarehouse: values.rejectedWarehouse?.trim() || undefined,
			currency: values.currency?.trim() || undefined,
			priceList: values.priceList?.trim() || undefined,
			supplierAddress: values.supplierAddress?.trim() || undefined,
			contactPerson: values.contactPerson?.trim() || undefined,
			shippingAddressTemplate:
				values.shippingAddressTemplate?.trim() || undefined,
			companyTRN: values.companyTRN?.trim() || undefined,
			billingAddress: values.billingAddress?.trim() || undefined,
			terms: values.terms?.trim() || undefined,
			termsContent: values.termsContent?.trim() || undefined,
			letterHead: values.letterHead?.trim() || undefined,
			printHeading: values.printHeading?.trim() || undefined,
			permitNumber: values.permitNumber?.trim() || undefined,
			transporterName: values.transporterName?.trim() || undefined,
			vehicleNumber: values.vehicleNumber?.trim() || undefined,
			instructions: values.instructions?.trim() || undefined,
			remarks: values.remarks?.trim() || undefined,
			items: normalizedItems,
			taxes: normalizedTaxes,
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

	const watchedPostingDate = useWatch({
		control: form.control,
		name: "postingDate",
	}) as Date | undefined;
	const watchedPostingTime = useWatch({
		control: form.control,
		name: "postingTime",
	});
	const watchedVehicleDate = useWatch({
		control: form.control,
		name: "vehicleDate",
	}) as Date | undefined;
	const watchedIsReturn = useWatch({ control: form.control, name: "isReturn" });
	const watchedDisableRoundedTotal = useWatch({
		control: form.control,
		name: "disableRoundedTotal",
	});
	const watchedStatus = useWatch({ control: form.control, name: "status" });
	const watchedReverseChargeApplicable = useWatch({
		control: form.control,
		name: "reverseChargeApplicable",
	});
	const watchedItems = useWatch({
		control: form.control,
		name: "items",
	});
	const watchedTaxes = useWatch({
		control: form.control,
		name: "taxes",
	});

	const totals = useMemo(() => {
		const sign = watchedIsReturn ? -1 : 1;
		const itemRows =
			watchedItems?.map((item) => {
				const acceptedQuantity = (item?.acceptedQuantity ?? 0) * sign;
				const rejectedQuantity = (item?.rejectedQuantity ?? 0) * sign;
				const rowQuantity = acceptedQuantity + rejectedQuantity;
				const rate = item?.rate ?? 0;
				const amount = rowQuantity * rate;
				return { acceptedQuantity, rejectedQuantity, rowQuantity, amount };
			}) ?? [];

		const totalAcceptedQuantity = itemRows.reduce(
			(sum, item) => sum + item.acceptedQuantity,
			0,
		);
		const totalRejectedQuantity = itemRows.reduce(
			(sum, item) => sum + item.rejectedQuantity,
			0,
		);
		const totalQuantity = itemRows.reduce(
			(sum, item) => sum + item.rowQuantity,
			0,
		);
		const totalAmount = itemRows.reduce((sum, item) => sum + item.amount, 0);

		let runningTaxTotal = totalAmount;
		const taxRows =
			watchedTaxes?.map((tax) => {
				const hasManualAmount =
					typeof tax?.amount === "number" && Number.isFinite(tax.amount);
				const computedAmount = hasManualAmount
					? (tax.amount ?? 0)
					: (totalAmount * (tax?.taxRate ?? 0)) / 100;
				runningTaxTotal += computedAmount;
				return {
					amount: computedAmount,
					total: runningTaxTotal,
				};
			}) ?? [];

		const taxesAndChargesAdded = taxRows.reduce(
			(sum, tax) => (tax.amount > 0 ? sum + tax.amount : sum),
			0,
		);
		const taxesAndChargesDeducted = taxRows.reduce(
			(sum, tax) => (tax.amount < 0 ? sum + Math.abs(tax.amount) : sum),
			0,
		);
		const totalTaxesAndCharges = taxRows.reduce(
			(sum, tax) => sum + tax.amount,
			0,
		);
		const grandTotal = totalAmount + totalTaxesAndCharges;
		const roundedTotal = watchedDisableRoundedTotal
			? grandTotal
			: Math.round(grandTotal);
		const roundingAdjustment = watchedDisableRoundedTotal
			? 0
			: roundedTotal - grandTotal;

		return {
			itemRows,
			taxRows,
			totalAcceptedQuantity,
			totalRejectedQuantity,
			totalQuantity,
			totalAmount,
			taxesAndChargesAdded,
			taxesAndChargesDeducted,
			totalTaxesAndCharges,
			grandTotal,
			roundingAdjustment,
			roundedTotal,
		};
	}, [watchedDisableRoundedTotal, watchedIsReturn, watchedItems, watchedTaxes]);

	if (isEditMode && isFetchingReceipt) {
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
							? (purchaseReceipt?.series ?? "Edit Purchase Receipt")
							: "New Purchase Receipt"}
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
							<TabsTrigger value="address-contact">
								Address &amp; Contact
							</TabsTrigger>
							<TabsTrigger value="terms">Terms</TabsTrigger>
							<TabsTrigger value="more-info">More Info</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent
						value="details"
						className="m-0 focus-visible:outline-none"
					>
						<div className="grid gap-6 px-5 pb-4 pt-5 md:grid-cols-3">
							{isEditMode && (
								<div className="space-y-2">
									<Label>Series</Label>
									<Input
										value={purchaseReceipt?.series ?? ""}
										readOnly
										className="bg-muted"
									/>
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="seriesPattern">Series</Label>
								<Select
									value={form.getValues("seriesPattern") ?? "MAT-PRE-.YYYY.-"}
									onValueChange={(value) =>
										form.setValue("seriesPattern", value, { shouldDirty: true })
									}
								>
									<SelectTrigger id="seriesPattern">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{SERIES_PATTERN_OPTIONS.map((pattern) => (
											<SelectItem key={pattern} value={pattern}>
												{pattern}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="postingDate">Date *</Label>
								<Input
									id="postingDate"
									type="date"
									value={toDateInputValue(watchedPostingDate)}
									onChange={(e) =>
										form.setValue(
											"postingDate",
											e.target.value ? new Date(e.target.value) : undefined,
											{ shouldDirty: true },
										)
									}
								/>
							</div>

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
								<Label htmlFor="supplier">Supplier *</Label>
								<Input id="supplier" {...form.register("supplier")} />
								{form.formState.errors.supplier && (
									<p className="text-xs text-destructive">
										{form.formState.errors.supplier.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="postingTime">Posting Time *</Label>
								<Input
									id="postingTime"
									type="time"
									step="1"
									value={toTimeInputValue(watchedPostingTime)}
									onChange={(e) =>
										form.setValue("postingTime", e.target.value, {
											shouldDirty: true,
										})
									}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="supplierDeliveryNote">
									Supplier Delivery Note
								</Label>
								<Input
									id="supplierDeliveryNote"
									{...form.register("supplierDeliveryNote")}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="acceptedWarehouse">Accepted Warehouse</Label>
								<Input
									id="acceptedWarehouse"
									{...form.register("acceptedWarehouse")}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="rejectedWarehouse">Rejected Warehouse</Label>
								<Input
									id="rejectedWarehouse"
									{...form.register("rejectedWarehouse")}
								/>
							</div>

							<div className="flex items-center gap-2 pt-6">
								<Checkbox
									id="applyPutawayRule"
									checked={form.getValues("applyPutawayRule")}
									onCheckedChange={(checked) =>
										form.setValue("applyPutawayRule", checked === true, {
											shouldDirty: true,
										})
									}
								/>
								<Label htmlFor="applyPutawayRule">Apply Putaway Rule</Label>
							</div>

							<div className="flex items-center gap-2 pt-6">
								<Checkbox
									id="isReturn"
									checked={watchedIsReturn}
									onCheckedChange={(checked) =>
										form.setValue("isReturn", checked === true, {
											shouldDirty: true,
										})
									}
								/>
								<Label htmlFor="isReturn">Is Return</Label>
							</div>

							<div className="flex items-center gap-2 pt-6">
								<Checkbox
									id="editPostingDateTime"
									checked={form.getValues("editPostingDateTime")}
									onCheckedChange={(checked) =>
										form.setValue("editPostingDateTime", checked === true, {
											shouldDirty: true,
										})
									}
								/>
								<Label htmlFor="editPostingDateTime">
									Edit Posting Date and Time
								</Label>
							</div>

							<div className="flex items-center gap-2 pt-6">
								<Checkbox
									id="isSubcontracted"
									checked={form.getValues("isSubcontracted")}
									onCheckedChange={(checked) =>
										form.setValue("isSubcontracted", checked === true, {
											shouldDirty: true,
										})
									}
								/>
								<Label htmlFor="isSubcontracted">Is Subcontracted</Label>
							</div>
						</div>

						<div className="space-y-4 border-t px-5 py-4">
							<h2 className="text-xl font-semibold">Items</h2>
							<div className="overflow-x-auto rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-10" />
											<TableHead className="w-12">No.</TableHead>
											<TableHead>Item Code *</TableHead>
											<TableHead>Item Name</TableHead>
											<TableHead className="w-28">Accepted Qty *</TableHead>
											<TableHead className="w-28">Rejected Qty</TableHead>
											<TableHead className="w-32">Rate</TableHead>
											<TableHead className="w-32">Amount</TableHead>
											<TableHead className="w-24">UOM</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{itemFields.map((field, index) => {
											const row = totals.itemRows[index];
											return (
												<TableRow key={field.id}>
													<TableCell>
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="h-7 w-7"
															onClick={() => removeItem(index)}
															disabled={itemFields.length === 1}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</TableCell>
													<TableCell>{index + 1}</TableCell>
													<TableCell>
														<Input
															className="h-9"
															placeholder="Item code"
															{...form.register(`items.${index}.itemCode`)}
														/>
													</TableCell>
													<TableCell>
														<Input
															className="h-9"
															placeholder="Item name"
															{...form.register(`items.${index}.itemName`)}
														/>
													</TableCell>
													<TableCell>
														<Controller
															name={`items.${index}.acceptedQuantity`}
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
															name={`items.${index}.rejectedQuantity`}
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
															name={`items.${index}.rate`}
															control={form.control}
															render={({ field: f }) => (
																<Input
																	type="number"
																	step="0.01"
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
														<Input
															className="h-9 bg-muted"
															readOnly
															tabIndex={-1}
															value={(row?.amount ?? 0).toFixed(2)}
														/>
													</TableCell>
													<TableCell>
														<Input
															className="h-9"
															placeholder="Nos"
															{...form.register(`items.${index}.uom`)}
														/>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>

							<Button
								type="button"
								variant="outline"
								onClick={() =>
									appendItem({
										itemCode: "",
										itemName: "",
										description: "",
										acceptedQuantity: 1,
										rejectedQuantity: 0,
										rate: 0,
										uom: "",
										acceptedWarehouse: "",
										rejectedWarehouse: "",
									})
								}
							>
								<Plus className="mr-1.5 h-4 w-4" />
								Add Row
							</Button>

							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label>Total Quantity</Label>
									<Input
										value={totals.totalQuantity.toFixed(3)}
										readOnly
										className="bg-muted"
									/>
								</div>
								<div className="space-y-2">
									<Label>Total ({form.getValues("currency") || "INR"})</Label>
									<Input
										value={totals.totalAmount.toFixed(2)}
										readOnly
										className="bg-muted"
									/>
								</div>
							</div>
						</div>

						<div className="space-y-4 border-t px-5 py-4">
							<h2 className="text-xl font-semibold">Taxes and Charges</h2>
							<div className="overflow-x-auto rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-10" />
											<TableHead className="w-12">No.</TableHead>
											<TableHead>Type *</TableHead>
											<TableHead>Account Head *</TableHead>
											<TableHead className="w-28">Tax Rate</TableHead>
											<TableHead className="w-28">Amount</TableHead>
											<TableHead className="w-28">Total</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{taxFields.length === 0 && (
											<TableRow>
												<TableCell
													colSpan={7}
													className="text-center text-muted-foreground"
												>
													No tax rows
												</TableCell>
											</TableRow>
										)}
										{taxFields.map((field, index) => (
											<TableRow key={field.id}>
												<TableCell>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="h-7 w-7"
														onClick={() => removeTax(index)}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</TableCell>
												<TableCell>{index + 1}</TableCell>
												<TableCell>
													<Input
														className="h-9"
														placeholder="On Net Total"
														{...form.register(`taxes.${index}.type`)}
													/>
												</TableCell>
												<TableCell>
													<Input
														className="h-9"
														placeholder="VAT 5%"
														{...form.register(`taxes.${index}.accountHead`)}
													/>
												</TableCell>
												<TableCell>
													<Controller
														name={`taxes.${index}.taxRate`}
														control={form.control}
														render={({ field: f }) => (
															<Input
																type="number"
																step="0.01"
																className="h-9"
																value={f.value}
																onChange={(e) =>
																	f.onChange(Number(e.target.value) || 0)
																}
															/>
														)}
													/>
												</TableCell>
												<TableCell>
													<Controller
														name={`taxes.${index}.amount`}
														control={form.control}
														render={({ field: f }) => (
															<Input
																type="number"
																step="0.01"
																className="h-9"
																value={f.value ?? ""}
																onChange={(e) =>
																	f.onChange(
																		e.target.value === ""
																			? undefined
																			: Number(e.target.value),
																	)
																}
															/>
														)}
													/>
												</TableCell>
												<TableCell>
													<Input
														className="h-9 bg-muted"
														readOnly
														tabIndex={-1}
														value={(totals.taxRows[index]?.total ?? 0).toFixed(
															2,
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
								onClick={() =>
									appendTax({
										type: "",
										accountHead: "",
										taxRate: 0,
									})
								}
							>
								<Plus className="mr-1.5 h-4 w-4" />
								Add Tax Row
							</Button>

							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label>Taxes and Charges Added</Label>
									<Input
										value={totals.taxesAndChargesAdded.toFixed(2)}
										readOnly
										className="bg-muted"
									/>
								</div>
								<div className="space-y-2">
									<Label>Taxes and Charges Deducted</Label>
									<Input
										value={totals.taxesAndChargesDeducted.toFixed(2)}
										readOnly
										className="bg-muted"
									/>
								</div>
								<div className="space-y-2">
									<Label>Total Taxes and Charges</Label>
									<Input
										value={totals.totalTaxesAndCharges.toFixed(2)}
										readOnly
										className="bg-muted"
									/>
								</div>
							</div>
						</div>

						<div className="space-y-3 border-t px-5 py-4">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label>Grand Total</Label>
									<Input
										value={formatCurrency(
											totals.grandTotal,
											form.getValues("currency"),
										)}
										readOnly
										className="bg-muted"
									/>
								</div>
								<div className="space-y-2">
									<Label>Rounding Adjustment</Label>
									<Input
										value={totals.roundingAdjustment.toFixed(2)}
										readOnly
										className="bg-muted"
									/>
								</div>
								<div className="space-y-2">
									<Label>Rounded Total</Label>
									<Input
										value={formatCurrency(
											totals.roundedTotal,
											form.getValues("currency"),
										)}
										readOnly
										className="bg-muted"
									/>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<Checkbox
									id="disableRoundedTotal"
									checked={watchedDisableRoundedTotal}
									onCheckedChange={(checked) =>
										form.setValue("disableRoundedTotal", checked === true, {
											shouldDirty: true,
										})
									}
								/>
								<Label htmlFor="disableRoundedTotal">
									Disable Rounded Total
								</Label>
							</div>
						</div>
					</TabsContent>

					<TabsContent
						value="address-contact"
						className="m-0 focus-visible:outline-none"
					>
						<div className="grid gap-6 px-5 py-5 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="supplierAddress">Supplier Address</Label>
								<Input
									id="supplierAddress"
									{...form.register("supplierAddress")}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="contactPerson">Contact Person</Label>
								<Input id="contactPerson" {...form.register("contactPerson")} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="shippingAddressTemplate">
									Shipping Address Template
								</Label>
								<Input
									id="shippingAddressTemplate"
									{...form.register("shippingAddressTemplate")}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="companyTRN">Company TRN</Label>
								<Input id="companyTRN" {...form.register("companyTRN")} />
							</div>
							<div className="space-y-2 md:col-span-2">
								<Label htmlFor="billingAddress">Billing Address</Label>
								<Input
									id="billingAddress"
									{...form.register("billingAddress")}
								/>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="terms" className="m-0 focus-visible:outline-none">
						<div className="space-y-6 px-5 py-5">
							<div className="space-y-2">
								<Label htmlFor="terms">Terms</Label>
								<Input id="terms" {...form.register("terms")} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="termsContent">Terms and Conditions</Label>
								<Textarea
									id="termsContent"
									rows={8}
									{...form.register("termsContent")}
								/>
							</div>
						</div>
					</TabsContent>

					<TabsContent
						value="more-info"
						className="m-0 focus-visible:outline-none"
					>
						<div className="space-y-8 px-5 py-5">
							<div>
								<h2 className="mb-4 text-base font-semibold text-muted-foreground uppercase tracking-wide">
									Status
								</h2>
								<div className="space-y-2 md:max-w-sm">
									<Label htmlFor="status">Status</Label>
									<Select
										value={watchedStatus}
										onValueChange={(value: Inventory.PurchaseReceiptStatus) =>
											form.setValue("status", value, { shouldDirty: true })
										}
									>
										<SelectTrigger id="status">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{PURCHASE_RECEIPT_STATUS_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							<div>
								<h2 className="mb-4 text-base font-semibold text-muted-foreground uppercase tracking-wide">
									Printing Settings
								</h2>
								<div className="grid gap-6 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="letterHead">Letter Head</Label>
										<Input id="letterHead" {...form.register("letterHead")} />
									</div>
									<div className="space-y-2">
										<Label htmlFor="printHeading">Print Heading</Label>
										<Input
											id="printHeading"
											{...form.register("printHeading")}
										/>
									</div>
									<div className="flex items-center gap-2">
										<Checkbox
											id="groupSameItems"
											checked={form.getValues("groupSameItems")}
											onCheckedChange={(checked) =>
												form.setValue("groupSameItems", checked === true, {
													shouldDirty: true,
												})
											}
										/>
										<Label htmlFor="groupSameItems">Group same items</Label>
									</div>
								</div>
							</div>

							<div>
								<h2 className="mb-4 text-base font-semibold text-muted-foreground uppercase tracking-wide">
									VAT Details
								</h2>
								<div className="grid gap-6 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="permitNumber">Permit Number</Label>
										<Input
											id="permitNumber"
											{...form.register("permitNumber")}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="recoverableStandardRatedExpenses">
											Recoverable Standard Rated Expenses
										</Label>
										<Controller
											name="recoverableStandardRatedExpenses"
											control={form.control}
											render={({ field: f }) => (
												<Input
													id="recoverableStandardRatedExpenses"
													type="number"
													step="0.01"
													min="0"
													value={f.value}
													onChange={(e) =>
														f.onChange(Math.max(0, Number(e.target.value) || 0))
													}
												/>
											)}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="reverseChargeApplicable">
											Reverse Charge Applicable
										</Label>
										<Select
											value={watchedReverseChargeApplicable}
											onValueChange={(value: "Y" | "N") =>
												form.setValue("reverseChargeApplicable", value, {
													shouldDirty: true,
												})
											}
										>
											<SelectTrigger id="reverseChargeApplicable">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="N">N</SelectItem>
												<SelectItem value="Y">Y</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							</div>

							<div>
								<h2 className="mb-4 text-base font-semibold text-muted-foreground uppercase tracking-wide">
									Transporter
								</h2>
								<div className="grid gap-6 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="transporterName">Transporter Name</Label>
										<Input
											id="transporterName"
											{...form.register("transporterName")}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="vehicleNumber">Vehicle Number</Label>
										<Input
											id="vehicleNumber"
											{...form.register("vehicleNumber")}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="vehicleDate">Vehicle Date</Label>
										<Input
											id="vehicleDate"
											type="date"
											value={toDateInputValue(watchedVehicleDate)}
											onChange={(e) =>
												form.setValue(
													"vehicleDate",
													e.target.value ? new Date(e.target.value) : undefined,
													{ shouldDirty: true },
												)
											}
										/>
									</div>
								</div>
							</div>

							<div>
								<h2 className="mb-4 text-base font-semibold text-muted-foreground uppercase tracking-wide">
									Additional Info
								</h2>
								<div className="grid gap-6 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="instructions">Instructions</Label>
										<Textarea
											id="instructions"
											rows={5}
											{...form.register("instructions")}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="remarks">Remarks</Label>
										<Textarea
											id="remarks"
											rows={5}
											{...form.register("remarks")}
										/>
									</div>
									<div className="flex items-center gap-2">
										<Checkbox
											id="isInternalSupplier"
											checked={form.getValues("isInternalSupplier")}
											onCheckedChange={(checked) =>
												form.setValue("isInternalSupplier", checked === true, {
													shouldDirty: true,
												})
											}
										/>
										<Label htmlFor="isInternalSupplier">
											Is Internal Supplier
										</Label>
									</div>
								</div>
							</div>
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

function PurchaseReceiptFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
