import type { Asset } from "@aria/types";
import type { Prisma } from "../../generated/prisma/client";

/**
 * Prisma model type for Asset with all relations included.
 */
export type PrismaAsset = Prisma.AssetGetPayload<{
	include: {
		assetCategory: { select: { id: true; name: true } };
		location: { select: { id: true; name: true } };
		custodian: {
			select: { id: true; employeeId: true; employeeName: true };
		};
		activities: { orderBy: { createdAt: "desc" } };
		financeBooks: {
			include: { financeBook: { select: { name: true } } };
			orderBy: { createdAt: "asc" };
		};
	};
}>;

/**
 * Prisma model type for Location (with optional parent name).
 */
export type PrismaLocation = Prisma.LocationGetPayload<{
	select: {
		id: true;
		name: true;
		parentLocationId: true;
		parentLocation: { select: { name: true } };
		isGroup: true;
		createdAt: true;
		updatedAt: true;
	};
}>;

/**
 * Prisma model type for an asset category and its per-book/account defaults.
 */
export type PrismaAssetCategory = Prisma.AssetCategoryGetPayload<{
	include: {
		financeBookDefaults: {
			include: { financeBook: { select: { name: true } } };
			orderBy: { createdAt: "asc" };
		};
		accounts: {
			include: { company: { select: { name: true } } };
			orderBy: { createdAt: "asc" };
		};
	};
}>;

/**
 * Maps a Prisma Location record to the Asset.Location domain type.
 */
export function toAssetLocation(loc: PrismaLocation): Asset.Location {
	return {
		id: loc.id,
		name: loc.name,
		parentLocationId: loc.parentLocationId ?? null,
		parentLocationName: loc.parentLocation?.name ?? null,
		isGroup: loc.isGroup,
		createdAt: loc.createdAt,
		updatedAt: loc.updatedAt,
	};
}

export function toAssetCategory(cat: PrismaAssetCategory): Asset.AssetCategory {
	return {
		id: cat.id,
		name: cat.name,
		depreciationMethod:
			(cat.depreciationMethod as Asset.DepreciationMethod | null) ?? null,
		totalNumberOfDepreciations: cat.totalNumberOfDepreciations ?? null,
		frequencyOfDepreciation: cat.frequencyOfDepreciation ?? null,
		dailyProrataBased: cat.dailyProrataBased ?? null,
		shiftBased: cat.shiftBased ?? null,
		rateOfDepreciation: cat.rateOfDepreciation ?? null,
		expectedValueAfterUsefulLife:
			cat.expectedValueAfterUsefulLife != null
				? Number(cat.expectedValueAfterUsefulLife)
				: null,
		nonDepreciableCategory: cat.nonDepreciableCategory,
		enableCwipAccounting: cat.enableCwipAccounting,
		financeBooks: (cat.financeBookDefaults ?? []).map((book) => ({
			id: book.id,
			financeBookId: book.financeBookId,
			financeBookName: book.financeBook.name,
			depreciationMethod: book.depreciationMethod as Asset.DepreciationMethod,
			totalNumberOfDepreciations: book.totalNumberOfDepreciations,
			frequencyOfDepreciation: book.frequencyOfDepreciation,
			dailyProrataBased: book.dailyProrataBased,
			shiftBased: book.shiftBased,
			rateOfDepreciation:
				book.rateOfDepreciation == null
					? null
					: Number(book.rateOfDepreciation),
			expectedValueAfterUsefulLife:
				book.expectedValueAfterUsefulLife == null
					? null
					: Number(book.expectedValueAfterUsefulLife),
		})),
		accounts: (cat.accounts ?? []).map((account) => ({
			id: account.id,
			companyId: account.companyId,
			companyName: account.company.name,
			fixedAssetAccount: account.fixedAssetAccount,
			accumulatedDepreciationAccount:
				account.accumulatedDepreciationAccount ?? null,
			depreciationExpenseAccount: account.depreciationExpenseAccount ?? null,
			capitalWorkInProgressAccount:
				account.capitalWorkInProgressAccount ?? null,
		})),
		createdAt: cat.createdAt,
		updatedAt: cat.updatedAt,
	};
}

/**
 * Maps a full Prisma Asset record (with relations) to the Asset.AssetItem domain type.
 */
export function toAsset(raw: PrismaAsset): Asset.AssetItem {
	return {
		id: raw.id,
		series: raw.series,
		assetName: raw.assetName,
		itemCode: raw.itemCode ?? null,
		barcode: raw.barcode ?? null,
		assetCategoryId: raw.assetCategoryId ?? null,
		assetCategoryName: raw.assetCategory?.name ?? null,
		company: raw.company,
		locationId: raw.locationId ?? null,
		locationName: raw.location?.name ?? null,
		custodianId: raw.custodianId ?? null,
		custodianEmployeeId: raw.custodian?.employeeId ?? null,
		custodianName: raw.custodian?.employeeName ?? null,
		department: raw.department ?? null,
		purchaseDate: raw.purchaseDate ?? null,
		availableForUseDate: raw.availableForUseDate ?? null,
		disposalDate: raw.disposalDate ?? null,
		netPurchaseAmount: raw.netPurchaseAmount
			? Number(raw.netPurchaseAmount)
			: null,
		assetQuantity: raw.assetQuantity,
		calculateDepreciation: raw.calculateDepreciation,
		openingAccumulatedDepreciation: raw.openingAccumulatedDepreciation
			? Number(raw.openingAccumulatedDepreciation)
			: null,
		openingNumberOfBookedDepreciations:
			raw.openingNumberOfBookedDepreciations ?? null,
		isFullyDepreciated: raw.isFullyDepreciated,
		valueAfterDepreciation: raw.valueAfterDepreciation
			? Number(raw.valueAfterDepreciation)
			: null,
		maintenanceRequired: raw.maintenanceRequired,
		assetOwner: raw.assetOwner as Asset.AssetOwner,
		assetOwnerCompany: raw.assetOwnerCompany ?? null,
		supplier: raw.supplier ?? null,
		customer: raw.customer ?? null,
		policyNumber: raw.policyNumber ?? null,
		insurer: raw.insurer ?? null,
		insuredValue: raw.insuredValue ? Number(raw.insuredValue) : null,
		insuranceStartDate: raw.insuranceStartDate ?? null,
		insuranceEndDate: raw.insuranceEndDate ?? null,
		depreciationMethod:
			(raw.depreciationMethod as Asset.DepreciationMethod | null) ?? null,
		totalNumberOfDepreciations: raw.totalNumberOfDepreciations ?? null,
		frequencyOfDepreciation: raw.frequencyOfDepreciation ?? null,
		expectedValueAfterUsefulLife: raw.expectedValueAfterUsefulLife
			? Number(raw.expectedValueAfterUsefulLife)
			: null,
		depreciationStartDate: raw.depreciationStartDate ?? null,
		purchaseReceipt: raw.purchaseReceipt ?? null,
		purchaseInvoice: raw.purchaseInvoice ?? null,
		status: raw.status as Asset.AssetStatus,
		financeBooks: (raw.financeBooks ?? []).map((book) => ({
			id: book.id,
			financeBookId: book.financeBookId,
			financeBookName: book.financeBook.name,
			depreciationMethod: book.depreciationMethod as Asset.DepreciationMethod,
			totalNumberOfDepreciations: book.totalNumberOfDepreciations,
			frequencyOfDepreciation: book.frequencyOfDepreciation,
			depreciationStartDate: book.depreciationStartDate,
			dailyProrataBased: book.dailyProrataBased,
			shiftBased: book.shiftBased,
			rateOfDepreciation:
				book.rateOfDepreciation == null
					? null
					: Number(book.rateOfDepreciation),
			expectedValueAfterUsefulLife: Number(book.expectedValueAfterUsefulLife),
			openingAccumulatedDepreciation: Number(
				book.openingAccumulatedDepreciation,
			),
			openingNumberOfBookedDepreciations:
				book.openingNumberOfBookedDepreciations,
			valueAfterDepreciation: Number(book.valueAfterDepreciation),
			totalNumberOfBookedDepreciations: book.totalNumberOfBookedDepreciations,
			lastPostedDepreciationDate: book.lastPostedDepreciationDate ?? null,
			postingStatus: book.postingStatus as Asset.DepreciationPostingStatus,
		})),
		activities: raw.activities.map((a) => ({
			id: a.id,
			assetId: a.assetId,
			activity: a.activity,
			createdAt: a.createdAt,
		})),
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}

/**
 * Prisma model type for AssetRevaluationEntry with ordered lines.
 */
export type PrismaAssetRevaluationEntry =
	Prisma.AssetRevaluationEntryGetPayload<{
		include: {
			lines: { orderBy: { createdAt: "asc" } };
		};
	}>;

/**
 * Prisma model type for AssetDepreciationSchedule with ordered entries.
 */
export type PrismaAssetDepreciationSchedule =
	Prisma.AssetDepreciationScheduleGetPayload<{
		include: {
			entries: { orderBy: { sequence: "asc" } };
		};
	}>;

/**
 * Prisma model type for AssetValueAdjustment with nested asset, entry, and schedule.
 */
export type PrismaAssetValueAdjustment = Prisma.AssetValueAdjustmentGetPayload<{
	include: {
		asset: {
			select: {
				id: true;
				series: true;
				assetName: true;
				assetCategory: { select: { name: true } };
			};
		};
		revaluationEntry: {
			include: {
				lines: { orderBy: { createdAt: "asc" } };
			};
		};
		depreciationSchedule: {
			include: {
				entries: { orderBy: { sequence: "asc" } };
			};
		};
	};
}>;

export function toAssetRevaluationEntryLine(
	raw: PrismaAssetRevaluationEntry["lines"][number],
): Asset.AssetRevaluationEntryLine {
	return {
		id: raw.id,
		lineType: raw.lineType as Asset.AssetRevaluationLineType,
		account: raw.account,
		debitAmount: Number(raw.debitAmount),
		creditAmount: Number(raw.creditAmount),
		costCenter: raw.costCenter ?? null,
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}

export function toAssetRevaluationEntry(
	raw: PrismaAssetRevaluationEntry,
): Asset.AssetRevaluationEntry {
	return {
		id: raw.id,
		series: raw.series,
		adjustmentId: raw.adjustmentId,
		assetId: raw.assetId,
		company: raw.company,
		postingDate: raw.postingDate,
		remarks: raw.remarks,
		status: raw.status as Asset.AssetRevaluationEntryStatus,
		reversedAt: raw.reversedAt ?? null,
		lines: raw.lines.map(toAssetRevaluationEntryLine),
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}

export function toAssetDepreciationScheduleEntry(
	raw: PrismaAssetDepreciationSchedule["entries"][number],
): Asset.AssetDepreciationScheduleEntry {
	return {
		id: raw.id,
		sequence: raw.sequence,
		scheduleDate: raw.scheduleDate,
		depreciationAmount: Number(raw.depreciationAmount),
		accumulatedDepreciationAmount: Number(raw.accumulatedDepreciationAmount),
		bookValueAfterDepreciation: Number(raw.bookValueAfterDepreciation),
		postingId: raw.postingId ?? null,
		postedAt: raw.postedAt ?? null,
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}

export function toAssetDepreciationSchedule(
	raw: PrismaAssetDepreciationSchedule,
): Asset.AssetDepreciationSchedule {
	return {
		id: raw.id,
		adjustmentId: raw.adjustmentId ?? null,
		assetId: raw.assetId,
		assetFinanceBookId: raw.assetFinanceBookId,
		previousScheduleId: raw.previousScheduleId ?? null,
		revisionNumber: raw.revisionNumber,
		status: raw.status as Asset.AssetDepreciationScheduleStatus,
		startDate: raw.startDate,
		depreciationMethod:
			(raw.depreciationMethod as Asset.DepreciationMethod | null) ?? null,
		totalNumberOfDepreciations: raw.totalNumberOfDepreciations,
		frequencyOfDepreciation: raw.frequencyOfDepreciation,
		bookedDepreciations: raw.bookedDepreciations,
		remainingDepreciations: raw.remainingDepreciations,
		openingAccumulatedDepreciation: Number(raw.openingAccumulatedDepreciation),
		baseAssetValue: Number(raw.baseAssetValue),
		notes: raw.notes ?? null,
		entries: raw.entries.map(toAssetDepreciationScheduleEntry),
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}

export function toAssetValueAdjustment(
	raw: PrismaAssetValueAdjustment,
): Asset.AssetValueAdjustmentItem {
	return {
		id: raw.id,
		series: raw.series,
		assetId: raw.assetId,
		assetSeries: raw.asset.series,
		assetName: raw.asset.assetName,
		assetCategoryName: raw.asset.assetCategory?.name ?? null,
		company: raw.companySnapshot,
		adjustmentDate: raw.adjustmentDate,
		currentAssetValue: Number(raw.currentAssetValue),
		newAssetValue: Number(raw.newAssetValue),
		differenceAmount: Number(raw.differenceAmount),
		differenceAccount: raw.differenceAccount,
		fixedAssetAccount: raw.fixedAssetAccount,
		costCenter: raw.costCenter ?? null,
		notes: raw.notes ?? null,
		status: raw.status as Asset.AssetValueAdjustmentStatus,
		direction: raw.direction as Asset.AssetValueAdjustmentDirection,
		previousAssetStatus: raw.previousAssetStatus as Asset.AssetStatus,
		previousIsFullyDepreciated: raw.previousIsFullyDepreciated,
		submittedAt: raw.submittedAt ?? null,
		cancelledAt: raw.cancelledAt ?? null,
		revaluationEntry: raw.revaluationEntry
			? toAssetRevaluationEntry(raw.revaluationEntry)
			: null,
		depreciationSchedule: raw.depreciationSchedule
			? toAssetDepreciationSchedule(raw.depreciationSchedule)
			: null,
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}

/**
 * Prisma model type for AssetMaintenanceTeam with members relation included.
 */
export type PrismaMaintenanceTeam = Prisma.AssetMaintenanceTeamGetPayload<{
	include: { members: { orderBy: { createdAt: "asc" } } };
}>;

/**
 * Maps a Prisma AssetMaintenanceTeam record to the Asset.AssetMaintenanceTeam domain type.
 */
export function toMaintenanceTeam(
	raw: PrismaMaintenanceTeam,
): Asset.AssetMaintenanceTeam {
	return {
		id: raw.id,
		name: raw.name,
		maintenanceManager: raw.maintenanceManager ?? null,
		maintenanceManagerName: raw.maintenanceManagerName ?? null,
		company: raw.company,
		members: raw.members.map((m) => ({
			id: m.id,
			teamId: m.teamId,
			teamMember: m.teamMember,
			fullName: m.fullName,
			maintenanceRole: m.maintenanceRole,
			createdAt: m.createdAt,
			updatedAt: m.updatedAt,
		})),
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}

// ============================================================================
// Asset Maintenance Mappers
// ============================================================================

/**
 * Prisma model type for AssetMaintenance with all relations included.
 */
export type PrismaAssetMaintenance = Prisma.AssetMaintenanceGetPayload<{
	include: {
		asset: {
			select: {
				assetName: true;
				itemCode: true;
				assetCategory: { select: { name: true } };
			};
		};
		maintenanceTeam: { select: { name: true } };
		tasks: { orderBy: { createdAt: "asc" } };
	};
}>;

/**
 * Prisma model type for AssetMaintenanceLog (scalar fields).
 */
export type PrismaAssetMaintenanceLog = Prisma.AssetMaintenanceLogGetPayload<
	Record<string, never>
>;

/**
 * Maps a Prisma AssetMaintenance record to the Asset.AssetMaintenanceRecord domain type.
 */
export function toAssetMaintenance(
	raw: PrismaAssetMaintenance,
): Asset.AssetMaintenanceRecord {
	return {
		id: raw.id,
		assetId: raw.assetId,
		assetName: raw.asset.assetName,
		assetCategoryName: raw.asset.assetCategory?.name ?? null,
		itemCode: raw.asset.itemCode ?? null,
		company: raw.company,
		maintenanceTeamId: raw.maintenanceTeamId,
		maintenanceTeamName: raw.maintenanceTeam.name,
		maintenanceManager: raw.maintenanceManager ?? null,
		maintenanceManagerName: raw.maintenanceManagerName ?? null,
		tasks: raw.tasks.map((t) => ({
			id: t.id,
			maintenanceId: t.maintenanceId,
			maintenanceTask: t.maintenanceTask,
			maintenanceType:
				(t.maintenanceType as Asset.AssetMaintenanceTaskType | null) ?? null,
			maintenanceStatus: t.maintenanceStatus as Asset.AssetMaintenanceStatus,
			startDate: t.startDate,
			periodicity: t.periodicity as Asset.AssetMaintenancePeriodicity,
			endDate: t.endDate ?? null,
			certificateRequired: t.certificateRequired,
			assignTo: t.assignTo ?? null,
			assignToName: t.assignToName ?? null,
			nextDueDate: t.nextDueDate ?? null,
			lastCompletionDate: t.lastCompletionDate ?? null,
			description: t.description ?? null,
			createdAt: t.createdAt,
			updatedAt: t.updatedAt,
		})),
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}

/**
 * Maps a Prisma AssetMaintenanceLog record to the Asset.AssetMaintenanceLogItem domain type.
 */
export function toAssetMaintenanceLog(
	raw: PrismaAssetMaintenanceLog,
): Asset.AssetMaintenanceLogItem {
	return {
		id: raw.id,
		maintenanceId: raw.maintenanceId,
		taskId: raw.taskId,
		maintenanceStatus: raw.maintenanceStatus as Asset.AssetMaintenanceLogStatus,
		completionDate: raw.completionDate ?? null,
		actionsPerformed: raw.actionsPerformed ?? null,
		hasCertificate: raw.hasCertificate,
		certificateAttachment: raw.certificateAttachment ?? null,
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}

/**
 * Prisma model type for AssetMaintenanceLog with full relational context
 * needed for list display (asset name, task name, etc.).
 */
export type PrismaAssetMaintenanceLogWithContext =
	Prisma.AssetMaintenanceLogGetPayload<{
		include: {
			maintenance: {
				select: {
					id: true;
					assetId: true;
					company: true;
					asset: { select: { id: true; assetName: true } };
				};
			};
			task: {
				select: {
					id: true;
					maintenanceTask: true;
					maintenanceType: true;
					periodicity: true;
					assignToName: true;
					nextDueDate: true;
				};
			};
		};
	}>;

/**
 * Maps a Prisma AssetMaintenanceLog with context to the
 * Asset.AssetMaintenanceLogListItem domain type used for standalone list views.
 */
export function toAssetMaintenanceLogListItem(
	raw: PrismaAssetMaintenanceLogWithContext,
): Asset.AssetMaintenanceLogListItem {
	return {
		id: raw.id,
		maintenanceId: raw.maintenanceId,
		taskId: raw.taskId,
		assetId: raw.maintenance.assetId,
		assetName: raw.maintenance.asset.assetName,
		company: raw.maintenance.company,
		maintenanceTask: raw.task.maintenanceTask,
		maintenanceType:
			(raw.task.maintenanceType as Asset.AssetMaintenanceTaskType | null) ??
			null,
		periodicity: raw.task.periodicity as Asset.AssetMaintenancePeriodicity,
		assignToName: raw.task.assignToName ?? null,
		taskDueDate: raw.task.nextDueDate ?? null,
		maintenanceStatus: raw.maintenanceStatus as Asset.AssetMaintenanceLogStatus,
		completionDate: raw.completionDate ?? null,
		actionsPerformed: raw.actionsPerformed ?? null,
		hasCertificate: raw.hasCertificate,
		certificateAttachment: raw.certificateAttachment ?? null,
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}
