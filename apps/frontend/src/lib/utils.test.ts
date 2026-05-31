import { describe, expect, it } from "vitest";
import { cn, formatBytes } from "./utils";

describe("cn", () => {
	it("merges tailwind classes", () => {
		expect(cn("px-2", "py-1")).toBe("px-2 py-1");
	});

	it("resolves conflicting tailwind classes", () => {
		// twMerge keeps the last conflicting class
		expect(cn("px-2", "px-4")).toBe("px-4");
		expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
	});

	it("handles conditional classes via clsx", () => {
		expect(cn("base", false && "hidden", "extra")).toBe("base extra");
		expect(cn("base", undefined, null, "extra")).toBe("base extra");
	});

	it("handles empty inputs", () => {
		expect(cn()).toBe("");
		expect(cn("")).toBe("");
	});
});

describe("formatBytes", () => {
	it("returns '0 Byte' for zero bytes", () => {
		expect(formatBytes(0)).toBe("0 Byte");
	});

	it("formats bytes correctly in normal mode", () => {
		expect(formatBytes(1024)).toBe("1 KB");
		expect(formatBytes(1048576)).toBe("1 MB");
		expect(formatBytes(1073741824)).toBe("1 GB");
	});

	it("formats bytes correctly in accurate mode", () => {
		expect(formatBytes(1024, { sizeType: "accurate" })).toBe("1 KiB");
		expect(formatBytes(1048576, { sizeType: "accurate" })).toBe("1 MiB");
	});

	it("respects decimal places", () => {
		expect(formatBytes(1536, { decimals: 1 })).toBe("1.5 KB");
		expect(formatBytes(1536, { decimals: 2 })).toBe("1.50 KB");
	});

	it("handles small byte values", () => {
		expect(formatBytes(500)).toBe("500 Bytes");
	});

	it("handles large values", () => {
		expect(formatBytes(1099511627776)).toBe("1 TB");
	});
});
