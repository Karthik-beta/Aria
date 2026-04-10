"use client";

import { logger } from "@aria/utils";
import { Edit, Lock, MoreVertical, Plus, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
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
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePermission } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc/client";

type Role = {
	id: string;
	key: string;
	name: string;
	description: string | null;
	level: number;
	isSystem: boolean;
	rolePermissions?: Array<{
		permission: {
			id: string;
			key: string;
			name: string;
		};
	}>;
};

type Permission = {
	id: string;
	key: string;
	name: string;
	description: string | null;
	scope: string;
};

export default function RolesPage() {
	const { data: roles, isLoading, refetch } = trpc.admin.listRoles.useQuery();
	const { data: permissions } = trpc.admin.listPermissions.useQuery();
	const [createRoleOpen, setCreateRoleOpen] = useState(false);
	const [editRoleOpen, setEditRoleOpen] = useState(false);
	const [deleteRoleOpen, setDeleteRoleOpen] = useState(false);
	const [managePermissionsOpen, setManagePermissionsOpen] = useState(false);
	const [selectedRole, setSelectedRole] = useState<Role | null>(null);
	const canManageRoles = usePermission("system:role.manage");

	const openEditDialog = (role: Role) => {
		setSelectedRole(role);
		setEditRoleOpen(true);
	};

	const openDeleteDialog = (role: Role) => {
		setSelectedRole(role);
		setDeleteRoleOpen(true);
	};

	const deleteRoleMutation = trpc.admin.deleteRole.useMutation({
		onSuccess: () => {
			toast.success("Role deleted successfully");
			refetch();
			setDeleteRoleOpen(false);
			setSelectedRole(null);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete role");
		},
	});

	const openPermissionsDialog = (role: Role) => {
		setSelectedRole(role);
		setManagePermissionsOpen(true);
	};

	const totalRoles = roles?.length ?? 0;
	const systemRoleCount = roles?.filter((role) => role.isSystem).length ?? 0;
	const customRoleCount = Math.max(totalRoles - systemRoleCount, 0);
	const permissionCount = permissions?.length ?? 0;
	const roleInsights = [
		{
			label: "Total roles",
			value: totalRoles,
			helper: `${systemRoleCount} system-defined`,
		},
		{
			label: "Custom roles",
			value: customRoleCount,
			helper: "Editable workspace roles",
		},
		{
			label: "Permissions",
			value: permissionCount,
			helper: "Across all scopes",
		},
		{
			label: "Protected roles",
			value: systemRoleCount,
			helper: "Locked from direct edits",
		},
	];

	if (isLoading) {
		return (
			<PageContainer>
				<div className="flex flex-1 items-center justify-center py-12">
					<div className="text-center">
						<div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
						<p className="text-muted-foreground">Loading roles...</p>
					</div>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<div className="flex flex-1 flex-col gap-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<h2 className="text-3xl font-bold tracking-tight">
							Roles & Permissions
						</h2>
						<p className="text-muted-foreground">
							Manage roles and their permission assignments
						</p>
					</div>
					{canManageRoles && (
						<Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
							<DialogTrigger asChild>
								<Button>
									<Plus className="mr-2 h-4 w-4" />
									Create Role
								</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-[500px]">
								<DialogHeader>
									<DialogTitle>Create New Role</DialogTitle>
									<DialogDescription>
										Define a new role with name and description
									</DialogDescription>
								</DialogHeader>
								<CreateRoleForm
									onSuccess={() => {
										refetch();
										setCreateRoleOpen(false);
									}}
								/>
							</DialogContent>
						</Dialog>
					)}
				</div>

				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{roleInsights.map((insight) => (
						<Card
							key={insight.label}
							className="border-muted/60 bg-card/90 shadow-sm"
						>
							<CardHeader className="pb-2">
								<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
									{insight.label}
								</p>
							</CardHeader>
							<CardContent className="pb-4">
								<div className="text-3xl font-semibold tracking-tight">
									{insight.value}
								</div>
								<p className="text-xs text-muted-foreground">
									{insight.helper}
								</p>
							</CardContent>
						</Card>
					))}
				</div>

				<Tabs defaultValue="roles" className="space-y-6">
					<TabsList className="h-auto flex-wrap justify-start">
						<TabsTrigger value="roles">
							Roles ({roles?.length || 0})
						</TabsTrigger>
						<TabsTrigger value="permissions">
							Permissions ({permissions?.length || 0})
						</TabsTrigger>
					</TabsList>

					<TabsContent value="roles" className="space-y-4 mt-6">
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{roles?.map((role) => (
								<Card key={role.id} className="relative">
									<CardHeader>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<Shield className="h-5 w-5 text-primary" />
												<CardTitle className="text-lg">{role.name}</CardTitle>
											</div>
											<div className="flex items-center gap-2">
												{role.isSystem && (
													<Badge variant="secondary" className="gap-1">
														<Lock className="h-3 w-3" />
														System
													</Badge>
												)}
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8"
														>
															<MoreVertical className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuLabel>Actions</DropdownMenuLabel>
														<DropdownMenuSeparator />
														{canManageRoles && (
															<>
																<DropdownMenuItem
																	onClick={() => openPermissionsDialog(role)}
																>
																	<Shield className="mr-2 h-4 w-4" />
																	Manage Permissions
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() => openEditDialog(role)}
																	disabled={role.isSystem}
																>
																	<Edit className="mr-2 h-4 w-4" />
																	Edit Role
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() => openDeleteDialog(role)}
																	disabled={role.isSystem}
																	className="text-destructive"
																>
																	<Trash2 className="mr-2 h-4 w-4" />
																	Delete Role
																</DropdownMenuItem>
															</>
														)}
													</DropdownMenuContent>
												</DropdownMenu>
											</div>
										</div>
										<CardDescription>
											{role.description || "No description"}
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-3">
										<div className="flex items-center justify-between text-sm">
											<span className="text-muted-foreground">Level</span>
											<Badge variant="outline">{role.level}</Badge>
										</div>
										<div className="space-y-2">
											<p className="text-sm font-medium">Permissions:</p>
											<div className="flex flex-wrap gap-1">
												{role.rolePermissions?.slice(0, 4).map((rp) => (
													<Badge
														key={rp.permission.id}
														variant="outline"
														className="text-xs"
													>
														{rp.permission.key}
													</Badge>
												))}
												{(role.rolePermissions?.length || 0) > 4 && (
													<Badge variant="outline" className="text-xs">
														+{(role.rolePermissions?.length || 0) - 4} more
													</Badge>
												)}
												{(role.rolePermissions?.length || 0) === 0 && (
													<span className="text-xs text-muted-foreground">
														No permissions assigned
													</span>
												)}
											</div>
										</div>
									</CardContent>
									<CardFooter>
										{canManageRoles && (
											<Button
												variant="outline"
												className="w-full"
												onClick={() => openPermissionsDialog(role)}
											>
												<Shield className="mr-2 h-4 w-4" />
												Manage Permissions
											</Button>
										)}
									</CardFooter>
								</Card>
							))}
						</div>
					</TabsContent>

					<TabsContent value="permissions" className="space-y-4 mt-6">
						<div className="space-y-4">
							<PermissionSection
								title="System Permissions"
								description="Core system-level permissions for administrative tasks"
								permissions={
									permissions?.filter((p) => p.scope === "system") || []
								}
							/>
							<PermissionSection
								title="App Permissions"
								description="Application-specific permissions for different modules"
								permissions={
									permissions?.filter((p) => p.scope === "app") || []
								}
							/>
							<PermissionSection
								title="Entity Permissions"
								description="Entity-level permissions for data access control"
								permissions={
									permissions?.filter((p) => p.scope === "entity") || []
								}
							/>
						</div>
					</TabsContent>
				</Tabs>

				{/* Edit Role Dialog */}
				<Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
					<DialogContent className="sm:max-w-[500px]">
						<DialogHeader>
							<DialogTitle>Edit Role</DialogTitle>
							<DialogDescription>Update role information</DialogDescription>
						</DialogHeader>
						<EditRoleForm
							role={selectedRole}
							onSuccess={() => {
								refetch();
								setEditRoleOpen(false);
							}}
						/>
					</DialogContent>
				</Dialog>

				{/* Manage Permissions Dialog */}
				<Dialog
					open={managePermissionsOpen}
					onOpenChange={setManagePermissionsOpen}
				>
					<DialogContent className="sm:max-w-[700px]">
						<DialogHeader>
							<DialogTitle>Manage Role Permissions</DialogTitle>
							<DialogDescription>
								Assign or remove permissions for {selectedRole?.name}
							</DialogDescription>
						</DialogHeader>
						<ManagePermissionsForm
							role={selectedRole}
							permissions={permissions || []}
							onSuccess={() => {
								refetch();
								setManagePermissionsOpen(false);
							}}
						/>
					</DialogContent>
				</Dialog>

				{/* Delete Confirmation Dialog */}
				<AlertDialog open={deleteRoleOpen} onOpenChange={setDeleteRoleOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone. This will permanently delete the
								role <strong>{selectedRole?.name}</strong> and remove all user
								assignments.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => {
									if (selectedRole) {
										deleteRoleMutation.mutate({ roleKey: selectedRole.key });
									}
									setDeleteRoleOpen(false);
								}}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								disabled={deleteRoleMutation.isPending}
							>
								{deleteRoleMutation.isPending ? "Deleting..." : "Delete Role"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</PageContainer>
	);
}

function PermissionSection({
	title,
	description,
	permissions,
}: {
	title: string;
	description: string;
	permissions: Array<{
		id: string;
		key: string;
		name: string;
		description: string | null;
		scope: string;
	}>;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>
					{description} • {permissions.length} permissions
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
					{permissions.map((permission) => (
						<div
							key={permission.id}
							className="p-3 border rounded-lg hover:bg-accent transition-colors"
						>
							<p className="font-mono text-sm font-medium">{permission.key}</p>
							<p className="text-xs text-muted-foreground mt-1">
								{permission.description || permission.name}
							</p>
						</div>
					))}
					{permissions.length === 0 && (
						<p className="text-sm text-muted-foreground col-span-full text-center py-4">
							No permissions in this category
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function CreateRoleForm({ onSuccess }: { onSuccess: () => void }) {
	const [key, setKey] = useState("");
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [level, setLevel] = useState("1");

	const createRoleMutation = trpc.admin.createRole.useMutation({
		onSuccess: () => {
			toast.success("Role created successfully");
			onSuccess();
			setKey("");
			setName("");
			setDescription("");
			setLevel("1");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create role");
		},
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await createRoleMutation.mutateAsync({
			key,
			name,
			description: description || undefined,
			level: parseInt(level, 10),
			isSystem: false,
		});
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="key">
					Role Key <span className="text-destructive">*</span>
				</Label>
				<Input
					id="key"
					value={key}
					onChange={(e) => setKey(e.target.value)}
					placeholder="e.g., manager, editor, viewer"
					required
				/>
				<p className="text-xs text-muted-foreground">
					Unique identifier (lowercase, no spaces)
				</p>
			</div>
			<div className="space-y-2">
				<Label htmlFor="name">
					Role Name <span className="text-destructive">*</span>
				</Label>
				<Input
					id="name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="e.g., Manager, Editor, Viewer"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="description">Description</Label>
				<Textarea
					id="description"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Describe the purpose and scope of this role..."
					rows={3}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="level">
					Level <span className="text-destructive">*</span>
				</Label>
				<Input
					id="level"
					type="number"
					min="1"
					max="100"
					value={level}
					onChange={(e) => setLevel(e.target.value)}
					required
				/>
				<p className="text-xs text-muted-foreground">
					Higher levels grant more authority (1-100)
				</p>
			</div>
			<DialogFooter>
				<Button type="submit" disabled={createRoleMutation.isPending}>
					{createRoleMutation.isPending ? "Creating..." : "Create Role"}
				</Button>
			</DialogFooter>
		</form>
	);
}

function EditRoleForm({
	role,
	onSuccess,
}: {
	role: Role | null;
	onSuccess: () => void;
}) {
	const [name, setName] = useState(role?.name || "");
	const [description, setDescription] = useState(role?.description || "");
	const [level, setLevel] = useState(role?.level?.toString() || "1");

	const updateRoleMutation = trpc.admin.updateRole.useMutation({
		onSuccess: () => {
			toast.success("Role updated successfully");
			onSuccess();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update role");
		},
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!role) return;

		await updateRoleMutation.mutateAsync({
			roleKey: role.key,
			name,
			description: description || undefined,
			level: parseInt(level, 10),
		});
	};

	if (!role) return null;

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="edit-key">Role Key</Label>
				<Input id="edit-key" value={role.key} disabled />
				<p className="text-xs text-muted-foreground">
					Role key cannot be changed
				</p>
			</div>
			<div className="space-y-2">
				<Label htmlFor="edit-name">
					Role Name <span className="text-destructive">*</span>
				</Label>
				<Input
					id="edit-name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="edit-description">Description</Label>
				<Textarea
					id="edit-description"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					rows={3}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="edit-level">
					Level <span className="text-destructive">*</span>
				</Label>
				<Input
					id="edit-level"
					type="number"
					min="1"
					max="100"
					value={level}
					onChange={(e) => setLevel(e.target.value)}
					required
				/>
			</div>
			<DialogFooter>
				<Button type="submit" disabled={updateRoleMutation.isPending}>
					{updateRoleMutation.isPending ? "Saving..." : "Save Changes"}
				</Button>
			</DialogFooter>
		</form>
	);
}

function ManagePermissionsForm({
	role,
	permissions,
	onSuccess,
}: {
	role: Role | null;
	permissions: Permission[];
	onSuccess: () => void;
}) {
	const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<
		Set<string>
	>(
		new Set(
			role?.rolePermissions?.map(
				(rp: { permission: { key: string } }) => rp.permission.key,
			) || [],
		),
	);

	const assignPermissionMutation =
		trpc.admin.assignPermissionToRole.useMutation();
	const removePermissionMutation =
		trpc.admin.removePermissionFromRole.useMutation();

	const handleTogglePermission = (permissionKey: string) => {
		const newSelectedPermissions = new Set(selectedPermissionKeys);
		if (newSelectedPermissions.has(permissionKey)) {
			newSelectedPermissions.delete(permissionKey);
		} else {
			newSelectedPermissions.add(permissionKey);
		}
		setSelectedPermissionKeys(newSelectedPermissions);
	};

	const handleSave = async () => {
		if (!role) return;

		const currentPermissionKeys = new Set<string>(
			role.rolePermissions?.map(
				(rp: { permission: { key: string } }) => rp.permission.key,
			) || [],
		);
		const permissionsToAdd = Array.from(selectedPermissionKeys).filter(
			(key) => !currentPermissionKeys.has(key),
		);
		const permissionsToRemove = Array.from(currentPermissionKeys).filter(
			(key) => !selectedPermissionKeys.has(key),
		);

		try {
			for (const permissionKey of permissionsToAdd) {
				await assignPermissionMutation.mutateAsync({
					roleKey: role.key,
					permissionKey: permissionKey,
				});
			}

			for (const permissionKey of permissionsToRemove) {
				await removePermissionMutation.mutateAsync({
					roleKey: role.key,
					permissionKey: permissionKey,
				});
			}

			toast.success("Permissions updated successfully");
			onSuccess();
		} catch (error) {
			logger.error("Error updating permissions:", error);
			toast.error("Failed to update permissions");
		}
	};

	if (!role) return null;

	const groupedPermissions = {
		system: permissions.filter((p) => p.scope === "system"),
		app: permissions.filter((p) => p.scope === "app"),
		entity: permissions.filter((p) => p.scope === "entity"),
	};

	return (
		<div className="space-y-4">
			<ScrollArea className="h-[450px] pr-4">
				<Tabs defaultValue="system">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="system">
							System ({groupedPermissions.system.length})
						</TabsTrigger>
						<TabsTrigger value="app">
							App ({groupedPermissions.app.length})
						</TabsTrigger>
						<TabsTrigger value="entity">
							Entity ({groupedPermissions.entity.length})
						</TabsTrigger>
					</TabsList>

					{Object.entries(groupedPermissions).map(([scope, perms]) => (
						<TabsContent key={scope} value={scope} className="space-y-3 mt-4">
							{perms.map((permission) => (
								<div
									key={permission.id}
									className="flex items-start space-x-3 p-2 rounded-lg hover:bg-accent"
								>
									<Checkbox
										id={permission.id}
										checked={selectedPermissionKeys.has(permission.key)}
										onCheckedChange={() =>
											handleTogglePermission(permission.key)
										}
									/>
									<button
										type="button"
										className="flex-1 cursor-pointer text-left"
										onClick={() => handleTogglePermission(permission.key)}
									>
										<span className="text-sm font-medium font-mono leading-none cursor-pointer">
											{permission.key}
										</span>
										<p className="text-xs text-muted-foreground mt-1">
											{permission.description || permission.name}
										</p>
									</button>
								</div>
							))}
							{perms.length === 0 && (
								<p className="text-sm text-muted-foreground text-center py-4">
									No {scope} permissions available
								</p>
							)}
						</TabsContent>
					))}
				</Tabs>
			</ScrollArea>

			<DialogFooter>
				<div className="flex items-center justify-between w-full">
					<p className="text-sm text-muted-foreground">
						{selectedPermissionKeys.size} permission(s) selected
					</p>
					<Button
						onClick={handleSave}
						disabled={
							assignPermissionMutation.isPending ||
							removePermissionMutation.isPending
						}
					>
						{assignPermissionMutation.isPending ||
						removePermissionMutation.isPending
							? "Saving..."
							: "Save Changes"}
					</Button>
				</div>
			</DialogFooter>
		</div>
	);
}
