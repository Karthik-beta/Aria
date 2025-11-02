'use client';

import { useSession } from '@/lib/auth-client';
import { useMemo } from 'react';

/**
 * Extended session type with authorization data
 */
export interface AuthorizedSession {
  user: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
    displayName?: string;
  };
  session: {
    id: string;
    expiresAt: Date;
    roles?: string[];
    apps?: Record<string, { roles: string[] }>;
    permissions?: string[];
    supervisedApps?: string[];
    isActive?: boolean;
  };
}

/**
 * Hook to access the current user's authorization context
 *
 * @returns Authorization context with permission/role checking utilities
 */
export function useAuth() {
  const { data: session, isPending } = useSession();

  const authContext = useMemo(() => {
    if (!session) {
      return {
        isAuthenticated: false,
        isActive: false,
        user: null,
        roles: [],
        permissions: [],
        apps: {},
        supervisedApps: [],
        hasPermission: () => false,
        hasAnyPermission: () => false,
        hasRole: () => false,
        hasAnyRole: () => false,
        canAccessApp: () => false,
        isSupervisorOf: () => false,
        isLoading: isPending,
      };
    }

    const sessionData = session.session as unknown as {
      roles?: string[];
      permissions?: string[];
      apps?: Record<string, { roles: string[] }>;
      supervisedApps?: string[];
      isActive?: boolean;
    };

    const roles = sessionData.roles || [];
    const permissions = sessionData.permissions || [];
    const apps = sessionData.apps || {};
    const supervisedApps = sessionData.supervisedApps || [];
    const isActive = sessionData.isActive !== false;

    /**
     * Check if user has a specific permission
     */
    const hasPermission = (permissionKey: string): boolean => {
      if (!isActive) return false;

      // Check for exact match
      if (permissions.includes(permissionKey)) return true;

      // Check for wildcard permissions
      const parts = permissionKey.split(':');

      // Check system:* wildcard
      if (parts[0] === 'system' && permissions.includes('system:*')) {
        return true;
      }

      // Check app:<appKey>:* wildcard
      if (parts[0] === 'app' && parts.length >= 2) {
        if (permissions.includes(`app:${parts[1]}:*`)) return true;
      }

      // Check entity:<appKey>:<entity>:* wildcard
      if (parts[0] === 'entity' && parts.length >= 3) {
        if (permissions.includes(`entity:${parts[1]}:${parts[2]}:*`)) {
          return true;
        }
        if (permissions.includes(`entity:${parts[1]}:*`)) return true;
      }

      return false;
    };

    /**
     * Check if user has any of the specified permissions
     */
    const hasAnyPermission = (...permissionKeys: string[]): boolean => {
      return permissionKeys.some(hasPermission);
    };

    /**
     * Check if user has a specific role
     */
    const hasRole = (roleKey: string): boolean => {
      if (!isActive) return false;
      return roles.includes(roleKey);
    };

    /**
     * Check if user has any of the specified roles
     */
    const hasAnyRole = (...roleKeys: string[]): boolean => {
      if (!isActive) return false;
      return roleKeys.some((role) => roles.includes(role));
    };

    /**
     * Check if user can access a specific app
     */
    const canAccessApp = (appKey: string): boolean => {
      if (!isActive) return false;

      // Super admin has access to all apps
      if (hasRole('super_admin')) return true;

      // Check if user has roles in the app
      return appKey in apps || supervisedApps.includes(appKey);
    };

    /**
     * Check if user is a supervisor of an app
     */
    const isSupervisorOf = (appKey: string): boolean => {
      if (!isActive) return false;
      return supervisedApps.includes(appKey);
    };

    return {
      isAuthenticated: true,
      isActive,
      user: session.user,
      roles,
      permissions,
      apps,
      supervisedApps,
      hasPermission,
      hasAnyPermission,
      hasRole,
      hasAnyRole,
      canAccessApp,
      isSupervisorOf,
      isLoading: false,
    };
  }, [session, isPending]);

  return authContext;
}

/**
 * Hook to check if user has specific permission(s)
 *
 * @param permission - Single permission or array of permissions (any match)
 * @returns Boolean indicating if user has the permission
 */
export function usePermission(permission: string | string[]): boolean {
  const { hasPermission, hasAnyPermission } = useAuth();

  if (Array.isArray(permission)) {
    return hasAnyPermission(...permission);
  }

  return hasPermission(permission);
}

/**
 * Hook to check if user has specific role(s)
 *
 * @param role - Single role or array of roles (any match)
 * @returns Boolean indicating if user has the role
 */
export function useRole(role: string | string[]): boolean {
  const { hasRole, hasAnyRole } = useAuth();

  if (Array.isArray(role)) {
    return hasAnyRole(...role);
  }

  return hasRole(role);
}

/**
 * Hook to check if user can access an app
 *
 * @param appKey - App key to check
 * @returns Boolean indicating if user can access the app
 */
export function useAppAccess(appKey: string): boolean {
  const { canAccessApp } = useAuth();
  return canAccessApp(appKey);
}
