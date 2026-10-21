/* eslint-disable */
import { Asset } from "@aria/types";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetLocationService } from "../asset-location.service";

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function createMockPrisma() {
	return {
		location: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		asset: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		assetCategory: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		assetActivity: {
			create: jest.fn(),
		},
		$transaction: jest.fn(),
	};
}

function createTestContext() {
	const mockPrisma = createMockPrisma();
	const service = new AssetLocationService(
		mockPrisma as unknown as PrismaService,
	);
	return { service, mockPrisma };
}

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const mockLocationRow = {
	id: "loc-abc-001",
	name: "Head Office",
	parentLocationId: null,
	parentLocation: null,
	isGroup: true,
	isContainer: false,
	latitude: null,
	longitude: null,
	area: 0,
	areaUom: null,
	geolocation: null,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

const circleCollection = {
	type: "FeatureCollection" as const,
	features: [
		{
			type: "Feature" as const,
			properties: { point_type: "circle", radius: 1000 },
			geometry: { type: "Point" as const, coordinates: [72.875834, 19.100566] },
		},
	],
};

/** HQ > Floor 1 > Room 101 (leaf), plus an unrelated root. */
const hierarchy: Record<
	string,
	{
		id: string;
		name: string;
		parentLocationId: string | null;
		isGroup: boolean;
	}
> = {
	hq: { id: "hq", name: "HQ", parentLocationId: null, isGroup: true },
	floor: {
		id: "floor",
		name: "Floor 1",
		parentLocationId: "hq",
		isGroup: true,
	},
	room: {
		id: "room",
		name: "Room 101",
		parentLocationId: "floor",
		isGroup: false,
	},
	annex: { id: "annex", name: "Annex", parentLocationId: null, isGroup: true },
};

/** Wires the mocks so they answer from `hierarchy` (names are all unused). */
function mockHierarchy(mockPrisma: ReturnType<typeof createMockPrisma>) {
	mockPrisma.location.findUnique.mockImplementation(
		async ({ where }: { where: { id?: string; name?: string } }) => {
			if (where.name) return null;
			return where.id ? (hierarchy[where.id] ?? null) : null;
		},
	);
	mockPrisma.location.findMany.mockResolvedValue(Object.values(hierarchy));
	mockPrisma.location.update.mockImplementation(
		async ({ where, data }: { where: { id: string }; data: object }) => ({
			...mockLocationRow,
			id: where.id,
			...data,
		}),
	);
	mockPrisma.location.create.mockImplementation(
		async ({ data }: { data: object }) => ({
			...mockLocationRow,
			id: "new",
			...data,
		}),
	);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssetService > Location", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma } = createTestContext());
	});

	// -------------------------------------------------------------------------
	// findAllLocations
	// -------------------------------------------------------------------------

	describe("findAllLocations", () => {
		it("returns items and totalCount", async () => {
			mockPrisma.location.findMany.mockResolvedValue([mockLocationRow]);
			mockPrisma.location.count.mockResolvedValue(1);

			const result = await service.findAllLocations({ skip: 0, take: 20 });

			expect(result.totalCount).toBe(1);
			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toMatchObject({
				id: mockLocationRow.id,
				name: mockLocationRow.name,
				parentLocationId: null,
				parentLocationName: null,
				isGroup: true,
			});
		});

		it("applies isGroup filter", async () => {
			mockPrisma.location.findMany.mockResolvedValue([]);
			mockPrisma.location.count.mockResolvedValue(0);

			await service.findAllLocations({ isGroup: true });

			expect(mockPrisma.location.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ where: { isGroup: true } }),
			);
		});

		it("applies search filter", async () => {
			mockPrisma.location.findMany.mockResolvedValue([]);
			mockPrisma.location.count.mockResolvedValue(0);

			await service.findAllLocations({ search: "Office" });

			expect(mockPrisma.location.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						name: { contains: "Office", mode: "insensitive" },
					},
				}),
			);
		});

		it("clamps take to LIST_TAKE_MAX (250)", async () => {
			mockPrisma.location.findMany.mockResolvedValue([]);
			mockPrisma.location.count.mockResolvedValue(0);

			await service.findAllLocations({ take: 9999 });

			expect(mockPrisma.location.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ take: 250 }),
			);
		});

		it("maps parentLocationName from relation", async () => {
			const rowWithParent = {
				...mockLocationRow,
				id: "loc-child-001",
				name: "Floor 1",
				parentLocationId: "loc-abc-001",
				parentLocation: { name: "Head Office" },
				isGroup: false,
			};
			mockPrisma.location.findMany.mockResolvedValue([rowWithParent]);
			mockPrisma.location.count.mockResolvedValue(1);

			const result = await service.findAllLocations({});

			expect(result.items[0].parentLocationName).toBe("Head Office");
			expect(result.items[0].parentLocationId).toBe("loc-abc-001");
		});
	});

	// -------------------------------------------------------------------------
	// findLocationById
	// -------------------------------------------------------------------------

	describe("findLocationById", () => {
		it("returns the location when found", async () => {
			mockPrisma.location.findUnique.mockResolvedValue(mockLocationRow);

			const result = await service.findLocationById("loc-abc-001");

			expect(result).toMatchObject({ id: "loc-abc-001", name: "Head Office" });
		});

		it("returns null when location does not exist", async () => {
			mockPrisma.location.findUnique.mockResolvedValue(null);

			const result = await service.findLocationById("missing-id");

			expect(result).toBeNull();
		});
	});

	// -------------------------------------------------------------------------
	// createLocation
	// -------------------------------------------------------------------------

	describe("createLocation", () => {
		it("creates a new location", async () => {
			mockPrisma.location.findUnique.mockResolvedValue(null); // no existing
			mockPrisma.location.create.mockResolvedValue(mockLocationRow);

			const result = await service.createLocation({
				name: "Head Office",
				parentLocationId: null,
				isGroup: true,
			});

			expect(result.name).toBe("Head Office");
			expect(mockPrisma.location.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						name: "Head Office",
						isGroup: true,
						parentLocationId: null,
					}),
					select: expect.objectContaining({ id: true, name: true }),
				}),
			);
		});

		it("throws BadRequestException on duplicate name", async () => {
			mockPrisma.location.findUnique.mockResolvedValue({ id: "dup-id" });

			await expect(
				service.createLocation({ name: "Head Office", isGroup: false }),
			).rejects.toThrow(BadRequestException);
		});
	});

	// -------------------------------------------------------------------------
	// updateLocation
	// -------------------------------------------------------------------------

	describe("updateLocation", () => {
		it("updates an existing location", async () => {
			mockPrisma.location.findUnique.mockResolvedValue({ id: "loc-abc-001" });
			mockPrisma.location.update.mockResolvedValue({
				...mockLocationRow,
				name: "Head Office Renamed",
			});

			const result = await service.updateLocation({
				id: "loc-abc-001",
				name: "Head Office Renamed",
			});

			expect(result.name).toBe("Head Office Renamed");
		});

		it("throws NotFoundException when location does not exist", async () => {
			mockPrisma.location.findUnique.mockResolvedValue(null);

			await expect(
				service.updateLocation({ id: "nonexistent", name: "X" }),
			).rejects.toThrow(NotFoundException);
		});
	});

	// -------------------------------------------------------------------------
	// deleteLocation
	// -------------------------------------------------------------------------

	describe("deleteLocation", () => {
		it("deletes a location with no assigned assets", async () => {
			mockPrisma.location.findUnique.mockResolvedValue({
				id: "loc-abc-001",
				_count: { assets: 0 },
			});
			mockPrisma.location.delete.mockResolvedValue({ id: "loc-abc-001" });

			const result = await service.deleteLocation("loc-abc-001");

			expect(result).toEqual({ success: true, id: "loc-abc-001" });
			expect(mockPrisma.location.delete).toHaveBeenCalledWith({
				where: { id: "loc-abc-001" },
			});
		});

		it("throws BadRequestException when location has assigned assets", async () => {
			mockPrisma.location.findUnique.mockResolvedValue({
				id: "loc-abc-001",
				_count: { assets: 3 },
			});

			await expect(service.deleteLocation("loc-abc-001")).rejects.toThrow(
				BadRequestException,
			);
		});

		it("throws NotFoundException when location does not exist", async () => {
			mockPrisma.location.findUnique.mockResolvedValue(null);

			await expect(service.deleteLocation("nonexistent")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	// -------------------------------------------------------------------------
	// Hierarchy validation
	// -------------------------------------------------------------------------

	describe("createLocation hierarchy rules", () => {
		beforeEach(() => mockHierarchy(mockPrisma));

		it("rejects an unknown parent and writes nothing", async () => {
			await expect(
				service.createLocation({ name: "New", parentLocationId: "ghost" }),
			).rejects.toThrow(BadRequestException);
			expect(mockPrisma.location.create).not.toHaveBeenCalled();
		});

		it("rejects a non-group parent with a clear message", async () => {
			await expect(
				service.createLocation({ name: "New", parentLocationId: "room" }),
			).rejects.toThrow("Parent location Room 101 is not a group");
			expect(mockPrisma.location.create).not.toHaveBeenCalled();
		});

		it("accepts a group parent", async () => {
			const result = await service.createLocation({
				name: "New",
				parentLocationId: "floor",
			});
			expect(result.parentLocationId).toBe("floor");
			expect(mockPrisma.location.create).toHaveBeenCalledTimes(1);
		});
	});

	describe("updateLocation hierarchy rules", () => {
		beforeEach(() => mockHierarchy(mockPrisma));

		it("rejects a location as its own parent", async () => {
			await expect(
				service.updateLocation({ id: "hq", parentLocationId: "hq" }),
			).rejects.toThrow("A location cannot be its own parent");
			expect(mockPrisma.location.update).not.toHaveBeenCalled();
		});

		it("rejects an unknown parent", async () => {
			await expect(
				service.updateLocation({ id: "hq", parentLocationId: "ghost" }),
			).rejects.toThrow(BadRequestException);
			expect(mockPrisma.location.update).not.toHaveBeenCalled();
		});

		it("rejects a non-group parent", async () => {
			await expect(
				service.updateLocation({ id: "annex", parentLocationId: "room" }),
			).rejects.toThrow("Parent location Room 101 is not a group");
			expect(mockPrisma.location.update).not.toHaveBeenCalled();
		});

		it("rejects a cycle through a grandchild", async () => {
			// Room 101 is a leaf, so make it a group to isolate the cycle rule.
			hierarchy.room.isGroup = true;
			try {
				await expect(
					service.updateLocation({ id: "hq", parentLocationId: "room" }),
				).rejects.toThrow("A location cannot be a child of its own descendant");
			} finally {
				hierarchy.room.isGroup = false;
			}
			expect(mockPrisma.location.update).not.toHaveBeenCalled();
		});

		it("rejects a direct child as parent", async () => {
			await expect(
				service.updateLocation({ id: "hq", parentLocationId: "floor" }),
			).rejects.toThrow("A location cannot be a child of its own descendant");
		});

		it("allows moving a location under an unrelated group", async () => {
			await service.updateLocation({ id: "floor", parentLocationId: "annex" });
			expect(mockPrisma.location.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ parentLocationId: "annex" }),
				}),
			);
		});

		it("allows moving a location to the root", async () => {
			await service.updateLocation({ id: "floor", parentLocationId: null });
			expect(mockPrisma.location.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ parentLocationId: null }),
				}),
			);
		});

		it("does not re-validate an unchanged parent (rename of legacy data)", async () => {
			// Make the data look legacy: Room 101 sits under a non-group.
			hierarchy.floor.isGroup = false;
			try {
				await service.updateLocation({
					id: "room",
					name: "Room 102",
					parentLocationId: "floor",
				});
			} finally {
				hierarchy.floor.isGroup = true;
			}
			expect(mockPrisma.location.update).toHaveBeenCalledTimes(1);
		});

		it("rejects turning a location with children into a leaf", async () => {
			mockPrisma.location.count.mockResolvedValue(2);
			await expect(
				service.updateLocation({ id: "floor", isGroup: false }),
			).rejects.toThrow("cannot be a leaf node as it has children");
			expect(mockPrisma.location.update).not.toHaveBeenCalled();
		});

		it("lets a childless group (even with assets) become a leaf", async () => {
			mockPrisma.location.count.mockResolvedValue(0);
			await service.updateLocation({ id: "annex", isGroup: false });
			expect(mockPrisma.location.count).toHaveBeenCalledWith({
				where: { parentLocationId: "annex" },
			});
			expect(mockPrisma.location.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ isGroup: false }),
				}),
			);
		});
	});

	// -------------------------------------------------------------------------
	// Fields, GeoJSON and area
	// -------------------------------------------------------------------------

	describe("new location fields", () => {
		beforeEach(() => mockHierarchy(mockPrisma));

		it("round-trips container, coordinates, uom and geolocation on create", async () => {
			const result = await service.createLocation({
				name: "Basil Farm",
				isGroup: true,
				isContainer: true,
				latitude: 19.1,
				longitude: 72.87,
				areaUom: "Square Meter",
				geolocation: circleCollection,
			});

			const data = mockPrisma.location.create.mock.calls[0][0].data;
			expect(data).toMatchObject({
				isContainer: true,
				latitude: 19.1,
				longitude: 72.87,
				areaUom: "Square Meter",
				geolocation: circleCollection,
			});
			expect(data.area).toBeCloseTo(Math.PI * 1000 ** 2, 6);
			expect(result).toMatchObject({
				isContainer: true,
				latitude: 19.1,
				longitude: 72.87,
				areaUom: "Square Meter",
				geolocation: circleCollection,
			});
			expect(result.area).toBeCloseTo(Math.PI * 1000 ** 2, 6);
		});

		it("does not set area when no geolocation is provided", async () => {
			await service.createLocation({ name: "Plain" });
			const data = mockPrisma.location.create.mock.calls[0][0].data;
			expect(data).not.toHaveProperty("area");
			expect(data).not.toHaveProperty("geolocation");
		});

		it("recomputes area when geolocation changes on update", async () => {
			await service.updateLocation({
				id: "annex",
				geolocation: circleCollection,
			});
			const data = mockPrisma.location.update.mock.calls[0][0].data;
			expect(data.area).toBeCloseTo(Math.PI * 1000 ** 2, 6);
			expect(data.geolocation).toEqual(circleCollection);
		});

		it("resets area to 0 when geolocation is cleared", async () => {
			await service.updateLocation({ id: "annex", geolocation: null });
			const data = mockPrisma.location.update.mock.calls[0][0].data;
			expect(data.area).toBe(0);
			expect(data.geolocation).toBeDefined();
		});

		it("leaves area untouched when geolocation is not part of the update", async () => {
			await service.updateLocation({ id: "annex", name: "Annex 2" });
			const data = mockPrisma.location.update.mock.calls[0][0].data;
			expect(data).not.toHaveProperty("area");
			expect(data).not.toHaveProperty("geolocation");
		});

		it("maps stored values and ignores non-GeoJSON JSON in the mapper", async () => {
			mockPrisma.location.findUnique.mockResolvedValue({
				...mockLocationRow,
				latitude: 10.5,
				area: 12.5,
				geolocation: { not: "a feature collection" },
			});
			const result = await service.findLocationById("loc-abc-001");
			expect(result).toMatchObject({
				latitude: 10.5,
				longitude: null,
				area: 12.5,
				geolocation: null,
			});
		});
	});

	describe("location input schemas", () => {
		const base = { name: "HQ" };

		it("strips a client-supplied area", () => {
			const parsed = Asset.createLocationSchema.parse({ ...base, area: 999 });
			expect(parsed).not.toHaveProperty("area");
			const updated = Asset.updateLocationSchema.parse({
				id: "ckxxxxxxxxxxxxxxxxxxxxxxx",
				area: 999,
			});
			expect(updated).not.toHaveProperty("area");
		});

		it("accepts latitude and longitude at the limits", () => {
			expect(
				Asset.createLocationSchema.safeParse({
					...base,
					latitude: -90,
					longitude: 180,
				}).success,
			).toBe(true);
		});

		it.each([
			[{ latitude: 90.1 }],
			[{ latitude: -91 }],
			[{ longitude: 180.5 }],
			[{ longitude: -181 }],
		])("rejects out-of-range coordinates %j", (coords) => {
			expect(
				Asset.createLocationSchema.safeParse({ ...base, ...coords }).success,
			).toBe(false);
		});

		it("accepts a valid FeatureCollection", () => {
			expect(
				Asset.createLocationSchema.safeParse({
					...base,
					geolocation: circleCollection,
				}).success,
			).toBe(true);
			expect(
				Asset.createLocationSchema.safeParse({
					...base,
					geolocation: { type: "FeatureCollection", features: [] },
				}).success,
			).toBe(true);
		});

		it.each([
			["a plain string", "nope"],
			["a bare Feature", { type: "Feature", properties: {}, geometry: null }],
			["missing features", { type: "FeatureCollection" }],
			["features not an array", { type: "FeatureCollection", features: {} }],
			[
				"a feature without geometry",
				{ type: "FeatureCollection", features: [{ type: "Feature" }] },
			],
			[
				"a polygon with bad coordinates",
				{
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							properties: {},
							geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
						},
					],
				},
			],
			[
				"a circle without a radius",
				{
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							properties: { point_type: "circle" },
							geometry: { type: "Point", coordinates: [0, 0] },
						},
					],
				},
			],
		])("rejects malformed GeoJSON: %s", (_label, geolocation) => {
			expect(
				Asset.createLocationSchema.safeParse({ ...base, geolocation }).success,
			).toBe(false);
		});
	});

	// -------------------------------------------------------------------------
	// Delete with children
	// -------------------------------------------------------------------------

	describe("deleteLocation with children", () => {
		it("blocks deleting a location that has child locations", async () => {
			mockPrisma.location.findUnique.mockResolvedValue({
				id: "floor",
				_count: { assets: 0, childLocations: 1 },
			});
			await expect(service.deleteLocation("floor")).rejects.toThrow(
				"Cannot delete a location that has child locations",
			);
			expect(mockPrisma.location.delete).not.toHaveBeenCalled();
		});

		it("still reports assets when there are no children", async () => {
			mockPrisma.location.findUnique.mockResolvedValue({
				id: "room",
				_count: { assets: 2, childLocations: 0 },
			});
			await expect(service.deleteLocation("room")).rejects.toThrow(
				"Cannot delete a location that is assigned to assets",
			);
		});
	});

	// -------------------------------------------------------------------------
	// Hierarchy API
	// -------------------------------------------------------------------------

	describe("getLocationTree", () => {
		const row = (
			id: string,
			name: string,
			parentLocationId: string | null,
			extra: Record<string, unknown> = {},
		) => ({
			id,
			name,
			parentLocationId,
			isGroup: true,
			isContainer: false,
			area: 0,
			_count: { assets: 0 },
			...extra,
		});

		const rows = [
			row("b", "Beta", "hq", { area: 5, _count: { assets: 2 } }),
			row("hq", "HQ", null, { area: 10, _count: { assets: 1 } }),
			row("a", "Alpha", "hq", { area: 7 }),
			row("leaf", "Room", "a", {
				isGroup: false,
				area: 3,
				_count: { assets: 4 },
			}),
			row("annex", "Annex", null),
		];

		it("assembles nested nodes ordered by name with counts and totals", async () => {
			mockPrisma.location.findMany.mockResolvedValue(rows);

			const tree = await service.getLocationTree();

			expect(mockPrisma.location.findMany).toHaveBeenCalledTimes(1);
			expect(tree.map((n) => n.name)).toEqual(["Annex", "HQ"]);
			const hq = tree[1];
			expect(hq.children.map((n) => n.name)).toEqual(["Alpha", "Beta"]);
			expect(hq).toMatchObject({
				childCount: 2,
				assetCount: 1,
				totalAssetCount: 7,
				area: 10,
				totalArea: 25,
			});
			expect(hq.children[0]).toMatchObject({
				childCount: 1,
				totalAssetCount: 4,
				totalArea: 10,
			});
		});

		it("returns a single subtree for rootId and omits leaves on request", async () => {
			mockPrisma.location.findMany.mockResolvedValue(rows);

			const [alpha] = await service.getLocationTree({
				rootId: "a",
				includeLeaves: false,
			});

			expect(alpha.name).toBe("Alpha");
			expect(alpha.children).toEqual([]);
			expect(alpha.childCount).toBe(1);
			expect(alpha.totalAssetCount).toBe(4);
		});

		it("throws NotFoundException for an unknown rootId", async () => {
			mockPrisma.location.findMany.mockResolvedValue(rows);
			await expect(
				service.getLocationTree({ rootId: "ghost" }),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("listLocationChildren", () => {
		const childRows = [
			{
				id: "g1",
				name: "Group with kids",
				isGroup: true,
				isContainer: false,
				area: 1,
				_count: { assets: 3, childLocations: 2 },
			},
			{
				id: "g2",
				name: "Empty group",
				isGroup: true,
				isContainer: true,
				area: 0,
				_count: { assets: 0, childLocations: 0 },
			},
			{
				id: "l1",
				name: "Leaf",
				isGroup: false,
				isContainer: false,
				area: 0,
				_count: { assets: 1, childLocations: 0 },
			},
		];

		it("returns roots when parentId is absent or null", async () => {
			mockPrisma.location.findMany.mockResolvedValue(childRows);

			await service.listLocationChildren();
			await service.listLocationChildren({ parentId: null });

			for (const call of mockPrisma.location.findMany.mock.calls) {
				expect(call[0].where).toEqual({ parentLocationId: null });
				expect(call[0].orderBy).toEqual({ name: "asc" });
			}
		});

		it("filters by parent id", async () => {
			mockPrisma.location.findMany.mockResolvedValue([]);
			await service.listLocationChildren({ parentId: "hq" });
			expect(mockPrisma.location.findMany.mock.calls[0][0].where).toEqual({
				parentLocationId: "hq",
			});
		});

		it("is expandable only for groups that have children", async () => {
			mockPrisma.location.findMany.mockResolvedValue(childRows);

			const result = await service.listLocationChildren();

			expect(result.map((r) => [r.id, r.expandable])).toEqual([
				["g1", true],
				["g2", false],
				["l1", false],
			]);
			expect(result[0]).toMatchObject({ assetCount: 3, childCount: 2 });
		});
	});

	describe("getLocationAncestors", () => {
		beforeEach(() => mockHierarchy(mockPrisma));

		it("returns the root-to-parent chain", async () => {
			const result = await service.getLocationAncestors("room");
			expect(result).toEqual([
				{ id: "hq", name: "HQ", isGroup: true },
				{ id: "floor", name: "Floor 1", isGroup: true },
			]);
		});

		it("returns an empty chain for a root", async () => {
			expect(await service.getLocationAncestors("hq")).toEqual([]);
		});

		it("throws NotFoundException for an unknown id", async () => {
			await expect(service.getLocationAncestors("ghost")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("findAllLocations hierarchy filters", () => {
		it("filters roots with parentLocationId null", async () => {
			mockPrisma.location.findMany.mockResolvedValue([]);
			mockPrisma.location.count.mockResolvedValue(0);

			await service.findAllLocations({ parentLocationId: null });

			expect(mockPrisma.location.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ where: { parentLocationId: null } }),
			);
		});

		it("excludes the location and its descendants", async () => {
			mockHierarchy(mockPrisma);
			mockPrisma.location.count.mockResolvedValue(0);

			await service.findAllLocations({ excludeDescendantsOf: "hq" });

			const listCall = mockPrisma.location.findMany.mock.calls.find(
				(call) => call[0].where,
			);
			const where = listCall?.[0].where as { id: { notIn: string[] } };
			expect([...where.id.notIn].sort()).toEqual(["floor", "hq", "room"]);
		});
	});
});
