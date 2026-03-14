export { ACTIVE_THEME_COOKIE_NAME } from "@/lib/cookies";
export const DEFAULT_ACTIVE_THEME = "default";

const VALID_ACTIVE_THEMES = new Set([
	DEFAULT_ACTIVE_THEME,
	"blue",
	"green",
	"amber",
	"mono",
	"default-scaled",
	"blue-scaled",
	"green-scaled",
	"amber-scaled",
	"mono-scaled",
]);

/**
 * Normalizes the persisted theme cookie into a safe theme value for SSR and hydration.
 */
export function resolveActiveTheme(theme?: string | null) {
	if (!theme) {
		return DEFAULT_ACTIVE_THEME;
	}

	return VALID_ACTIVE_THEMES.has(theme) ? theme : DEFAULT_ACTIVE_THEME;
}
