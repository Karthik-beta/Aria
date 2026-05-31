"use client";

import { AppUserManagement } from "@/components/auth/app-user-management";

export default function AssetUsersPage() {
	return (
		<AppUserManagement
			orgSlug="asset"
			appName="Asset"
			appRoute="/asset/dashboard/overview"
		/>
	);
}
