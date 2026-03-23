"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type DeliveryNoteFormValues = Omit<
	z.input<typeof Inventory.createDeliveryNoteSchema>,
	"items"
> & {
	items: Array<
		z.input<typeof Inventory.createDeliveryNoteItemSchema> & { id?: string }
	>;
};

/**
 * Formats a Date (or tRPC-serialised date string) to yyyy-MM-dd for `<input type="date">`.
 *
 * @param date - A `Date` object, an ISO string, `undefined`, or `null`.
 * @returns An `"YYYY-MM-DD"` string, or `""` when the input is falsy or invalid.
 */
function toDateInputValue(date: Date | string | undefined | null): string {
	if (!date) return "";
	const d = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(d.getTime())) return "";
	return d.toISOString().split("T")[0] ?? "";
}

/**
 * DeliveryNoteFormPage — wraps the form content in a `Suspense` boundary so
 * that `useSearchParams()` inside `DeliveryNoteFormContent` does not block the
 * initial render. Client component.
 */
export default function DeliveryNoteFormPage() {
	return (
		<Suspense fallback={<DeliveryNoteFormFallback />}>
			<DeliveryNoteFormContent />
		</Suspense>
	);
}

/**
 * Internal form component that reads the `?id=` search param to determine
 * whether it is in create or edit mode. Handles data-fetching, form state
 * (react-hook-form + Zod), submit, and unsaved-changes tracking.
 *
 * Client component: uses hooks and browser APIs.
 */
function DeliveryNoteFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const [isInitialized, setIsInitialized] = useState(!isEditMode);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<DeliveryNoteFormValues>({
		resolver: zodResolver(Inventory.createDeliveryNoteSchema),
		defaultValues: {
			customer: "",
			company: "",
			postingDate: new Date(),
			isReturn: false,
			currency: "",
			priceList: "",
			sourceWarehouse: "",
			additionalDiscountOn: "",
			additionalDiscountPercent: 0,
			additionalDiscountAmount: 0,
			shippingAddress: "",
			dispatchAddress: "",
			companyAddress: "",
			companyContact: "",
			companyTRN: "",
			terms: "",
			termsContent: "",
			transporter: "",
			driverName: "",
			driver: "",
			transportReceiptNo: "",
			vehicleNo: "",
			customerPoNo: "",
			salesPartner: "",
			commissionRate: 0,
			letterHead: "",
			printHeading: "",
			printWithoutAmount: false,
			groupSameItems: false,
			permitNumber: "",
			vatEmirate: "",
			project: "",
			items: [
				{
					itemCode: "",
					itemName: "",
					description: "",
					quantity: 1,
					uom: "",
					rate: 0,
					warehouse: "",
				},
			],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "items",
	});

	const { data: deliveryNote, isLoading: isFetchingNote } =
		trpc.inventory.getDeliveryNoteById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	useEffect(() => {
		if (!isInitialized) return;
		const subscription = form.watch(() => {
			setHasUnsavedChanges(true);
		});
		return () => subscription.unsubscribe();
	}, [isInitialized, form.watch]);

	useEffect(() => {
		if (isEditMode && deliveryNote) {
			form.reset({
				customer: deliveryNote.customer,
				company: deliveryNote.company,
				postingDate: new Date(deliveryNote.postingDate),
				isReturn: deliveryNote.isReturn,
				currency: deliveryNote.currency ?? "",
				priceList: deliveryNote.priceList ?? "",
				sourceWarehouse: deliveryNote.sourceWarehouse ?? "",
				additionalDiscountOn: deliveryNote.additionalDiscountOn ?? "",
				additionalDiscountPercent: deliveryNote.additionalDiscountPercent ?? 0,
				additionalDiscountAmount: deliveryNote.additionalDiscountAmount ?? 0,
				shippingAddress: deliveryNote.shippingAddress ?? "",
				dispatchAddress: deliveryNote.dispatchAddress ?? "",
				companyAddress: deliveryNote.companyAddress ?? "",
				companyContact: deliveryNote.companyContact ?? "",
				companyTRN: deliveryNote.companyTRN ?? "",
				terms: deliveryNote.terms ?? "",
				termsContent: deliveryNote.termsContent ?? "",
				transporter: deliveryNote.transporter ?? "",
				driverName: deliveryNote.driverName ?? "",
				driver: deliveryNote.driver ?? "",
				transportReceiptDate: deliveryNote.transportReceiptDate
					? new Date(deliveryNote.transportReceiptDate)
					: undefined,
				transportReceiptNo: deliveryNote.transportReceiptNo ?? "",
				vehicleNo: deliveryNote.vehicleNo ?? "",
				customerPoNo: deliveryNote.customerPoNo ?? "",
				customerPoDate: deliveryNote.customerPoDate
					? new Date(deliveryNote.customerPoDate)
					: undefined,
				salesPartner: deliveryNote.salesPartner ?? "",
				commissionRate: deliveryNote.commissionRate ?? 0,
				letterHead: deliveryNote.letterHead ?? "",
				printHeading: deliveryNote.printHeading ?? "",
				printWithoutAmount: deliveryNote.printWithoutAmount,
				groupSameItems: deliveryNote.groupSameItems,
				permitNumber: deliveryNote.permitNumber ?? "",
				vatEmirate: deliveryNote.vatEmirate ?? "",
				project: deliveryNote.project ?? "",
				items:
					deliveryNote.items.length > 0
						? deliveryNote.items.map((item) => ({
								id: item.id,
								itemCode: item.itemCode,
								itemName: item.itemName ?? "",
								description: item.description ?? "",
								quantity: item.quantity,
								uom: item.uom ?? "",
								rate: item.rate ?? 0,
								warehouse: item.warehouse ?? "",
							}))
						: [
								{
									itemCode: "",
									itemName: "",
									description: "",
									quantity: 1,
									uom: "",
									rate: 0,
									warehouse: "",
								},
							],
			});
			setHasUnsavedChanges(false);
			setIsInitialized(true);
		}
	}, [form, isEditMode, deliveryNote]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingNote &&
			!deliveryNote &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Delivery note not found");
			startTransition(() => {
				router.push("/inventory/stock-transaction/delivery-note");
			});
		}
	}, [isEditMode, isFetchingNote, deliveryNote, router]);

	const createMutation = trpc.inventory.createDeliveryNote.useMutation({
		onSuccess: async () => {
			toast.success("Delivery note created successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listDeliveryNotes.invalidate();
			startTransition(() => {
				router.push("/inventory/stock-transaction/delivery-note");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateDeliveryNote.useMutation({
		onSuccess: async () => {
			toast.success("Delivery note updated successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listDeliveryNotes.invalidate();
			startTransition(() => {
				router.push("/inventory/stock-transaction/delivery-note");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: DeliveryNoteFormValues) => {
		const normalizedItems = values.items.map((item) => ({
			id: isEditMode ? item.id : undefined,
			itemCode: item.itemCode.trim(),
			itemName: item.itemName?.trim() || undefined,
			description: item.description?.trim() || undefined,
			quantity: item.quantity,
			uom: item.uom?.trim() || undefined,
			rate: item.rate ?? 0,
			warehouse: item.warehouse?.trim() || undefined,
		}));

		if (isEditMode && id) {
			updateMutation.mutate({
				id,
				customer: values.customer?.trim() || undefined,
				company: values.company?.trim() || undefined,
				postingDate: values.postingDate ?? undefined,
				isReturn: values.isReturn,
				currency: values.currency?.trim() || null,
				priceList: values.priceList?.trim() || null,
				sourceWarehouse: values.sourceWarehouse?.trim() || null,
				additionalDiscountOn: values.additionalDiscountOn?.trim() || null,
				additionalDiscountPercent: values.additionalDiscountPercent ?? null,
				additionalDiscountAmount: values.additionalDiscountAmount ?? null,
				shippingAddress: values.shippingAddress?.trim() || null,
				dispatchAddress: values.dispatchAddress?.trim() || null,
				companyAddress: values.companyAddress?.trim() || null,
				companyContact: values.companyContact?.trim() || null,
				companyTRN: values.companyTRN?.trim() || null,
				terms: values.terms?.trim() || null,
				termsContent: values.termsContent?.trim() || null,
				transporter: values.transporter?.trim() || null,
				driverName: values.driverName?.trim() || null,
				driver: values.driver?.trim() || null,
				transportReceiptDate: values.transportReceiptDate ?? null,
				transportReceiptNo: values.transportReceiptNo?.trim() || null,
				vehicleNo: values.vehicleNo?.trim() || null,
				customerPoNo: values.customerPoNo?.trim() || null,
				customerPoDate: values.customerPoDate ?? null,
				salesPartner: values.salesPartner?.trim() || null,
				commissionRate: values.commissionRate ?? null,
				letterHead: values.letterHead?.trim() || null,
				printHeading: values.printHeading?.trim() || null,
				printWithoutAmount: values.printWithoutAmount,
				groupSameItems: values.groupSameItems,
				permitNumber: values.permitNumber?.trim() || null,
				vatEmirate: values.vatEmirate?.trim() || null,
				project: values.project?.trim() || null,
				items: normalizedItems,
			});
			return;
		}

		const parsedCreate = Inventory.createDeliveryNoteSchema.safeParse({
			...values,
			customer: values.customer.trim(),
			company: values.company.trim(),
			currency: values.currency?.trim() || undefined,
			priceList: values.priceList?.trim() || undefined,
			sourceWarehouse: values.sourceWarehouse?.trim() || undefined,
			additionalDiscountOn: values.additionalDiscountOn?.trim() || undefined,
			shippingAddress: values.shippingAddress?.trim() || undefined,
			dispatchAddress: values.dispatchAddress?.trim() || undefined,
			companyAddress: values.companyAddress?.trim() || undefined,
			companyContact: values.companyContact?.trim() || undefined,
			companyTRN: values.companyTRN?.trim() || undefined,
			terms: values.terms?.trim() || undefined,
			termsContent: values.termsContent?.trim() || undefined,
			transporter: values.transporter?.trim() || undefined,
			driverName: values.driverName?.trim() || undefined,
			driver: values.driver?.trim() || undefined,
			transportReceiptNo: values.transportReceiptNo?.trim() || undefined,
			vehicleNo: values.vehicleNo?.trim() || undefined,
			customerPoNo: values.customerPoNo?.trim() || undefined,
			salesPartner: values.salesPartner?.trim() || undefined,
			letterHead: values.letterHead?.trim() || undefined,
			printHeading: values.printHeading?.trim() || undefined,
			permitNumber: values.permitNumber?.trim() || undefined,
			vatEmirate: values.vatEmirate?.trim() || undefined,
			project: values.project?.trim() || undefined,
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

	const watchedPostingDate = useWatch({
		control: form.control,
		name: "postingDate",
	}) as Date | undefined;
	const watchedTransportReceiptDate = useWatch({
		control: form.control,
		name: "transportReceiptDate",
	}) as Date | undefined;
	const watchedCustomerPoDate = useWatch({
		control: form.control,
		name: "customerPoDate",
	}) as Date | undefined;
	const watchedIsReturn = useWatch({
		control: form.control,
		name: "isReturn",
	});
	const watchedPrintWithoutAmount = useWatch({
		control: form.control,
		name: "printWithoutAmount",
	});
	const watchedGroupSameItems = useWatch({
		control: form.control,
		name: "groupSameItems",
	});
	const watchedItems = useWatch({
		control: form.control,
		name: "items",
	});
	const watchedAdditionalDiscountPercent = useWatch({
		control: form.control,
		name: "additionalDiscountPercent",
	});
	const watchedAdditionalDiscountAmount = useWatch({
		control: form.control,
		name: "additionalDiscountAmount",
	});

	const totalBeforeDiscount = useMemo(() => {
		if (!watchedItems) return 0;
		return watchedItems.reduce((sum, item) => {
			const qty = item?.quantity ?? 0;
			const rate = item?.rate ?? 0;
			return sum + qty * rate;
		}, 0);
	}, [watchedItems]);

	const grandTotal = useMemo(() => {
		const discountAmount = watchedAdditionalDiscountAmount ?? 0;
		const discountPercent = watchedAdditionalDiscountPercent ?? 0;

		let total = totalBeforeDiscount;

		if (discountPercent) {
			total = totalBeforeDiscount * (1 - discountPercent / 100);
		} else if (discountAmount) {
			total = totalBeforeDiscount - discountAmount;
		}

		return Math.max(0, total);
	}, [
		totalBeforeDiscount,
		watchedAdditionalDiscountAmount,
		watchedAdditionalDiscountPercent,
	]);

	if (isEditMode && isFetchingNote) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col bg-[#f8f9fa] px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">
						{isEditMode
							? (deliveryNote?.series ?? "Edit Delivery Note")
							: "New Delivery Note"}
					</h1>
					{hasUnsavedChanges && (
						<Badge className="border-none bg-orange-50 text-orange-600 hover:bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400">
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

			<div className="rounded-lg border bg-white shadow-sm overflow-hidden">
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

					{/* ── Details Tab ───────────────────────────────────────────── */}
					<TabsContent
						value="details"
						className="m-0 focus-visible:outline-none"
					>
						<div className="grid gap-6 px-5 pt-5 pb-4 md:grid-cols-2">
							{/* Series (read-only in edit) */}
							{isEditMode && (
								<div className="space-y-2">
									<Label>Series</Label>
									<Input
										value={deliveryNote?.series ?? ""}
										readOnly
										className="bg-muted"
									/>
								</div>
							)}

							{/* Customer */}
							<div className="space-y-2">
								<Label htmlFor="customer">Customer *</Label>
								<Input
									id="customer"
									{...form.register("customer")}
									placeholder="Customer name"
								/>
								{form.formState.errors.customer && (
									<p className="text-xs text-destructive">
										{form.formState.errors.customer.message}
									</p>
								)}
							</div>

							{/* Company */}
							<div className="space-y-2">
								<Label htmlFor="company">Company *</Label>
								<Input
									id="company"
									{...form.register("company")}
									placeholder="Company name"
								/>
								{form.formState.errors.company && (
									<p className="text-xs text-destructive">
										{form.formState.errors.company.message}
									</p>
								)}
							</div>

							{/* Posting Date */}
							<div className="space-y-2">
								<Label htmlFor="postingDate">Posting Date</Label>
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

							{/* Currency */}
							<div className="space-y-2">
								<Label htmlFor="currency">Currency</Label>
								<Input
									id="currency"
									{...form.register("currency")}
									placeholder="e.g. USD"
								/>
							</div>

							{/* Price List */}
							<div className="space-y-2">
								<Label htmlFor="priceList">Price List</Label>
								<Input
									id="priceList"
									{...form.register("priceList")}
									placeholder="e.g. Standard Selling"
								/>
							</div>

							{/* Source Warehouse */}
							<div className="space-y-2">
								<Label htmlFor="sourceWarehouse">Set Source Warehouse</Label>
								<Input
									id="sourceWarehouse"
									{...form.register("sourceWarehouse")}
									placeholder="e.g. Main Warehouse"
								/>
							</div>

							{/* Is Return */}
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
								<Label htmlFor="isReturn" className="cursor-pointer">
									Is Return
								</Label>
							</div>
						</div>

						{/* Items Table */}
						<div className="space-y-4 border-t px-5 py-4">
							<div>
								<h2 className="text-xl font-semibold">Items</h2>
							</div>

							<div className="overflow-x-auto rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-10" />
											<TableHead className="w-12">No.</TableHead>
											<TableHead>Item Code *</TableHead>
											<TableHead>Item Name</TableHead>
											<TableHead>Description</TableHead>
											<TableHead className="w-28">Qty *</TableHead>
											<TableHead className="w-28">UOM</TableHead>
											<TableHead className="w-32">Rate</TableHead>
											<TableHead className="w-32">Amount</TableHead>
											<TableHead>Warehouse</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{fields.map((field, index) => {
											const qty = watchedItems?.[index]?.quantity ?? 0;
											const rate = watchedItems?.[index]?.rate ?? 0;
											const amount = qty * rate;

											return (
												<TableRow key={field.id}>
													<TableCell>
														<Button
															variant="ghost"
															size="icon"
															className="h-7 w-7"
															onClick={() => remove(index)}
															disabled={fields.length === 1}
															type="button"
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
														{form.formState.errors.items?.[index]?.itemCode && (
															<p className="mt-0.5 text-xs text-destructive">
																{
																	form.formState.errors.items[index].itemCode
																		?.message
																}
															</p>
														)}
													</TableCell>
													<TableCell>
														<Input
															className="h-9"
															placeholder="Item name"
															{...form.register(`items.${index}.itemName`)}
														/>
													</TableCell>
													<TableCell>
														<Input
															className="h-9"
															placeholder="Description"
															{...form.register(`items.${index}.description`)}
														/>
													</TableCell>
													<TableCell>
														<Controller
															name={`items.${index}.quantity`}
															control={form.control}
															render={({ field: f }) => (
																<Input
																	type="number"
																	step="0.001"
																	min="0.001"
																	className="h-9"
																	value={f.value}
																	onChange={(e) =>
																		f.onChange(
																			Math.max(
																				0.001,
																				Number(e.target.value) || 0.001,
																			),
																		)
																	}
																/>
															)}
														/>
													</TableCell>
													<TableCell>
														<Input
															className="h-9"
															placeholder="e.g. Nos"
															{...form.register(`items.${index}.uom`)}
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
															value={amount.toFixed(2)}
															tabIndex={-1}
														/>
													</TableCell>
													<TableCell>
														<Input
															className="h-9"
															placeholder="Warehouse"
															{...form.register(`items.${index}.warehouse`)}
														/>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>

							{form.formState.errors.items &&
								!Array.isArray(form.formState.errors.items) && (
									<p className="text-xs text-destructive">
										{form.formState.errors.items.message}
									</p>
								)}

							<Button
								type="button"
								variant="outline"
								onClick={() =>
									append({
										itemCode: "",
										itemName: "",
										description: "",
										quantity: 1,
										uom: "",
										rate: 0,
										warehouse: "",
									})
								}
							>
								<Plus className="mr-1.5 h-4 w-4" />
								Add Row
							</Button>
						</div>

						{/* Totals */}
						<div className="border-t px-5 py-4">
							<div className="ml-auto max-w-sm space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">
										Total Before Discount
									</span>
									<span className="tabular-nums">
										{totalBeforeDiscount.toFixed(2)}
									</span>
								</div>

								<div className="flex items-center gap-2">
									<span className="text-sm text-muted-foreground shrink-0">
										Discount %
									</span>
									<Controller
										name="additionalDiscountPercent"
										control={form.control}
										render={({ field: f }) => (
											<Input
												type="number"
												step="0.01"
												min="0"
												max="100"
												className="h-7 text-right text-sm"
												value={f.value ?? ""}
												onChange={(e) =>
													f.onChange(
														e.target.value === ""
															? undefined
															: Math.min(
																	100,
																	Math.max(0, Number(e.target.value)),
																),
													)
												}
											/>
										)}
									/>
								</div>

								<div className="flex items-center gap-2">
									<span className="text-sm text-muted-foreground shrink-0">
										Discount Amount
									</span>
									<Controller
										name="additionalDiscountAmount"
										control={form.control}
										render={({ field: f }) => (
											<Input
												type="number"
												step="0.01"
												min="0"
												className="h-7 text-right text-sm"
												value={f.value ?? ""}
												onChange={(e) =>
													f.onChange(
														e.target.value === ""
															? undefined
															: Math.max(0, Number(e.target.value)),
													)
												}
											/>
										)}
									/>
								</div>

								<div className="flex justify-between border-t pt-2 font-semibold">
									<span>Grand Total</span>
									<span className="tabular-nums">{grandTotal.toFixed(2)}</span>
								</div>
							</div>
						</div>
					</TabsContent>

					{/* ── Address & Contact Tab ─────────────────────────────────── */}
					<TabsContent
						value="address-contact"
						className="m-0 focus-visible:outline-none"
					>
						<div className="grid gap-6 px-5 py-5 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="shippingAddress">Shipping Address</Label>
								<Input
									id="shippingAddress"
									{...form.register("shippingAddress")}
									placeholder="Shipping address name"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="dispatchAddress">Dispatch Address</Label>
								<Input
									id="dispatchAddress"
									{...form.register("dispatchAddress")}
									placeholder="Dispatch address name"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="companyAddress">Company Address</Label>
								<Input
									id="companyAddress"
									{...form.register("companyAddress")}
									placeholder="Company address"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="companyContact">Company Contact</Label>
								<Input
									id="companyContact"
									{...form.register("companyContact")}
									placeholder="Contact person name"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="companyTRN">Company TRN</Label>
								<Input
									id="companyTRN"
									{...form.register("companyTRN")}
									placeholder="Tax registration number"
								/>
							</div>
						</div>
					</TabsContent>

					{/* ── Terms Tab ─────────────────────────────────────────────── */}
					<TabsContent value="terms" className="m-0 focus-visible:outline-none">
						<div className="px-5 py-5 space-y-6">
							<div>
								<h2 className="mb-4 text-base font-semibold text-muted-foreground uppercase tracking-wide">
									Payment Terms
								</h2>
								<div className="grid gap-6 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="terms">Payment Terms Template</Label>
										<Input
											id="terms"
											{...form.register("terms")}
											placeholder="Payment terms template"
										/>
									</div>

									<div className="md:col-span-2 space-y-2">
										<Label htmlFor="termsContent">Terms &amp; Conditions</Label>
										<Textarea
											id="termsContent"
											rows={5}
											{...form.register("termsContent")}
											placeholder="Enter terms and conditions..."
										/>
									</div>
								</div>
							</div>

							<div>
								<h2 className="mb-4 text-base font-semibold text-muted-foreground uppercase tracking-wide">
									Transporter Info
								</h2>
								<div className="grid gap-6 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="transporter">Transporter</Label>
										<Input
											id="transporter"
											{...form.register("transporter")}
											placeholder="Transporter name"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="driverName">Driver Name</Label>
										<Input
											id="driverName"
											{...form.register("driverName")}
											placeholder="Driver name"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="driver">Driver ID</Label>
										<Input
											id="driver"
											{...form.register("driver")}
											placeholder="Driver ID"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="vehicleNo">Vehicle No.</Label>
										<Input
											id="vehicleNo"
											{...form.register("vehicleNo")}
											placeholder="e.g. DL01AB1234"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="transportReceiptNo">
											Transport Receipt No.
										</Label>
										<Input
											id="transportReceiptNo"
											{...form.register("transportReceiptNo")}
											placeholder="Lorry receipt number"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="transportReceiptDate">
											Transport Receipt Date
										</Label>
										<Input
											id="transportReceiptDate"
											type="date"
											value={toDateInputValue(watchedTransportReceiptDate)}
											onChange={(e) =>
												form.setValue(
													"transportReceiptDate",
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
									Sales Partner &amp; Commission
								</h2>
								<div className="grid gap-6 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="salesPartner">Sales Partner</Label>
										<Input
											id="salesPartner"
											{...form.register("salesPartner")}
											placeholder="Sales partner name"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="commissionRate">Commission Rate (%)</Label>
										<Controller
											name="commissionRate"
											control={form.control}
											render={({ field: f }) => (
												<Input
													id="commissionRate"
													type="number"
													step="0.01"
													min="0"
													max="100"
													value={f.value ?? ""}
													onChange={(e) =>
														f.onChange(
															e.target.value === ""
																? undefined
																: Math.min(
																		100,
																		Math.max(0, Number(e.target.value)),
																	),
														)
													}
												/>
											)}
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="customerPoNo">Customer PO No.</Label>
										<Input
											id="customerPoNo"
											{...form.register("customerPoNo")}
											placeholder="Customer purchase order number"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="customerPoDate">Customer PO Date</Label>
										<Input
											id="customerPoDate"
											type="date"
											value={toDateInputValue(watchedCustomerPoDate)}
											onChange={(e) =>
												form.setValue(
													"customerPoDate",
													e.target.value ? new Date(e.target.value) : undefined,
													{ shouldDirty: true },
												)
											}
										/>
									</div>
								</div>
							</div>
						</div>
					</TabsContent>

					{/* ── More Info Tab ─────────────────────────────────────────── */}
					<TabsContent
						value="more-info"
						className="m-0 focus-visible:outline-none"
					>
						<div className="px-5 py-5 space-y-6">
							<div>
								<h2 className="mb-4 text-base font-semibold text-muted-foreground uppercase tracking-wide">
									Printing Details
								</h2>
								<div className="grid gap-6 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="letterHead">Letter Head</Label>
										<Input
											id="letterHead"
											{...form.register("letterHead")}
											placeholder="Letter head name"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="printHeading">Print Heading</Label>
										<Input
											id="printHeading"
											{...form.register("printHeading")}
											placeholder="Print heading"
										/>
									</div>

									<div className="flex items-center gap-2">
										<Checkbox
											id="printWithoutAmount"
											checked={watchedPrintWithoutAmount}
											onCheckedChange={(checked) =>
												form.setValue("printWithoutAmount", checked === true, {
													shouldDirty: true,
												})
											}
										/>
										<Label
											htmlFor="printWithoutAmount"
											className="cursor-pointer"
										>
											Print Without Amount
										</Label>
									</div>

									<div className="flex items-center gap-2">
										<Checkbox
											id="groupSameItems"
											checked={watchedGroupSameItems}
											onCheckedChange={(checked) =>
												form.setValue("groupSameItems", checked === true, {
													shouldDirty: true,
												})
											}
										/>
										<Label htmlFor="groupSameItems" className="cursor-pointer">
											Group Same Items
										</Label>
									</div>
								</div>
							</div>

							<div>
								<h2 className="mb-4 text-base font-semibold text-muted-foreground uppercase tracking-wide">
									More Information
								</h2>
								<div className="grid gap-6 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="project">Project</Label>
										<Input
											id="project"
											{...form.register("project")}
											placeholder="Project name or code"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="permitNumber">Permit Number</Label>
										<Input
											id="permitNumber"
											{...form.register("permitNumber")}
											placeholder="Permit number"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="vatEmirate">VAT Emirate</Label>
										<Input
											id="vatEmirate"
											{...form.register("vatEmirate")}
											placeholder="e.g. Dubai"
										/>
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

function DeliveryNoteFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
