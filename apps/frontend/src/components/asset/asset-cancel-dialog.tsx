"use client";

import { AlertTriangle } from "lucide-react";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateOnly } from "@/lib/date-only";
import { trpc } from "@/lib/trpc";

interface AssetCancelDialogProps {
	assetId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	isConfirming: boolean;
}

/**
 * Confirmation for cancelling an asset. Loads the server-side preview so the
 * user sees which posted depreciation will be reversed, and which guards (for
 * example a frozen accounting period) currently block the cancellation.
 */
export function AssetCancelDialog({
	assetId,
	open,
	onOpenChange,
	onConfirm,
	isConfirming,
}: AssetCancelDialogProps) {
	const {
		data: preview,
		isLoading,
		isFetching,
		isError,
	} = trpc.asset.getAssetCancellationPreview.useQuery(
		{ id: assetId },
		{ enabled: open, refetchOnMount: "always" },
	);

	const blocked = isError || (preview ? !preview.canCancel : false);
	const confirmDisabled =
		isConfirming || isLoading || isFetching || blocked || !preview;

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Cancel this asset?</AlertDialogTitle>
					<AlertDialogDescription>
						Cancelling cancels the depreciation schedules and cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<div className="space-y-3 text-sm">
					{isLoading && <Skeleton className="h-16 w-full" />}

					{isError && (
						<p role="alert" className="text-destructive">
							Could not check whether this asset can be cancelled. Try again.
						</p>
					)}

					{preview && preview.blockers.length > 0 && (
						<div
							role="alert"
							className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive"
						>
							<p className="flex items-center gap-2 font-medium">
								<AlertTriangle className="h-4 w-4" />
								This asset cannot be cancelled yet
							</p>
							<ul className="mt-2 list-disc space-y-1 pl-5">
								{preview.blockers.map((blocker) => (
									<li key={blocker}>{blocker}</li>
								))}
							</ul>
						</div>
					)}

					{preview && preview.postedEntryCount > 0 && (
						<div className="rounded-md border p-3">
							<p>
								{preview.postedEntryCount} posted depreciation{" "}
								{preview.postedEntryCount === 1 ? "entry" : "entries"} totalling{" "}
								<span className="font-medium">
									₹{preview.postedDepreciationTotal.toLocaleString()}
								</span>{" "}
								will be reversed, and the asset value will return to its
								pre-depreciation amount. Latest posting date:{" "}
								<span className="font-medium">
									{formatDateOnly(preview.latestPostingDate)}
								</span>
								.
							</p>
							<ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-muted-foreground">
								{preview.entries.map((entry) => (
									<li key={entry.series} className="flex justify-between gap-4">
										<span>
											<span className="font-mono text-xs">{entry.series}</span>{" "}
											· {formatDateOnly(entry.postingDate)} ·{" "}
											{entry.financeBookName}
										</span>
										<span>₹{entry.depreciationAmount.toLocaleString()}</span>
									</li>
								))}
							</ul>
							{preview.postedEntryCount > preview.entries.length && (
								<p className="mt-2 text-xs text-muted-foreground">
									Showing the first {preview.entries.length} of{" "}
									{preview.postedEntryCount} entries.
								</p>
							)}
						</div>
					)}

					{preview &&
						preview.postedEntryCount === 0 &&
						preview.blockers.length === 0 && (
							<p className="text-muted-foreground">
								No depreciation has been posted for this asset.
							</p>
						)}
				</div>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={isConfirming}>
						Keep Asset
					</AlertDialogCancel>
					<Button
						variant="destructive"
						onClick={onConfirm}
						disabled={confirmDisabled}
					>
						{isConfirming ? "Cancelling..." : "Cancel Asset"}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
