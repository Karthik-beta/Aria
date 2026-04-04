import { describe, expect, it } from "vitest";
import { getAppMetadata, getAppNavItems } from "./app-nav-data";

describe("getAppNavItems", () => {
	it("returns inventory nav items for 'inventory'", () => {
		const items = getAppNavItems("inventory");
		expect(items.length).toBeGreaterThan(0);
		expect(items[0]?.title).toBe("Dashboard");
		expect(items[0]?.url).toMatch(/^\/inventory\/dashboard/);
	});

	it("returns asset nav items for 'asset'", () => {
		const items = getAppNavItems("asset");
		expect(items.length).toBeGreaterThan(0);
		expect(items[0]?.title).toBe("Dashboard");
		expect(items[0]?.url).toMatch(/^\/asset\/dashboard/);
	});

	it("returns crm nav items for 'crm'", () => {
		const items = getAppNavItems("crm");
		expect(items.length).toBeGreaterThan(0);
		expect(items[0]?.title).toBe("Dashboard");
		expect(items[0]?.url).toBe("/crm/dashboard");
	});

	it("returns hrms nav items for 'hrms'", () => {
		const items = getAppNavItems("hrms");
		expect(items.length).toBeGreaterThan(0);
		expect(items[0]?.title).toBe("Dashboard");
		expect(items[0]?.url).toBe("/hrms/dashboard");
	});

	it("handles case-insensitive app names", () => {
		const lower = getAppNavItems("inventory");
		const upper = getAppNavItems("INVENTORY");
		const mixed = getAppNavItems("Inventory");
		expect(lower).toEqual(upper);
		expect(lower).toEqual(mixed);
	});

	it("falls back to inventory nav items for unknown app name", () => {
		const unknown = getAppNavItems("nonexistent");
		const inventory = getAppNavItems("inventory");
		expect(unknown).toEqual(inventory);
	});

	it("each app has distinct routes under its prefix", () => {
		const appKeys = ["inventory", "asset", "crm", "hrms"] as const;
		for (const key of appKeys) {
			const items = getAppNavItems(key);
			// All non-hash URLs should start with the app prefix
			for (const item of items) {
				if (item.url && item.url !== "#" && item.url !== "/") {
					expect(item.url).toMatch(new RegExp(`^/${key}/`));
				}
				// Check sub-items too
				for (const sub of item.items ?? []) {
					if (sub.url && sub.url !== "#" && sub.url !== "/") {
						expect(sub.url).toMatch(new RegExp(`^/${key}/`));
					}
				}
			}
		}
	});

	it("inventory nav data includes all expected top-level sections", () => {
		const items = getAppNavItems("inventory");
		const titles = items.map((i) => i.title);
		expect(titles).toContain("Dashboard");
		expect(titles).toContain("Items Catalogue");
		expect(titles).toContain("Stock Transactions");
		expect(titles).toContain("Inventory Settings");
	});
});

describe("getAppMetadata", () => {
	it("returns metadata for inventory", () => {
		const meta = getAppMetadata("inventory");
		expect(meta.label).toBe("Inventory Management");
		expect(meta.description).toBeTruthy();
	});

	it("returns metadata for asset", () => {
		const meta = getAppMetadata("asset");
		expect(meta.label).toBe("Asset Management");
	});

	it("returns metadata for crm", () => {
		const meta = getAppMetadata("crm");
		expect(meta.label).toBe("Customer Relations");
	});

	it("returns metadata for hrms", () => {
		const meta = getAppMetadata("hrms");
		expect(meta.label).toBe("Human Resources");
	});

	it("falls back to inventory metadata for unknown app", () => {
		const meta = getAppMetadata("unknown");
		expect(meta.label).toBe("Inventory Management");
	});

	it("handles case-insensitive app names", () => {
		const lower = getAppMetadata("crm");
		const upper = getAppMetadata("CRM");
		expect(lower).toEqual(upper);
	});
});
