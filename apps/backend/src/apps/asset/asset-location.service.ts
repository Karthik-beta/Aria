/**
 * Asset Location sub-service — CRUD, hierarchy API and validation for asset
 * locations, plus the employee lookup used by the custodian picker.
 *
 * Structure decision: locations keep the plain parent-id adjacency list
 * (`parentLocationId`). ERPNext's NestedSet `lft`/`rgt` columns are not
 * ported: location counts are small, so tree queries are a single `findMany`
 * of the needed columns assembled in memory (see `location-tree.ts`), and
 * cycle checks walk the proposed parent's ancestor chain over one such
 * query. Tree rules (no cycles, no children under a leaf, no delete with
 * children) are enforced here and, for deletes, by `onDelete: Restrict`.
 *
 * Port of the ERPNext `Location` doctype (`location.py`, GPLv3): the tree
 * rules come from Frappe NestedSet, `listLocationChildren` ports
 * `get_children`, and area is computed from GeoJSON (`location-area.ts`).
 * Unlike ERPNext, ancestors are not mutated; `totalArea` is rolled up when
 * the tree is read.
 *
 * @module AssetLocationService
 */
import type { Asset } from "@aria/types";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import { LOCATION_SELECT, toAssetLocation } from "./asset.types";
import { LIST_TAKE_MAX } from "./asset-service.shared";
import { computeArea } from "./location-area";
import {
	buildLocationTree,
	collectSubtreeIds,
	getAncestorIds,
	type LocationEdge,
	type LocationTreeRow,
	wouldCreateCycle,
} from "./location-tree";

@Injectable()
export class AssetLocationService {
	constructor(private readonly prisma: PrismaService) {}

	async findAllLocations(
		params?: Asset.ListLocationsInput,
	): Promise<Asset.LocationListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.isGroup !== undefined) where.isGroup = params.isGroup;
		if (params?.search) {
			where.name = { contains: params.search, mode: "insensitive" };
		}
		if (params?.parentLocationId !== undefined) {
			where.parentLocationId = params.parentLocationId;
		}
		if (params?.excludeDescendantsOf) {
			const edges = await this.loadEdges();
			where.id = {
				notIn: [...collectSubtreeIds(params.excludeDescendantsOf, edges)],
			};
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.location.findMany({
				where,
				select: LOCATION_SELECT,
				orderBy: { name: "asc" },
				skip,
				take,
			}),
			this.prisma.location.count({ where }),
		]);

		return { items: items.map(toAssetLocation), totalCount };
	}

	async findAllEmployees(
		params?: Asset.ListEmployeesInput,
	): Promise<Asset.EmployeeListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.status) where.status = params.status;
		if (params?.search) {
			where.OR = [
				{ employeeId: { contains: params.search, mode: "insensitive" } },
				{ employeeName: { contains: params.search, mode: "insensitive" } },
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.employee.findMany({
				where,
				select: {
					id: true,
					employeeId: true,
					employeeName: true,
					company: true,
					department: true,
					designation: true,
					status: true,
				},
				orderBy: { employeeName: "asc" },
				skip,
				take,
			}),
			this.prisma.employee.count({ where }),
		]);

		return { items, totalCount };
	}

	async findLocationById(id: string): Promise<Asset.Location | null> {
		const loc = await this.prisma.location.findUnique({
			where: { id },
			select: LOCATION_SELECT,
		});
		return loc ? toAssetLocation(loc) : null;
	}

	async createLocation(
		input: Asset.CreateLocationInput,
	): Promise<Asset.Location> {
		const existing = await this.prisma.location.findUnique({
			where: { name: input.name },
			select: { id: true },
		});
		if (existing) {
			throw new BadRequestException(
				`Location with name "${input.name}" already exists`,
			);
		}

		if (input.parentLocationId) {
			await this.validateParent(null, input.parentLocationId);
		}

		const loc = await this.prisma.location.create({
			data: {
				name: input.name,
				parentLocationId: input.parentLocationId ?? null,
				isGroup: input.isGroup ?? false,
				isContainer: input.isContainer ?? false,
				latitude: input.latitude ?? null,
				longitude: input.longitude ?? null,
				areaUom: input.areaUom || null,
				...this.geolocationData(input.geolocation),
			},
			select: LOCATION_SELECT,
		});
		return toAssetLocation(loc);
	}

	async updateLocation(
		input: Asset.UpdateLocationInput,
	): Promise<Asset.Location> {
		const existing = await this.prisma.location.findUnique({
			where: { id: input.id },
			select: { id: true, parentLocationId: true },
		});
		if (!existing)
			throw new NotFoundException(`Location ${input.id} not found`);

		// Only re-validate the parent when it actually changes, so unrelated
		// edits of legacy data (e.g. a rename) are not blocked.
		if (
			input.parentLocationId !== undefined &&
			input.parentLocationId !== existing.parentLocationId
		) {
			if (input.parentLocationId) {
				await this.validateParent(input.id, input.parentLocationId);
			}
		}

		if (input.isGroup === false) {
			const childCount = await this.prisma.location.count({
				where: { parentLocationId: input.id },
			});
			if (childCount > 0) {
				throw new BadRequestException(
					"Location cannot be a leaf node as it has children",
				);
			}
		}

		const loc = await this.prisma.location.update({
			where: { id: input.id },
			data: {
				...(input.name !== undefined && { name: input.name }),
				...(input.parentLocationId !== undefined && {
					parentLocationId: input.parentLocationId,
				}),
				...(input.isGroup !== undefined && { isGroup: input.isGroup }),
				...(input.isContainer !== undefined && {
					isContainer: input.isContainer,
				}),
				...(input.latitude !== undefined && { latitude: input.latitude }),
				...(input.longitude !== undefined && { longitude: input.longitude }),
				...(input.areaUom !== undefined && {
					areaUom: input.areaUom || null,
				}),
				...this.geolocationData(input.geolocation),
			},
			select: LOCATION_SELECT,
		});
		return toAssetLocation(loc);
	}

	async deleteLocation(id: string): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.location.findUnique({
			where: { id },
			select: {
				id: true,
				_count: { select: { assets: true, childLocations: true } },
			},
		});
		if (!existing) throw new NotFoundException(`Location ${id} not found`);
		if ((existing._count.childLocations ?? 0) > 0) {
			throw new BadRequestException(
				"Cannot delete a location that has child locations",
			);
		}
		if (existing._count.assets > 0) {
			throw new BadRequestException(
				"Cannot delete a location that is assigned to assets",
			);
		}
		await this.prisma.location.delete({ where: { id } });
		return { success: true, id };
	}

	// ── Hierarchy API ────────────────────────────────────────────────────────

	/**
	 * Nested location tree ordered by name, with direct and rolled-up asset
	 * counts and areas. One `findMany` assembled in memory.
	 */
	async getLocationTree(
		input?: Asset.LocationTreeInput,
	): Promise<Asset.LocationTreeNode[]> {
		const rows = await this.prisma.location.findMany({
			select: {
				id: true,
				name: true,
				parentLocationId: true,
				isGroup: true,
				isContainer: true,
				area: true,
				_count: { select: { assets: true } },
			},
		});

		if (input?.rootId && !rows.some((row) => row.id === input.rootId)) {
			throw new NotFoundException(`Location ${input.rootId} not found`);
		}

		const treeRows: LocationTreeRow[] = rows.map((row) => ({
			id: row.id,
			name: row.name,
			parentLocationId: row.parentLocationId ?? null,
			isGroup: row.isGroup,
			isContainer: row.isContainer ?? false,
			area: row.area ?? 0,
			assetCount: row._count?.assets ?? 0,
		}));

		return buildLocationTree(treeRows, {
			rootId: input?.rootId,
			includeLeaves: input?.includeLeaves,
		});
	}

	/**
	 * Direct children of `parentId` (`null`/absent = roots, ERPNext
	 * "All Locations") for lazy tree loading. Port of `get_children`.
	 */
	async listLocationChildren(
		input?: Asset.ListLocationChildrenInput,
	): Promise<Asset.LocationChildNode[]> {
		const rows = await this.prisma.location.findMany({
			where: { parentLocationId: input?.parentId ?? null },
			select: {
				id: true,
				name: true,
				isGroup: true,
				isContainer: true,
				area: true,
				_count: { select: { assets: true, childLocations: true } },
			},
			orderBy: { name: "asc" },
		});

		return rows.map((row) => {
			const childCount = row._count?.childLocations ?? 0;
			return {
				id: row.id,
				name: row.name,
				isGroup: row.isGroup,
				expandable: row.isGroup && childCount > 0,
				assetCount: row._count?.assets ?? 0,
				childCount,
				area: row.area ?? 0,
				isContainer: row.isContainer ?? false,
			};
		});
	}

	/** Root-to-parent chain of a location (excludes the location itself). */
	async getLocationAncestors(id: string): Promise<Asset.LocationAncestor[]> {
		const rows = await this.prisma.location.findMany({
			select: { id: true, name: true, isGroup: true, parentLocationId: true },
		});
		const byId = new Map(rows.map((row) => [row.id, row]));
		if (!byId.has(id)) throw new NotFoundException(`Location ${id} not found`);

		const parentById = new Map(
			rows.map((row) => [row.id, row.parentLocationId ?? null]),
		);
		const chain = getAncestorIds(parentById.get(id), parentById);
		return chain
			.reverse()
			.map((ancestorId) => byId.get(ancestorId))
			.filter((row) => row !== undefined)
			.map((row) => ({ id: row.id, name: row.name, isGroup: row.isGroup }));
	}

	// ── Validation helpers ───────────────────────────────────────────────────

	private async loadEdges(): Promise<LocationEdge[]> {
		const rows = await this.prisma.location.findMany({
			select: { id: true, parentLocationId: true },
		});
		return rows.map((row) => ({
			id: row.id,
			parentLocationId: row.parentLocationId ?? null,
		}));
	}

	/**
	 * NestedSet parent rules: the parent must exist and be a group, and a
	 * location can neither be its own parent nor sit below one of its own
	 * descendants. `locationId` is null when creating.
	 */
	private async validateParent(
		locationId: string | null,
		parentId: string,
	): Promise<void> {
		if (locationId && parentId === locationId) {
			throw new BadRequestException("A location cannot be its own parent");
		}

		const parent = await this.prisma.location.findUnique({
			where: { id: parentId },
			select: { id: true, name: true, isGroup: true },
		});
		if (!parent) {
			throw new BadRequestException(
				`Parent location ${parentId} does not exist`,
			);
		}
		if (!parent.isGroup) {
			throw new BadRequestException(
				`Parent location ${parent.name} is not a group`,
			);
		}

		if (locationId) {
			const edges = await this.loadEdges();
			if (wouldCreateCycle(locationId, parentId, edges)) {
				throw new BadRequestException(
					"A location cannot be a child of its own descendant",
				);
			}
		}
	}

	/**
	 * Prisma data for `geolocation` and the derived `area`. Only produced when
	 * the client supplied `geolocation`; `area` is never taken from input.
	 */
	private geolocationData(
		geolocation: Asset.GeoJsonFeatureCollection | null | undefined,
	): {
		geolocation?: Prisma.InputJsonValue | typeof Prisma.DbNull;
		area?: number;
	} {
		if (geolocation === undefined) return {};
		if (geolocation === null) {
			return { geolocation: Prisma.DbNull, area: 0 };
		}
		return {
			geolocation: geolocation as unknown as Prisma.InputJsonValue,
			area: computeArea(geolocation.features),
		};
	}
}
