import type { DateOnly } from "@aria/types";
import {
	addDateOnly as canonicalAddDateOnly,
	addDateOnlyUtc as canonicalAddDateOnlyUtc,
	addMonthsDateOnly as canonicalAddMonthsDateOnly,
	businessDate as canonicalBusinessDate,
	dateOnlyFromInstant as canonicalDateOnlyFromInstant,
	dateOnlyFromPersistedDateTime as canonicalDateOnlyFromPersistedDateTime,
	dateOnlyUtc as canonicalDateOnlyUtc,
	dateOnlyUtcRange as canonicalDateOnlyUtcRange,
	differenceInDateOnlyDays as canonicalDifferenceInDateOnlyDays,
	endOfMonthDateOnly as canonicalEndOfMonthDateOnly,
	normalizeDateOnly as canonicalNormalizeDateOnly,
} from "@aria/types";
import type { JobsOptions, RedisOptions } from "bullmq";
import {
	DEPRECIATION_COMPLETED_RETENTION_COUNT,
	DEPRECIATION_COMPLETED_RETENTION_SECONDS,
	DEPRECIATION_DEFAULT_BARRIER_TIMEOUT_MS,
	DEPRECIATION_DEFAULT_QUEUE_OPERATION_TIMEOUT_MS,
	DEPRECIATION_DEFAULT_RECONCILIATION_INTERVAL_MS,
	DEPRECIATION_DEFAULT_WORKER_CONCURRENCY,
	DEPRECIATION_JOB_ATTEMPTS,
	DEPRECIATION_RETRY_DELAY_MS,
} from "./depreciation.constants";

function requiredEnvironmentValue(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required for depreciation processing.`);
	}
	return value;
}

function positiveInteger(name: string, fallback: number): number {
	const value = process.env[name]?.trim();
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isSafeInteger(parsed) || parsed < 1) {
		throw new Error(`${name} must be a positive integer.`);
	}
	return parsed;
}

function redisConnectionBase(): RedisOptions {
	const raw = requiredEnvironmentValue("REDIS_URL");
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new Error("REDIS_URL must be a valid redis:// or rediss:// URL.");
	}
	if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
		throw new Error("REDIS_URL must use the redis:// or rediss:// protocol.");
	}

	const databasePath = url.pathname.replace(/^\//, "");
	const database = databasePath ? Number.parseInt(databasePath, 10) : 0;
	if (!Number.isSafeInteger(database) || database < 0) {
		throw new Error("REDIS_URL database must be a non-negative integer.");
	}

	const urlPassword = url.password
		? decodeURIComponent(url.password)
		: undefined;
	const environmentPassword = process.env.REDIS_PASSWORD?.trim() || undefined;
	if (
		urlPassword &&
		environmentPassword &&
		urlPassword !== environmentPassword
	) {
		throw new Error(
			"REDIS_URL and REDIS_PASSWORD contain different passwords.",
		);
	}

	return {
		host: url.hostname,
		port: url.port ? Number.parseInt(url.port, 10) : 6379,
		username: url.username ? decodeURIComponent(url.username) : undefined,
		password: urlPassword ?? environmentPassword,
		db: database,
		tls: url.protocol === "rediss:" ? {} : undefined,
		connectTimeout: depreciationQueueOperationTimeoutMs(),
	};
}

/** Long-lived BullMQ connection for workers and queue events. */
export function depreciationRedisConnection(): RedisOptions {
	return {
		...redisConnectionBase(),
		maxRetriesPerRequest: null,
	};
}

/** Fail-fast connection used only by HTTP/scheduler queue producers. */
export function depreciationProducerRedisConnection(): RedisOptions {
	return {
		...redisConnectionBase(),
		maxRetriesPerRequest: 1,
		enableOfflineQueue: false,
		commandTimeout: depreciationQueueOperationTimeoutMs(),
		lazyConnect: true,
	};
}

/** Validates and returns the IANA timezone controlling business-day discovery. */
export function depreciationTimeZone(): string {
	const timeZone = requiredEnvironmentValue("APP_TIME_ZONE");
	try {
		new Intl.DateTimeFormat("en", { timeZone }).format();
	} catch {
		throw new Error(`APP_TIME_ZONE is not a valid IANA timezone: ${timeZone}`);
	}
	return timeZone;
}

export function depreciationWorkerConcurrency(): number {
	return positiveInteger(
		"ASSET_DEPRECIATION_QUEUE_CONCURRENCY",
		DEPRECIATION_DEFAULT_WORKER_CONCURRENCY,
	);
}

export function depreciationBarrierTimeoutMs(): number {
	return positiveInteger(
		"ASSET_DEPRECIATION_BARRIER_TIMEOUT_MS",
		DEPRECIATION_DEFAULT_BARRIER_TIMEOUT_MS,
	);
}

export function depreciationQueueOperationTimeoutMs(): number {
	return positiveInteger(
		"ASSET_DEPRECIATION_QUEUE_OPERATION_TIMEOUT_MS",
		DEPRECIATION_DEFAULT_QUEUE_OPERATION_TIMEOUT_MS,
	);
}

export function depreciationReconciliationIntervalMs(): number {
	return positiveInteger(
		"ASSET_DEPRECIATION_RECONCILIATION_INTERVAL_MS",
		DEPRECIATION_DEFAULT_RECONCILIATION_INTERVAL_MS,
	);
}

export function depreciationJobOptions(): JobsOptions {
	return {
		attempts: DEPRECIATION_JOB_ATTEMPTS,
		backoff: { type: "exponential", delay: DEPRECIATION_RETRY_DELAY_MS },
		removeOnComplete: {
			age: DEPRECIATION_COMPLETED_RETENTION_SECONDS,
			count: DEPRECIATION_COMPLETED_RETENTION_COUNT,
		},
		removeOnFail: false,
	};
}

/** Returns the current date in the configured business timezone as YYYY-MM-DD. */
export function businessDate(timeZone: string, now = new Date()): string {
	return canonicalBusinessDate(timeZone, now);
}

/**
 * Converts a true instant to the configured business calendar date.
 *
 * This adapter is for timestamps whose meaning is an instant. Persisted
 * DateTime-backed date-only columns must use `dateOnlyFromPersistedDateTime`
 * before reaching date-only logic.
 */
export const dateOnlyFromInstant = canonicalDateOnlyFromInstant;

/** Converts a persisted DateTime-backed date-only column to its calendar date. */
export const dateOnlyFromPersistedDateTime =
	canonicalDateOnlyFromPersistedDateTime;

/** Canonicalizes the narrow date-only boundary before business logic uses it. */
export const normalizeDateOnly = canonicalNormalizeDateOnly;

/** Converts a date-only value to the UTC-midnight representation used by Prisma. */
export const dateOnlyUtc = canonicalDateOnlyUtc;

/** Builds a half-open UTC query window for inclusive date-only report bounds. */
export const dateOnlyUtcRange = canonicalDateOnlyUtcRange;

/** Adds calendar days using UTC components after date-only normalization. */
export const addDateOnly = canonicalAddDateOnly;

/** Adds calendar days and returns a UTC-midnight date. */
export const addDateOnlyUtc = canonicalAddDateOnlyUtc;

/** Adds calendar months with end-of-month clamping. */
export const addMonthsDateOnly = canonicalAddMonthsDateOnly;

/** Returns the last UTC-midnight date in a calendar month. */
export const endOfMonthDateOnly = canonicalEndOfMonthDateOnly;

/** Counts whole calendar days between date-only boundaries. */
export const differenceInDateOnlyDays = canonicalDifferenceInDateOnlyDays;

/**
 * Returns the series year for a canonical business date or a true instant.
 *
 * A `Date` is interpreted in the validated `APP_TIME_ZONE`; this keeps series
 * allocation correct for instants around a year boundary. Date-only database
 * fields must first be adapted with `dateOnlyFromPersistedDateTime`.
 */
export function businessYearForSeries(
	value: DateOnly | Date,
	timeZone = depreciationTimeZone(),
): string {
	const canonicalDate =
		typeof value === "string"
			? normalizeDateOnly(value)
			: canonicalDateOnlyFromInstant(timeZone, value);
	return canonicalDate.slice(0, 4);
}
