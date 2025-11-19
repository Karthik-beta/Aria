'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  UserPlus,
  Search,
  Ban,
  CheckCircle,
  Edit,
  Trash2,
  X,
  Save,
  Users,
  Mail,
  Briefcase,
  User as UserIcon,
  ClipboardCopy,
  ShieldCheck,
  Key,
  Check,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/use-debounce';

type User = {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  department: string | null;
  isActive: boolean;
  username: string | null;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  userRoles: Array<{
    role: {
      key: string;
      name: string;
      level: number;
    };
    appKey: string | null;
  }>;
};

type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  level: number;
  isSystem: boolean;
};

const GLOBAL_APP_KEY = 'global';

type AppOption = {
  value: string;
  label: string;
  description?: string;
};

type AppAccessEntry = {
  scopeKey: string;
  appKey: string | null;
  label: string;
  highestLevel: number;
  roleCount: number;
  roles: string[];
};

function formatAppLabel(key: string | null) {
  if (!key || key === GLOBAL_APP_KEY) {
    return 'Global workspace';
  }

  return key
    .split(/[-_]/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function summarizeAppAccess(
  user: User,
  getLabel: (key: string | null) => string
): AppAccessEntry[] {
  const summary = new Map<string, { highestLevel: number; roles: string[] }>();

  user.userRoles.forEach((userRole) => {
    const scopeKey = userRole.appKey ?? GLOBAL_APP_KEY;
    const current = summary.get(scopeKey) ?? { highestLevel: 0, roles: [] };

    summary.set(scopeKey, {
      highestLevel: Math.max(current.highestLevel, userRole.role.level),
      roles: [...current.roles, userRole.role.name],
    });
  });

  return Array.from(summary.entries()).map(([scopeKey, details]) => {
    const label = getLabel(scopeKey === GLOBAL_APP_KEY ? null : scopeKey);
    return {
      scopeKey,
      appKey: scopeKey === GLOBAL_APP_KEY ? null : scopeKey,
      label,
      highestLevel: details.highestLevel,
      roleCount: details.roles.length,
      roles: details.roles,
    };
  });
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { data, isLoading, refetch } = trpc.admin.listUsers.useQuery({
    page: 1,
    limit: 100,
    search: search || undefined,
  });

  const { data: roles } = trpc.admin.listRoles.useQuery();

  const { data: provisioningContext, isLoading: provisioningContextLoading } =
    trpc.admin.getProvisioningContext.useQuery();

  const appLabels = useMemo<Record<string, string>>(() => {
    const labels: Record<string, string> = {
      [GLOBAL_APP_KEY]: 'Global workspace',
    };

    provisioningContext?.apps?.forEach((app) => {
      labels[app.appKey] = app.name || formatAppLabel(app.appKey);
    });

    return labels;
  }, [provisioningContext?.apps]);

  const getAppLabel = useCallback(
    (key: string | null) => {
      if (!key) {
        return appLabels[GLOBAL_APP_KEY] ?? 'Global workspace';
      }

      return appLabels[key] ?? formatAppLabel(key);
    },
    [appLabels]
  );

  const manageableAppOptions = useMemo<AppOption[]>(() => {
    if (!provisioningContext) return [];
    const seen = new Set<string>();
    const options: AppOption[] = [];

    if (provisioningContext.canManageSystem) {
      options.push({
        value: GLOBAL_APP_KEY,
        label: getAppLabel(null),
        description: 'Applies to every application',
      });
      seen.add(GLOBAL_APP_KEY);
    }

    for (const appKey of provisioningContext.manageableAppKeys ?? []) {
      if (seen.has(appKey)) continue;
      options.push({
        value: appKey,
        label: getAppLabel(appKey),
        description: 'Provision users scoped to this app',
      });
      seen.add(appKey);
    }

    return options;
  }, [provisioningContext, getAppLabel]);

  const defaultAppKey = provisioningContext?.defaultAppKey ?? manageableAppOptions[0]?.value;
  const canProvisionUsers = manageableAppOptions.length > 0;
  const createButtonDisabled = provisioningContextLoading || !canProvisionUsers;
  const createUserDisabledReason = provisioningContextLoading
    ? 'Loading your provisioning scopes...'
    : !canProvisionUsers
      ? 'You do not have permission to create users.'
      : undefined;

  const disableUserMutation = trpc.admin.disableUser.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onError: (error) => {
      toast.error(error.message || 'Failed to delete user');
    },
  });

  const enableUserMutation = trpc.admin.enableUser.useMutation({
    onSuccess: () => refetch(),
  });



  const selectedUser = data?.users.find((u) => u.id === selectedUserId) || null;

  const passwordResetOptions = useMemo<AppOption[]>(() => {
    if (!selectedUser || !provisioningContext) return [];

    const options: AppOption[] = [];

    if (provisioningContext.canManageSystem) {
      options.push({
        value: GLOBAL_APP_KEY,
        label: getAppLabel(null),
      });
    }

    const userAppKeys = new Set(
      selectedUser.userRoles.map((role) => role.appKey).filter((key): key is string => Boolean(key))
    );

    const uniqueManageableKeys = Array.from(new Set(provisioningContext.manageableAppKeys ?? []));
    uniqueManageableKeys.forEach((appKey) => {
      if (userAppKeys.has(appKey)) {
        options.push({
          value: appKey,
          label: getAppLabel(appKey),
        });
      }
    });

    return options;
  }, [getAppLabel, provisioningContext, selectedUser]);

  const canSendPasswordReset = passwordResetOptions.length > 0;

  const sendPasswordResetMutation = trpc.admin.sendPasswordReset.useMutation({
    onSuccess: () => {
      toast.success('Password reset email sent.');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send password reset email.');
    },
  });

  const defaultResetRedirect = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    return `${window.location.origin}/auth/reset-password`;
  }, []);

  const handlePasswordResetRequest = useCallback(
    (appKey?: string) => {
      if (!selectedUser) return;
      sendPasswordResetMutation.mutate({
        userId: selectedUser.id,
        appKey,
        redirectTo: defaultResetRedirect,
      });
    },
    [defaultResetRedirect, selectedUser, sendPasswordResetMutation]
  );

  const handleCreateNew = () => {
    setSelectedUserId(null);
    setMode('create');
  };

  const handleSelectUser = (user: User) => {
    setSelectedUserId(user.id);
    setMode('view');
  };

  const handleEdit = () => {
    setMode('edit');
  };

  const handleCancelEdit = () => {
    setMode('view');
  };

  const handleSaveSuccess = () => {
    refetch();
    if (mode === 'create') {
      setMode('view');
      setSelectedUserId(null);
    } else {
      setMode('view');
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const filteredUsers = data?.users || [];

  const userStats = useMemo(() => {
    const users = data?.users ?? [];
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const pendingResets = users.filter((u) => u.mustChangePassword).length;
    const disabled = Math.max(total - active, 0);
    const supervisors = users.filter((u) =>
      u.userRoles.some((role) => role.role.key === 'manager' || role.role.key === 'admin')
    ).length;

    return [
      {
        label: 'Total accounts',
        value: total,
        helper: `${active} active`,
      },
      {
        label: 'Pending password resets',
        value: pendingResets,
        helper: 'Must change on next login',
      },
      {
        label: 'Disabled users',
        value: disabled,
        helper: 'Awaiting reactivation',
      },
      {
        label: 'Supervisors & admins',
        value: supervisors,
        helper: 'Have elevated access',
      },
    ];
  }, [data?.users]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Admin · Users
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">User directory & access</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Monitor account health, enforce password policies, and create new workspace accounts
              without leaving this view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              Refresh data
            </Button>
            <Button
              size="sm"
              onClick={handleCreateNew}
              disabled={createButtonDisabled}
              title={createUserDisabledReason}
            >
              <UserPlus className="mr-2 h-4 w-4" /> Create user
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {userStats.map((stat) => (
          <Card key={stat.label} className="border-muted/60 bg-card/90 shadow-sm">
            <CardHeader className="pb-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-3xl font-semibold tracking-tight">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex min-h-[calc(100vh-12rem)] gap-6">
        {/* Left Panel - User List */}
        <div className="w-96 flex flex-col border rounded-lg bg-card">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Users</h2>
              <Button
                size="sm"
                onClick={handleCreateNew}
                disabled={createButtonDisabled}
                title={createUserDisabledReason}
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
                <div className="text-center py-8 text-muted-foreground">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No users found</div>
              ) : (
                <div className="space-y-1">
                  {filteredUsers.map((user) => {
                    const accessSummary = summarizeAppAccess(user, getAppLabel);
                    const summaryBadges = accessSummary.slice(0, 2);

                    return (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className={`w-full text-left p-3 rounded-md transition-colors ${selectedUserId === user.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{user.name}</div>
                            <div className="text-sm opacity-80 truncate">{user.email}</div>
                            {user.department && (
                              <div className="text-xs opacity-70 mt-1">{user.department}</div>
                            )}
                            {summaryBadges.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {summaryBadges.map((summary) => (
                                  <Badge
                                    key={`${user.id}-${summary.scopeKey}`}
                                    variant="secondary"
                                    className="text-[10px] font-semibold"
                                  >
                                    {summary.label}
                                    <span className="ml-1 uppercase tracking-wide">
                                      L{summary.highestLevel}
                                    </span>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {user.isActive ? (
                              <Badge variant="outline" className="text-xs">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                Disabled
                              </Badge>
                            )}
                            {user.userRoles.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {user.userRoles.length} role{user.userRoles.length !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - User Details/Form */}
        <div className="flex-1 border rounded-lg bg-card">
          {mode === 'create' ? (
            <CreateUserPanel
              roles={roles || []}
              onSuccess={handleSaveSuccess}
              onCancel={() => {
                setMode('view');
                setSelectedUserId(null);
              }}
              appOptions={manageableAppOptions}
              initialAppKey={defaultAppKey}
              isProvisioningEnabled={canProvisionUsers}
              isContextLoading={provisioningContextLoading}
            />
          ) : selectedUser && mode === 'edit' ? (
            <EditUserPanel
              user={selectedUser}
              roles={roles || []}
              onSuccess={handleSaveSuccess}
              onCancel={handleCancelEdit}
              onDelete={() => handleDeleteClick(selectedUser)}
              appOptions={manageableAppOptions}
              initialAppKey={defaultAppKey}
              isContextLoading={provisioningContextLoading}
            />
          ) : selectedUser ? (
            <UserDetailsPanel
              user={selectedUser}
              onEdit={handleEdit}
              onDelete={() => handleDeleteClick(selectedUser)}
              onDisable={() => disableUserMutation.mutate({ userId: selectedUser.id })}
              onEnable={() => enableUserMutation.mutate({ userId: selectedUser.id })}
              resolveAppLabel={getAppLabel}
              passwordResetOptions={passwordResetOptions}
              passwordResetReady={!provisioningContextLoading}
              canSendPasswordReset={canSendPasswordReset}
              onSendPasswordReset={handlePasswordResetRequest}
              passwordResetPending={sendPasswordResetMutation.isPending}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No user selected</p>
                <p className="text-sm mt-1">Select a user from the list or create a new one</p>
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete user &ldquo;{userToDelete?.name}&rdquo;? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (userToDelete) {
                    try {
                      await deleteUserMutation.mutateAsync({ userId: userToDelete.id });
                      toast.success('User deleted successfully');
                      setDeleteDialogOpen(false);
                      setUserToDelete(null);
                      setSelectedUserId(null);
                      setMode('view');
                      refetch();
                    } catch (error) {
                      // Error handled by mutation callback
                    }
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// User Details View Panel
function UserDetailsPanel({
  user,
  onEdit,
  onDelete,
  onDisable,
  onEnable,
  resolveAppLabel,
  passwordResetOptions,
  passwordResetReady,
  canSendPasswordReset,
  onSendPasswordReset,
  passwordResetPending,
}: {
  user: User;
  onEdit: () => void;
  onDelete: () => void;
  onDisable: () => void;
  onEnable: () => void;
  resolveAppLabel: (key: string | null) => string;
  passwordResetOptions: AppOption[];
  passwordResetReady: boolean;
  canSendPasswordReset: boolean;
  onSendPasswordReset: (appKey?: string) => void;
  passwordResetPending: boolean;
}) {
  const passwordChangedAtLabel = user.passwordChangedAt
    ? new Date(user.passwordChangedAt).toLocaleString()
    : 'Not recorded';
  const appAccessEntries = useMemo(
    () => summarizeAppAccess(user, resolveAppLabel),
    [resolveAppLabel, user]
  );
  const [passwordResetScope, setPasswordResetScope] = useState<string | undefined>(
    passwordResetOptions[0]?.value
  );

  useEffect(() => {
    if (passwordResetOptions.length > 0) {
      setPasswordResetScope(passwordResetOptions[0].value);
    } else {
      setPasswordResetScope(undefined);
    }
  }, [passwordResetOptions]);

  const handlePasswordResetClick = () => {
    if (!passwordResetScope) return;
    const scopedValue = passwordResetScope === GLOBAL_APP_KEY ? undefined : passwordResetScope;
    onSendPasswordReset(scopedValue);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{user.name}</h2>
            <p className="text-muted-foreground mt-1">{user.email}</p>
          </div>
          <div className="flex gap-2">
            {user.isActive ? (
              <Button variant="outline" size="sm" onClick={onDisable}>
                <Ban className="mr-2 h-4 w-4" />
                Disable
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onEnable}>
                <CheckCircle className="mr-2 h-4 w-4" />
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
                  <Label className="text-xs text-muted-foreground">Username</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{user.username || '-'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Display Name</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{user.displayName || '-'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Department</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{user.department || '-'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    {user.isActive ? (
                      <Badge variant="default" className="bg-green-500">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Password Policy</Label>
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">
                        {user.mustChangePassword ? 'Must change on next login' : 'Compliant'}
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
              <CardTitle className="text-lg">App access</CardTitle>
              <CardDescription>Applications and access levels granted to this user</CardDescription>
            </CardHeader>
            <CardContent>
              {appAccessEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No application roles assigned.</p>
              ) : (
                <div className="space-y-3">
                  {appAccessEntries.map((entry) => (
                    <div
                      key={entry.scopeKey}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="font-medium">{entry.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Level {entry.highestLevel} · {entry.roleCount} role
                          {entry.roleCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {entry.roles.slice(0, 2).join(', ')}
                        {entry.roles.length > 2 && ` +${entry.roles.length - 2}`}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assigned Roles</CardTitle>
              <CardDescription>Roles and permissions granted to this user</CardDescription>
            </CardHeader>
            <CardContent>
              {user.userRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No roles assigned</p>
              ) : (
                <div className="space-y-3">
                  {user.userRoles.map((ur, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div>
                        <div className="font-medium">{ur.role.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Level {ur.role.level}
                          {ur.appKey && ` • ${ur.appKey}`}
                        </div>
                      </div>
                      <Badge variant="secondary">{ur.role.key}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security actions</CardTitle>
              <CardDescription>Reset credentials or enforce password policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!passwordResetReady ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking password reset permissions…
                </div>
              ) : canSendPasswordReset ? (
                <>
                  {passwordResetOptions.length > 1 && (
                    <div className="space-y-2">
                      <Label htmlFor="password-reset-scope">Reset scope</Label>
                      <Select
                        value={passwordResetScope}
                        onValueChange={setPasswordResetScope}
                        disabled={passwordResetPending}
                      >
                        <SelectTrigger id="password-reset-scope">
                          <SelectValue placeholder="Choose application" />
                        </SelectTrigger>
                        <SelectContent>
                          {passwordResetOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePasswordResetClick}
                    disabled={passwordResetPending || !passwordResetScope}
                  >
                    {passwordResetPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="mr-2 h-4 w-4" />
                    )}
                    Send password reset email
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    An email with password reset instructions will be sent to {user.email}.
                  </p>
                </>
              ) : (
                <Alert variant="destructive">
                  <AlertTitle>Action unavailable</AlertTitle>
                  <AlertDescription>
                    You do not have permission to reset passwords for this account.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

// Create User Panel
function CreateUserPanel({
  roles,
  onSuccess,
  onCancel,
  appOptions,
  initialAppKey,
  isProvisioningEnabled,
  isContextLoading,
}: {
  roles: Role[];
  onSuccess: () => void;
  onCancel: () => void;
  appOptions: AppOption[];
  initialAppKey?: string | null;
  isProvisioningEnabled: boolean;
  isContextLoading?: boolean;
}) {
  const [email, setEmail] = useState('');
  const [activeTab, setActiveTab] = useState('info');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('');
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<Set<string>>(new Set());
  const [appKey, setAppKey] = useState<string>(() => {
    if (initialAppKey && appOptions.some((option) => option.value === initialAppKey)) {
      return initialAppKey;
    }

    return appOptions[0]?.value ?? GLOBAL_APP_KEY;
  });
  const [passwordStrategy, setPasswordStrategy] = useState<'auto' | 'manual'>('auto');
  const [password, setPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);
  type CreationResult = {
    user: {
      id: string;
      email: string;
      username?: string | null;
    };
    generatedPassword?: string;
    mustChangePassword: boolean;
  };
  const [creationResult, setCreationResult] = useState<CreationResult | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [autoPassword, setAutoPassword] = useState('');
  const [autoCopyState, setAutoCopyState] = useState<'idle' | 'copied'>('idle');

  const debouncedUsername = useDebounce(username.trim(), 400);

  const usernameAvailabilityQuery = trpc.admin.checkUsernameAvailability.useQuery(
    { username: debouncedUsername, appKey: appKey === GLOBAL_APP_KEY ? undefined : appKey },
    {
      enabled: debouncedUsername.length >= 3,
      staleTime: 10_000,
    }
  );

  const usernameCheckEnabled = debouncedUsername.length >= 3;
  const usernameAvailability = usernameAvailabilityQuery.data?.available;

  const generatePasswordMutation = trpc.admin.generateSecurePassword.useMutation({
    onError: () => toast.error('Unable to generate a secure password. Please try again.'),
  });

  const ensureAutoPassword = useCallback(async () => {
    if (passwordStrategy !== 'auto' || creationResult) return;
    if (autoPassword) return;
    const generated = await generatePasswordMutation.mutateAsync({});
    setAutoPassword(generated.password);
    setAutoCopyState('idle');
  }, [autoPassword, creationResult, generatePasswordMutation, passwordStrategy]);

  useEffect(() => {
    if (passwordStrategy === 'auto' && !creationResult && !autoPassword) {
      ensureAutoPassword().catch(() => undefined);
    }

    if (passwordStrategy === 'manual' && autoPassword) {
      setAutoPassword('');
    }
  }, [autoPassword, creationResult, ensureAutoPassword, passwordStrategy]);

  const createUserMutation = trpc.admin.createUser.useMutation({
    onError: (error) => {
      console.error('Create user error:', error);
      toast.error(error.message || 'Failed to create user');
    },
  });

  const assignRoleMutation = trpc.admin.assignRole.useMutation();

  useEffect(() => {
    if (
      initialAppKey &&
      initialAppKey !== appKey &&
      appOptions.some((option) => option.value === initialAppKey)
    ) {
      setAppKey(initialAppKey);
      return;
    }

    if (!appOptions.some((option) => option.value === appKey) && appOptions[0]) {
      setAppKey(appOptions[0].value);
    }
  }, [appKey, appOptions, initialAppKey]);

  const provisioningBlocked = !isProvisioningEnabled && !isContextLoading;
  const selectedAppOption = appOptions.find((option) => option.value === appKey);
  const resolvedAppScope = appKey === GLOBAL_APP_KEY ? undefined : appKey;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (creationResult) {
      return;
    }

    if (provisioningBlocked) {
      toast.error('You do not have permission to create users.');
      return;
    }

    if (!username.trim()) {
      toast.error('Username is required.');
      return;
    }

    if (passwordStrategy === 'manual' && password.length < 8) {
      toast.error('Manual passwords must be at least 8 characters long.');
      return;
    }

    if (usernameCheckEnabled && usernameAvailability === false) {
      setUsernameTouched(true);
      toast.error('That username is already in use.');
      return;
    }

    if (passwordStrategy === 'auto' && !autoPasswordReady) {
      toast.error('Generate a secure password before creating the user.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        email,
        username: username.trim(),
        name,
        displayName: displayName || undefined,
        department: department || undefined,
        roleKeys: Array.from(selectedRoleKeys),
        appKey: resolvedAppScope,
        passwordStrategy,
        password: passwordStrategy === 'manual' ? password : undefined,
        providedPassword:
          passwordStrategy === 'auto' && autoPasswordValue.length > 0
            ? autoPasswordValue
            : undefined,
        mustChangePassword,
      } as const;

      const result = await createUserMutation.mutateAsync(payload);
      const createdUser = result.user;

      // Assign roles if any selected
      if (selectedRoleKeys.size > 0) {
        for (const roleKey of Array.from(selectedRoleKeys)) {
          await assignRoleMutation.mutateAsync({
            userId: createdUser.id,
            roleKey,
            appKey: resolvedAppScope,
          });
        }
      }

      setCreationResult({
        user: {
          id: createdUser.id,
          email: createdUser.email,
          username: createdUser.username,
        },
        generatedPassword: result.generatedPassword,
        mustChangePassword: result.mustChangePassword,
      });
      setCopyState('idle');
      toast.success('User created successfully');
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Unable to create user. Please review the form and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleRole = (roleKey: string) => {
    if (creationResult) return;
    const newRoles = new Set(selectedRoleKeys);
    if (newRoles.has(roleKey)) {
      newRoles.delete(roleKey);
    } else {
      newRoles.add(roleKey);
    }
    setSelectedRoleKeys(newRoles);
  };

  const handleCopyPassword = async () => {
    if (!creationResult?.generatedPassword) return;
    try {
      await navigator.clipboard.writeText(creationResult.generatedPassword);
      setCopyState('copied');
      toast.success('Temporary password copied to clipboard');
      setTimeout(() => setCopyState('idle'), 2500);
    } catch (err) {
      console.error('Clipboard copy failed', err);
      toast.error('Unable to copy password. Please copy it manually.');
    }
  };

  const handleCopyAutoPassword = async () => {
    if (!autoPasswordValue) return;
    try {
      await navigator.clipboard.writeText(autoPasswordValue);
      setAutoCopyState('copied');
      toast.success('Temporary password copied');
      setTimeout(() => setAutoCopyState('idle'), 2000);
    } catch (err) {
      console.error('Clipboard copy failed', err);
      toast.error('Unable to copy password.');
    }
  };

  const handleRegenerateAutoPassword = async () => {
    if (formLocked) return;
    try {
      const generated = await generatePasswordMutation.mutateAsync({});
      setAutoPassword(generated.password);
      setAutoCopyState('idle');
    } catch (err) {
      console.error('Failed to regenerate password', err);
    }
  };

  const resetFormState = () => {
    setEmail('');
    setUsername('');
    setUsernameTouched(false);
    setName('');
    setDisplayName('');
    setDepartment('');
    setPassword('');
    setPasswordStrategy('auto');
    setMustChangePassword(true);
    setSelectedRoleKeys(new Set());
    if (initialAppKey && appOptions.some((option) => option.value === initialAppKey)) {
      setAppKey(initialAppKey);
    } else if (appOptions[0]) {
      setAppKey(appOptions[0].value);
    } else {
      setAppKey(GLOBAL_APP_KEY);
    }
    setCreationResult(null);
    setCopyState('idle');
    setAutoPassword('');
    setAutoCopyState('idle');
  };

  const handleFinish = () => {
    resetFormState();
    onSuccess();
  };

  const formLocked = Boolean(creationResult);
  const disableInputs =
    provisioningBlocked ||
    formLocked ||
    isSubmitting ||
    createUserMutation.isPending ||
    assignRoleMutation.isPending;
  const usernameChecking = usernameCheckEnabled && usernameAvailabilityQuery.isFetching;
  const usernameHasError =
    usernameCheckEnabled && usernameTouched && usernameAvailability === false;
  const usernameIsAvailable = usernameCheckEnabled && usernameAvailability;
  const autoPasswordValue = autoPassword.trim();
  const autoPasswordReady = passwordStrategy === 'auto' ? autoPasswordValue.length >= 8 : true;
  const submitDisabled =
    disableInputs ||
    usernameChecking ||
    (usernameCheckEnabled && usernameAvailability === false) ||
    !autoPasswordReady;

  const passwordStrategyLabel =
    passwordStrategy === 'auto' ? 'Auto-generated password' : 'Manual password';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">Create New User</h2>
            <p className="text-muted-foreground mt-1">Add a new user to the system</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!disableInputs) {
                  onCancel();
                }
              }}
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
              <Button type="submit" size="sm" disabled={submitDisabled}>
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Creating...' : 'Create User'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        {isContextLoading && (
          <Alert className="mb-4">
            <AlertTitle>Loading provisioning scopes</AlertTitle>
            <AlertDescription>
              We are fetching the applications you are allowed to manage. This only takes a moment.
            </AlertDescription>
          </Alert>
        )}
        {provisioningBlocked && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Provisioning restricted</AlertTitle>
            <AlertDescription>
              You currently do not have permission to create users for any application scopes.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info" onClick={() => setActiveTab('info')}>User Information</TabsTrigger>
            <TabsTrigger value="roles" onClick={() => setActiveTab('roles')}>Roles & Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
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
                disabled={disableInputs}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. jdoe"
                required
                disabled={disableInputs}
                autoCapitalize="none"
                autoCorrect="off"
                minLength={3}
                onBlur={() => setUsernameTouched(true)}
              />
              <div className="flex items-center gap-2 text-xs" aria-live="polite">
                {usernameCheckEnabled ? (
                  usernameChecking ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Checking availability...</span>
                    </>
                  ) : usernameIsAvailable ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-emerald-600">
                        Great choice — username is available.
                      </span>
                    </>
                  ) : usernameHasError ? (
                    <>
                      <X className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-destructive">Username already exists.</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Start typing to check availability.
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground">Start typing to check availability.</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Letters, numbers, dashes, underscores, and periods are allowed.
              </p>
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
                disabled={disableInputs}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="John D."
                disabled={disableInputs}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering"
                disabled={disableInputs}
              />
            </div>
            <div className="space-y-3">
              <Label>Password strategy</Label>
              <RadioGroup
                value={passwordStrategy}
                onValueChange={(value) => setPasswordStrategy(value as 'auto' | 'manual')}
                className="grid gap-2 md:grid-cols-2"
              >
                <label
                  htmlFor="password-strategy-auto"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/40"
                >
                  <RadioGroupItem
                    id="password-strategy-auto"
                    value="auto"
                    disabled={disableInputs}
                  />
                  <div>
                    <div className="font-medium">Generate secure password</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      We will create a strong temporary password that the admin can copy and share.
                    </p>
                  </div>
                </label>
                <label
                  htmlFor="password-strategy-manual"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/40"
                >
                  <RadioGroupItem
                    id="password-strategy-manual"
                    value="manual"
                    disabled={disableInputs}
                  />
                  <div>
                    <div className="font-medium">Set password manually</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter a password that meets complexity requirements.
                      <br />
                      It will not be shown again.
                    </p>
                  </div>
                </label>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Selected:
                <span className="ml-1 font-medium">{passwordStrategyLabel}</span>
              </p>
            </div>
            {passwordStrategy === 'auto' && (
              <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-semibold">Temporary password preview</Label>
                    <p className="text-xs text-muted-foreground">
                      Share or adjust this value before provisioning. It will be enforced during
                      account creation.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateAutoPassword}
                      disabled={disableInputs || generatePasswordMutation.isPending}
                    >
                      {generatePasswordMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="mr-2 h-4 w-4" />
                      )}
                      Refresh
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyAutoPassword}
                      disabled={!autoPasswordReady}
                    >
                      {autoCopyState === 'copied' ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <ClipboardCopy className="mr-2 h-4 w-4" />
                      )}
                      {autoCopyState === 'copied' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
                <Input
                  value={autoPassword}
                  onChange={(e) => setAutoPassword(e.target.value)}
                  disabled={disableInputs}
                  className="font-mono"
                  placeholder="Secure password will appear here"
                  minLength={8}
                />
                {!autoPasswordReady && (
                  <p className="text-xs text-destructive">
                    Password must include at least 8 characters before you can create the user.
                  </p>
                )}
              </div>
            )}
            {passwordStrategy === 'manual' && (
              <div className="space-y-2">
                <Label htmlFor="manual-password">
                  Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="manual-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a temporary password"
                  disabled={disableInputs}
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters. Encourage users to keep it confidential until they sign in.
                </p>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="must-change-password" className="flex items-center gap-2">
                  <Key className="h-4 w-4" /> Change password after first login
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  When enabled, the user must set a new password before they can access any module.
                </p>
              </div>
              <Switch
                id="must-change-password"
                checked={mustChangePassword}
                onCheckedChange={(checked) => setMustChangePassword(Boolean(checked))}
                disabled={disableInputs}
              />
            </div>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="appKey">Application Context</Label>
              <Select
                value={appKey}
                onValueChange={setAppKey}
                disabled={disableInputs || appOptions.length <= 1}
              >
                <SelectTrigger id="appKey">
                  <SelectValue placeholder="Select context" />
                </SelectTrigger>
                <SelectContent>
                  {appOptions.length === 0 ? (
                    <SelectItem value={GLOBAL_APP_KEY} disabled>
                      No application scopes available
                    </SelectItem>
                  ) : (
                    appOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedAppOption?.description ||
                  'Assign roles for a specific application or globally'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Available Roles</Label>
              <ScrollArea className="h-[400px] border rounded-md p-4">
                <div className="space-y-3">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={selectedRoleKeys.has(role.key)}
                        onCheckedChange={() => handleToggleRole(role.key)}
                        disabled={disableInputs}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={`role-${role.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {role.name}
                          {role.isSystem && (
                            <Badge variant="secondary" className="ml-2">
                              System
                            </Badge>
                          )}
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {role.description || 'No description'} • Level {role.level}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        {creationResult && (
          <Alert className="mt-6">
            <AlertTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> User provisioned
            </AlertTitle>
            <AlertDescription className="space-y-3">
              <div className="text-sm">
                <div>
                  <span className="font-medium">Username:</span>{' '}
                  {creationResult.user.username || '—'}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {creationResult.user.email}
                </div>
                <div>
                  <span className="font-medium">Must change password:</span>{' '}
                  {creationResult.mustChangePassword ? 'Yes' : 'No'}
                </div>
              </div>
              {creationResult.generatedPassword ? (
                <div className="flex items-center gap-3">
                  <code className="rounded bg-muted px-3 py-1 text-sm">
                    {creationResult.generatedPassword}
                  </code>
                  <Button type="button" size="sm" variant="outline" onClick={handleCopyPassword}>
                    {copyState === 'copied' ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <ClipboardCopy className="mr-2 h-4 w-4" />
                    )}
                    {copyState === 'copied' ? 'Copied' : 'Copy password'}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Password was set manually. For security, it cannot be retrieved from the system.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Share the credentials securely and remind the user about your password policy.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </ScrollArea>
    </form>
  );
}

// Edit User Panel
function EditUserPanel({
  user,
  roles,
  onSuccess,
  onCancel,
  appOptions,
  initialAppKey,
  isContextLoading,
}: {
  user: User;
  roles: Role[];
  onSuccess: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  appOptions: AppOption[];
  initialAppKey?: string | null;
  isContextLoading?: boolean;
}) {
  const [name, setName] = useState(user.name);
  const [activeTab, setActiveTab] = useState('info');
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [department, setDepartment] = useState(user.department || '');
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<Set<string>>(
    new Set(user.userRoles.map((ur) => ur.role.key))
  );
  const [appKey, setAppKey] = useState<string>(() => {
    if (initialAppKey && appOptions.some((option) => option.value === initialAppKey)) {
      return initialAppKey;
    }

    return appOptions[0]?.value ?? GLOBAL_APP_KEY;
  });

  const updateUserMutation = trpc.admin.updateUser.useMutation();
  const assignRoleMutation = trpc.admin.assignRole.useMutation();
  const revokeRoleMutation = trpc.admin.revokeRole.useMutation();

  useEffect(() => {
    if (
      initialAppKey &&
      initialAppKey !== appKey &&
      appOptions.some((option) => option.value === initialAppKey)
    ) {
      setAppKey(initialAppKey);
      return;
    }

    if (!appOptions.some((option) => option.value === appKey) && appOptions[0]) {
      setAppKey(appOptions[0].value);
    }
  }, [appKey, appOptions, initialAppKey]);

  const resolvedAppScope = appKey === GLOBAL_APP_KEY ? undefined : appKey;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Update user info
      await updateUserMutation.mutateAsync({
        userId: user.id,
        name,
        displayName: displayName || undefined,
        department: department || undefined,
      });

      // Update roles
      const currentRoleKeys = new Set(user.userRoles.map((ur) => ur.role.key));
      const rolesToAdd = Array.from(selectedRoleKeys).filter((key) => !currentRoleKeys.has(key));
      const rolesToRemove = Array.from(currentRoleKeys).filter((key) => !selectedRoleKeys.has(key));

      for (const roleKey of rolesToAdd) {
        await assignRoleMutation.mutateAsync({
          userId: user.id,
          roleKey,
          appKey: resolvedAppScope,
        });
      }

      for (const roleKey of rolesToRemove) {
        const userRole = user.userRoles.find((ur) => ur.role.key === roleKey);
        if (userRole) {
          await revokeRoleMutation.mutateAsync({
            userId: user.id,
            roleKey,
            appKey: userRole.appKey || undefined,
          });
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleToggleRole = (roleKey: string) => {
    const newRoles = new Set(selectedRoleKeys);
    if (newRoles.has(roleKey)) {
      newRoles.delete(roleKey);
    } else {
      newRoles.add(roleKey);
    }
    setSelectedRoleKeys(newRoles);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">Edit User</h2>
            <p className="text-muted-foreground mt-1">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={updateUserMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info" onClick={() => setActiveTab('info')}>User Information</TabsTrigger>
            <TabsTrigger value="roles" onClick={() => setActiveTab('roles')}>Roles & Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={user.email} disabled />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-displayName">Display Name</Label>
              <Input
                id="edit-displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">Department</Label>
              <Input
                id="edit-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-appKey">Application Context</Label>
              <Select
                value={appKey}
                onValueChange={setAppKey}
                disabled={isContextLoading || appOptions.length <= 1}
              >
                <SelectTrigger id="edit-appKey">
                  <SelectValue placeholder="Select context" />
                </SelectTrigger>
                <SelectContent>
                  {appOptions.length === 0 ? (
                    <SelectItem value={GLOBAL_APP_KEY} disabled>
                      No application scopes available
                    </SelectItem>
                  ) : (
                    appOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Assign or revoke roles for this application scope
              </p>
            </div>

            <div className="space-y-2">
              <Label>Available Roles</Label>
              <ScrollArea className="h-[400px] border rounded-md p-4">
                <div className="space-y-3">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`edit-role-${role.id}`}
                        checked={selectedRoleKeys.has(role.key)}
                        onCheckedChange={() => handleToggleRole(role.key)}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={`edit-role-${role.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {role.name}
                          {role.isSystem && (
                            <Badge variant="secondary" className="ml-2">
                              System
                            </Badge>
                          )}
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {role.description || 'No description'} • Level {role.level}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </form>
  );
}
