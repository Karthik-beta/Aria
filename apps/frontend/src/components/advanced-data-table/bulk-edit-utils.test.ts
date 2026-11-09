import type { Row } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import {
	getBulkEditableFields,
	normalizeBulkEditRequest,
} from "./bulk-edit-utils";

const rows = [
	{
		id: "row-1",
		original: { id: "1" },
	},
] as unknown as Row<{ id: string }>[];

describe("bulk-edit-utils", () => {
	describe("normalizeBulkEditRequest", () => {
		it("rejects invalid numbers", () => {
			const result = normalizeBulkEditRequest({
				rows,
				field: {
					columnId: "price",
					field: "price",
					type: "number",
					label: "Price",
					allowClear: false,
					columnConfig: { type: "number" },
				},
				rawValue: "not-a-number",
			});

			expect(result).toEqual({
				ok: false,
				error: "Enter a valid number.",
			});
		});

		it("rejects invalid selects", () => {
			const result = normalizeBulkEditRequest({
				rows,
				field: {
					columnId: "category",
					field: "category",
					type: "select",
					label: "Category",
					options: [{ label: "Hardware", value: "hardware" }],
					allowClear: false,
					columnConfig: { type: "select" },
				},
				rawValue: "unknown",
			});

			expect(result).toEqual({
				ok: false,
				error: "Select a valid option.",
			});
		});

		it("rejects invalid dates", () => {
			const result = normalizeBulkEditRequest({
				rows,
				field: {
					columnId: "launchDate",
					field: "launchDate",
					type: "date",
					label: "Launch Date",
					allowClear: false,
					columnConfig: { type: "date" },
				},
				rawValue: "not-a-date",
			});

			expect(result).toEqual({
				ok: false,
				error: "Enter a valid date.",
			});
		});

		it("returns a clear request for empty values when allowed", () => {
			const result = normalizeBulkEditRequest({
				rows,
				field: {
					columnId: "name",
					field: "name",
					type: "text",
					label: "Name",
					allowClear: true,
					columnConfig: { type: "text", allowClear: true },
				},
				rawValue: "",
			});

			expect(result).toEqual({
				ok: true,
				request: {
					rows,
					columnId: "name",
					field: "name",
					operation: "clear",
					config: {
						columnId: "name",
						field: "name",
						type: "text",
						label: "Name",
						allowClear: true,
						columnConfig: { type: "text", allowClear: true },
					},
				},
			});
		});
	});

	describe("getBulkEditableFields", () => {
		it("excludes accessorFn columns without an explicit payload field", () => {
			const fields = getBulkEditableFields({
				getAllColumns: () => [
					{
						id: "computed",
						columnDef: {
							accessorFn: () => "value",
							meta: {
								label: "Computed",
								bulkEdit: { type: "text" },
							},
						},
					},
				],
			} as never);

			expect(fields).toEqual([]);
		});
	});
});
