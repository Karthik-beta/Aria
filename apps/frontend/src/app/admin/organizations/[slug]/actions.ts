"use server";

import { logger } from "@aria/utils";
import { cookies } from "next/headers";

function getBackendUrl() {
	const baseUrl =
		process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "";
	return baseUrl.replace(/\/$/, "");
}

export async function addOrgMember(
	organizationId: string,
	userId: string,
	role: "owner" | "admin" | "member",
) {
	try {
		const cookieStore = await cookies();
		const cookieHeader = cookieStore.toString();

		const response = await fetch(
			`${getBackendUrl()}/api/auth/organization/add-member`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					cookie: cookieHeader,
				},
				body: JSON.stringify({
					userId,
					role,
					organizationId,
				}),
			},
		);

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Failed to add member: ${response.status} ${text}`);
		}

		return { success: true };
	} catch (error) {
		logger.error("[addOrgMember] Error:", error);
		return { success: false, error: String(error) };
	}
}

export async function removeOrgMember(
	organizationId: string,
	memberIdOrEmail: string,
) {
	try {
		const cookieStore = await cookies();
		const cookieHeader = cookieStore.toString();

		const response = await fetch(
			`${getBackendUrl()}/api/auth/organization/remove-member`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					cookie: cookieHeader,
				},
				body: JSON.stringify({
					memberIdOrEmail,
					organizationId,
				}),
			},
		);

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Failed to remove member: ${response.status} ${text}`);
		}

		return { success: true };
	} catch (error) {
		logger.error("[removeOrgMember] Error:", error);
		return { success: false, error: String(error) };
	}
}

export async function updateMemberRole(
	organizationId: string,
	memberId: string,
	role: string | string[],
) {
	try {
		const cookieStore = await cookies();
		const cookieHeader = cookieStore.toString();

		const response = await fetch(
			`${getBackendUrl()}/api/auth/organization/update-member-role`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					cookie: cookieHeader,
				},
				body: JSON.stringify({
					memberId,
					role,
					organizationId,
				}),
			},
		);

		if (!response.ok) {
			const text = await response.text();
			throw new Error(
				`Failed to update member role: ${response.status} ${text}`,
			);
		}

		return { success: true };
	} catch (error) {
		logger.error("[updateMemberRole] Error:", error);
		return { success: false, error: String(error) };
	}
}
