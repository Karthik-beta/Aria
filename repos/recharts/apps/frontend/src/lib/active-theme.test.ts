import { describe, expect, it } from "vitest";
import { DEFAULT_ACTIVE_THEME, resolveActiveTheme } from "./active-theme";

describe("resolveActiveTheme", () => {
	it("falls back to the default theme for missing or unsupported values", () => {
		expect(resolveActiveTheme()).toBe(DEFAULT_ACTIVE_THEME);
		expect(resolveActiveTheme(null)).toBe(DEFAULT_ACTIVE_THEME);
		expect(resolveActiveTheme("not-a-theme")).toBe(DEFAULT_ACTIVE_THEME);
	});

	it("preserves every supported persisted theme value", () => {
		const supportedThemes = [
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
		];

		for (const theme of supportedThemes) {
			expect(resolveActiveTheme(theme)).toBe(theme);
		}
	});
});
