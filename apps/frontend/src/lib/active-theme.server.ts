import { cookies } from "next/headers";
import {
	ACTIVE_THEME_COOKIE_NAME,
	resolveActiveTheme,
} from "@/lib/active-theme";

/**
 * Reads the persisted active theme from the App Router cookie store for SSR.
 */
export async function getActiveThemeValue() {
	const cookieStore = await cookies();
	return resolveActiveTheme(cookieStore.get(ACTIVE_THEME_COOKIE_NAME)?.value);
}
