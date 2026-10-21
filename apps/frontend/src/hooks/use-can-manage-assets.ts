"use client";

import { useAuth } from "@/hooks/use-auth";

/**
 * Organization roles allowed to change asset records.
 *
 * Mirrors `ASSET_MANAGER_ROLES` in the backend asset router, which enforces
 * the same rule on every asset mutation.
 */
export const ASSET_MANAGER_ROLES = ["owner", "admin"];

/**
 * Whether a member role grants asset write access. better-auth stores
 * multiple organization roles as a comma-separated string ("member,admin").
 */
export function isAssetManagerRole(memberRole: string | null): boolean {
	if (!memberRole) return false;
	return memberRole
		.split(",")
		.some((role) => ASSET_MANAGER_ROLES.includes(role.trim()));
}

/**
 * Whether the current user may create, edit, submit, cancel or delete asset
 * records. Super admins bypass organization roles, as they do on the backend.
 * Viewing, exporting and completing maintenance logs stay open to everyone.
 */
export function useCanManageAssets(): boolean {
	const { role, memberRole } = useAuth();
	return role === "super_admin" || isAssetManagerRole(memberRole);
}
