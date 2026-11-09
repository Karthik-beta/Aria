import { describe, expect, it } from "vitest";
import {
	buildStockSettingsMutationInput,
	createStockSettingsFormValues,
} from "./stock-settings.utils";

describe("stock-settings.utils", () => {
	it("creates stable defaults for a missing settings record", () => {
		expect(createStockSettingsFormValues()).toEqual(
			expect.objectContaining({
				itemNamingBy: "ITEM_CODE",
				defaultWarehouse: "",
				defaultValuationMethod: "FIFO",
				defaultStockUom: "",
				freezeStocksOlderThanDays: 60,
			}),
		);
	});

	it("normalizes optional text fields before mutation", () => {
		const payload = buildStockSettingsMutationInput({
			...createStockSettingsFormValues(),
			defaultWarehouse: " Stores - Secondary ",
			defaultStockUom: "   ",
			allowNegativeStock: true,
		});

		expect(payload).toEqual(
			expect.objectContaining({
				defaultWarehouse: "Stores - Secondary",
				defaultStockUom: null,
				allowNegativeStock: true,
			}),
		);
	});
});
