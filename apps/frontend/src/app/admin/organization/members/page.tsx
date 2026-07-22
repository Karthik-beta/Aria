"use client";

import { logger } from "@aria/utils";
import {
	Building,
	Loader2,
	Mail,
	Shield,
	Trash2,
	UserPlus,
	Users,
	X,
} from "lucide-react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth/client";
import { getToastMessage } from "@/lib/errors";

type Member = {
	id: string;
	userId: string;
	organizationId: string;
	role: string;
	createdAt: string;
	user: {
		id: string;
		name: string;
		email: string;
		role: string | null;
	};
};

type Organization = {
	id: string;
	name: string;
	slug: string;
};

export default function OrgMembersPage() {
	const { hasAnyRole } = useAuth();
	const isSuperAdmin = hasAnyRole("super_admin");
	const [org, setOrg] = useState<Organization | null>(null);
	const [members, setMembers] = useState<Member[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [showAddMember, setShowAddMember] = useState(false);
	const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
	const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
	const [removePending, setRemovePending] = useState(false);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		try {
			const { data: orgs } = await authClient.organization.list();
			if (orgs && orgs.length > 0) {
				const firstOrg = orgs[0] as unknown as Organization;
				setOrg(firstOrg);
				const { data: memberList } = await authClient.organization.listMembers(
					{},
				);
				if (memberList) {
					setMembers(memberList as unknown as Member[]);
				}
			} else {
				setOrg(null);
				setMembers([]);
			}
		} catch (err) {
			logger.error("Failed to fetch organization", err);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const handleRemoveClick = (member: Member) => {
		setMemberToRemove(member);
		setRemoveDialogOpen(true);
	};

	const handleRemoveConfirm = async () => {
		if (!memberToRemove) return;
		setRemovePending(true);
		try {
			const { error } = await authClient.organization.removeMember({
				memberIdOrEmail: memberToRemove.user.email,
			});
			if (error) {
				toast.error(getToastMessage(error, "delete"));
				return;
			}
			toast.success("Member removed");
			setRemoveDialogOpen(false);
			setMemberToRemove(null);
			fetchData();
		} catch (err) {
			logger.error("Remove member failed", err);
			toast.error(getToastMessage(err, "delete"));
		} finally {
			setRemovePending(false);
		}
	};

	const roleBadgeVariant = (role: string) => {
		switch (role) {
			case "owner":
				return "destructive" as const;
			case "admin":
				return "default" as const;
			default:
				return "secondary" as const;
		}
	};

	function OrgMembersPageLoadingSkeleton() {
		return (
			<div className="flex flex-1 flex-col gap-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<Skeleton className="h-8 w-8" />
							<Skeleton className="h-8 w-48" />
						</div>
						<Skeleton className="h-4 w-64" />
					</div>
					<div className="flex gap-2">
						<Skeleton className="h-8 w-24" />
						<Skeleton className="h-8 w-28" />
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-3">
					<Card className="border-muted/60 shadow-sm">
						<CardHeader className="pb-2">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Total Members
							</p>
						</CardHeader>
						<CardContent className="pb-4">
							<Skeleton className="h-8 w-12" />
						</CardContent>
					</Card>
				</div>

				<div className="min-h-[28rem] rounded-lg border bg-card">
					<ScrollArea className="h-[28rem]">
						<div className="p-4 space-y-2">
							{[0, 1, 2, 3, 4].map((i) => (
								<div
									key={i}
									className="flex items-center justify-between rounded-lg border p-4"
								>
									<div className="flex items-center gap-4">
										<Skeleton className="h-10 w-10 rounded-full" />
										<div className="space-y-2">
											<Skeleton className="h-4 w-32" />
											<Skeleton className="h-3 w-40" />
										</div>
									</div>
									<div className="flex items-center gap-3">
										<Skeleton className="h-5 w-16" />
										<Skeleton className="h-8 w-8" />
									</div>
								</div>
							))}
						</div>
					</ScrollArea>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<PageContainer>
				<OrgMembersPageLoadingSkeleton />
			</PageContainer>
		);
	}

	if (!org) {
		return (
			<PageContainer>
				<div className="flex flex-col items-center justify-center h-64 gap-3">
					<Building className="h-12 w-12 text-muted-foreground opacity-50" />
					<p className="text-muted-foreground">No organization found</p>
					<Button variant="outline" size="sm" asChild>
						<Link href="/admin/organizations">
							<Users className="mr-2 h-4 w-4" /> Back to Organization
						</Link>
					</Button>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer scrollable={false}>
			<div className="flex flex-1 flex-col gap-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<div className="flex items-center gap-3">
							<Button variant="ghost" size="sm" asChild>
								<Link href="/admin/organizations">
									<Users className="h-4 w-4" />
								</Link>
							</Button>
							<h2 className="text-3xl font-bold tracking-tight">{org.name}</h2>
							<Badge variant="outline" className="text-sm">
								{org.slug}
							</Badge>
						</div>
						<p className="text-muted-foreground">
							Manage members and permissions for this organization
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => fetchData()}
							disabled={isLoading}
						>
							Refresh
						</Button>
						{isSuperAdmin && (
							<Button size="sm" onClick={() => setShowAddMember(true)}>
								<UserPlus className="mr-2 h-4 w-4" /> Add Member
							</Button>
						)}
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-3">
					<Card className="border-muted/60 shadow-sm">
						<CardHeader className="pb-2">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Total Members
							</p>
						</CardHeader>
						<CardContent className="pb-4">
							<div className="text-3xl font-semibold">{members.length}</div>
						</CardContent>
					</Card>
				</div>

				<div className="min-h-[28rem] rounded-lg border bg-card">
					{members.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
							<Users className="h-12 w-12 opacity-50" />
							<p>No members in this organization</p>
							{isSuperAdmin && (
								<Button size="sm" onClick={() => setShowAddMember(true)}>
									<UserPlus className="mr-2 h-4 w-4" /> Add First Member
								</Button>
							)}
						</div>
					) : (
						<ScrollArea className="h-[28rem]">
							<div className="p-4 space-y-2">
								{members.map((member) => (
									<div
										key={member.id}
										className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
									>
										<div className="flex items-center gap-4">
											<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
												<span className="text-sm font-semibold text-primary">
													{member.user.name.charAt(0)}
												</span>
											</div>
											<div>
												<div className="font-semibold">{member.user.name}</div>
												<div className="text-sm text-muted-foreground flex items-center gap-1">
													<Mail className="h-3 w-3" />
													{member.user.email}
												</div>
											</div>
										</div>
										<div className="flex items-center gap-3">
											<Badge
												variant={roleBadgeVariant(member.role)}
												className="text-xs"
											>
												<Shield className="mr-1 h-3 w-3" />
												{member.role}
											</Badge>
											{member.user.role && (
												<Badge variant="outline" className="text-xs">
													Global: {member.user.role}
												</Badge>
											)}
											{member.role !== "owner" && isSuperAdmin && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleRemoveClick(member)}
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

				{showAddMember && (
					<AddMemberPanel
						organizationId={org.id}
						onSuccess={() => {
							setShowAddMember(false);
							fetchData();
						}}
						onCancel={() => setShowAddMember(false)}
					/>
				)}
			</div>

			<AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove Member</AlertDialogTitle>
						<AlertDialogDescription>
							Remove &ldquo;{memberToRemove?.user.name}&rdquo; from this
							organization?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleRemoveConfirm}
							disabled={removePending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{removePending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Remove
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PageContainer>
	);
}

function AddMemberPanel({
	organizationId,
	onSuccess,
	onCancel,
}: {
	organizationId: string;
	onSuccess: () => void;
	onCancel: () => void;
}) {
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<"owner" | "admin" | "member">("member");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!email) return;
		setIsSubmitting(true);
		try {
			const { error } = await authClient.organization.inviteMember({
				email,
				role,
				organizationId,
			});
			if (error) {
				toast.error(getToastMessage(error, "create"));
				setIsSubmitting(false);
				return;
			}
			toast.success("Invitation sent successfully");
			onSuccess();
		} catch (err) {
			logger.error("Add member error", err);
			toast.error(getToastMessage(err, "create"));
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="mt-6 rounded-lg border bg-card p-6">
			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="flex items-start justify-between">
					<div>
						<h3 className="text-xl font-semibold">Add Organization Member</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Invite a user by email to join this organization
						</p>
					</div>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onCancel}
						>
							<X className="mr-2 h-4 w-4" /> Cancel
						</Button>
						<Button type="submit" size="sm" disabled={isSubmitting}>
							{isSubmitting ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<UserPlus className="mr-2 h-4 w-4" />
							)}
							Invite
						</Button>
					</div>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="member-email">
							Email <span className="text-destructive">*</span>
						</Label>
						<Input
							id="member-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="user@example.com"
							required
							disabled={isSubmitting}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="member-role">Role</Label>
						<Select
							value={role}
							onValueChange={(v) => setRole(v as "owner" | "admin" | "member")}
							disabled={isSubmitting}
						>
							<SelectTrigger id="member-role">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="member">Member</SelectItem>
								<SelectItem value="admin">Admin</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</form>
		</div>
	);
}
