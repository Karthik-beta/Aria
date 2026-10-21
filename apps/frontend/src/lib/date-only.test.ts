import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatDateOnly } from "./date-only";

const ZONES = [
	"Asia/Kolkata",
	"Pacific/Auckland",
	"UTC",
	"America/Los_Angeles",
	"Pacific/Kiritimati",
] as const;

describe.each(ZONES)("formatDateOnly in %s", (zone) => {
	const originalTz = process.env.TZ;

	beforeEach(() => {
		process.env.TZ = zone;
	});

	afterEach(() => {
		if (originalTz === undefined) {
			delete process.env.TZ;
		} else {
			process.env.TZ = originalTz;
		}
	});

	it("formats Date instances at UTC midnight and end of day", () => {
		expect(formatDateOnly(new Date("2026-01-01T00:00:00.000Z"))).toBe(
			"01 Jan 2026",
		);
		expect(formatDateOnly(new Date("2026-04-30T23:59:59.999Z"))).toBe(
			"30 Apr 2026",
		);
	});

	it("formats date-only and ISO strings", () => {
		expect(formatDateOnly("2026-04-30")).toBe("30 Apr 2026");
		expect(formatDateOnly("2026-12-31T00:00:00.000Z")).toBe("31 Dec 2026");
		expect(formatDateOnly("2028-02-29T23:59:59.999Z")).toBe("29 Feb 2028");
	});

	it("returns a dash for empty or invalid values", () => {
		expect(formatDateOnly(null)).toBe("-");
		expect(formatDateOnly(undefined)).toBe("-");
		expect(formatDateOnly("")).toBe("-");
		expect(formatDateOnly("not-a-date")).toBe("-");
		expect(formatDateOnly(new Date("invalid"))).toBe("-");
	});
});
