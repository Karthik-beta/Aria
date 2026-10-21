import {
	buildLocationTree,
	collectSubtreeIds,
	getAncestorIds,
	type LocationTreeRow,
	wouldCreateCycle,
} from "../location-tree";

function row(
	id: string,
	parentLocationId: string | null,
	extra: Partial<LocationTreeRow> = {},
): LocationTreeRow {
	return {
		id,
		name: extra.name ?? id,
		parentLocationId,
		isGroup: true,
		isContainer: false,
		area: 0,
		assetCount: 0,
		...extra,
	};
}

const edges = [
	{ id: "hq", parentLocationId: null },
	{ id: "floor", parentLocationId: "hq" },
	{ id: "room", parentLocationId: "floor" },
	{ id: "other", parentLocationId: null },
];

describe("location-tree", () => {
	describe("getAncestorIds", () => {
		const parentById = new Map(edges.map((e) => [e.id, e.parentLocationId]));

		it("returns the chain from the start id up to the root", () => {
			expect(getAncestorIds("room", parentById)).toEqual([
				"room",
				"floor",
				"hq",
			]);
		});

		it("returns an empty chain for null", () => {
			expect(getAncestorIds(null, parentById)).toEqual([]);
		});

		it("terminates on corrupt cyclic data", () => {
			const cyclic = new Map<string, string | null>([
				["a", "b"],
				["b", "a"],
			]);
			expect(getAncestorIds("a", cyclic)).toEqual(["a", "b"]);
		});

		it("honours the depth guard", () => {
			const chain = new Map<string, string | null>();
			for (let i = 0; i < 500; i++) chain.set(`n${i}`, `n${i + 1}`);
			expect(getAncestorIds("n0", chain, 10)).toHaveLength(10);
		});
	});

	describe("wouldCreateCycle", () => {
		it("detects self as parent", () => {
			expect(wouldCreateCycle("hq", "hq", edges)).toBe(true);
		});

		it("detects a descendant as parent (grandchild)", () => {
			expect(wouldCreateCycle("hq", "room", edges)).toBe(true);
		});

		it("allows moving under an unrelated location or an ancestor", () => {
			expect(wouldCreateCycle("room", "other", edges)).toBe(false);
			expect(wouldCreateCycle("room", "hq", edges)).toBe(false);
		});
	});

	describe("collectSubtreeIds", () => {
		it("returns the root and all descendants", () => {
			expect([...collectSubtreeIds("hq", edges)].sort()).toEqual([
				"floor",
				"hq",
				"room",
			]);
			expect([...collectSubtreeIds("other", edges)]).toEqual(["other"]);
		});
	});

	describe("buildLocationTree", () => {
		const rows = [
			row("hq", null, { name: "HQ", area: 10, assetCount: 1 }),
			row("b", "hq", { name: "Beta", area: 5, assetCount: 2 }),
			row("a", "hq", { name: "Alpha", area: 7 }),
			row("leaf", "a", {
				name: "Leaf",
				isGroup: false,
				area: 3,
				assetCount: 4,
			}),
			row("z", null, { name: "Annex" }),
		];

		it("orders roots and children by name", () => {
			const tree = buildLocationTree(rows);
			expect(tree.map((n) => n.name)).toEqual(["Annex", "HQ"]);
			expect(tree[1].children.map((n) => n.name)).toEqual(["Alpha", "Beta"]);
		});

		it("computes direct and total counts and areas", () => {
			const hq = buildLocationTree(rows)[1];
			expect(hq.childCount).toBe(2);
			expect(hq.assetCount).toBe(1);
			expect(hq.totalAssetCount).toBe(1 + 2 + 4);
			expect(hq.area).toBe(10);
			expect(hq.totalArea).toBe(10 + 5 + 7 + 3);
			const alpha = hq.children[0];
			expect(alpha.childCount).toBe(1);
			expect(alpha.totalAssetCount).toBe(4);
			expect(alpha.totalArea).toBe(10);
		});

		it("returns only the requested subtree for rootId", () => {
			const tree = buildLocationTree(rows, { rootId: "a" });
			expect(tree).toHaveLength(1);
			expect(tree[0].name).toBe("Alpha");
			expect(tree[0].children.map((n) => n.name)).toEqual(["Leaf"]);
			expect(buildLocationTree(rows, { rootId: "missing" })).toEqual([]);
		});

		it("drops leaves with includeLeaves=false but keeps rolled-up totals", () => {
			const hq = buildLocationTree(rows, { includeLeaves: false })[1];
			const alpha = hq.children[0];
			expect(alpha.children).toEqual([]);
			expect(alpha.childCount).toBe(1);
			expect(alpha.totalAssetCount).toBe(4);
			expect(alpha.totalArea).toBe(10);
		});

		it("does not loop forever on cyclic data", () => {
			const cyclic = [row("r", null), row("x", "y"), row("y", "x")];
			const tree = buildLocationTree(cyclic);
			expect(tree.map((n) => n.id)).toEqual(["r"]);
			expect(buildLocationTree(cyclic, { rootId: "x" })[0].totalArea).toBe(0);
		});
	});
});
