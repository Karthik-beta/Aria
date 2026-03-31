"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import * as React from "react";
import {
	type Control,
	Controller,
	type FieldPath,
	type FieldValues,
	useForm,
	useWatch,
} from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import {
	type StockSettingsFormValues,
	stockSettingsFormSchema,
} from "./stock-settings.schema";
import {
	buildStockSettingsMutationInput,
	createStockSettingsFormValues,
	STOCK_SETTINGS_TABS,
} from "./stock-settings.utils";

type CheckboxFieldProps<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
> = {
	control: Control<TFieldValues>;
	name: TName;
	id: string;
	label: string;
	description?: string;
	className?: string;
};

function CheckboxField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	id,
	label,
	description,
	className,
}: CheckboxFieldProps<TFieldValues, TName>) {
	return (
		<Controller
			control={control}
			name={name}
			render={({ field }) => (
				<div className={className}>
					<div className="flex items-start gap-3">
						<Checkbox
							id={id}
							checked={Boolean(field.value)}
							onCheckedChange={(checked) => field.onChange(Boolean(checked))}
						/>
						<div className="space-y-1">
							<Label
								htmlFor={id}
								className="cursor-pointer text-sm font-medium"
							>
								{label}
							</Label>
							{description ? (
								<p className="text-sm text-muted-foreground">{description}</p>
							) : null}
						</div>
					</div>
				</div>
			)}
		/>
	);
}

function SettingsSection({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-4 px-5 py-5">
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">{title}</h2>
				{description ? (
					<p className="text-sm text-muted-foreground">{description}</p>
				) : null}
			</div>
			{children}
		</section>
	);
}

/**
 * StockSettingsPage renders the singleton inventory stock settings editor.
 */
export default function StockSettingsPage() {
	const utils = trpc.useUtils();

	const form = useForm<StockSettingsFormValues>({
		resolver: zodResolver(stockSettingsFormSchema),
		defaultValues: createStockSettingsFormValues(),
	});
	const hasUnsavedChanges = form.formState.isDirty;

	const selectedDefaultStockUom = useWatch({
		control: form.control,
		name: "defaultStockUom",
	});

	const {
		data: settings,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.getStockSettings.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
	});

	const { data: rawUnitsOfMeasure = [] } =
		trpc.inventory.listUnitsOfMeasure.useQuery(undefined, {
			refetchOnWindowFocus: false,
			staleTime: 30_000,
		});

	const defaultStockUomOptions = React.useMemo(() => {
		const options = rawUnitsOfMeasure
			.filter((unit) => !unit.disabled)
			.map((unit) => unit.name);

		if (selectedDefaultStockUom && !options.includes(selectedDefaultStockUom)) {
			return [selectedDefaultStockUom, ...options];
		}

		return options;
	}, [rawUnitsOfMeasure, selectedDefaultStockUom]);

	React.useEffect(() => {
		if (!settings || form.formState.isDirty) {
			return;
		}

		form.reset(createStockSettingsFormValues(settings));
	}, [form, settings]);

	const updateMutation = trpc.inventory.updateStockSettings.useMutation({
		onSuccess: async (updatedSettings) => {
			toast.success("Stock settings saved successfully");
			form.reset(createStockSettingsFormValues(updatedSettings));
			await utils.inventory.getStockSettings.invalidate();
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: StockSettingsFormValues) => {
		const payload = buildStockSettingsMutationInput(values);
		const parsed = Inventory.updateStockSettingsSchema.safeParse(payload);

		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Invalid stock settings");
			return;
		}

		updateMutation.mutate(parsed.data);
	};

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	if (queryError) {
		return (
			<div className="container mx-auto py-6">
				<ErrorState
					error={queryError}
					operation="load"
					title="Failed to load stock settings"
					onRetry={() => void refetch()}
				/>
			</div>
		);
	}

	const isSubmitting = updateMutation.isPending;

	return (
		<div className="flex min-h-screen flex-col bg-[#f8f9fa] px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-3xl font-bold tracking-tight">
							Stock Settings
						</h1>
						{hasUnsavedChanges ? (
							<Badge className="border-none bg-orange-50 text-orange-600 hover:bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400">
								Not Saved
							</Badge>
						) : null}
					</div>
					<p className="text-sm text-muted-foreground">
						Manage inventory-wide defaults, validation rules, reservation
						behavior, and stock planning controls from a single settings record.
					</p>
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
				<Tabs defaultValue="defaults" className="w-full">
					<div className="overflow-x-auto border-b px-5 py-3">
						<TabsList className="h-auto w-max min-w-full justify-start gap-2 rounded-none bg-transparent p-0">
							{STOCK_SETTINGS_TABS.map((tab) => (
								<TabsTrigger
									key={tab.value}
									value={tab.value}
									className="rounded-md px-3 py-1.5 data-[state=active]:bg-muted"
								>
									{tab.label}
								</TabsTrigger>
							))}
						</TabsList>
					</div>

					<TabsContent
						value="defaults"
						className="m-0 focus-visible:outline-none"
					>
						<SettingsSection title="Item Defaults">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="itemNamingBy">Item Naming By</Label>
									<select
										id="itemNamingBy"
										{...form.register("itemNamingBy")}
										className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									>
										<option value="ITEM_CODE">Item Code</option>
										<option value="NAMING_SERIES">Naming Series</option>
									</select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="defaultWarehouse">Default Warehouse</Label>
									<Input
										id="defaultWarehouse"
										{...form.register("defaultWarehouse")}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="defaultValuationMethod">
										Default Valuation Method
									</Label>
									<select
										id="defaultValuationMethod"
										{...form.register("defaultValuationMethod")}
										className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									>
										<option value="FIFO">FIFO</option>
										<option value="MOVING_AVERAGE">Moving Average</option>
									</select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="defaultStockUom">Default Stock UOM</Label>
									<select
										id="defaultStockUom"
										{...form.register("defaultStockUom")}
										className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									>
										<option value="">No default stock UOM</option>
										{defaultStockUomOptions.map((unit) => (
											<option key={unit} value={unit}>
												{unit}
											</option>
										))}
									</select>
								</div>
							</div>
						</SettingsSection>

						<div className="border-t" />
						<SettingsSection title="Price List Defaults">
							<div className="grid gap-4 md:grid-cols-2">
								<CheckboxField
									control={form.control}
									name="autoInsertItemPriceIfMissing"
									id="autoInsertItemPriceIfMissing"
									label="Auto Insert Item Price If Missing"
								/>
								<CheckboxField
									control={form.control}
									name="updateExistingPriceListRate"
									id="updateExistingPriceListRate"
									label="Update Existing Price List Rate"
								/>
							</div>
						</SettingsSection>

						<div className="border-t" />
						<SettingsSection title="Stock UOM Quantity">
							<div className="grid gap-4 md:grid-cols-2">
								<CheckboxField
									control={form.control}
									name="allowToEditStockUomQtyForSalesDocuments"
									id="allowToEditStockUomQtyForSalesDocuments"
									label="Allow to Edit Stock UOM Qty for Sales Documents"
								/>
								<CheckboxField
									control={form.control}
									name="allowToEditStockUomQtyForPurchaseDocuments"
									id="allowToEditStockUomQtyForPurchaseDocuments"
									label="Allow to Edit Stock UOM Qty for Purchase Documents"
								/>
							</div>
						</SettingsSection>
					</TabsContent>

					<TabsContent
						value="stock-validations"
						className="m-0 focus-visible:outline-none"
					>
						<SettingsSection title="Stock Transactions Settings">
							<div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
								<div className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="overDeliveryReceiptAllowancePercent">
											Over Delivery/Receipt Allowance (%)
										</Label>
										<Input
											id="overDeliveryReceiptAllowancePercent"
											type="number"
											step="0.01"
											min={0}
											max={100}
											{...form.register("overDeliveryReceiptAllowancePercent", {
												valueAsNumber: true,
											})}
										/>
										<p className="text-sm text-muted-foreground">
											Defines how much extra quantity can be received or
											delivered against the ordered quantity.
										</p>
									</div>

									<div className="space-y-2">
										<Label htmlFor="overTransferAllowancePercent">
											Over Transfer Allowance (%)
										</Label>
										<Input
											id="overTransferAllowancePercent"
											type="number"
											step="0.01"
											min={0}
											max={100}
											{...form.register("overTransferAllowancePercent", {
												valueAsNumber: true,
											})}
										/>
										<p className="text-sm text-muted-foreground">
											Controls how much inventory can be transferred above the
											requested quantity.
										</p>
									</div>

									<div className="space-y-2">
										<Label htmlFor="overPickingAllowancePercent">
											Over Picking Allowance (%)
										</Label>
										<Input
											id="overPickingAllowancePercent"
											type="number"
											step="0.01"
											min={0}
											max={100}
											{...form.register("overPickingAllowancePercent", {
												valueAsNumber: true,
											})}
										/>
										<p className="text-sm text-muted-foreground">
											Allows pick lists to exceed ordered quantities within a
											controlled percentage.
										</p>
									</div>
								</div>

								<div className="space-y-4">
									<CheckboxField
										control={form.control}
										name="allowNegativeStock"
										id="allowNegativeStock"
										label="Allow Negative Stock"
									/>
									<CheckboxField
										control={form.control}
										name="showBarcodeFieldInStockTransactions"
										id="showBarcodeFieldInStockTransactions"
										label="Show Barcode Field in Stock Transactions"
									/>
									<CheckboxField
										control={form.control}
										name="convertItemDescriptionToCleanHtmlInTransactions"
										id="convertItemDescriptionToCleanHtmlInTransactions"
										label="Convert Item Description to Clean HTML in Transactions"
									/>
									<CheckboxField
										control={form.control}
										name="allowInternalTransfersAtArmsLengthPrice"
										id="allowInternalTransfersAtArmsLengthPrice"
										label="Allow Internal Transfers at Arm's Length Price"
										description="Preserves the transaction rate during internal transfers while accounting continues to use valuation rates."
									/>
								</div>
							</div>
						</SettingsSection>

						<div className="border-t" />
						<SettingsSection title="Quality Inspection Settings">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="actionIfQualityInspectionIsNotSubmitted">
										Action If Quality Inspection Is Not Submitted
									</Label>
									<select
										id="actionIfQualityInspectionIsNotSubmitted"
										{...form.register(
											"actionIfQualityInspectionIsNotSubmitted",
										)}
										className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									>
										<option value="STOP">Stop</option>
										<option value="WARN">Warn</option>
									</select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="actionIfQualityInspectionIsRejected">
										Action If Quality Inspection Is Rejected
									</Label>
									<select
										id="actionIfQualityInspectionIsRejected"
										{...form.register("actionIfQualityInspectionIsRejected")}
										className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									>
										<option value="STOP">Stop</option>
										<option value="WARN">Warn</option>
									</select>
								</div>
							</div>
						</SettingsSection>
					</TabsContent>

					<TabsContent
						value="stock-reservation"
						className="m-0 focus-visible:outline-none"
					>
						<SettingsSection title="Stock Reservation">
							<div className="grid gap-4 md:grid-cols-2">
								<CheckboxField
									control={form.control}
									name="enableStockReservation"
									id="enableStockReservation"
									label="Enable Stock Reservation"
									description="Keeps specific inventory quantities reserved for particular orders."
								/>
								<div className="space-y-4">
									<CheckboxField
										control={form.control}
										name="allowPartialReservation"
										id="allowPartialReservation"
										label="Allow Partial Reservation"
									/>
									<CheckboxField
										control={form.control}
										name="autoReserveStockForSalesOrderOnPurchase"
										id="autoReserveStockForSalesOrderOnPurchase"
										label="Auto Reserve Stock for Sales Order on Purchase"
										description="Reserves freshly received stock for linked sales order demand after purchase receipt submission."
									/>
								</div>
							</div>
						</SettingsSection>

						<div className="border-t" />
						<SettingsSection title="Serial and Batch Reservation">
							<CheckboxField
								control={form.control}
								name="autoReserveSerialAndBatchNos"
								id="autoReserveSerialAndBatchNos"
								label="Auto Reserve Serial and Batch Nos"
								description="Automatically reserves serial and batch numbers using the configured pick strategy."
							/>
						</SettingsSection>
					</TabsContent>

					<TabsContent
						value="serial-batch-item"
						className="m-0 focus-visible:outline-none"
					>
						<SettingsSection title="Serial & Batch Item Settings">
							<div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
								<div className="space-y-4">
									<CheckboxField
										control={form.control}
										name="autoCreateSerialAndBatchBundleForOutward"
										id="autoCreateSerialAndBatchBundleForOutward"
										label="Auto Create Serial and Batch Bundle For Outward"
									/>
									<div className="space-y-2">
										<Label htmlFor="pickSerialBatchBasedOn">
											Pick Serial / Batch Based On
										</Label>
										<select
											id="pickSerialBatchBasedOn"
											{...form.register("pickSerialBatchBasedOn")}
											className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
										>
											<option value="FIFO">FIFO</option>
											<option value="LIFO">LIFO</option>
											<option value="EXPIRY">Expiry</option>
										</select>
									</div>
								</div>

								<div className="space-y-4">
									<CheckboxField
										control={form.control}
										name="disableSerialNoAndBatchSelector"
										id="disableSerialNoAndBatchSelector"
										label="Disable Serial No and Batch Selector"
									/>
									<CheckboxField
										control={form.control}
										name="haveDefaultNamingSeriesForBatchId"
										id="haveDefaultNamingSeriesForBatchId"
										label="Have Default Naming Series for Batch ID?"
									/>
									<CheckboxField
										control={form.control}
										name="useSerialBatchFields"
										id="useSerialBatchFields"
										label="Use Serial / Batch Fields"
										description="Builds auto bundles from the serial and batch values entered directly on the transaction."
									/>
									<CheckboxField
										control={form.control}
										name="doNotUpdateSerialBatchOnCreationOfAutoBundle"
										id="doNotUpdateSerialBatchOnCreationOfAutoBundle"
										label="Do Not Update Serial / Batch on Creation of Auto Bundle"
									/>
									<CheckboxField
										control={form.control}
										name="allowExistingSerialNoToBeManufacturedReceivedAgain"
										id="allowExistingSerialNoToBeManufacturedReceivedAgain"
										label="Allow existing Serial No to be Manufactured/Received again"
									/>
								</div>
							</div>
						</SettingsSection>

						<div className="border-t" />
						<SettingsSection title="Serial and Batch Bundle">
							<CheckboxField
								control={form.control}
								name="setSerialAndBatchBundleNamingBasedOnNamingSeries"
								id="setSerialAndBatchBundleNamingBasedOnNamingSeries"
								label="Set Serial and Batch Bundle Naming Based on Naming Series"
							/>
						</SettingsSection>
					</TabsContent>

					<TabsContent
						value="stock-planning"
						className="m-0 focus-visible:outline-none"
					>
						<SettingsSection title="Auto Material Request">
							<div className="grid gap-4 md:grid-cols-2">
								<CheckboxField
									control={form.control}
									name="raiseMaterialRequestWhenStockReachesReorderLevel"
									id="raiseMaterialRequestWhenStockReachesReorderLevel"
									label="Raise Material Request When Stock Reaches Re-order Level"
								/>
								<CheckboxField
									control={form.control}
									name="notifyByEmailOnCreationOfAutomaticMaterialRequest"
									id="notifyByEmailOnCreationOfAutomaticMaterialRequest"
									label="Notify by Email on Creation of Automatic Material Request"
								/>
							</div>
						</SettingsSection>

						<div className="border-t" />
						<SettingsSection title="Inter Warehouse Transfer Settings">
							<div className="grid gap-4 md:grid-cols-2">
								<CheckboxField
									control={form.control}
									name="allowMaterialTransferFromDeliveryNoteToSalesInvoice"
									id="allowMaterialTransferFromDeliveryNoteToSalesInvoice"
									label="Allow Material Transfer from Delivery Note to Sales Invoice"
								/>
								<CheckboxField
									control={form.control}
									name="allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice"
									id="allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice"
									label="Allow Material Transfer from Purchase Receipt to Purchase Invoice"
								/>
							</div>
						</SettingsSection>
					</TabsContent>

					<TabsContent
						value="stock-closing"
						className="m-0 focus-visible:outline-none"
					>
						<SettingsSection title="Control Historical Stock Transactions">
							<div className="max-w-xl space-y-2">
								<Label htmlFor="freezeStocksOlderThanDays">
									Freeze Stocks Older Than (Days)
								</Label>
								<Input
									id="freezeStocksOlderThanDays"
									type="number"
									min={0}
									max={3650}
									{...form.register("freezeStocksOlderThanDays", {
										valueAsNumber: true,
									})}
								/>
								<p className="text-sm text-muted-foreground">
									Transactions older than the configured number of days become
									read-only for normal users.
								</p>
							</div>
						</SettingsSection>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
