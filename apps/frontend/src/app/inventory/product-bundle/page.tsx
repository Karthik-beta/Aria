"use client";

import {
	ArrowUpDown,
	Filter,
	Heart,
	MessageCircle,
	MoreHorizontal,
	Plus,
	RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

function getRelativeAge(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffYears >= 1) return `${diffYears} y`;
	if (diffMonths >= 1) return `${diffMonths} m`;
	if (diffDays >= 1) return `${diffDays} d`;
	return "Today";
}

export default function ProductBundleListPage() {
	const {
		data: bundles = [],
		isLoading,
		refetch,
	} = trpc.inventory.listProductBundles.useQuery();
	const [search, setSearch] = useState("");

	const filteredRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return bundles;

		return bundles.filter((bundle) => {
			return (
				bundle.id.toLowerCase().includes(query) ||
				(bundle.parentItemName ?? "").toLowerCase().includes(query) ||
				(bundle.description ?? "").toLowerCase().includes(query)
			);
		});
	}, [bundles, search]);

	return (
		<div className="flex min-h-screen flex-col bg-[#f8f9fa] px-4 py-4 md:px-6">
			<div className="rounded-xl border bg-background">
				<div className="flex flex-wrap items-center justify-end gap-2 border-b px-4 py-3">
					<Select defaultValue="list">
						<SelectTrigger className="h-8 w-[130px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="list">List View</SelectItem>
						</SelectContent>
					</Select>
					<Button
						variant="outline"
						size="icon"
						className="h-8 w-8"
						onClick={() => void refetch()}
					>
						<RefreshCcw className="h-4 w-4" />
					</Button>
					<Button variant="outline" size="icon" className="h-8 w-8">
						<MoreHorizontal className="h-4 w-4" />
					</Button>
					<Button asChild className="h-8">
						<Link href="/inventory/product-bundle/new">
							<Plus className="mr-1.5 h-4 w-4" />
							Add Product Bundle
						</Link>
					</Button>
				</div>

				<div className="space-y-3 px-4 py-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="ID"
							className="h-8 max-w-[220px]"
						/>
						<div className="flex items-center gap-2">
							<Button variant="outline" className="h-8 px-3">
								<Filter className="mr-1.5 h-4 w-4" />
								Filter
							</Button>
							<Button variant="outline" className="h-8 px-3">
								<ArrowUpDown className="mr-1.5 h-4 w-4" />
								Last Updated On
							</Button>
						</div>
					</div>

					<div className="overflow-hidden rounded-md border bg-background">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-10">
										<Checkbox aria-label="Select all" />
									</TableHead>
									<TableHead>ID</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Parent Item</TableHead>
									<TableHead>Description</TableHead>
									<TableHead className="text-right">
										{filteredRows.length} of {filteredRows.length}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="h-24 text-center text-muted-foreground"
										>
											Loading bundles...
										</TableCell>
									</TableRow>
								) : filteredRows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="h-24 text-center text-muted-foreground"
										>
											No product bundles found.
										</TableCell>
									</TableRow>
								) : (
									filteredRows.map((bundle) => (
										<TableRow key={bundle.id}>
											<TableCell>
												<Checkbox aria-label={`Select ${bundle.id}`} />
											</TableCell>
											<TableCell className="font-medium">
												{bundle.id.slice(0, 5)}
											</TableCell>
											<TableCell>
												<span
													className={
														bundle.disabled
															? "text-muted-foreground"
															: "text-primary"
													}
												>
													{bundle.disabled ? "Disabled" : "Enabled"}
												</span>
											</TableCell>
											<TableCell>
												{bundle.parentItemName ??
													bundle.parentItemId.slice(0, 5)}
											</TableCell>
											<TableCell className="max-w-[350px] truncate text-muted-foreground">
												{bundle.description || "-"}
											</TableCell>
											<TableCell className="text-right text-muted-foreground">
												<div className="inline-flex items-center gap-2 text-xs">
													<span>
														{getRelativeAge(new Date(bundle.updatedAt))}
													</span>
													<MessageCircle className="h-4 w-4" />
													<span>0</span>
													<Heart className="h-4 w-4" />
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>

					<div className="flex items-center gap-1">
						{[20, 100, 500, 2500].map((value) => (
							<Button
								key={value}
								variant="outline"
								size="sm"
								className="h-7 px-2"
							>
								{value}
							</Button>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
