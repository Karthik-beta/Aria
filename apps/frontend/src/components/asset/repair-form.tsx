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
import { trpc } from "@/lib/trpc";

type RepairDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
};

/**
 * Dialog component for recording a new Asset Repair entry.
 */
export function AssetRepairDialog({
	open,
	onOpenChange,
	onSuccess,
}: RepairDialogProps) {
	const utils = trpc.useUtils();
	const createMutation = trpc.asset.createAssetRepair.useMutation({
		onSuccess: () => {
			utils.asset.listAssetRepairs.invalidate();
			onOpenChange(false);
			onSuccess?.();
		},
	});

	const { data: assetsData } = trpc.asset.listAssets.useQuery({ take: 100 });
	const assetsList = assetsData?.items ?? [];

	const form = useForm<Asset.CreateAssetRepairInput>({
		defaultValues: {
			assetId: "",
			company: "Aria ERP",
			failureDate: new Date(),
			capitalizeRepairCost: false,
			increaseInAssetLife: 0,
			description: "",
			consumedItems: [],
			purchaseInvoices: [],
		},
	});

	const onSubmit = (values: Asset.CreateAssetRepairInput) => {
		createMutation.mutate(values);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Record Asset Repair</DialogTitle>
					<DialogDescription>
						Record breakdown repair costs, spare parts, and optional book value
						capitalization.
					</DialogDescription>
				</DialogHeader>

				<Form form={form} onSubmit={onSubmit} className="space-y-4">
					<FormField
						control={form.control}
						name="assetId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Target Asset</FormLabel>
								<select
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									value={field.value}
									onChange={field.onChange}
								>
									<option value="">Select an asset...</option>
									{assetsList.map((a) => (
										<option key={a.id} value={a.id}>
											{a.series} - {a.assetName}
										</option>
									))}
								</select>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Repair Notes / Failure Description</FormLabel>
								<FormControl>
									<Input
										placeholder="Describe breakdown..."
										{...field}
										value={field.value ?? ""}
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
										{...field}
										onChange={(e) =>
											field.onChange(Number.parseInt(e.target.value || "0", 10))
										}
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
						<Button type="submit" disabled={createMutation.isPending}>
							{createMutation.isPending ? "Creating..." : "Record Repair"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
