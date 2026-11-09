"use client";

import { AppUserManagement } from "@/components/auth/app-user-management";

export default function HrmsUsersPage() {
	return (
		<AppUserManagement
			orgSlug="hrms"
			appName="HRMS"
			appRoute="/hrms/dashboard/overview"
		/>
	);
}
