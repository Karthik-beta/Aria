/**
 * Demo Data — Shared Helpers
 *
 * Deterministic utilities used across all seeders so the dataset is
 * reproducible between runs when the same config is supplied.
 */

import type { DemoConfig } from "./config.js";
import { SCALE_MULTIPLIERS } from "./config.js";

/**
 * Return the scaled count of records for a given base number.
 */
export function scaled(base: number, config: DemoConfig): number {
	return Math.round(base * SCALE_MULTIPLIERS[config.scale]);
}

/**
 * Generate a random date between two bounds.
 */
export function randomDate(from: Date, to: Date): Date {
	const start = from.getTime();
	const end = to.getTime();
	return new Date(start + Math.random() * (end - start));
}

/**
 * Pick a random element from an array.
 */
export function pick<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick N unique random elements from an array.
 */
export function pickN<T>(arr: readonly T[], n: number): T[] {
	const copy = [...arr];
	const result: T[] = [];
	const count = Math.min(n, copy.length);
	for (let i = 0; i < count; i++) {
		const idx = Math.floor(Math.random() * copy.length);
		result.push(copy.splice(idx, 1)[0]);
	}
	return result;
}

/**
 * Generate a random float between min and max, rounded to `decimals`.
 */
export function randomFloat(min: number, max: number, decimals = 2): number {
	const val = min + Math.random() * (max - min);
	const factor = 10 ** decimals;
	return Math.round(val * factor) / factor;
}

/**
 * Generate a random integer between min and max (inclusive).
 */
export function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Zero-pad a number to a given width.
 */
export function zeroPad(n: number, width: number): string {
	return String(n).padStart(width, "0");
}

/**
 * Generate a series string like "MAT-MR-2026-0001" using a counter.
 */
export function makeSeries(
	prefix: string,
	year: number,
	counter: number,
): string {
	return `${prefix}-${year}-${zeroPad(counter, 4)}`;
}

/**
 * Generate a posting date in sequence, spreading count items across
 * the configured date range. Returns dates in chronological order.
 */
export function spreadDates(count: number, config: DemoConfig): Date[] {
	const { from, to } = config.dateRange;
	const start = from.getTime();
	const span = to.getTime() - start;
	const dates: Date[] = [];

	for (let i = 0; i < count; i++) {
		// Spread evenly with small jitter
		const base = start + (span * i) / Math.max(count - 1, 1);
		const jitter = (Math.random() - 0.5) * (span / count) * 0.3;
		dates.push(
			new Date(Math.min(Math.max(base + jitter, start), to.getTime())),
		);
	}

	return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Chunk an array into batches of the given size.
 * Useful for batched Prisma inserts.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}
