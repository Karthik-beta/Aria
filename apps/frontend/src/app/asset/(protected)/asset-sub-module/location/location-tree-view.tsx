/**
 * Location tree view — lazily loaded hierarchy next to the table view.
 *
 * Roots and each expanded group's children come from
 * `asset.listLocationChildren` (port of ERPNext `get_children`), one level
 * per request. Write actions (edit, add child, delete) are only shown to
 * users who can manage assets.
 *
 * Client component: uses tRPC queries and local expansion state.
 */
"use client";

import type { Asset } from "@aria/types";
import {
	ChevronDown,
	ChevronRight,
	Edit,
	Folder,
	FolderOpen,
	MapPin,
	MoreHorizontal,
	Plus,
	Trash,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/error-display";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatArea } from "./location.utils";

const FORM_HREF = "/asset/asset-sub-module/location/form";

interface LocationTreeViewProps {
	canManageAssets: boolean;
	onDelete: (id: string) => void;
}

export function LocationTreeView({
	canManageAssets,
	onDelete,
}: LocationTreeViewProps) {
	const {
		data: roots,
		isLoading,
		error,
		refetch,
	} = trpc.asset.listLocationChildren.useQuery(
		{ parentId: null },
		{ refetchOnWindowFocus: false, retry: 2, staleTime: 30_000 },
	);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-2 rounded-lg border bg-background p-4">
				{["a", "b", "c", "d"].map((key) => (
					<Skeleton key={key} className="h-8 w-full" />
				))}
			</div>
		);
	}

	if (error) {
		return (
			<ErrorState
				error={error}
				operation="load"
				title="Failed to load locations"
				onRetry={() => void refetch()}
			/>
		);
	}

	if (!roots || roots.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 rounded-lg border bg-background py-12">
				<MapPin className="h-10 w-10 text-muted-foreground/40" />
				<p className="text-sm text-muted-foreground">No locations yet</p>
				{canManageAssets && (
					<Link
						href={FORM_HREF}
						className="inline-flex items-center text-sm text-primary hover:underline"
					>
						<Plus className="mr-1 h-4 w-4" />
						Add your first location
					</Link>
				)}
			</div>
		);
	}

	return (
		<div className="rounded-lg border bg-background p-2">
			<ul aria-label="Location tree" className="flex flex-col">
				{roots.map((node) => (
					<LocationTreeNodeItem
						key={node.id}
						node={node}
						depth={0}
						canManageAssets={canManageAssets}
						onDelete={onDelete}
					/>
				))}
			</ul>
		</div>
	);
}

function LocationTreeNodeItem({
	node,
	depth,
	canManageAssets,
	onDelete,
}: {
	node: Asset.LocationChildNode;
	depth: number;
	canManageAssets: boolean;
	onDelete: (id: string) => void;
}) {
	const [expanded, setExpanded] = React.useState(false);

	const {
		data: children,
		isLoading,
		error,
	} = trpc.asset.listLocationChildren.useQuery(
		{ parentId: node.id },
		{
			enabled: expanded && node.expandable,
			refetchOnWindowFocus: false,
			staleTime: 30_000,
		},
	);

	const Icon = node.isGroup ? (expanded ? FolderOpen : Folder) : MapPin;

	return (
		<li data-testid={`location-tree-node-${node.id}`}>
			<div
				className="group flex items-center gap-2 rounded-md py-1 pr-2 hover:bg-muted/50"
				style={{ paddingLeft: `${depth * 20 + 4}px` }}
			>
				{node.expandable ? (
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 shrink-0"
						aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
						aria-expanded={expanded}
						onClick={() => setExpanded((current) => !current)}
					>
						{expanded ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronRight className="h-4 w-4" />
						)}
					</Button>
				) : (
					<span className="h-6 w-6 shrink-0" aria-hidden="true" />
				)}

				<Icon
					className={
						node.isGroup
							? "h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
							: "h-4 w-4 shrink-0 text-muted-foreground"
					}
					aria-hidden="true"
				/>

				{canManageAssets ? (
					<Link
						href={`${FORM_HREF}?id=${node.id}`}
						className="truncate font-medium text-primary hover:underline"
					>
						{node.name}
					</Link>
				) : (
					<span className="truncate font-medium">{node.name}</span>
				)}

				<span className="sr-only">{node.isGroup ? "Group" : "Leaf"}</span>
				{node.isContainer && <Badge variant="outline">Container</Badge>}

				<span className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
					<span title="Assets at this location">
						{node.assetCount} {node.assetCount === 1 ? "asset" : "assets"}
					</span>
					<span title="Area" className="hidden min-w-24 text-right sm:inline">
						{formatArea(node.area)}
					</span>
				</span>

				{canManageAssets && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="h-8 w-8 p-0"
								aria-label={`Open actions for ${node.name}`}
							>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link href={`${FORM_HREF}?id=${node.id}`}>
									<Edit className="mr-2 h-4 w-4" />
									Edit Location
								</Link>
							</DropdownMenuItem>
							{node.isGroup && (
								<DropdownMenuItem asChild>
									<Link href={`${FORM_HREF}?parentId=${node.id}`}>
										<Plus className="mr-2 h-4 w-4" />
										Add Child Location
									</Link>
								</DropdownMenuItem>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => onDelete(node.id)}
								className="text-destructive"
							>
								<Trash className="mr-2 h-4 w-4" />
								Delete Location
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>

			{expanded && node.expandable && (
				<>
					{isLoading && (
						<Skeleton
							className="my-1 h-6 w-48"
							style={{ marginLeft: `${(depth + 1) * 20 + 32}px` }}
						/>
					)}
					{error && (
						<p
							className="py-1 text-sm text-destructive"
							style={{ marginLeft: `${(depth + 1) * 20 + 32}px` }}
						>
							Failed to load child locations
						</p>
					)}
					{children && (
						<ul className="flex flex-col">
							{children.map((child) => (
								<LocationTreeNodeItem
									key={child.id}
									node={child}
									depth={depth + 1}
									canManageAssets={canManageAssets}
									onDelete={onDelete}
								/>
							))}
						</ul>
					)}
				</>
			)}
		</li>
	);
}
