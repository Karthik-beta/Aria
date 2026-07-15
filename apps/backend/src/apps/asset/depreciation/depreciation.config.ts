import type { ConnectionOptions, JobsOptions } from "bullmq";
import {
	DEPRECIATION_COMPLETED_RETENTION_COUNT,
	DEPRECIATION_COMPLETED_RETENTION_SECONDS,
	DEPRECIATION_DEFAULT_BARRIER_TIMEOUT_MS,
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

/** Parses REDIS_URL into the BullMQ/ioredis connection shape. */
export function depreciationRedisConnection(): ConnectionOptions {
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

	return {
		host: url.hostname,
		port: url.port ? Number.parseInt(url.port, 10) : 6379,
		username: url.username ? decodeURIComponent(url.username) : undefined,
		password: url.password ? decodeURIComponent(url.password) : undefined,
		db: database,
		tls: url.protocol === "rediss:" ? {} : undefined,
		maxRetriesPerRequest: null,
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
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);
	const value = Object.fromEntries(
		parts.map((part) => [part.type, part.value]),
	);
	return `${value.year}-${value.month}-${value.day}`;
}

export function normalizeDateOnly(value: Date | string): string {
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return value;
	}
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime()))
		throw new Error("Invalid depreciation date.");
	return date.toISOString().slice(0, 10);
}

export function dateOnlyUtc(value: Date | string): Date {
	return new Date(`${normalizeDateOnly(value)}T00:00:00.000Z`);
}
