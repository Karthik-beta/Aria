import { redirect } from "next/navigation";
import { requireProtectedAuthState } from "@/lib/auth/server";

export default async function HomePage() {
	const { session } = await requireProtectedAuthState({
		callbackUrl: "/",
	});
	const role = session.user.role;
	const isSuperAdmin = role === "super_admin";
	const targetKey = isSuperAdmin ? "inventory" : "inventory";

	redirect(`/${targetKey}`);
}
