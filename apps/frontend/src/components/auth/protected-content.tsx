'use client';

import { ReactNode } from 'react';
import { useAuth, usePermission, useRole, useAppAccess } from '@/hooks/use-auth';

interface ProtectedProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface PermissionGateProps extends ProtectedProps {
  permission: string | string[];
  requireAll?: boolean;
}

interface RoleGateProps extends ProtectedProps {
  role: string | string[];
  requireAll?: boolean;
}

interface AppGateProps extends ProtectedProps {
  appKey: string;
}

/**
 * Only renders children if user has required permission(s)
 *
 * @param permission - Single permission or array of permissions
 * @param requireAll - If true, requires all permissions; if false (default), requires any
 * @param fallback - Optional fallback UI when permission is denied
 */
export function PermissionGate({
  permission,
  requireAll = false,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, isLoading } = useAuth();

  if (isLoading) return null;

  const permissions = Array.isArray(permission) ? permission : [permission];

  const hasAccess = requireAll
    ? permissions.every(hasPermission)
    : hasAnyPermission(...permissions);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * Only renders children if user has required role(s)
 *
 * @param role - Single role or array of roles
 * @param requireAll - If true, requires all roles; if false (default), requires any
 * @param fallback - Optional fallback UI when role is not present
 */
export function RoleGate({ role, requireAll = false, children, fallback = null }: RoleGateProps) {
  const { hasRole, hasAnyRole, isLoading } = useAuth();

  if (isLoading) return null;

  const roles = Array.isArray(role) ? role : [role];

  const hasAccess = requireAll ? roles.every(hasRole) : hasAnyRole(...roles);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * Only renders children if user can access the specified app
 *
 * @param appKey - App key to check access for
 * @param fallback - Optional fallback UI when app access is denied
 */
export function AppGate({ appKey, children, fallback = null }: AppGateProps) {
  const hasAccess = useAppAccess(appKey);
  const { isLoading } = useAuth();

  if (isLoading) return null;

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * Only renders children if user is authenticated and active
 *
 * @param fallback - Optional fallback UI for unauthenticated users
 */
export function AuthGate({ children, fallback = null }: ProtectedProps) {
  const { isAuthenticated, isActive, isLoading } = useAuth();

  if (isLoading) return null;

  return isAuthenticated && isActive ? <>{children}</> : <>{fallback}</>;
}

/**
 * Combination gate that checks multiple conditions
 *
 * @param permission - Optional permission requirement
 * @param role - Optional role requirement
 * @param appKey - Optional app access requirement
 * @param fallback - Optional fallback UI when access is denied
 */
export function ProtectedContent({
  permission,
  role,
  appKey,
  children,
  fallback = null,
}: ProtectedProps & {
  permission?: string | string[];
  role?: string | string[];
  appKey?: string;
}) {
  const {
    isAuthenticated,
    isActive,
    isLoading,
    hasAnyPermission,
    hasAnyRole,
    canAccessApp,
  } = useAuth();

  if (isLoading) return null;

  if (!isAuthenticated || !isActive) {
    return <>{fallback}</>;
  }

  // Check app access
  if (appKey && !canAccessApp(appKey)) {
    return <>{fallback}</>;
  }

  // Check permissions
  if (permission) {
    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasPermissionAccess = hasAnyPermission(...permissions);
    if (!hasPermissionAccess) {
      return <>{fallback}</>;
    }
  }

  // Check roles
  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    const hasRoleAccess = hasAnyRole(...roles);
    if (!hasRoleAccess) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}
