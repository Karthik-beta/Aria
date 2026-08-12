import type { Asset } from "@aria/types";
import type { MaintenanceTeamFormValues } from "./maintenance-team.schema";

export const TEAM_PAGE_SIZE = 20;

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
 * Converts form values to the create mutation payload.
 */
export function toCreateMaintenanceTeamInput(
	values: MaintenanceTeamFormValues,
): Asset.CreateAssetMaintenanceTeamInput {
	return {
		name: values.name.trim(),
		maintenanceManager: values.maintenanceManager?.trim() || null,
		maintenanceManagerName: values.maintenanceManagerName?.trim() || null,
		companyId: values.companyId.trim(),
		members: values.members.map((m) => ({
			teamMember: m.teamMember.trim(),
			fullName: m.fullName.trim(),
			maintenanceRole: m.maintenanceRole.trim(),
		})),
	};
}

/**
 * Converts form values to the update mutation payload.
 */
export function toUpdateMaintenanceTeamInput(
	id: string,
	values: MaintenanceTeamFormValues,
): Asset.UpdateAssetMaintenanceTeamInput {
	return {
		id,
		name: values.name.trim(),
		maintenanceManager: values.maintenanceManager?.trim() || null,
		maintenanceManagerName: values.maintenanceManagerName?.trim() || null,
		companyId: values.companyId.trim(),
		members: values.members.map((m) => ({
			id: m.id,
			teamMember: m.teamMember.trim(),
			fullName: m.fullName.trim(),
			maintenanceRole: m.maintenanceRole.trim(),
		})),
	};
}

/**
 * Builds the list query input from the current filter/pagination state.
 */
export function buildMaintenanceTeamListInput(params: {
	search: string;
	pageIndex: number;
	pageSize: number;
}): NonNullable<Asset.ListMaintenanceTeamsInput> {
	return {
		skip: params.pageIndex * params.pageSize,
		take: params.pageSize,
		search: params.search.trim() || undefined,
	};
}
