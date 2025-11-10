'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

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

  const disableUserMutation = trpc.admin.disableUser.useMutation({
    onSuccess: () => refetch(),
  });

  const enableUserMutation = trpc.admin.enableUser.useMutation({
    onSuccess: () => refetch(),
  });

  const selectedUser = data?.users.find((u) => u.id === selectedUserId) || null;

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

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Left Panel - User List */}
      <div className="w-96 flex flex-col border rounded-lg bg-card">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Users</h2>
            <Button size="sm" onClick={handleCreateNew}>
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
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full text-left p-3 rounded-md transition-colors ${
                      selectedUserId === user.id
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
                ))}
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
          />
        ) : selectedUser && mode === 'edit' ? (
          <EditUserPanel
            user={selectedUser}
            roles={roles || []}
            onSuccess={handleSaveSuccess}
            onCancel={handleCancelEdit}
            onDelete={() => handleDeleteClick(selectedUser)}
          />
        ) : selectedUser ? (
          <UserDetailsPanel
            user={selectedUser}
            onEdit={handleEdit}
            onDelete={() => handleDeleteClick(selectedUser)}
            onDisable={() => disableUserMutation.mutate({ userId: selectedUser.id })}
            onEnable={() => enableUserMutation.mutate({ userId: selectedUser.id })}
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
                  // TODO: Implement delete user mutation
                  setDeleteDialogOpen(false);
                  setUserToDelete(null);
                  setSelectedUserId(null);
                  setMode('view');
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
  );
}

// User Details View Panel
function UserDetailsPanel({
  user,
  onEdit,
  onDelete,
  onDisable,
  onEnable,
}: {
  user: User;
  onEdit: () => void;
  onDelete: () => void;
  onDisable: () => void;
  onEnable: () => void;
}) {
  const passwordChangedAtLabel = user.passwordChangedAt
    ? new Date(user.passwordChangedAt).toLocaleString()
    : 'Not recorded';

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
}: {
  roles: Role[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('');
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<Set<string>>(new Set());
  const [appKey, setAppKey] = useState<string>('global');
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

  const createUserMutation = trpc.admin.createUser.useMutation({
    onError: (error) => {
      console.error('Create user error:', error);
      toast.error(error.message || 'Failed to create user');
    },
  });

  const assignRoleMutation = trpc.admin.assignRole.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (creationResult) {
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

    setIsSubmitting(true);

    try {
      const payload = {
        email,
        username: username.trim(),
        name,
        displayName: displayName || undefined,
        department: department || undefined,
        roleKeys: Array.from(selectedRoleKeys),
        appKey: appKey === 'global' ? undefined : appKey,
        passwordStrategy,
        password: passwordStrategy === 'manual' ? password : undefined,
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
            appKey: appKey === 'global' ? undefined : appKey,
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

  const resetFormState = () => {
    setEmail('');
    setUsername('');
    setName('');
    setDisplayName('');
    setDepartment('');
    setPassword('');
    setPasswordStrategy('auto');
    setMustChangePassword(true);
    setSelectedRoleKeys(new Set());
    setAppKey('global');
    setCreationResult(null);
    setCopyState('idle');
  };

  const handleFinish = () => {
    resetFormState();
    onSuccess();
  };

  const formLocked = Boolean(creationResult);
  const disableInputs =
    formLocked || isSubmitting || createUserMutation.isPending || assignRoleMutation.isPending;

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
              <Button type="submit" size="sm" disabled={disableInputs}>
                <Save className="mr-2 h-4 w-4" />
                {disableInputs ? 'Creating...' : 'Create User'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">User Information</TabsTrigger>
            <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
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
              />
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
              <Select value={appKey} onValueChange={setAppKey} disabled={disableInputs}>
                <SelectTrigger id="appKey">
                  <SelectValue placeholder="Select context" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (all apps)</SelectItem>
                  <SelectItem value="asset">Asset Management</SelectItem>
                  <SelectItem value="crm">CRM</SelectItem>
                  <SelectItem value="hrms">HRMS</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Assign roles for a specific application or globally
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
}: {
  user: User;
  roles: Role[];
  onSuccess: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [department, setDepartment] = useState(user.department || '');
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<Set<string>>(
    new Set(user.userRoles.map((ur) => ur.role.key))
  );
  const [appKey, setAppKey] = useState<string>('global');

  const updateUserMutation = trpc.admin.updateUser.useMutation();
  const assignRoleMutation = trpc.admin.assignRole.useMutation();
  const revokeRoleMutation = trpc.admin.revokeRole.useMutation();

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
          appKey: appKey === 'global' ? undefined : appKey,
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
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">User Information</TabsTrigger>
            <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
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
              <Select value={appKey} onValueChange={setAppKey}>
                <SelectTrigger id="edit-appKey">
                  <SelectValue placeholder="Select context" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (all apps)</SelectItem>
                  <SelectItem value="asset">Asset Management</SelectItem>
                  <SelectItem value="crm">CRM</SelectItem>
                  <SelectItem value="hrms">HRMS</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Assign roles for a specific application or globally
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
