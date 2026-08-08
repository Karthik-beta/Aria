"use client";

import type { Asset } from "@aria/types";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { trpc } from "@/lib/trpc";

type MovementDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
};

/**
 * Dialog component for creating a new Asset Movement entry.
 */
export function AssetMovementDialog({
	open,
	onOpenChange,
	onSuccess,
}: MovementDialogProps) {
	const utils = trpc.useUtils();
	const createMutation = trpc.asset.createAssetMovement.useMutation({
		onSuccess: () => {
			utils.asset.listAssetMovements.invalidate();
			onOpenChange(false);
			onSuccess?.();
		},
	});

	const { data: assetsData } = trpc.asset.listAssets.useQuery({ take: 100 });
	const { data: locationsData } = trpc.asset.listLocations.useQuery({
		take: 100,
	});

	const assetsList = assetsData?.items ?? [];
	const locationsList = locationsData?.items ?? [];

	const form = useForm<Asset.CreateAssetMovementInput>({
		defaultValues: {
			company: "Aria ERP",
			transactionDate: new Date(),
			purpose: "TRANSFER",
			notes: "",
			items: [
				{
					assetId: "",
					sourceLocationId: null,
					targetLocationId: null,
					fromEmployee: "",
					toEmployee: "",
				},
			],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "items",
	});

	const onSubmit = (values: Asset.CreateAssetMovementInput) => {
		createMutation.mutate(values);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>New Asset Movement</DialogTitle>
					<DialogDescription>
						Record asset transfers, receipts, or issues across locations and
						custodians.
					</DialogDescription>
				</DialogHeader>

				<Form form={form} onSubmit={onSubmit} className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<FormField
							control={form.control}
							name="purpose"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Movement Purpose</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select purpose" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="TRANSFER">Transfer</SelectItem>
											<SelectItem value="RECEIPT">Receipt</SelectItem>
											<SelectItem value="ISSUE">Issue</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="company"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Company</FormLabel>
									<FormControl>
										<Input {...field} placeholder="Company name" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="space-y-3">
						<div className="flex items-center justify-between">
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
										fromEmployee: "",
										toEmployee: "",
									})
								}
							>
								<Plus className="mr-1 h-3.5 w-3.5" />
								Add Asset Item
							</Button>
						</div>

						{fields.map((fieldItem, index) => (
							<div
								key={fieldItem.id}
								className="grid grid-cols-12 gap-2 items-end rounded-lg border p-3"
							>
								<div className="col-span-4">
									<FormField
										control={form.control}
										name={`items.${index}.assetId`}
										render={({ field: itemField }) => (
											<FormItem>
												<FormLabel className="text-xs">Asset</FormLabel>
												<Select
													onValueChange={itemField.onChange}
													value={itemField.value}
												>
													<FormControl>
														<SelectTrigger className="h-9">
															<SelectValue placeholder="Select asset" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{assetsList.map((a) => (
															<SelectItem key={a.id} value={a.id}>
																{a.series} - {a.assetName}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div className="col-span-3">
									<FormField
										control={form.control}
										name={`items.${index}.targetLocationId`}
										render={({ field: locField }) => (
											<FormItem>
												<FormLabel className="text-xs">
													Target Location
												</FormLabel>
												<Select
													onValueChange={locField.onChange}
													value={locField.value ?? ""}
												>
													<FormControl>
														<SelectTrigger className="h-9">
															<SelectValue placeholder="Target location" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{locationsList.map((loc) => (
															<SelectItem key={loc.id} value={loc.id}>
																{loc.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div className="col-span-4">
									<FormField
										control={form.control}
										name={`items.${index}.toEmployee`}
										render={({ field: custField }) => (
											<FormItem>
												<FormLabel className="text-xs">
													Target Custodian
												</FormLabel>
												<FormControl>
													<Input
														className="h-9"
														placeholder="Employee/Custodian"
														{...custField}
														value={custField.value ?? ""}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div className="col-span-1 flex justify-center pb-1">
									{fields.length > 1 && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => remove(index)}
											className="h-8 w-8 p-0 text-destructive"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									)}
								</div>
							</div>
						))}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={createMutation.isPending}>
							{createMutation.isPending ? "Saving..." : "Create Movement"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
