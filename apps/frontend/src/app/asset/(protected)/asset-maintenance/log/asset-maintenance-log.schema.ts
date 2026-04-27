/**
 * Zod schema and default values for the "Complete Asset Maintenance Log" dialog form.
 *
 * Fields mirror ERPNext AssetMaintenanceLog:
 * - completionDate: required when completing
 * - actionsPerformed: optional rich text noting what was done
 * - hasCertificate: checkbox; when true, certificateAttachment is expected
 * - certificateAttachment: URL/path; required when hasCertificate is true
 */
import { z } from "zod";

export const completeMaintenanceLogFormSchema = z
	.object({
		completionDate: z.string().min(1, "Completion date is required"),
		actionsPerformed: z.string().trim().optional(),
		hasCertificate: z.boolean().default(false),
		certificateAttachment: z.string().trim().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.hasCertificate && !data.certificateAttachment) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"Certificate attachment is required when 'Has Certificate' is checked",
				path: ["certificateAttachment"],
			});
		}
	});

export type CompleteMaintenanceLogFormValues = z.infer<
	typeof completeMaintenanceLogFormSchema
>;

export function getCompleteLogFormDefaults(): CompleteMaintenanceLogFormValues {
	return {
		completionDate: new Date().toISOString().split("T")[0] ?? "",
		actionsPerformed: "",
		hasCertificate: false,
		certificateAttachment: "",
	};
}
