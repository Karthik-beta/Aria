import { afterEach, describe, expect, it } from "bun:test";
import {
	businessDate,
	businessYearForSeries,
	dateOnlyFromPersistedDateTime,
	dateOnlyUtc,
	dateOnlyUtcRange,
	depreciationBarrierTimeoutMs,
	depreciationJobOptions,
	depreciationProducerRedisConnection,
	depreciationQueueOperationTimeoutMs,
	depreciationReconciliationIntervalMs,
	depreciationRedisConnection,
	depreciationTimeZone,
} from "./depreciation.config";

const originalEnvironment = { ...process.env };

afterEach(() => {
	process.env = { ...originalEnvironment };
});

describe("depreciation configuration", () => {
	it("parses authenticated TLS Redis URLs", () => {
		process.env.REDIS_URL = "rediss://queue-user:p%40ss@redis.local:6380/4";

		expect(depreciationRedisConnection()).toMatchObject({
			host: "redis.local",
			port: 6380,
			username: "queue-user",
			password: "p@ss",
			db: 4,
			tls: {},
			maxRetriesPerRequest: null,
		});
	});

	it("uses REDIS_PASSWORD when the URL has no credentials", () => {
		process.env.REDIS_URL = "redis://redis.local:6379/2";
		process.env.REDIS_PASSWORD = "secret";

		expect(depreciationRedisConnection()).toMatchObject({
			password: "secret",
			maxRetriesPerRequest: null,
		});
		expect(depreciationProducerRedisConnection()).toMatchObject({
			password: "secret",
			maxRetriesPerRequest: 1,
			enableOfflineQueue: false,
			commandTimeout: 5_000,
		});
	});

	it("rejects conflicting Redis password sources", () => {
		process.env.REDIS_URL = "redis://:url-secret@redis.local:6379";
		process.env.REDIS_PASSWORD = "environment-secret";

		expect(() => depreciationRedisConnection()).toThrow(
			"contain different passwords",
		);
	});

	it("requires a valid business timezone", () => {
		delete process.env.APP_TIME_ZONE;
		expect(() => depreciationTimeZone()).toThrow("APP_TIME_ZONE is required");

		process.env.APP_TIME_ZONE = "Not/A_Timezone";
		expect(() => depreciationTimeZone()).toThrow("valid IANA timezone");
	});

	it("derives the business day independently of UTC midnight", () => {
		expect(
			businessDate("America/New_York", new Date("2026-07-10T02:00:00.000Z")),
		).toBe("2026-07-09");
	});

	it("uses APP_TIME_ZONE semantics for series years at an instant year boundary", () => {
		const instant = new Date("2026-12-31T20:00:00.000Z");
		process.env.APP_TIME_ZONE = "UTC";
		expect(businessYearForSeries(instant)).toBe("2026");
		process.env.APP_TIME_ZONE = "Asia/Kolkata";
		expect(businessYearForSeries(instant)).toBe("2027");
		process.env.APP_TIME_ZONE = "America/New_York";
		expect(businessYearForSeries(instant)).toBe("2026");
	});

	it("requires persisted date-only rows to be adapted before series allocation", () => {
		process.env.APP_TIME_ZONE = "Asia/Kolkata";
		const persistedDate = dateOnlyFromPersistedDateTime(
			new Date("2026-12-31T23:59:59.999Z"),
		);
		expect(businessYearForSeries(persistedDate)).toBe("2026");
	});

	it("covers ordinary, month-end, year-boundary, and invalid date-only values", () => {
		expect(businessDate("UTC", new Date("2026-08-10T18:45:00.000Z"))).toBe(
			"2026-08-10",
		);
		expect(
			businessDate("Asia/Kolkata", new Date("2026-08-10T18:45:00.000Z")),
		).toBe("2026-08-11");
		expect(
			businessDate("America/New_York", new Date("2026-08-10T18:45:00.000Z")),
		).toBe("2026-08-10");
		expect(
			businessDate("Asia/Kolkata", new Date("2026-12-31T20:00:00.000Z")),
		).toBe("2027-01-01");
		expect(dateOnlyUtc("2026-08-10").toISOString()).toBe(
			"2026-08-10T00:00:00.000Z",
		);
		expect(dateOnlyUtc("2026-08-31").toISOString()).toBe(
			"2026-08-31T00:00:00.000Z",
		);
		const range = dateOnlyUtcRange("2026-08-31", "2026-08-31");
		expect(range.startInclusive.toISOString()).toBe("2026-08-31T00:00:00.000Z");
		expect(range.endExclusive.toISOString()).toBe("2026-09-01T00:00:00.000Z");

		for (const value of [
			"2026-02-30",
			"2026-04-31",
			"2026-13-01",
			"2026-00-10",
			"2026-08-10T23:30:00.000Z",
			"08/10/2026",
		]) {
			expect(() => dateOnlyUtc(value)).toThrow("Invalid date-only value");
		}
	});

	it("uses durable retry and bounded completion defaults", () => {
		const options = depreciationJobOptions();
		expect(options.attempts).toBe(5);
		expect(options.backoff).toEqual({ type: "exponential", delay: 30_000 });
		expect(options.removeOnFail).toBe(false);
		expect(options.removeOnComplete).toEqual({
			age: 604_800,
			count: 10_000,
		});
		expect(depreciationBarrierTimeoutMs()).toBe(120_000);
		expect(depreciationQueueOperationTimeoutMs()).toBe(5_000);
		expect(depreciationReconciliationIntervalMs()).toBe(900_000);
	});
});
