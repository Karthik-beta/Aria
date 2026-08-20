import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	assetBusinessTimeZone,
	dateInputValue,
	formatAssetDate,
	normalizeAssetDateValue,
	todayDateInputValue,
} from "./asset-date-only";

const ORIGINAL_APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE;

describe("Asset date-only helpers", () => {
	beforeEach(() => {
		process.env.NEXT_PUBLIC_APP_TIME_ZONE = "UTC";
	});

	afterEach(() => {
		if (ORIGINAL_APP_TIME_ZONE === undefined) {
			delete process.env.NEXT_PUBLIC_APP_TIME_ZONE;
		} else {
			process.env.NEXT_PUBLIC_APP_TIME_ZONE = ORIGINAL_APP_TIME_ZONE;
		}
	});

	it("keeps date input strings as calendar dates", () => {
		expect(dateInputValue("2026-08-10")).toBe("2026-08-10");
		expect(normalizeAssetDateValue("2026-08-10T23:30:00.000Z")).toBe(
			"2026-08-10",
		);
	});

	it("hydrates legacy UTC-midnight responses without local drift", () => {
		expect(dateInputValue(new Date("2026-08-10T00:00:00.000Z"))).toBe(
			"2026-08-10",
		);
		expect(formatAssetDate("2026-08-10T00:00:00.000Z", "en-CA")).toBe(
			"2026-08-10",
		);
	});

	it.each([
		"2026-08-10",
		"2026-08-31",
	])("keeps canonical form date %s under the process timezone", (date) => {
		expect(dateInputValue(new Date(`${date}T23:45:00.000Z`))).toBe(date);
		expect(dateInputValue(date)).toBe(date);
	});

	it("rejects impossible calendar dates", () => {
		expect(() => dateInputValue("2026-02-30")).toThrow(
			"Invalid date-only value",
		);
	});

	it("uses the injected instant for deterministic defaults", () => {
		expect(todayDateInputValue(new Date("2026-12-31T20:00:00.000Z"))).toBe(
			"2026-12-31",
		);
	});

	it.each([
		["UTC", "2026-12-31"],
		["Asia/Kolkata", "2027-01-01"],
		["America/New_York", "2026-12-31"],
	])("matches the authoritative timezone matrix for %s", (timeZone, expected) => {
		process.env.NEXT_PUBLIC_APP_TIME_ZONE = timeZone;
		expect(assetBusinessTimeZone()).toBe(timeZone);
		expect(todayDateInputValue(new Date("2026-12-31T20:00:00.000Z"))).toBe(
			expected,
		);
	});

	it("fails closed when the build-time timezone contract is missing or invalid", () => {
		delete process.env.NEXT_PUBLIC_APP_TIME_ZONE;
		expect(() => assetBusinessTimeZone()).toThrow("APP_TIME_ZONE is required");

		process.env.NEXT_PUBLIC_APP_TIME_ZONE = "Not/A_Timezone";
		expect(() => assetBusinessTimeZone()).toThrow("valid IANA timezone");
	});
});
