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

type CapitalizationDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
};

/**
 * Dialog component for recording a new Asset Capitalization entry.
 */
export function AssetCapitalizationDialog({
	open,
	onOpenChange,
	onSuccess,
}: CapitalizationDialogProps) {
	const utils = trpc.useUtils();
	const createMutation = trpc.asset.createAssetCapitalization.useMutation({
		onSuccess: () => {
			utils.asset.listAssetCapitalizations.invalidate();
			onOpenChange(false);
			onSuccess?.();
		},
	});

	const form = useForm<Asset.CreateAssetCapitalizationInput>({
		defaultValues: {
			targetType: "NEW_ASSET",
			company: "Aria ERP",
			postingDate: new Date(),
			targetAssetName: "",
			targetAssetCategory: "",
			notes: "",
			stockItems: [],
			assetItems: [],
			serviceItems: [],
		},
	});

	const onSubmit = (values: Asset.CreateAssetCapitalizationInput) => {
		createMutation.mutate(values);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Asset Capitalization</DialogTitle>
					<DialogDescription>
						Aggregate CWIP stock items, service expenses, and consumed assets
						into fixed asset book value.
					</DialogDescription>
				</DialogHeader>

				<Form form={form} onSubmit={onSubmit} className="space-y-4">
					<FormField
						control={form.control}
						name="targetAssetName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Target Asset Name</FormLabel>
								<FormControl>
									<Input
										placeholder="Composite Asset Name..."
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
						name="targetAssetCategory"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Asset Category</FormLabel>
								<FormControl>
									<Input
										placeholder="Category Code / Name"
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
						name="notes"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Capitalization Notes</FormLabel>
								<FormControl>
									<Input
										placeholder="Project / Capitalization Details..."
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
						<Button type="submit" disabled={createMutation.isPending}>
							{createMutation.isPending ? "Creating..." : "Capitalize Asset"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
