/**
 * Asset Location sub-service — CRUD for asset locations plus the employee
 * lookup used by the custodian picker.
 *
 * @module AssetLocationService
 */
import type { Asset } from "@aria/types";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import { toAssetLocation } from "./asset.types";
import { LIST_TAKE_MAX } from "./asset-service.shared";

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

		const locationSelect = {
			id: true,
			name: true,
			parentLocationId: true,
			parentLocation: { select: { name: true } },
			isGroup: true,
			createdAt: true,
			updatedAt: true,
		} as const;

		const [items, totalCount] = await Promise.all([
			this.prisma.location.findMany({
				where,
				select: locationSelect,
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
			select: {
				id: true,
				name: true,
				parentLocationId: true,
				parentLocation: { select: { name: true } },
				isGroup: true,
				createdAt: true,
				updatedAt: true,
			},
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

		const locationSelectFields = {
			id: true,
			name: true,
			parentLocationId: true,
			parentLocation: { select: { name: true } },
			isGroup: true,
			createdAt: true,
			updatedAt: true,
		} as const;

		const loc = await this.prisma.location.create({
			data: {
				name: input.name,
				parentLocationId: input.parentLocationId ?? null,
				isGroup: input.isGroup ?? false,
			},
			select: locationSelectFields,
		});
		return toAssetLocation(loc);
	}

	async updateLocation(
		input: Asset.UpdateLocationInput,
	): Promise<Asset.Location> {
		const existing = await this.prisma.location.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!existing)
			throw new NotFoundException(`Location ${input.id} not found`);

		const loc = await this.prisma.location.update({
			where: { id: input.id },
			data: {
				...(input.name !== undefined && { name: input.name }),
				...(input.parentLocationId !== undefined && {
					parentLocationId: input.parentLocationId,
				}),
				...(input.isGroup !== undefined && { isGroup: input.isGroup }),
			},
			select: {
				id: true,
				name: true,
				parentLocationId: true,
				parentLocation: { select: { name: true } },
				isGroup: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		return toAssetLocation(loc);
	}

	async deleteLocation(id: string): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.location.findUnique({
			where: { id },
			select: { id: true, _count: { select: { assets: true } } },
		});
		if (!existing) throw new NotFoundException(`Location ${id} not found`);
		if (existing._count.assets > 0) {
			throw new BadRequestException(
				"Cannot delete a location that is assigned to assets",
			);
		}
		await this.prisma.location.delete({ where: { id } });
		return { success: true, id };
	}
}
