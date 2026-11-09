"use client";

import {
	ThemeProvider as NextThemesProvider,
	type ThemeProviderProps,
} from "next-themes";

// next-themes renders an inline <script> to prevent theme flicker (FOUC).
// React 19 warns/error about script tags inside components.
// The warning is a false positive — the script runs correctly during SSR.
// See: https://github.com/shadcn-ui/ui/issues/10104
if (typeof window !== "undefined") {
	// biome-ignore lint/suspicious/noConsole: Required to suppress React 19 false positive script warning
	const originalConsoleError = console.error;
	console.error = (...args: unknown[]) => {
		if (
			typeof args[0] === "string" &&
			args[0].includes("Encountered a script tag")
		) {
			return;
		}
		originalConsoleError(...args);
	};
}

export default function ThemeProvider({
	children,
	...props
}: ThemeProviderProps) {
	return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
