"use client";

import { AppUserManagement } from "@/components/auth/app-user-management";

export default function InventoryUsersPage() {
	return (
		<AppUserManagement
			orgSlug="inventory"
			appName="Inventory"
			appRoute="/inventory/dashboard/overview"
		/>
	);
}
