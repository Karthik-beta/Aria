import type { Asset } from "@aria/types";
import {
	buildDepreciationSchedulePreview,
	buildRevaluationEntryLines,
	deriveFixedAssetAccount,
	getAssetValueAdjustmentDirection,
	getAssetValueAdjustmentResultState,
} from "../../src/apps/asset/asset-value-adjustment.utils.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
	ASSET_CATEGORIES,
	ASSET_MAINTENANCE_TEAMS,
	ASSET_REGISTER,
	type AssetSeedDef,
} from "./asset-data.js";
import type { DemoConfig } from "./config.js";
import type { MasterIds } from "./seed-master.js";

type EffectiveAssetState = {
	currentAssetValue: number;
	status: Asset.AssetStatus;
	isFullyDepreciated: boolean;
	activeSchedule: {
		id: string;
		revisionNumber: number;
	} | null;
};

function resolveRelativeDate(
	config: DemoConfig,
	offsetDays: number,
	hour = 10,
	minute = 0,
): Date {
	const date = new Date(config.dateRange.from);
	date.setDate(date.getDate() + offsetDays);
	date.setHours(hour, minute, 0, 0);
	return date;
}

function resolveActivityTimestamp(
	config: DemoConfig,
	offsetDays: number,
	sequence: number,
): Date {
	const date = resolveRelativeDate(config, offsetDays, 9, 0);
	date.setMinutes(date.getMinutes() + sequence * 7);
	return date;
}

function calculateNextDueDate(
	periodicity: Asset.AssetMaintenancePeriodicity,
	startDate: Date,
	endDate: Date | null | undefined,
	lastCompletionDate: Date | null | undefined,
): Date | null {
	const base =
		lastCompletionDate && lastCompletionDate > startDate
			? lastCompletionDate
			: startDate;

	if (endDate && base >= endDate) {
		return null;
	}

	let next: Date;
	const value = new Date(base);

	switch (periodicity) {
		case "DAILY":
			next = new Date(value.setDate(value.getDate() + 1));
			break;
		case "WEEKLY":
			next = new Date(value.setDate(value.getDate() + 7));
			break;
		case "MONTHLY":
			next = new Date(value.setMonth(value.getMonth() + 1));
			break;
		case "QUARTERLY":
			next = new Date(value.setMonth(value.getMonth() + 3));
			break;
		case "HALF_YEARLY":
			next = new Date(value.setMonth(value.getMonth() + 6));
			break;
		case "YEARLY":
			next = new Date(value.setFullYear(value.getFullYear() + 1));
			break;
		case "TWO_YEARLY":
			next = new Date(value.setFullYear(value.getFullYear() + 2));
			break;
		case "THREE_YEARLY":
			next = new Date(value.setFullYear(value.getFullYear() + 3));
			break;
		default:
			return null;
	}

	if (endDate && next >= endDate) {
		return null;
	}

	return next;
}

function getCurrentAssetValue(asset: AssetSeedDef): number {
	return Math.max(
		asset.netPurchaseAmount - (asset.openingAccumulatedDepreciation ?? 0),
		0,
	);
}

function getCategoryDefaults(assetCategoryName: string) {
	const category = ASSET_CATEGORIES.find(
		(value) => value.name === assetCategoryName,
	);
	if (!category) {
		throw new Error(
			`Asset category "${assetCategoryName}" is not defined in asset-data.ts`,
		);
	}
	return category;
}

function buildInitialState(asset: AssetSeedDef): EffectiveAssetState {
	return {
		currentAssetValue: getCurrentAssetValue(asset),
		status:
			asset.status === "PARTIALLY_DEPRECIATED" ||
			asset.status === "FULLY_DEPRECIATED"
				? "SUBMITTED"
				: asset.status,
		isFullyDepreciated:
			asset.isFullyDepreciated ?? getCurrentAssetValue(asset) <= 0,
		activeSchedule: null,
	};
}

function buildAdjustmentSeries(
	prefix: string,
	date: Date,
	counters: Map<number, number>,
): string {
	const year = date.getFullYear();
	const next = (counters.get(year) ?? 0) + 1;
	counters.set(year, next);
	return `${prefix}-${year}-${String(next).padStart(5, "0")}`;
}

function getScheduleCreatedAt(scheduleDate: Date, sequence: number): Date {
	const createdAt = new Date(scheduleDate);
	createdAt.setHours(8, sequence, 0, 0);
	return createdAt;
}

async function createAssetActivity(
	prisma: PrismaClient,
	assetId: string,
	activity: string,
	createdAt: Date,
): Promise<void> {
	await prisma.assetActivity.create({
		data: {
			assetId,
			activity,
			createdAt,
			updatedAt: createdAt,
		},
	});
}

async function seedMaintenanceRecord(
	prisma: PrismaClient,
	config: DemoConfig,
	ids: MasterIds,
	assetId: string,
	asset: AssetSeedDef,
	sequenceBase: number,
): Promise<number> {
	if (!asset.maintenancePlan) {
		return sequenceBase;
	}

	const team = ASSET_MAINTENANCE_TEAMS.find(
		(value) => value.key === asset.maintenancePlan?.teamKey,
	);
	if (!team) {
		throw new Error(
			`Maintenance team key "${asset.maintenancePlan.teamKey}" is not defined in asset-data.ts`,
		);
	}

	const maintenanceCreatedAt = resolveRelativeDate(
		config,
		asset.maintenancePlan.tasks[0]?.startOffsetDays ?? asset.purchaseOffsetDays,
		8,
		45,
	);
	const maintenance = await prisma.assetMaintenance.create({
		data: {
			assetId,
			company: config.company,
			maintenanceTeamId:
				ids.assetMaintenanceTeamIds.get(asset.maintenancePlan.teamKey) ?? null,
			maintenanceManager: team.maintenanceManager,
			maintenanceManagerName: team.maintenanceManagerName,
			createdAt: maintenanceCreatedAt,
			updatedAt: maintenanceCreatedAt,
		},
	});

	const today = new Date(config.dateRange.to);
	today.setHours(0, 0, 0, 0);

	let activitySequence = sequenceBase;

	for (const taskSeed of asset.maintenancePlan.tasks) {
		activitySequence += 1;
		const startDate = resolveRelativeDate(
			config,
			taskSeed.startOffsetDays,
			8,
			30,
		);
		const endDate =
			taskSeed.endOffsetDays === undefined || taskSeed.endOffsetDays === null
				? null
				: resolveRelativeDate(config, taskSeed.endOffsetDays, 18, 0);
		const completions = [...(taskSeed.completions ?? [])].sort(
			(left, right) => left.offsetDays - right.offsetDays,
		);
		const lastCompletion = completions.length
			? resolveRelativeDate(
					config,
					completions[completions.length - 1].offsetDays,
					16,
					15,
				)
			: null;
		const nextDueDate = calculateNextDueDate(
			taskSeed.periodicity,
			startDate,
			endDate,
			lastCompletion,
		);
		const taskStatus: Asset.AssetMaintenanceStatus = nextDueDate
			? nextDueDate < today
				? "OVERDUE"
				: "PLANNED"
			: "CANCELLED";

		const task = await prisma.assetMaintenanceTask.create({
			data: {
				maintenanceId: maintenance.id,
				maintenanceTask: taskSeed.maintenanceTask,
				maintenanceType: taskSeed.maintenanceType,
				maintenanceStatus: taskStatus,
				startDate,
				periodicity: taskSeed.periodicity,
				endDate,
				certificateRequired: taskSeed.certificateRequired ?? false,
				assignTo: taskSeed.assignTo,
				assignToName: taskSeed.assignToName,
				nextDueDate,
				lastCompletionDate: lastCompletion,
				description: taskSeed.description ?? null,
				createdAt: startDate,
				updatedAt: lastCompletion ?? startDate,
			},
		});

		for (const [completionIndex, completion] of completions.entries()) {
			const completionDate = resolveRelativeDate(
				config,
				completion.offsetDays,
				16,
				15,
			);
			await prisma.assetMaintenanceLog.create({
				data: {
					maintenanceId: maintenance.id,
					taskId: task.id,
					maintenanceStatus: "COMPLETED",
					completionDate,
					actionsPerformed: completion.actionsPerformed,
					hasCertificate: completion.hasCertificate ?? false,
					certificateAttachment: completion.certificateAttachment ?? null,
					createdAt: completionDate,
					updatedAt: completionDate,
				},
			});

			await createAssetActivity(
				prisma,
				assetId,
				`${taskSeed.maintenanceTask} completed by ${team.name.toLowerCase()}.`,
				resolveActivityTimestamp(
					config,
					completion.offsetDays,
					activitySequence + completionIndex,
				),
			);
		}

		if (nextDueDate) {
			const openLogCreatedAt = lastCompletion
				? new Date(lastCompletion)
				: new Date(startDate);
			openLogCreatedAt.setHours(
				openLogCreatedAt.getHours() + 1,
				openLogCreatedAt.getMinutes(),
				0,
				0,
			);

			await prisma.assetMaintenanceLog.create({
				data: {
					maintenanceId: maintenance.id,
					taskId: task.id,
					maintenanceStatus: nextDueDate < today ? "OVERDUE" : "PLANNED",
					createdAt: openLogCreatedAt,
					updatedAt: openLogCreatedAt,
				},
			});
		}
	}

	return activitySequence + asset.maintenancePlan.tasks.length;
}

async function seedValueAdjustments(
	prisma: PrismaClient,
	config: DemoConfig,
	assetId: string,
	assetSeries: string,
	asset: AssetSeedDef,
	state: EffectiveAssetState,
	adjustmentCounters: Map<number, number>,
	revaluationCounters: Map<number, number>,
	activitySequenceBase: number,
): Promise<number> {
	const adjustments = [...(asset.valueAdjustments ?? [])].sort(
		(left, right) => left.adjustmentOffsetDays - right.adjustmentOffsetDays,
	);
	const category = getCategoryDefaults(asset.assetCategory);
	let activitySequence = activitySequenceBase;

	for (const adjustment of adjustments) {
		const adjustmentDate = resolveRelativeDate(
			config,
			adjustment.adjustmentOffsetDays,
			14,
			0,
		);
		const adjustmentSeries = buildAdjustmentSeries(
			"AVA",
			adjustmentDate,
			adjustmentCounters,
		);
		const fixedAssetAccount = deriveFixedAssetAccount(asset.assetCategory);
		const differenceAmount = Number(
			(adjustment.newAssetValue - state.currentAssetValue).toFixed(6),
		);
		const direction = getAssetValueAdjustmentDirection(differenceAmount);
		const previewSchedule =
			asset.calculateDepreciation === false
				? null
				: buildDepreciationSchedulePreview({
						adjustmentDate,
						currentAssetValue: state.currentAssetValue,
						newAssetValue: adjustment.newAssetValue,
						purchaseAmount: asset.netPurchaseAmount,
						openingAccumulatedDepreciation:
							asset.openingAccumulatedDepreciation ?? 0,
						bookedDepreciations: asset.openingNumberOfBookedDepreciations ?? 0,
						depreciationMethod:
							asset.depreciationMethod ?? category.depreciationMethod,
						totalNumberOfDepreciations:
							asset.totalNumberOfDepreciations ??
							category.totalNumberOfDepreciations,
						frequencyOfDepreciation:
							asset.frequencyOfDepreciation ?? category.frequencyOfDepreciation,
					});
		const resultState = getAssetValueAdjustmentResultState(
			state.status,
			adjustment.newAssetValue,
		);

		const adjustmentCreatedAt = resolveActivityTimestamp(
			config,
			adjustment.adjustmentOffsetDays,
			activitySequence,
		);
		const cancelledAt =
			adjustment.kind === "cancelled"
				? resolveRelativeDate(
						config,
						adjustment.cancelledOffsetDays ??
							adjustment.adjustmentOffsetDays + 2,
						17,
						30,
					)
				: null;

		const createdAdjustment = await prisma.assetValueAdjustment.create({
			data: {
				series: adjustmentSeries,
				assetId,
				assetCategorySnapshot: asset.assetCategory,
				companySnapshot: config.company,
				adjustmentDate,
				currentAssetValue: state.currentAssetValue.toString(),
				newAssetValue: adjustment.newAssetValue.toString(),
				differenceAmount: differenceAmount.toString(),
				differenceAccount: adjustment.differenceAccount,
				fixedAssetAccount,
				costCenter: adjustment.costCenter ?? null,
				notes: adjustment.notes ?? null,
				status:
					adjustment.kind === "draft"
						? "DRAFT"
						: adjustment.kind === "submitted"
							? "SUBMITTED"
							: "CANCELLED",
				direction,
				previousAssetStatus: state.status,
				previousIsFullyDepreciated: state.isFullyDepreciated,
				submittedAt: adjustment.kind === "draft" ? null : adjustmentDate,
				cancelledAt,
				createdAt: adjustmentCreatedAt,
				updatedAt: cancelledAt ?? adjustmentCreatedAt,
			},
		});

		if (adjustment.kind === "draft") {
			activitySequence += 1;
			continue;
		}

		const revaluationSeries = buildAdjustmentSeries(
			"JE-AVA",
			adjustmentDate,
			revaluationCounters,
		);
		const revaluationLines = buildRevaluationEntryLines({
			differenceAmount,
			fixedAssetAccount,
			differenceAccount: adjustment.differenceAccount,
			costCenter: adjustment.costCenter ?? null,
		});

		const revaluationEntry = await prisma.assetRevaluationEntry.create({
			data: {
				series: revaluationSeries,
				adjustmentId: createdAdjustment.id,
				assetId,
				company: config.company,
				postingDate: adjustmentDate,
				remarks: `Asset revaluation for ${assetSeries} via ${adjustmentSeries}`,
				status: adjustment.kind === "cancelled" ? "REVERSED" : "POSTED",
				reversedAt: cancelledAt,
				createdAt: adjustmentDate,
				updatedAt: cancelledAt ?? adjustmentDate,
				lines: {
					create: revaluationLines.map((line, lineIndex) => ({
						lineType: line.lineType,
						account: line.account,
						debitAmount: line.debitAmount.toString(),
						creditAmount: line.creditAmount.toString(),
						costCenter: line.costCenter,
						createdAt: new Date(adjustmentDate.getTime() + lineIndex * 60000),
						updatedAt: new Date(adjustmentDate.getTime() + lineIndex * 60000),
					})),
				},
			},
		});

		if (previewSchedule) {
			const scheduleRevisionNumber =
				(state.activeSchedule?.revisionNumber ?? 0) + 1;
			const schedule = await prisma.assetDepreciationSchedule.create({
				data: {
					adjustmentId: createdAdjustment.id,
					assetId,
					previousScheduleId: state.activeSchedule?.id ?? null,
					revisionNumber: scheduleRevisionNumber,
					status: adjustment.kind === "cancelled" ? "CANCELLED" : "ACTIVE",
					startDate: adjustmentDate,
					depreciationMethod: previewSchedule.depreciationMethod,
					totalNumberOfDepreciations:
						previewSchedule.totalNumberOfDepreciations,
					frequencyOfDepreciation: previewSchedule.frequencyOfDepreciation,
					bookedDepreciations: previewSchedule.bookedDepreciations,
					remainingDepreciations: previewSchedule.remainingDepreciations,
					openingAccumulatedDepreciation: (
						asset.openingAccumulatedDepreciation ?? 0
					).toString(),
					baseAssetValue: adjustment.newAssetValue.toString(),
					notes:
						adjustment.notes ?? `Projected from adjustment ${adjustmentSeries}`,
					createdAt: adjustmentDate,
					updatedAt: cancelledAt ?? adjustmentDate,
				},
			});

			for (const entry of previewSchedule.entries) {
				const entryCreatedAt = getScheduleCreatedAt(
					entry.scheduleDate,
					entry.sequence,
				);
				await prisma.assetDepreciationScheduleEntry.create({
					data: {
						scheduleId: schedule.id,
						sequence: entry.sequence,
						scheduleDate: entry.scheduleDate,
						depreciationAmount: entry.depreciationAmount.toString(),
						accumulatedDepreciationAmount:
							entry.accumulatedDepreciationAmount.toString(),
						bookValueAfterDepreciation:
							entry.bookValueAfterDepreciation.toString(),
						createdAt: entryCreatedAt,
						updatedAt: entryCreatedAt,
					},
				});
			}

			if (adjustment.kind === "submitted") {
				state.activeSchedule = {
					id: schedule.id,
					revisionNumber: scheduleRevisionNumber,
				};
			}
		}

		await createAssetActivity(
			prisma,
			assetId,
			`Asset value adjustment ${adjustmentSeries} submitted. Carrying value changed from ${state.currentAssetValue.toFixed(2)} to ${adjustment.newAssetValue.toFixed(2)} via ${revaluationEntry.series}.`,
			adjustmentDate,
		);

		if (adjustment.kind === "cancelled") {
			await createAssetActivity(
				prisma,
				assetId,
				`Asset value adjustment ${adjustmentSeries} cancelled and the previous carrying value was restored.`,
				cancelledAt ?? adjustmentDate,
			);
		} else {
			state.currentAssetValue = adjustment.newAssetValue;
			state.status = resultState.status;
			state.isFullyDepreciated = resultState.isFullyDepreciated;
		}

		activitySequence += 1;
	}

	return activitySequence;
}

export async function seedAssetTransactions(
	prisma: PrismaClient,
	config: DemoConfig,
	ids: MasterIds,
): Promise<void> {
	const adjustmentCounters = new Map<number, number>();
	const revaluationCounters = new Map<number, number>();

	for (const [assetIndex, asset] of ASSET_REGISTER.entries()) {
		const assetId = ids.assetIds.get(asset.key);
		if (!assetId) {
			throw new Error(
				`Asset ${asset.key} was not created during master seeding`,
			);
		}

		const assetRecord = await prisma.asset.findUnique({
			where: { id: assetId },
			select: { series: true },
		});
		if (!assetRecord) {
			throw new Error(`Asset ${asset.key} could not be loaded after creation`);
		}

		let activitySequence = assetIndex * 20;
		await createAssetActivity(
			prisma,
			assetId,
			`Asset created with series ${assetRecord.series}`,
			resolveActivityTimestamp(
				config,
				asset.purchaseOffsetDays,
				activitySequence,
			),
		);

		activitySequence += 1;
		if (
			asset.availableForUseOffsetDays !== undefined &&
			asset.availableForUseOffsetDays !== null
		) {
			const submissionText = asset.location
				? `Asset submitted and made available for use at ${asset.location}.`
				: "Asset submitted and made available for use.";
			await createAssetActivity(
				prisma,
				assetId,
				submissionText,
				resolveActivityTimestamp(
					config,
					asset.availableForUseOffsetDays,
					activitySequence,
				),
			);
		}

		for (const note of asset.activityNotes) {
			activitySequence += 1;
			await createAssetActivity(
				prisma,
				assetId,
				note.activity,
				resolveActivityTimestamp(config, note.offsetDays, activitySequence),
			);
		}

		activitySequence = await seedMaintenanceRecord(
			prisma,
			config,
			ids,
			assetId,
			asset,
			activitySequence,
		);

		const effectiveState = buildInitialState(asset);
		activitySequence = await seedValueAdjustments(
			prisma,
			config,
			assetId,
			assetRecord.series,
			asset,
			effectiveState,
			adjustmentCounters,
			revaluationCounters,
			activitySequence,
		);

		if (
			asset.valueAdjustments?.some(
				(adjustment) => adjustment.kind === "submitted",
			)
		) {
			const expectedValueAfterDepreciation = Number(
				(asset.valueAfterDepreciation ?? getCurrentAssetValue(asset)).toFixed(
					6,
				),
			);
			if (
				Math.abs(
					effectiveState.currentAssetValue - expectedValueAfterDepreciation,
				) > 0.000001
			) {
				throw new Error(
					`Asset ${asset.key} final carrying value ${expectedValueAfterDepreciation} does not match seeded adjustment history ${effectiveState.currentAssetValue}`,
				);
			}
		}
	}
}
