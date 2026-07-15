import { afterEach, describe, expect, it } from "bun:test";
import {
	businessDate,
	depreciationBarrierTimeoutMs,
	depreciationJobOptions,
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
	});
});
