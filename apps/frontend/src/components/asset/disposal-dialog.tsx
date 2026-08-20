"use client";

import { Asset } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { type Resolver, useForm } from "react-hook-form";
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

type DisposalDialogProps = {
	asset: Asset.AssetItem;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void | Promise<void>;
};

/**
 * Dialog component for disposing (Scrapping or Selling) a fixed asset.
 */
export function AssetDisposalDialog({
	asset,
	open,
	onOpenChange,
	onSuccess,
}: DisposalDialogProps) {
	const utils = trpc.useUtils();
	const [disposalType, setDisposalType] = React.useState<"SCRAP" | "SALE">(
		"SCRAP",
	);

	const scrapMutation = trpc.asset.scrapAsset.useMutation({
		onSuccess: async () => {
			await invalidateAssetDomain(utils);
			toast.success("Asset scrapped");
			onOpenChange(false);
			await onSuccess?.();
		},
		onError: (error) => toast.error(getToastMessage(error, "scrap")),
	});

	const sellMutation = trpc.asset.sellAsset.useMutation({
		onSuccess: async () => {
			await invalidateAssetDomain(utils);
			toast.success("Asset sale recorded");
			onOpenChange(false);
			await onSuccess?.();
		},
		onError: (error) => toast.error(getToastMessage(error, "sell")),
	});

	const scrapForm = useForm<Asset.ScrapAssetInput>({
		resolver: zodResolver(
			Asset.scrapAssetSchema,
		) as Resolver<Asset.ScrapAssetInput>,
		defaultValues: {
			assetId: asset.id,
			disposalDate: todayDateInputValue(),
			gainLossAccount: "",
			costCenter: "",
			notes: "",
		},
	});

	const sellForm = useForm<Asset.SellAssetInput>({
		resolver: zodResolver(
			Asset.sellAssetSchema,
		) as Resolver<Asset.SellAssetInput>,
		defaultValues: {
			assetId: asset.id,
			disposalDate: todayDateInputValue(),
			salesAmount: 0,
			proceedsAccount: "",
			gainLossAccount: "",
			costCenter: "",
			notes: "",
		},
	});

	const onScrapSubmit = (values: Asset.ScrapAssetInput) => {
		scrapMutation.mutate(values);
	};

	const onSellSubmit = (values: Asset.SellAssetInput) => {
		sellMutation.mutate(values);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Dispose Fixed Asset</DialogTitle>
					<DialogDescription>
						Scrap an asset or record its sale. Accounting entries are confirmed
						by the server after submission.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="flex flex-col gap-1.5">
						<FormLabel>Disposal Type</FormLabel>
						<Select
							value={disposalType}
							onValueChange={(val: "SCRAP" | "SALE") => setDisposalType(val)}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="SCRAP">Scrap Asset</SelectItem>
								<SelectItem value="SALE">Sell Asset</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{disposalType === "SCRAP" ? (
						<Form
							form={scrapForm}
							onSubmit={onScrapSubmit}
							className="space-y-4"
						>
							<FormField
								control={scrapForm.control}
								name="gainLossAccount"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Gain / Loss Account</FormLabel>
										<FormControl>
											<Input
												placeholder="Loss on Asset Disposal - PVT"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={scrapForm.control}
								name="costCenter"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Cost Center (optional)</FormLabel>
										<FormControl>
											<Input
												placeholder="Main - PVT"
												{...field}
												value={field.value ?? ""}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={scrapForm.control}
								name="disposalDate"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Disposal Date</FormLabel>
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
								control={scrapForm.control}
								name="notes"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Notes / Scrapping Reason</FormLabel>
										<FormControl>
											<Input
												placeholder="Reason for scrapping..."
												{...field}
												value={field.value ?? ""}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

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
									variant="destructive"
									disabled={scrapMutation.isPending}
								>
									{scrapMutation.isPending ? "Scrapping..." : "Scrap Asset"}
								</Button>
							</DialogFooter>
						</Form>
					) : (
						<Form form={sellForm} onSubmit={onSellSubmit} className="space-y-4">
							<FormField
								control={sellForm.control}
								name="proceedsAccount"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Sale Proceeds Account</FormLabel>
										<FormControl>
											<Input placeholder="Debtors / Bank - PVT" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={sellForm.control}
								name="gainLossAccount"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Gain / Loss Account</FormLabel>
										<FormControl>
											<Input
												placeholder="Gain or Loss on Asset Disposal - PVT"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={sellForm.control}
								name="costCenter"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Cost Center (optional)</FormLabel>
										<FormControl>
											<Input
												placeholder="Main - PVT"
												{...field}
												value={field.value ?? ""}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={sellForm.control}
								name="disposalDate"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Sale Date</FormLabel>
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
								control={sellForm.control}
								name="salesAmount"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Sale Price</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												min={0}
												{...field}
												onChange={(e) =>
													field.onChange(
														Number.parseFloat(e.target.value || "0"),
													)
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={sellForm.control}
								name="notes"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Remarks / Sale Notes</FormLabel>
										<FormControl>
											<Input
												placeholder="Sale details..."
												{...field}
												value={field.value ?? ""}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => onOpenChange(false)}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={sellMutation.isPending}>
									{sellMutation.isPending ? "Selling..." : "Sell Asset"}
								</Button>
							</DialogFooter>
						</Form>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
