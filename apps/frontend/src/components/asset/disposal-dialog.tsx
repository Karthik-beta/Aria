"use client";

import type { Asset } from "@aria/types";
import * as React from "react";
import { useForm } from "react-hook-form";
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

type DisposalDialogProps = {
	asset: Asset.AssetItem;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
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
		onSuccess: () => {
			utils.asset.getAssetById.invalidate({ id: asset.id });
			onOpenChange(false);
			onSuccess?.();
		},
	});

	const sellMutation = trpc.asset.sellAsset.useMutation({
		onSuccess: () => {
			utils.asset.getAssetById.invalidate({ id: asset.id });
			onOpenChange(false);
			onSuccess?.();
		},
	});

	const scrapForm = useForm<Asset.ScrapAssetInput>({
		defaultValues: {
			assetId: asset.id,
			disposalDate: new Date(),
			notes: "",
		},
	});

	const sellForm = useForm<Asset.SellAssetInput>({
		defaultValues: {
			assetId: asset.id,
			disposalDate: new Date(),
			salesAmount: 0,
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
						Scrap asset or record a sale with gain/loss accounting GL entries.
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
								name="salesAmount"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Sale Price ($)</FormLabel>
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
