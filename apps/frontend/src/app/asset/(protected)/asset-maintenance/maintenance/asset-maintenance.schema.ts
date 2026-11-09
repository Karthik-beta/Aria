import * as z from "zod";

export const assetMaintenanceTaskRowSchema = z.object({
	id: z.string().optional(),
	maintenanceTask: z.string().min(1, "Task name is required").max(255).trim(),
	maintenanceType: z
		.enum(["PREVENTIVE_MAINTENANCE", "CALIBRATION"])
		.nullable()
		.optional(),
	maintenanceStatus: z
		.enum(["PLANNED", "OVERDUE", "CANCELLED"])
		.default("PLANNED"),
	startDate: z.string().min(1, "Start date is required"),
	periodicity: z.enum([
		"DAILY",
		"WEEKLY",
		"MONTHLY",
		"QUARTERLY",
		"HALF_YEARLY",
		"YEARLY",
		"TWO_YEARLY",
		"THREE_YEARLY",
	]),
	endDate: z.string().optional().nullable(),
	certificateRequired: z.boolean().default(false),
	assignTo: z.string().max(255).trim().optional().nullable(),
	assignToName: z.string().max(255).trim().optional().nullable(),
	description: z.string().trim().optional().nullable(),
});

export type AssetMaintenanceTaskRow = z.infer<
	typeof assetMaintenanceTaskRowSchema
>;

export const assetMaintenanceFormSchema = z.object({
	assetId: z.string().min(1, "Asset ID is required"),
	company: z.string().min(1, "Company is required").max(255).trim(),
	maintenanceTeamId: z.string().min(1, "Maintenance team is required"),
	maintenanceManager: z.string().max(255).trim().optional(),
	maintenanceManagerName: z.string().max(255).trim().optional(),
	tasks: z
		.array(assetMaintenanceTaskRowSchema)
		.min(1, "At least one maintenance task is required"),
});

export type AssetMaintenanceFormValues = z.infer<
	typeof assetMaintenanceFormSchema
>;

export const getAssetMaintenanceFormDefaults =
	(): AssetMaintenanceFormValues => ({
		assetId: "",
		company: "",
		maintenanceTeamId: "",
		maintenanceManager: "",
		maintenanceManagerName: "",
		tasks: [],
	});
