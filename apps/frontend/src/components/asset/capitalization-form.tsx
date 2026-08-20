"use client";

import { Asset } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import {
	type Control,
	type FieldPath,
	type Resolver,
	useFieldArray,
	useForm,
} from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { dateInputValue, todayDateInputValue } from "@/lib/asset-date-only";
import { invalidateAssetDomain } from "@/lib/asset-invalidation";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import {
	AssetSearchSelect,
	type AssetSelectorItem,
	CompanySearchSelect,
} from "./server-backed-selectors";

type CapitalizationDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void | Promise<void>;
};

/** Captures only data represented by the current capitalization API contract. */
export function AssetCapitalizationDialog({
	open,
	onOpenChange,
	onSuccess,
}: CapitalizationDialogProps) {
	const utils = trpc.useUtils();
	const [assetMap, setAssetMap] = React.useState<
		Record<string, AssetSelectorItem>
	>({});
	const form = useForm<Asset.CreateAssetCapitalizationInput>({
		resolver: zodResolver(
			Asset.createAssetCapitalizationSchema,
		) as Resolver<Asset.CreateAssetCapitalizationInput>,
		defaultValues: {
			companyId: "",
			postingDate: todayDateInputValue(),
			targetType: "NEW_ASSET",
			targetAssetId: null,
			targetAssetName: "",
			targetAssetCategory: "",
			targetItemCode: "",
			notes: "",
			stockItems: [],
			assetItems: [],
			serviceItems: [],
		},
	});
	const stockItems = useFieldArray({
		control: form.control,
		name: "stockItems",
	});
	const assetItems = useFieldArray({
		control: form.control,
		name: "assetItems",
	});
	const serviceItems = useFieldArray({
		control: form.control,
		name: "serviceItems",
	});
	const targetType = form.watch("targetType");
	const selectedCompanyId = form.watch("companyId");
	const selectedTargetAssetId = form.watch("targetAssetId");
	const selectedTargetAsset = selectedTargetAssetId
		? assetMap[selectedTargetAssetId]
		: undefined;

	const createMutation = trpc.asset.createAssetCapitalization.useMutation({
		onSuccess: async () => {
			await invalidateAssetDomain(utils);
			toast.success("Asset capitalization draft created");
			onOpenChange(false);
			await onSuccess?.();
		},
		onError: (error) => toast.error(getToastMessage(error, "create")),
	});

	const onSubmit = (values: Asset.CreateAssetCapitalizationInput) => {
		if (
			values.stockItems.length +
				values.assetItems.length +
				values.serviceItems.length ===
			0
		) {
			form.setError("stockItems", {
				message:
					"Add at least one consumed stock item, asset, or service item.",
			});
			return;
		}
		if (values.targetType === "EXISTING_ASSET" && !values.targetAssetId) {
			form.setError("targetAssetId", { message: "Select the target asset." });
			return;
		}
		if (
			values.targetType === "NEW_ASSET" &&
			(!values.targetAssetName?.trim() ||
				!values.targetAssetCategory?.trim() ||
				!values.targetItemCode?.trim())
		) {
			form.setError("targetAssetName", {
				message:
					"A new target needs an asset name, fixed-asset item, and category.",
			});
			return;
		}
		createMutation.mutate(values);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Asset Capitalization</DialogTitle>
					<DialogDescription>
						Create a capitalization draft from recorded stock, asset, and
						service values.
					</DialogDescription>
				</DialogHeader>
				<Form form={form} onSubmit={onSubmit} className="space-y-5">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<FormField
							control={form.control}
							name="companyId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Company</FormLabel>
									<CompanySearchSelect
										value={field.value}
										onValueChange={field.onChange}
									/>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="postingDate"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Posting Date</FormLabel>
									<FormControl>
										<Input
											type="date"
											value={dateInputValue(field.value)}
											onChange={(event) => field.onChange(event.target.value)}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="targetType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Target Type</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="NEW_ASSET">New Asset</SelectItem>
											<SelectItem value="EXISTING_ASSET">
												Existing Asset
											</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					{targetType === "EXISTING_ASSET" ? (
						<FormField
							control={form.control}
							name="targetAssetId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Target Asset</FormLabel>
									<AssetSearchSelect
										value={field.value}
										onValueChange={field.onChange}
										onSelect={(asset) => {
											setAssetMap((current) => ({
												...current,
												[asset.id]: asset,
											}));
											form.setValue("companyId", asset.companyId, {
												shouldValidate: true,
											});
										}}
										selectedLabel={
											selectedTargetAsset
												? `${selectedTargetAsset.series} — ${selectedTargetAsset.assetName}`
												: undefined
										}
									/>
									<FormMessage />
								</FormItem>
							)}
						/>
					) : (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<CapitalizationInput
								control={form.control}
								name="targetAssetName"
								label="Target Asset Name"
							/>
							<CapitalizationInput
								control={form.control}
								name="targetAssetCategory"
								label="Target Asset Category"
							/>
							<CapitalizationInput
								control={form.control}
								name="targetItemCode"
								label="Fixed-Asset Item Code"
							/>
						</div>
					)}
					<CapitalizationInput
						control={form.control}
						name="notes"
						label="Notes"
					/>

					<CapitalizationSection
						title="Consumed Stock Items"
						onAdd={() =>
							stockItems.append({
								itemCode: "",
								warehouse: "",
								expenseAccount: "",
								stockQty: 1,
								valuationRate: 0,
							})
						}
						error={form.formState.errors.stockItems?.message}
					>
						{stockItems.fields.map((item, index) => (
							<div
								key={item.id}
								className="grid grid-cols-1 gap-2 rounded border p-3 sm:grid-cols-6"
							>
								<CapitalizationInput
									control={form.control}
									name={`stockItems.${index}.itemCode`}
									label="Item code"
								/>
								<CapitalizationInput
									control={form.control}
									name={`stockItems.${index}.warehouse`}
									label="Warehouse"
								/>
								<CapitalizationInput
									control={form.control}
									name={`stockItems.${index}.expenseAccount`}
									label="Expense account"
								/>
								<CapitalizationInput
									control={form.control}
									name={`stockItems.${index}.stockQty`}
									label="Qty"
									type="number"
									numeric
								/>
								<CapitalizationInput
									control={form.control}
									name={`stockItems.${index}.valuationRate`}
									label="Rate"
									type="number"
									numeric
								/>
								<RemoveLineButton
									label={`Remove stock item ${index + 1}`}
									onClick={() => stockItems.remove(index)}
								/>
							</div>
						))}
					</CapitalizationSection>

					<CapitalizationSection
						title="Consumed Assets"
						onAdd={() => assetItems.append({ assetId: "", assetValue: 0 })}
					>
						{assetItems.fields.map((item, index) => (
							<div
								key={item.id}
								className="grid grid-cols-1 gap-2 rounded border p-3 sm:grid-cols-3"
							>
								<FormField
									control={form.control}
									name={`assetItems.${index}.assetId`}
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-xs">Asset</FormLabel>
											<AssetSearchSelect
												value={field.value}
												onValueChange={field.onChange}
												onSelect={(asset) => {
													const isEligible =
														asset.companyId === selectedCompanyId &&
														asset.id !== selectedTargetAssetId &&
														[
															"SUBMITTED",
															"PARTIALLY_DEPRECIATED",
															"FULLY_DEPRECIATED",
														].includes(asset.status);
													if (!isEligible) {
														toast.error(
															"Select a submitted asset from the selected company.",
														);
														field.onChange("");
														form.setValue(`assetItems.${index}.assetValue`, 0, {
															shouldValidate: true,
														});
														return;
													}
													setAssetMap((current) => ({
														...current,
														[asset.id]: asset,
													}));
													form.setValue(
														`assetItems.${index}.assetValue`,
														asset.valueAfterDepreciation ?? 0,
														{ shouldValidate: true },
													);
												}}
												selectedLabel={
													assetMap[field.value]
														? `${assetMap[field.value].series} — ${assetMap[field.value].assetName}`
														: undefined
												}
											/>
											<FormMessage />
										</FormItem>
									)}
								/>
								<CapitalizationInput
									control={form.control}
									name={`assetItems.${index}.assetValue`}
									label="Asset value"
									type="number"
									numeric
									readOnly
								/>
								<RemoveLineButton
									label={`Remove consumed asset ${index + 1}`}
									onClick={() => assetItems.remove(index)}
								/>
							</div>
						))}
					</CapitalizationSection>

					<CapitalizationSection
						title="Consumed Service Items"
						onAdd={() =>
							serviceItems.append({
								itemCode: "",
								expenseAccount: "",
								amount: 0,
							})
						}
					>
						{serviceItems.fields.map((item, index) => (
							<div
								key={item.id}
								className="grid grid-cols-1 gap-2 rounded border p-3 sm:grid-cols-4"
							>
								<CapitalizationInput
									control={form.control}
									name={`serviceItems.${index}.itemCode`}
									label="Item code"
								/>
								<CapitalizationInput
									control={form.control}
									name={`serviceItems.${index}.expenseAccount`}
									label="Expense account"
								/>
								<CapitalizationInput
									control={form.control}
									name={`serviceItems.${index}.amount`}
									label="Amount"
									type="number"
									numeric
								/>
								<RemoveLineButton
									label={`Remove service item ${index + 1}`}
									onClick={() => serviceItems.remove(index)}
								/>
							</div>
						))}
					</CapitalizationSection>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={createMutation.isPending}>
							{createMutation.isPending
								? "Creating..."
								: "Create Capitalization Draft"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}

function CapitalizationSection({
	title,
	onAdd,
	error,
	children,
}: {
	title: string;
	onAdd: () => void;
	error?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-2">
			<div className="flex items-center justify-between">
				<FormLabel>{title}</FormLabel>
				<Button type="button" size="sm" variant="outline" onClick={onAdd}>
					<Plus className="mr-1 h-3.5 w-3.5" />
					Add line
				</Button>
			</div>
			{error && <p className="text-destructive text-sm">{error}</p>}
			{children}
		</section>
	);
}

function CapitalizationInput<
	TName extends FieldPath<Asset.CreateAssetCapitalizationInput>,
>({
	control,
	name,
	label,
	type = "text",
	numeric = false,
	readOnly = false,
}: {
	control: Control<Asset.CreateAssetCapitalizationInput>;
	name: TName;
	label: string;
	type?: "text" | "number";
	numeric?: boolean;
	readOnly?: boolean;
}) {
	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem>
					<FormLabel className="text-xs">{label}</FormLabel>
					<FormControl>
						<Input
							type={type}
							readOnly={readOnly}
							{...field}
							value={
								typeof field.value === "string" ||
								typeof field.value === "number"
									? field.value
									: ""
							}
							onChange={(event) =>
								field.onChange(
									numeric
										? Number.parseFloat(event.target.value || "0")
										: event.target.value,
								)
							}
						/>
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

function RemoveLineButton({
	label,
	onClick,
}: {
	label: string;
	onClick: () => void;
}) {
	return (
		<div className="flex items-end">
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={onClick}
				aria-label={label}
			>
				<Trash2 className="h-4 w-4" />
			</Button>
		</div>
	);
}
