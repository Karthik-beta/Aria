"use client";

import { logger } from "@aria/utils";
import { Building, Loader2, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import PageContainer from "@/components/layout/page-container";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth/client";

type Organization = {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	metadata: string | null;
	createdAt: string;
	membersCount?: number;
};

export default function OrganizationsPage() {
	const [orgs, setOrgs] = useState<Organization[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [showCreate, setShowCreate] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
	const [deletePending, setDeletePending] = useState(false);
	const { hasAnyRole } = useAuth();

	const isSuperAdmin = hasAnyRole("super_admin");

	const fetchOrgs = useCallback(async () => {
		setIsLoading(true);
		try {
			const { data } = await authClient.organization.list();
			if (data) {
				setOrgs(data as unknown as Organization[]);
			}
		} catch (err) {
			logger.error("Failed to fetch organizations", err);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchOrgs();
	}, [fetchOrgs]);

	const handleDeleteClick = (org: Organization) => {
		setOrgToDelete(org);
		setDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (!orgToDelete) return;
		setDeletePending(true);
		try {
			await authClient.organization.delete({
				organizationId: orgToDelete.id,
			});
			toast.success(`"${orgToDelete.name}" deleted`);
			setDeleteDialogOpen(false);
			setOrgToDelete(null);
			fetchOrgs();
		} catch (err) {
			logger.error("Delete organization failed", err);
			toast.error("Failed to delete organization");
		} finally {
			setDeletePending(false);
		}
	};

	return (
		<PageContainer scrollable={false}>
			<div className="flex flex-1 flex-col gap-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<h2 className="text-3xl font-bold tracking-tight">
							App Organizations
						</h2>
						<p className="text-muted-foreground">
							Manage organizations for each Aria ERP app domain. Each
							organization represents a workspace (HRMS, CRM, Asset, Inventory,
							Admin).
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => fetchOrgs()}
							disabled={isLoading}
						>
							Refresh
						</Button>
						{isSuperAdmin && (
							<Button size="sm" onClick={() => setShowCreate(true)}>
								<Plus className="mr-2 h-4 w-4" /> Create Organization
							</Button>
						)}
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{isLoading ? (
						<Card className="border-muted/60 bg-card/90 shadow-sm">
							<CardHeader className="pb-2">
								<Skeleton className="h-3 w-24" />
							</CardHeader>
							<CardContent className="pb-4">
								<Skeleton className="h-8 w-12" />
							</CardContent>
						</Card>
					) : (
						<Card className="border-muted/60 bg-card/90 shadow-sm">
							<CardHeader className="pb-2">
								<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
									Total Organizations
								</p>
							</CardHeader>
							<CardContent className="pb-4">
								<div className="text-3xl font-semibold tracking-tight">
									{orgs.length}
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				<div className="min-h-[28rem] rounded-lg border bg-card">
					{isLoading ? (
						<ScrollArea className="h-[28rem]">
							<div className="p-4 space-y-2">
								{[0, 1, 2, 3, 4].map((i) => (
									<div
										key={i}
										className="flex items-center justify-between rounded-lg border p-4"
									>
										<div className="flex items-center gap-4">
											<Skeleton className="h-10 w-10 rounded-lg" />
											<div className="space-y-2">
												<Skeleton className="h-4 w-32" />
												<Skeleton className="h-3 w-24" />
											</div>
										</div>
										<div className="flex items-center gap-3">
											<Skeleton className="h-5 w-20" />
											<Skeleton className="h-8 w-20" />
										</div>
									</div>
								))}
							</div>
						</ScrollArea>
					) : orgs.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
							<Building className="h-12 w-12 opacity-50" />
							<p>No organizations found</p>
							{isSuperAdmin && (
								<Button size="sm" onClick={() => setShowCreate(true)}>
									<Plus className="mr-2 h-4 w-4" /> Create First Organization
								</Button>
							)}
						</div>
					) : (
						<ScrollArea className="h-[28rem]">
							<div className="p-4 space-y-2">
								{orgs.map((org) => (
									<div
										key={org.id}
										className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
									>
										<div className="flex items-center gap-4">
											<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
												<Building className="h-5 w-5 text-primary" />
											</div>
											<div>
												<div className="font-semibold">{org.name}</div>
												<div className="text-sm text-muted-foreground">
													<code className="text-xs">{org.slug}</code>
												</div>
											</div>
										</div>
										<div className="flex items-center gap-3">
											<Badge variant="secondary" className="text-xs">
												Created {new Date(org.createdAt).toLocaleDateString()}
											</Badge>
											<Button variant="outline" size="sm" asChild>
												<Link href={`/admin/organizations/${org.slug}`}>
													<Users className="mr-2 h-4 w-4" /> Members
												</Link>
											</Button>
											{isSuperAdmin && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleDeleteClick(org)}
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											)}
										</div>
									</div>
								))}
							</div>
						</ScrollArea>
					)}
				</div>

				{showCreate && (
					<CreateOrganizationPanel
						onSuccess={() => {
							setShowCreate(false);
							fetchOrgs();
						}}
						onCancel={() => setShowCreate(false)}
					/>
				)}
			</div>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Organization</AlertDialogTitle>
						<AlertDialogDescription>
							Delete &ldquo;{orgToDelete?.name}&rdquo;? All members and
							invitations will be removed. This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteConfirm}
							disabled={deletePending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deletePending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PageContainer>
	);
}

function CreateOrganizationPanel({
	onSuccess,
	onCancel,
}: {
	onSuccess: () => void;
	onCancel: () => void;
}) {
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		try {
			const { error } = await authClient.organization.create({
				name,
				slug,
			});
			if (error) {
				toast.error(error.message || "Failed to create organization");
				return;
			}
			toast.success(`"${name}" created successfully`);
			onSuccess();
		} catch (err) {
			logger.error("Create organization error", err);
			toast.error("Failed to create organization");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="mt-6 rounded-lg border bg-card p-6">
			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="flex items-start justify-between">
					<div>
						<h3 className="text-xl font-semibold">Create New Organization</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Create a new app workspace organization
						</p>
					</div>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onCancel}
						>
							Cancel
						</Button>
						<Button type="submit" size="sm" disabled={isSubmitting}>
							{isSubmitting ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Plus className="mr-2 h-4 w-4" />
							)}
							Create
						</Button>
					</div>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="org-name">
							Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="org-name"
							value={name}
							onChange={(e) => {
								setName(e.target.value);
								if (!slug || slug === name.toLowerCase().replace(/\s+/g, "-")) {
									setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
								}
							}}
							placeholder="Aria HRMS"
							required
							disabled={isSubmitting}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="org-slug">
							Slug <span className="text-destructive">*</span>
						</Label>
						<Input
							id="org-slug"
							value={slug}
							onChange={(e) => setSlug(e.target.value)}
							placeholder="hrms"
							required
							disabled={isSubmitting}
						/>
					</div>
				</div>
			</form>
		</div>
	);
}
