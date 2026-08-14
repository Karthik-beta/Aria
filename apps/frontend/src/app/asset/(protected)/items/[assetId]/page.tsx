/**
 * Asset Detail Page
 * View and manage an individual asset record
 */

"use client";

import type { Asset } from "@aria/types";
import {
	ArrowLeft,
	Building2,
	Calendar,
	DollarSign,
	Edit,
	MapPin,
	Tag,
	Trash,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { AssetDisposalDialog } from "@/components/asset/disposal-dialog";
import { AlertModal } from "@/components/modal/alert-modal";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssetWriteAccess } from "@/hooks/use-asset-write-access";
import { formatAssetDate } from "@/lib/asset-date-only";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { normalizeDepreciationSchedules } from "./depreciation-schedule.utils";

const STATUS_BADGE_CLASS: Record<string, string> = {
	DRAFT:
		"bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground",
	SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
	CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
	PARTIALLY_DEPRECIATED:
		"bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
	FULLY_DEPRECIATED:
		"bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
	SOLD: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
	SCRAPPED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
	IN_MAINTENANCE:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
	OUT_OF_ORDER: "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

function formatStatus(status: string): string {
	return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: React.ReactNode;
}) {
	return (
		<div className="flex items-start gap-4 py-2">
			<span className="w-48 shrink-0 text-sm font-medium text-muted-foreground">
				{label}
			</span>
			<span className="text-sm">{value ?? "—"}</span>
		</div>
	);
}

export default function AssetDetailPage() {
	const params = useParams();
	const router = useRouter();
	const assetId = params.assetId as string;
	const utils = trpc.useUtils();
	const [_isPending, startTransition] = React.useTransition();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [isDisposalDialogOpen, setIsDisposalDialogOpen] = React.useState(false);
	const canWrite = useAssetWriteAccess();

	const { data: rawData, isLoading } = trpc.asset.getAssetById.useQuery(
		{ id: assetId },
		{
			refetchOnWindowFocus: true,
			refetchOnMount: true,
		},
	);
	const {
		data: depreciationSchedules,
		isLoading: schedulesLoading,
		error: schedulesError,
	} = trpc.asset.getAssetDepreciationSchedules.useQuery({ assetId });

	const asset = rawData as Asset.AssetItem | undefined;
	const schedules = React.useMemo(
		() => normalizeDepreciationSchedules(depreciationSchedules?.items),
		[depreciationSchedules?.items],
	);

	const deleteMutation = trpc.asset.deleteAsset.useMutation({
		onSuccess: () => {
			void utils.asset.listAssets.invalidate();
			toast.success("Asset deleted successfully");
			startTransition(() => {
				router.push("/asset/items");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "delete"));
		},
	});
	const submitMutation = trpc.asset.submitAsset.useMutation({
		onSuccess: async () => {
			await utils.asset.getAssetById.invalidate({ id: assetId });
			await utils.asset.listAssets.invalidate();
			toast.success("Asset submitted and depreciation schedules activated");
		},
		onError: (error) => toast.error(getToastMessage(error, "submit")),
	});
	const cancelMutation = trpc.asset.cancelAsset.useMutation({
		onSuccess: async () => {
			await utils.asset.getAssetById.invalidate({ id: assetId });
			await utils.asset.listAssets.invalidate();
			toast.success("Asset cancelled");
		},
		onError: (error) => toast.error(getToastMessage(error, "cancel")),
	});
	const restoreMutation = trpc.asset.restoreAsset.useMutation({
		onSuccess: async () => {
			await utils.asset.getAssetById.invalidate({ id: assetId });
			await utils.asset.listAssets.invalidate();
			toast.success("Asset restored");
		},
		onError: (error) => toast.error(getToastMessage(error, "restore")),
	});

	const confirmDelete = () => {
		deleteMutation.mutate({ id: assetId });
	};

	if (isLoading) {
		return (
			<div className="container mx-auto px-4 md:px-6 py-6 space-y-6">
				<div className="flex items-center gap-4">
					<Skeleton className="h-10 w-10" />
					<Skeleton className="h-8 w-64" />
				</div>
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	if (!asset) {
		return (
			<div className="container mx-auto px-4 md:px-6 py-6">
				<Card>
					<CardContent className="flex flex-col items-center gap-4 py-16">
						<Tag className="h-12 w-12 text-muted-foreground" />
						<CardTitle>Asset Not Found</CardTitle>
						<CardDescription>
							The asset you&apos;re looking for doesn&apos;t exist or has been
							deleted.
						</CardDescription>
						<Link
							href="/asset/items"
							className={buttonVariants({ variant: "outline" })}
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Assets
						</Link>
					</CardContent>
				</Card>
			</div>
		);
	}

	const badgeClass =
		STATUS_BADGE_CLASS[asset.status] ??
		"bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground";

	return (
		<>
			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => setIsDeleteDialogOpen(false)}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>
			<AssetDisposalDialog
				asset={asset}
				open={isDisposalDialogOpen}
				onOpenChange={setIsDisposalDialogOpen}
				onSuccess={() => {
					void utils.asset.listAssets.invalidate();
				}}
			/>

			<div className="container mx-auto px-4 md:px-6 py-6 space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<Link
							href="/asset/items"
							className={cn(
								buttonVariants({ variant: "outline", size: "icon" }),
							)}
						>
							<ArrowLeft className="h-4 w-4" />
						</Link>
						<div>
							<h1 className="text-2xl font-bold">{asset.assetName}</h1>
							<p className="text-sm text-muted-foreground font-mono">
								{asset.series}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Badge className={`${badgeClass} border-0`}>
							{formatStatus(asset.status)}
						</Badge>
						{canWrite && asset.status === "DRAFT" && (
							<Button
								size="sm"
								onClick={() => submitMutation.mutate({ id: asset.id })}
								disabled={submitMutation.isPending}
							>
								Submit
							</Button>
						)}
						{canWrite &&
							["SUBMITTED", "PARTIALLY_DEPRECIATED"].includes(asset.status) && (
								<Button
									size="sm"
									variant="outline"
									onClick={() => cancelMutation.mutate({ id: asset.id })}
									disabled={cancelMutation.isPending}
								>
									Cancel Asset
								</Button>
							)}
						{[
							"SUBMITTED",
							"PARTIALLY_DEPRECIATED",
							"FULLY_DEPRECIATED",
						].includes(asset.status) &&
							canWrite && (
								<Button
									size="sm"
									variant="destructive"
									onClick={() => setIsDisposalDialogOpen(true)}
								>
									Dispose
								</Button>
							)}
						{canWrite && ["SOLD", "SCRAPPED"].includes(asset.status) && (
							<Button
								size="sm"
								variant="outline"
								onClick={() => restoreMutation.mutate({ assetId: asset.id })}
								disabled={restoreMutation.isPending}
							>
								{restoreMutation.isPending ? "Restoring..." : "Restore"}
							</Button>
						)}
						{canWrite && (
							<Link
								href={`/asset/items/form?id=${asset.id}`}
								className={buttonVariants({ variant: "outline", size: "sm" })}
							>
								<Edit className="mr-2 h-4 w-4" />
								Edit
							</Link>
						)}
						{canWrite && (
							<Button
								variant="destructive"
								size="sm"
								onClick={() => setIsDeleteDialogOpen(true)}
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete
							</Button>
						)}
					</div>
				</div>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					{/* Basic Information */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Tag className="h-5 w-5" />
								Basic Information
							</CardTitle>
						</CardHeader>
						<CardContent className="divide-y">
							<DetailRow label="Asset Name" value={asset.assetName} />
							<DetailRow
								label="Series"
								value={
									<span className="font-mono text-xs">{asset.series}</span>
								}
							/>
							<DetailRow label="Item Code" value={asset.itemCode} />
							<DetailRow label="Barcode / QR Code" value={asset.barcode} />
							<DetailRow label="Category" value={asset.assetCategoryName} />
							<DetailRow label="Company" value={asset.company} />
							<DetailRow
								label="Location"
								value={
									asset.locationName ? (
										<span className="flex items-center gap-1">
											<MapPin className="h-3 w-3" />
											{asset.locationName}
										</span>
									) : null
								}
							/>
							<DetailRow label="Custodian" value={asset.custodian} />
							<DetailRow label="Department" value={asset.department} />
							<DetailRow label="Asset Quantity" value={asset.assetQuantity} />
						</CardContent>
					</Card>

					{asset.financeBooks && asset.financeBooks.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Finance Books</CardTitle>
								<CardDescription>
									Independent depreciation state by accounting book
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{asset.financeBooks.map((book) => (
									<div key={book.id} className="rounded-lg border p-3">
										<div className="flex items-center justify-between">
											<span className="font-medium">
												{book.financeBookName}
											</span>
											<Badge variant="outline">
												{formatStatus(book.postingStatus)}
											</Badge>
										</div>
										<p className="mt-1 text-sm text-muted-foreground">
											{formatStatus(book.depreciationMethod)} ·{" "}
											{book.frequencyOfDepreciation} month cadence ·{" "}
											{book.totalNumberOfBookedDepreciations}/
											{book.totalNumberOfDepreciations} posted
										</p>
									</div>
								))}
							</CardContent>
						</Card>
					)}

					<DepreciationSchedulesCard
						schedules={schedules}
						financeBooks={asset.financeBooks ?? []}
						isLoading={schedulesLoading}
						errorMessage={schedulesError?.message}
					/>

					{/* Purchase & Depreciation */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<DollarSign className="h-5 w-5" />
								Purchase & Valuation
							</CardTitle>
						</CardHeader>
						<CardContent className="divide-y">
							<DetailRow
								label="Purchase Date"
								value={
									asset.purchaseDate ? (
										<span className="flex items-center gap-1">
											<Calendar className="h-3 w-3" />
											{formatAssetDate(asset.purchaseDate)}
										</span>
									) : null
								}
							/>
							<DetailRow
								label="Available For Use"
								value={
									asset.availableForUseDate
										? formatAssetDate(asset.availableForUseDate)
										: null
								}
							/>
							<DetailRow
								label="Net Purchase Amount"
								value={
									asset.netPurchaseAmount != null
										? `₹${asset.netPurchaseAmount.toLocaleString()}`
										: null
								}
							/>
							<DetailRow
								label="Calculate Depreciation"
								value={asset.calculateDepreciation ? "Yes" : "No"}
							/>
							<DetailRow
								label="Depreciation Method"
								value={asset.depreciationMethod}
							/>
							<DetailRow
								label="Fully Depreciated"
								value={asset.isFullyDepreciated ? "Yes" : "No"}
							/>
							<DetailRow
								label="Maintenance Required"
								value={asset.maintenanceRequired ? "Yes" : "No"}
							/>
						</CardContent>
					</Card>

					{/* Ownership */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Building2 className="h-5 w-5" />
								Ownership & Insurance
							</CardTitle>
						</CardHeader>
						<CardContent className="divide-y">
							<DetailRow label="Asset Owner" value={asset.assetOwner} />
							<DetailRow
								label="Owner Company"
								value={asset.assetOwnerCompany}
							/>
							<DetailRow label="Supplier" value={asset.supplier} />
							<DetailRow label="Insurer" value={asset.insurer} />
							<DetailRow label="Policy Number" value={asset.policyNumber} />
							<DetailRow
								label="Insured Value"
								value={
									asset.insuredValue != null
										? `₹${asset.insuredValue.toLocaleString()}`
										: null
								}
							/>
							<DetailRow
								label="Insurance Start"
								value={
									asset.insuranceStartDate
										? formatAssetDate(asset.insuranceStartDate)
										: null
								}
							/>
							<DetailRow
								label="Insurance End"
								value={
									asset.insuranceEndDate
										? formatAssetDate(asset.insuranceEndDate)
										: null
								}
							/>
						</CardContent>
					</Card>

					{/* Activity Log */}
					{asset.activities && asset.activities.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Activity Log</CardTitle>
								<CardDescription>
									{asset.activities.length} activity records
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{asset.activities.map((activity) => (
										<div key={activity.id} className="flex gap-3">
											<div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
											<div>
												<p className="text-sm">{activity.activity}</p>
												<p className="text-xs text-muted-foreground">
													{new Date(activity.createdAt).toLocaleString()}
												</p>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				<Separator />
				<p className="text-xs text-muted-foreground">
					Created: {new Date(asset.createdAt).toLocaleString()} · Last updated:{" "}
					{new Date(asset.updatedAt).toLocaleString()}
				</p>
			</div>
		</>
	);
}

function DepreciationSchedulesCard({
	schedules,
	financeBooks,
	isLoading,
	errorMessage,
}: {
	schedules: Asset.AssetDepreciationSchedule[];
	financeBooks: Asset.AssetFinanceBook[];
	isLoading: boolean;
	errorMessage?: string;
}) {
	const bookNames = new Map(
		financeBooks.map((book) => [book.id, book.financeBookName]),
	);
	return (
		<Card className="lg:col-span-2">
			<CardHeader>
				<CardTitle>Persisted Depreciation Schedules</CardTitle>
				<CardDescription>
					Active schedule rows and immutable revision history by finance book
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				{isLoading ? (
					<Skeleton className="h-32 w-full" />
				) : errorMessage ? (
					<p className="text-sm text-destructive">{errorMessage}</p>
				) : schedules.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No persisted schedule exists for this asset.
					</p>
				) : (
					schedules.map((schedule) => (
						<section
							key={schedule.id}
							className="space-y-2 rounded-lg border p-3"
						>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p className="font-medium">
										{bookNames.get(schedule.assetFinanceBookId) ??
											schedule.assetFinanceBookId}
									</p>
									<p className="text-xs text-muted-foreground">
										Revision {schedule.revisionNumber} ·{" "}
										{formatStatus(schedule.depreciationMethod ?? "UNSPECIFIED")}
									</p>
								</div>
								<Badge variant="outline">{formatStatus(schedule.status)}</Badge>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full min-w-[680px] text-sm">
									<thead className="border-b text-left text-muted-foreground">
										<tr>
											<th className="py-2 pr-3 font-medium">Period</th>
											<th className="py-2 pr-3 font-medium">Date</th>
											<th className="py-2 pr-3 text-right font-medium">
												Depreciation
											</th>
											<th className="py-2 pr-3 text-right font-medium">
												Accumulated
											</th>
											<th className="py-2 text-right font-medium">
												Book Value
											</th>
											<th className="py-2 pl-3 font-medium">Posting</th>
										</tr>
									</thead>
									<tbody>
										{schedule.entries.map((entry) => (
											<tr key={entry.id} className="border-b last:border-0">
												<td className="py-2 pr-3">{entry.sequence}</td>
												<td className="py-2 pr-3">
													{formatAssetDate(entry.scheduleDate)}
												</td>
												<td className="py-2 pr-3 text-right tabular-nums">
													₹{entry.depreciationAmount.toLocaleString("en-IN")}
												</td>
												<td className="py-2 pr-3 text-right tabular-nums">
													₹
													{entry.accumulatedDepreciationAmount.toLocaleString(
														"en-IN",
													)}
												</td>
												<td className="py-2 text-right tabular-nums">
													₹
													{entry.bookValueAfterDepreciation.toLocaleString(
														"en-IN",
													)}
												</td>
												<td className="py-2 pl-3">
													{entry.postingId ? "Posted" : "Pending"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					))
				)}
			</CardContent>
		</Card>
	);
}
