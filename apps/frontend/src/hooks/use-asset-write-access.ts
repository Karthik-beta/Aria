"use client";

import { useAuth } from "@/hooks/use-auth";

/**
 * Asset mutations are available to organization owners/admins and global
 * super-admins. This is an affordance helper only; the backend remains the
 * source of truth for authorization.
 */
export function useAssetWriteAccess(): boolean {
	const { role, isOrgAdmin, isOrgOwner } = useAuth();
	return role === "super_admin" || isOrgAdmin || isOrgOwner;
}
