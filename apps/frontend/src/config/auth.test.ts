import { describe, expect, it } from "vitest";
import {
	buildSignInUrl,
	getAuthRedirectUrl,
	normalizeCallbackUrl,
} from "./auth";

describe("auth config helpers", () => {
	it("keeps valid in-app callback URLs", () => {
		expect(
			normalizeCallbackUrl("/inventory/dashboard/overview?tab=stats"),
		).toBe("/inventory/dashboard/overview?tab=stats");
	});

	it("rejects external and malformed callback URLs", () => {
		expect(normalizeCallbackUrl("https://example.com/login")).toBeNull();
		expect(normalizeCallbackUrl("//example.com/login")).toBeNull();
		expect(normalizeCallbackUrl("/\\example.com/login")).toBeNull();
		expect(normalizeCallbackUrl("  ")).toBeNull();
	});

	it("builds sign-in URLs with normalized callbacks only", () => {
		expect(buildSignInUrl("/crm/dashboard/overview")).toBe(
			"/auth/sign-in?callbackUrl=%2Fcrm%2Fdashboard%2Foverview",
		);
		expect(buildSignInUrl("https://example.com/login")).toBe("/auth/sign-in");
	});

	it("falls back to the default app route when no callback is available", () => {
		expect(getAuthRedirectUrl(null)).toBe("/inventory/dashboard/overview");
	});
});
