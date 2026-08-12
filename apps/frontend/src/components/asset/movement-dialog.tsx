"use client";

import { Asset } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { type Resolver, useFieldArray, useForm } from "react-hook-form";
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
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

type MovementDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
};

const PURPOSES: Array<{ value: Asset.AssetMovementPurpose; label: string }> = [
	{ value: "TRANSFER", label: "Transfer" },
	{ value: "RECEIPT", label: "Receipt" },
	{ value: "ISSUE", label: "Issue" },
	{ value: "TRANSFER_AND_ISSUE", label: "Transfer and Issue" },
];

function dateInputValue(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function requiresTargetLocation(purpose: Asset.AssetMovementPurpose): boolean {
	return purpose !== "ISSUE";
}

function requiresCustodian(purpose: Asset.AssetMovementPurpose): boolean {
	return purpose === "ISSUE" || purpose === "TRANSFER_AND_ISSUE";
}

/** Creates a movement draft from the current, server-backed asset state. */
export function AssetMovementDialog({
	open,
	onOpenChange,
	onSuccess,
}: MovementDialogProps) {
	const utils = trpc.useUtils();
	const { data: assetsData, isLoading: assetsLoading } =
		trpc.asset.listAssets.useQuery({
			take: 100,
		});
	const { data: locationsData, isLoading: locationsLoading } =
		trpc.asset.listLocations.useQuery({ take: 100 });
	const assetsList = assetsData?.items ?? [];
	const locationsList = locationsData?.items ?? [];

	const form = useForm<Asset.CreateAssetMovementInput>({
		resolver: zodResolver(
			Asset.createAssetMovementSchema,
		) as Resolver<Asset.CreateAssetMovementInput>,
		defaultValues: {
			companyId: "",
			transactionDate: new Date(),
			purpose: "TRANSFER",
			notes: "",
			items: [
				{
					assetId: "",
					sourceLocationId: null,
					targetLocationId: null,
					fromEmployee: null,
					toEmployee: null,
				},
			],
		},
	});
	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "items",
	});
	const purpose = form.watch("purpose");
	const companyId = form.watch("companyId");

	const createMutation = trpc.asset.createAssetMovement.useMutation({
		onSuccess: () => {
			void utils.asset.listAssetMovements.invalidate();
			toast.success("Asset movement draft created");
			onOpenChange(false);
			onSuccess?.();
		},
		onError: (error) => toast.error(getToastMessage(error, "create")),
	});

	const updateSourceState = (index: number, assetId: string) => {
		const selectedAsset = assetsList.find((asset) => asset.id === assetId);
		form.setValue(`items.${index}.assetId`, assetId, { shouldValidate: true });
		form.setValue(
			`items.${index}.sourceLocationId`,
			selectedAsset?.locationId ?? null,
		);
		form.setValue(
			`items.${index}.fromEmployee`,
			selectedAsset?.custodian ?? null,
		);

		const selectedIds = form
			.getValues("items")
			.map((item, itemIndex) => (itemIndex === index ? assetId : item.assetId))
			.filter(Boolean);
		const companyIds = new Set(
			selectedIds
				.map((id) => assetsList.find((asset) => asset.id === id)?.companyId)
				.filter((id): id is string => Boolean(id)),
		);
		form.setValue(
			"companyId",
			companyIds.size === 1 ? [...companyIds][0] : "",
			{
				shouldValidate: true,
			},
		);
	};

	const onSubmit = (values: Asset.CreateAssetMovementInput) => {
		const selectedAssets = values.items
			.map((item) => assetsList.find((asset) => asset.id === item.assetId))
			.filter((asset) => asset !== undefined);
		if (selectedAssets.length !== values.items.length) {
			form.setError("items", {
				message: "Select an asset for every line item.",
			});
			return;
		}
		const selectedCompanyIds = selectedAssets.map((asset) => asset.companyId);
		const selectedCompanyId = selectedCompanyIds[0];
		if (!selectedCompanyId || new Set(selectedCompanyIds).size !== 1) {
			form.setError("companyId", {
				message: "All movement assets must belong to the same company.",
			});
			return;
		}
		for (const [index, item] of values.items.entries()) {
			if (requiresTargetLocation(values.purpose) && !item.targetLocationId) {
				form.setError(`items.${index}.targetLocationId`, {
					message: "A target location is required for this movement.",
				});
				return;
			}
			if (requiresCustodian(values.purpose) && !item.toEmployee?.trim()) {
				form.setError(`items.${index}.toEmployee`, {
					message: "A target custodian is required for this movement.",
				});
				return;
			}
		}
		createMutation.mutate({
			...values,
			companyId: selectedCompanyId,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>New Asset Movement</DialogTitle>
					<DialogDescription>
						Record asset transfers, receipts, or issues from the asset&apos;s
						current location and custodian.
					</DialogDescription>
				</DialogHeader>

				<Form form={form} onSubmit={onSubmit} className="space-y-4">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<FormField
							control={form.control}
							name="purpose"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Movement Purpose</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select purpose" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{PURPOSES.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="transactionDate"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Transaction Date</FormLabel>
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
						<div className="space-y-2">
							<FormLabel>Company</FormLabel>
							<Input
								value={
									assetsList.find((asset) => asset.companyId === companyId)
										?.company ?? "Select assets to derive company"
								}
								readOnly
							/>
							{form.formState.errors.companyId?.message && (
								<p className="text-destructive text-sm">
									{form.formState.errors.companyId.message}
								</p>
							)}
						</div>
					</div>

					<div className="space-y-3">
						<div className="flex items-center justify-between gap-3">
							<FormLabel>Movement Line Items</FormLabel>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() =>
									append({
										assetId: "",
										sourceLocationId: null,
										targetLocationId: null,
										fromEmployee: null,
										toEmployee: null,
									})
								}
							>
								<Plus className="mr-1 h-3.5 w-3.5" />
								Add Asset Item
							</Button>
						</div>
						{form.formState.errors.items?.message && (
							<p className="text-destructive text-sm">
								{form.formState.errors.items.message}
							</p>
						)}

						{fields.map((fieldItem, index) => {
							const selectedAsset = assetsList.find(
								(asset) => asset.id === form.watch(`items.${index}.assetId`),
							);
							return (
								<div
									key={fieldItem.id}
									className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-12"
								>
									<div className="md:col-span-4">
										<FormField
											control={form.control}
											name={`items.${index}.assetId`}
											render={({ field }) => (
												<FormItem>
													<FormLabel>Asset</FormLabel>
													<Select
														value={field.value}
														onValueChange={(value) =>
															updateSourceState(index, value)
														}
														disabled={assetsLoading}
													>
														<FormControl>
															<SelectTrigger>
																<SelectValue
																	placeholder={
																		assetsLoading
																			? "Loading assets..."
																			: "Select asset"
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
									</div>
									<div className="md:col-span-3">
										<FormLabel>Current source</FormLabel>
										<Input
											readOnly
											value={`${selectedAsset?.locationName ?? "No location"} · ${selectedAsset?.custodian ?? "No custodian"}`}
										/>
									</div>
									{requiresTargetLocation(purpose) && (
										<div className="md:col-span-3">
											<FormField
												control={form.control}
												name={`items.${index}.targetLocationId`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>Target location</FormLabel>
														<Select
															value={field.value ?? ""}
															onValueChange={field.onChange}
															disabled={locationsLoading}
														>
															<FormControl>
																<SelectTrigger>
																	<SelectValue
																		placeholder={
																			locationsLoading
																				? "Loading locations..."
																				: "Select location"
																		}
																	/>
																</SelectTrigger>
															</FormControl>
															<SelectContent>
																{locationsList.map((location) => (
																	<SelectItem
																		key={location.id}
																		value={location.id}
																	>
																		{location.name}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>
									)}
									{requiresCustodian(purpose) && (
										<div className="md:col-span-2">
											<FormField
												control={form.control}
												name={`items.${index}.toEmployee`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>Target custodian</FormLabel>
														<FormControl>
															<Input {...field} value={field.value ?? ""} />
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>
									)}
									<div className="flex items-end justify-end md:col-span-1">
										{fields.length > 1 && (
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => remove(index)}
												aria-label={`Remove movement item ${index + 1}`}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										)}
									</div>
								</div>
							);
						})}
					</div>

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
							{createMutation.isPending ? "Saving..." : "Create Movement"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
