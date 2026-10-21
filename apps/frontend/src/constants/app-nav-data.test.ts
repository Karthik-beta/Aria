import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAppMetadata, getAppNavItems } from "./app-nav-data";

describe("getAppNavItems", () => {
	it("returns admin nav items for 'admin'", () => {
		const items = getAppNavItems("admin");
		expect(items.length).toBeGreaterThan(0);
		expect(items[0]?.title).toBe("Administration");
		expect(items[0]?.items?.[0]?.url).toBe("/admin/dashboard/overview");
	});

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

	it("lists Finance Book in the Assets group after Asset Category", () => {
		const group = getAppNavItems("asset").find((i) => i.title === "Assets");
		const titles = group?.items?.map((i) => i.title) ?? [];
		expect(titles).toContain("Finance Book");
		expect(titles.indexOf("Finance Book")).toBe(
			titles.indexOf("Asset Category") + 1,
		);
		expect(
			group?.items?.find((i) => i.title === "Finance Book")?.url,
		).toBe("/asset/asset-sub-module/finance-book");
	});

	it("every asset nav url resolves to an existing page route", () => {
		const root = path.resolve(__dirname, "../app/asset/(protected)");
		const hasPage = (segments: string[], dir: string): boolean => {
			if (segments.length === 0) return fs.existsSync(path.join(dir, "page.tsx"));
			const [head, ...rest] = segments;
			if (!head || !fs.existsSync(dir)) return false;
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			return entries.some((entry) => {
				if (!entry.isDirectory()) return false;
				const matches =
					entry.name === head ||
					/^\[.+\]$/.test(entry.name) ||
					/^\(.+\)$/.test(entry.name);
				if (!matches) return false;
				// Route groups do not consume a URL segment.
				return /^\(.+\)$/.test(entry.name)
					? hasPage(segments, path.join(dir, entry.name))
					: hasPage(rest, path.join(dir, entry.name));
			});
		};
		const urls = getAppNavItems("asset").flatMap((item) => [
			item.url,
			...(item.items?.map((sub) => sub.url) ?? []),
		]);
		for (const url of urls.filter((u) => u && u !== "#")) {
			const segments = url.split("/").filter(Boolean).slice(1);
			expect(hasPage(segments, root), `missing page for ${url}`).toBe(true);
		}
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
		const appKeys = ["admin", "inventory", "asset", "crm", "hrms"] as const;
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
						const prefixPattern =
							key === "admin" ? /^\/admin(?:\/|$)/ : new RegExp(`^/${key}/`);
						expect(sub.url).toMatch(prefixPattern);
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

	it("admin nav data includes all expected navigation items", () => {
		const items = getAppNavItems("admin");
		const subItemTitles = items.flatMap(
			(i) => i.items?.map((sub) => sub.title) ?? [],
		);
		expect(subItemTitles).toContain("Dashboard");
		expect(subItemTitles).toContain("Users");
		expect(subItemTitles).toContain("Organizations");
		expect(subItemTitles).toContain("Organization Members");
		expect(subItemTitles).toContain("Company");
		expect(subItemTitles).toContain("Finance Books");
	});
});

describe("getAppMetadata", () => {
	it("returns metadata for admin", () => {
		const meta = getAppMetadata("admin");
		expect(meta.label).toBe("Admin Console");
	});

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
