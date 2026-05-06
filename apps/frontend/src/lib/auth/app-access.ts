import { redirect } from "next/navigation";
import { authorizationCanAccessApp } from "@/lib/auth/authorization";
import { requireProtectedAuthState } from "@/lib/auth/server";

export async function requireAppAccess(appKey: string) {
	const { authorization } = await requireProtectedAuthState();
	if (!authorizationCanAccessApp(authorization, appKey)) {
		redirect(`/${appKey}/access-denied`);
	}
}
