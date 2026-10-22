/**
 * Asset Maintenance Team sub-service — CRUD for maintenance teams.
 *
 * Follows the ERPNext Asset Maintenance Team doctype.
 *
 * @module AssetMaintenanceTeamService
 */
import type { Asset } from "@aria/types";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import { toMaintenanceTeam } from "./asset.types";
import { LIST_TAKE_MAX } from "./asset-service.shared";

@Injectable()
export class AssetMaintenanceTeamService {
	private readonly logger = new Logger(AssetMaintenanceTeamService.name);

	constructor(private readonly prisma: PrismaService) {}

	async findAllMaintenanceTeams(
		params?: Asset.ListMaintenanceTeamsInput,
	): Promise<Asset.AssetMaintenanceTeamListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.company)
			where.company = { contains: params.company, mode: "insensitive" };
		if (params?.search) {
			where.OR = [
				{ name: { contains: params.search, mode: "insensitive" } },
				{
					maintenanceManager: { contains: params.search, mode: "insensitive" },
				},
				{
					maintenanceManagerName: {
						contains: params.search,
						mode: "insensitive",
					},
				},
				{ company: { contains: params.search, mode: "insensitive" } },
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.assetMaintenanceTeam.findMany({
				where,
				include: { members: { orderBy: { createdAt: "asc" } } },
				orderBy: { createdAt: "desc" },
				skip,
				take,
			}),
			this.prisma.assetMaintenanceTeam.count({ where }),
		]);

		return { items: items.map(toMaintenanceTeam), totalCount };
	}

	async findMaintenanceTeamById(
		id: string,
	): Promise<Asset.AssetMaintenanceTeam | null> {
		const team = await this.prisma.assetMaintenanceTeam.findUnique({
			where: { id },
			include: { members: { orderBy: { createdAt: "asc" } } },
		});
		return team ? toMaintenanceTeam(team) : null;
	}

	async createMaintenanceTeam(
		input: Asset.CreateAssetMaintenanceTeamInput,
	): Promise<Asset.AssetMaintenanceTeam> {
		const existing = await this.prisma.assetMaintenanceTeam.findUnique({
			where: { name: input.name },
			select: { id: true },
		});
		if (existing) {
			throw new BadRequestException(
				`A maintenance team with the name "${input.name}" already exists`,
			);
		}

		const team = await this.prisma.assetMaintenanceTeam.create({
			data: {
				name: input.name,
				maintenanceManager: input.maintenanceManager ?? null,
				maintenanceManagerName: input.maintenanceManagerName ?? null,
				company: input.company,
				members: {
					create: input.members.map((m) => ({
						teamMember: m.teamMember,
						fullName: m.fullName,
						maintenanceRole: m.maintenanceRole,
					})),
				},
			},
			include: { members: { orderBy: { createdAt: "asc" } } },
		});

		this.logger.log(`Created maintenance team "${team.name}"`);
		return toMaintenanceTeam(team);
	}

	async updateMaintenanceTeam(
		input: Asset.UpdateAssetMaintenanceTeamInput,
	): Promise<Asset.AssetMaintenanceTeam> {
		const existing = await this.prisma.assetMaintenanceTeam.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Maintenance team ${input.id} not found`);
		}

		if (input.name !== undefined) {
			const nameConflict = await this.prisma.assetMaintenanceTeam.findUnique({
				where: { name: input.name },
				select: { id: true },
			});
			if (nameConflict && nameConflict.id !== input.id) {
				throw new BadRequestException(
					`A maintenance team with the name "${input.name}" already exists`,
				);
			}
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			await tx.assetMaintenanceTeam.update({
				where: { id: input.id },
				data: {
					...(input.name !== undefined && { name: input.name }),
					...(input.maintenanceManager !== undefined && {
						maintenanceManager: input.maintenanceManager,
					}),
					...(input.maintenanceManagerName !== undefined && {
						maintenanceManagerName: input.maintenanceManagerName,
					}),
					...(input.company !== undefined && { company: input.company }),
				},
			});

			if (input.members !== undefined) {
				const keptIds = input.members
					.filter((m): m is typeof m & { id: string } => Boolean(m.id))
					.map((m) => m.id);

				if (keptIds.length > 0) {
					const owned = await tx.assetMaintenanceTeamMember.findMany({
						where: { id: { in: keptIds }, teamId: input.id },
						select: { id: true },
					});
					const ownedIds = new Set(owned.map((m) => m.id));
					const foreignId = keptIds.find((mid) => !ownedIds.has(mid));
					if (foreignId) {
						throw new BadRequestException(
							`Team member with ID ${foreignId} does not belong to this team`,
						);
					}
				}

				if (keptIds.length === 0) {
					await tx.assetMaintenanceTeamMember.deleteMany({
						where: { teamId: input.id },
					});
				} else {
					await tx.assetMaintenanceTeamMember.deleteMany({
						where: { teamId: input.id, id: { notIn: keptIds } },
					});
				}

				for (const member of input.members) {
					if (member.id) {
						await tx.assetMaintenanceTeamMember.update({
							where: { id: member.id },
							data: {
								teamMember: member.teamMember,
								fullName: member.fullName,
								maintenanceRole: member.maintenanceRole,
							},
						});
					} else {
						await tx.assetMaintenanceTeamMember.create({
							data: {
								teamId: input.id,
								teamMember: member.teamMember,
								fullName: member.fullName,
								maintenanceRole: member.maintenanceRole,
							},
						});
					}
				}
			}

			return tx.assetMaintenanceTeam.findUniqueOrThrow({
				where: { id: input.id },
				include: { members: { orderBy: { createdAt: "asc" } } },
			});
		});

		return toMaintenanceTeam(updated);
	}

	async deleteMaintenanceTeam(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.assetMaintenanceTeam.findUnique({
			where: { id },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Maintenance team ${id} not found`);
		}
		await this.prisma.assetMaintenanceTeam.delete({ where: { id } });
		return { success: true, id };
	}

	async deleteManyMaintenanceTeams(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const unique = [...new Set(ids)];
		const result = await this.prisma.assetMaintenanceTeam.deleteMany({
			where: { id: { in: unique } },
		});
		return { success: true, count: result.count, ids: unique };
	}
}
