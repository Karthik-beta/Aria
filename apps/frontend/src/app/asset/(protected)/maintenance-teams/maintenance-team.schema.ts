import * as z from "zod";

export const maintenanceTeamMemberRowSchema = z.object({
	id: z.string().optional(),
	teamMember: z.string().min(1, "Team member is required").max(255).trim(),
	fullName: z.string().min(1, "Full name is required").max(255).trim(),
	maintenanceRole: z
		.string()
		.min(1, "Maintenance role is required")
		.max(100)
		.trim(),
});

export type MaintenanceTeamMemberRow = z.infer<
	typeof maintenanceTeamMemberRowSchema
>;

export const maintenanceTeamFormSchema = z.object({
	name: z.string().min(1, "Team name is required").max(255).trim(),
	maintenanceManager: z.string().max(255).trim().optional(),
	maintenanceManagerName: z.string().max(255).trim().optional(),
	companyId: z.string().min(1, "Company is required").max(255).trim(),
	members: z
		.array(maintenanceTeamMemberRowSchema)
		.min(1, "At least one team member is required"),
});

export type MaintenanceTeamFormValues = z.infer<
	typeof maintenanceTeamFormSchema
>;

export const getMaintenanceTeamFormDefaults = () => ({
	name: "",
	maintenanceManager: "",
	maintenanceManagerName: "",
	companyId: "",
	members: [] as MaintenanceTeamMemberRow[],
});
