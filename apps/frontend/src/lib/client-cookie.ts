"use client";

import { logger } from "@aria/utils";

type CookieStoreOptions = {
	name: string;
	value: string;
	path?: string;
	expires?: number;
	sameSite?: "strict" | "lax" | "none";
	secure?: boolean;
};

type CookieStoreCapableWindow = Window & {
	cookieStore?: {
		set: (options: CookieStoreOptions) => Promise<void>;
	};
};

function setDocumentCookie({
	name,
	value,
	path = "/",
	expires,
	sameSite,
	secure,
}: CookieStoreOptions) {
	if (typeof document === "undefined") return;

	const segments = [
		`${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
		`Path=${path}`,
	];

	if (typeof expires === "number") {
		segments.push(`Expires=${new Date(expires).toUTCString()}`);
	}

	if (sameSite) {
		segments.push(`SameSite=${sameSite}`);
	}

	if (secure) {
		segments.push("Secure");
	}

	// biome-ignore lint/suspicious/noDocumentCookie: This preserves cookie writes in browsers that do not support the Cookie Store API.
	document.cookie = segments.join("; ");
}

/**
 * Persists a client-side cookie with Cookie Store API when available and
 * falls back to `document.cookie` for browsers that do not support it.
 */
export function persistClientCookie(options: CookieStoreOptions) {
	if (typeof window === "undefined") return;

	const cookieStore = (window as CookieStoreCapableWindow).cookieStore;
	if (!cookieStore) {
		setDocumentCookie(options);
		return;
	}

	void cookieStore.set(options).catch((error) => {
		logger.error(
			`Failed to persist cookie "${options.name}" with Cookie Store API; falling back to document.cookie.`,
			error,
		);
		setDocumentCookie(options);
	});
}
