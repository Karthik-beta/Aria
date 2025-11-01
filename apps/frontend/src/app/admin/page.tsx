import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Shield, Key, FileText } from 'lucide-react';

export default function AdminPage() {
  const adminSections = [
    {
      title: 'User Management',
      description: 'Manage users, roles, and permissions',
      href: '/admin/users',
      icon: Users,
    },
    {
      title: 'Roles & Permissions',
      description: 'Configure roles and permission assignments',
      href: '/admin/roles',
      icon: Shield,
    },
    {
      title: 'Supervisors',
      description: 'Manage app supervisors and delegated access',
      href: '/admin/supervisors',
      icon: Key,
    },
    {
      title: 'Audit Logs',
      description: 'View authorization change history',
      href: '/admin/audit',
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
        <p className="text-muted-foreground">
          Manage users, roles, permissions, and authorization settings
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {adminSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{section.title}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
