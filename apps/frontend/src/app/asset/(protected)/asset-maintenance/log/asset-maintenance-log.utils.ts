import type { Asset } from "@aria/types";
import type { CompleteMaintenanceLogFormValues } from "./asset-maintenance-log.schema";

export const LOG_PAGE_SIZE = 20;

/**
 * Returns the display label for a maintenance log status.
 */
export function formatLogStatus(
	status: Asset.AssetMaintenanceLogStatus,
): string {
	switch (status) {
		case "PLANNED":
			return "Planned";
		case "COMPLETED":
			return "Completed";
		case "CANCELLED":
			return "Cancelled";
		case "OVERDUE":
			return "Overdue";
		default:
			return status;
	}
}

/**
 * Returns a Tailwind badge variant (color-coding) class name for a log status.
 * Mirrors ERPNext list view color indicators.
 */
export function getLogStatusVariant(
	status: Asset.AssetMaintenanceLogStatus,
): "orange" | "green" | "red" | "gray" {
	switch (status) {
		case "PLANNED":
			return "orange";
		case "COMPLETED":
			return "green";
		case "CANCELLED":
		case "OVERDUE":
			return "red";
		default:
			return "gray";
	}
}

/**
 * Returns true when a log can be completed (status is PLANNED or OVERDUE).
 */
export function canCompleteLog(
	status: Asset.AssetMaintenanceLogStatus,
): boolean {
	return status === "PLANNED" || status === "OVERDUE";
}

/**
 * Returns true when a log can be cancelled (status is PLANNED or OVERDUE).
 */
export function canCancelLog(status: Asset.AssetMaintenanceLogStatus): boolean {
	return status === "PLANNED" || status === "OVERDUE";
}

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

/**
 * Formats a date-only value (task due date, completion date) as YYYY-MM-DD.
 * Date-only values are stored as UTC midnight, so they are read in UTC to keep
 * the calendar day identical in every viewer timezone.
 */
export function formatDate(date: Date | null | undefined): string {
	if (!date) return "—";
	return date.toLocaleDateString("en-CA", { timeZone: "UTC" }); // YYYY-MM-DD
}

/**
 * Builds the tRPC query input for the maintenance log list based on
 * current pagination and filter state.
 */
export function buildMaintenanceLogListInput(params: {
	search: string;
	status: Asset.AssetMaintenanceLogStatus | "";
	pageIndex: number;
	pageSize: number;
}): Asset.ListAssetMaintenanceLogsInput {
	return {
		skip: params.pageIndex * params.pageSize,
		take: params.pageSize,
		search: params.search || undefined,
		status: params.status || undefined,
	};
}

/**
 * Converts the "complete log" form values to the tRPC mutation payload.
 */
export function toCompleteMaintenanceLogInput(
	logId: string,
	values: CompleteMaintenanceLogFormValues,
): Asset.CompleteAssetMaintenanceLogInput {
	return {
		logId,
		completionDate: new Date(values.completionDate),
		actionsPerformed: values.actionsPerformed?.trim() || null,
		hasCertificate: values.hasCertificate,
		certificateAttachment:
			values.hasCertificate && values.certificateAttachment
				? values.certificateAttachment.trim()
				: null,
	};
}

/**
 * Returns the human-readable display label for a maintenance task type.
 */
export function formatMaintenanceType(
	type: Asset.AssetMaintenanceTaskType | null,
): string {
	if (!type) return "—";
	switch (type) {
		case "PREVENTIVE_MAINTENANCE":
			return "Preventive";
		case "CALIBRATION":
			return "Calibration";
		default:
			return type;
	}
}

/**
 * Returns the human-readable display label for a maintenance periodicity.
 */
export function formatPeriodicity(
	periodicity: Asset.AssetMaintenancePeriodicity,
): string {
	switch (periodicity) {
		case "DAILY":
			return "Daily";
		case "WEEKLY":
			return "Weekly";
		case "MONTHLY":
			return "Monthly";
		case "QUARTERLY":
			return "Quarterly";
		case "HALF_YEARLY":
			return "Half Yearly";
		case "YEARLY":
			return "Yearly";
		case "TWO_YEARLY":
			return "2 Yearly";
		case "THREE_YEARLY":
			return "3 Yearly";
		default:
			return periodicity;
	}
}
