import type { Inventory } from "@aria/types";
import type { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";

export class ItemActivityService {
	constructor(private readonly prisma: PrismaService) {}

	async logActivity(
		input: Inventory.CreateItemActivityLogInput,
	): Promise<Inventory.ItemActivityLogEntry> {
		const created = await this.prisma.itemActivityLog.create({
			data: {
				itemId: input.itemId,
				activityType: input.activityType,
				description: input.description,
				quantity: input.quantity ?? null,
				value: input.value ?? null,
				company: input.company ?? null,
				warehouse: input.warehouse ?? null,
				referenceType: input.referenceType ?? null,
				referenceId: input.referenceId ?? null,
				referenceName: input.referenceName ?? null,
				metadata:
					input.metadata == null
						? undefined
						: (JSON.parse(
								JSON.stringify(input.metadata),
							) as Prisma.InputJsonValue),
			},
		});

		return {
			id: created.id,
			itemId: created.itemId,
			activityType: created.activityType as Inventory.ItemActivityType,
			description: created.description,
			quantity: created.quantity,
			value: created.value,
			company: created.company,
			warehouse: created.warehouse,
			referenceType: created.referenceType,
			referenceId: created.referenceId,
			referenceName: created.referenceName,
			metadata: created.metadata as Record<string, unknown> | null,
			createdAt: created.createdAt,
		};
	}

	async getActivityForItem(
		params: Inventory.ListItemActivityInput,
	): Promise<Inventory.ItemActivityLogEntry[]> {
		const take = params.limit ?? 50;
		const skip = params.offset ?? 0;

		const where: Record<string, unknown> = { itemId: params.itemId };

		if (params.fromDate || params.toDate) {
			where.createdAt = {};
			if (params.fromDate) {
				(where.createdAt as Record<string, Date>).gte = params.fromDate;
			}
			if (params.toDate) {
				(where.createdAt as Record<string, Date>).lte = params.toDate;
			}
		}

		if (params.activityType) {
			where.activityType = params.activityType;
		}

		const entries = await this.prisma.itemActivityLog.findMany({
			where,
			orderBy: { createdAt: "desc" },
			take,
			skip,
		});

		return entries.map((entry) => ({
			id: entry.id,
			itemId: entry.itemId,
			activityType: entry.activityType as Inventory.ItemActivityType,
			description: entry.description,
			quantity: entry.quantity,
			value: entry.value,
			company: entry.company,
			warehouse: entry.warehouse,
			referenceType: entry.referenceType,
			referenceId: entry.referenceId,
			referenceName: entry.referenceName,
			metadata: entry.metadata as Record<string, unknown> | null,
			createdAt: entry.createdAt,
		}));
	}

	async deleteActivityForItem(
		itemId: string,
	): Promise<{ success: boolean; count: number }> {
		const result = await this.prisma.itemActivityLog.deleteMany({
			where: { itemId },
		});
		return { success: true, count: result.count };
	}
}
