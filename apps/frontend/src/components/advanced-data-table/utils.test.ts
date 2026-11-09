/**
 * Utils Tests
 * Tests for table utility functions
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce, downloadExcelBuffer, parseCSV, throttle } from "./utils";

// Mock DOM APIs
let mockClick: ReturnType<typeof vi.fn>;
let mockAppendChild: ReturnType<typeof vi.fn>;
let mockRemoveChild: ReturnType<typeof vi.fn>;
let mockCreateObjectURL: ReturnType<typeof vi.fn>;
let mockRevokeObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
	mockClick = vi.fn();
	mockAppendChild = vi.fn();
	mockRemoveChild = vi.fn();
	mockCreateObjectURL = vi.fn(() => "blob:test-url");
	mockRevokeObjectURL = vi.fn();

	const mockLink = {
		href: "",
		download: "",
		click: mockClick,
		appendChild: mockAppendChild,
		removeChild: mockRemoveChild,
	} as unknown as HTMLAnchorElement;

	vi.stubGlobal("URL", {
		createObjectURL: mockCreateObjectURL,
		revokeObjectURL: mockRevokeObjectURL,
	});

	vi.spyOn(document, "createElement").mockReturnValue(mockLink);
	vi.spyOn(document.body, "appendChild").mockReturnValue(mockLink);
	vi.spyOn(document.body, "removeChild").mockReturnValue(mockLink);
});

afterEach(() => {
	vi.restoreAllMocks();
});

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

	describe("downloadExcelBuffer", () => {
		it("should handle base64 string input and create valid blob", () => {
			// This is a minimal valid xlsx file header in base64
			const minimalXlsxBase64 = "UEsDBBQABgA=";

			downloadExcelBuffer(minimalXlsxBase64, "test.xlsx");

			// Verify URL.createObjectURL was called with a Blob
			expect(mockCreateObjectURL).toHaveBeenCalled();
			const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
			expect(blobArg).toBeInstanceOf(Blob);
			expect(blobArg.type).toBe(
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			);
		});

		it("should handle ArrayBuffer input", () => {
			const buffer = new ArrayBuffer(8);
			const view = new Uint8Array(buffer);
			view[0] = 0x50; // 'P'
			view[1] = 0x4b; // 'K'

			downloadExcelBuffer(buffer, "test.xlsx");

			expect(mockCreateObjectURL).toHaveBeenCalled();
		});

		it("should handle base64 with padding characters", () => {
			const base64WithPadding = "UEsDBBQABgA="; // Has = padding

			downloadExcelBuffer(base64WithPadding, "padded.xlsx");

			expect(mockCreateObjectURL).toHaveBeenCalled();
		});

		it("should set correct MIME type for xlsx files", () => {
			const base64 = "UEsDBBQABgA=";

			downloadExcelBuffer(base64, "report.xlsx");

			const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
			expect(blobArg.type).toBe(
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			);
		});
	});

	describe("parseCSV", () => {
		it("should parse simple CSV data", async () => {
			const csvContent = "name,age,city\nJohn,30,NYC\nJane,25,LA";
			const file = new File([csvContent], "test.csv", { type: "text/csv" });

			const result = await parseCSV(file);

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({ name: "John", age: "30", city: "NYC" });
			expect(result[1]).toEqual({ name: "Jane", age: "25", city: "LA" });
		});

		it("should handle CSV with headers only", async () => {
			const csvContent = "name,age,city";
			const file = new File([csvContent], "test.csv", { type: "text/csv" });

			const result = await parseCSV(file);

			expect(result).toHaveLength(0);
		});

		it("should trim whitespace from headers and values", async () => {
			const csvContent = "  name  ,  age  \n  John  ,  30  ";
			const file = new File([csvContent], "test.csv", { type: "text/csv" });

			const result = await parseCSV(file);

			expect(result[0]).toEqual({ name: "John", age: "30" });
		});
	});
});
