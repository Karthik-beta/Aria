'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const APP_ROUTE_MAP: Record<string, string> = {
  inventory: '/inventory',
  asset: '/asset',
  crm: '/crm',
  hrms: '/hrms',
};

const APP_PRIORITY: Array<keyof typeof APP_ROUTE_MAP> = ['inventory', 'asset', 'crm', 'hrms'];

export default function HomePage() {
  const router = useRouter();
  const { apps, isAuthenticated, isLoading, hasRole, canAccessApp } = useAuth();
  const isSuperAdmin = hasRole('super_admin');
  const accessibleKeys = useMemo(() => Object.keys(apps ?? {}), [apps]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return;
    }

    const orderedKeys = APP_PRIORITY.filter((key) => canAccessApp(key));
    const firstAccessible = accessibleKeys.find((key) => canAccessApp(key));
    const fallbackKey =
      orderedKeys[0] || firstAccessible || (isSuperAdmin ? 'inventory' : undefined);
    const targetKey = fallbackKey ?? 'inventory';

    router.replace(APP_ROUTE_MAP[targetKey] ?? '/inventory');
  }, [accessibleKeys, canAccessApp, isAuthenticated, isLoading, isSuperAdmin, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <div className="text-sm text-muted-foreground">Preparing your workspace...</div>
    </div>
  );
}
