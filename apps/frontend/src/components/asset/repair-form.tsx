"use client";

import { Asset } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import type * as React from "react";
import {
	type Control,
	type FieldPath,
	type Resolver,
	useFieldArray,
	useForm,
} from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

type RepairDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
};

function dateInputValue(value: Date | null | undefined): string {
	return value ? value.toISOString().slice(0, 10) : "";
}

/** Records the complete repair cost inputs supported by the current API contract. */
export function AssetRepairDialog({
	open,
	onOpenChange,
	onSuccess,
}: RepairDialogProps) {
	const utils = trpc.useUtils();
	const { data: assetsData, isLoading: assetsLoading } =
		trpc.asset.listAssets.useQuery({
			take: 100,
		});
	const assetsList = assetsData?.items ?? [];
	const form = useForm<Asset.CreateAssetRepairInput>({
		resolver: zodResolver(
			Asset.createAssetRepairSchema,
		) as Resolver<Asset.CreateAssetRepairInput>,
		defaultValues: {
			assetId: "",
			company: "",
			failureDate: new Date(),
			completionDate: null,
			capitalizeRepairCost: false,
			increaseInAssetLife: 0,
			description: "",
			consumedItems: [],
			purchaseInvoices: [],
		},
	});
	const consumedItems = useFieldArray({
		control: form.control,
		name: "consumedItems",
	});
	const purchaseInvoices = useFieldArray({
		control: form.control,
		name: "purchaseInvoices",
	});
	const selectedAssetId = form.watch("assetId");
	const selectedAsset = assetsList.find(
		(asset) => asset.id === selectedAssetId,
	);

	const createMutation = trpc.asset.createAssetRepair.useMutation({
		onSuccess: () => {
			void utils.asset.listAssetRepairs.invalidate();
			toast.success("Pending asset repair recorded");
			onOpenChange(false);
			onSuccess?.();
		},
		onError: (error) => toast.error(getToastMessage(error, "create")),
	});

	const onSubmit = (values: Asset.CreateAssetRepairInput) => {
		if (!selectedAsset) {
			form.setError("assetId", { message: "Select an asset." });
			return;
		}
		createMutation.mutate({ ...values, company: selectedAsset.company });
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Record Asset Repair</DialogTitle>
					<DialogDescription>
						Open a pending repair with its materials and approved invoice
						allocations. Complete it from the repairs list when work finishes.
					</DialogDescription>
				</DialogHeader>
				<Form form={form} onSubmit={onSubmit} className="space-y-5">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<FormField
							control={form.control}
							name="assetId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Target Asset</FormLabel>
									<Select
										value={field.value}
										onValueChange={(assetId) => {
											field.onChange(assetId);
											form.setValue(
												"company",
												assetsList.find((asset) => asset.id === assetId)
													?.company ?? "",
												{ shouldValidate: true },
											);
										}}
										disabled={assetsLoading}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue
													placeholder={
														assetsLoading ? "Loading assets..." : "Select asset"
													}
												/>
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{assetsList.map((asset) => (
												<SelectItem key={asset.id} value={asset.id}>
													{asset.series} — {asset.assetName}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="space-y-2">
							<FormLabel>Company</FormLabel>
							<Input
								readOnly
								value={selectedAsset?.company ?? "Select an asset"}
							/>
						</div>
						<FormField
							control={form.control}
							name="failureDate"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Failure Date</FormLabel>
									<FormControl>
										<Input
											type="date"
											value={dateInputValue(field.value)}
											onChange={(event) =>
												field.onChange(
													new Date(`${event.target.value}T00:00:00`),
												)
											}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Repair Notes / Failure Description</FormLabel>
								<FormControl>
									<Input
										placeholder="Describe the repair..."
										{...field}
										value={field.value ?? ""}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<FormField
							control={form.control}
							name="completionDate"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Completion Date</FormLabel>
									<FormControl>
										<Input
											type="date"
											value={dateInputValue(field.value)}
											onChange={(event) =>
												field.onChange(
													event.target.value
														? new Date(`${event.target.value}T00:00:00`)
														: null,
												)
											}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="increaseInAssetLife"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Useful Life Extension (Months)</FormLabel>
									<FormControl>
										<Input
											type="number"
											min={0}
											value={field.value}
											onChange={(event) =>
												field.onChange(
													Number.parseInt(event.target.value || "0", 10),
												)
											}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
					<FormField
						control={form.control}
						name="capitalizeRepairCost"
						render={({ field }) => (
							<FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3">
								<FormControl>
									<Checkbox
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								</FormControl>
								<FormLabel>
									Capitalize eligible repair cost into asset value
								</FormLabel>
							</FormItem>
						)}
					/>

					<LineEditor
						title="Consumed Materials"
						onAdd={() =>
							consumedItems.append({
								itemCode: "",
								warehouse: "",
								expenseAccount: "",
								quantity: 1,
								valuationRate: 0,
							})
						}
					>
						{consumedItems.fields.map((item, index) => (
							<div
								key={item.id}
								className="grid grid-cols-1 gap-2 rounded border p-3 sm:grid-cols-6"
							>
								<LineInput
									control={form.control}
									name={`consumedItems.${index}.itemCode`}
									label="Item code"
								/>
								<LineInput
									control={form.control}
									name={`consumedItems.${index}.warehouse`}
									label="Warehouse"
								/>
								<LineInput
									control={form.control}
									name={`consumedItems.${index}.expenseAccount`}
									label="Expense account"
								/>
								<LineInput
									control={form.control}
									name={`consumedItems.${index}.quantity`}
									label="Qty"
									type="number"
									numeric
								/>
								<LineInput
									control={form.control}
									name={`consumedItems.${index}.valuationRate`}
									label="Rate"
									type="number"
									numeric
								/>
								<RemoveLineButton
									label={`Remove material ${index + 1}`}
									onClick={() => consumedItems.remove(index)}
								/>
							</div>
						))}
					</LineEditor>

					<LineEditor
						title="Purchase Invoice Allocations"
						onAdd={() =>
							purchaseInvoices.append({
								purchaseInvoice: "",
								expenseAccount: "",
								amount: 0,
							})
						}
					>
						{purchaseInvoices.fields.map((item, index) => (
							<div
								key={item.id}
								className="grid grid-cols-1 gap-2 rounded border p-3 sm:grid-cols-4"
							>
								<LineInput
									control={form.control}
									name={`purchaseInvoices.${index}.purchaseInvoice`}
									label="Purchase invoice"
								/>
								<LineInput
									control={form.control}
									name={`purchaseInvoices.${index}.expenseAccount`}
									label="Expense account"
								/>
								<LineInput
									control={form.control}
									name={`purchaseInvoices.${index}.amount`}
									label="Amount"
									type="number"
									numeric
								/>
								<RemoveLineButton
									label={`Remove invoice ${index + 1}`}
									onClick={() => purchaseInvoices.remove(index)}
								/>
							</div>
						))}
					</LineEditor>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={createMutation.isPending || assetsLoading}
						>
							{createMutation.isPending ? "Creating..." : "Record Repair"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}

function LineEditor({
	title,
	onAdd,
	children,
}: {
	title: string;
	onAdd: () => void;
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
			{children}
		</section>
	);
}

function LineInput<TName extends FieldPath<Asset.CreateAssetRepairInput>>({
	control,
	name,
	label,
	type = "text",
	numeric = false,
}: {
	control: Control<Asset.CreateAssetRepairInput>;
	name: TName;
	label: string;
	type?: "text" | "number";
	numeric?: boolean;
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
