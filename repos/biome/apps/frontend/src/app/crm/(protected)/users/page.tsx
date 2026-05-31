"use client";

import { AppUserManagement } from "@/components/auth/app-user-management";

export default function CrmUsersPage() {
	return (
		<AppUserManagement
			orgSlug="crm"
			appName="CRM"
			appRoute="/crm/dashboard/overview"
		/>
	);
}
