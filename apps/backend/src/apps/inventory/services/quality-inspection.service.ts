/**
 * Quality inspection sub-service.
 *
 * Manages QI parameter groups, individual QI parameters, and QI
 * templates used for goods-receipt quality checks.
 *
 * @module QualityInspectionSubService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/quality-inspection | ERPNext Quality Inspection}
 */
import type { Inventory } from "@aria/types";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	toInventoryQiParameter,
	toInventoryQiParameterGroup,
	toInventoryQiTemplate,
} from "../inventory.types";

export class QualityInspectionSubService {
	constructor(private readonly prisma: PrismaService) {}

	// ─── Quality Inspection Parameter Groups ──────────────────────────────────

	async findAllQiParameterGroups(): Promise<Inventory.QiParameterGroup[]> {
		const groups = await this.prisma.qiParameterGroup.findMany({
			orderBy: { name: "asc" },
		});
		return groups.map(toInventoryQiParameterGroup);
	}

	async createQiParameterGroup(data: {
		name: string;
	}): Promise<Inventory.QiParameterGroup> {
		const existing = await this.prisma.qiParameterGroup.findUnique({
			where: { name: data.name },
		});
		if (existing) {
			throw new ConflictException(
				`A parameter group named "${data.name}" already exists`,
			);
		}
		const created = await this.prisma.qiParameterGroup.create({
			data: { name: data.name },
		});
		return toInventoryQiParameterGroup(created);
	}

	async updateQiParameterGroup(data: {
		id: string;
		name: string;
	}): Promise<Inventory.QiParameterGroup> {
		const existing = await this.prisma.qiParameterGroup.findUnique({
			where: { id: data.id },
		});
		if (!existing) {
			throw new NotFoundException(
				`QI parameter group with id "${data.id}" not found`,
			);
		}
		const duplicate = await this.prisma.qiParameterGroup.findFirst({
			where: { name: data.name, id: { not: data.id } },
		});
		if (duplicate) {
			throw new ConflictException(
				`A parameter group named "${data.name}" already exists`,
			);
		}
		const updated = await this.prisma.qiParameterGroup.update({
			where: { id: data.id },
			data: { name: data.name },
		});
		return toInventoryQiParameterGroup(updated);
	}

	async deleteQiParameterGroup(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.qiParameterGroup.findUnique({
			where: { id },
		});
		if (!existing) {
			throw new NotFoundException(
				`QI parameter group with id "${id}" not found`,
			);
		}
		await this.prisma.qiParameterGroup.delete({ where: { id } });
		return { success: true, id };
	}

	// ─── Quality Inspection Parameters ───────────────────────────────────────

	async findAllQiParameters(params?: {
		search?: string;
		groupId?: string;
	}): Promise<Inventory.QiParameter[]> {
		const parameters = await this.prisma.qiParameter.findMany({
			where: {
				...(params?.search && {
					parameter: { contains: params.search, mode: "insensitive" },
				}),
				...(params?.groupId !== undefined && { groupId: params.groupId }),
			},
			include: { group: true },
			orderBy: { parameter: "asc" },
		});
		return parameters.map(toInventoryQiParameter);
	}

	async findQiParameterById(id: string): Promise<Inventory.QiParameter | null> {
		const p = await this.prisma.qiParameter.findUnique({
			where: { id },
			include: { group: true },
		});
		return p ? toInventoryQiParameter(p) : null;
	}

	async createQiParameter(data: {
		parameter: string;
		description?: string | null;
		groupId?: string | null;
	}): Promise<Inventory.QiParameter> {
		const existing = await this.prisma.qiParameter.findUnique({
			where: { parameter: data.parameter },
		});
		if (existing) {
			throw new ConflictException(
				`A parameter named "${data.parameter}" already exists`,
			);
		}
		if (data.groupId) {
			const group = await this.prisma.qiParameterGroup.findUnique({
				where: { id: data.groupId },
			});
			if (!group) {
				throw new NotFoundException(
					`QI parameter group with id "${data.groupId}" not found`,
				);
			}
		}
		const created = await this.prisma.qiParameter.create({
			data: {
				parameter: data.parameter,
				description: data.description ?? null,
				groupId: data.groupId ?? null,
			},
			include: { group: true },
		});
		return toInventoryQiParameter(created);
	}

	async updateQiParameter(data: {
		id: string;
		parameter?: string;
		description?: string | null;
		groupId?: string | null;
	}): Promise<Inventory.QiParameter> {
		const existing = await this.prisma.qiParameter.findUnique({
			where: { id: data.id },
		});
		if (!existing) {
			throw new NotFoundException(
				`QI parameter with id "${data.id}" not found`,
			);
		}
		if (data.parameter && data.parameter !== existing.parameter) {
			const duplicate = await this.prisma.qiParameter.findUnique({
				where: { parameter: data.parameter },
			});
			if (duplicate) {
				throw new ConflictException(
					`A parameter named "${data.parameter}" already exists`,
				);
			}
		}
		if (data.groupId) {
			const group = await this.prisma.qiParameterGroup.findUnique({
				where: { id: data.groupId },
			});
			if (!group) {
				throw new NotFoundException(
					`QI parameter group with id "${data.groupId}" not found`,
				);
			}
		}
		const updated = await this.prisma.qiParameter.update({
			where: { id: data.id },
			data: {
				...(data.parameter != null && { parameter: data.parameter }),
				...(data.description !== undefined && {
					description: data.description,
				}),
				...(data.groupId !== undefined && { groupId: data.groupId }),
			},
			include: { group: true },
		});
		return toInventoryQiParameter(updated);
	}

	async deleteQiParameter(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.qiParameter.findUnique({
			where: { id },
		});
		if (!existing) {
			throw new NotFoundException(`QI parameter with id "${id}" not found`);
		}
		await this.prisma.qiParameter.delete({ where: { id } });
		return { success: true, id };
	}

	// ─── Quality Inspection Templates ─────────────────────────────────────────

	async findAllQiTemplates(params?: {
		search?: string;
		skip?: number;
		take?: number;
	}): Promise<Inventory.QiTemplate[]> {
		const templates = await this.prisma.qiTemplate.findMany({
			where: params?.search
				? { name: { contains: params.search, mode: "insensitive" } }
				: undefined,
			include: {
				items: {
					include: { parameter: { include: { group: true } } },
					orderBy: { sortOrder: "asc" },
				},
			},
			orderBy: { name: "asc" },
			skip: params?.skip,
			take: params?.take,
		});
		return templates.map(toInventoryQiTemplate);
	}

	async findQiTemplateById(id: string): Promise<Inventory.QiTemplate | null> {
		const t = await this.prisma.qiTemplate.findUnique({
			where: { id },
			include: {
				items: {
					include: { parameter: { include: { group: true } } },
					orderBy: { sortOrder: "asc" },
				},
			},
		});
		return t ? toInventoryQiTemplate(t) : null;
	}

	async createQiTemplate(data: {
		name: string;
		items: Array<{
			parameterId: string;
			sortOrder?: number;
			numeric?: boolean;
			formulaBased?: boolean;
			value?: string | null;
			minValue?: number | null;
			maxValue?: number | null;
			acceptanceFormula?: string | null;
		}>;
	}): Promise<Inventory.QiTemplate> {
		const existing = await this.prisma.qiTemplate.findUnique({
			where: { name: data.name },
		});
		if (existing) {
			throw new ConflictException(
				`A template named "${data.name}" already exists`,
			);
		}
		// Validate all parameters exist
		const paramIds = [...new Set(data.items.map((i) => i.parameterId))];
		const foundParams = await this.prisma.qiParameter.findMany({
			where: { id: { in: paramIds } },
			select: { id: true },
		});
		if (foundParams.length !== paramIds.length) {
			const missing = paramIds.filter(
				(id) => !foundParams.some((p) => p.id === id),
			);
			throw new NotFoundException(
				`QI parameters not found: ${missing.join(", ")}`,
			);
		}
		const template = await this.prisma.qiTemplate.create({
			data: {
				name: data.name,
				items: {
					create: data.items.map((item, idx) => ({
						parameterId: item.parameterId,
						sortOrder: item.sortOrder ?? idx,
						numeric: item.numeric ?? true,
						formulaBased: item.formulaBased ?? false,
						value: item.value ?? null,
						minValue: item.minValue ?? null,
						maxValue: item.maxValue ?? null,
						acceptanceFormula: item.acceptanceFormula ?? null,
					})),
				},
			},
			include: {
				items: {
					include: { parameter: { include: { group: true } } },
					orderBy: { sortOrder: "asc" },
				},
			},
		});
		return toInventoryQiTemplate(template);
	}

	async updateQiTemplate(data: {
		id: string;
		name?: string;
		items?: Array<{
			id?: string;
			parameterId: string;
			sortOrder?: number;
			numeric?: boolean;
			formulaBased?: boolean;
			value?: string | null;
			minValue?: number | null;
			maxValue?: number | null;
			acceptanceFormula?: string | null;
		}>;
	}): Promise<Inventory.QiTemplate> {
		const existing = await this.prisma.qiTemplate.findUnique({
			where: { id: data.id },
		});
		if (!existing) {
			throw new NotFoundException(`QI template with id "${data.id}" not found`);
		}
		if (data.name && data.name !== existing.name) {
			const duplicate = await this.prisma.qiTemplate.findUnique({
				where: { name: data.name },
			});
			if (duplicate) {
				throw new ConflictException(
					`A template named "${data.name}" already exists`,
				);
			}
		}
		if (data.items) {
			const paramIds = [...new Set(data.items.map((i) => i.parameterId))];
			const foundParams = await this.prisma.qiParameter.findMany({
				where: { id: { in: paramIds } },
				select: { id: true },
			});
			if (foundParams.length !== paramIds.length) {
				const missing = paramIds.filter(
					(id) => !foundParams.some((p) => p.id === id),
				);
				throw new NotFoundException(
					`QI parameters not found: ${missing.join(", ")}`,
				);
			}
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			if (data.name) {
				await tx.qiTemplate.update({
					where: { id: data.id },
					data: { name: data.name },
				});
			}
			if (data.items) {
				await tx.qiTemplateItem.deleteMany({
					where: { templateId: data.id },
				});
				await tx.qiTemplateItem.createMany({
					data: data.items.map((item, idx) => ({
						templateId: data.id,
						parameterId: item.parameterId,
						sortOrder: item.sortOrder ?? idx,
						numeric: item.numeric ?? true,
						formulaBased: item.formulaBased ?? false,
						value: item.value ?? null,
						minValue: item.minValue ?? null,
						maxValue: item.maxValue ?? null,
						acceptanceFormula: item.acceptanceFormula ?? null,
					})),
				});
			}
			return tx.qiTemplate.findUniqueOrThrow({
				where: { id: data.id },
				include: {
					items: {
						include: { parameter: { include: { group: true } } },
						orderBy: { sortOrder: "asc" },
					},
				},
			});
		});

		return toInventoryQiTemplate(updated);
	}

	async deleteQiTemplate(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.qiTemplate.findUnique({
			where: { id },
		});
		if (!existing) {
			throw new NotFoundException(`QI template with id "${id}" not found`);
		}
		await this.prisma.qiTemplate.delete({ where: { id } });
		return { success: true, id };
	}

	async deleteManyQiTemplates(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const uniqueIds = [...new Set(ids)];
		const result = await this.prisma.qiTemplate.deleteMany({
			where: { id: { in: uniqueIds } },
		});
		return { success: true, count: result.count, ids: uniqueIds };
	}
}
