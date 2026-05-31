import { describe, expect, test } from "bun:test";
import { paginate } from "./index";

describe("paginate", () => {
	const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

	test("returns the correct slice for page 1", () => {
		const result = paginate(items, { page: 1, pageSize: 3 });
		expect(result).toEqual([1, 2, 3]);
	});

	test("returns the correct slice for page 2", () => {
		const result = paginate(items, { page: 2, pageSize: 3 });
		expect(result).toEqual([4, 5, 6]);
	});

	test("returns the correct slice for last page with remainder", () => {
		const result = paginate(items, { page: 4, pageSize: 3 });
		expect(result).toEqual([10]);
	});

	test("returns empty array when page is beyond data", () => {
		const result = paginate(items, { page: 5, pageSize: 3 });
		expect(result).toEqual([]);
	});

	test("returns all items when pageSize >= total items", () => {
		const result = paginate(items, { page: 1, pageSize: 100 });
		expect(result).toEqual(items);
	});

	test("handles empty array input", () => {
		const result = paginate([], { page: 1, pageSize: 10 });
		expect(result).toEqual([]);
	});

	test("handles pageSize of 1", () => {
		const result = paginate(items, { page: 3, pageSize: 1 });
		expect(result).toEqual([3]);
	});

	test("does not mutate the original array", () => {
		const original = [1, 2, 3];
		const copy = [...original];
		paginate(original, { page: 1, pageSize: 2 });
		expect(original).toEqual(copy);
	});
});
