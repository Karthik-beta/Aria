import { describe, expect, it } from "vitest";
import {
	buildLocationListInput,
	getLocationGroupLabel,
	getRelativeAge,
	toLocationMutationInput,
} from "./location.utils";

describe("location.utils", () => {
	describe("getLocationGroupLabel", () => {
		it("returns 'Group' for group locations", () => {
			expect(getLocationGroupLabel(true)).toBe("Group");
		});

		it("returns 'Leaf' for leaf locations", () => {
			expect(getLocationGroupLabel(false)).toBe("Leaf");
		});
	});

	describe("getRelativeAge", () => {
		it("returns 'Today' for dates within the last 24 hours", () => {
			const now = new Date();
			expect(getRelativeAge(now)).toBe("Today");
		});

		it("returns days for dates 1-29 days ago", () => {
			const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
			expect(getRelativeAge(date)).toBe("5 d");
		});

		it("returns months for dates 1-11 months ago", () => {
			const date = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
			expect(getRelativeAge(date)).toBe("1 m");
		});

		it("returns years for dates 1+ year ago", () => {
			const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
			expect(getRelativeAge(date)).toBe("1 y");
		});
	});

	describe("toLocationMutationInput", () => {
		it("maps form values to mutation payload", () => {
			expect(
				toLocationMutationInput({
					name: "  Head Office  ",
					parentLocationId: "clh123parent",
					isGroup: true,
				}),
			).toEqual({
				name: "Head Office",
				parentLocationId: "clh123parent",
				isGroup: true,
			});
		});

		it("normalizes empty parentLocationId to null", () => {
			expect(
				toLocationMutationInput({
					name: "Warehouse A",
					parentLocationId: "",
					isGroup: false,
				}),
			).toEqual({
				name: "Warehouse A",
				parentLocationId: null,
				isGroup: false,
			});
		});

		it("normalizes whitespace-only parentLocationId to null", () => {
			expect(
				toLocationMutationInput({
					name: "Site B",
					parentLocationId: "   ",
					isGroup: false,
				}),
			).toEqual({
				name: "Site B",
				parentLocationId: null,
				isGroup: false,
			});
		});

		it("trims leading and trailing whitespace from name", () => {
			const result = toLocationMutationInput({
				name: "  Dubai  ",
				parentLocationId: "",
				isGroup: false,
			});
			expect(result.name).toBe("Dubai");
		});
	});

	describe("buildLocationListInput", () => {
		it("builds list input with all filters applied", () => {
			expect(
				buildLocationListInput({
					search: "  Dubai  ",
					group: "group",
					pageIndex: 2,
					pageSize: 20,
				}),
			).toEqual({
				skip: 40,
				take: 20,
				search: "Dubai",
				isGroup: true,
			});
		});

		it("sets isGroup to false for leaf filter", () => {
			expect(
				buildLocationListInput({
					search: "",
					group: "leaf",
					pageIndex: 0,
					pageSize: 20,
				}),
			).toEqual({
				skip: 0,
				take: 20,
				search: undefined,
				isGroup: false,
			});
		});

		it("omits isGroup for 'all' filter", () => {
			expect(
				buildLocationListInput({
					search: "",
					group: "all",
					pageIndex: 0,
					pageSize: 20,
				}),
			).toEqual({
				skip: 0,
				take: 20,
				search: undefined,
				isGroup: undefined,
			});
		});

		it("omits search when empty", () => {
			const result = buildLocationListInput({
				search: "   ",
				group: "all",
				pageIndex: 0,
				pageSize: 10,
			});
			expect(result.search).toBeUndefined();
		});

		it("calculates correct skip based on page index and size", () => {
			expect(
				buildLocationListInput({
					search: "",
					group: "all",
					pageIndex: 3,
					pageSize: 15,
				}),
			).toMatchObject({ skip: 45, take: 15 });
		});
	});
});
