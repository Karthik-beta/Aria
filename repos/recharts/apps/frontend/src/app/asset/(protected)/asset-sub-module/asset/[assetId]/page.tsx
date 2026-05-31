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
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

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

	const { data: rawData, isLoading } = trpc.asset.getAssetById.useQuery(
		{ id: assetId },
		{
			refetchOnWindowFocus: true,
			refetchOnMount: true,
		},
	);

	const asset = rawData as Asset.AssetItem | undefined;

	const deleteMutation = trpc.asset.deleteAsset.useMutation({
		onSuccess: () => {
			void utils.asset.listAssets.invalidate();
			toast.success("Asset deleted successfully");
			startTransition(() => {
				router.push("/asset/asset-sub-module/asset");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "delete"));
		},
	});

	const confirmDelete = () => {
		deleteMutation.mutate({ id: assetId });
	};

	if (isLoading) {
		return (
			<div className="container mx-auto py-6 space-y-6">
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
			<div className="container mx-auto py-6">
				<Card>
					<CardContent className="flex flex-col items-center gap-4 py-16">
						<Tag className="h-12 w-12 text-muted-foreground" />
						<CardTitle>Asset Not Found</CardTitle>
						<CardDescription>
							The asset you&apos;re looking for doesn&apos;t exist or has been
							deleted.
						</CardDescription>
						<Link
							href="/asset/asset-sub-module/asset"
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

			<div className="container mx-auto py-6 space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<Link
							href="/asset/asset-sub-module/asset"
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
						<Link
							href={`/asset/asset-sub-module/asset/form?id=${asset.id}`}
							className={buttonVariants({ variant: "outline", size: "sm" })}
						>
							<Edit className="mr-2 h-4 w-4" />
							Edit
						</Link>
						<Button
							variant="destructive"
							size="sm"
							onClick={() => setIsDeleteDialogOpen(true)}
						>
							<Trash className="mr-2 h-4 w-4" />
							Delete
						</Button>
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
											{new Date(asset.purchaseDate).toLocaleDateString()}
										</span>
									) : null
								}
							/>
							<DetailRow
								label="Available For Use"
								value={
									asset.availableForUseDate
										? new Date(asset.availableForUseDate).toLocaleDateString()
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
										? new Date(asset.insuranceStartDate).toLocaleDateString()
										: null
								}
							/>
							<DetailRow
								label="Insurance End"
								value={
									asset.insuranceEndDate
										? new Date(asset.insuranceEndDate).toLocaleDateString()
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
