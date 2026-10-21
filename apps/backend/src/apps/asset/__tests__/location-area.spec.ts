import {
	computeArea,
	EARTH_RADIUS,
	polygonArea,
	ringArea,
} from "../location-area";
import { buildLocationTree, type LocationTreeRow } from "../location-tree";

/**
 * Expected values are hand-derived, then cross-checked against the original
 * ERPNext Python (`compute_area` from location.py) run on the same input.
 *
 * Closed rectangle ring lon a..b, lat c..d, listed (a,c),(b,c),(b,d),(a,d),(a,c).
 * Walking `_ring_area` over its 5 vertices, only i=1 and i=2 (lon delta a-b,
 * sin d) and i=0 and i=4 (lon delta b-a, sin c) are non-zero, so
 *   area = R^2 / 2 * 2 * (b-a) * (sin d - sin c)   (a, b in radians)
 *        = R^2 * (b-a) * (sin d - sin c),
 * which is the exact spherical area of a lat/lon rectangle.
 */
const R2 = EARTH_RADIUS * EARTH_RADIUS;
const rad = (deg: number) => (deg * Math.PI) / 180;

function rect(a: number, b: number, c: number, d: number): number[][] {
	return [
		[a, c],
		[b, c],
		[b, d],
		[a, d],
		[a, c],
	];
}

function polygonFeature(rings: number[][][]) {
	return {
		type: "Feature",
		properties: {},
		geometry: { type: "Polygon", coordinates: rings },
	};
}

function circleFeature(radius: number) {
	return {
		type: "Feature",
		properties: { point_type: "circle", radius },
		geometry: { type: "Point", coordinates: [72.875834, 19.100566] },
	};
}

describe("location-area", () => {
	describe("ringArea", () => {
		it("is 0 for rings with fewer than 3 positions", () => {
			expect(ringArea([])).toBe(0);
			expect(
				ringArea([
					[0, 0],
					[1, 1],
				]),
			).toBe(0);
		});

		it("matches the exact spherical area of a 1 degree square at the equator", () => {
			const expected = R2 * rad(1) * (Math.sin(rad(1)) - Math.sin(0));
			expect(Math.abs(ringArea(rect(0, 1, 0, 1)))).toBeCloseTo(expected, 3);
			// Python reference: 12391399902.071104
			expect(Math.abs(ringArea(rect(0, 1, 0, 1)))).toBeCloseTo(
				12391399902.071104,
				3,
			);
		});
	});

	describe("polygonArea", () => {
		it("is 0 without rings", () => {
			expect(polygonArea([])).toBe(0);
		});

		it("subtracts holes from the outer ring", () => {
			const outer = R2 * rad(1) * Math.sin(rad(1));
			const hole = R2 * rad(0.5) * (Math.sin(rad(0.75)) - Math.sin(rad(0.25)));
			const withHole = polygonArea([
				rect(0, 1, 0, 1),
				rect(0.25, 0.75, 0.25, 0.75),
			]);
			expect(withHole).toBeCloseTo(outer - hole, 3);
			// Python reference: 9293520436.973568
			expect(withHole).toBeCloseTo(9293520436.973568, 3);
		});

		it("ignores ring orientation (clockwise hole gives the same result)", () => {
			const clockwiseHole = [...rect(0.25, 0.75, 0.25, 0.75)].reverse();
			expect(polygonArea([rect(0, 1, 0, 1), clockwiseHole])).toBeCloseTo(
				polygonArea([rect(0, 1, 0, 1), rect(0.25, 0.75, 0.25, 0.75)]),
				3,
			);
		});
	});

	describe("computeArea", () => {
		it("is 0 for no features", () => {
			expect(computeArea([])).toBe(0);
			expect(computeArea(null)).toBe(0);
			expect(computeArea(undefined)).toBe(0);
		});

		it("computes a polygon without a hole", () => {
			expect(computeArea([polygonFeature([rect(0, 1, 0, 1)])])).toBeCloseTo(
				12391399902.071104,
				3,
			);
		});

		it("computes a polygon with a hole", () => {
			expect(
				computeArea([
					polygonFeature([rect(0, 1, 0, 1), rect(0.25, 0.75, 0.25, 0.75)]),
				]),
			).toBeCloseTo(9293520436.973568, 3);
		});

		it("computes a circle as pi * r^2 (r = 1000 m gives pi * 10^6)", () => {
			expect(computeArea([circleFeature(1000)])).toBeCloseTo(
				3141592.653589793,
				6,
			);
		});

		it("sums several features and ignores unsupported geometry", () => {
			const total = computeArea([
				polygonFeature([rect(0, 1, 0, 1)]),
				circleFeature(1000),
				{
					type: "Feature",
					properties: {},
					geometry: { type: "Point", coordinates: [1, 1] },
				},
				{
					type: "Feature",
					properties: {},
					geometry: {
						type: "LineString",
						coordinates: [
							[0, 0],
							[1, 1],
						],
					},
				},
			]);
			expect(total).toBeCloseTo(12391399902.071104 + 3141592.653589793, 3);
		});

		it("treats malformed features as zero instead of throwing", () => {
			expect(
				computeArea([
					{ geometry: { type: "Polygon", coordinates: "nope" } },
					{ geometry: { type: "Polygon" } },
					{ geometry: null },
					{
						properties: { point_type: "circle" },
						geometry: { type: "Point", coordinates: [0, 0] },
					},
				]),
			).toBe(0);
		});
	});

	/**
	 * Port of ERPNext `test_location_features`: the fixture tree
	 * "Test Location Area" > "Basil Farm" > "Division 1" > "Field 1" >
	 * "Block 1" (erpnext/tests/utils.py). ERPNext asserts the ancestor's area
	 * equals the sum of the descendants' own areas; Aria asserts the same for
	 * the read-time `totalArea` roll-up.
	 */
	describe("ERPNext test_location_features fixtures", () => {
		const basil = circleFeature(884.5625420736483);
		const division = circleFeature(542.3424997060739);
		const field1 = polygonFeature([
			[
				[72.846758, 19.118287],
				[72.846758, 19.121206],
				[72.850535, 19.121206],
				[72.850535, 19.118287],
				[72.846758, 19.118287],
			],
		]);
		const block1 = polygonFeature([
			[
				[72.921495, 19.073313],
				[72.924929, 19.068121],
				[72.934713, 19.06585],
				[72.929392, 19.05579],
				[72.94158, 19.056926],
				[72.951365, 19.095213],
				[72.921495, 19.073313],
			],
		]);

		// Python reference values from ERPNext compute_area.
		const expected = {
			basil: 2458141.970457088,
			division: 924053.5709205096,
			field1: 129086.24641386214,
			block1: 5985835.366368234,
			total: 9497117.154159695,
		};

		it("computes each fixture area like ERPNext", () => {
			expect(computeArea([basil])).toBeCloseTo(expected.basil, 4);
			expect(computeArea([division])).toBeCloseTo(expected.division, 4);
			expect(computeArea([field1])).toBeCloseTo(expected.field1, 4);
			expect(computeArea([block1])).toBeCloseTo(expected.block1, 4);
		});

		it("rolls own areas up additively into totalArea of the root", () => {
			const row = (
				id: string,
				parent: string | null,
				features: Parameters<typeof computeArea>[0],
			): LocationTreeRow => ({
				id,
				name: id,
				parentLocationId: parent,
				isGroup: true,
				isContainer: true,
				area: computeArea(features),
				assetCount: 0,
			});

			const [root] = buildLocationTree([
				row("Test Location Area", null, []),
				row("Basil Farm", "Test Location Area", [basil]),
				row("Division 1", "Basil Farm", [division]),
				row("Field 1", "Division 1", [field1]),
				row("Block 1", "Field 1", [block1]),
			]);

			expect(root.area).toBe(0);
			expect(root.totalArea).toBeCloseTo(expected.total, 4);
			const basilNode = root.children[0];
			expect(basilNode.totalArea).toBeCloseTo(expected.total, 4);
			const divisionNode = basilNode.children[0];
			expect(divisionNode.totalArea).toBeCloseTo(
				expected.division + expected.field1 + expected.block1,
				4,
			);
			expect(divisionNode.children[0].children[0].totalArea).toBeCloseTo(
				expected.block1,
				4,
			);
		});
	});
});
