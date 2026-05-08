"use client";

import { logger } from "@aria/utils";
import { Building, Loader2, Mail, Shield, Trash2, Users } from "lucide-react";
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
};

type Member = {
	id: string;
	userId: string;
	role: string;
	createdAt: string;
	user: {
		id: string;
		name: string;
		email: string;
		image?: string | null;
	};
};

export default function OrganizationsPage() {
	const [org, setOrg] = useState<Organization | null>(null);
	const [members, setMembers] = useState<Member[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
	const [isInviting, setIsInviting] = useState(false);
	const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
	const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
	const [isRemoving, setIsRemoving] = useState(false);
	const { hasAnyRole, user } = useAuth();

	const isSuperAdmin = hasAnyRole("super_admin");
	const canManage = isSuperAdmin || user?.role === "admin";

	const fetchOrgAndMembers = useCallback(async () => {
		setIsLoading(true);
		try {
			const { data: orgs } = await authClient.organization.list();
			if (orgs && orgs.length > 0) {
				setOrg(orgs[0] as unknown as Organization);
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
		fetchOrgAndMembers();
	}, [fetchOrgAndMembers]);

	const handleInvite = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!inviteEmail.trim()) return;

		setIsInviting(true);
		try {
			const { error } = await authClient.organization.inviteMember({
				email: inviteEmail.trim(),
				role: inviteRole,
			});
			if (error) {
				toast.error(error.message || "Failed to send invitation");
				return;
			}
			toast.success(`Invitation sent to ${inviteEmail}`);
			setInviteEmail("");
			fetchOrgAndMembers();
		} catch (err) {
			logger.error("Invite failed", err);
			toast.error("Failed to send invitation");
		} finally {
			setIsInviting(false);
		}
	};

	const handleRemoveClick = (member: Member) => {
		setMemberToRemove(member);
		setRemoveDialogOpen(true);
	};

	const handleRemoveConfirm = async () => {
		if (!memberToRemove) return;
		setIsRemoving(true);
		try {
			const { error } = await authClient.organization.removeMember({
				memberIdOrEmail: memberToRemove.user.email,
			});
			if (error) {
				toast.error(error.message || "Failed to remove member");
				return;
			}
			toast.success(`${memberToRemove.user.name} removed from organization`);
			setRemoveDialogOpen(false);
			setMemberToRemove(null);
			fetchOrgAndMembers();
		} catch (err) {
			logger.error("Remove member failed", err);
			toast.error("Failed to remove member");
		} finally {
			setIsRemoving(false);
		}
	};

	const roleBadgeVariant = (role: string) => {
		switch (role) {
			case "owner":
				return "default" as const;
			case "admin":
				return "secondary" as const;
			default:
				return "outline" as const;
		}
	};

	const roleLabel = (role: string) => {
		switch (role) {
			case "owner":
				return "Owner";
			case "admin":
				return "Admin";
			default:
				return "Member";
		}
	};

	return (
		<PageContainer scrollable={false}>
			<div className="flex flex-1 flex-col gap-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<h2 className="text-3xl font-bold tracking-tight">Organization</h2>
						<p className="text-muted-foreground">
							Manage your organization settings and members.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => fetchOrgAndMembers()}
						disabled={isLoading}
					>
						Refresh
					</Button>
				</div>

				{isLoading ? (
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{[0, 1, 2, 3].map((i) => (
							<Card key={i} className="border-muted/60 bg-card/90 shadow-sm">
								<CardHeader className="pb-2">
									<Skeleton className="h-3 w-24" />
								</CardHeader>
								<CardContent className="pb-4">
									<Skeleton className="h-8 w-12" />
								</CardContent>
							</Card>
						))}
					</div>
				) : !org ? (
					<div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
						<Building className="h-12 w-12 opacity-50" />
						<p>No organization found</p>
					</div>
				) : (
					<div className="flex flex-col gap-6">
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							<Card className="border-muted/60 bg-card/90 shadow-sm">
								<CardHeader className="pb-2">
									<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
										Organization Name
									</p>
								</CardHeader>
								<CardContent className="pb-4">
									<div className="text-2xl font-semibold tracking-tight truncate">
										{org.name}
									</div>
								</CardContent>
							</Card>
							<Card className="border-muted/60 bg-card/90 shadow-sm">
								<CardHeader className="pb-2">
									<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
										Total Members
									</p>
								</CardHeader>
								<CardContent className="pb-4">
									<div className="text-2xl font-semibold tracking-tight">
										{members.length}
									</div>
								</CardContent>
							</Card>
							<Card className="border-muted/60 bg-card/90 shadow-sm">
								<CardHeader className="pb-2">
									<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
										Slug
									</p>
								</CardHeader>
								<CardContent className="pb-4">
									<code className="text-sm font-mono">{org.slug}</code>
								</CardContent>
							</Card>
							<Card className="border-muted/60 bg-card/90 shadow-sm">
								<CardHeader className="pb-2">
									<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
										Created
									</p>
								</CardHeader>
								<CardContent className="pb-4">
									<div className="text-lg font-semibold tracking-tight">
										{new Date(org.createdAt).toLocaleDateString()}
									</div>
								</CardContent>
							</Card>
						</div>

						{canManage && (
							<Card className="border-muted/60 bg-card">
								<CardHeader>
									<div className="flex items-center gap-2">
										<Mail className="h-4 w-4" />
										<h3 className="text-lg font-semibold">Invite Member</h3>
									</div>
								</CardHeader>
								<CardContent>
									<form
										onSubmit={handleInvite}
										className="flex gap-3 items-end"
									>
										<div className="flex-1 space-y-2">
											<Label htmlFor="invite-email">Email address</Label>
											<Input
												id="invite-email"
												type="email"
												placeholder="colleague@company.com"
												value={inviteEmail}
												onChange={(e) => setInviteEmail(e.target.value)}
												disabled={isInviting}
												required
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="invite-role">Role</Label>
											<select
												id="invite-role"
												value={inviteRole}
												onChange={(e) =>
													setInviteRole(e.target.value as "admin" | "member")
												}
												disabled={isInviting}
												className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
											>
												<option value="member">Member</option>
												<option value="admin">Admin</option>
											</select>
										</div>
										<Button type="submit" disabled={isInviting}>
											{isInviting ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<Mail className="mr-2 h-4 w-4" />
											)}
											Invite
										</Button>
									</form>
								</CardContent>
							</Card>
						)}

						<Card className="border-muted/60 bg-card">
							<CardHeader>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Users className="h-4 w-4" />
										<h3 className="text-lg font-semibold">Members</h3>
									</div>
									<Badge variant="secondary">{members.length}</Badge>
								</div>
							</CardHeader>
							<CardContent className="p-0">
								{members.length === 0 ? (
									<div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
										<Users className="h-8 w-8 opacity-50" />
										<p>No members yet</p>
									</div>
								) : (
									<ScrollArea className="h-[20rem]">
										<div className="divide-y">
											{members.map((member) => (
												<div
													key={member.id}
													className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
												>
													<div className="flex items-center gap-4">
														<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
															<span className="text-sm font-semibold">
																{member.user.name.charAt(0).toUpperCase()}
															</span>
														</div>
														<div>
															<div className="font-semibold">
																{member.user.name}
															</div>
															<div className="text-sm text-muted-foreground">
																{member.user.email}
															</div>
														</div>
													</div>
													<div className="flex items-center gap-3">
														<Badge variant={roleBadgeVariant(member.role)}>
															{member.role === "admin" && (
																<Shield className="mr-1 h-3 w-3" />
															)}
															{roleLabel(member.role)}
														</Badge>
														{member.role !== "owner" && canManage && (
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
							</CardContent>
						</Card>
					</div>
				)}

				<AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Remove Member</AlertDialogTitle>
							<AlertDialogDescription>
								Remove &ldquo;{memberToRemove?.user.name}&rdquo; from the
								organization? They will lose access to all apps.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={handleRemoveConfirm}
								disabled={isRemoving}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								{isRemoving && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								Remove
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</PageContainer>
	);
}
