import * as z from "zod";

const itemVariantSettingsCopyFieldFormSchema = z.object({
	id: z.string().cuid().optional(),
	fieldKey: z.string().min(1, "Field name is required"),
});

export const itemVariantSettingsFormSchema = z
	.object({
		doNotUpdateVariantsOnSave: z.boolean().default(false),
		allowRenameAttributeValue: z.boolean().default(false),
		copyFields: z.array(itemVariantSettingsCopyFieldFormSchema).default([]),
	})
	.superRefine((settings, ctx) => {
		const seenFieldKeys = new Set<string>();

		for (const [index, field] of settings.copyFields.entries()) {
			const normalizedFieldKey = field.fieldKey.trim();

			if (!normalizedFieldKey) {
				continue;
			}

			if (seenFieldKeys.has(normalizedFieldKey)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Copy fields to variant must be unique",
					path: ["copyFields", index, "fieldKey"],
				});
				continue;
			}

			seenFieldKeys.add(normalizedFieldKey);
		}
	});

export type ItemVariantSettingsFormValues = z.input<
	typeof itemVariantSettingsFormSchema
>;
