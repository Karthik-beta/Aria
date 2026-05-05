import { redirect } from "next/navigation";
import { requireProtectedAuthState } from "@/lib/auth/server";

export async function requireAppAccess(appKey: string) {
	await requireProtectedAuthState();
	redirect(`/${appKey}/access-denied`);
}
