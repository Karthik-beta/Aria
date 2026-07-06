/**
 * Company Form Page
 * Create and edit company records with full validation
 */

"use client";

import { Company } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function CompanyFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const editId = searchParams.get("id");
	const isEditMode = !!editId;

	const [isSubmitting, setIsSubmitting] = useState(false);

	const { data: existingCompany, isLoading: isLoadingCompany } =
		trpc.company.getCompanyById.useQuery(
			{ id: editId ?? "" },
			{ enabled: isEditMode && !!editId },
		);

	const { data: groupCompaniesData } = trpc.company.listCompanies.useQuery(
		{ isGroup: true, take: 100 },
		{ refetchOnWindowFocus: false },
	);

	const groupCompanies = groupCompaniesData?.items ?? [];

	const form = useForm<Company.CreateCompanyInput>({
		resolver: zodResolver(Company.createCompanySchema),
		defaultValues: {
			name: "",
			abbreviation: null,
			country: null,
			currency: null,
			taxId: null,
			domain: null,
			isGroup: false,
			parentCompanyId: null,
		},
	});

	const {
		register,
		handleSubmit,
		formState: { errors, isDirty },
		setValue,
		watch,
		reset,
	} = form;

	const isGroup = watch("isGroup");
	const parentCompanyId = watch("parentCompanyId");

	// Populate form in edit mode
	useEffect(() => {
		if (existingCompany && isEditMode) {
			reset({
				name: existingCompany.name,
				abbreviation: existingCompany.abbreviation,
				country: existingCompany.country,
				currency: existingCompany.currency,
				taxId: existingCompany.taxId,
				domain: existingCompany.domain,
				isGroup: existingCompany.isGroup,
				parentCompanyId: existingCompany.parentCompanyId,
			});
		}
	}, [existingCompany, isEditMode, reset]);

	const createMutation = trpc.company.createCompany.useMutation({
		onSuccess: (data) => {
			toast.success("Company created successfully");
			router.push(`/admin/company/${data.id}`);
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
		onSettled: () => {
			setIsSubmitting(false);
		},
	});

	const updateMutation = trpc.company.updateCompany.useMutation({
		onSuccess: (data) => {
			toast.success("Company updated successfully");
			router.push(`/admin/company/${data.id}`);
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
		onSettled: () => {
			setIsSubmitting(false);
		},
	});

	const onSubmit = useCallback(
		(data: Company.CreateCompanyInput) => {
			setIsSubmitting(true);
			if (isEditMode && editId) {
				updateMutation.mutate({
					id: editId,
					...data,
				});
			} else {
				createMutation.mutate(data);
			}
		},
		[isEditMode, editId, createMutation, updateMutation],
	);

	if (isEditMode && isLoadingCompany) {
		return (
			<div className="container mx-auto px-4 md:px-6 py-6 space-y-6">
				<div className="flex items-center gap-4">
					<Skeleton className="h-10 w-10" />
					<Skeleton className="h-8 w-64" />
				</div>
				<Skeleton className="h-96 w-full" />
			</div>
		);
	}

	if (isEditMode && !existingCompany && !isLoadingCompany) {
		return (
			<div className="container mx-auto px-4 md:px-6 py-6">
				<Card>
					<CardContent className="flex flex-col items-center gap-4 py-16">
						<CardTitle>Company Not Found</CardTitle>
						<CardDescription>
							The company you&apos;re trying to edit doesn&apos;t exist.
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
		<div className="container mx-auto px-4 md:px-6 py-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-4">
					<Link
						href="/admin/company"
						className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
					>
						<ArrowLeft className="h-4 w-4" />
					</Link>
					<div>
						<h1 className="text-2xl font-bold">
							{isEditMode
								? (existingCompany?.name ?? "Edit Company")
								: "New Company"}
						</h1>
						<p className="text-sm text-muted-foreground">
							{isEditMode
								? "Update company details"
								: "Create a new company record"}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{isDirty && (
						<Badge
							variant="outline"
							className="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
						>
							Not Saved
						</Badge>
					)}
					<Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
						{isSubmitting ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Save className="mr-2 h-4 w-4" />
						)}
						{isEditMode ? "Update" : "Create"}
					</Button>
				</div>
			</div>

			<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Basic Information</CardTitle>
						<CardDescription>
							Core company details and identification
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="name">
									Company Name <span className="text-destructive">*</span>
								</Label>
								<Input
									id="name"
									{...register("name")}
									placeholder="e.g. Acme Corporation"
									className={errors.name ? "border-destructive" : ""}
								/>
								{errors.name && (
									<p className="text-sm text-destructive">
										{errors.name.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="abbreviation">Abbreviation</Label>
								<Input
									id="abbreviation"
									{...register("abbreviation")}
									placeholder="e.g. ACME"
									className={errors.abbreviation ? "border-destructive" : ""}
								/>
								{errors.abbreviation && (
									<p className="text-sm text-destructive">
										{errors.abbreviation.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="country">Country</Label>
								<Input
									id="country"
									{...register("country")}
									placeholder="e.g. United States"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="currency">Currency</Label>
								<Input
									id="currency"
									{...register("currency")}
									placeholder="e.g. USD"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="taxId">Tax ID</Label>
								<Input
									id="taxId"
									{...register("taxId")}
									placeholder="e.g. 123-456-789"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="domain">Domain</Label>
								<Input
									id="domain"
									{...register("domain")}
									placeholder="e.g. Manufacturing"
								/>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Organization Structure</CardTitle>
						<CardDescription>
							Define the company hierarchy and grouping
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center gap-3">
							<Checkbox
								id="isGroup"
								checked={isGroup}
								onCheckedChange={(checked) =>
									setValue("isGroup", !!checked, { shouldDirty: true })
								}
							/>
							<div>
								<Label htmlFor="isGroup" className="cursor-pointer">
									Group Company
								</Label>
								<p className="text-xs text-muted-foreground">
									Enable this if the company is a holding or parent company that
									owns other companies
								</p>
							</div>
						</div>

						{!isGroup && groupCompanies.length > 0 && (
							<div className="space-y-2">
								<Label htmlFor="parentCompanyId">Parent Company</Label>
								<select
									id="parentCompanyId"
									value={parentCompanyId ?? ""}
									onChange={(e) =>
										setValue("parentCompanyId", e.target.value || null, {
											shouldDirty: true,
										})
									}
									className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<option value="">None (Top-level company)</option>
									{groupCompanies.map((gc) => (
										<option key={gc.id} value={gc.id}>
											{gc.name}
										</option>
									))}
								</select>
								<p className="text-xs text-muted-foreground">
									Select a group company this company belongs to
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				<Separator />

				<div className="flex items-center justify-end gap-4">
					<Button variant="outline" asChild>
						<Link href="/admin/company">Cancel</Link>
					</Button>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Save className="mr-2 h-4 w-4" />
						)}
						{isEditMode ? "Update Company" : "Create Company"}
					</Button>
				</div>
			</form>
		</div>
	);
}

export default function CompanyFormPage() {
	return (
		<Suspense
			fallback={
				<div className="flex h-64 items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			}
		>
			<CompanyFormContent />
		</Suspense>
	);
}
