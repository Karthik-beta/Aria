import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAssetWriteAccess } from "./use-asset-write-access";

const authState = {
	role: null as string | null,
	isOrgAdmin: false,
	isOrgOwner: false,
};

vi.mock("@/hooks/use-auth", () => ({
	useAuth: () => authState,
}));

describe("useAssetWriteAccess", () => {
	beforeEach(() => {
		authState.role = null;
		authState.isOrgAdmin = false;
		authState.isOrgOwner = false;
	});

	it.each([
		["owner", { isOrgOwner: true }],
		["admin", { isOrgAdmin: true }],
		["super admin", { role: "super_admin" }],
	])("allows %s write affordances", (_label, state) => {
		Object.assign(authState, state);
		const { result } = renderHook(() => useAssetWriteAccess());
		expect(result.current).toBe(true);
	});

	it("hides write affordances for a regular member", () => {
		authState.role = "user";
		const { result } = renderHook(() => useAssetWriteAccess());
		expect(result.current).toBe(false);
	});
});
