import { describe, expect, it } from "vitest";
import { formatDate } from "./format";

describe("formatDate", () => {
	it("formats a Date object with default options", () => {
		const result = formatDate(new Date("2026-03-15"));
		expect(result).toMatch(/March/);
		expect(result).toMatch(/15/);
		expect(result).toMatch(/2026/);
	});

	it("formats a string date", () => {
		const result = formatDate("2026-06-01");
		expect(result).toContain("2026");
	});

	it("formats a timestamp number", () => {
		const ts = new Date("2026-01-15").getTime();
		const result = formatDate(ts);
		expect(result).toContain("2026");
	});

	it("returns empty string for undefined", () => {
		expect(formatDate(undefined)).toBe("");
	});

	it("returns empty string for invalid date string", () => {
		expect(formatDate("not-a-date")).toBe("");
	});

	it("respects custom Intl options", () => {
		const result = formatDate(new Date("2026-03-15"), {
			month: "short",
			day: "2-digit",
		});
		expect(result).toMatch(/Mar/);
	});
});
