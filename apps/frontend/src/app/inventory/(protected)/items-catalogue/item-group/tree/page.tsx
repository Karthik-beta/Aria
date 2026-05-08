"use client";

import {
	Circle,
	Folder,
	FolderOpen,
	MoreHorizontal,
	Plus,
	Search,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type RawItemGroup = {
	id: string;
	groupName: string;
	isGroup: boolean;
	parentId: string | null;
};

type TreeNode = {
	id: string;
	groupName: string;
	isGroup: boolean;
	children: TreeNode[];
	parentId?: string | null;
};

interface TreeItemProps {
	node: TreeNode;
	level: number;
	expanded: Set<string>;
	onToggle: (id: string) => void;
	onDelete?: (id: string) => void;
}

const TreeItem = ({
	node,
	level,
	expanded,
	onToggle,
	onDelete,
}: TreeItemProps) => {
	const isExpanded = expanded.has(node.id);
	const hasChildren = node.children && node.children.length > 0;
	const isGroup = node.isGroup;
	const isRoot = node.id === "root";

	return (
		<div className="w-full">
			<div
				className={cn(
					"flex items-center py-2 px-4 hover:bg-muted/30 group cursor-pointer transition-colors min-h-[44px] w-full",
					level === 0 && !isRoot
						? "font-semibold text-foreground"
						: "font-normal text-foreground/80",
				)}
				style={{ paddingLeft: `${level * 24 + 16}px` }}
			>
				<button
					type="button"
					className="flex items-center gap-3 flex-1 text-left"
					onClick={() => isGroup && onToggle(node.id)}
				>
					{isGroup ? (
						isExpanded ? (
							<FolderOpen className="h-4.5 w-4.5 text-muted-foreground/60" />
						) : (
							<Folder className="h-4.5 w-4.5 text-muted-foreground/60" />
						)
					) : (
						<div className="w-4.5 flex justify-center">
							<Circle className="h-1.5 w-1.5 fill-muted-foreground/30 text-muted-foreground/30" />
						</div>
					)}
					<span
						className={cn(
							"text-[14px]",
							isRoot ? "font-bold text-[15px] text-foreground" : "",
						)}
					>
						{node.groupName}
					</span>
				</button>

				{/* Inline Actions */}
				<div className="flex items-center gap-1.5 ml-6 opacity-0 group-hover:opacity-100 transition-opacity">
					{!isRoot && (
						<Button
							variant="secondary"
							size="sm"
							className="h-6.5 px-3 text-[11px] bg-muted/60 hover:bg-muted border-none rounded-[4px] font-medium text-foreground/80 transition-all"
							asChild
							onClick={(e) => e.stopPropagation()}
						>
							<Link
								href={`/inventory/items-catalogue/item-group/form?id=${node.id}`}
							>
								Edit
							</Link>
						</Button>
					)}
					{(isGroup || isRoot) && (
						<Button
							variant="secondary"
							size="sm"
							className="h-6.5 px-3 text-[11px] bg-muted/60 hover:bg-muted border-none rounded-[4px] font-medium text-foreground/80 transition-all"
							asChild
							onClick={(e) => e.stopPropagation()}
						>
							<Link
								href={`/inventory/items-catalogue/item-group/form?parentId=${isRoot ? "" : node.id}`}
							>
								Add Child
							</Link>
						</Button>
					)}
					{!isRoot && (
						<Button
							variant="secondary"
							size="sm"
							className="h-6.5 px-3 text-[11px] bg-muted/60 hover:bg-muted border-none rounded-[4px] font-medium text-destructive hover:bg-destructive/10 transition-all"
							onClick={(e) => {
								e.stopPropagation();
								if (
									confirm("Are you sure you want to delete this item group?")
								) {
									onDelete?.(node.id);
								}
							}}
						>
							Delete
						</Button>
					)}
				</div>
			</div>

			{(isExpanded || isRoot) && hasChildren && (
				<div className="w-full">
					{node.children.map((child) => (
						<TreeItem
							key={child.id}
							node={child}
							level={level + 1}
							expanded={expanded}
							onToggle={onToggle}
							onDelete={onDelete}
						/>
					))}
				</div>
			)}
		</div>
	);
};

export default function ItemGroupTreePage() {
	const [expanded, setExpanded] = React.useState<Set<string>>(
		new Set(["root"]),
	);
	const [searchQuery, setSearchQuery] = React.useState("");
	const utils = trpc.useUtils();

	const { data: rawGroups = [], isLoading } =
		trpc.inventory.listItemGroups.useQuery(
			searchQuery ? { search: searchQuery } : undefined,
		);

	const deleteMutation = trpc.inventory.deleteItemGroup.useMutation({
		onSuccess: () => {
			toast.success("Item Group deleted");
			utils.inventory.listItemGroups.invalidate();
		},
	});

	const treeData = React.useMemo(() => {
		const itemMap = new Map<string, TreeNode>();
		const roots: TreeNode[] = [];

		(rawGroups as RawItemGroup[]).forEach((item) => {
			itemMap.set(item.id, { ...item, children: [] });
		});

		(rawGroups as RawItemGroup[]).forEach((item) => {
			const node = itemMap.get(item.id);
			if (!node) return;
			if (item.parentId) {
				const parentNode = itemMap.get(item.parentId);
				if (parentNode) {
					parentNode.children.push(node);
					return;
				}
			}
			roots.push(node);
		});

		const rootNode: TreeNode = {
			id: "root",
			groupName: "All Item Groups",
			isGroup: true,
			children: roots,
		};

		return [rootNode];
	}, [rawGroups]);

	const handleToggle = (id: string) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const expandAll = () => {
		const allIds = new Set<string>(["root"]);
		const traverse = (nodes: TreeNode[]) => {
			nodes.forEach((node) => {
				if (node.isGroup) {
					allIds.add(node.id);
					if (node.children) traverse(node.children);
				}
			});
		};
		traverse(treeData);
		setExpanded(allIds);
	};

	const collapseAll = () => {
		setExpanded(new Set(["root"]));
	};

	const handleDelete = (id: string) => {
		deleteMutation.mutate({ id });
	};

	if (isLoading && !searchQuery) {
		return (
			<div className="flex flex-col h-full w-full bg-background">
				<div className="p-8 pb-4 space-y-6 flex-shrink-0">
					<div className="flex items-center justify-between px-2">
						<div>
							<h1 className="text-2xl font-bold tracking-tight">
								Item Group Tree
							</h1>
						</div>
						<div className="flex items-center gap-2">
							<Skeleton className="h-8 w-24" />
							<Skeleton className="h-8 w-24" />
							<Skeleton className="h-8 w-8" />
							<Skeleton className="h-8 w-16" />
						</div>
					</div>
				</div>
				<div className="flex-1 p-8 pt-4">
					<div className="bg-card border rounded-lg shadow-sm overflow-hidden min-h-[600px] w-full">
						<div className="p-6 border-b bg-muted/20">
							<Skeleton className="h-10 w-full max-w-sm" />
						</div>
						<div className="py-4 space-y-2 px-4">
							{Array.from({ length: 6 }).map((_, i) => (
								<div key={i} className="flex items-center gap-3 py-2">
									<Skeleton className="h-4 w-4" />
									<Skeleton className="h-4 w-32" />
									<div className="ml-auto flex gap-2">
										<Skeleton className="h-6 w-12" />
										<Skeleton className="h-6 w-16" />
										<Skeleton className="h-6 w-14" />
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full w-full bg-background">
			<div className="p-8 pb-4 space-y-6 flex-shrink-0">
				<div className="flex items-center justify-between px-2">
					<div>
						<h1 className="text-2xl font-bold tracking-tight">
							Item Group Tree
						</h1>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="secondary"
							size="sm"
							onClick={collapseAll}
							className="h-8 bg-muted/60 hover:bg-muted font-medium text-[13px] px-3"
						>
							Collapse All
						</Button>
						<Button
							variant="secondary"
							size="sm"
							onClick={expandAll}
							className="h-8 bg-muted/60 hover:bg-muted font-medium text-[13px] px-3"
						>
							Expand All
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="secondary"
									size="icon"
									className="h-8 w-8 bg-muted/60 hover:bg-muted"
								>
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-[160px]">
								<DropdownMenuItem asChild>
									<Link href="/inventory/items-catalogue/item-group">
										View List
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => window.print()}>
									Print
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => utils.inventory.listItemGroups.invalidate()}
								>
									Refresh
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<Button
							size="sm"
							className="h-8 bg-foreground hover:bg-foreground/90 text-background font-medium text-[13px]"
							asChild
						>
							<Link href="/inventory/items-catalogue/item-group/form">
								<Plus className="mr-1 h-3.5 w-3.5" />
								New
							</Link>
						</Button>
					</div>
				</div>
			</div>

			<div className="flex-1 p-8 pt-4">
				<div className="bg-card border rounded-lg shadow-sm overflow-hidden min-h-[600px] w-full">
					<div className="p-6 border-b bg-muted/20">
						<div className="relative max-w-sm">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
							<Input
								placeholder="Search item groups..."
								className="pl-9 h-10 bg-background border-muted-foreground/10 focus-visible:ring-1 focus-visible:ring-muted-foreground/20"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>
					</div>
					<div className="py-4 w-full">
						{treeData.map((rootNode) => (
							<TreeItem
								key={rootNode.id}
								node={rootNode}
								level={0}
								expanded={expanded}
								onToggle={handleToggle}
								onDelete={handleDelete}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
