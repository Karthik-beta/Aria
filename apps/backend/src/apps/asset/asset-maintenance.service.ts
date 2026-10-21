/**
 * Asset Maintenance sub-service — maintenance schedules, tasks and logs.
 *
 * Follows the ERPNext Asset Maintenance and Asset Maintenance Log doctypes.
 *
 * @module AssetMaintenanceService
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
import {
	toAssetMaintenance,
	toAssetMaintenanceLog,
	toAssetMaintenanceLogListItem,
} from "./asset.types";
import { LIST_TAKE_MAX } from "./asset-service.shared";

@Injectable()
export class AssetMaintenanceService {
	private readonly logger = new Logger(AssetMaintenanceService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Calculates the next due date based on the periodicity and reference date.
	 *
	 * @remarks
	 * Mirrors ERPNext calculate_next_due_date:
	 * - Uses lastCompletionDate as base if it is more recent than startDate.
	 * - Returns null when the calculated date would exceed endDate or when
	 *   startDate >= endDate.
	 */
	calculateNextDueDate(
		periodicity: Asset.AssetMaintenancePeriodicity,
		startDate: Date,
		endDate: Date | null | undefined,
		lastCompletionDate: Date | null | undefined,
	): Date | null {
		const base =
			lastCompletionDate && lastCompletionDate > startDate
				? lastCompletionDate
				: startDate;

		if (endDate && base >= endDate) return null;

		let next: Date;
		const d = new Date(base);

		switch (periodicity) {
			case "DAILY":
				next = new Date(d.setDate(d.getDate() + 1));
				break;
			case "WEEKLY":
				next = new Date(d.setDate(d.getDate() + 7));
				break;
			case "MONTHLY":
				next = new Date(d.setMonth(d.getMonth() + 1));
				break;
			case "QUARTERLY":
				next = new Date(d.setMonth(d.getMonth() + 3));
				break;
			case "HALF_YEARLY":
				next = new Date(d.setMonth(d.getMonth() + 6));
				break;
			case "YEARLY":
				next = new Date(d.setFullYear(d.getFullYear() + 1));
				break;
			case "TWO_YEARLY":
				next = new Date(d.setFullYear(d.getFullYear() + 2));
				break;
			case "THREE_YEARLY":
				next = new Date(d.setFullYear(d.getFullYear() + 3));
				break;
			default:
				return null;
		}

		if (endDate && next >= endDate) return null;
		return next;
	}

	private readonly maintenanceInclude = {
		asset: {
			select: {
				assetName: true,
				itemCode: true,
				assetCategory: { select: { name: true } },
			},
		},
		maintenanceTeam: { select: { name: true } },
		tasks: { orderBy: { createdAt: "asc" as const } },
	};

	async findAllAssetMaintenances(
		params?: Asset.ListAssetMaintenancesInput,
	): Promise<Asset.AssetMaintenanceListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.company)
			where.company = { contains: params.company, mode: "insensitive" };
		if (params?.maintenanceTeamId)
			where.maintenanceTeamId = params.maintenanceTeamId;
		if (params?.status)
			where.tasks = { some: { maintenanceStatus: params.status } };
		if (params?.search) {
			where.OR = [
				{ company: { contains: params.search, mode: "insensitive" } },
				{
					asset: {
						assetName: { contains: params.search, mode: "insensitive" },
					},
				},
				{
					maintenanceTeam: {
						name: { contains: params.search, mode: "insensitive" },
					},
				},
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.assetMaintenance.findMany({
				where,
				include: this.maintenanceInclude,
				orderBy: { createdAt: "desc" },
				skip,
				take,
			}),
			this.prisma.assetMaintenance.count({ where }),
		]);

		return { items: items.map(toAssetMaintenance), totalCount };
	}

	async findAssetMaintenanceById(
		id: string,
	): Promise<Asset.AssetMaintenanceRecord | null> {
		const record = await this.prisma.assetMaintenance.findUnique({
			where: { id },
			include: this.maintenanceInclude,
		});
		return record ? toAssetMaintenance(record) : null;
	}

	async findAssetMaintenanceByAssetId(
		assetId: string,
	): Promise<Asset.AssetMaintenanceRecord | null> {
		const record = await this.prisma.assetMaintenance.findUnique({
			where: { assetId },
			include: this.maintenanceInclude,
		});
		return record ? toAssetMaintenance(record) : null;
	}

	async findAssetMaintenanceLogs(
		maintenanceId: string,
	): Promise<Asset.AssetMaintenanceLogItem[]> {
		const logs = await this.prisma.assetMaintenanceLog.findMany({
			where: { maintenanceId },
			orderBy: { createdAt: "desc" },
		});
		return logs.map(toAssetMaintenanceLog);
	}

	private readonly logWithContextInclude = {
		maintenance: {
			select: {
				id: true,
				assetId: true,
				company: true,
				asset: { select: { id: true, assetName: true } },
			},
		},
		task: {
			select: {
				id: true,
				maintenanceTask: true,
				maintenanceType: true,
				periodicity: true,
				assignToName: true,
				nextDueDate: true,
			},
		},
	} as const;

	async findAllAssetMaintenanceLogs(
		params?: Asset.ListAssetMaintenanceLogsInput,
	): Promise<Asset.AssetMaintenanceLogListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.maintenanceId) where.maintenanceId = params.maintenanceId;
		if (params?.status) where.maintenanceStatus = params.status;
		if (params?.search) {
			where.OR = [
				{
					maintenance: {
						asset: {
							assetName: {
								contains: params.search,
								mode: "insensitive",
							},
						},
					},
				},
				{
					task: {
						maintenanceTask: {
							contains: params.search,
							mode: "insensitive",
						},
					},
				},
				{
					maintenance: {
						company: {
							contains: params.search,
							mode: "insensitive",
						},
					},
				},
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.assetMaintenanceLog.findMany({
				where,
				include: this.logWithContextInclude,
				orderBy: { createdAt: "desc" },
				skip,
				take,
			}),
			this.prisma.assetMaintenanceLog.count({ where }),
		]);

		return {
			items: items.map(toAssetMaintenanceLogListItem),
			totalCount,
		};
	}

	async cancelAssetMaintenanceLog(
		input: Asset.CancelAssetMaintenanceLogInput,
	): Promise<Asset.AssetMaintenanceLogItem> {
		const log = await this.prisma.assetMaintenanceLog.findUnique({
			where: { id: input.logId },
			select: {
				id: true,
				taskId: true,
				maintenanceStatus: true,
			},
		});
		if (!log)
			throw new NotFoundException(`Maintenance log ${input.logId} not found`);
		if (log.maintenanceStatus === "COMPLETED") {
			throw new BadRequestException(
				"Cannot cancel a completed maintenance log",
			);
		}
		if (log.maintenanceStatus === "CANCELLED") {
			throw new BadRequestException("Maintenance log is already cancelled");
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			const cancelled = await tx.assetMaintenanceLog.update({
				where: { id: input.logId },
				data: { maintenanceStatus: "CANCELLED" },
			});

			await tx.assetMaintenanceTask.update({
				where: { id: log.taskId },
				data: { maintenanceStatus: "CANCELLED" },
			});

			return cancelled;
		});

		return toAssetMaintenanceLog(updated);
	}

	async createAssetMaintenance(
		input: Asset.CreateAssetMaintenanceInput,
	): Promise<Asset.AssetMaintenanceRecord> {
		// Verify asset exists and is not already assigned to a maintenance record
		const asset = await this.prisma.asset.findUnique({
			where: { id: input.assetId },
			select: {
				id: true,
				assetName: true,
				itemCode: true,
				maintenance: { select: { id: true } },
			},
		});
		if (!asset) throw new NotFoundException(`Asset ${input.assetId} not found`);
		if (asset.maintenance) {
			throw new BadRequestException(
				`Asset "${asset.assetName}" already has a maintenance record`,
			);
		}

		// Verify team exists
		const team = await this.prisma.assetMaintenanceTeam.findUnique({
			where: { id: input.maintenanceTeamId },
			select: { id: true },
		});
		if (!team) {
			throw new NotFoundException(
				`Maintenance team ${input.maintenanceTeamId} not found`,
			);
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Validate tasks
		for (const task of input.tasks) {
			if (task.endDate && task.startDate >= task.endDate) {
				throw new BadRequestException(
					`Start date must be before end date for task "${task.maintenanceTask}"`,
				);
			}
		}

		const maintenance = await this.prisma.$transaction(async (tx) => {
			const created = await tx.assetMaintenance.create({
				data: {
					assetId: input.assetId,
					company: input.company,
					maintenanceTeamId: input.maintenanceTeamId,
					maintenanceManager: input.maintenanceManager ?? null,
					maintenanceManagerName: input.maintenanceManagerName ?? null,
				},
			});

			for (const taskInput of input.tasks) {
				const nextDueDate =
					taskInput.nextDueDate ??
					this.calculateNextDueDate(
						taskInput.periodicity,
						taskInput.startDate,
						taskInput.endDate ?? null,
						taskInput.lastCompletionDate ?? null,
					);

				const isOverdue = nextDueDate && nextDueDate < today;
				const status = isOverdue ? "OVERDUE" : taskInput.maintenanceStatus;

				const task = await tx.assetMaintenanceTask.create({
					data: {
						maintenanceId: created.id,
						maintenanceTask: taskInput.maintenanceTask,
						maintenanceType: taskInput.maintenanceType ?? null,
						maintenanceStatus: status,
						startDate: taskInput.startDate,
						periodicity: taskInput.periodicity,
						endDate: taskInput.endDate ?? null,
						certificateRequired: taskInput.certificateRequired ?? false,
						assignTo: taskInput.assignTo ?? null,
						assignToName: taskInput.assignToName ?? null,
						nextDueDate: nextDueDate ?? null,
						lastCompletionDate: taskInput.lastCompletionDate ?? null,
						description: taskInput.description ?? null,
					},
				});

				// Create initial maintenance log for this task
				await tx.assetMaintenanceLog.create({
					data: {
						maintenanceId: created.id,
						taskId: task.id,
						maintenanceStatus: isOverdue ? "OVERDUE" : "PLANNED",
					},
				});
			}

			return tx.assetMaintenance.findUniqueOrThrow({
				where: { id: created.id },
				include: this.maintenanceInclude,
			});
		});

		this.logger.log(`Created asset maintenance for asset ${input.assetId}`);
		return toAssetMaintenance(maintenance);
	}

	async updateAssetMaintenance(
		input: Asset.UpdateAssetMaintenanceInput,
	): Promise<Asset.AssetMaintenanceRecord> {
		const existing = await this.prisma.assetMaintenance.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Asset maintenance ${input.id} not found`);
		}

		if (input.maintenanceTeamId !== undefined) {
			const team = await this.prisma.assetMaintenanceTeam.findUnique({
				where: { id: input.maintenanceTeamId },
				select: { id: true },
			});
			if (!team) {
				throw new NotFoundException(
					`Maintenance team ${input.maintenanceTeamId} not found`,
				);
			}
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		if (input.tasks) {
			for (const task of input.tasks) {
				if (task.endDate && task.startDate >= task.endDate) {
					throw new BadRequestException(
						`Start date must be before end date for task "${task.maintenanceTask}"`,
					);
				}
			}
		}

		const maintenance = await this.prisma.$transaction(async (tx) => {
			await tx.assetMaintenance.update({
				where: { id: input.id },
				data: {
					...(input.company !== undefined && { company: input.company }),
					...(input.maintenanceTeamId !== undefined && {
						maintenanceTeamId: input.maintenanceTeamId,
					}),
					...(input.maintenanceManager !== undefined && {
						maintenanceManager: input.maintenanceManager,
					}),
					...(input.maintenanceManagerName !== undefined && {
						maintenanceManagerName: input.maintenanceManagerName,
					}),
				},
			});

			if (input.tasks !== undefined) {
				const keptIds = input.tasks
					.filter((t): t is typeof t & { id: string } => Boolean(t.id))
					.map((t) => t.id);

				// Verify kept task IDs belong to this maintenance record
				if (keptIds.length > 0) {
					const ownedTasks = await tx.assetMaintenanceTask.findMany({
						where: { id: { in: keptIds }, maintenanceId: input.id },
						select: { id: true },
					});
					const ownedIds = new Set(ownedTasks.map((t) => t.id));
					const foreignId = keptIds.find((tid) => !ownedIds.has(tid));
					if (foreignId) {
						throw new BadRequestException(
							`Task with ID ${foreignId} does not belong to this maintenance record`,
						);
					}
				}

				// Identify removed tasks and cancel their open logs
				const removedTasks =
					keptIds.length === 0
						? await tx.assetMaintenanceTask.findMany({
								where: { maintenanceId: input.id },
								select: { id: true },
							})
						: await tx.assetMaintenanceTask.findMany({
								where: { maintenanceId: input.id, id: { notIn: keptIds } },
								select: { id: true },
							});

				for (const rt of removedTasks) {
					await tx.assetMaintenanceLog.updateMany({
						where: {
							taskId: rt.id,
							maintenanceStatus: { in: ["PLANNED", "OVERDUE"] },
						},
						data: { maintenanceStatus: "CANCELLED" },
					});
				}

				if (keptIds.length === 0) {
					await tx.assetMaintenanceTask.deleteMany({
						where: { maintenanceId: input.id },
					});
				} else {
					await tx.assetMaintenanceTask.deleteMany({
						where: { maintenanceId: input.id, id: { notIn: keptIds } },
					});
				}

				for (const taskInput of input.tasks) {
					const nextDueDate =
						taskInput.nextDueDate ??
						this.calculateNextDueDate(
							taskInput.periodicity,
							taskInput.startDate,
							taskInput.endDate ?? null,
							taskInput.lastCompletionDate ?? null,
						);

					const isOverdue = nextDueDate && nextDueDate < today;
					const status = isOverdue ? "OVERDUE" : taskInput.maintenanceStatus;

					if (taskInput.id) {
						// Update existing task
						await tx.assetMaintenanceTask.update({
							where: { id: taskInput.id },
							data: {
								maintenanceTask: taskInput.maintenanceTask,
								maintenanceType: taskInput.maintenanceType ?? null,
								maintenanceStatus: status,
								startDate: taskInput.startDate,
								periodicity: taskInput.periodicity,
								endDate: taskInput.endDate ?? null,
								certificateRequired: taskInput.certificateRequired ?? false,
								assignTo: taskInput.assignTo ?? null,
								assignToName: taskInput.assignToName ?? null,
								nextDueDate: nextDueDate ?? null,
								lastCompletionDate: taskInput.lastCompletionDate ?? null,
								description: taskInput.description ?? null,
							},
						});

						// Ensure there is an open log for this task; create if missing
						const openLog = await tx.assetMaintenanceLog.findFirst({
							where: {
								taskId: taskInput.id,
								maintenanceStatus: { in: ["PLANNED", "OVERDUE"] },
							},
						});
						if (!openLog) {
							await tx.assetMaintenanceLog.create({
								data: {
									maintenanceId: input.id,
									taskId: taskInput.id,
									maintenanceStatus: isOverdue ? "OVERDUE" : "PLANNED",
								},
							});
						} else {
							await tx.assetMaintenanceLog.update({
								where: { id: openLog.id },
								data: { maintenanceStatus: isOverdue ? "OVERDUE" : "PLANNED" },
							});
						}
					} else {
						// Create new task
						const newTask = await tx.assetMaintenanceTask.create({
							data: {
								maintenanceId: input.id,
								maintenanceTask: taskInput.maintenanceTask,
								maintenanceType: taskInput.maintenanceType ?? null,
								maintenanceStatus: status,
								startDate: taskInput.startDate,
								periodicity: taskInput.periodicity,
								endDate: taskInput.endDate ?? null,
								certificateRequired: taskInput.certificateRequired ?? false,
								assignTo: taskInput.assignTo ?? null,
								assignToName: taskInput.assignToName ?? null,
								nextDueDate: nextDueDate ?? null,
								lastCompletionDate: taskInput.lastCompletionDate ?? null,
								description: taskInput.description ?? null,
							},
						});

						await tx.assetMaintenanceLog.create({
							data: {
								maintenanceId: input.id,
								taskId: newTask.id,
								maintenanceStatus: isOverdue ? "OVERDUE" : "PLANNED",
							},
						});
					}
				}
			}

			return tx.assetMaintenance.findUniqueOrThrow({
				where: { id: input.id },
				include: this.maintenanceInclude,
			});
		});

		return toAssetMaintenance(maintenance);
	}

	async deleteAssetMaintenance(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.assetMaintenance.findUnique({
			where: { id },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Asset maintenance ${id} not found`);
		}
		await this.prisma.assetMaintenance.delete({ where: { id } });
		return { success: true, id };
	}

	async deleteManyAssetMaintenances(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const unique = [...new Set(ids)];
		const result = await this.prisma.assetMaintenance.deleteMany({
			where: { id: { in: unique } },
		});
		return { success: true, count: result.count, ids: unique };
	}

	async completeAssetMaintenanceLog(
		input: Asset.CompleteAssetMaintenanceLogInput,
	): Promise<Asset.AssetMaintenanceLogItem> {
		const log = await this.prisma.assetMaintenanceLog.findUnique({
			where: { id: input.logId },
			select: {
				id: true,
				maintenanceId: true,
				taskId: true,
				maintenanceStatus: true,
			},
		});
		if (!log)
			throw new NotFoundException(`Maintenance log ${input.logId} not found`);
		if (log.maintenanceStatus === "COMPLETED") {
			throw new BadRequestException("Maintenance log is already completed");
		}
		if (log.maintenanceStatus === "CANCELLED") {
			throw new BadRequestException(
				"Cannot complete a cancelled maintenance log",
			);
		}

		const updatedLog = await this.prisma.$transaction(async (tx) => {
			// Mark log as completed
			const completed = await tx.assetMaintenanceLog.update({
				where: { id: input.logId },
				data: {
					maintenanceStatus: "COMPLETED",
					completionDate: input.completionDate,
					actionsPerformed: input.actionsPerformed ?? null,
					hasCertificate: input.hasCertificate ?? false,
					certificateAttachment: input.certificateAttachment ?? null,
				},
			});

			// Update task's lastCompletionDate and recalculate nextDueDate
			const task = await tx.assetMaintenanceTask.findUniqueOrThrow({
				where: { id: log.taskId },
			});

			const newNextDueDate = this.calculateNextDueDate(
				task.periodicity as Asset.AssetMaintenancePeriodicity,
				task.startDate,
				task.endDate ?? null,
				input.completionDate,
			);

			await tx.assetMaintenanceTask.update({
				where: { id: log.taskId },
				data: {
					lastCompletionDate: input.completionDate,
					nextDueDate: newNextDueDate ?? null,
					maintenanceStatus: newNextDueDate ? "PLANNED" : "CANCELLED",
				},
			});

			// Create next open log if there is a next due date
			if (newNextDueDate) {
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				await tx.assetMaintenanceLog.create({
					data: {
						maintenanceId: log.maintenanceId,
						taskId: log.taskId,
						maintenanceStatus: newNextDueDate < today ? "OVERDUE" : "PLANNED",
					},
				});
			}

			return completed;
		});

		return toAssetMaintenanceLog(updatedLog);
	}
}
