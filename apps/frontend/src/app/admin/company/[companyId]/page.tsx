/**
 * Company Detail Page
 * View and manage an individual company record
 */

"use client";

import { ArrowLeft, Building2, Calendar, Edit, Tag, Trash } from "lucide-react";
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

export default function CompanyDetailPage() {
	const params = useParams();
	const router = useRouter();
	const companyId = params.companyId as string;
	const utils = trpc.useUtils();
	const [_isPending, startTransition] = React.useTransition();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	const { data: company, isLoading } = trpc.company.getCompanyById.useQuery(
		{ id: companyId },
		{
			refetchOnWindowFocus: true,
			refetchOnMount: true,
		},
	);

	const deleteMutation = trpc.company.deleteCompany.useMutation({
		onSuccess: () => {
			void utils.company.listCompanies.invalidate();
			toast.success("Company deleted successfully");
			startTransition(() => {
				router.push("/admin/company");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "delete"));
		},
	});

	const confirmDelete = () => {
		deleteMutation.mutate({ id: companyId });
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

	if (!company) {
		return (
			<div className="container mx-auto px-4 md:px-6 py-6">
				<Card>
					<CardContent className="flex flex-col items-center gap-4 py-16">
						<Building2 className="h-12 w-12 text-muted-foreground" />
						<CardTitle>Company Not Found</CardTitle>
						<CardDescription>
							The company you&apos;re looking for doesn&apos;t exist or has been
							deleted.
						</CardDescription>
						<Link
							href="/admin/company"
							className={buttonVariants({ variant: "outline" })}
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Companies
						</Link>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<>
			<AlertModal
				isOpen={isDeleteDialogOpen}
				onClose={() => setIsDeleteDialogOpen(false)}
				onConfirm={confirmDelete}
				loading={deleteMutation.isPending}
			/>

			<div className="container mx-auto px-4 md:px-6 py-6 space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<Link
							href="/admin/company"
							className={cn(
								buttonVariants({ variant: "outline", size: "icon" }),
							)}
						>
							<ArrowLeft className="h-4 w-4" />
						</Link>
						<div>
							<h1 className="text-2xl font-bold">{company.name}</h1>
							{company.abbreviation && (
								<p className="text-sm text-muted-foreground font-mono">
									{company.abbreviation}
								</p>
							)}
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Badge
							className={
								company.isGroup
									? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0"
									: "bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground border-0"
							}
						>
							{company.isGroup ? "Group" : "Company"}
						</Badge>
						<Badge
							className={
								company.disabled
									? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0"
									: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0"
							}
						>
							{company.disabled ? "Disabled" : "Active"}
						</Badge>
						<Link
							href={`/admin/company/form?id=${company.id}`}
							className={buttonVariants({
								variant: "outline",
								size: "sm",
							})}
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
							<DetailRow label="Company Name" value={company.name} />
							<DetailRow
								label="Abbreviation"
								value={
									company.abbreviation ? (
										<span className="font-mono text-xs">
											{company.abbreviation}
										</span>
									) : null
								}
							/>
							<DetailRow label="Country" value={company.country} />
							<DetailRow label="Currency" value={company.currency} />
							<DetailRow label="Tax ID" value={company.taxId} />
							<DetailRow label="Domain" value={company.domain} />
						</CardContent>
					</Card>

					{/* Hierarchy & Settings */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Building2 className="h-5 w-5" />
								Hierarchy & Settings
							</CardTitle>
						</CardHeader>
						<CardContent className="divide-y">
							<DetailRow
								label="Company Type"
								value={
									<Badge
										className={
											company.isGroup
												? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0"
												: "bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground border-0"
										}
									>
										{company.isGroup ? "Group Company" : "Leaf Company"}
									</Badge>
								}
							/>
							<DetailRow
								label="Parent Company"
								value={
									company.parentCompanyId && company.parentCompanyName ? (
										<Link
											href={`/admin/company/${company.parentCompanyId}`}
											className="text-primary hover:underline"
										>
											{company.parentCompanyName}
										</Link>
									) : (
										<span className="text-muted-foreground">—</span>
									)
								}
							/>
							<DetailRow
								label="Status"
								value={
									<Badge
										className={
											company.disabled
												? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0"
												: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0"
										}
									>
										{company.disabled ? "Disabled" : "Active"}
									</Badge>
								}
							/>
							<DetailRow
								label="Company ID"
								value={<span className="font-mono text-xs">{company.id}</span>}
							/>
						</CardContent>
					</Card>
				</div>

				<Separator />
				<div className="flex items-center gap-4 text-xs text-muted-foreground">
					<span className="flex items-center gap-1">
						<Calendar className="h-3 w-3" />
						Created: {new Date(company.createdAt).toLocaleString()}
					</span>
					<span>·</span>
					<span>
						Last updated: {new Date(company.updatedAt).toLocaleString()}
					</span>
				</div>
			</div>
		</>
	);
}
