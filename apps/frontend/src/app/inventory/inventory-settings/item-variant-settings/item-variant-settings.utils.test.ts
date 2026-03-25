import { describe, expect, it } from "vitest";
import {
	buildItemVariantSettingsMutationInput,
	createItemVariantSettingsFormValues,
	getItemVariantCopyFieldLabel,
	getSelectableItemVariantCopyFieldOptions,
} from "./item-variant-settings.utils";

describe("item-variant-settings.utils", () => {
	it("creates stable form values from persisted settings", () => {
		expect(
			createItemVariantSettingsFormValues({
				id: "clh123variantsettings",
				doNotUpdateVariantsOnSave: true,
				allowRenameAttributeValue: false,
				copyFields: [
					{
						id: "clh123field1",
						fieldKey: "description",
						label: "Details",
						category: "Basics",
						itemProperty: "description",
						position: 0,
					},
				],
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				updatedAt: new Date("2026-01-01T00:00:00.000Z"),
			}),
		).toEqual({
			doNotUpdateVariantsOnSave: true,
			allowRenameAttributeValue: false,
			copyFields: [{ id: "clh123field1", fieldKey: "description" }],
		});
	});

	it("builds the mutation input with trimmed field keys", () => {
		expect(
			buildItemVariantSettingsMutationInput({
				doNotUpdateVariantsOnSave: false,
				allowRenameAttributeValue: true,
				copyFields: [
					{ id: "clh123field1", fieldKey: "description" },
					{ fieldKey: " stock_uom " },
				],
			}),
		).toEqual({
			doNotUpdateVariantsOnSave: false,
			allowRenameAttributeValue: true,
			copyFields: [
				{ id: "clh123field1", fieldKey: "description" },
				{ fieldKey: "stock_uom" },
			],
		});
	});

	it("filters selectable field options and resolves labels", () => {
		expect(
			getSelectableItemVariantCopyFieldOptions(
				["description", "stock_uom"],
				"description",
			).map((option) => option.value),
		).toContain("description");
		expect(
			getSelectableItemVariantCopyFieldOptions(
				["description", "stock_uom"],
				"description",
			).map((option) => option.value),
		).not.toContain("stock_uom");
		expect(getItemVariantCopyFieldLabel("description")).toBe("Details");
	});
});
