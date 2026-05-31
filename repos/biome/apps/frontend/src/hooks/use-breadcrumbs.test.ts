import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";

// Mock usePathname is set globally in test/setup.ts but we override per test
const mockPathname = vi.fn(() => "/");
vi.mock("next/navigation", async () => {
	const actual =
		await vi.importActual<typeof import("next/navigation")>("next/navigation");
	return {
		...actual,
		usePathname: () => mockPathname(),
		useRouter: () => ({
			push: vi.fn(),
			replace: vi.fn(),
			prefetch: vi.fn(),
			back: vi.fn(),
		}),
		useSearchParams: () => new URLSearchParams(),
	};
});

describe("useBreadcrumbs", () => {
	it("returns predefined mapping for /dashboard", () => {
		mockPathname.mockReturnValue("/dashboard");
		const { result } = renderHook(() => useBreadcrumbs());

		expect(result.current).toEqual([
			{ title: "Dashboard", link: "/dashboard" },
		]);
	});

	it("returns predefined mapping for /dashboard/employee", () => {
		mockPathname.mockReturnValue("/dashboard/employee");
		const { result } = renderHook(() => useBreadcrumbs());

		expect(result.current).toEqual([
			{ title: "Dashboard", link: "/dashboard" },
			{ title: "Employee", link: "/dashboard/employee" },
		]);
	});

	it("generates breadcrumbs from path segments for unmapped routes", () => {
		mockPathname.mockReturnValue("/inventory/items/new");
		const { result } = renderHook(() => useBreadcrumbs());

		expect(result.current).toEqual([
			{ title: "Inventory", link: "/inventory" },
			{ title: "Items", link: "/inventory/items" },
			{ title: "New", link: "/inventory/items/new" },
		]);
	});

	it("capitalizes the first letter of each segment", () => {
		mockPathname.mockReturnValue("/stock-reports/stock-ledger");
		const { result } = renderHook(() => useBreadcrumbs());

		expect(result.current[0].title).toBe("Stock-reports");
		expect(result.current[1].title).toBe("Stock-ledger");
	});

	it("returns empty array for root path", () => {
		mockPathname.mockReturnValue("/");
		const { result } = renderHook(() => useBreadcrumbs());

		expect(result.current).toEqual([]);
	});
});
