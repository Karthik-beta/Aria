import { Inventory } from "@aria/types";
import type { ItemVariantSettingsFormValues } from "./item-variant-settings.schema";

type ItemVariantSettingsFormSource =
	Inventory.UpdateItemVariantSettingsInput & {
		id?: string;
		createdAt?: Date | string;
		updatedAt?: Date | string;
	};

export function createItemVariantSettingsFormValues(
	settings?: ItemVariantSettingsFormSource | null,
): ItemVariantSettingsFormValues {
	return {
		doNotUpdateVariantsOnSave: settings?.doNotUpdateVariantsOnSave ?? false,
		allowRenameAttributeValue: settings?.allowRenameAttributeValue ?? false,
		copyFields:
			settings?.copyFields.map((field) => ({
				id: field.id,
				fieldKey: field.fieldKey,
			})) ?? [],
	};
}

export function buildItemVariantSettingsMutationInput(
	values: ItemVariantSettingsFormValues,
): Inventory.UpdateItemVariantSettingsInput {
	return {
		doNotUpdateVariantsOnSave: values.doNotUpdateVariantsOnSave ?? false,
		allowRenameAttributeValue: values.allowRenameAttributeValue ?? false,
		copyFields: (values.copyFields ?? []).map((field) => {
			const normalizedFieldKey = field.fieldKey.trim();
			const option = Inventory.ITEM_VARIANT_COPY_FIELD_OPTIONS.find(
				(candidate) => candidate.value === normalizedFieldKey,
			);

			if (!option) {
				throw new Error(`Unknown item variant copy field: ${field.fieldKey}`);
			}

			return {
				...(field.id ? { id: field.id } : {}),
				fieldKey: option.value,
			};
		}),
	};
}

export function getSelectableItemVariantCopyFieldOptions(
	selectedFieldKeys: readonly string[],
	currentFieldKey?: string,
): readonly Inventory.ItemVariantCopyFieldOption[] {
	const selectedFieldKeySet = new Set(selectedFieldKeys.filter(Boolean));

	return Inventory.ITEM_VARIANT_COPY_FIELD_OPTIONS.filter((option) => {
		return (
			option.value === currentFieldKey || !selectedFieldKeySet.has(option.value)
		);
	});
}

export function getItemVariantCopyFieldLabel(fieldKey: string): string {
	return (
		Inventory.ITEM_VARIANT_COPY_FIELD_OPTIONS.find(
			(option) => option.value === fieldKey,
		)?.label ?? fieldKey
	);
}
