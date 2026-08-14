import type { Asset } from "@aria/types";
import type { AssetMaintenanceFormValues } from "./asset-maintenance.schema";

export const MAINTENANCE_PAGE_SIZE = 20;

/**
 * Returns a human-readable relative age string for a date.
 * e.g. "3 d", "2 m", "1 y", "Today"
 */
export function getRelativeAge(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffYears >= 1) return `${diffYears} y`;
	if (diffMonths >= 1) return `${diffMonths} m`;
	if (diffDays >= 1) return `${diffDays} d`;
	return "Today";
}

const MAINTENANCE_STATUS_LABELS: Record<Asset.AssetMaintenanceStatus, string> =
	{
		PLANNED: "Planned",
		OVERDUE: "Overdue",
		CANCELLED: "Cancelled",
	};

/**
 * Returns a human-readable label for an AssetMaintenanceStatus enum value.
 */
export function formatMaintenanceStatus(
	status: Asset.AssetMaintenanceStatus,
): string {
	return MAINTENANCE_STATUS_LABELS[status] ?? status;
}

const PERIODICITY_LABELS: Record<Asset.AssetMaintenancePeriodicity, string> = {
	DAILY: "Daily",
	WEEKLY: "Weekly",
	MONTHLY: "Monthly",
	QUARTERLY: "Quarterly",
	HALF_YEARLY: "Half-Yearly",
	YEARLY: "Yearly",
	TWO_YEARLY: "2-Yearly",
	THREE_YEARLY: "3-Yearly",
};

/**
 * Returns a human-readable label for an AssetMaintenancePeriodicity enum value.
 */
export function formatPeriodicity(
	periodicity: Asset.AssetMaintenancePeriodicity,
): string {
	return PERIODICITY_LABELS[periodicity] ?? periodicity;
}

const TASK_TYPE_LABELS: Record<Asset.AssetMaintenanceTaskType, string> = {
	PREVENTIVE_MAINTENANCE: "Preventive",
	CALIBRATION: "Calibration",
};

/**
 * Returns a human-readable label for an AssetMaintenanceTaskType enum value.
 */
export function formatMaintenanceTaskType(
	type: Asset.AssetMaintenanceTaskType,
): string {
	return TASK_TYPE_LABELS[type] ?? type;
}

/**
 * Converts form values to the create mutation payload.
 */
export function toCreateAssetMaintenanceInput(
	values: AssetMaintenanceFormValues,
): Asset.CreateAssetMaintenanceInput {
	return {
		assetId: values.assetId.trim(),
		companyId: values.companyId.trim(),
		maintenanceTeamId: values.maintenanceTeamId.trim(),
		maintenanceManager: values.maintenanceManager?.trim() || null,
		maintenanceManagerName: values.maintenanceManagerName?.trim() || null,
		tasks: values.tasks.map((t) => ({
			maintenanceTask: t.maintenanceTask.trim(),
			maintenanceType: t.maintenanceType ?? null,
			maintenanceStatus: t.maintenanceStatus ?? "PLANNED",
			startDate: t.startDate,
			periodicity: t.periodicity,
			endDate: t.endDate || null,
			certificateRequired: t.certificateRequired,
			assignTo: t.assignTo?.trim() || null,
			assignToName: t.assignToName?.trim() || null,
			description: t.description?.trim() || null,
		})),
	};
}

/**
 * Converts form values to the update mutation payload.
 */
export function toUpdateAssetMaintenanceInput(
	id: string,
	values: AssetMaintenanceFormValues,
): Asset.UpdateAssetMaintenanceInput {
	return {
		id,
		companyId: values.companyId.trim(),
		maintenanceTeamId: values.maintenanceTeamId.trim(),
		maintenanceManager: values.maintenanceManager?.trim() || null,
		maintenanceManagerName: values.maintenanceManagerName?.trim() || null,
		tasks: values.tasks.map((t) => ({
			id: t.id,
			maintenanceTask: t.maintenanceTask.trim(),
			maintenanceType: t.maintenanceType ?? null,
			maintenanceStatus: t.maintenanceStatus ?? "PLANNED",
			startDate: t.startDate,
			periodicity: t.periodicity,
			endDate: t.endDate || null,
			certificateRequired: t.certificateRequired,
			assignTo: t.assignTo?.trim() || null,
			assignToName: t.assignToName?.trim() || null,
			description: t.description?.trim() || null,
		})),
	};
}

/**
 * Builds the list query input from the current filter/pagination state.
 */
export function buildAssetMaintenanceListInput(params: {
	search: string;
	pageIndex: number;
	pageSize: number;
}): NonNullable<Asset.ListAssetMaintenancesInput> {
	return {
		skip: params.pageIndex * params.pageSize,
		take: params.pageSize,
		search: params.search.trim() || undefined,
	};
}
