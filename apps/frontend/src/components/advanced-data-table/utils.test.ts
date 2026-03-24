/**
 * Utils Tests
 * Tests for table utility functions
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce, throttle } from "./utils";

describe("Table Utilities", () => {
	describe("debounce", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.restoreAllMocks();
			vi.useRealTimers();
		});

		it("should delay function execution", () => {
			const fn = vi.fn();
			const debounced = debounce(fn, 100);

			debounced();
			expect(fn).not.toHaveBeenCalled();

			vi.advanceTimersByTime(100);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it("should reset timer on subsequent calls", () => {
			const fn = vi.fn();
			const debounced = debounce(fn, 100);

			debounced();
			vi.advanceTimersByTime(50);
			debounced();
			vi.advanceTimersByTime(50);

			expect(fn).not.toHaveBeenCalled();

			vi.advanceTimersByTime(50);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it("should pass arguments correctly", () => {
			const fn = vi.fn();
			const debounced = debounce(fn, 100);

			debounced("arg1", "arg2");
			vi.advanceTimersByTime(100);

			expect(fn).toHaveBeenCalledWith("arg1", "arg2");
		});

		it("should cancel pending execution", () => {
			const fn = vi.fn();
			const debounced = debounce(fn, 100);

			debounced();
			debounced.cancel();
			vi.advanceTimersByTime(100);

			expect(fn).not.toHaveBeenCalled();
		});
	});

	describe("throttle", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.restoreAllMocks();
			vi.useRealTimers();
		});

		it("should execute function immediately on first call", () => {
			const fn = vi.fn();
			const throttled = throttle(fn, 100);

			throttled();
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it("should throttle subsequent calls", () => {
			const fn = vi.fn();
			const throttled = throttle(fn, 100);

			throttled();
			throttled();
			throttled();

			expect(fn).toHaveBeenCalledTimes(1);

			vi.advanceTimersByTime(100);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it("should pass arguments correctly", () => {
			const fn = vi.fn();
			const throttled = throttle(fn, 100);

			throttled("arg1", "arg2");
			expect(fn).toHaveBeenCalledWith("arg1", "arg2");
		});

		it("should cancel pending execution", () => {
			const fn = vi.fn();
			const throttled = throttle(fn, 100);

			throttled();
			throttled.cancel();
			vi.advanceTimersByTime(100);

			expect(fn).toHaveBeenCalledTimes(1); // Only the immediate call
		});

		it("should allow calls after throttle window expires", () => {
			const fn = vi.fn();
			const throttled = throttle(fn, 100);

			throttled();
			throttled();
			throttled();

			expect(fn).toHaveBeenCalledTimes(1);

			vi.advanceTimersByTime(100);
			throttled();

			expect(fn).toHaveBeenCalledTimes(2);
		});
	});
});
