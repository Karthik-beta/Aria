/**
 * Inventory Item Detail Page
 * View and manage individual inventory item details
 *
 * Navigation: Uses Link components for client-side navigation without memory leaks
 * Edit: Redirects to dedicated edit page instead of modal
 */

"use client";

import type { Inventory } from "@aria/types";
import {
	AlertTriangle,
	ArrowLeft,
	Box,
	Calendar,
	CheckCircle2,
	Edit,
	Hash,
	Package,
	Trash,
	XCircle,
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
import { ActivityTimeline } from "@/features/inventory/components/activity-timeline";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// Stock status helper
const getStockStatus = (quantity: number) => {
	if (quantity === 0) {
		return {
			label: "Out of Stock",
			variant: "destructive" as const,
			icon: XCircle,
		};
	}
	if (quantity < 10) {
		return {
			label: "Low Stock",
			variant: "secondary" as const,
			icon: AlertTriangle,
		};
	}
	return { label: "In Stock", variant: "default" as const, icon: CheckCircle2 };
};

export default function InventoryItemDetailPage() {
	const params = useParams();
	const router = useRouter();
	const itemId = params.itemId as string;
	const utils = trpc.useUtils();
	const [_isPending, startTransition] = React.useTransition();

	// State - only for delete confirmation
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	// Fetch all items to find the current one
	// Enable staleTime but allow manual refetching
	const { data: items = [], isLoading } = trpc.inventory.listItems.useQuery(
		undefined,
		{
			refetchOnWindowFocus: true,
			refetchOnMount: true,
			staleTime: 1000, // Consider data stale after 1 second
		},
	);

	const item = items.find((i) => i.id === itemId) as Inventory.Item | undefined;

	// Delete mutation - only router.push after successful delete
	const deleteMutation = trpc.inventory.deleteItem.useMutation({
		onSuccess: () => {
			utils.inventory.listItems.invalidate();
			toast.success("Item deleted successfully");
			// Wrap router.push in startTransition to prevent React state update errors
			startTransition(() => {
				router.push("/inventory/items-catalogue/item");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "delete"));
		},
	});

	// Handlers
	const confirmDelete = () => {
		deleteMutation.mutate({ id: itemId });
	};

	// Loading state
	if (isLoading) {
		return (
			<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
				<div className="flex items-center gap-4">
					<Skeleton className="h-10 w-10" />
					<Skeleton className="h-8 w-64" />
				</div>
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	// Not found state
	if (!item) {
		return (
			<div className="flex flex-1 flex-col p-4 md:px-6">
				<Card>
					<CardHeader>
						<CardTitle>Item Not Found</CardTitle>
						<CardDescription>
							The inventory item you&apos;re looking for doesn&apos;t exist or
							has been deleted.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Link
							href="/inventory/items-catalogue/item"
							className={cn(buttonVariants({ variant: "default" }))}
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Inventory
						</Link>
					</CardContent>
				</Card>
			</div>
		);
	}

	const status = getStockStatus(item.quantity);
	const StatusIcon = status.icon;

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Link href="/inventory/items-catalogue/item">
						<Button variant="ghost" size="icon">
							<ArrowLeft className="h-5 w-4" />
						</Button>
					</Link>
					<div>
						<h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
						<p className="text-muted-foreground">Inventory item details</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Link
						href={`/inventory/items-catalogue/item/form?id=${itemId}`}
						className={cn(buttonVariants({ variant: "outline" }))}
					>
						<Edit className="mr-2 h-4 w-4" />
						Edit
					</Link>
					<Button
						variant="destructive"
						onClick={() => setIsDeleteDialogOpen(true)}
					>
						<Trash className="mr-2 h-4 w-4" />
						Delete
					</Button>
				</div>
			</div>

			{/* Main Content */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* Basic Information */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Package className="h-5 w-5" />
							Basic Information
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<p className="text-sm text-muted-foreground">Item Name</p>
							<p className="text-lg font-medium">{item.name}</p>
						</div>
						<Separator />
						<div>
							<p className="text-sm text-muted-foreground flex items-center gap-2">
								<Hash className="h-4 w-4" />
								Code
							</p>
							<code className="mt-1 inline-block rounded bg-muted px-3 py-1 text-sm font-mono">
								{item.code}
							</code>
						</div>
						<Separator />
						<div>
							<p className="text-sm text-muted-foreground">Description</p>
							<p className="mt-1 text-sm">
								{item.description || "No description provided"}
							</p>
						</div>
						<Separator />
						<div>
							<p className="text-sm text-muted-foreground flex items-center gap-2">
								<Box className="h-4 w-4" />
								Quantity
							</p>
							<div className="mt-1 flex items-center gap-2">
								<p className="text-2xl font-bold tabular-nums">
									{item.quantity}
								</p>
								<span className="text-muted-foreground">units</span>
							</div>
						</div>
						<Separator />
						<div>
							<p className="text-sm text-muted-foreground">Stock Status</p>
							<div className="mt-1">
								<Badge variant={status.variant} className="text-sm">
									<StatusIcon className="mr-2 h-4 w-4" />
									{status.label}
								</Badge>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Metadata & Settings */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Calendar className="h-5 w-5" />
							Metadata & Settings
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-sm text-muted-foreground">Status</p>
								<Badge
									variant={item.disabled ? "destructive" : "default"}
									className="mt-1"
								>
									{item.disabled ? "Disabled" : "Active"}
								</Badge>
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Maintain Stock</p>
								<Badge variant="outline" className="mt-1">
									{item.maintainStock ? "Yes" : "No"}
								</Badge>
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Allow Alternate</p>
								<Badge variant="outline" className="mt-1">
									{item.allowAlternateItem ? "Yes" : "No"}
								</Badge>
							</div>
						</div>
						<Separator />
						<div>
							<p className="text-sm text-muted-foreground">Item ID</p>
							<code className="mt-1 block rounded bg-muted px-3 py-2 text-xs font-mono">
								{item.id}
							</code>
						</div>
						<Separator />
						<div>
							<p className="text-sm text-muted-foreground">Created</p>
							<p className="mt-1 text-sm">
								{new Date(item.createdAt).toLocaleString("en-US", {
									year: "numeric",
									month: "long",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</p>
						</div>
						<Separator />
						<div>
							<p className="text-sm text-muted-foreground">Last Updated</p>
							<p className="mt-1 text-sm">
								{new Date(item.updatedAt).toLocaleString("en-US", {
									year: "numeric",
									month: "long",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Stock Alert */}
			{item.quantity < 10 && (
				<Card
					className={
						item.quantity === 0 ? "border-destructive" : "border-yellow-500"
					}
				>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-destructive">
							<AlertTriangle className="h-5 w-5" />
							{item.quantity === 0 ? "Out of Stock" : "Low Stock Alert"}
						</CardTitle>
						<CardDescription>
							{item.quantity === 0
								? "This item is currently out of stock. Consider restocking soon."
								: `Only ${item.quantity} units remaining. Consider restocking soon.`}
						</CardDescription>
					</CardHeader>
				</Card>
			)}

			{/* Delete Confirmation */}
			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => setIsDeleteDialogOpen(false)}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>

			{/* Activity Timeline */}
			<ActivityTimeline itemId={itemId} limit={50} />
		</div>
	);
}
