import { redirect } from "next/navigation";
import {
	authorizationCanAccessApp,
	authorizationHasRole,
} from "@/lib/auth/authorization";
import { requireProtectedAuthState } from "@/lib/auth/server";

const APP_ROUTE_MAP: Record<string, string> = {
	inventory: "/inventory",
	asset: "/asset",
	crm: "/crm",
	hrms: "/hrms",
};

const APP_PRIORITY: Array<keyof typeof APP_ROUTE_MAP> = [
	"inventory",
	"asset",
	"crm",
	"hrms",
];

export default async function HomePage() {
	const { authorization } = await requireProtectedAuthState({
		callbackUrl: "/",
	});
	const isSuperAdmin = authorizationHasRole(authorization, "super_admin");
	const accessibleKeys = Object.keys(authorization.apps ?? {});
	const orderedKeys = APP_PRIORITY.filter((_key) =>
		authorizationCanAccessApp(),
	);
	const firstAccessible = accessibleKeys.find((_key) =>
		authorizationCanAccessApp(),
	);
	const fallbackKey =
		orderedKeys[0] ||
		firstAccessible ||
		(isSuperAdmin ? "inventory" : undefined);
	const targetKey = fallbackKey ?? "inventory";

	redirect(APP_ROUTE_MAP[targetKey] ?? "/inventory");
}
