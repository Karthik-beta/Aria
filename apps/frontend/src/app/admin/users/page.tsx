"use client";

import { logger } from "@aria/utils";
import {
	Ban,
	Briefcase,
	Building,
	Check,
	CheckCircle,
	ClipboardCopy,
	Edit,
	Key,
	Loader2,
	Mail,
	Save,
	Search,
	ShieldCheck,
	Trash2,
	User as UserIcon,
	UserPlus,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PageContainer from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth/client";

type User = {
	id: string;
	email: string;
	name: string;
	displayName: string | null;
	department: string | null;
	username: string | null;
	mustChangePassword: boolean;
	passwordChangedAt: string | null;
	role: string | null;
	banned: boolean;
	banReason: string | null;
	banExpires: string | null;
};

export default function UsersPage() {
	const [search, setSearch] = useState("");
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	const [mode, setMode] = useState<"view" | "create" | "edit">("view");
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [userToDelete, setUserToDelete] = useState<User | null>(null);
	const [users, setUsers] = useState<User[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [total, setTotal] = useState(0);
	const [_refetchKey, setRefetchKey] = useState(0);
	const canManageUsers = useAuth().hasAnyRole("admin", "super_admin");

	const refetch = useCallback(async () => {
		setRefetchKey((k) => k + 1);
	}, []);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		authClient.admin
			.listUsers({ query: { limit: 100, searchValue: search || undefined } })
			.then((res) => {
				if (!cancelled && res.data) {
					setUsers(res.data.users as unknown as User[]);
					setTotal(res.data.total);
					setIsLoading(false);
				}
			})
			.catch((err) => {
				logger.error("Failed to fetch users", err);
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [search]);

	const selectedUser = users.find((u) => u.id === selectedUserId) || null;

	const filteredUsers = users;

	const userStats = useMemo(() => {
		const totalCount = total;
		const active = users.filter((u) => !u.banned).length;
		const pendingResets = users.filter((u) => u.mustChangePassword).length;
		const disabled = Math.max(totalCount - active, 0);

		return [
			{
				label: "Total accounts",
				value: totalCount,
				helper: `${active} active`,
			},
			{
				label: "Pending password resets",
				value: pendingResets,
				helper: "Must change on next login",
			},
			{
				label: "Disabled users",
				value: disabled,
				helper: "Awaiting reactivation",
			},
		];
	}, [users, total]);

	const handleCreateNew = () => {
		setSelectedUserId(null);
		setMode("create");
	};

	const handleSelectUser = (user: User) => {
		setSelectedUserId(user.id);
		setMode("view");
	};

	const handleEdit = () => {
		setMode("edit");
	};

	const handleCancelEdit = () => {
		setMode("view");
	};

	const handleSaveSuccess = () => {
		refetch();
		if (mode === "create") {
			setMode("view");
			setSelectedUserId(null);
		} else {
			setMode("view");
		}
	};

	const handleDeleteClick = (user: User) => {
		setUserToDelete(user);
		setDeleteDialogOpen(true);
	};

	const [deletePending, setDeletePending] = useState(false);

	function UserStatsLoadingSkeleton() {
		return (
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{[0, 1, 2].map((i) => (
					<Card key={i} className="border-muted/60 bg-card/90 shadow-sm">
						<CardHeader className="pb-2">
							<Skeleton className="h-3 w-24" />
						</CardHeader>
						<CardContent className="pb-4">
							<Skeleton className="h-8 w-12" />
							<Skeleton className="h-3 w-20 mt-1" />
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	function UserListLoadingSkeleton() {
		return (
			<div className="p-2">
				{[0, 1, 2, 3, 4].map((i) => (
					<div key={i} className="p-3 rounded-md">
						<div className="flex items-start justify-between gap-2">
							<div className="flex-1 min-w-0 space-y-1">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-40" />
							</div>
							<Skeleton className="h-5 w-12" />
						</div>
					</div>
				))}
			</div>
		);
	}

	function UserDetailsLoadingSkeleton() {
		return (
			<div className="p-6 space-y-4">
				<div className="flex items-start justify-between">
					<div className="space-y-2">
						<Skeleton className="h-6 w-32" />
						<Skeleton className="h-4 w-40" />
					</div>
					<div className="flex gap-2">
						<Skeleton className="h-8 w-20" />
						<Skeleton className="h-8 w-20" />
						<Skeleton className="h-8 w-20" />
					</div>
				</div>
				<div className="space-y-4">
					{[0, 1, 2].map((i) => (
						<Card key={i}>
							<CardHeader>
								<Skeleton className="h-5 w-32" />
							</CardHeader>
							<CardContent className="space-y-3">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}
	const handleDeleteConfirm = async () => {
		if (!userToDelete) return;
		setDeletePending(true);
		try {
			await authClient.admin.removeUser({ userId: userToDelete.id });
			toast.success("User deleted successfully");
			setDeleteDialogOpen(false);
			setUserToDelete(null);
			setSelectedUserId(null);
			setMode("view");
			refetch();
		} catch (err) {
			logger.error("Delete user failed", err);
			toast.error("Failed to delete user");
		} finally {
			setDeletePending(false);
		}
	};

	const [banPending, setBanPending] = useState(false);
	const handleBanUser = async (userId: string) => {
		setBanPending(true);
		try {
			await authClient.admin.banUser({ userId });
			toast.success("User disabled");
			refetch();
		} catch (err) {
			logger.error("Ban user failed", err);
			toast.error("Failed to disable user");
		} finally {
			setBanPending(false);
		}
	};

	const [unbanPending, setUnbanPending] = useState(false);
	const handleUnbanUser = async (userId: string) => {
		setUnbanPending(true);
		try {
			await authClient.admin.unbanUser({ userId });
			toast.success("User enabled");
			refetch();
		} catch (err) {
			logger.error("Unban user failed", err);
			toast.error("Failed to enable user");
		} finally {
			setUnbanPending(false);
		}
	};

	return (
		<PageContainer scrollable={false}>
			<div className="flex flex-1 flex-col gap-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<h2 className="text-3xl font-bold tracking-tight">
							User directory & access
						</h2>
						<p className="text-muted-foreground">
							Monitor account health, enforce password policies, and create new
							workspace accounts without leaving this view.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => refetch()}
							disabled={isLoading}
						>
							Refresh data
						</Button>
						<Button
							size="sm"
							onClick={handleCreateNew}
							disabled={!canManageUsers}
						>
							<UserPlus className="mr-2 h-4 w-4" /> Create user
						</Button>
					</div>
				</div>

				{isLoading ? (
					<UserStatsLoadingSkeleton />
				) : (
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{userStats.map((stat) => (
							<Card
								key={stat.label}
								className="border-muted/60 bg-card/90 shadow-sm"
							>
								<CardHeader className="pb-2">
									<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
										{stat.label}
									</p>
								</CardHeader>
								<CardContent className="pb-4">
									<div className="text-3xl font-semibold tracking-tight">
										{stat.value}
									</div>
									<p className="text-xs text-muted-foreground">{stat.helper}</p>
								</CardContent>
							</Card>
						))}
					</div>
				)}

				<div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
					<div className="flex min-h-[28rem] min-w-0 flex-col rounded-lg border bg-card xl:min-h-0">
						<div className="p-4 border-b">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-xl font-semibold">Users</h2>
								<Button
									size="sm"
									onClick={handleCreateNew}
									disabled={!canManageUsers}
								>
									<UserPlus className="mr-2 h-4 w-4" />
									New User
								</Button>
							</div>
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search users..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="pl-10"
								/>
							</div>
						</div>

						<ScrollArea className="flex-1">
							<div className="p-2">
								{isLoading ? (
									<UserListLoadingSkeleton />
								) : filteredUsers.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										No users found
									</div>
								) : (
									<div className="space-y-1">
										{filteredUsers.map((user) => (
											<button
												type="button"
												key={user.id}
												onClick={() => handleSelectUser(user)}
												className={`w-full text-left p-3 rounded-md transition-colors ${
													selectedUserId === user.id
														? "bg-primary text-primary-foreground"
														: "hover:bg-muted"
												}`}
											>
												<div className="flex items-start justify-between gap-2">
													<div className="flex-1 min-w-0">
														<div className="font-medium truncate">
															{user.name}
														</div>
														<div className="text-sm opacity-80 truncate">
															{user.email}
														</div>
														{user.department && (
															<div className="text-xs opacity-70 mt-1">
																{user.department}
															</div>
														)}
														{user.role && (
															<div className="mt-2 flex flex-wrap gap-1">
																<Badge
																	variant="secondary"
																	className="text-[10px] font-semibold"
																>
																	{user.role}
																</Badge>
															</div>
														)}
													</div>
													<div className="flex flex-col items-end gap-1">
														{!user.banned ? (
															<Badge variant="outline" className="text-xs">
																Active
															</Badge>
														) : (
															<Badge variant="destructive" className="text-xs">
																Disabled
															</Badge>
														)}
													</div>
												</div>
											</button>
										))}
									</div>
								)}
							</div>
						</ScrollArea>
					</div>

					<div className="min-h-[28rem] min-w-0 rounded-lg border bg-card xl:min-h-0">
						{isLoading ? (
							<UserDetailsLoadingSkeleton />
						) : mode === "create" ? (
							<CreateUserPanel
								onSuccess={handleSaveSuccess}
								onCancel={() => {
									setMode("view");
									setSelectedUserId(null);
								}}
							/>
						) : selectedUser && mode === "edit" ? (
							<EditUserPanel
								user={selectedUser}
								onSuccess={handleSaveSuccess}
								onCancel={handleCancelEdit}
								onDelete={() => handleDeleteClick(selectedUser)}
							/>
						) : selectedUser ? (
							<UserDetailsPanel
								user={selectedUser}
								onEdit={handleEdit}
								onDelete={() => handleDeleteClick(selectedUser)}
								onDisable={() => handleBanUser(selectedUser.id)}
								onEnable={() => handleUnbanUser(selectedUser.id)}
								banPending={banPending}
								unbanPending={unbanPending}
								canManageUsers={canManageUsers}
							/>
						) : (
							<div className="flex items-center justify-center h-full text-muted-foreground">
								<div className="text-center">
									<Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
									<p className="text-lg font-medium">No user selected</p>
									<p className="text-sm mt-1">
										Select a user from the list or create a new one
									</p>
								</div>
							</div>
						)}
					</div>

					<AlertDialog
						open={deleteDialogOpen}
						onOpenChange={setDeleteDialogOpen}
					>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Delete User</AlertDialogTitle>
								<AlertDialogDescription>
									Are you sure you want to delete user &ldquo;
									{userToDelete?.name}
									&rdquo;? This action cannot be undone.
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
				</div>
			</div>
		</PageContainer>
	);
}

function UserDetailsPanel({
	user,
	onEdit,
	onDelete,
	onDisable,
	onEnable,
	banPending,
	unbanPending,
	canManageUsers,
}: {
	user: User;
	onEdit: () => void;
	onDelete: () => void;
	onDisable: () => void;
	onEnable: () => void;
	banPending: boolean;
	unbanPending: boolean;
	canManageUsers: boolean;
}) {
	const passwordChangedAtLabel = user.passwordChangedAt
		? new Date(user.passwordChangedAt).toLocaleString()
		: "Not recorded";

	return (
		<div className="flex flex-col h-full">
			<div className="p-6 border-b">
				<div className="flex items-start justify-between">
					<div>
						<h2 className="text-2xl font-bold">{user.name}</h2>
						<p className="text-muted-foreground mt-1">{user.email}</p>
					</div>
					<div className="flex gap-2">
						{canManageUsers && (
							<>
								{!user.banned ? (
									<Button
										variant="outline"
										size="sm"
										onClick={onDisable}
										disabled={banPending}
									>
										{banPending ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : (
											<Ban className="mr-2 h-4 w-4" />
										)}
										Disable
									</Button>
								) : (
									<Button
										variant="outline"
										size="sm"
										onClick={onEnable}
										disabled={unbanPending}
									>
										{unbanPending ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : (
											<CheckCircle className="mr-2 h-4 w-4" />
										)}
										Enable
									</Button>
								)}
								<Button variant="outline" size="sm" onClick={onEdit}>
									<Edit className="mr-2 h-4 w-4" />
									Edit
								</Button>
								<Button variant="destructive" size="sm" onClick={onDelete}>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</Button>
							</>
						)}
					</div>
				</div>
			</div>

			<ScrollArea className="flex-1 p-6">
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">User Information</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label className="text-xs text-muted-foreground">Email</Label>
									<div className="flex items-center gap-2 mt-1">
										<Mail className="h-4 w-4 text-muted-foreground" />
										<p className="font-medium">{user.email}</p>
									</div>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Username
									</Label>
									<div className="flex items-center gap-2 mt-1">
										<Users className="h-4 w-4 text-muted-foreground" />
										<p className="font-medium">{user.username || "-"}</p>
									</div>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Display Name
									</Label>
									<div className="flex items-center gap-2 mt-1">
										<UserIcon className="h-4 w-4 text-muted-foreground" />
										<p className="font-medium">{user.displayName || "-"}</p>
									</div>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Department
									</Label>
									<div className="flex items-center gap-2 mt-1">
										<Briefcase className="h-4 w-4 text-muted-foreground" />
										<p className="font-medium">{user.department || "-"}</p>
									</div>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Status
									</Label>
									<div className="mt-1">
										{!user.banned ? (
											<Badge variant="default" className="bg-green-500">
												Active
											</Badge>
										) : (
											<Badge variant="destructive">Inactive</Badge>
										)}
									</div>
								</div>
								<div className="col-span-2">
									<Label className="text-xs text-muted-foreground">
										Password Policy
									</Label>
									<div className="flex flex-col gap-1 mt-1">
										<div className="flex items-center gap-2">
											<Key className="h-4 w-4 text-muted-foreground" />
											<p className="font-medium">
												{user.mustChangePassword
													? "Must change on next login"
													: "Compliant"}
											</p>
										</div>
										<p className="text-xs text-muted-foreground">
											Last changed: {passwordChangedAtLabel}
										</p>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Role</CardTitle>
						</CardHeader>
						<CardContent>
							{user.role ? (
								<Badge variant="outline">{user.role}</Badge>
							) : (
								<p className="text-sm text-muted-foreground">
									No role assigned
								</p>
							)}
						</CardContent>
					</Card>

					<OrgMembershipsCard userId={user.id} />
				</div>
			</ScrollArea>
		</div>
	);
}

function OrgMembershipsCard({ userId }: { userId: string }) {
	const [memberships, setMemberships] = useState<
		Array<{
			id: string;
			role: string;
			organization: { id: string; name: string; slug: string };
		}>
	>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		authClient.organization
			.list()
			.then((res) => {
				if (cancelled || !res.data) return;
				const orgs = res.data as Array<{
					id: string;
					name: string;
					slug: string;
				}>;
				Promise.all(
					orgs.map(async (org) => {
						try {
							const { data } =
								await authClient.organization.getFullOrganization({
									query: { organizationId: org.id, membersLimit: 500 },
								});
							if (!data) return null;
							const members = data.members as Array<{
								id: string;
								userId: string;
								role: string;
							}>;
							const member = members.find((m) => m.userId === userId);
							if (member) {
								return {
									id: member.id,
									role: member.role,
									organization: { id: org.id, name: org.name, slug: org.slug },
								};
							}
							return null;
						} catch {
							return null;
						}
					}),
				).then((results) => {
					if (!cancelled) {
						setMemberships(results.filter(Boolean) as typeof memberships);
						setIsLoading(false);
					}
				});
			})
			.catch(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [userId]);

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

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">Organization Memberships</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="space-y-2">
						<Skeleton className="h-6 w-full" />
						<Skeleton className="h-6 w-3/4" />
					</div>
				) : memberships.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No organization memberships
					</p>
				) : (
					<div className="space-y-2">
						{memberships.map((m) => (
							<div
								key={m.id}
								className="flex items-center justify-between rounded-md border p-2"
							>
								<div className="flex items-center gap-2">
									<Building className="h-4 w-4 text-muted-foreground" />
									<span className="font-medium text-sm">
										{m.organization.name}
									</span>
									<code className="text-xs text-muted-foreground">
										{m.organization.slug}
									</code>
								</div>
								<Badge variant={roleBadgeVariant(m.role)} className="text-xs">
									{m.role}
								</Badge>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function CreateUserPanel({
	onSuccess,
	onCancel,
}: {
	onSuccess: () => void;
	onCancel: () => void;
}) {
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [department, setDepartment] = useState("");
	const [password, setPassword] = useState("");
	const [mustChangePassword, setMustChangePassword] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [creationResult, setCreationResult] = useState<{
		user: { id: string; email: string; username?: string | null };
		password?: string;
		mustChangePassword: boolean;
	} | null>(null);
	const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (creationResult) return;
		setIsSubmitting(true);
		try {
			const result = await authClient.admin.createUser({
				email,
				name,
				password,
				role: undefined,
				data: {
					displayName: displayName || undefined,
					department: department || undefined,
					mustChangePassword,
				},
			});
			if (!result.data) {
				throw new Error("Create user returned no data");
			}
			const userData = result.data.user as unknown as Record<string, unknown>;
			const responseData = result.data as unknown as Record<string, unknown>;
			setCreationResult({
				user: {
					id: result.data.user.id,
					email: result.data.user.email,
					username: userData.username as string | null | undefined,
				},
				password: responseData.password as string | undefined,
				mustChangePassword: (userData.mustChangePassword as boolean) ?? false,
			});
			toast.success("User created successfully");
		} catch (err) {
			logger.error("Create user error:", err);
			toast.error("Failed to create user");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCopyPassword = async () => {
		if (!creationResult?.password) return;
		try {
			await navigator.clipboard.writeText(creationResult.password);
			setCopyState("copied");
			toast.success("Password copied to clipboard");
			setTimeout(() => setCopyState("idle"), 2500);
		} catch (err) {
			logger.error("Clipboard copy failed", err);
			toast.error("Unable to copy password.");
		}
	};

	const handleFinish = () => {
		setEmail("");
		setName("");
		setDisplayName("");
		setDepartment("");
		setPassword("");
		setMustChangePassword(true);
		setCreationResult(null);
		setCopyState("idle");
		onSuccess();
	};

	const formLocked = Boolean(creationResult);

	return (
		<form onSubmit={handleSubmit} className="flex flex-col h-full">
			<div className="p-6 border-b">
				<div className="flex items-start justify-between">
					<div>
						<h2 className="text-2xl font-bold">Create New User</h2>
						<p className="text-muted-foreground mt-1">
							Add a new user to the system
						</p>
					</div>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onCancel}
							disabled={isSubmitting}
						>
							<X className="mr-2 h-4 w-4" />
							Cancel
						</Button>
						{creationResult ? (
							<Button type="button" size="sm" onClick={handleFinish}>
								<Check className="mr-2 h-4 w-4" />
								Done
							</Button>
						) : (
							<Button type="submit" size="sm" disabled={isSubmitting}>
								<Save className="mr-2 h-4 w-4" />
								{isSubmitting ? "Creating..." : "Create User"}
							</Button>
						)}
					</div>
				</div>
			</div>

			<ScrollArea className="flex-1 p-6">
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">
							Email <span className="text-destructive">*</span>
						</Label>
						<Input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="user@example.com"
							required
							disabled={formLocked || isSubmitting}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="name">
							Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="John Doe"
							required
							disabled={formLocked || isSubmitting}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="displayName">Display Name</Label>
						<Input
							id="displayName"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							placeholder="John D."
							disabled={formLocked || isSubmitting}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="department">Department</Label>
						<Input
							id="department"
							value={department}
							onChange={(e) => setDepartment(e.target.value)}
							placeholder="Engineering"
							disabled={formLocked || isSubmitting}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">
							Password <span className="text-destructive">*</span>
						</Label>
						<Input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Temporary password"
							minLength={8}
							disabled={formLocked || isSubmitting}
						/>
					</div>
					<div className="flex items-center justify-between rounded-lg border p-4">
						<div>
							<Label
								htmlFor="must-change-password"
								className="flex items-center gap-2"
							>
								<Key className="h-4 w-4" /> Change password after first login
							</Label>
							<p className="text-xs text-muted-foreground mt-1">
								When enabled, the user must set a new password before they can
								access any module.
							</p>
						</div>
						<Switch
							id="must-change-password"
							checked={mustChangePassword}
							onCheckedChange={(checked) =>
								setMustChangePassword(Boolean(checked))
							}
							disabled={formLocked || isSubmitting}
						/>
					</div>
				</div>

				{creationResult && (
					<Alert className="mt-6">
						<AlertTitle className="flex items-center gap-2">
							<ShieldCheck className="h-4 w-4" /> User provisioned
						</AlertTitle>
						<AlertDescription className="space-y-3">
							<div className="text-sm">
								<div>
									<span className="font-medium">Email:</span>{" "}
									{creationResult.user.email}
								</div>
								<div>
									<span className="font-medium">Must change password:</span>{" "}
									{creationResult.mustChangePassword ? "Yes" : "No"}
								</div>
							</div>
							{creationResult.password ? (
								<div className="flex items-center gap-3">
									<code className="rounded bg-muted px-3 py-1 text-sm">
										{creationResult.password}
									</code>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={handleCopyPassword}
									>
										{copyState === "copied" ? (
											<Check className="mr-2 h-4 w-4" />
										) : (
											<ClipboardCopy className="mr-2 h-4 w-4" />
										)}
										{copyState === "copied" ? "Copied" : "Copy password"}
									</Button>
								</div>
							) : (
								<p className="text-xs text-muted-foreground">
									Password was set. For security, it cannot be retrieved from
									the system.
								</p>
							)}
						</AlertDescription>
					</Alert>
				)}
			</ScrollArea>
		</form>
	);
}

function EditUserPanel({
	user,
	onSuccess,
	onCancel,
	onDelete,
}: {
	user: User;
	onSuccess: () => void;
	onCancel: () => void;
	onDelete: () => void;
}) {
	const [name, setName] = useState(user.name);
	const [displayName, setDisplayName] = useState(user.displayName ?? "");
	const [department, setDepartment] = useState(user.department ?? "");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		try {
			await authClient.admin.updateUser({
				userId: user.id,
				data: {
					name,
					displayName: displayName || undefined,
					department: department || undefined,
				},
			});
			toast.success("User updated successfully");
			onSuccess();
		} catch (err) {
			logger.error("Update user error:", err);
			toast.error("Failed to update user");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="flex flex-col h-full">
			<div className="p-6 border-b">
				<div className="flex items-start justify-between">
					<div>
						<h2 className="text-2xl font-bold">Edit User</h2>
						<p className="text-muted-foreground mt-1">Editing {user.name}</p>
					</div>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onCancel}
							disabled={isSubmitting}
						>
							<X className="mr-2 h-4 w-4" />
							Cancel
						</Button>
						<Button type="submit" size="sm" disabled={isSubmitting}>
							<Save className="mr-2 h-4 w-4" />
							{isSubmitting ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</div>
			</div>

			<ScrollArea className="flex-1 p-6">
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input id="email" value={user.email} disabled readOnly />
					</div>
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="displayName">Display Name</Label>
						<Input
							id="displayName"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="department">Department</Label>
						<Input
							id="department"
							value={department}
							onChange={(e) => setDepartment(e.target.value)}
						/>
					</div>
					<div className="pt-4 border-t">
						<Button
							type="button"
							variant="destructive"
							size="sm"
							onClick={onDelete}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete User
						</Button>
					</div>
				</div>
			</ScrollArea>
		</form>
	);
}
