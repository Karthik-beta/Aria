"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

interface ProtectedProps {
	children: ReactNode;
	fallback?: ReactNode;
}

interface RoleGateProps extends ProtectedProps {
	role: string | string[];
	requireAll?: boolean;
}

/**
 * Only renders children when all role conditions are satisfied.
 *
 * @param role - Single role or array of roles
 * @param requireAll - If true, requires all roles; if false (default), requires any
 * @param fallback - Optional fallback UI when role check fails
 */
export function RoleGate({
	role,
	requireAll = false,
	children,
	fallback = null,
}: RoleGateProps) {
	const { hasRole, hasAnyRole, isLoading } = useAuth();

	if (isLoading) return null;

	const roles = Array.isArray(role) ? role : [role];

	const hasAccess = requireAll ? roles.every(hasRole) : hasAnyRole(...roles);

	return hasAccess ? children : fallback;
}

/**
 * Only renders children when the user is authenticated and active.
 *
 * @param fallback - Optional fallback UI for unauthenticated/inactive users
 */
export function AuthGate({ children, fallback = null }: ProtectedProps) {
	const { isAuthenticated, isActive, isLoading } = useAuth();

	if (isLoading) return null;

	return isAuthenticated && isActive ? children : fallback;
}
