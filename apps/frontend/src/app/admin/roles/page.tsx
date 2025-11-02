'use client';

import { trpc } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function RolesPage() {
  const { data: roles, isLoading } = trpc.admin.listRoles.useQuery();
  const { data: permissions } = trpc.admin.listPermissions.useQuery();

  if (isLoading) {
    return <div className="text-center py-12">Loading roles...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Roles & Permissions</h2>
          <p className="text-muted-foreground">Manage roles and their permission assignments</p>
        </div>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles?.map((role) => (
              <Card key={role.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <CardTitle>{role.name}</CardTitle>
                    </div>
                    {role.isSystem && <Badge variant="secondary">System</Badge>}
                  </div>
                  <CardDescription>
                    Level {role.level} · {role.description || 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Permissions:</p>
                    <div className="flex flex-wrap gap-1">
                      {role.rolePermissions?.slice(0, 5).map((rp) => (
                        <Badge key={rp.permission.id} variant="outline" className="text-xs">
                          {rp.permission.key}
                        </Badge>
                      ))}
                      {(role.rolePermissions?.length || 0) > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{(role.rolePermissions?.length || 0) - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <div className="space-y-4">
            <PermissionSection
              title="System Permissions"
              permissions={permissions?.filter((p) => p.scope === 'system') || []}
            />
            <PermissionSection
              title="App Permissions"
              permissions={permissions?.filter((p) => p.scope === 'app') || []}
            />
            <PermissionSection
              title="Entity Permissions"
              permissions={permissions?.filter((p) => p.scope === 'entity') || []}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PermissionSection({
  title,
  permissions,
}: {
  title: string;
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
        <CardDescription>{permissions.length} permissions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
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
        </div>
      </CardContent>
    </Card>
  );
}
